import * as MediaLibrary from 'expo-media-library';
import { ApiService } from './api';
import { StorageService } from './storage';

export const SyncService = {
    /**
     * Request device media library permissions.
     */
    async requestPermissions() {
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            return status === 'granted';
        } catch (e) {
            console.warn('Permission request error:', e);
            return false;
        }
    },

    /**
     * Check current permission status.
     */
    async hasPermissions() {
        try {
            const { status } = await MediaLibrary.getPermissionsAsync();
            return status === 'granted';
        } catch (e) {
            return false;
        }
    },

    /**
     * Fetch list of albums on the device for the user to choose from.
     */
    async getDeviceAlbums() {
        try {
            const permitted = await this.hasPermissions();
            if (!permitted) return [];

            const albums = await MediaLibrary.getAlbumsAsync();
            return albums.sort((a, b) => b.assetCount - a.assetCount);
        } catch (e) {
            console.warn('Failed to load device albums:', e);
            return [];
        }
    },

    /**
     * Find album by name.
     */
    async findAlbumByName(albumName) {
        try {
            const albums = await MediaLibrary.getAlbumsAsync();
            return albums.find(
                (a) => a.title.toLowerCase() === albumName.trim().toLowerCase()
            ) || null;
        } catch (e) {
            return null;
        }
    },

    /**
     * Read pending (unsynced) media assets from the designated vault folder.
     */
    async getPendingVaultAssets(folderName = null) {
        try {
            const permitted = await this.hasPermissions();
            if (!permitted) return { album: null, assets: [] };

            const targetName = folderName || (await StorageService.getVaultFolderName());
            const album = await this.findAlbumByName(targetName);

            if (!album) {
                return { album: null, assets: [] };
            }

            // Fetch up to 100 recent assets from this folder
            const res = await MediaLibrary.getAssetsAsync({
                album: album.id,
                first: 100,
                sortBy: [MediaLibrary.SortBy.creationTime],
                mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
            });

            const syncedIds = await StorageService.getSyncedAssetIds();
            const syncedSet = new Set(syncedIds);

            // Pending assets = items not yet recorded as synced
            const pending = (res.assets || []).filter((a) => !syncedSet.has(a.id));

            return {
                album,
                assets: pending,
            };
        } catch (e) {
            console.warn('Error reading vault assets:', e);
            return { album: null, assets: [] };
        }
    },

    /**
     * Sync a list of assets to the cloud vault.
     * Encrypts each item in Google Drive via backend API and optionally deletes the local copy.
     */
    async syncAssets(assets, options = {}) {
        const { onProgress, cloudAlbumId = null } = options;
        const autoDelete = await StorageService.getAutoDeleteLocal();

        let successCount = 0;
        let failCount = 0;
        const uploadedAssetIds = [];
        const total = assets.length;

        for (let i = 0; i < total; i++) {
            const asset = assets[i];
            try {
                // Get detailed asset info to obtain file URI
                const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id);
                const fileUri = assetInfo.localUri || asset.uri;

                const ext = asset.filename ? asset.filename.split('.').pop().toLowerCase() : 'jpg';
                const isVideo = asset.mediaType === 'video' || ext === 'mp4' || ext === 'mov';
                const mimeType = isVideo ? `video/${ext === 'mov' ? 'quicktime' : 'mp4'}` : `image/${ext === 'png' ? 'png' : 'jpeg'}`;

                const filePayload = {
                    uri: fileUri,
                    fileName: asset.filename || `vault_${Date.now()}.${ext}`,
                    mimeType: mimeType,
                };

                // Upload to cloud (AES-256 encrypted storage)
                await ApiService.uploadMedia(filePayload, cloudAlbumId, asset.filename);

                successCount++;
                uploadedAssetIds.push(asset.id);

                if (onProgress) {
                    onProgress({
                        current: i + 1,
                        total,
                        percentage: Math.round(((i + 1) / total) * 100),
                        asset,
                        success: true,
                    });
                }
            } catch (err) {
                console.warn(`Sync failed for ${asset.filename}:`, err);
                failCount++;
                if (onProgress) {
                    onProgress({
                        current: i + 1,
                        total,
                        percentage: Math.round(((i + 1) / total) * 100),
                        asset,
                        success: false,
                        error: err.message,
                    });
                }
            }
        }

        // Record synced asset IDs
        if (uploadedAssetIds.length > 0) {
            await StorageService.addSyncedAssetIds(uploadedAssetIds);
        }

        // Secure Zero Footprint: Delete local original files from device gallery
        let deletedCount = 0;
        if (autoDelete && uploadedAssetIds.length > 0) {
            try {
                const deleted = await MediaLibrary.deleteAssetsAsync(uploadedAssetIds);
                if (deleted) {
                    deletedCount = uploadedAssetIds.length;
                }
            } catch (e) {
                console.warn('Failed to delete local originals:', e);
            }
        }

        return {
            successCount,
            failCount,
            deletedCount,
        };
    },
};
