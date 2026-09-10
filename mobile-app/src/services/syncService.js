import { Directory, File } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Platform } from 'react-native';
import { ApiService } from './api';
import { StorageService } from './storage';
import { NativeSyncService } from './nativeSyncService';
import { LocalVaultService } from './localVaultService';

const StorageAccessFramework =
    FileSystemLegacy?.StorageAccessFramework ||
    FileSystemLegacy?.default?.StorageAccessFramework;

function safeDecodeURI(str) {
    if (!str) return '';
    try {
        return decodeURIComponent(str);
    } catch (e) {
        try {
            return decodeURI(str);
        } catch (e2) {
            return str;
        }
    }
}

export const SyncService = {
    /**
     * Request user to pick a designated sync folder on device.
     * Uses Android Storage Access Framework (SAF) for persistent folder permissions,
     * with Directory.pickDirectoryAsync fallback for newer Expo or iOS.
     */
    async selectVaultFolder() {
        console.log('[SyncService] selectVaultFolder called on Platform:', Platform.OS);

        // 1. Primary Strategy for Android: StorageAccessFramework (grants persistent tree access)
        if (Platform.OS === 'android' && StorageAccessFramework?.requestDirectoryPermissionsAsync) {
            try {
                console.log('[SyncService] Requesting Android SAF directory permissions...');
                const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
                console.log('[SyncService] SAF result:', permissions);

                if (permissions && permissions.granted && permissions.directoryUri) {
                    let friendlyName = 'Vault';
                    try {
                        const decoded = safeDecodeURI(permissions.directoryUri);
                        const parts = decoded.split(':');
                        if (parts.length > 1) {
                            friendlyName = parts[parts.length - 1].replace(/\/$/, '') || 'Vault';
                        }
                    } catch (e) {
                        console.warn('[SyncService] Friendly name parse error:', e);
                    }

                    await StorageService.setVaultFolderName(friendlyName);
                    await StorageService.setVaultDirectoryUri(permissions.directoryUri);

                    return {
                        uri: permissions.directoryUri,
                        name: friendlyName,
                    };
                }

                console.log('[SyncService] User cancelled SAF picker or permission denied');
                return { cancelled: true };
            } catch (safErr) {
                console.warn('[SyncService] SAF request error:', safErr);
            }
        }

        // 2. Secondary Strategy / iOS: Directory.pickDirectoryAsync
        if (Directory?.pickDirectoryAsync) {
            try {
                console.log('[SyncService] Calling Directory.pickDirectoryAsync()...');
                const dir = await Directory.pickDirectoryAsync();
                if (dir && dir.uri) {
                    const friendlyName = dir.name || 'Vault';
                    await StorageService.setVaultFolderName(friendlyName);
                    await StorageService.setVaultDirectoryUri(dir.uri);

                    return {
                        uri: dir.uri,
                        name: friendlyName,
                    };
                }
                return { cancelled: true };
            } catch (dirErr) {
                const errMsg = (dirErr?.message || '').toLowerCase();
                if (errMsg.includes('cancel') || dirErr?.code === 'ERR_PICKER_CANCELLED') {
                    console.log('[SyncService] User cancelled Directory picker');
                    return { cancelled: true };
                }
                console.error('[SyncService] Directory.pickDirectoryAsync error:', dirErr);
                throw dirErr;
            }
        }

        throw new Error('Fitur pemilihan folder belum didukung pada perangkat ini.');
    },

    /**
     * Automatically scan designated folder and return pending unencrypted local files.
     */
    async scanVaultFolder() {
        const folderUri = await StorageService.getVaultDirectoryUri();
        if (!folderUri) {
            return [];
        }

        console.log('[SyncService] Scanning vault folder:', folderUri);
        const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.heic'];
        const syncedIds = await StorageService.getSyncedAssetIds();
        const syncedSet = new Set(syncedIds);
        const pending = [];

        // Method A: StorageAccessFramework for Android content:// URIs
        if (folderUri.startsWith('content://') && StorageAccessFramework?.readDirectoryAsync) {
            try {
                const fileUris = await StorageAccessFramework.readDirectoryAsync(folderUri);
                console.log(`[SyncService] SAF readDirectoryAsync found ${fileUris.length} items`);

                for (let i = 0; i < fileUris.length; i++) {
                    const uri = fileUris[i];
                    const decodedUri = safeDecodeURI(uri);
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
            } catch (safScanErr) {
                console.warn('[SyncService] SAF scan error:', safScanErr);
            }
        }

        // Method B: Directory list from expo-file-system
        if (Directory) {
            try {
                const dir = new Directory(folderUri);
                const items = dir.list();
                console.log(`[SyncService] Directory.list found ${items.length} items`);

                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const isDir = item instanceof Directory || item.isDirectory;
                    if (!isDir) {
                        const filename = item.name || item.uri.split('/').pop() || `file_${i}.jpg`;
                        const ext = filename.split('.').pop().toLowerCase();
                        if (validExtensions.includes(`.${ext}`)) {
                            const isVideo = ext === 'mp4' || ext === 'mov';
                            if (!syncedSet.has(item.uri)) {
                                pending.push({
                                    id: item.uri,
                                    uri: item.uri,
                                    filename: filename,
                                    mediaType: isVideo ? 'video' : 'photo',
                                    isSafFile: true,
                                });
                            }
                        }
                    }
                }
                return pending;
            } catch (dirScanErr) {
                console.warn('[SyncService] Directory.list scan error:', dirScanErr);
            }
        }

        return pending;
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
            console.warn('[SyncService] Error picking media:', e);
            return [];
        }
    },

    /**
     * Subscribe to real-time global sync state updates.
     */
    subscribe(listener) {
        syncListeners.add(listener);
        listener(currentSyncState);
        return () => syncListeners.delete(listener);
    },

    isSyncActive() {
        return isGlobalSyncRunning;
    },

    getCurrentProgress() {
        return currentSyncState;
    },

    cancelSync() {
        if (isGlobalSyncRunning) {
            console.log('[SyncService] cancelSync requested by user');
            isSyncAborted = true;
            notifySync({ isSyncing: false, isCancelled: true, currentFilename: 'Dibatalkan oleh pengguna' });
        }
    },

    /**
     * Sync staged assets to Google Drive encrypted cloud.
     * Deletes the local original from the designated folder once securely backed up.
     */
    async syncAssets(assets, options = {}) {
        if (isGlobalSyncRunning) {
            console.warn('[SyncService] syncAssets blocked: global sync already running!');
            return {
                alreadyRunning: true,
                successCount: 0,
                failCount: 0,
                deletedCount: 0,
            };
        }

        const { onProgress, cloudAlbumId = null } = options;
        const autoDelete = await StorageService.getAutoDeleteLocal();

        isGlobalSyncRunning = true;
        isSyncAborted = false;

        let successCount = 0;
        let failCount = 0;
        let deletedCount = 0;
        const total = assets.length;
        let lastError = null;

        notifySync({
            isSyncing: true,
            isCancelled: false,
            current: 0,
            total,
            percentage: 0,
            currentFilename: total > 0 ? (assets[0].filename || 'Menyiapkan...') : 'Selesai',
            successCount: 0,
            failCount: 0,
        });

        // Keep Android process alive even when app is minimized
        await NativeSyncService.startForegroundSync(
            'Lumina: Sinkronisasi Brankas',
            `Menyinkronkan ${total} berkas ke Cloud...`
        );

        try {
            for (let i = 0; i < total; i++) {
                if (isSyncAborted) {
                    console.log('[SyncService] Sync loop interrupted: user cancelled.');
                    break;
                }

                const asset = assets[i];
                let extractedThumbUri = null;

                try {
                    const ext = asset.filename ? asset.filename.split('.').pop().toLowerCase() : 'jpg';
                    const isVideo = asset.mediaType === 'video' || ext === 'mp4' || ext === 'mov' || ext === 'm4v';
                    const mimeType = isVideo
                        ? `video/${ext === 'mov' ? 'quicktime' : 'mp4'}`
                        : `image/${ext === 'png' ? 'png' : 'jpeg'}`;

                    // Native Video Thumbnail extraction on device
                    if (isVideo && VideoThumbnails?.getThumbnailAsync) {
                        try {
                            const thumbResult = await VideoThumbnails.getThumbnailAsync(asset.uri, {
                                time: 500,
                                quality: 0.85,
                            });
                            if (thumbResult && thumbResult.uri) {
                                extractedThumbUri = thumbResult.uri;
                            }
                        } catch (vtErr) {
                            console.warn('[SyncService] Device video thumbnail extraction warning:', vtErr);
                        }
                    }

                    const filePayload = {
                        uri: asset.uri,
                        fileName: asset.filename || `vault_${Date.now()}.${ext}`,
                        mimeType: mimeType,
                        type: isVideo ? 'video' : 'image',
                        thumbnailUri: extractedThumbUri,
                    };

                    notifySync({
                        isSyncing: true,
                        current: i + 1,
                        total,
                        percentage: Math.round((i / total) * 100),
                        currentFilename: asset.filename || `Berkas ${i + 1}`,
                        successCount,
                        failCount,
                    });

                    await NativeSyncService.updateProgress(
                        i + 1,
                        total,
                        `Mengunggah ${asset.filename || 'berkas'} (${i + 1}/${total})...`
                    );

                    // Upload to cloud (AES-256 encrypted storage) with progress
                    const uploadRes = await ApiService.uploadMedia(filePayload, cloudAlbumId, asset.filename, (percent) => {
                        const overallPercent = Math.min(100, Math.round(((i + (percent / 100)) / total) * 100));
                        notifySync({
                            percentage: overallPercent,
                        });
                        if (onProgress) {
                            onProgress({
                                current: i + 1,
                                total,
                                percentage: overallPercent,
                                asset,
                                itemPercent: percent,
                                success: true,
                            });
                        }
                    });

                    successCount++;

                    // Mark synced IMMEDIATELY per-file so interrupted sync never repeats already uploaded items!
                    await StorageService.addSyncedAssetIds([asset.id]);

                    // Clean up extracted thumbnail file
                    if (extractedThumbUri) {
                        try {
                            await FileSystemLegacy.deleteAsync(extractedThumbUri, { idempotent: true });
                        } catch (e) {}
                    }

                    // Preserve copy in private offline sandbox for 0.05s instant playback
                    const uploadedMediaId = uploadRes?.uploaded?.[0]?.id;
                    const keepLocal = await StorageService.getKeepLocalVault();
                    if (uploadedMediaId && keepLocal) {
                        try {
                            await LocalVaultService.saveSyncedAsset(
                                uploadedMediaId,
                                asset.uri,
                                asset.filename,
                                mimeType
                            );
                        } catch (vaultErr) {
                            console.warn('[SyncService] Local vault save warning:', vaultErr);
                        }
                    }

                    // If it's a SAF / designated folder file and autoDelete is enabled, delete local original!
                    if (autoDelete && asset.isSafFile) {
                        let deleted = false;
                        if (asset.uri.startsWith('content://') && StorageAccessFramework?.deleteAsync) {
                            try {
                                await StorageAccessFramework.deleteAsync(asset.uri);
                                deleted = true;
                            } catch (delErr) {
                                console.warn('[SyncService] SAF delete error:', delErr);
                            }
                        }
                        if (!deleted && File) {
                            try {
                                const f = new File(asset.uri);
                                f.delete();
                                deleted = true;
                            } catch (fErr) {
                                console.warn('[SyncService] File.delete error:', fErr);
                            }
                        }
                        if (deleted) {
                            deletedCount++;
                        }
                    }

                    const itemDonePercent = Math.round(((i + 1) / total) * 100);
                    notifySync({
                        current: i + 1,
                        total,
                        percentage: itemDonePercent,
                        successCount,
                        failCount,
                    });

                    if (onProgress) {
                        onProgress({
                            current: i + 1,
                            total,
                            percentage: itemDonePercent,
                            asset,
                            success: true,
                        });
                    }
                } catch (err) {
                    lastError = err?.message || String(err);
                    console.warn(`[SyncService] Sync failed for ${asset.filename}:`, err);
                    failCount++;
                    notifySync({
                        failCount,
                    });
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
        } finally {
            isGlobalSyncRunning = false;
            notifySync({
                isSyncing: false,
                currentFilename: isSyncAborted ? 'Sinkronisasi Dibatalkan' : 'Sinkronisasi Selesai',
                percentage: 100,
                successCount,
                failCount,
            });
            await NativeSyncService.stopForegroundSync();
        }

        return {
            successCount,
            failCount,
            deletedCount,
            autoDeleteRequested: autoDelete,
            lastError,
            isCancelled: isSyncAborted,
        };
    },

    isAutoSyncActive() {
        return isGlobalSyncRunning;
    },

    /**
     * Checks if auto-sync is enabled, scans the designated Vault folder,
     * and automatically uploads/encrypts pending files in background.
     * Single-execution lock prevents race conditions.
     */
    async triggerAutoSyncIfPending(callbacks = {}) {
        const { onStart, onProgress, onComplete, onError } = callbacks;

        if (isGlobalSyncRunning) {
            return null;
        }

        const autoSyncEnabled = await StorageService.getAutoSyncEnabled();
        if (!autoSyncEnabled) {
            return null;
        }

        const folderUri = await StorageService.getVaultDirectoryUri();
        if (!folderUri) {
            return null;
        }

        try {
            const pending = await this.scanVaultFolder();
            if (!pending || pending.length === 0) {
                return null;
            }

            console.log(`[SyncService] AutoSync detected ${pending.length} pending files in Vault.`);
            onStart && onStart({ total: pending.length, assets: pending });

            const result = await this.syncAssets(pending, {
                onProgress: (p) => {
                    onProgress && onProgress(p);
                },
            });

            onComplete && onComplete(result);
            return result;
        } catch (err) {
            console.error('[SyncService] AutoSync error:', err);
            onError && onError(err);
            return null;
        }
    },
};

let isGlobalSyncRunning = false;
let isSyncAborted = false;
let currentSyncState = {
    isSyncing: false,
    isCancelled: false,
    current: 0,
    total: 0,
    percentage: 0,
    currentFilename: '',
    successCount: 0,
    failCount: 0,
};
const syncListeners = new Set();

function notifySync(state) {
    currentSyncState = { ...currentSyncState, ...state };
    syncListeners.forEach((fn) => {
        try {
            fn(currentSyncState);
        } catch (e) {}
    });
}
