import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { THEME } from '../constants/theme';
import Filmstrip from './Filmstrip';
import AppleDock from './AppleDock';
import InfoSheet from './InfoSheet';
import { ApiService } from '../services/api';
import SecureImage from './SecureImage';
import VideoPlayerView from './VideoPlayerView';

import SFSymbol from './SFSymbol';
import { BlurView } from 'expo-blur';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { MediaUrlHelper } from '../services/mediaUrl';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PhotoViewerModal({
    visible,
    items,
    initialIndex,
    onClose,
    onMediaUpdated,
    onMediaDeleted,
}) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
    const [chromeVisible, setChromeVisible] = useState(true);
    const [infoVisible, setInfoVisible] = useState(false);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        if (visible) {
            setCurrentIndex(initialIndex || 0);
            setChromeVisible(true);
            setInfoVisible(false);
            setDownloading(false);
        }
    }, [visible, initialIndex]);

    const isCurrentVideo = Boolean(
        activeItem?.type === 'video' ||
        (activeItem?.mime_type && activeItem.mime_type.includes('video'))
    );

    // PanResponder for swiping photos/videos & dismissing viewer
    const panResponder = PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (evt, gestureState) => {
            const { dx, dy } = gestureState;
            // For video, only capture deliberate swipe gestures so controls aren't blocked
            if (isCurrentVideo) {
                return (
                    (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) ||
                    (dy > 80 && Math.abs(dy) > Math.abs(dx) * 2)
                );
            }
            return Math.abs(dx) > 15 || Math.abs(dy) > 15;
        },
        onPanResponderRelease: (evt, gestureState) => {
            const { dx, dy } = gestureState;

            // Horizontal Swipe
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                if (dx < 0 && currentIndex < items.length - 1) {
                    setCurrentIndex((prev) => prev + 1); // Swipe left -> Next
                } else if (dx > 0 && currentIndex > 0) {
                    setCurrentIndex((prev) => prev - 1); // Swipe right -> Prev
                }
            } else if (!isCurrentVideo && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
                // Tap on photo -> Toggle cinema mode
                setChromeVisible((prev) => !prev);
            } else if (dy > 100 && Math.abs(dy) > Math.abs(dx) * 2) {
                // Swipe down to dismiss
                onClose();
            }
        },
    });

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
            setDownloading(true);
            const rawUrl = activeItem.download_url || activeItem.stream_url;
            const downloadUrl = MediaUrlHelper.resolve(rawUrl);

            const isVideo = (activeItem.mime_type && activeItem.mime_type.includes('video')) || activeItem.type === 'video';
            const ext = isVideo ? 'mp4' : 'jpg';
            const cleanTitle = (activeItem.title || `media_${activeItem.id}`).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
            const filename = cleanTitle.toLowerCase().endsWith(`.${ext}`) ? cleanTitle : `${cleanTitle}.${ext}`;

            const tempLocalUri = `${FileSystemLegacy.cacheDirectory}${Date.now()}_${filename}`;
            const downloadRes = await FileSystemLegacy.downloadAsync(downloadUrl, tempLocalUri);

            setDownloading(false);

            if (downloadRes.status !== 200) {
                throw new Error(`Gagal mengunduh: status ${downloadRes.status}`);
            }

            const isSharingAvailable = await Sharing.isAvailableAsync();
            if (isSharingAvailable) {
                await Sharing.shareAsync(downloadRes.uri, {
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

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={false}
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <View style={styles.container}>

                {/* Top Bar (Apple Photos Header) */}
                {chromeVisible && (
                    <View style={styles.topBar}>
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

                {/* Center Image / Video Viewport */}
                <View style={styles.viewport} {...panResponder.panHandlers}>
                    {isCurrentVideo ? (
                        <VideoPlayerView
                            key={activeItem.id}
                            item={activeItem}
                            isVisible={visible}
                            onToggleControls={() => setChromeVisible((prev) => !prev)}
                        />
                    ) : (
                        <SecureImage
                            source={activeItem.stream_url}
                            style={styles.mainImage}
                            resizeMode="contain"
                        />
                    )}
                </View>

                {/* Bottom Section (Filmstrip + Dock) */}
                {chromeVisible && (
                    <View style={styles.bottomSection}>
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
                            onMove={() => Alert.alert('Info', 'Gunakan menu rapikan pada album.')}
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
            </View>
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
});
