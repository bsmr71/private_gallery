import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    RefreshControl,
    Alert,
    Platform,
} from 'react-native';
import { THEME } from '../constants/theme';
import { ApiService } from '../services/api';
import PhotoViewerModal from '../components/PhotoViewerModal';
import SecureImage from '../components/SecureImage';
import SFSymbol from '../components/SFSymbol';
import { SecurityService, useDecoyMode, useAppLocked } from '../services/securityService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_MARGIN = 2;
const ITEM_SIZE = (SCREEN_WIDTH - ITEM_MARGIN * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

export default function FavoritesScreen() {
    const insets = useSafeAreaInsets();
    const isDecoy = useDecoyMode();
    const isLocked = useAppLocked();
    const [mediaItems, setMediaItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [viewerVisible, setViewerVisible] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(0);

    // Multi-Select state
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);

    const fetchFavorites = useCallback(async () => {
        if (SecurityService.isDecoyMode()) {
            setMediaItems([]);
            setLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            setLoading(true);
            const res = await ApiService.getMedia({ favorite: 1, per_page: 50 });
            if (res.success) {
                setMediaItems(res.data);
            }
        } catch (e) {
            console.warn('Fetch favorites error', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (!isDecoy) {
            fetchFavorites();
        } else {
            setMediaItems([]);
            setIsSelectMode(false);
            setSelectedIds([]);
            setViewerVisible(false);
        }
    }, [isDecoy, fetchFavorites]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchFavorites();
    };

    const toggleSelect = (id) => {
        setSelectedIds((prev) => {
            const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
            if (next.length === 0) {
                setIsSelectMode(false);
            }
            return next;
        });
    };

    const handleToggleSelectAll = () => {
        if (selectedIds.length === displayedItems.length && displayedItems.length > 0) {
            setSelectedIds([]);
            setIsSelectMode(false);
        } else {
            setSelectedIds(displayedItems.map((m) => m.id));
        }
    };

    const handleBatchRemoveFavorite = async () => {
        if (selectedIds.length === 0) return;
        Alert.alert(
            'Hapus dari Favorit?',
            `Hapus ${selectedIds.length} foto/video dari daftar Favorit?`,
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Hapus Favorit',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            for (const id of selectedIds) {
                                await ApiService.toggleFavorite(id);
                            }
                            setSelectedIds([]);
                            setIsSelectMode(false);
                            fetchFavorites();
                        } catch (e) {
                            Alert.alert('Gagal', 'Tidak dapat menghapus dari favorit');
                        }
                    },
                },
            ]
        );
    };

    const displayedItems = (isDecoy || isLocked) ? [] : mediaItems;

    if (isLocked) {
        return (
            <View style={styles.container}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }]} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Apple Photos Large Title Header */}
            <View style={[styles.header, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 48 : 36) }]}>
                <View style={styles.headerTopRow}>
                    <View>
                        <Text style={styles.screenTitle}>Favorit</Text>
                        <Text style={styles.subTitle}>
                            {displayedItems.length > 0
                                ? `${displayedItems.length} foto & video ditandai`
                                : 'Belum ada favorit'}
                        </Text>
                    </View>
                    {!isDecoy && displayedItems.length > 0 && (
                        <TouchableOpacity
                            style={styles.selectBtn}
                            onPress={() => {
                                setIsSelectMode(!isSelectMode);
                                setSelectedIds([]);
                            }}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        >
                            <Text style={styles.selectBtnText}>
                                {isSelectMode ? 'Selesai' : 'Pilih'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {loading ? (
                <View style={styles.centerLoader}>
                    <ActivityIndicator size="small" color="#0A84FF" />
                </View>
            ) : (
                <FlatList
                    data={displayedItems}
                    keyExtractor={(item) => String(item.id)}
                    numColumns={COLUMN_COUNT}
                    contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, 16) + 120 }]}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0A84FF" />
                    }
                    renderItem={({ item, index }) => {
                        const isSelected = selectedIds.includes(item.id);
                        return (
                            <TouchableOpacity
                                style={styles.gridItem}
                                activeOpacity={0.8}
                                onPress={() => {
                                    if (isSelectMode) {
                                        toggleSelect(item.id);
                                    } else {
                                        setSelectedIdx(index);
                                        setViewerVisible(true);
                                    }
                                }}
                                onLongPress={() => {
                                    if (!isSelectMode) {
                                        setIsSelectMode(true);
                                        setSelectedIds([item.id]);
                                    } else {
                                        toggleSelect(item.id);
                                    }
                                }}
                                delayLongPress={220}
                            >
                                <SecureImage
                                    source={item.thumbnail_url || item.stream_url}
                                    style={styles.itemImage}
                                    resizeMode="cover"
                                />

                                {isSelected && <View style={styles.selectedOverlay} />}

                                {item.type === 'video' && (
                                    <View style={styles.videoBadge}>
                                        <SFSymbol name="play.fill" size={8} color="#ffffff" />
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
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <View style={styles.emptyIconCircle}>
                                <SFSymbol name="heart" size={48} color="#48484a" />
                            </View>
                            <Text style={styles.emptyTitle}>Belum Ada Foto Favorit</Text>
                            <Text style={styles.emptyDesc}>
                                Ketuk ikon hati pada foto atau video untuk menambahkannya ke album Favorit Anda.
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Multi-Select Floating Action Bar (Floats safely above tab bar) */}
            {isSelectMode && (
                <View style={[styles.floatingSelectBar, { bottom: Math.max(insets.bottom, 16) + 64 }]}>
                    <View style={styles.floatingBarLeft}>
                        <TouchableOpacity
                            style={styles.selectToggleBtn}
                            onPress={handleToggleSelectAll}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        >
                            <Text style={styles.selectToggleText}>
                                {selectedIds.length === displayedItems.length && displayedItems.length > 0
                                    ? 'Batal Semua'
                                    : 'Pilih Semua'}
                            </Text>
                        </TouchableOpacity>
                        <Text style={styles.selectCountText}>{selectedIds.length} Dipilih</Text>
                    </View>

                    <View style={styles.floatingBarRight}>
                        {selectedIds.length > 0 && (
                            <TouchableOpacity
                                style={styles.barActionBtn}
                                onPress={handleBatchRemoveFavorite}
                                activeOpacity={0.7}
                                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                            >
                                <SFSymbol name="heart.slash" size={15} color="#FF375F" />
                                <Text style={[styles.barActionText, { color: '#FF375F' }]}>Hapus Favorit</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.barDoneBtn}
                            onPress={() => {
                                setIsSelectMode(false);
                                setSelectedIds([]);
                            }}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                        >
                            <Text style={styles.barDoneText}>Selesai</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <PhotoViewerModal
                visible={viewerVisible}
                items={mediaItems}
                initialIndex={selectedIdx}
                onClose={() => setViewerVisible(false)}
                onMediaUpdated={() => fetchFavorites()}
                onMediaDeleted={() => fetchFavorites()}
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
        paddingBottom: 12,
        paddingHorizontal: 20,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    screenTitle: {
        fontSize: 34,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: 0.38,
    },
    subTitle: {
        fontSize: 13,
        color: '#8E8E93',
        marginTop: 4,
    },
    selectBtn: {
        paddingVertical: 6,
        paddingHorizontal: 8,
    },
    selectBtnText: {
        color: '#0A84FF',
        fontWeight: '600',
        fontSize: 17,
        letterSpacing: -0.3,
    },
    listContent: {
        paddingBottom: 140,
    },
    gridItem: {
        width: ITEM_SIZE,
        height: ITEM_SIZE,
        marginRight: ITEM_MARGIN,
        marginBottom: ITEM_MARGIN,
        position: 'relative',
        backgroundColor: '#121214',
    },
    selectedOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10, 132, 255, 0.22)',
        borderWidth: 2.5,
        borderColor: '#0A84FF',
        zIndex: 2,
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
        zIndex: 5,
    },
    checkCircleActive: {
        backgroundColor: '#0A84FF',
        borderColor: '#0A84FF',
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
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerLoader: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
        paddingHorizontal: 36,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#1c1c1e',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
    },
    emptyDesc: {
        color: '#8E8E93',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    floatingSelectBar: {
        position: 'absolute',
        alignSelf: 'center',
        width: '92%',
        backgroundColor: 'rgba(28, 28, 34, 0.96)',
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.16)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 12,
        zIndex: 999,
    },
    floatingBarLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    selectToggleBtn: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
    },
    selectToggleText: {
        color: '#0A84FF',
        fontSize: 12,
        fontWeight: '600',
    },
    selectCountText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 13,
    },
    floatingBarRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    barActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 5,
        paddingHorizontal: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 8,
    },
    barActionText: {
        fontWeight: '600',
        fontSize: 12,
    },
    barDoneBtn: {
        paddingVertical: 5,
        paddingHorizontal: 10,
        backgroundColor: '#0A84FF',
        borderRadius: 8,
    },
    barDoneText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 12,
    },
});
