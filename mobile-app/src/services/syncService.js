import { StorageAccessFramework } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { ApiService } from './api';
import { StorageService } from './storage';

export const SyncService = {
    /**
     * Request user to pick a designated sync folder on device (Android Storage Access Framework).
     * Grants persistent read & delete permissions for this specific folder.
     */
    async selectVaultFolder() {
        if (Platform.OS !== 'android' || !StorageAccessFramework) {
            return null;
        }

        try {
            const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (permissions.granted && permissions.directoryUri) {
                // Decode URI to friendly folder name
                let friendlyName = 'Vault';
                try {
                    const decoded = decodeURIComponent(permissions.directoryUri);
                    const parts = decoded.split(':');
                    if (parts.length > 1) {
                        friendlyName = parts[parts.length - 1].replace(/\/$/, '') || 'Vault';
                    }
                } catch (e) {}

                await StorageService.setVaultFolderName(friendlyName);
                await StorageService.setVaultDirectoryUri(permissions.directoryUri);

                return {
                    uri: permissions.directoryUri,
                    name: friendlyName,
                };
            }
            return null;
        } catch (e) {
            console.warn('Error requesting directory permissions:', e);
            return null;
        }
    },

    /**
     * Automatically scan designated folder and return pending unencrypted local files.
     */
    async scanVaultFolder() {
        const folderUri = await StorageService.getVaultDirectoryUri();
        if (!folderUri || Platform.OS !== 'android' || !StorageAccessFramework) {
            return [];
        }

        try {
            const fileUris = await StorageAccessFramework.readDirectoryAsync(folderUri);
            const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.heic'];

            const syncedIds = await StorageService.getSyncedAssetIds();
            const syncedSet = new Set(syncedIds);

            const pending = [];
            for (let i = 0; i < fileUris.length; i++) {
                const uri = fileUris[i];
                const decodedUri = decodeURIComponent(uri);
                const filename = decodedUri.split('/').pop() || `file_${i}.jpg`;
                const ext = filename.split('.').pop().toLowerCase();

                if (validExtensions.includes(`.${ext}`)) {
                    const isVideo = ext === 'mp4' || ext === 'mov';
                    if (!syncedSet.has(uri)) {
                        pending.push({
                            id: uri,
                            uri: uri,
                            filename: filename,
                            mediaType: isVideo ? 'video' : 'photo',
                            isSafFile: true,
                        });
                    }
                }
            }

            return pending;
        } catch (e) {
            console.warn('Error scanning vault folder:', e);
            return [];
        }
    },

    /**
     * Manual photo selection from gallery (any folder).
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
                    isSafFile: false,
                };
            });
        } catch (e) {
            console.warn('Error picking media:', e);
            return [];
        }
    },

    /**
     * Sync staged assets to Google Drive encrypted cloud.
     * Deletes the local original from the designated folder once securely backed up.
     */
    async syncAssets(assets, options = {}) {
        const { onProgress, cloudAlbumId = null } = options;
        const autoDelete = await StorageService.getAutoDeleteLocal();

        let successCount = 0;
        let failCount = 0;
        let deletedCount = 0;
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

                // If it's a SAF folder file and autoDelete is enabled, delete local original!
                if (autoDelete && asset.isSafFile && StorageAccessFramework) {
                    try {
                        await StorageAccessFramework.deleteAsync(asset.uri);
                        deletedCount++;
                    } catch (delErr) {
                        console.warn('SAF delete error:', delErr);
                    }
                }

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
            deletedCount,
            autoDeleteRequested: autoDelete,
        };
    },
};
