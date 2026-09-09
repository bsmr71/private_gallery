import * as ImagePicker from 'expo-image-picker';
import { ApiService } from './api';
import { StorageService } from './storage';

export const SyncService = {
    /**
     * Request device media library permissions via expo-image-picker (fully supported in Expo Go).
     */
    async requestPermissions() {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            return status === 'granted';
        } catch (e) {
            console.warn('Permission request error:', e);
            return false;
        }
    },

    /**
     * Open system photo picker to select multiple photos/videos from any folder.
     */
    async pickMediaFromDevice(options = {}) {
        try {
            const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images', 'videos'],
                allowsMultipleSelection: true,
                selectionLimit: options.limit || 50,
                quality: 1,
            });

            if (res.canceled || !res.assets) {
                return [];
            }

            return res.assets.map((a, idx) => {
                const ext = a.fileName ? a.fileName.split('.').pop().toLowerCase() : (a.type === 'video' ? 'mp4' : 'jpg');
                return {
                    id: a.assetId || `vault_${Date.now()}_${idx}`,
                    uri: a.uri,
                    filename: a.fileName || `vault_${Date.now()}_${idx}.${ext}`,
                    mediaType: a.type === 'video' ? 'video' : 'photo',
                    width: a.width,
                    height: a.height,
                    fileSize: a.fileSize,
                };
            });
        } catch (e) {
            console.warn('Error picking media:', e);
            return [];
        }
    },

    /**
     * Sync a list of staged assets to the cloud vault.
     * Encrypts each item in Google Drive via backend API.
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
                const ext = asset.filename ? asset.filename.split('.').pop().toLowerCase() : 'jpg';
                const isVideo = asset.mediaType === 'video' || ext === 'mp4' || ext === 'mov';
                const mimeType = isVideo
                    ? `video/${ext === 'mov' ? 'quicktime' : 'mp4'}`
                    : `image/${ext === 'png' ? 'png' : 'jpeg'}`;

                const filePayload = {
                    uri: asset.uri,
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

        return {
            successCount,
            failCount,
            autoDeleteRequested: autoDelete,
        };
    },
};

