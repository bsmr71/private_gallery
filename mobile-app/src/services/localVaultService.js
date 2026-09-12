import * as FileSystemLegacy from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SecurityService } from './securityService';
import { MediaUrlHelper } from './mediaUrl';

const VAULT_DIR = `${FileSystemLegacy.documentDirectory}vault_storage/`;
const INDEX_KEY = '@vault_local_files_index';

// In-memory index cache for 0ms synchronous lookups: Map<mediaId, { localUri, filename, size, mimeType, cachedAt }>
let localFilesMap = new Map();
let isInitialized = false;
const activeDownloads = new Set();
const listeners = new Set();

function notifyListeners() {
    listeners.forEach((listener) => {
        try {
            listener(localFilesMap);
        } catch (e) {
            console.warn('[LocalVaultService] Listener error:', e);
        }
    });
}

export const LocalVaultService = {
    /**
     * Initialize local vault directory and load index into memory.
     */
    async init() {
        if (isInitialized) return;

        try {
            // 1. Ensure private sandbox directory exists
            const dirInfo = await FileSystemLegacy.getInfoAsync(VAULT_DIR);
            if (!dirInfo.exists) {
                await FileSystemLegacy.makeDirectoryAsync(VAULT_DIR, { intermediates: true });
            }

            // Ensure .nomedia exists so Android system gallery will never index this private vault
            const nomediaUri = `${VAULT_DIR}.nomedia`;
            const nomediaInfo = await FileSystemLegacy.getInfoAsync(nomediaUri);
            if (!nomediaInfo.exists) {
                await FileSystemLegacy.writeAsStringAsync(nomediaUri, '');
            }

            // 2. Load stored index from AsyncStorage
            const rawIndex = await AsyncStorage.getItem(INDEX_KEY);
            if (rawIndex) {
                const parsed = JSON.parse(rawIndex);
                if (Array.isArray(parsed)) {
                    localFilesMap = new Map(parsed.map((item) => [String(item.mediaId), item]));
                }
            }

            isInitialized = true;
            console.log(`[LocalVaultService] Initialized with ${localFilesMap.size} local vault items`);
        } catch (err) {
            console.warn('[LocalVaultService] Init error:', err);
            isInitialized = true;
        }
    },

    /**
     * Subscribe to changes in local vault index
     */
    subscribe(callback) {
        listeners.add(callback);
        return () => listeners.delete(callback);
    },

    /**
     * Check synchronously if a media item exists in local vault.
     */
    hasLocalMedia(mediaId) {
        if (!mediaId || SecurityService.isDecoyMode()) return false;
        return localFilesMap.has(String(mediaId));
    },

    /**
     * Get playable local file:// URI for an item.
     * Returns string URI if present, or null if only on cloud.
     */
    getLocalUri(mediaId) {
        if (!mediaId || SecurityService.isDecoyMode()) return null;
        const entry = localFilesMap.get(String(mediaId));
        return entry ? entry.localUri : null;
    },

    /**
     * Get local thumbnail file:// URI for an item.
     * Returns string URI if cached locally, or null.
     */
    getLocalThumbUri(mediaId) {
        if (!mediaId || SecurityService.isDecoyMode()) return null;
        const entry = localFilesMap.get(String(mediaId));
        return entry ? (entry.localThumbUri || entry.localUri || null) : null;
    },

    /**
     * Get number of media stored locally in the vault
     */
    getLocalCount() {
        if (SecurityService.isDecoyMode()) return 0;
        return localFilesMap.size;
    },

    /**
     * Persist current in-memory map to AsyncStorage
     */
    async _persistIndex() {
        try {
            const list = Array.from(localFilesMap.values());
            await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(list));
            notifyListeners();
        } catch (err) {
            console.warn('[LocalVaultService] Persist index error:', err);
        }
    },

    /**
     * Save an asset synced from phone into the private sandbox vault.
     * Copies or moves the file to VAULT_DIR.
     */
    async saveSyncedAsset(mediaId, sourceUri, originalFilename, mimeType = null) {
        if (!mediaId || !sourceUri) return null;

        try {
            await this.init();

            const isVideo = mimeType?.includes('video') || originalFilename?.endsWith('.mp4') || originalFilename?.endsWith('.mov');
            const ext = isVideo ? 'mp4' : (originalFilename?.split('.').pop() || 'jpg');
            const safeName = `vault_${mediaId}_${Date.now()}.${ext}`;
            const targetUri = `${VAULT_DIR}${safeName}`;

            // Check if source file exists
            const sourceInfo = await FileSystemLegacy.getInfoAsync(sourceUri);
            if (!sourceInfo.exists) {
                console.warn('[LocalVaultService] Source file does not exist for copying:', sourceUri);
                return null;
            }

            // Copy file to private sandbox
            await FileSystemLegacy.copyAsync({
                from: sourceUri,
                to: targetUri,
            });

            const entry = {
                mediaId: String(mediaId),
                localUri: targetUri,
                filename: originalFilename || safeName,
                size: sourceInfo.size || 0,
                mimeType: mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
                cachedAt: Date.now(),
            };

            localFilesMap.set(String(mediaId), entry);
            await this._persistIndex();

            console.log(`[LocalVaultService] Saved media ${mediaId} to private local vault: ${targetUri}`);
            return targetUri;
        } catch (err) {
            console.error('[LocalVaultService] Error saving synced asset to local vault:', err);
            return null;
        }
    },

    /**
     * Background auto-cache: Download media from cloud when opened so next view is 0s instant.
     */
    async cacheMediaFromCloud(mediaItem) {
        if (!mediaItem || !mediaItem.id || SecurityService.isDecoyMode()) return;
        const idStr = String(mediaItem.id);

        // Already cached or download currently in-flight
        if (localFilesMap.has(idStr) || activeDownloads.has(idStr)) {
            return;
        }

        activeDownloads.add(idStr);

        try {
            await this.init();

            const isVideo = (mediaItem.mime_type && mediaItem.mime_type.includes('video')) || mediaItem.type === 'video';
            const ext = isVideo ? 'mp4' : 'jpg';
            const targetUri = `${VAULT_DIR}cloud_${idStr}_${Date.now()}.${ext}`;

            const rawUrl = mediaItem.stream_url || mediaItem.download_url;
            if (!rawUrl) {
                activeDownloads.delete(idStr);
                return;
            }

            const downloadUrl = MediaUrlHelper.resolve(rawUrl);
            const token = MediaUrlHelper.getToken();

            console.log(`[LocalVaultService] Starting background cache for media ${idStr}...`);

            const downloadRes = await FileSystemLegacy.downloadAsync(downloadUrl, targetUri, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

            if (downloadRes.status === 200) {
                const info = await FileSystemLegacy.getInfoAsync(targetUri);
                const entry = {
                    mediaId: idStr,
                    localUri: targetUri,
                    filename: mediaItem.original_filename || mediaItem.title || `media_${idStr}.${ext}`,
                    size: info.size || 0,
                    mimeType: mediaItem.mime_type || (isVideo ? 'video/mp4' : 'image/jpeg'),
                    cachedAt: Date.now(),
                };

                localFilesMap.set(idStr, entry);
                await this._persistIndex();
                console.log(`[LocalVaultService] Background cache completed for media ${idStr} (${Math.round((info.size || 0) / 1024)} KB)`);
            } else {
                // Remove failed partial file
                try {
                    await FileSystemLegacy.deleteAsync(targetUri, { idempotent: true });
                } catch (e) {}
            }
        } catch (err) {
            console.warn(`[LocalVaultService] Background cache failed for media ${idStr}:`, err);
        } finally {
            activeDownloads.delete(idStr);
        }
    },

    /**
     * Delete a specific media file from local vault
     */
    async deleteLocalMedia(mediaId) {
        if (!mediaId) return;
        const idStr = String(mediaId);
        const entry = localFilesMap.get(idStr);

        if (entry) {
            try {
                await FileSystemLegacy.deleteAsync(entry.localUri, { idempotent: true });
            } catch (e) {}
            localFilesMap.delete(idStr);
            await this._persistIndex();
            console.log(`[LocalVaultService] Deleted media ${idStr} from local vault`);
        }
    },

    /**
     * Calculate total storage used by local vault in MB/GB
     */
    async getVaultStorageUsage() {
        await this.init();
        let totalBytes = 0;
        let count = 0;

        localFilesMap.forEach((entry) => {
            totalBytes += entry.size || 0;
            count++;
        });

        const mb = totalBytes / (1024 * 1024);
        let formatted = '';
        if (mb >= 1024) {
            formatted = `${(mb / 1024).toFixed(2)} GB`;
        } else {
            formatted = `${mb.toFixed(1)} MB`;
        }

        return {
            totalBytes,
            count,
            formatted,
        };
    },

    /**
     * Clear all cached files in local vault without affecting Google Drive
     */
    async clearLocalVault() {
        try {
            await this.init();

            // Delete directory content
            const dirInfo = await FileSystemLegacy.getInfoAsync(VAULT_DIR);
            if (dirInfo.exists) {
                await FileSystemLegacy.deleteAsync(VAULT_DIR, { idempotent: true });
                await FileSystemLegacy.makeDirectoryAsync(VAULT_DIR, { intermediates: true });
            }

            localFilesMap.clear();
            await AsyncStorage.removeItem(INDEX_KEY);
            notifyListeners();
            console.log('[LocalVaultService] Local vault cleared successfully');
            return true;
        } catch (err) {
            console.error('[LocalVaultService] Clear vault error:', err);
            return false;
        }
    },

    _downloadCancelled: false,
    _isDownloadingAll: false,
    _downloadProgress: {
        current: 0,
        total: 0,
        percentage: 0,
        activeFilename: '',
    },

    isDownloadAllRunning() {
        return this._isDownloadingAll;
    },

    getDownloadProgress() {
        return {
            ...this._downloadProgress,
            isRunning: this._isDownloadingAll,
        };
    },

    cancelDownloadAll() {
        this._downloadCancelled = true;
    },

    /**
     * Download entire gallery, specific items, or album to private local vault for 100% offline instant access.
     */
    async downloadAllToLocal({ items = null, albumId = null, onProgress, onComplete, onError } = {}) {
        if (this._isDownloadingAll) {
            console.warn('[LocalVaultService] Download all already in progress');
            return;
        }

        this._isDownloadingAll = true;
        this._downloadCancelled = false;

        try {
            await this.init();

            let targetItems = items;
            if (!targetItems || targetItems.length === 0) {
                const { ApiService } = require('./api');
                let currentPage = 1;
                let allFetched = [];
                let hasMore = true;

                while (hasMore && !this._downloadCancelled) {
                    const params = { all: 1, per_page: 2000, page: currentPage };
                    if (albumId) params.album_id = albumId;
                    const res = await ApiService.getMedia(params);
                    if (res && res.success && Array.isArray(res.data)) {
                        allFetched = allFetched.concat(res.data);
                        if (res.meta && res.meta.current_page < res.meta.last_page && res.data.length > 0) {
                            currentPage++;
                        } else {
                            hasMore = false;
                        }
                    } else {
                        hasMore = false;
                    }
                }
                targetItems = allFetched;
            }

            const total = targetItems.length;
            if (total === 0) {
                this._isDownloadingAll = false;
                this._downloadProgress = { current: 0, total: 0, percentage: 100, activeFilename: '' };
                onComplete && onComplete({ successCount: 0, total: 0, skippedCount: 0, cancelled: false });
                return;
            }

            let completed = 0;
            let skipped = 0;
            let failed = 0;

            const token = MediaUrlHelper.getToken();

            // Filter out items already cached
            const pending = targetItems.filter((it) => {
                const idStr = String(it.id);
                if (localFilesMap.has(idStr)) {
                    skipped++;
                    completed++;
                    return false;
                }
                return true;
            });

            this._downloadProgress = {
                current: completed,
                total,
                percentage: Math.round((completed / total) * 100),
                activeFilename: pending.length > 0 ? 'Menyiapkan berkas...' : 'Semua sudah tersimpan',
            };
            onProgress && onProgress(this._downloadProgress);

            if (pending.length === 0) {
                this._isDownloadingAll = false;
                onComplete && onComplete({ successCount: 0, total, skippedCount: skipped, failedCount: 0, cancelled: false });
                return;
            }

            // Concurrency pool helper (concurrency = 3 workers)
            const CONCURRENCY = 3;
            let index = 0;

            const downloadWorker = async () => {
                while (!this._downloadCancelled) {
                    let it = null;
                    if (index < pending.length) {
                        it = pending[index++];
                    } else {
                        break;
                    }
                    if (!it) break;

                    const idStr = String(it.id);
                    const isVideo = Boolean(
                        (it.mime_type && it.mime_type.includes('video')) ||
                        it.type === 'video' ||
                        (it.original_filename && it.original_filename.match(/\.(mp4|mov|m4v)$/i))
                    );
                    const ext = isVideo ? 'mp4' : 'jpg';
                    const filename = it.original_filename || it.title || `media_${idStr}.${ext}`;

                    this._downloadProgress = {
                        current: completed,
                        total,
                        percentage: Math.round((completed / total) * 100),
                        activeFilename: filename,
                    };
                    onProgress && onProgress(this._downloadProgress);

                    try {
                        const rawFullUrl = it.download_url || it.stream_url;
                        const rawThumbUrl = it.thumbnail_url;

                        const fullDownloadUrl = MediaUrlHelper.resolve(rawFullUrl);
                        const thumbDownloadUrl = rawThumbUrl ? MediaUrlHelper.resolve(rawThumbUrl) : null;

                        const targetFullUri = `${VAULT_DIR}full_${idStr}.${ext}`;
                        const targetThumbUri = `${VAULT_DIR}thumb_${idStr}.jpg`;

                        // 1. Download thumbnail first for instant 60fps grid rendering
                        if (thumbDownloadUrl) {
                            try {
                                await FileSystemLegacy.downloadAsync(thumbDownloadUrl, targetThumbUri, {
                                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                                });
                            } catch (thErr) {}
                        }

                        // 2. Download full original file
                        if (fullDownloadUrl) {
                            const res = await FileSystemLegacy.downloadAsync(fullDownloadUrl, targetFullUri, {
                                headers: token ? { Authorization: `Bearer ${token}` } : {},
                            });

                            if (res.status === 200) {
                                const info = await FileSystemLegacy.getInfoAsync(targetFullUri);
                                const thumbInfo = await FileSystemLegacy.getInfoAsync(targetThumbUri);

                                const entry = {
                                    mediaId: idStr,
                                    localUri: targetFullUri,
                                    localThumbUri: thumbInfo.exists ? targetThumbUri : targetFullUri,
                                    filename,
                                    size: info.size || 0,
                                    mimeType: it.mime_type || (isVideo ? 'video/mp4' : 'image/jpeg'),
                                    cachedAt: Date.now(),
                                };

                                localFilesMap.set(idStr, entry);

                                // Periodic save every 5 items so progress is never lost
                                if (localFilesMap.size % 5 === 0) {
                                    this._persistIndex();
                                }
                            } else {
                                failed++;
                            }
                        }
                    } catch (itemErr) {
                        console.warn(`[LocalVaultService] Failed downloading ${idStr}:`, itemErr);
                        failed++;
                    } finally {
                        completed++;
                        this._downloadProgress = {
                            current: completed,
                            total,
                            percentage: Math.round((completed / total) * 100),
                            activeFilename: filename,
                        };
                        onProgress && onProgress(this._downloadProgress);
                    }
                }
            };

            const workers = Array.from({ length: Math.min(CONCURRENCY, pending.length) }, () => downloadWorker());
            await Promise.all(workers);

            await this._persistIndex();

            this._isDownloadingAll = false;
            const cancelled = this._downloadCancelled;

            onComplete && onComplete({
                successCount: completed - skipped - failed,
                total,
                skippedCount: skipped,
                failedCount: failed,
                cancelled,
            });
        } catch (err) {
            this._isDownloadingAll = false;
            console.error('[LocalVaultService] Download all error:', err);
            onError && onError(err);
        }
    },
};
