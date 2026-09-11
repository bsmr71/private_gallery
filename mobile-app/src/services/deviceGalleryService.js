import * as MediaLibrary from 'expo-media-library';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { LocalVaultService } from './localVaultService';
import { MediaUrlHelper } from './mediaUrl';

export const DeviceGalleryService = {
    /**
     * Request system permission to write into public device gallery (DCIM / Pictures).
     */
    async requestGalleryPermission() {
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            return status === 'granted';
        } catch (e) {
            console.warn('[DeviceGalleryService] Permission request failed:', e);
            return false;
        }
    },

    /**
     * Download and save a single media file directly into device's PUBLIC Gallery (Google Photos, Samsung Gallery, DCIM).
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
            let isTempFile = false;
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
                isTempFile = true;
            }

            // 3. Try direct save via expo-media-library (saves into Camera Roll / DCIM)
            const hasPermission = await this.requestGalleryPermission();
            if (hasPermission) {
                try {
                    const asset = await MediaLibrary.createAssetAsync(sourceFileUri);
                    if (asset) {
                        // Optionally add to specific album named 'Private Gallery'
                        try {
                            const album = await MediaLibrary.getAlbumAsync('Private Gallery');
                            if (album == null) {
                                await MediaLibrary.createAlbumAsync('Private Gallery', asset, false);
                            } else {
                                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
                            }
                        } catch (albumErr) {
                            // Non-critical album grouping failure
                        }

                        // Clean up temporary file if created
                        if (isTempFile) {
                            FileSystemLegacy.deleteAsync(sourceFileUri, { idempotent: true }).catch(() => {});
                        }

                        return {
                            success: true,
                            method: 'mediaLibrary',
                            message: `Tersimpan ke Galeri HP di album "Private Gallery"`,
                        };
                    }
                } catch (mlErr) {
                    console.warn('[DeviceGalleryService] createAssetAsync failed, falling back to Share sheet:', mlErr);
                }
            }

            // 4. Fallback: Open system native Share Sheet so user can pick "Save Image / Save to Files"
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
                    message: `Lembar penyimpanan Galeri HP dibuka`,
                };
            }

            return {
                success: false,
                method: 'failed',
                message: 'Tidak ada izin penyimpanan galeri atau aplikasi berbagi.',
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
     * Download and save multiple media files directly into device's PUBLIC Gallery.
     */
    async saveMultipleToDeviceGallery(items, { onProgress, onComplete, onError } = {}) {
        if (!items || items.length === 0) {
            onComplete && onComplete({ successCount: 0, total: 0 });
            return;
        }

        const total = items.length;
        let successCount = 0;
        let failedCount = 0;

        const hasPermission = await this.requestGalleryPermission();

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
            hasPermission,
        });
    },
};
