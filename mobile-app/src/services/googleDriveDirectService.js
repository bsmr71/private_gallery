import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystemLegacy from 'expo-file-system/legacy';

const GDRIVE_KEYS = {
    ACCESS_TOKEN: '@lumina_gdrive_access_token',
    REFRESH_TOKEN: '@lumina_gdrive_refresh_token',
    USER_EMAIL: '@lumina_gdrive_user_email',
    FOLDER_ID: '@lumina_gdrive_folder_id',
    FOLDER_NAME: '@lumina_gdrive_folder_name',
};

const DEFAULT_FOLDER_NAME = 'MediaGalleryEncrypted';

export const GoogleDriveDirectService = {
    /**
     * Get stored connection state
     */
    async getConnectionInfo() {
        try {
            const token = await AsyncStorage.getItem(GDRIVE_KEYS.ACCESS_TOKEN);
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
        const token = await AsyncStorage.getItem(GDRIVE_KEYS.ACCESS_TOKEN);
        if (!token) throw new Error('Google Drive belum terhubung');

        const folderId = await this.ensureVaultFolder(token);
        const fileInfo = await FileSystemLegacy.getInfoAsync(localEncryptedUri);
        if (!fileInfo.exists) throw new Error('File terenkripsi lokal tidak ditemukan: ' + localEncryptedUri);

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
            const errText = await initRes.text();
            throw new Error(`Gagal inisialisasi resumable upload ke Google (${initRes.status}): ${errText}`);
        }

        const uploadUrl = initRes.headers.get('location') || initRes.headers.get('Location');
        if (!uploadUrl) {
            throw new Error('Google Drive tidak mengembalikan URL upload resumable');
        }

        // Step 2: Upload file stream directly to Google's resumable URL
        // We use FileSystem.uploadAsync for optimal native background streaming
        const uploadTask = await FileSystemLegacy.uploadAsync(uploadUrl, localEncryptedUri, {
            httpMethod: 'PUT',
            uploadType: FileSystemLegacy.FileSystemUploadType.BINARY_CONTENT,
            headers: {
                'Content-Length': String(fileSize),
                'Content-Type': 'application/octet-stream',
            },
        });

        if (uploadTask.status !== 200 && uploadTask.status !== 201) {
            throw new Error(`Upload ke Google Drive gagal dengan status ${uploadTask.status}: ${uploadTask.body}`);
        }

        const parsed = JSON.parse(uploadTask.body);
        return parsed.id;
    },
};
