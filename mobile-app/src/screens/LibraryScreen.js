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
    Platform,
    AppState,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { THEME } from '../constants/theme';
import { ApiService } from '../services/api';
import { SyncService } from '../services/syncService';
import PhotoViewerModal from '../components/PhotoViewerModal';
import SecureImage from '../components/SecureImage';
import SFSymbol from '../components/SFSymbol';
import VaultSyncModal from '../components/VaultSyncModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_MARGIN = 1.5;
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
    const [filterTab, setFilterTab] = useState('all');

    // Vault Sync state
    const [syncModalVisible, setSyncModalVisible] = useState(false);
    const [autoSyncStatus, setAutoSyncStatus] = useState(null);

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

    // Automatic background vault synchronization
    const runAutoSync = useCallback(async () => {
        try {
            await SyncService.triggerAutoSyncIfPending({
                onStart: ({ total }) => {
                    setAutoSyncStatus({
                        type: 'syncing',
                        message: `Menyinkronkan Vault... (1/${total})`,
                    });
                },
                onProgress: ({ current, total }) => {
                    setAutoSyncStatus({
                        type: 'syncing',
                        message: `Menyinkronkan Vault... (${current}/${total})`,
                    });
                },
                onComplete: (res) => {
                    if (res && res.successCount > 0) {
                        setAutoSyncStatus({
                            type: 'done',
                            message: `${res.successCount} foto baru terenkripsi ke Cloud`,
                        });
                        fetchMedia(1, true);
                        setTimeout(() => {
                            setAutoSyncStatus(null);
                        }, 3500);
                    } else {
                        setAutoSyncStatus(null);
                    }
                },
                onError: () => {
                    setAutoSyncStatus(null);
                },
            });
        } catch (e) {
            setAutoSyncStatus(null);
        }
    }, [fetchMedia]);

    useEffect(() => {
        fetchMedia(1);
        runAutoSync();
    }, [fetchMedia, runAutoSync]);

    // Listen for app returning to foreground (after user puts photos in folder)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                runAutoSync();
            }
        });

        // Also check periodically while app is actively kept open
        const interval = setInterval(() => {
            if (AppState.currentState === 'active') {
                runAutoSync();
            }
        }, 25000);

        return () => {
            subscription.remove();
            clearInterval(interval);
        };
    }, [runAutoSync]);

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

    const displayedItems = mediaItems.filter((item) => {
        if (filterTab === 'image') return item.type === 'image';
        if (filterTab === 'video') return item.type === 'video';
        if (filterTab === 'favorite') return item.is_favorite;
        return true;
    });

    return (
        <View style={styles.container}>
            {/* iOS Dynamic Island Style AutoSync Pill */}
            {autoSyncStatus && (
                <View style={styles.autoSyncPillOuter}>
                    <BlurView tint="dark" intensity={85} style={StyleSheet.absoluteFill} />
                    <View style={styles.autoSyncPillInner}>
                        {autoSyncStatus.type === 'syncing' ? (
                            <ActivityIndicator size="small" color="#0A84FF" style={{ marginRight: 8 }} />
                        ) : (
                            <SFSymbol name="checkmark" size={14} color="#30D158" style={{ marginRight: 8 }} />
                        )}
                        <Text style={styles.autoSyncPillText}>{autoSyncStatus.message}</Text>
                    </View>
                </View>
            )}

            {/* Header (Authentic Apple Photos Style) */}
            <View style={styles.header}>
                <View style={styles.headerTopRow}>
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
                                activeOpacity={0.6}
                            >
                                <Text style={styles.selectBtnText}>
                                    {isSelectMode ? 'Selesai' : 'Pilih'}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {/* Vault Sync Button */}
                        <TouchableOpacity
                            style={styles.syncHeaderBtn}
                            onPress={() => setSyncModalVisible(true)}
                            activeOpacity={0.7}
                        >
                            <SFSymbol name="arrow.clockwise" size={17} color="#0A84FF" weight="semibold" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.uploadPlusBtn}
                            onPress={handleUploadPick}
                            disabled={uploading}
                            activeOpacity={0.7}
                        >
                            {uploading ? (
                                <ActivityIndicator size="small" color="#0A84FF" />
                            ) : (
                                <SFSymbol name="plus" size={18} color="#0A84FF" weight="semibold" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* iOS 18 Segmented Filter Capsule */}
                <View style={styles.segmentedFilterContainer}>
                    {[
                        { key: 'all', label: 'Semua' },
                        { key: 'image', label: 'Foto' },
                        { key: 'video', label: 'Video' },
                        { key: 'favorite', label: 'Favorit' },
                    ].map((tab) => {
                        const active = filterTab === tab.key;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                style={[styles.segmentedTab, active && styles.segmentedTabActive]}
                                onPress={() => setFilterTab(tab.key)}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.segmentedLabel, active && styles.segmentedLabelActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Photo Grid */}
            {loading && mediaItems.length === 0 ? (
                <View style={styles.centerLoader}>
                    <ActivityIndicator size="large" color="#0A84FF" />
                    <Text style={styles.loadingText}>Memuat Galeri...</Text>
                </View>
            ) : (
                <FlatList
                    data={displayedItems}
                    keyExtractor={(item) => String(item.id)}
                    numColumns={COLUMN_COUNT}
                    renderItem={({ item, index }) => {
                        const isSelected = selectedIds.includes(item.id);
                        return (
                            <TouchableOpacity
                                style={styles.gridItem}
                                activeOpacity={0.85}
                                onPress={() => handleItemPress(item, index)}
                            >
                                <SecureImage
                                    source={item.thumbnail_url || item.stream_url}
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
                                        <SFSymbol name="heart" size={13} color="#FF375F" focused />
                                    </View>
                                )}

                                {isSelectMode && (
                                    <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
                                        {isSelected && (
                                            <SFSymbol name="checkmark" size={12} color="#ffffff" weight="bold" />
                                        )}
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
                            tintColor="#0A84FF"
                        />
                    }
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <SFSymbol name="photos" size={54} color="#8E8E93" />
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
                    <TouchableOpacity style={styles.barActionBtn} onPress={handleBatchDelete} activeOpacity={0.7}>
                        <SFSymbol name="trash" size={18} color="#FF453A" />
                        <Text style={styles.barDangerText}>Hapus</Text>
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

            {/* Isolated Vault Sync Modal */}
            <VaultSyncModal
                visible={syncModalVisible}
                onClose={() => setSyncModalVisible(false)}
                onSyncCompleted={() => fetchMedia(1, true)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 52 : 44,
        paddingBottom: 10,
        paddingHorizontal: 16,
        backgroundColor: '#000000',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: -0.6,
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 2,
        fontWeight: '400',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    selectBtn: {
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    selectBtnText: {
        color: '#0A84FF',
        fontWeight: '600',
        fontSize: 17,
        letterSpacing: -0.3,
    },
    uploadPlusBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    syncHeaderBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(10, 132, 255, 0.14)',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    syncBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#30D158',
        borderRadius: 9,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#000000',
    },
    syncBadgeText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '700',
    },
    segmentedFilterContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(118, 118, 128, 0.24)',
        borderRadius: 9,
        padding: 2,
        marginTop: 4,
    },
    segmentedTab: {
        flex: 1,
        paddingVertical: 5,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 7,
    },
    segmentedTabActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
    },
    segmentedLabel: {
        color: '#8E8E93',
        fontSize: 12,
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    segmentedLabelActive: {
        color: '#ffffff',
        fontWeight: '600',
    },
    listContent: {
        paddingBottom: 110,
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
        bottom: 5,
        left: 5,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    videoBadgeText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    favBadge: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        borderRadius: 10,
        padding: 3,
    },
    checkCircle: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.8,
        borderColor: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkCircleActive: {
        backgroundColor: '#0A84FF',
        borderColor: '#0A84FF',
    },
    centerLoader: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#8E8E93',
        marginTop: 10,
        fontSize: 13,
    },
    emptyWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 120,
        paddingHorizontal: 30,
    },
    emptyTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 16,
        marginBottom: 6,
        letterSpacing: -0.3,
    },
    emptyDesc: {
        color: '#8E8E93',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
    },
    floatingSelectBar: {
        position: 'absolute',
        bottom: 75,
        alignSelf: 'center',
        width: '88%',
        backgroundColor: 'rgba(30, 30, 35, 0.95)',
        borderRadius: 22,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.16)',
        elevation: 8,
    },
    selectCountText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 14,
    },
    barActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    barDangerText: {
        color: '#FF453A',
        fontWeight: '600',
        fontSize: 14,
    },
    autoSyncPillOuter: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 56 : 46,
        alignSelf: 'center',
        zIndex: 9999,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 10,
    },
    autoSyncPillInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(30, 30, 32, 0.94)',
    },
    autoSyncPillText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
});
