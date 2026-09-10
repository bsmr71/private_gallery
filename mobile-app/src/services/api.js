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

    async ackPinReset() {
        return this.request('/auth/ack-pin-reset', { method: 'POST' });
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
    async uploadMedia(fileAsset, albumId = null, title = null, onProgress = null) {
        const baseUrl = await StorageService.getApiUrl();
        const token = await StorageService.getToken();

        let tempCacheUri = null;
        let fileUri = fileAsset.uri;

        try {
            // Determine whether asset is video or image
            const isVideo = Boolean(
                fileAsset.type === 'video' ||
                (fileAsset.mimeType && fileAsset.mimeType.startsWith('video/')) ||
                (fileAsset.mediaType === 'video') ||
                (fileAsset.uri && (fileAsset.uri.endsWith('.mp4') || fileAsset.uri.endsWith('.mov') || fileAsset.uri.endsWith('.m4v')))
            );

            const rawFilename = fileAsset.fileName || fileAsset.filename || fileAsset.uri.split('/').pop() || (isVideo ? 'video.mp4' : 'upload.jpg');
            let filename = isVideo ? 'video.mp4' : 'upload.jpg';
            try {
                filename = decodeURIComponent(rawFilename).split('/').pop() || filename;
            } catch (uriErr) {
                try {
                    filename = decodeURI(rawFilename).split('/').pop() || filename;
                } catch (e) {
                    filename = rawFilename.split('/').pop() || filename;
                }
            }

            // Ensure proper extension if missing
            let ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
            if (isVideo && (!ext || !['mp4', 'mov', 'm4v', '3gp', 'webm'].includes(ext))) {
                ext = 'mp4';
                filename = `${filename.replace(/\.[^/.]+$/, '')}.mp4`;
            } else if (!isVideo && (!ext || !['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext))) {
                ext = 'jpg';
                filename = `${filename.replace(/\.[^/.]+$/, '')}.jpg`;
            }

            const type = fileAsset.mimeType || (isVideo ? (ext === 'mov' ? 'video/quicktime' : 'video/mp4') : (ext === 'png' ? 'image/png' : 'image/jpeg'));

            // Normalize fileUri for React Native NetworkingModule:
            // React Native's native OkHttp engine streams directly from content:// URIs
            // via ContentResolver.openInputStream(), with zero disk overhead.
            let normalizedUri = fileUri;
            if (normalizedUri && !normalizedUri.startsWith('file://') && !normalizedUri.startsWith('content://')) {
                normalizedUri = `file://${normalizedUri}`;
            }

            const url = `${baseUrl.replace(/\/$/, '')}/media/upload`;

            // Use XMLHttpRequest with FormData:
            // 1. Supports 10-minute timeout (so large videos don't fail at 60s)
            // 2. Supports real-time upload progress tracking
            // 3. Streams large files directly on native Android
            return await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', url);
                xhr.timeout = 600000; // 10 minutes timeout

                xhr.setRequestHeader('Accept', 'application/json');
                if (token) {
                    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                }

                if (xhr.upload && onProgress) {
                    xhr.upload.onprogress = (event) => {
                        if (event.lengthComputable && event.total > 0) {
                            const percent = Math.round((event.loaded / event.total) * 100);
                            onProgress(percent);
                        }
                    };
                }

                xhr.onload = () => {
                    let parsed = null;
                    try {
                        parsed = JSON.parse(xhr.responseText);
                    } catch (e) {
                        parsed = null;
                    }

                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(parsed);
                    } else if (parsed?.errors && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
                        const firstErr = parsed.errors[0]?.error || parsed.errors[0]?.message || parsed.message;
                        reject(new Error(firstErr || `Gagal mengunggah (HTTP ${xhr.status})`));
                    } else if (xhr.status === 413) {
                        reject(new Error(parsed?.message || 'Ukuran berkas melebihi batas upload server.'));
                    } else if (xhr.status === 422) {
                        reject(new Error(parsed?.message || 'Validasi unggahan gagal pada server.'));
                    } else if (xhr.status === 401) {
                        reject(new Error('Sesi autentikasi telah berakhir. Silakan login ulang.'));
                    } else {
                        reject(new Error(parsed?.message || `Gagal mengunggah (HTTP ${xhr.status})`));
                    }
                };

                xhr.onerror = () => {
                    reject(new Error('Koneksi terputus saat mengunggah. Periksa jaringan Anda.'));
                };

                xhr.ontimeout = () => {
                    reject(new Error('Waktu unggah habis (timeout).'));
                };

                const formData = new FormData();
                formData.append('file', {
                    uri: normalizedUri,
                    name: filename,
                    type: type,
                });

                if (albumId) formData.append('album_id', String(albumId));
                if (title) formData.append('title', String(title));

                const thumbUri = fileAsset.thumbnailUri || fileAsset.thumbUri;
                if (thumbUri) {
                    formData.append('thumbnail', {
                        uri: thumbUri,
                        name: 'thumb.jpg',
                        type: 'image/jpeg',
                    });
                }
                if (fileAsset.thumbnailBase64) {
                    formData.append('thumbnail_base64', fileAsset.thumbnailBase64);
                }

                xhr.send(formData);
            });
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

    // Duplicates Management
    async getDuplicates() {
        return this.request('/media-duplicates');
    },

    async mergeDuplicates(keepId, duplicateIds) {
        return this.request('/media-duplicates/merge', {
            method: 'POST',
            body: JSON.stringify({
                keep_id: keepId,
                duplicate_ids: duplicateIds,
            }),
        });
    },

    async mergeAllDuplicates() {
        return this.request('/media-duplicates/merge', {
            method: 'POST',
            body: JSON.stringify({
                all: true,
            }),
        });
    },

    async deleteDuplicate(mediaId) {
        return this.request('/media-duplicates/delete', {
            method: 'POST',
            body: JSON.stringify({
                media_id: mediaId,
            }),
        });
    },

    // Secure Vault (Brankas Terkunci)
    async getVaultStatus() {
        return this.request('/secure-vault/status');
    },

    async requestVaultEmailOtp() {
        return this.request('/secure-vault/request-email-otp', {
            method: 'POST',
        });
    },

    async unlockVault(password, otpCode, otpType = 'email') {
        return this.request('/secure-vault/unlock', {
            method: 'POST',
            body: JSON.stringify({
                password,
                otp_code: otpCode,
                otp_type: otpType,
            }),
        });
    },

    async getVaultMedia(vaultToken, page = 1) {
        return this.request(`/secure-vault/media?page=${page}`, {
            headers: {
                'X-Vault-Token': vaultToken,
            },
        });
    },

    async lockMediaToVault(mediaIds) {
        return this.request('/secure-vault/lock-media', {
            method: 'POST',
            body: JSON.stringify({
                media_ids: mediaIds,
            }),
        });
    },

    async unlockMediaFromVault(vaultToken, mediaIds) {
        return this.request('/secure-vault/unlock-media', {
            method: 'POST',
            headers: {
                'X-Vault-Token': vaultToken,
            },
            body: JSON.stringify({
                media_ids: mediaIds,
            }),
        });
    },
};
