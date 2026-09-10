import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    StyleSheet,
    ActivityIndicator,
    Text,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { MediaUrlHelper } from '../services/mediaUrl';
import { LocalVaultService } from '../services/localVaultService';
import SecureImage from './SecureImage';
import SFSymbol from './SFSymbol';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function VideoPlayerView({
    item,
    isVisible = true,
    onToggleControls,
}) {
    const [loadError, setLoadError] = useState(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isBuffering, setIsBuffering] = useState(true);

    // Check if local file exists in Private Local Vault for 0.05s instant playback
    const localUri = useMemo(() => {
        if (!item?.id) return null;
        return LocalVaultService.getLocalUri(item.id);
    }, [item?.id]);

    // Resolve authenticated streaming URL with token
    const streamUrl = useMemo(() => {
        if (!item || !item.stream_url) return null;
        return MediaUrlHelper.resolve(item.stream_url);
    }, [item?.stream_url]);

    const token = MediaUrlHelper.getToken();

    const videoSource = useMemo(() => {
        // 1. Prioritize Local Encrypted Vault (0.05s Instant Offline Playback, 0 Network Buffering)
        if (localUri) {
            return {
                uri: localUri,
            };
        }

        // 2. Fallback to Cloud Streaming
        if (!streamUrl) return null;
        return {
            uri: streamUrl,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        };
    }, [localUri, streamUrl, token]);

    // Auto-cache to local vault in background when streaming from cloud
    useEffect(() => {
        if (!localUri && item && isVisible) {
            LocalVaultService.cacheMediaFromCloud(item);
        }
    }, [localUri, item, isVisible]);

    // Initialize expo-video player
    const player = useVideoPlayer(videoSource, (p) => {
        p.loop = true;
        p.play();
    });

    useEffect(() => {
        if (!player) return;

        // Listen for playing status
        const subPlaying = player.addListener?.('playingChange', (event) => {
            setIsPlaying(Boolean(event?.isPlaying));
        });

        // Listen for status/buffering changes
        const subStatus = player.addListener?.('statusChange', (event) => {
            if (event?.status === 'loading') {
                setIsBuffering(true);
            } else if (event?.status === 'readyToPlay') {
                setIsBuffering(false);
                setLoadError(null);
            } else if (event?.status === 'error') {
                setIsBuffering(false);
                setLoadError(event?.error?.message || 'Gagal memutar video');
            }
        });

        // Auto play if visible
        if (isVisible) {
            player.play();
        } else {
            player.pause();
        }

        return () => {
            try {
                player.pause();
                subPlaying?.remove?.();
                subStatus?.remove?.();
            } catch (e) {
                // cleanup safety
            }
        };
    }, [player, isVisible]);

    const handleRetry = () => {
        setLoadError(null);
        setIsBuffering(true);
        if (player) {
            try {
                player.replay();
                player.play();
            } catch (e) {
                console.warn('Retry error:', e);
            }
        }
    };

    if (!localUri && !streamUrl) {
        return (
            <View style={styles.errorContainer}>
                <SFSymbol name="exclamationmark.triangle" size={32} color="#FF9F0A" />
                <Text style={styles.errorText}>Tautan video tidak valid</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Native Video View from expo-video */}
            <VideoView
                style={styles.videoView}
                player={player}
                nativeControls={true}
                contentFit="contain"
                allowsFullscreen={true}
                surfaceType="textureView"
            />

            {/* Buffering Indicator with Thumbnail Poster Backdrop */}
            {isBuffering && !loadError && (
                <View style={styles.loadingOverlay} pointerEvents="none">
                    {Boolean(item?.thumbnail_url) && (
                        <SecureImage
                            source={item.thumbnail_url}
                            style={StyleSheet.absoluteFillObject}
                            resizeMode="contain"
                        />
                    )}
                    <View style={styles.bufferingBackdrop}>
                        <ActivityIndicator size="large" color="#0A84FF" />
                        <Text style={styles.loadingText}>Memuat Video...</Text>
                    </View>
                </View>
            )}

            {/* Error Overlay with Retry */}
            {loadError && (
                <View style={styles.errorOverlay}>
                    <SFSymbol name="exclamationmark.circle.fill" size={36} color="#FF453A" />
                    <Text style={styles.errorTitle}>Video Tidak Dapat Diputar</Text>
                    <Text style={styles.errorDesc}>{loadError}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.8}>
                        <SFSymbol name="arrow.clockwise" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.retryText}>Coba Lagi</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT * 0.76,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    videoView: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000000',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bufferingBackdrop: {
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#ffffff',
        fontSize: 13,
        marginTop: 10,
        fontWeight: '500',
    },
    errorOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    errorTitle: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
        marginTop: 12,
        marginBottom: 6,
    },
    errorDesc: {
        color: '#8E8E93',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 16,
    },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0A84FF',
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 8,
    },
    retryText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
    },
});
