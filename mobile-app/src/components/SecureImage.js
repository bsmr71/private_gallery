import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { MediaUrlHelper } from '../services/mediaUrl';
import { StorageService } from '../services/storage';

export default function SecureImage({ source, style, resizeMode = 'cover', ...props }) {
    const rawUri = typeof source === 'string' ? source : source?.uri;
    const [token, setToken] = useState(MediaUrlHelper.getToken());
    const [loading, setLoading] = useState(true);

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

    const resolvedUri = MediaUrlHelper.resolve(rawUri, token);

    if (!resolvedUri) {
        return <View style={[style, styles.placeholder]} />;
    }

    // Do not pass raw video files (.mp4/.mov) to Image component
    const isVideoFile = resolvedUri.split('?')[0].match(/\.(mp4|mov|m4v|3gp|webm)$/i);
    if (isVideoFile) {
        return <View style={[style, styles.placeholder]} />;
    }

    // If query string already carries token= or URI is local file://, avoid extra Authorization header
    // to prevent Android OkHttp/Glide CORS and header compatibility issues
    const hasQueryToken = resolvedUri.includes('token=') || resolvedUri.startsWith('file://') || resolvedUri.startsWith('content://');

    return (
        <View style={[style, styles.container]}>
            <Image
                source={{
                    uri: resolvedUri,
                    headers: (token && !hasQueryToken) ? { Authorization: `Bearer ${token}` } : undefined,
                }}
                style={StyleSheet.absoluteFill}
                contentFit={resizeMode === 'contain' ? 'contain' : 'cover'}
                transition={150}
                cachePolicy="memory-disk"
                onLoadEnd={() => setLoading(false)}
                onError={(e) => {
                    console.warn('[SecureImage error]', resolvedUri, e?.error);
                    setLoading(false);
                }}
                {...props}
            />
            {loading && (
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
        backgroundColor: '#161618',
    },
    placeholder: {
        backgroundColor: '#161618',
    },
    center: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
