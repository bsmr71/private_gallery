import { Directory, File } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Platform } from 'react-native';
import { ApiService } from './api';
import { StorageService } from './storage';
import { NativeSyncService } from './nativeSyncService';
import { LocalVaultService } from './localVaultService';
import { ChunkUploadService } from './chunkUploadService';

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

        console.log('[SyncService] Scanning vault folder (recursive):', folderUri);
        const validExtensions = [
            '.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.heic', '.heif',
            '.gif', '.m4v', '.3gp', '.mkv', '.webm', '.dng'
        ];
        const syncedIds = await StorageService.getSyncedAssetIds();
        const syncedSet = new Set(syncedIds);
        const pending = [];

        // Method A: StorageAccessFramework for Android content:// URIs with recursive subfolder traversal
        if (folderUri.startsWith('content://') && StorageAccessFramework?.readDirectoryAsync) {
            try {
                const dirQueue = [folderUri];
                const visitedDirs = new Set();
                const maxDirsToScan = 80;

                while (dirQueue.length > 0 && visitedDirs.size < maxDirsToScan) {
                    const currentDir = dirQueue.shift();
                    if (visitedDirs.has(currentDir)) continue;
                    visitedDirs.add(currentDir);

                    let children = [];
                    try {
                        children = await StorageAccessFramework.readDirectoryAsync(currentDir);
                    } catch (readErr) {
                        console.warn('[SyncService] Could not read SAF directory:', currentDir, readErr?.message || readErr);
                        continue;
                    }

                    for (let i = 0; i < children.length; i++) {
                        const childUri = children[i];
                        if (visitedDirs.has(childUri)) continue;

                        const decodedUri = safeDecodeURI(childUri);
                        const rawName = decodedUri.split('/').pop() || `item_${i}`;
                        const cleanName = rawName.split('?')[0];
                        const parts = cleanName.split('.');
                        const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';

                        // Check if childUri is a subdirectory
                        // If it doesn't match a media extension, test if it can be read as a directory
                        if (!validExtensions.includes(`.${ext}`)) {
                            try {
                                const subItems = await StorageAccessFramework.readDirectoryAsync(childUri);
                                // Succeeded! It IS a subdirectory!
                                dirQueue.push(childUri);
                                continue;
                            } catch (notDir) {
                                // Not a directory, treat as a potential file below
                            }
                        }

                        const isKnownExt = validExtensions.includes(`.${ext}`);
                        const isMediaUri = childUri.includes('/image%3A') || childUri.includes('/video%3A') ||
                                           childUri.includes('image:') || childUri.includes('video:') ||
                                           decodedUri.includes('image:') || decodedUri.includes('video:');

                        if (isKnownExt || isMediaUri) {
                            const isVideo = ['mp4', 'mov', 'm4v', '3gp', 'mkv', 'webm'].includes(ext) ||
                                            childUri.toLowerCase().includes('video');
                            const finalFilename = isKnownExt ? cleanName : `media_${Date.now()}_${pending.length}.${isVideo ? 'mp4' : 'jpg'}`;

                            if (!syncedSet.has(childUri)) {
                                pending.push({
                                    id: childUri,
                                    uri: childUri,
                                    filename: finalFilename,
                                    mediaType: isVideo ? 'video' : 'photo',
                                    isSafFile: true,
                                });
                            }
                        }
                    }
                }

                console.log(`[SyncService] Recursive SAF scan completed: found ${pending.length} pending items across ${visitedDirs.size} folders`);
                return pending;
            } catch (safScanErr) {
                console.warn('[SyncService] SAF scan error:', safScanErr);
            }
        }

        // Method B: Directory list from expo-file-system with recursive subfolder traversal
        if (Directory) {
            try {
                const dirQueue = [folderUri];
                const visitedDirs = new Set();
                const maxDirsToScan = 80;

                while (dirQueue.length > 0 && visitedDirs.size < maxDirsToScan) {
                    const currentDirUri = dirQueue.shift();
                    if (visitedDirs.has(currentDirUri)) continue;
                    visitedDirs.add(currentDirUri);

                    try {
                        const dir = new Directory(currentDirUri);
                        const items = dir.list();
                        for (let i = 0; i < items.length; i++) {
                            const item = items[i];
                            const isDir = item instanceof Directory || item.isDirectory;
                            if (isDir) {
                                dirQueue.push(item.uri);
                            } else {
                                const filename = item.name || item.uri.split('/').pop() || `file_${i}.jpg`;
                                const cleanName = filename.split('?')[0];
                                const ext = cleanName.split('.').pop().toLowerCase();
                                if (validExtensions.includes(`.${ext}`)) {
                                    const isVideo = ['mp4', 'mov', 'm4v', '3gp', 'mkv', 'webm'].includes(ext);
                                    if (!syncedSet.has(item.uri)) {
                                        pending.push({
                                            id: item.uri,
                                            uri: item.uri,
                                            filename: cleanName,
                                            mediaType: isVideo ? 'video' : 'photo',
                                            isSafFile: true,
                                        });
                                    }
                                }
                            }
                        }
                    } catch (subDirErr) {
                        console.warn('[SyncService] Directory list err:', currentDirUri, subDirErr);
                    }
                }

                console.log(`[SyncService] Recursive Directory scan completed: found ${pending.length} items`);
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
        let consecutiveErrors = 0;

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

        // Native progress bar in system notification panel
        try {
            await NativeSyncService.startForegroundSync(
                'Lumina: Sinkronisasi Brankas',
                `Menyinkronkan ${total} berkas ke Cloud...`,
                total
            );
        } catch (notifErr) {}

        try {
            for (let i = 0; i < total; i++) {
                if (isSyncAborted) {
                    console.log('[SyncService] Sync loop interrupted: user cancelled.');
                    break;
                }

                const asset = assets[i];
                let extractedThumbUri = null;
                let tempLocalStagingUri = null;

                try {
                    const ext = asset.filename ? asset.filename.split('.').pop().toLowerCase() : 'jpg';
                    const isVideo = asset.mediaType === 'video' || ext === 'mp4' || ext === 'mov' || ext === 'm4v';
                    const mimeType = isVideo
                        ? `video/${ext === 'mov' ? 'quicktime' : 'mp4'}`
                        : `image/${ext === 'png' ? 'png' : 'jpeg'}`;

                    // Stage SAF content:// URI into local app cache to ensure full file access,
                    // accurate size determination, and support by React Native FormData and chunk slicer
                    let workingUri = asset.uri;
                    if (asset.uri && asset.uri.startsWith('content://')) {
                        const safeName = (asset.filename || `vault_${Date.now()}`).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
                        tempLocalStagingUri = `${FileSystemLegacy.cacheDirectory}sync_stg_${Date.now()}_${safeName}`;
                        try {
                            await FileSystemLegacy.copyAsync({
                                from: asset.uri,
                                to: tempLocalStagingUri,
                            });
                            workingUri = tempLocalStagingUri;
                        } catch (copyErr) {
                            console.warn('[SyncService] Gagal menyalin SAF content URI ke cache:', copyErr);
                            workingUri = asset.uri;
                        }
                    }

                    // Read accurate file size on device
                    let realFileSize = asset.fileSize || 0;
                    if (workingUri.startsWith('file://')) {
                        try {
                            const info = await FileSystemLegacy.getInfoAsync(workingUri);
                            if (info && info.exists && info.size) {
                                realFileSize = info.size;
                            }
                        } catch (szErr) {}
                    }

                    // Native Video Thumbnail extraction on device
                    if (isVideo && VideoThumbnails?.getThumbnailAsync) {
                        try {
                            const thumbResult = await VideoThumbnails.getThumbnailAsync(workingUri, {
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
                        uri: workingUri,
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

                    try {
                        await NativeSyncService.updateProgress(
                            i + 1,
                            total,
                            `Mengunggah ${asset.filename || 'berkas'} (${i + 1}/${total})...`
                        );
                    } catch (notifErr) {}

                    // Upload to cloud (AES-256 encrypted storage) with progress
                    let uploadRes;
                    const useChunk = ChunkUploadService.shouldUseChunkUpload(realFileSize, isVideo);

                    if (useChunk) {
                        console.log(`[SyncService] Menggunakan mesin chunk upload untuk: ${asset.filename} (${(realFileSize / (1024 * 1024)).toFixed(2)} MB)`);
                        uploadRes = await ChunkUploadService.uploadLargeFile(
                            {
                                ...asset,
                                uri: workingUri,
                                fileSize: realFileSize,
                                thumbnailUri: extractedThumbUri,
                            },
                            {
                                albumId: cloudAlbumId,
                                title: asset.filename,
                                isAbortedCheck: () => isSyncAborted,
                                onProgress: (percent) => {
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
                                },
                            }
                        );
                    } else {
                        uploadRes = await ApiService.uploadMedia(filePayload, cloudAlbumId, asset.filename, (percent) => {
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
                    }

                    successCount++;
                    consecutiveErrors = 0;

                    // Mark synced IMMEDIATELY per-file so interrupted sync never repeats already uploaded items!
                    await StorageService.addSyncedAssetIds([asset.id]);

                    // Clean up extracted thumbnail file
                    if (extractedThumbUri) {
                        try {
                            await FileSystemLegacy.deleteAsync(extractedThumbUri, { idempotent: true });
                        } catch (e) {}
                    }

                    // Preserve copy in private offline sandbox for 0.05s instant playback
                    const uploadedMediaId = uploadRes?.uploaded?.[0]?.id || uploadRes?.media?.id;
                    const keepLocal = await StorageService.getKeepLocalVault();
                    if (uploadedMediaId && keepLocal) {
                        try {
                            await LocalVaultService.saveSyncedAsset(
                                uploadedMediaId,
                                workingUri,
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
                    consecutiveErrors++;

                    // Check if error is network disconnection / background restriction
                    const errMsg = (lastError || '').toLowerCase();
                    const isNetworkErr =
                        errMsg.includes('network request failed') ||
                        errMsg.includes('koneksi terputus') ||
                        errMsg.includes('timeout') ||
                        errMsg.includes('aborted') ||
                        errMsg.includes('failed to connect');

                    // If 3 consecutive failures occur, pause to prevent burning the queue blindly
                    if (consecutiveErrors >= 3) {
                        const pauseReason = isNetworkErr
                            ? 'Jaringan terputus saat di latar belakang'
                            : (lastError ? `Gagal: ${lastError.substring(0, 50)}` : 'Kendala koneksi ke server');
                        console.warn(`[SyncService] 3 kegagalan berturut-turut (${pauseReason}). Sinkronisasi dijeda.`);
                        notifySync({
                            isSyncing: false,
                            isPaused: true,
                            pauseReason: pauseReason,
                            currentFilename: 'Sinkronisasi dijeda',
                            successCount,
                            failCount,
                        });
                        break;
                    }

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
                } finally {
                    if (tempLocalStagingUri) {
                        try {
                            await FileSystemLegacy.deleteAsync(tempLocalStagingUri, { idempotent: true });
                        } catch (e) {}
                    }
                }
            }
        } finally {
            isGlobalSyncRunning = false;
            const isAllSuccess = failCount === 0;
            const isTotalFail = failCount > 0 && successCount === 0;

            notifySync({
                isSyncing: false,
                currentFilename: isSyncAborted
                    ? 'Sinkronisasi Dibatalkan'
                    : isTotalFail
                    ? `Gagal mengunggah ${failCount} berkas`
                    : !isAllSuccess
                    ? `Selesai Sebagian (${successCount} sukses, ${failCount} gagal)`
                    : `Sinkronisasi Selesai (${successCount} berkas)`,
                percentage: 100,
                successCount,
                failCount,
            });
            try {
                await NativeSyncService.stopForegroundSync({
                    successCount,
                    failCount,
                    total,
                });
            } catch (notifErr) {}
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

        if (isGlobalSyncRunning || isAutoSyncScanning) {
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

        isAutoSyncScanning = true;
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
        } finally {
            isAutoSyncScanning = false;
        }
    },
};

let isGlobalSyncRunning = false;
let isAutoSyncScanning = false;
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
