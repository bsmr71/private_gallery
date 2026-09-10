import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Image,
    Dimensions,
    Alert,
    Share,
    StatusBar,
    PanResponder,
    Platform,
    Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../constants/theme';
import Filmstrip from './Filmstrip';
import AppleDock from './AppleDock';
import InfoSheet from './InfoSheet';
import { ApiService } from '../services/api';
import SecureImage from './SecureImage';
import VideoPlayerView from './VideoPlayerView';
import AlbumPickerModal from './AlbumPickerModal';

import SFSymbol from './SFSymbol';
import { BlurView } from 'expo-blur';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { MediaUrlHelper } from '../services/mediaUrl';
import { LocalVaultService } from '../services/localVaultService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

class VideoErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    componentDidCatch(err) {
        console.warn('VideoPlayer error caught:', err);
    }
    render() {
        if (this.state.hasError) {
            return this.props.fallback || null;
        }
        return this.props.children;
    }
}

export default function PhotoViewerModal({
    visible,
    items,
    initialIndex,
    onClose,
    onMediaUpdated,
    onMediaDeleted,
}) {
    const insets = useSafeAreaInsets();
    const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
    const [chromeVisible, setChromeVisible] = useState(true);
    const [infoVisible, setInfoVisible] = useState(false);
    const [albumModalVisible, setAlbumModalVisible] = useState(false);
    const [downloading, setDownloading] = useState(false);

    // Animated 2D vector for smooth swipe gestures (slide X to browse, slide Y to dismiss)
    const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

    // Stable references to prevent stale closures inside PanResponder
    const currentIndexRef = useRef(currentIndex);
    const itemsRef = useRef(items);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        currentIndexRef.current = currentIndex;
    }, [currentIndex]);

    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (visible) {
            setCurrentIndex(initialIndex || 0);
            setChromeVisible(true);
            setInfoVisible(false);
            setAlbumModalVisible(false);
            setDownloading(false);
            pan.setValue({ x: 0, y: 0 });
        }
    }, [visible, initialIndex]);

    const activeItem = items && items[currentIndex] ? items[currentIndex] : null;
    const isCurrentVideo = Boolean(
        activeItem &&
        (activeItem.type === 'video' ||
            (activeItem.mime_type && activeItem.mime_type.includes('video')))
    );

    const activeLocalUri = activeItem ? LocalVaultService.getLocalUri(activeItem.id) : null;

    // Auto-cache full photo to local vault in background when viewing
    useEffect(() => {
        if (visible && activeItem && !activeLocalUri && !isCurrentVideo) {
            LocalVaultService.cacheMediaFromCloud(activeItem);
        }
    }, [visible, activeItem, activeLocalUri, isCurrentVideo]);

    // PanResponder for smooth sliding gestures:
    // - Slide Left / Right: Navigate to Next / Prev item (for both photos and videos)
    // - Slide Up / Down: Dismiss / Exit viewer (for both photos and videos)
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onStartShouldSetPanResponderCapture: () => false,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                const { dx, dy } = gestureState;
                const isHorizontal = Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 0.8;
                const isVertical = Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 0.8;
                return isHorizontal || isVertical;
            },
            onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
                const { dx, dy } = gestureState;
                // Capture gestures over child components (like native VideoView textureView)
                const isHorizontal = Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 0.8;
                const isVertical = Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx) * 0.8;
                return isHorizontal || isVertical;
            },
            onPanResponderGrant: () => {
                pan.setOffset({
                    x: pan.x._value || 0,
                    y: pan.y._value || 0,
                });
                pan.setValue({ x: 0, y: 0 });
            },
            onPanResponderMove: (evt, gestureState) => {
                const { dx, dy } = gestureState;
                // If moving predominantly vertically (swipe up or down to exit)
                if (Math.abs(dy) > Math.abs(dx) * 0.9) {
                    pan.setValue({ x: 0, y: dy });
                } else {
                    // Moving predominantly horizontally (swipe left or right to browse)
                    pan.setValue({ x: dx * 0.8, y: 0 });
                }
            },
            onPanResponderRelease: (evt, gestureState) => {
                pan.flattenOffset();
                const { dx, dy, vx, vy } = gestureState;
                const curIdx = currentIndexRef.current;
                const allItems = itemsRef.current || [];

                // 1. Vertical Swipe: Slide UP or DOWN to dismiss
                const isVerticalSwipe =
                    (Math.abs(dy) > 50 || Math.abs(vy) > 0.35) &&
                    Math.abs(dy) > Math.abs(dx) * 0.9;

                if (isVerticalSwipe) {
                    Animated.timing(pan, {
                        toValue: { x: 0, y: dy > 0 ? SCREEN_HEIGHT : -SCREEN_HEIGHT },
                        duration: 160,
                        useNativeDriver: true,
                    }).start(() => {
                        pan.setValue({ x: 0, y: 0 });
                        onCloseRef.current && onCloseRef.current();
                    });
                    return;
                }

                // 2. Horizontal Swipe: Slide LEFT (Next) or RIGHT (Prev)
                const isHorizontalSwipe =
                    (Math.abs(dx) > 30 || Math.abs(vx) > 0.3) &&
                    Math.abs(dx) > Math.abs(dy) * 0.9;

                if (isHorizontalSwipe) {
                    if (dx < 0 && curIdx < allItems.length - 1) {
                        // Slide Left -> NEXT
                        Animated.timing(pan, {
                            toValue: { x: -SCREEN_WIDTH * 0.4, y: 0 },
                            duration: 100,
                            useNativeDriver: true,
                        }).start(() => {
                            setCurrentIndex(curIdx + 1);
                            pan.setValue({ x: SCREEN_WIDTH * 0.4, y: 0 });
                            Animated.spring(pan, {
                                toValue: { x: 0, y: 0 },
                                friction: 8,
                                tension: 65,
                                useNativeDriver: true,
                            }).start();
                        });
                        return;
                    } else if (dx > 0 && curIdx > 0) {
                        // Slide Right -> PREV
                        Animated.timing(pan, {
                            toValue: { x: SCREEN_WIDTH * 0.4, y: 0 },
                            duration: 100,
                            useNativeDriver: true,
                        }).start(() => {
                            setCurrentIndex(curIdx - 1);
                            pan.setValue({ x: -SCREEN_WIDTH * 0.4, y: 0 });
                            Animated.spring(pan, {
                                toValue: { x: 0, y: 0 },
                                friction: 8,
                                tension: 65,
                                useNativeDriver: true,
                            }).start();
                        });
                        return;
                    }
                }

                // 3. Fallback: Snap smoothly back to center
                Animated.spring(pan, {
                    toValue: { x: 0, y: 0 },
                    friction: 7,
                    tension: 50,
                    useNativeDriver: true,
                }).start();

                // 4. Tap handling (finger barely moved): Toggle cinema mode
                if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
                    setChromeVisible((prev) => !prev);
                }
            },
            onPanResponderTerminate: () => {
                pan.flattenOffset();
                Animated.spring(pan, {
                    toValue: { x: 0, y: 0 },
                    friction: 7,
                    tension: 50,
                    useNativeDriver: true,
                }).start();
            },
        })
    ).current;

    const handleToggleFavorite = async () => {
        if (!activeItem) return;
        try {
            const res = await ApiService.toggleFavorite(activeItem.id);
            if (res.success) {
                activeItem.is_favorite = res.is_favorite;
                onMediaUpdated && onMediaUpdated(activeItem);
            }
        } catch (e) {
            Alert.alert('Error', 'Gagal mengubah status favorit');
        }
    };

    const handleShare = async () => {
        if (!activeItem) return;
        try {
            await Share.share({
                title: activeItem.title,
                message: `Lihat media ini: ${activeItem.stream_url || activeItem.download_url}`,
                url: activeItem.stream_url,
            });
        } catch (e) {}
    };

    const handleDownload = async () => {
        if (!activeItem || downloading) return;
        try {
            let shareTargetUri = activeLocalUri;
            if (!shareTargetUri) {
                const rawUrl = activeItem.download_url || activeItem.stream_url;
                const downloadUrl = MediaUrlHelper.resolve(rawUrl);
                const tempLocalUri = `${FileSystemLegacy.cacheDirectory}${Date.now()}_${filename}`;
                const downloadRes = await FileSystemLegacy.downloadAsync(downloadUrl, tempLocalUri);

                if (downloadRes.status !== 200) {
                    throw new Error(`Gagal mengunduh: status ${downloadRes.status}`);
                }
                shareTargetUri = downloadRes.uri;
            }

            setDownloading(false);

            const isSharingAvailable = await Sharing.isAvailableAsync();
            if (isSharingAvailable) {
                await Sharing.shareAsync(shareTargetUri, {
                    mimeType: activeItem.mime_type || (isVideo ? 'video/mp4' : 'image/jpeg'),
                    dialogTitle: `Simpan ${filename}`,
                    UTI: isVideo ? 'public.movie' : 'public.image',
                });
            } else {
                Alert.alert('Unduhan Selesai', `Berkas berhasil diunduh:\n${filename}`);
            }
        } catch (err) {
            setDownloading(false);
            console.error('Download error:', err);
            Alert.alert('Gagal Mengunduh', err?.message || 'Terjadi kesalahan saat mengunduh berkas.');
        }
    };

    const handleDelete = () => {
        if (!activeItem) return;
        Alert.alert(
            'Hapus Media?',
            `Apakah Anda yakin ingin menghapus "${activeItem.title}"? Berkas di Google Drive akan ikut terhapus.`,
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Hapus',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await ApiService.deleteMedia(activeItem.id);
                            LocalVaultService.deleteLocalMedia(activeItem.id);
                            onMediaDeleted && onMediaDeleted(activeItem.id);
                            if (items.length <= 1) {
                                onClose();
                            } else if (currentIndex >= items.length - 1) {
                                setCurrentIndex((prev) => Math.max(0, prev - 1));
                            }
                        } catch (e) {
                            Alert.alert('Gagal', 'Tidak dapat menghapus media');
                        }
                    },
                },
            ]
        );
    };

    const handleRenamePrompt = () => {
        if (!activeItem) return;
        Alert.prompt(
            'Ubah Judul Media',
            'Masukkan nama baru untuk media ini:',
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Simpan',
                    onPress: async (newTitle) => {
                        if (!newTitle || !newTitle.trim()) return;
                        try {
                            await ApiService.renameMedia(activeItem.id, newTitle.trim());
                            activeItem.title = newTitle.trim();
                            onMediaUpdated && onMediaUpdated(activeItem);
                        } catch (e) {
                            Alert.alert('Gagal', 'Tidak dapat mengganti nama media');
                        }
                    },
                },
            ],
            'plain-text',
            activeItem.title
        );
    };

    if (!visible || !activeItem) return null;

    const bgOpacity = pan.y.interpolate({
        inputRange: [-SCREEN_HEIGHT * 0.45, 0, SCREEN_HEIGHT * 0.45],
        outputRange: [0.35, 1, 0.35],
        extrapolate: 'clamp',
    });

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={false}
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <Animated.View style={[styles.container, { opacity: bgOpacity }]}>

                {/* Top Bar (Apple Photos Header) */}
                {chromeVisible && (
                    <View style={[styles.topBar, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 48 : 36) }]}>
                        <BlurView tint="dark" intensity={70} style={StyleSheet.absoluteFill} />
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={onClose}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <SFSymbol name="chevron.left" size={18} color="#0A84FF" />
                            <Text style={styles.backText}>Semua Foto</Text>
                        </TouchableOpacity>

                        <View style={styles.centerInfo}>
                            <Text style={styles.headerTitle} numberOfLines={1}>
                                {activeItem.title}
                            </Text>
                            <Text style={styles.headerDate}>
                                {activeItem.formatted_date || 'Foto'}
                            </Text>
                        </View>

                        <View style={styles.counterBadge}>
                            <Text style={styles.counterText}>
                                {currentIndex + 1} / {items.length}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Floating Left / Right Navigation Chevrons */}
                {chromeVisible && currentIndex > 0 && (
                    <TouchableOpacity
                        style={styles.floatingNavLeft}
                        onPress={() => {
                            pan.setValue({ x: SCREEN_WIDTH * 0.25, y: 0 });
                            setCurrentIndex((prev) => prev - 1);
                            Animated.spring(pan, {
                                toValue: { x: 0, y: 0 },
                                friction: 8,
                                tension: 65,
                                useNativeDriver: true,
                            }).start();
                        }}
                        activeOpacity={0.7}
                        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                    >
                        <SFSymbol name="chevron.left" size={20} color="#ffffff" weight="bold" />
                    </TouchableOpacity>
                )}
                {chromeVisible && currentIndex < items.length - 1 && (
                    <TouchableOpacity
                        style={styles.floatingNavRight}
                        onPress={() => {
                            pan.setValue({ x: -SCREEN_WIDTH * 0.25, y: 0 });
                            setCurrentIndex((prev) => prev + 1);
                            Animated.spring(pan, {
                                toValue: { x: 0, y: 0 },
                                friction: 8,
                                tension: 65,
                                useNativeDriver: true,
                            }).start();
                        }}
                        activeOpacity={0.7}
                        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                    >
                        <SFSymbol name="chevron.right" size={20} color="#ffffff" weight="bold" />
                    </TouchableOpacity>
                )}

                {/* Center Image / Video Viewport with Smooth Gesture Translation */}
                <Animated.View
                    style={[
                        styles.viewport,
                        {
                            transform: pan.getTranslateTransform(),
                        },
                    ]}
                    {...panResponder.panHandlers}
                >
                    {isCurrentVideo ? (
                        <VideoErrorBoundary
                            fallback={
                                <SecureImage
                                    source={activeItem.thumbnail_url || activeItem.stream_url}
                                    style={styles.mainImage}
                                    resizeMode="contain"
                                />
                            }
                        >
                            <VideoPlayerView
                                key={activeItem.id}
                                item={activeItem}
                                isVisible={visible}
                                onToggleControls={() => setChromeVisible((prev) => !prev)}
                            />
                        </VideoErrorBoundary>
                    ) : (
                        <SecureImage
                            source={activeLocalUri || activeItem.stream_url}
                            style={styles.mainImage}
                            resizeMode="contain"
                        />
                    )}
                </Animated.View>

                {/* Bottom Section (Filmstrip + Dock) */}
                {chromeVisible && (
                    <View style={[styles.bottomSection, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
                        <Filmstrip
                            items={items}
                            activeIndex={currentIndex}
                            onSelectIndex={(idx) => setCurrentIndex(idx)}
                        />

                        <AppleDock
                            item={activeItem}
                            onFavorite={handleToggleFavorite}
                            onInfo={() => setInfoVisible(true)}
                            onShare={handleShare}
                            onDownload={handleDownload}
                            downloading={downloading}
                            onMove={() => setAlbumModalVisible(true)}
                            onDelete={handleDelete}
                        />
                    </View>
                )}

                {/* Info Sheet Modal */}
                <InfoSheet
                    visible={infoVisible}
                    item={activeItem}
                    onClose={() => setInfoVisible(false)}
                    onRename={handleRenamePrompt}
                />

                {/* Album Picker Modal (Move / Copy) */}
                <AlbumPickerModal
                    visible={albumModalVisible}
                    mediaIds={activeItem ? [activeItem.id] : []}
                    onClose={() => setAlbumModalVisible(false)}
                    onSuccess={(res) => {
                        if (activeItem && res?.targetAlbumId !== undefined) {
                            activeItem.album_id = res.targetAlbumId;
                            onMediaUpdated && onMediaUpdated(activeItem);
                        }
                    }}
                />
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
        justifyContent: 'space-between',
    },
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 48,
        paddingBottom: 12,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.12)',
        overflow: 'hidden',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
    },
    backText: {
        color: '#0A84FF',
        fontSize: 16,
        fontWeight: '400',
        marginLeft: 4,
    },
    centerInfo: {
        alignItems: 'center',
        maxWidth: '50%',
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
    headerDate: {
        color: '#98989f',
        fontSize: 11,
        marginTop: 2,
    },
    counterBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    counterText: {
        color: '#cbd5e1',
        fontSize: 11,
        fontWeight: '600',
    },
    viewport: {
        flex: 1,
        width: SCREEN_WIDTH,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mainImage: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT * 0.76,
    },
    videoPlayOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
    },
    playCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#ffffff',
    },
    playTriangle: {
        color: '#ffffff',
        fontSize: 22,
        marginLeft: 4,
    },
    bottomSection: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        alignItems: 'center',
        paddingBottom: 15,
    },
    floatingNavLeft: {
        position: 'absolute',
        left: 12,
        top: '48%',
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(20, 20, 26, 0.65)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 55,
        elevation: 8,
    },
    floatingNavRight: {
        position: 'absolute',
        right: 12,
        top: '48%',
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(20, 20, 26, 0.65)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 55,
        elevation: 8,
    },
});
