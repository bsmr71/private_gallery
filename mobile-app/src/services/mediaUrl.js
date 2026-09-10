import { StorageService } from './storage';
import { DEFAULT_CONFIG } from '../constants/config';

let cachedToken = null;
let cachedApiUrl = DEFAULT_CONFIG.apiBaseUrl;

// Keep token and apiUrl in memory for synchronous URL resolution
StorageService.getToken().then((t) => { cachedToken = t; });
StorageService.getApiUrl().then((u) => { if (u) cachedApiUrl = u; });

export const MediaUrlHelper = {
    async init() {
        cachedToken = await StorageService.getToken();
        cachedApiUrl = await StorageService.getApiUrl();
        return { token: cachedToken, apiUrl: cachedApiUrl };
    },

    setToken(token) {
        cachedToken = token;
    },

    setApiUrl(url) {
        cachedApiUrl = url;
    },

    getToken() {
        return cachedToken;
    },

    getApiUrl() {
        return cachedApiUrl;
    },

    resolve(url, explicitToken = null, explicitApiUrl = null) {
        if (!url) return null;
        let resolved = String(url);

        // Do not alter local filesystem URIs or data URIs
        if (resolved.startsWith('file://') || resolved.startsWith('content://') || resolved.startsWith('data:')) {
            return resolved;
        }

        const token = explicitToken || cachedToken;
        const apiUrl = explicitApiUrl || cachedApiUrl;

        if (apiUrl) {
            const serverOrigin = apiUrl.replace(/\/api\/?$/, '');

            // Convert relative path (e.g. /api/media/123/thumbnail or /media/123/thumbnail) to absolute URL
            if (resolved.startsWith('/')) {
                resolved = `${serverOrigin}${resolved}`;
            }

            // Ensure HTTPS if serverOrigin is HTTPS (prevents Android ERR_CLEARTEXT_NOT_PERMITTED)
            if (serverOrigin.startsWith('https://') && resolved.startsWith('http://')) {
                resolved = resolved.replace(/^http:\/\//, 'https://');
            }

            // Rewrite web routes /media/ to API routes /api/media/
            if (resolved.includes('/media/') && !resolved.includes('/api/media/')) {
                resolved = resolved.replace(/\/media\//, '/api/media/');
            }

            // If backend returned gallery.test or localhost, rewrite to active server
            if (
                resolved.includes('gallery.test') ||
                (resolved.includes('127.0.0.1') && !serverOrigin.includes('127.0.0.1')) ||
                (resolved.includes('localhost') && !serverOrigin.includes('localhost'))
            ) {
                try {
                    const parsed = new URL(resolved);
                    resolved = `${serverOrigin}${parsed.pathname}${parsed.search}`;
                } catch (e) {
                    resolved = resolved.replace(/^https?:\/\/[^\/]+/, serverOrigin);
                }
            }
        }

        // Ensure token is attached for secure direct image/video streaming
        if (token && !resolved.includes('token=')) {
            const separator = resolved.includes('?') ? '&' : '?';
            resolved = `${resolved}${separator}token=${encodeURIComponent(token)}`;
        }

        return resolved;
    },

    getImageSource(url) {
        const resolved = this.resolve(url);
        if (!resolved) return null;

        const token = cachedToken;
        return {
            uri: resolved,
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        };
    },
};
