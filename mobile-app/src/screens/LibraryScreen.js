import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    Dimensions,
    ActivityIndicator,
    Alert,
    RefreshControl,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { THEME } from '../constants/theme';
import { ApiService } from '../services/api';
import PhotoViewerModal from '../components/PhotoViewerModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_MARGIN = 2;
const ITEM_SIZE = (SCREEN_WIDTH - ITEM_MARGIN * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

export default function LibraryScreen() {
    const [mediaItems, setMediaItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [stats, setStats] = useState(null);

    // Lightbox state
    const [viewerVisible, setViewerVisible] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(0);

    // Multi-select state
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [uploading, setUploading] = useState(false);

    const fetchMedia = useCallback(async (pageNum = 1, isRefresh = false) => {
        try {
            if (pageNum === 1 && !isRefresh) setLoading(true);
            const res = await ApiService.getMedia({ page: pageNum, per_page: 36 });

            if (res.success) {
                if (pageNum === 1) {
                    setMediaItems(res.data);
                } else {
                    setMediaItems((prev) => [...prev, ...res.data]);
                }
                setHasMore(res.pagination.has_more);
                setPage(pageNum);
                if (res.stats) setStats(res.stats);
            }
        } catch (e) {
            console.warn('Load media error', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchMedia(1);
    }, [fetchMedia]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchMedia(1, true);
    };

    const loadMore = () => {
        if (!loading && hasMore) {
            fetchMedia(page + 1);
        }
    };

    const handleItemPress = (item, index) => {
        if (isSelectMode) {
            toggleSelect(item.id);
        } else {
            setSelectedIdx(index);
            setViewerVisible(true);
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const handleUploadPick = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Izin Ditolak', 'Aplikasi memerlukan izin untuk mengakses galeri Anda.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            allowsMultipleSelection: true,
            quality: 0.9,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setUploading(true);
            try {
                for (const asset of result.assets) {
                    await ApiService.uploadMedia(asset);
                }
                Alert.alert('Berhasil', `${result.assets.length} berkas berhasil dienkripsi dan diunggah ke Google Drive.`);
                fetchMedia(1, true);
            } catch (err) {
                Alert.alert('Gagal Unggah', err.message || 'Terjadi kendala saat mengunggah');
            } finally {
                setUploading(false);
            }
        }
    };

    const handleBatchDelete = () => {
        if (selectedIds.length === 0) return;
        Alert.alert(
            'Hapus Terpilih?',
            `Apakah Anda yakin ingin menghapus ${selectedIds.length} foto/video yang dipilih?`,
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Hapus',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await ApiService.batchDelete(selectedIds);
                            setSelectedIds([]);
                            setIsSelectMode(false);
                            fetchMedia(1, true);
                        } catch (e) {
                            Alert.alert('Gagal', 'Tidak dapat menghapus item terpilih');
                        }
                    },
                },
            ]
        );
    };

    return (
        <View style={styles.container}>
            {/* Header (Apple Photos Style) */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Perpustakaan</Text>
                    {stats && (
                        <Text style={styles.headerSubtitle}>
                            {stats.total} Media • {stats.images} Foto, {stats.videos} Video
                        </Text>
                    )}
                </View>

                <View style={styles.headerRight}>
                    {mediaItems.length > 0 && (
                        <TouchableOpacity
                            style={styles.selectBtn}
                            onPress={() => {
                                setIsSelectMode(!isSelectMode);
                                setSelectedIds([]);
                            }}
                        >
                            <Text style={styles.selectBtnText}>
                                {isSelectMode ? 'Selesai' : 'Pilih'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.uploadPlusBtn}
                        onPress={handleUploadPick}
                        disabled={uploading}
                    >
                        {uploading ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                            <Text style={styles.uploadPlusText}>＋</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Photo Grid */}
            {loading && mediaItems.length === 0 ? (
                <View style={styles.centerLoader}>
                    <ActivityIndicator size="large" color={THEME.colors.accent} />
                    <Text style={styles.loadingText}>Memuat Galeri...</Text>
                </View>
            ) : (
                <FlatList
                    data={mediaItems}
                    keyExtractor={(item) => String(item.id)}
                    numColumns={COLUMN_COUNT}
                    renderItem={({ item, index }) => {
                        const isSelected = selectedIds.includes(item.id);
                        return (
                            <TouchableOpacity
                                style={styles.gridItem}
                                activeOpacity={0.8}
                                onPress={() => handleItemPress(item, index)}
                            >
                                <Image
                                    source={{ uri: item.thumbnail_url || item.stream_url }}
                                    style={styles.itemImage}
                                    resizeMode="cover"
                                />

                                {item.type === 'video' && (
                                    <View style={styles.videoBadge}>
                                        <Text style={styles.videoBadgeText}>▶ Video</Text>
                                    </View>
                                )}

                                {item.is_favorite && !isSelectMode && (
                                    <View style={styles.favBadge}>
                                        <Text style={styles.favBadgeText}>❤️</Text>
                                    </View>
                                )}

                                {isSelectMode && (
                                    <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
                                        {isSelected && <Text style={styles.checkCheck}>✓</Text>}
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    }}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={THEME.colors.accent}
                        />
                    }
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <Text style={styles.emptyIcon}>🖼️</Text>
                            <Text style={styles.emptyTitle}>Galeri Masih Kosong</Text>
                            <Text style={styles.emptyDesc}>Ketuk tombol ＋ di kanan atas untuk mengunggah foto atau video.</Text>
                        </View>
                    }
                />
            )}

            {/* Multi-Select Floating Action Bar */}
            {isSelectMode && selectedIds.length > 0 && (
                <View style={styles.floatingSelectBar}>
                    <Text style={styles.selectCountText}>{selectedIds.length} Dipilih</Text>
                    <TouchableOpacity style={styles.barActionBtn} onPress={handleBatchDelete}>
                        <Text style={styles.barDangerText}>🗑️ Hapus</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Full-Screen Apple Photos Lightbox */}
            <PhotoViewerModal
                visible={viewerVisible}
                items={mediaItems}
                initialIndex={selectedIdx}
                onClose={() => setViewerVisible(false)}
                onMediaUpdated={(updated) => {
                    setMediaItems((prev) =>
                        prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
                    );
                }}
                onMediaDeleted={(deletedId) => {
                    setMediaItems((prev) => prev.filter((m) => m.id !== deletedId));
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 48,
        paddingBottom: 14,
        paddingHorizontal: 16,
        backgroundColor: '#000000',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 12,
        color: THEME.colors.textSecondary,
        marginTop: 2,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    selectBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    selectBtnText: {
        color: '#38bdf8',
        fontWeight: '600',
        fontSize: 13,
    },
    uploadPlusBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: THEME.colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadPlusText: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '600',
        lineHeight: 22,
    },
    listContent: {
        paddingBottom: 90,
    },
    gridItem: {
        width: ITEM_SIZE,
        height: ITEM_SIZE,
        marginRight: ITEM_MARGIN,
        marginBottom: ITEM_MARGIN,
        position: 'relative',
        backgroundColor: '#121214',
    },
    itemImage: {
        width: '100%',
        height: '100%',
    },
    videoBadge: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4,
    },
    videoBadgeText: {
        color: '#ffffff',
        fontSize: 9,
        fontWeight: '600',
    },
    favBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
    },
    favBadgeText: {
        fontSize: 11,
    },
    checkCircle: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkCircleActive: {
        backgroundColor: THEME.colors.accent,
        borderColor: THEME.colors.accent,
    },
    checkCheck: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    centerLoader: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: THEME.colors.textSecondary,
        marginTop: 10,
        fontSize: 13,
    },
    emptyWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
        paddingHorizontal: 30,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    emptyTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 6,
    },
    emptyDesc: {
        color: THEME.colors.textSecondary,
        fontSize: 13,
        textAlign: 'center',
    },
    floatingSelectBar: {
        position: 'absolute',
        bottom: 24,
        alignSelf: 'center',
        width: '88%',
        backgroundColor: 'rgba(28, 28, 30, 0.92)',
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        elevation: 8,
    },
    selectCountText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 14,
    },
    barActionBtn: {
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    barDangerText: {
        color: '#f87171',
        fontWeight: '600',
        fontSize: 14,
    },
});
