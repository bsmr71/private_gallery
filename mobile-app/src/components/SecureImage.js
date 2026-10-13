import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { MediaUrlHelper } from '../services/mediaUrl';
import { StorageService } from '../services/storage';
import { LocalVaultService } from '../services/localVaultService';

export default function SecureImage({
    source,
    style,
    resizeMode = 'cover',
    mediaId = null,
    showLoader = false,
    preferFullResolution = false,
    placeholderSource = null,
    fallbackSource = null,
    ...props
}) {
    const rawUri = typeof source === 'string' ? source : source?.uri;
    const [token, setToken] = useState(MediaUrlHelper.getToken());
    const [loading, setLoading] = useState(true);
    const [useCloudFallback, setUseCloudFallback] = useState(false);
    const [useThumbnailFallback, setUseThumbnailFallback] = useState(false);

    // Reset fallback state when source or mediaId changes
    useEffect(() => {
        setUseCloudFallback(false);
        setUseThumbnailFallback(false);
        setLoading(true);
    }, [mediaId, rawUri]);

    useEffect(() => {
        if (!token) {
            StorageService.getToken().then((t) => {
                if (t) {
                    setToken(t);
                    MediaUrlHelper.setToken(t);
                }
            });
        }
    }, [token]);

    // Check if local file exists in private local sandbox vault for 0ms instant loading
    let localUri = null;
    if (mediaId && !useCloudFallback) {
        if (preferFullResolution) {
            localUri = LocalVaultService.getLocalUri(mediaId) || LocalVaultService.getLocalThumbUri(mediaId);
        } else {
            localUri = LocalVaultService.getLocalThumbUri(mediaId) || LocalVaultService.getLocalUri(mediaId);
        }
    } else if (rawUri && rawUri.startsWith('file://') && !useCloudFallback) {
        localUri = rawUri;
    }

    let resolvedUri = null;
    if (useThumbnailFallback && fallbackSource) {
        const thumbRaw = typeof fallbackSource === 'string' ? fallbackSource : fallbackSource?.uri;
        resolvedUri = MediaUrlHelper.resolve(thumbRaw, token);
    } else if (localUri) {
        resolvedUri = localUri;
    } else {
        resolvedUri = MediaUrlHelper.resolve(rawUri, token);
    }

    // If localUri happens to be a video file (.mp4/.mov), fallback to thumbnail
    if (resolvedUri && resolvedUri.split('?')[0].match(/\.(mp4|mov|m4v|3gp|webm)$/i)) {
        if (fallbackSource) {
            const thumbRaw = typeof fallbackSource === 'string' ? fallbackSource : fallbackSource?.uri;
            resolvedUri = MediaUrlHelper.resolve(thumbRaw, token);
        } else {
            resolvedUri = MediaUrlHelper.resolve(rawUri, token);
        }
    }

    let resolvedPlaceholder = null;
    if (placeholderSource) {
        const phRaw = typeof placeholderSource === 'string' ? placeholderSource : placeholderSource?.uri;
        if (phRaw) {
            resolvedPlaceholder = MediaUrlHelper.resolve(phRaw, token);
        }
    }

    // Target URI to display: prefer resolved primary URI, fall back to resolved placeholder
    const targetUri = resolvedUri || resolvedPlaceholder;

    if (!targetUri) {
        return <View style={[styles.container, styles.placeholder, style]} />;
    }

    // Do not pass raw video files (.mp4/.mov) to Image component
    const isVideoFile = targetUri.split('?')[0].match(/\.(mp4|mov|m4v|3gp|webm)$/i);
    if (isVideoFile) {
        return <View style={[styles.container, styles.placeholder, style]} />;
    }

    // If query string already carries token= or URI is local file://, avoid extra Authorization header
    // to prevent Android OkHttp/Glide CORS and header compatibility issues
    const hasQueryToken = targetUri.includes('token=') || targetUri.startsWith('file://') || targetUri.startsWith('content://');

    return (
        <View style={[styles.container, style]}>
            <Image
                source={{
                    uri: targetUri,
                    headers: (token && !hasQueryToken) ? { Authorization: `Bearer ${token}` } : undefined,
                }}
                placeholder={resolvedPlaceholder && resolvedPlaceholder !== targetUri ? { uri: resolvedPlaceholder } : undefined}
                placeholderContentFit={resizeMode === 'contain' ? 'contain' : 'cover'}
                style={StyleSheet.absoluteFill}
                contentFit={resizeMode === 'contain' ? 'contain' : 'cover'}
                transition={150}
                cachePolicy="memory-disk"
                onLoadEnd={() => setLoading(false)}
                onError={(e) => {
                    console.warn('[SecureImage error]', targetUri, e?.error);
                    if (localUri && !useCloudFallback) {
                        // Local file corrupted or missing: auto-delete entry and fall back to cloud URL
                        if (mediaId) {
                            LocalVaultService.deleteLocalMedia(mediaId).catch(() => {});
                        }
                        console.log('[SecureImage] Local file failed, falling back to cloud streaming URL...');
                        setUseCloudFallback(true);
                        return;
                    }
                    if (fallbackSource && !useThumbnailFallback) {
                        console.log('[SecureImage] Cloud stream failed, falling back to thumbnail...');
                        setUseThumbnailFallback(true);
                        return;
                    }
                    setLoading(false);
                }}
                {...props}
            />
            {showLoader && loading && (
                <View style={styles.center}>
                    <ActivityIndicator size="small" color="#555558" />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        backgroundColor: 'transparent',
    },
    placeholder: {
        backgroundColor: 'transparent',
    },
    center: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
