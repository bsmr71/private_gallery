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
import { GoogleDriveDirectService } from './googleDriveDirectService';
import { CryptoService } from './cryptoService';

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
     * Supports deep subfolders (up to depth 8, including folder names with dots) and preserves subfolder name as albumName.
     */
    async scanVaultFolder(options = {}) {
        const folderUri = await StorageService.getVaultDirectoryUri();
        if (!folderUri) {
            return [];
        }

        console.log('[SyncService] Scanning vault folder (recursive):', folderUri);
        const validExtensions = [
            '.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.heic', '.heif',
            '.m4v', '.3gp', '.mkv', '.webm', '.avi', '.gif', '.bmp', '.dng', '.raw'
        ];
        const videoExtensions = ['mp4', 'mov', 'm4v', '3gp', 'mkv', 'webm', 'avi'];
        const photoExtensions = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'dng', 'raw'];

        const isForceAll = options.forceAll === true;
        const syncedIds = isForceAll ? [] : await StorageService.getSyncedAssetIds();
        const syncedSet = new Set(syncedIds);
        const pending = [];
        const seenUris = new Set();

        // Method A: StorageAccessFramework for Android content:// URIs
        if (folderUri.startsWith('content://') && StorageAccessFramework?.readDirectoryAsync) {
            try {
                const visitedDirs = new Set();
                const maxDirs = 100;

                const scanSafDirectory = async (dirUri, depth = 0, currentAlbumName = null) => {
                    if (depth > 8 || visitedDirs.size >= maxDirs || visitedDirs.has(dirUri)) return;
                    visitedDirs.add(dirUri);

                    let fileUris = [];
                    try {
                        fileUris = await StorageAccessFramework.readDirectoryAsync(dirUri);
                    } catch (e) {
                        return;
                    }

                    console.log(`[SyncService] SAF readDirectoryAsync depth ${depth} (${currentAlbumName || 'root'}) found ${fileUris.length} items`);

                    for (let i = 0; i < fileUris.length; i++) {
                        const uri = fileUris[i];
                        if (seenUris.has(uri) || visitedDirs.has(uri)) continue;

                        const decodedUri = safeDecodeURI(uri);
                        const rawEnd = (decodedUri.split('/').pop() || '').split('?')[0];
                        const extCandidate = rawEnd.includes('.') ? rawEnd.split('.').pop().toLowerCase() : '';
                        const isVideoByExt = videoExtensions.includes(extCandidate);
                        const isPhotoByExt = photoExtensions.includes(extCandidate);

                        // Detect by MediaDocumentsProvider URI pattern (e.g. document/image:123 or document/video:456)
                        const isDocVideo = decodedUri.includes('/video:') || decodedUri.includes('video%3A') || isVideoByExt;
                        const isDocPhoto = decodedUri.includes('/image:') || decodedUri.includes('image%3A') || isPhotoByExt;

                        if (isDocVideo || isDocPhoto) {
                            seenUris.add(uri);
                            if (!syncedSet.has(uri)) {
                                let filename = rawEnd;
                                if (!filename.includes('.')) {
                                    filename = isDocVideo
                                        ? `${rawEnd || `video_${Date.now()}_${i}`}.mp4`
                                        : `${rawEnd || `photo_${Date.now()}_${i}`}.jpg`;
                                }
                                pending.push({
                                    id: uri,
                                    uri: uri,
                                    filename: filename,
                                    albumName: currentAlbumName,
                                    mediaType: isDocVideo ? 'video' : 'photo',
                                    isSafFile: true,
                                });
                            }
                        } else if (depth < 8 && rawEnd && !rawEnd.startsWith('.')) {
                            // Test whether this non-media URI is a subfolder (even if folder name contains dots)
                            await scanSafDirectory(uri, depth + 1, rawEnd);
                        }
                    }
                };

                await scanSafDirectory(folderUri, 0, null);
                return pending;
            } catch (safScanErr) {
                console.warn('[SyncService] SAF scan error:', safScanErr);
            }
        }

        // Method B: Directory list from expo-file-system
        if (Directory) {
            try {
                const visitedDirs = new Set();
                const scanFsDirectory = (dirUri, depth = 0, currentAlbumName = null) => {
                    if (depth > 8 || visitedDirs.size >= 100 || visitedDirs.has(dirUri)) return;
                    visitedDirs.add(dirUri);
                    try {
                        const dir = new Directory(dirUri);
                        const items = dir.list();
                        console.log(`[SyncService] Directory.list depth ${depth} found ${items.length} items`);

                        for (let i = 0; i < items.length; i++) {
                            const item = items[i];
                            const isDir = item instanceof Directory || item.isDirectory;
                            if (isDir && depth < 8) {
                                const subName = item.name || safeDecodeURI(item.uri).split('/').pop() || null;
                                scanFsDirectory(item.uri, depth + 1, subName);
                            } else if (!isDir) {
                                const filename = item.name || item.uri.split('/').pop() || `file_${i}.jpg`;
                                const ext = filename.split('.').pop().toLowerCase();
                                if (validExtensions.includes(`.${ext}`)) {
                                    const isVideo = videoExtensions.includes(ext);
                                    if (!syncedSet.has(item.uri)) {
                                        pending.push({
                                            id: item.uri,
                                            uri: item.uri,
                                            filename: filename,
                                            albumName: currentAlbumName,
                                            mediaType: isVideo ? 'video' : 'photo',
                                            isSafFile: true,
                                        });
                                    }
                                }
                            }
                        }
                    } catch (dErr) {
                        console.warn('[SyncService] Scan fs error at depth', depth, dErr);
                    }
                };

                scanFsDirectory(folderUri, 0, null);
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
     * Local-First Encrypted Vault + 2-Way Google Drive Backup:
     * Phase 1: Encrypt & move files from public folder into Lumina's private sandbox (100% offline, zero trace in public folder).
     * Phase 2: Backup pending encrypted local vault files to Google Drive (NEVER deletes local copy).
     * Phase 3: Pull any missing files from Google Drive down to Android local vault (2-way sync).
     */
    async syncAssets(assets, options = {}) {
        if (isGlobalSyncRunning) {
            console.warn('[SyncService] syncAssets blocked: global sync already running!');
            return {
                alreadyRunning: true,
                successCount: 0,
                failCount: 0,
                deletedCount: 0,
                backedUpCount: 0,
                pulledCount: 0,
            };
        }

        const { onProgress, cloudAlbumId = null } = options;
        const autoDelete = await StorageService.getAutoDeleteLocal();

        isGlobalSyncRunning = true;
        isSyncAborted = false;

        let successCount = 0;
        let failCount = 0;
        let deletedCount = 0;
        let backedUpCount = 0;
        let pulledCount = 0;
        const total = Array.isArray(assets) ? assets.length : 0;
        let lastError = null;

        notifySync({
            isSyncing: true,
            isCancelled: false,
            isPaused: false,
            current: 0,
            total,
            percentage: 0,
            currentFilename: total > 0 ? `Mengenkripsi lokal: ${assets[0].filename || 'Menyiapkan...'}` : 'Menyinkronkan Brankas...',
            successCount: 0,
            failCount: 0,
        });

        try {
            await NativeSyncService.startForegroundSync(
                'Lumina: Enkripsi & Backup Brankas',
                total > 0 ? `Mengamankan ${total} berkas ke brankas lokal...` : 'Menyinkronkan brankas dengan Google Drive...',
                Math.max(total, 1)
            );
        } catch (notifErr) { }

        try {
            // =========================================================================
            // PHASE 1: LOCAL-FIRST ENCRYPT INTO PRIVATE SANDBOX (100% OFFLINE CAPABLE)
            // =========================================================================
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
                    const isVideo = asset.mediaType === 'video' || ['mp4', 'mov', 'm4v', '3gp', 'mkv', 'webm', 'avi'].includes(ext);
                    const mimeType = isVideo
                        ? `video/${ext === 'mov' ? 'quicktime' : 'mp4'}`
                        : `image/${ext === 'png' ? 'png' : (ext === 'webp' ? 'webp' : 'jpeg')}`;

                    notifySync({
                        isSyncing: true,
                        current: i + 1,
                        total,
                        percentage: Math.round((i / Math.max(total, 1)) * 50),
                        currentFilename: `Mengenkripsi lokal: ${asset.filename || `Berkas ${i + 1}`}`,
                        successCount,
                        failCount,
                    });

                    // Stage SAF content:// URI into local app cache for fast native encryption & thumbnail extraction
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

                    // Extract native video thumbnail locally for instant offline grid display
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

                    // Encrypt & store inside Lumina's private sandbox (vault_storage/ + .nomedia)
                    const localMediaId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
                    const savedVaultUri = await LocalVaultService.saveSyncedAsset(
                        localMediaId,
                        workingUri,
                        asset.filename || `vault_${Date.now()}.${ext}`,
                        mimeType,
                        {
                            pendingBackup: true,
                            albumName: asset.albumName || null,
                            localThumbUri: extractedThumbUri,
                        }
                    );

                    if (!savedVaultUri) {
                        throw new Error('Gagal mengenkripsi berkas ke brankas lokal');
                    }

                    successCount++;

                    // Mark source URI as ingested immediately so it is never duplicated
                    await StorageService.addSyncedAssetIds([asset.id]);

                    // Clean up raw file from public folder so zero trace remains in Gallery/File Manager
                    // (The encrypted file is safely preserved inside Lumina's private local vault!)
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

                    const phase1Percent = Math.round(((i + 1) / Math.max(total, 1)) * 50);
                    notifySync({
                        current: i + 1,
                        total,
                        percentage: phase1Percent,
                        successCount,
                        failCount,
                    });

                    if (onProgress) {
                        onProgress({
                            current: i + 1,
                            total,
                            percentage: phase1Percent,
                            asset,
                            success: true,
                        });
                    }
                } catch (err) {
                    lastError = err?.message || String(err);
                    console.warn(`[SyncService] Local encrypt failed for ${asset.filename}:`, err);
                    failCount++;
                    notifySync({ failCount });
                    if (onProgress) {
                        onProgress({
                            current: i + 1,
                            total,
                            percentage: Math.round(((i + 1) / Math.max(total, 1)) * 50),
                            asset,
                            success: false,
                            error: err.message,
                        });
                    }
                } finally {
                    if (extractedThumbUri) {
                        try {
                            await FileSystemLegacy.deleteAsync(extractedThumbUri, { idempotent: true });
                        } catch (e) { }
                    }
                    if (tempLocalStagingUri) {
                        try {
                            await FileSystemLegacy.deleteAsync(tempLocalStagingUri, { idempotent: true });
                        } catch (e) { }
                    }
                }
            }

            // =========================================================================
            // PHASE 2: BACKUP LOCAL VAULT -> GOOGLE DRIVE (NON-DESTRUCTIVE, LOCAL KEPT)
            // =========================================================================
            if (!isSyncAborted) {
                const backupResult = await this.backupPendingLocalVault({ cloudAlbumId, onProgress });
                backedUpCount = backupResult.backedUpCount;
            }

            // =========================================================================
            // PHASE 3: 2-WAY SYNC (GOOGLE DRIVE -> ANDROID LOCAL VAULT)
            // =========================================================================
            if (!isSyncAborted) {
                const pullResult = await this.pullMissingFromDrive();
                pulledCount = pullResult.pulledCount;
            }
        } finally {
            isGlobalSyncRunning = false;

            const summaryText = isSyncAborted
                ? 'Sinkronisasi Dibatalkan'
                : (successCount > 0 || backedUpCount > 0 || pulledCount > 0)
                    ? `Selesai (Lokal: ${successCount}, Backup: ${backedUpCount}, Dari Drive: ${pulledCount})`
                    : 'Brankas & Google Drive sudah sinkron';

            notifySync({
                isSyncing: false,
                currentFilename: summaryText,
                percentage: 100,
                successCount,
                failCount,
            });

            try {
                await NativeSyncService.stopForegroundSync({
                    successCount: successCount + backedUpCount + pulledCount,
                    failCount,
                    total: Math.max(total, backedUpCount + pulledCount),
                });
            } catch (notifErr) { }
        }

        return {
            successCount,
            failCount,
            deletedCount,
            backedUpCount,
            pulledCount,
            autoDeleteRequested: autoDelete,
            lastError,
            isCancelled: isSyncAborted,
        };
    },

    /**
     * Phase 2: Backup all locally encrypted files with pendingBackup=true to Google Drive.
     * NEVER deletes local vault files — Google Drive is strictly a backup!
     */
    async backupPendingLocalVault(options = {}) {
        const { cloudAlbumId = null, onProgress } = options;
        const pendingEntries = await LocalVaultService.getPendingBackupEntries();
        if (!pendingEntries || pendingEntries.length === 0) {
            return { backedUpCount: 0, failCount: 0 };
        }

        let directGdriveToken = null;
        try {
            directGdriveToken = await GoogleDriveDirectService.getValidAccessToken();
        } catch (gErr) { }

        let backedUpCount = 0;
        let failCount = 0;
        let consecutiveErrors = 0;
        const total = pendingEntries.length;

        console.log(`[SyncService] Phase 2: Backing up ${total} encrypted local vault item(s) to cloud...`);

        for (let i = 0; i < total; i++) {
            if (isSyncAborted) break;

            const entry = pendingEntries[i];
            const isVideo = Boolean(
                (entry.mimeType && entry.mimeType.includes('video')) ||
                (entry.filename && entry.filename.match(/\.(mp4|mov|m4v|3gp|webm|mkv|avi)$/i))
            );

            notifySync({
                isSyncing: true,
                current: i + 1,
                total,
                percentage: 50 + Math.round((i / total) * 35),
                currentFilename: `Backup ke Drive: ${entry.filename}`,
            });

            try {
                await NativeSyncService.updateProgress(
                    i + 1,
                    total,
                    `Backup ke Google Drive (${i + 1}/${total}): ${entry.filename}`
                );
            } catch (e) { }

            try {
                if (directGdriveToken) {
                    const directRes = await GoogleDriveDirectService.directUploadMediaItem(
                        {
                            uri: entry.localUri,
                            alreadyEncryptedUri: entry.isEncrypted ? entry.localUri : null,
                            fileName: entry.filename,
                            mimeType: entry.mimeType,
                            type: isVideo ? 'video' : 'image',
                            fileSize: entry.size || 0,
                            thumbnailUri: entry.localThumbUri || null,
                        },
                        {
                            albumName: entry.albumName || null,
                            skipLocalSave: true, // Already stored & encrypted in LocalVaultService!
                            onProgress: (percent) => {
                                const mapped = 50 + Math.round(((i + (percent / 100)) / total) * 35);
                                notifySync({ percentage: Math.min(85, mapped) });
                            },
                        }
                    );

                    await LocalVaultService.markBackedUp(
                        entry.mediaId,
                        directRes.driveFileId,
                        directRes.thumbDriveId || null
                    );
                    backedUpCount++;
                    consecutiveErrors = 0;
                } else if (!entry.isEncrypted) {
                    // Fallback to Laravel server API if Google Drive direct token is not connected
                    const useChunk = ChunkUploadService.shouldUseChunkUpload(entry.size || 0, isVideo);
                    let uploadRes;
                    if (useChunk) {
                        uploadRes = await ChunkUploadService.uploadLargeFile(
                            {
                                id: entry.mediaId,
                                uri: entry.localUri,
                                filename: entry.filename,
                                fileSize: entry.size || 0,
                                thumbnailUri: entry.localThumbUri || null,
                            },
                            {
                                albumId: cloudAlbumId,
                                title: entry.filename,
                                isAbortedCheck: () => isSyncAborted,
                            }
                        );
                    } else {
                        uploadRes = await ApiService.uploadMedia(
                            {
                                uri: entry.localUri,
                                fileName: entry.filename,
                                mimeType: entry.mimeType,
                                type: isVideo ? 'video' : 'image',
                                thumbnailUri: entry.localThumbUri || null,
                            },
                            cloudAlbumId,
                            entry.filename
                        );
                    }
                    const remoteId = uploadRes?.uploaded?.[0]?.id || uploadRes?.media?.id || uploadRes?.driveFileId;
                    if (remoteId) {
                        await LocalVaultService.markBackedUp(entry.mediaId, String(remoteId));
                        backedUpCount++;
                        consecutiveErrors = 0;
                    }
                } else {
                    // Encrypted locally, waiting for Google Drive connection
                    console.log(`[SyncService] Item ${entry.filename} safely encrypted locally; waiting for Google Drive connection to backup.`);
                    break;
                }
            } catch (backupErr) {
                console.warn(`[SyncService] Backup warning for ${entry.filename} (will retry next sync):`, backupErr?.message || backupErr);
                failCount++;
                consecutiveErrors++;
                if (consecutiveErrors >= 3) {
                    console.warn('[SyncService] Network unavailable during backup phase; local encrypted copies remain safe.');
                    break;
                }
            }
        }

        return { backedUpCount, failCount };
    },

    /**
     * Phase 3: 2-Way Sync (Google Drive -> Android Local Vault).
     * Automatically downloads any files in Google Drive that are not yet present locally on Android,
     * so everything in Google Drive is also available offline on the phone.
     */
    async pullMissingFromDrive() {
        let token = null;
        try {
            token = await GoogleDriveDirectService.getValidAccessToken();
        } catch (e) { }

        if (!token) {
            return { pulledCount: 0 };
        }

        let pulledCount = 0;

        try {
            notifySync({
                isSyncing: true,
                percentage: 88,
                currentFilename: 'Memeriksa file baru di Google Drive...',
            });

            const driveFiles = await GoogleDriveDirectService.listVaultFilesRecursive();
            if (!driveFiles || driveFiles.length === 0) {
                return { pulledCount: 0 };
            }

            const metaFiles = [];
            const encByBase = new Map();
            const thumbByBase = new Map();
            const handledDriveIds = new Set();

            for (const f of driveFiles) {
                const name = f.name || '';
                if (name.endsWith('.meta')) {
                    metaFiles.push(f);
                } else if (name.endsWith('.enc')) {
                    encByBase.set(name.slice(0, -4), f);
                } else if (name.startsWith('thumb_')) {
                    const base = name.replace(/^thumb_/, '').replace(/\.[^.]+$/, '');
                    thumbByBase.set(base, f);
                }
            }

            const toDownload = [];

            // 1. Parse .meta manifests to find missing vault files
            for (const mf of metaFiles) {
                if (isSyncAborted) break;
                const base = mf.name.slice(0, -5);
                try {
                    const rawMeta = await GoogleDriveDirectService.downloadTextDirectly(mf.id);
                    if (!rawMeta) continue;

                    let meta = null;
                    try {
                        meta = JSON.parse(rawMeta);
                    } catch (e) {
                        if (CryptoService.isNativeCryptoAvailable()) {
                            try {
                                meta = await CryptoService.decryptMetadata(rawMeta.trim());
                            } catch (decErr) { }
                        }
                    }

                    if (!meta || typeof meta !== 'object') continue;

                    const mediaDriveId = meta.media_file_id || (encByBase.get(base) && encByBase.get(base).id);
                    if (!mediaDriveId) continue;

                    handledDriveIds.add(String(mediaDriveId));
                    if (meta.thumb_drive_id) handledDriveIds.add(String(meta.thumb_drive_id));

                    const alreadyLocal = await LocalVaultService.hasDriveFile(mediaDriveId);
                    if (!alreadyLocal) {
                        toDownload.push({
                            driveFileId: String(mediaDriveId),
                            thumbDriveId: meta.thumb_drive_id || (thumbByBase.get(base) && thumbByBase.get(base).id) || null,
                            originalFilename: meta.original_filename || `${base}.${meta.type === 'video' ? 'mp4' : 'jpg'}`,
                            mimeType: meta.mime_type || (meta.type === 'video' ? 'video/mp4' : 'image/jpeg'),
                            albumName: meta.album_name || mf.folderName || null,
                            isEncrypted: Boolean(meta.is_encrypted || encByBase.has(base)),
                            manifest: meta,
                        });
                    }
                } catch (mErr) {
                    console.warn('[SyncService] Pull manifest parse warning:', mf.name, mErr?.message);
                }
            }

            // 2. Also detect direct/raw photo & video files placed manually in Drive folders/subfolders
            const mediaExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'mp4', 'mov', 'm4v', '3gp', 'mkv', 'webm'];
            const videoExts = ['mp4', 'mov', 'm4v', '3gp', 'mkv', 'webm'];

            for (const f of driveFiles) {
                const name = f.name || '';
                if (!f.id || handledDriveIds.has(String(f.id))) continue;
                if (name === '.nomedia' || name.endsWith('.meta') || name.startsWith('thumb_')) continue;

                const isEnc = name.endsWith('.enc');
                const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
                const isMedia = isEnc || mediaExts.includes(ext) ||
                                (f.mimeType && (f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/')));
                if (!isMedia) continue;

                const alreadyLocal = await LocalVaultService.hasDriveFile(f.id);
                if (!alreadyLocal) {
                    const isVideo = videoExts.includes(ext) || (f.mimeType && f.mimeType.startsWith('video/'));
                    toDownload.push({
                        driveFileId: String(f.id),
                        thumbDriveId: null,
                        originalFilename: name,
                        mimeType: f.mimeType && f.mimeType !== 'application/octet-stream'
                            ? f.mimeType
                            : (isVideo ? 'video/mp4' : 'image/jpeg'),
                        albumName: f.folderName || null,
                        isEncrypted: isEnc,
                        manifest: {
                            title: name.replace(/\.[^.]+$/, ''),
                            album_name: f.folderName || null,
                            type: isVideo ? 'video' : 'image',
                            created_at: f.createdTime,
                        },
                    });
                }
            }

            if (toDownload.length === 0) {
                return { pulledCount: 0 };
            }

            console.log(`[SyncService] Phase 3: Pulling ${toDownload.length} missing file(s) from Google Drive to Android local vault...`);

            for (let i = 0; i < toDownload.length; i++) {
                if (isSyncAborted) break;
                const item = toDownload[i];
                const tempDownloadUri = `${FileSystemLegacy.cacheDirectory}pull_${item.driveFileId}_${Date.now()}`;
                let tempThumbUri = null;

                try {
                    notifySync({
                        isSyncing: true,
                        percentage: 88 + Math.round(((i + 1) / toDownload.length) * 11),
                        currentFilename: `Mengunduh dari Drive (${i + 1}/${toDownload.length}): ${item.originalFilename}`,
                    });

                    await GoogleDriveDirectService.downloadFileDirectly(item.driveFileId, tempDownloadUri);

                    if (item.thumbDriveId) {
                        try {
                            tempThumbUri = `${FileSystemLegacy.cacheDirectory}pull_thumb_${item.driveFileId}.jpg`;
                            await GoogleDriveDirectService.downloadFileDirectly(item.thumbDriveId, tempThumbUri);
                        } catch (tErr) {
                            tempThumbUri = null;
                        }
                    }

                    await LocalVaultService.saveSyncedAsset(
                        item.driveFileId,
                        tempDownloadUri,
                        item.originalFilename,
                        item.mimeType,
                        {
                            driveFileId: item.driveFileId,
                            alreadyEncrypted: item.isEncrypted,
                            albumName: item.albumName,
                            localThumbUri: tempThumbUri,
                            pendingBackup: false,
                            itemData: item.manifest,
                        }
                    );

                    pulledCount++;
                } catch (dlErr) {
                    console.warn(`[SyncService] Failed pulling ${item.originalFilename} from Drive:`, dlErr?.message || dlErr);
                } finally {
                    try { await FileSystemLegacy.deleteAsync(tempDownloadUri, { idempotent: true }); } catch (e) { }
                    if (tempThumbUri) {
                        try { await FileSystemLegacy.deleteAsync(tempThumbUri, { idempotent: true }); } catch (e) { }
                    }
                }
            }
        } catch (err) {
            console.warn('[SyncService] Phase 3 pullMissingFromDrive warning:', err?.message || err);
        }

        return { pulledCount };
    },

    isAutoSyncActive() {
        return isGlobalSyncRunning;
    },

    /**
     * Checks if auto-sync is enabled, scans the designated Vault folder,
     * encrypts pending files locally, backs up pending local vault items to Drive,
     * and pulls missing Drive files to Android local vault (2-way sync).
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

        isAutoSyncScanning = true;
        try {
            const folderUri = await StorageService.getVaultDirectoryUri();
            const pending = folderUri ? await this.scanVaultFolder() : [];
            const pendingBackups = await LocalVaultService.getPendingBackupEntries();

            if (pending.length > 0 || pendingBackups.length > 0) {
                console.log(`[SyncService] AutoSync detected ${pending.length} new folder file(s) & ${pendingBackups.length} pending backup(s).`);
                onStart && onStart({ total: pending.length + pendingBackups.length, assets: pending });

                const result = await this.syncAssets(pending, {
                    onProgress: (p) => {
                        onProgress && onProgress(p);
                    },
                });

                onComplete && onComplete(result);
                return result;
            }

            // Even with no new local files, quietly pull any new files added to Google Drive (2-way sync)
            const pullRes = await this.pullMissingFromDrive();
            if (pullRes.pulledCount > 0) {
                onComplete && onComplete({
                    successCount: 0,
                    failCount: 0,
                    deletedCount: 0,
                    backedUpCount: 0,
                    pulledCount: pullRes.pulledCount,
                });
                return pullRes;
            }
            return null;
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
                                } catch (e) { }
                            });
                        }
