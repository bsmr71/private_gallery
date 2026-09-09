import { StorageService } from './storage';
import * as FileSystemLegacy from 'expo-file-system/legacy';

export const ApiService = {
    async request(endpoint, options = {}) {
        const baseUrl = await StorageService.getApiUrl();
        const token = await StorageService.getToken();

        const headers = {
            'Accept': 'application/json',
            ...(options.headers || {}),
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        if (options.body && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        const url = `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

        try {
            const res = await fetch(url, {
                ...options,
                headers,
            });

            const data = await res.json().catch(() => null);

            if (!res.ok) {
                const message = data?.message || `HTTP Error ${res.status}`;
                const err = new Error(message);
                err.status = res.status;
                err.data = data;
                throw err;
            }

            return data;
        } catch (err) {
            throw err;
        }
    },

    // Auth
    async login(email, password, twoFactorCode = null) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email,
                password,
                two_factor_code: twoFactorCode,
                device_name: 'Android Mobile App (Apple Photos)',
            }),
        });
    },

    async getUser() {
        return this.request('/auth/user');
    },

    async logout() {
        return this.request('/auth/logout', { method: 'POST' });
    },

    // Media
    async getMedia(params = {}) {
        const qs = new URLSearchParams();
        if (params.page) qs.append('page', params.page);
        if (params.type) qs.append('type', params.type);
        if (params.favorite) qs.append('favorite', '1');
        if (params.album_id) qs.append('album_id', params.album_id);
        if (params.search) qs.append('search', params.search);
        if (params.per_page) qs.append('per_page', params.per_page);

        const query = qs.toString() ? `?${qs.toString()}` : '';
        return this.request(`/media${query}`);
    },

    async toggleFavorite(mediaId) {
        return this.request(`/media/${mediaId}/favorite`, { method: 'POST' });
    },

    async renameMedia(mediaId, title) {
        return this.request(`/media/${mediaId}/rename`, {
            method: 'POST',
            body: JSON.stringify({ title }),
        });
    },

    async moveMedia(mediaIds, albumId = null, newAlbumName = null) {
        return this.request('/media/move', {
            method: 'POST',
            body: JSON.stringify({
                media_ids: mediaIds,
                album_id: albumId,
                new_album_name: newAlbumName,
            }),
        });
    },

    async copyMedia(mediaIds, albumId = null, newAlbumName = null) {
        return this.request('/media/copy', {
            method: 'POST',
            body: JSON.stringify({
                media_ids: mediaIds,
                album_id: albumId,
                new_album_name: newAlbumName,
            }),
        });
    },

    async deleteMedia(mediaId) {
        return this.request(`/media/${mediaId}`, { method: 'DELETE' });
    },

    async batchDelete(mediaIds) {
        return this.request('/media/batch-delete', {
            method: 'POST',
            body: JSON.stringify({ ids: mediaIds }),
        });
    },

    // Albums
    async getAlbums() {
        return this.request('/albums');
    },

    async createAlbum(name, description = null) {
        return this.request('/albums', {
            method: 'POST',
            body: JSON.stringify({ name, description }),
        });
    },

    async deleteAlbum(albumId) {
        return this.request(`/albums/${albumId}`, { method: 'DELETE' });
    },

    // Upload
    async uploadMedia(fileAsset, albumId = null, title = null) {
        const baseUrl = await StorageService.getApiUrl();
        const token = await StorageService.getToken();

        let tempCacheUri = null;
        let fileUri = fileAsset.uri;

        try {
            const rawFilename = fileAsset.fileName || fileAsset.filename || fileAsset.uri.split('/').pop() || 'upload.jpg';
            const filename = decodeURIComponent(rawFilename).split('/').pop() || 'upload.jpg';
            const ext = filename.split('.').pop().toLowerCase();
            const type = fileAsset.mimeType || (ext === 'mp4' || ext === 'mov' ? 'video/mp4' : 'image/jpeg');

            // If it's an Android content:// URI (SAF tree or content URI), copy to cache first
            // to obtain a genuine file:// path that React Native FormData supports without
            // "Unsupported FormDataPart implementation" error
            if (fileUri && fileUri.startsWith('content://')) {
                const safeName = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
                tempCacheUri = `${FileSystemLegacy.cacheDirectory}upload_${Date.now()}_${safeName}`;
                await FileSystemLegacy.copyAsync({
                    from: fileUri,
                    to: tempCacheUri,
                });
                fileUri = tempCacheUri;
            }

            const url = `${baseUrl.replace(/\/$/, '')}/media/upload`;

            // Strategy 1 (Primary): Native FileSystemLegacy.uploadAsync (Fast, reliable, zero warnings)
            if (FileSystemLegacy?.uploadAsync) {
                const uploadRes = await FileSystemLegacy.uploadAsync(url, fileUri, {
                    httpMethod: 'POST',
                    uploadType: FileSystemLegacy.FileSystemUploadType?.MULTIPART || 0,
                    fieldName: 'file',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    parameters: {
                        ...(albumId ? { album_id: String(albumId) } : {}),
                        ...(title ? { title: String(title) } : {}),
                    },
                });

                let parsed = null;
                try {
                    parsed = JSON.parse(uploadRes.body);
                } catch (e) {
                    parsed = null;
                }

                if (uploadRes.status >= 200 && uploadRes.status < 300) {
                    return parsed;
                }
                throw new Error(parsed?.message || `Upload gagal dengan status ${uploadRes.status}`);
            }

            // Strategy 2 (Fallback): Standard fetch with FormData
            const formData = new FormData();
            formData.append('file', {
                uri: fileUri,
                name: filename,
                type: type,
            });

            if (albumId) formData.append('album_id', String(albumId));
            if (title) formData.append('title', String(title));

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });

            const data = await res.json().catch(() => null);

            if (!res.ok) {
                throw new Error(data?.message || `HTTP Error ${res.status}`);
            }

            return data;
        } finally {
            if (tempCacheUri) {
                try {
                    await FileSystemLegacy.deleteAsync(tempCacheUri, { idempotent: true });
                } catch (e) {
                    // ignore cleanup error
                }
            }
        }
    },
};
