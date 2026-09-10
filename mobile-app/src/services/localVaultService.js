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
};
