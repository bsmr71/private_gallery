const DEFAULT_CONFIG = { apiBaseUrl: 'https://gallery.bsmrlab.com/api' };
let cachedToken = 'test-token-123';
let cachedApiUrl = DEFAULT_CONFIG.apiBaseUrl;

function resolve(url, explicitToken = null, explicitApiUrl = null) {
    if (!url) return null;
    let resolved = String(url);

    if (resolved.startsWith('file://') || resolved.startsWith('content://') || resolved.startsWith('data:')) {
        return resolved;
    }

    const token = explicitToken || cachedToken;
    const apiUrl = explicitApiUrl || cachedApiUrl;

    if (apiUrl) {
        const serverOrigin = apiUrl.replace(/\/api\/?$/, '');

        if (resolved.startsWith('/')) {
            resolved = `${serverOrigin}${resolved}`;
        }

        if (serverOrigin.startsWith('https://') && resolved.startsWith('http://')) {
            resolved = resolved.replace(/^http:\/\//, 'https://');
        }

        if (resolved.includes('/media/') && !resolved.includes('/api/media/')) {
            resolved = resolved.replace(/\/media\//, '/api/media/');
        }

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

    if (token && !resolved.includes('token=')) {
        const separator = resolved.includes('?') ? '&' : '?';
        resolved = `${resolved}${separator}token=${encodeURIComponent(token)}`;
    }

    return resolved;
}

console.log('Result 1:', resolve('https://gallery.bsmrlab.com/api/media/1699/stream?token=abc'));
console.log('Result 2:', resolve('/api/media/1699/stream'));
console.log('Result 3:', resolve('http://gallery.test/media/1699/stream'));
