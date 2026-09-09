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

    useEffect(() => {
        if (visible) {
            setCurrentIndex(initialIndex || 0);
            setChromeVisible(true);
            setInfoVisible(false);
        }
    }, [visible, initialIndex]);

    const activeItem = items && items[currentIndex];

    // Simple horizontal swipe detection
    const panResponder = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderRelease: (evt, gestureState) => {
            const { dx, dy } = gestureState;

            // Horizontal Swipe
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                if (dx < 0 && currentIndex < items.length - 1) {
                    setCurrentIndex((prev) => prev + 1); // Swipe left -> Next
                } else if (dx > 0 && currentIndex > 0) {
                    setCurrentIndex((prev) => prev - 1); // Swipe right -> Prev
                }
            } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
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
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={onClose}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.backChevron}>‹</Text>
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

                {/* Center Image Viewport */}
                <View style={styles.viewport} {...panResponder.panHandlers}>
                    <Image
                        source={{ uri: activeItem.stream_url }}
                        style={styles.mainImage}
                        resizeMode="contain"
                    />

                    {activeItem.type === 'video' && (
                        <View style={styles.videoPlayOverlay}>
                            <View style={styles.playCircle}>
                                <Text style={styles.playTriangle}>▶</Text>
                            </View>
                        </View>
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
        paddingTop: 45,
        paddingBottom: 12,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(18, 18, 22, 0.75)',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
    },
    backChevron: {
        color: '#38bdf8',
        fontSize: 28,
        lineHeight: 28,
        marginRight: 4,
        fontWeight: '300',
    },
    backText: {
        color: '#38bdf8',
        fontSize: 15,
        fontWeight: '500',
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
