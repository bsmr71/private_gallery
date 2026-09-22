import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    View,
    StyleSheet,
    ActivityIndicator,
    Text,
    TouchableOpacity,
    Dimensions,
    Pressable,
    Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { MediaUrlHelper } from '../services/mediaUrl';
import { LocalVaultService } from '../services/localVaultService';
import SecureImage from './SecureImage';
import SFSymbol from './SFSymbol';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const VIDEO_HEIGHT = Math.round(SCREEN_HEIGHT * 0.70);

const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
    const totalSecs = Math.floor(seconds);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
};

const SPEEDS = [1.0, 1.25, 1.5, 2.0];

export default function VideoPlayerView({
    item,
    isVisible = true,
    chromeVisible = true,
    onToggleControls,
    onHideControls,
    onShowControls,
}) {
    const [loadError, setLoadError] = useState(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isBuffering, setIsBuffering] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [contentFit, setContentFit] = useState('contain');

    // Controls visibility and animation synchronized with viewer chrome
    const controlsOpacity = useRef(new Animated.Value(chromeVisible ? 1 : 0)).current;
    const hideTimeoutRef = useRef(null);

    // Scrubber track width and dragging
    const [scrubberWidth, setScrubberWidth] = useState(SCREEN_WIDTH - 140);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [scrubTime, setScrubTime] = useState(0);

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
            return { uri: localUri };
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

    // Initialize expo-video player with smooth loop and autoplay
    const player = useVideoPlayer(videoSource, (p) => {
        p.loop = true;
        p.play();
    });

    // Synchronize controlsOpacity with chromeVisible and handle auto-hide
    useEffect(() => {
        if (chromeVisible) {
            Animated.timing(controlsOpacity, {
                toValue: 1,
                duration: 180,
                useNativeDriver: true,
            }).start();

            if (isPlaying && !isScrubbing) {
                if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
                hideTimeoutRef.current = setTimeout(() => {
                    onHideControls && onHideControls();
                }, 4500);
            }
        } else {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
            Animated.timing(controlsOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [chromeVisible, isPlaying, isScrubbing, onHideControls]);

    const resetControlsTimeout = useCallback(() => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
        }
        if (!chromeVisible) {
            onShowControls && onShowControls();
        } else if (isPlaying && !isScrubbing) {
            hideTimeoutRef.current = setTimeout(() => {
                onHideControls && onHideControls();
            }, 4500);
        }
    }, [chromeVisible, isPlaying, isScrubbing, onShowControls, onHideControls]);

    useEffect(() => {
        if (!player) return;

        // Playing change listener
        const subPlaying = player.addListener?.('playingChange', (event) => {
            const playing = Boolean(event?.isPlaying);
            setIsPlaying(playing);
            if (!playing) {
                // Show controls when paused
                if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
                onShowControls && onShowControls();
            }
        });

        // Status change listener
        const subStatus = player.addListener?.('statusChange', (event) => {
            if (event?.status === 'loading') {
                setIsBuffering(true);
            } else if (event?.status === 'readyToPlay') {
                setIsBuffering(false);
                setLoadError(null);
                if (player.duration && player.duration > 0) {
                    setDuration(player.duration);
                }
            } else if (event?.status === 'error') {
                setIsBuffering(false);
                setLoadError(event?.error?.message || 'Gagal memutar video');
            }
        });

        // Time update listener
        const subTime = player.addListener?.('timeUpdate', (event) => {
            if (!isScrubbing) {
                setCurrentTime(event?.currentTime || 0);
            }
            if (player.duration && player.duration > 0) {
                setDuration(player.duration);
            }
        });

        // Volume / Mute listener
        const subMuted = player.addListener?.('mutedChange', (event) => {
            setIsMuted(Boolean(event?.isMuted));
        });

        // Playback rate listener
        const subRate = player.addListener?.('playbackRateChange', (event) => {
            if (event?.playbackRate) {
                setPlaybackRate(event.playbackRate);
            }
        });

        // Initial sync
        if (player.duration) setDuration(player.duration);
        if (player.currentTime) setCurrentTime(player.currentTime);
        if (player.muted !== undefined) setIsMuted(player.muted);

        // Auto-play when visible
        if (isVisible) {
            player.play();
            resetControlsTimeout();
        } else {
            player.pause();
        }

        return () => {
            try {
                if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
                player.pause();
                subPlaying?.remove?.();
                subStatus?.remove?.();
                subTime?.remove?.();
                subMuted?.remove?.();
                subRate?.remove?.();
            } catch (e) {}
        };
    }, [player, isVisible, isScrubbing]);

    const handleTapScreen = () => {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        onToggleControls && onToggleControls();
    };

    const handleTogglePlay = () => {
        if (!player) return;
        if (isPlaying) {
            player.pause();
        } else {
            player.play();
        }
        resetControlsTimeout();
    };

    const handleSkipBackward = () => {
        if (!player) return;
        const target = Math.max(0, (player.currentTime || 0) - 10);
        player.currentTime = target;
        setCurrentTime(target);
        resetControlsTimeout();
    };

    const handleSkipForward = () => {
        if (!player) return;
        const target = Math.min(duration || 0, (player.currentTime || 0) + 10);
        player.currentTime = target;
        setCurrentTime(target);
        resetControlsTimeout();
    };

    const handleToggleMute = () => {
        if (!player) return;
        const nextMuted = !isMuted;
        player.muted = nextMuted;
        setIsMuted(nextMuted);
        resetControlsTimeout();
    };

    const handleToggleSpeed = () => {
        if (!player) return;
        const nextIdx = (SPEEDS.indexOf(playbackRate) + 1) % SPEEDS.length;
        const nextRate = SPEEDS[nextIdx];
        player.playbackRate = nextRate;
        setPlaybackRate(nextRate);
        resetControlsTimeout();
    };

    const handleToggleFit = () => {
        setContentFit((prev) => (prev === 'contain' ? 'cover' : 'contain'));
        resetControlsTimeout();
    };

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

    // Scrubber drag / touch handlers
    const calculateSeekTime = (nativeEvent) => {
        const { locationX } = nativeEvent;
        if (scrubberWidth <= 0 || !duration) return 0;
        const ratio = Math.max(0, Math.min(locationX / scrubberWidth, 1));
        return ratio * duration;
    };

    const handleScrubberGrant = (e) => {
        setIsScrubbing(true);
        const time = calculateSeekTime(e.nativeEvent);
        setScrubTime(time);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };

    const handleScrubberMove = (e) => {
        const time = calculateSeekTime(e.nativeEvent);
        setScrubTime(time);
    };

    const handleScrubberRelease = (e) => {
        const time = calculateSeekTime(e.nativeEvent);
        if (player) {
            player.currentTime = time;
            setCurrentTime(time);
        }
        setIsScrubbing(false);
        resetControlsTimeout();
    };

    if (!localUri && !streamUrl) {
        return (
            <View style={styles.errorContainer}>
                <SFSymbol name="exclamationmark.triangle" size={32} color="#FF9F0A" />
                <Text style={styles.errorText}>Tautan video tidak valid</Text>
            </View>
        );
    }

    const displayTime = isScrubbing ? scrubTime : currentTime;
    const progressRatio = duration > 0 ? Math.max(0, Math.min(displayTime / duration, 1)) : 0;
    const progressPercent = `${progressRatio * 100}%`;

    return (
        <View style={styles.container}>
            {/* Native Video View from expo-video without clunky default Android controls */}
            <VideoView
                style={styles.videoView}
                player={player}
                nativeControls={false}
                contentFit={contentFit}
                allowsFullscreen={true}
                surfaceType="textureView"
            />

            {/* Full-bleed solid touch target over native TextureView to reliably toggle controls */}
            <Pressable
                style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.001)' }]}
                onPress={handleTapScreen}
                collapsable={false}
            />

            {/* Buffering Indicator with Poster Backdrop */}
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

            {/* Gorgeous Apple Photos-Style Controls Overlay */}
            {!isBuffering && !loadError && (
                <Animated.View
                    style={[styles.controlsOverlay, { opacity: controlsOpacity }]}
                    pointerEvents={chromeVisible ? 'box-none' : 'none'}
                >
                    {/* Top Row: Quick Action Badges */}
                    <View style={styles.topControlsRow} pointerEvents="box-none">
                        {/* Audio Mute/Unmute */}
                        <TouchableOpacity
                            style={[styles.glassPill, isMuted && styles.glassPillActive]}
                            onPress={handleToggleMute}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <SFSymbol
                                name={isMuted ? 'speaker.slash.fill' : 'speaker.wave.2.fill'}
                                size={15}
                                color={isMuted ? '#FF9F0A' : '#ffffff'}
                            />
                            <Text style={[styles.glassPillText, isMuted && { color: '#FF9F0A' }]}>
                                {isMuted ? 'Bisu' : 'Suara'}
                            </Text>
                        </TouchableOpacity>

                        {/* Right Top Buttons: Speed & Fit */}
                        <View style={styles.topRightActions}>
                            {/* Playback Speed */}
                            <TouchableOpacity
                                style={styles.glassPill}
                                onPress={handleToggleSpeed}
                                activeOpacity={0.7}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Text style={styles.speedText}>{playbackRate.toFixed(playbackRate % 1 === 0 ? 0 : 2)}x</Text>
                            </TouchableOpacity>

                            {/* Aspect Ratio / Fit */}
                            <TouchableOpacity
                                style={styles.glassPill}
                                onPress={handleToggleFit}
                                activeOpacity={0.7}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <SFSymbol name="arrow.up.left.and.arrow.down.right" size={13} color="#ffffff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Center Row: Rewind 10s, Big Center Play/Pause, Forward 10s */}
                    <View style={styles.centerControlsRow} pointerEvents="box-none">
                        {/* Skip Backward 10s */}
                        <TouchableOpacity
                            style={styles.skipBtn}
                            onPress={handleSkipBackward}
                            activeOpacity={0.75}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <SFSymbol name="gobackward.10" size={24} color="#ffffff" />
                            <Text style={styles.skipSubtext}>-10s</Text>
                        </TouchableOpacity>

                        {/* Big Center Play/Pause */}
                        <TouchableOpacity
                            style={styles.bigPlayBtn}
                            onPress={handleTogglePlay}
                            activeOpacity={0.8}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <SFSymbol
                                name={isPlaying ? 'pause.fill' : 'play.fill'}
                                size={28}
                                color="#ffffff"
                                style={!isPlaying ? { marginLeft: 3 } : undefined}
                            />
                        </TouchableOpacity>

                        {/* Skip Forward 10s */}
                        <TouchableOpacity
                            style={styles.skipBtn}
                            onPress={handleSkipForward}
                            activeOpacity={0.75}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <SFSymbol name="goforward.10" size={24} color="#ffffff" />
                            <Text style={styles.skipSubtext}>+10s</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Bottom Row: Scrubber Timeline Bar with Elapsed & Total Duration */}
                    <View style={styles.bottomControlsBar}>
                        <Text style={styles.timeLabel}>{formatTime(displayTime)}</Text>

                        {/* Interactive Scrub Bar */}
                        <View
                            style={styles.scrubberContainer}
                            onLayout={(e) => setScrubberWidth(e.nativeEvent.layout.width)}
                            onStartShouldSetResponder={() => true}
                            onMoveShouldSetResponder={() => true}
                            onResponderGrant={handleScrubberGrant}
                            onResponderMove={handleScrubberMove}
                            onResponderRelease={handleScrubberRelease}
                        >
                            {/* Background Track */}
                            <View style={styles.scrubberTrack} pointerEvents="none">
                                {/* Active Progress Track */}
                                <View style={[styles.scrubberProgress, { width: progressPercent }]} pointerEvents="none" />
                            </View>

                            {/* Scrubber Knob / Thumb */}
                            <View style={[styles.scrubberKnob, { left: progressPercent }]} pointerEvents="none" />
                        </View>

                        <Text style={styles.timeLabel}>{formatTime(duration)}</Text>
                    </View>
                </Animated.View>
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
        height: VIDEO_HEIGHT,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    videoView: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000000',
    },
    controlsOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
        paddingVertical: 10,
    },
    topControlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    topRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    glassPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(28, 28, 30, 0.75)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 18,
    },
    glassPillActive: {
        backgroundColor: 'rgba(255, 159, 10, 0.2)',
        borderColor: 'rgba(255, 159, 10, 0.45)',
    },
    glassPillText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '600',
    },
    speedText: {
        color: '#0A84FF',
        fontSize: 12,
        fontWeight: '700',
    },
    centerControlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
    },
    bigPlayBtn: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(10, 132, 255, 0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.35)',
        shadowColor: '#0A84FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 8,
    },
    skipBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(28, 28, 30, 0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    skipSubtext: {
        color: '#ffffff',
        fontSize: 9,
        fontWeight: '700',
        marginTop: 1,
        opacity: 0.9,
    },
    bottomControlsBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(24, 24, 28, 0.88)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.16)',
        marginHorizontal: 14,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
        elevation: 8,
    },
    timeLabel: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
        minWidth: 38,
        textAlign: 'center',
    },
    scrubberContainer: {
        flex: 1,
        height: 32,
        justifyContent: 'center',
    },
    scrubberTrack: {
        width: '100%',
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    scrubberProgress: {
        height: '100%',
        backgroundColor: '#0A84FF',
        borderRadius: 2,
    },
    scrubberKnob: {
        position: 'absolute',
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#ffffff',
        marginLeft: -7,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 3,
        elevation: 4,
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
    errorContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    errorText: {
        color: '#FF9F0A',
        fontSize: 14,
        marginTop: 10,
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
