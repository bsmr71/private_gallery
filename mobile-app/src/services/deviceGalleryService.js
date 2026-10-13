import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library/legacy';
import { LocalVaultService } from './localVaultService';
import { MediaUrlHelper } from './mediaUrl';

export const DeviceGalleryService = {
    /**
     * Request MediaLibrary permissions for saving to public gallery.
     */
    async requestGalleryPermission() {
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            return status === 'granted';
        } catch (e) {
            console.warn('[DeviceGalleryService] Permission request error:', e);
            return false;
        }
    },

    /**
     * Download and save a single media file to the user's phone storage / public gallery.
     * Uses expo-media-library/legacy to insert directly into Android MediaStore / iOS Camera Roll (Album: Private Gallery).
     * Falls back to native Share Sheet if permission is denied.
     * @param {Object} mediaItem - The media item object
     * @returns {Promise<{ success: boolean, method: 'mediaLibrary'|'share'|'failed', message?: string }>}
     */
    async saveToDeviceGallery(mediaItem) {
        if (!mediaItem || !mediaItem.id) {
            return { success: false, method: 'failed', message: 'Berkas tidak valid' };
        }

        const isVideo = Boolean(
            mediaItem.type === 'video' ||
            (mediaItem.mime_type && mediaItem.mime_type.includes('video')) ||
            (mediaItem.original_filename && mediaItem.original_filename.match(/\.(mp4|mov|m4v)$/i))
        );
        const ext = isVideo ? 'mp4' : 'jpg';
        const rawFilename = mediaItem.original_filename || mediaItem.title || `media_${mediaItem.id}.${ext}`;
        const filename = rawFilename.includes('.') ? rawFilename : `${rawFilename}.${ext}`;
        const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

        try {
            // 1. Check if we already have the decrypted local file in LocalVaultService
            let sourceFileUri = LocalVaultService.getLocalUri(mediaItem.id);

            // 2. If not in local vault, download from cloud to cacheDirectory
            if (!sourceFileUri) {
                const rawUrl = mediaItem.download_url || mediaItem.stream_url;
                const token = MediaUrlHelper.getToken();
                const resolvedUrl = MediaUrlHelper.resolve(rawUrl);

                const tempTargetUri = `${FileSystemLegacy.cacheDirectory}export_${Date.now()}_${safeName}`;
                const res = await FileSystemLegacy.downloadAsync(resolvedUrl, tempTargetUri, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });

                if (res.status !== 200) {
                    throw new Error(`Unduhan gagal dengan status ${res.status}`);
                }
                sourceFileUri = res.uri;
            }

            // 3. Save directly to Phone's Public MediaLibrary (Google Photos / Galeri HP)
            try {
                const hasPermission = await this.requestGalleryPermission();
                if (hasPermission) {
                    const formattedUri = sourceFileUri.startsWith('file:///')
                        ? sourceFileUri
                        : (sourceFileUri.startsWith('file://') ? sourceFileUri.replace('file://', 'file:///') : `file:///${sourceFileUri.replace(/^\/+/, '')}`);

                    const asset = await MediaLibrary.createAssetAsync(formattedUri);
                    try {
                        const album = await MediaLibrary.getAlbumAsync('Private Gallery');
                        if (album) {
                            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
                        } else {
                            await MediaLibrary.createAlbumAsync('Private Gallery', asset, false);
                        }
                    } catch (albumErr) {
                        console.log('[DeviceGalleryService] Album add notice:', albumErr?.message);
                    }

                    return {
                        success: true,
                        method: 'mediaLibrary',
                        message: 'Berkas berhasil disimpan ke Galeri HP (Album: Private Gallery)',
                    };
                }
            } catch (mediaLibErr) {
                console.warn('[DeviceGalleryService] MediaLibrary save error, falling back to Share:', mediaLibErr);
            }

            // 4. Fallback to Android native Share Sheet if permission is not granted or MediaLibrary fails
            const isSharingAvailable = await Sharing.isAvailableAsync();
            if (isSharingAvailable) {
                await Sharing.shareAsync(sourceFileUri, {
                    mimeType: mediaItem.mime_type || (isVideo ? 'video/mp4' : 'image/jpeg'),
                    dialogTitle: `Simpan ${filename} ke Galeri HP`,
                    UTI: isVideo ? 'public.movie' : 'public.image',
                });

                return {
                    success: true,
                    method: 'share',
                    message: 'Lembar simpan ke Galeri HP berhasil dibuka',
                };
            }

            return {
                success: false,
                method: 'failed',
                message: 'Izin akses galeri ditolak dan fitur penyimpanan tidak didukung.',
            };
        } catch (err) {
            console.error('[DeviceGalleryService] saveToDeviceGallery error:', err);
            return {
                success: false,
                method: 'failed',
                message: err?.message || 'Gagal menyimpan ke galeri HP',
            };
        }
    },

    /**
     * Download and save multiple media files to device storage via native sharing.
     */
    async saveMultipleToDeviceGallery(items, { onProgress, onComplete, onError } = {}) {
        if (!items || items.length === 0) {
            onComplete && onComplete({ successCount: 0, total: 0 });
            return;
        }

        const total = items.length;
        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            onProgress && onProgress({
                current: i + 1,
                total,
                percentage: Math.round(((i + 1) / total) * 100),
                activeFilename: it.original_filename || it.title || `Berkas ${i + 1}`,
            });

            try {
                const res = await this.saveToDeviceGallery(it);
                if (res.success) {
                    successCount++;
                } else {
                    failedCount++;
                }
            } catch (e) {
                failedCount++;
            }
        }

        onComplete && onComplete({
            successCount,
            failedCount,
            total,
        });
    },
};
