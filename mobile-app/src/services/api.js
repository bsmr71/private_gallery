import { StorageService } from './storage';

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

        const formData = new FormData();
        const filename = fileAsset.fileName || fileAsset.uri.split('/').pop() || 'upload.jpg';
        const type = fileAsset.mimeType || (filename.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');

        formData.append('file', {
            uri: fileAsset.uri,
            name: filename,
            type: type,
        });

        if (albumId) formData.append('album_id', albumId);
        if (title) formData.append('title', title);

        const url = `${baseUrl.replace(/\/$/, '')}/media/upload`;

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
            throw new Error(data?.message || 'Gagal mengunggah media');
        }

        return data;
    },
};
