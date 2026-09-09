import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Modal,
    AppState,
    SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { THEME } from '../constants/theme';
import { ApiService } from '../services/api';
import SecureImage from '../components/SecureImage';
import SFSymbol from '../components/SFSymbol';
import PhotoViewerModal from '../components/PhotoViewerModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_MARGIN = 1.5;
const ITEM_SIZE = (SCREEN_WIDTH - ITEM_MARGIN * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

export default function SecureVaultScreen({ visible, vaultToken, onClose }) {
    const insets = useSafeAreaInsets();
    const [mediaItems, setMediaItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // Lightbox
    const [viewerVisible, setViewerVisible] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(0);

    // Multi-select
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [actionLoading, setActionLoading] = useState(false);

    // Auto-lock when app goes to background
    useEffect(() => {
        if (!visible) return;

        const sub = AppState.addEventListener('change', (nextState) => {
            if (nextState.match(/inactive|background/)) {
                onClose && onClose();
            }
        });

        return () => sub.remove();
    }, [visible, onClose]);

    const fetchVaultMedia = useCallback(async (pageNum = 1) => {
        if (!vaultToken) return;
        try {
            const res = await ApiService.getVaultMedia(vaultToken, pageNum);
            if (res.success) {
                if (pageNum === 1) {
                    setMediaItems(res.data);
                } else {
                    setMediaItems((prev) => [...prev, ...res.data]);
                }
                setHasMore(res.pagination.current_page < res.pagination.last_page);
                setPage(pageNum);
            }
        } catch (err) {
            if (err.data?.session_expired) {
                Alert.alert('Sesi Berakhir', 'Sesi brankas telah kedaluwarsa demi keamanan.');
                onClose && onClose();
            } else {
                console.warn('Vault fetch error', err);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [vaultToken, onClose]);

    useEffect(() => {
        if (visible && vaultToken) {
            setLoading(true);
            setIsSelectMode(false);
            setSelectedIds([]);
            fetchVaultMedia(1);
        }
    }, [visible, vaultToken, fetchVaultMedia]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchVaultMedia(1);
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            fetchVaultMedia(page + 1);
        }
    };

    const handleToggleSelect = (id) => {
        setSelectedIds((prev) => {
            const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
            if (next.length === 0) {
                setIsSelectMode(false);
            }
            return next;
        });
    };

    const handleToggleSelectAll = () => {
        if (selectedIds.length === mediaItems.length && mediaItems.length > 0) {
            setSelectedIds([]);
            setIsSelectMode(false);
        } else {
            setSelectedIds(mediaItems.map((m) => m.id));
        }
    };

    const handleUnlockSelected = async () => {
        if (selectedIds.length === 0) return;

        Alert.alert(
            'Keluarkan dari Brankas?',
            `Pindahkan ${selectedIds.length} foto/video kembali ke galeri utama?`,
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Keluarkan',
                    onPress: async () => {
                        setActionLoading(true);
                        try {
                            const res = await ApiService.unlockMediaFromVault(vaultToken, selectedIds);
                            if (res.success) {
                                Alert.alert('Berhasil', res.message);
                                setMediaItems((prev) => prev.filter((m) => !selectedIds.includes(m.id)));
                                setSelectedIds([]);
                                setIsSelectMode(false);
                            }
                        } catch (err) {
                            Alert.alert('Gagal', err.message || 'Tidak dapat memindahkan media.');
                        } finally {
                            setActionLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const handleUploadToVault = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Izin Ditolak', 'Izin akses galeri diperlukan untuk mengunggah.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                allowsMultipleSelection: true,
                quality: 1,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setActionLoading(true);
                let uploadCount = 0;

                for (const asset of result.assets) {
                    try {
                        const filename = asset.fileName || asset.uri.split('/').pop() || 'secure_upload.jpg';
                        const mimeType = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');

                        const uploadRes = await ApiService.uploadMedia(
                            asset.uri,
                            filename,
                            mimeType,
                            null,
                            filename
                        );

                        if (uploadRes.success && uploadRes.data?.id) {
                            // Immediately lock to vault
                            await ApiService.lockMediaToVault([uploadRes.data.id]);
                            uploadCount++;
                        }
                    } catch (e) {
                        console.warn('Upload error', e);
                    }
                }

                Alert.alert('Selesai', `${uploadCount} foto/video berhasil diunggah langsung ke Brankas Terkunci.`);
                fetchVaultMedia(1);
            }
        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.headerTop}>
                <TouchableOpacity
                    style={styles.lockCloseBtn}
                    onPress={onClose}
                    activeOpacity={0.7}
                >
                    <SFSymbol name="lock.fill" size={15} color="#FF9F0A" style={{ marginRight: 6 }} />
                    <Text style={styles.lockCloseText}>Kunci & Tutup</Text>
                </TouchableOpacity>

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
                                {isSelectMode ? 'Batal' : 'Pilih'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.addBtn}
                        onPress={handleUploadToVault}
                        activeOpacity={0.7}
                    >
                        <SFSymbol name="plus" size={18} color="#0A84FF" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.titleBox}>
                <Text style={styles.title}>Brankas Terkunci</Text>
                <Text style={styles.subtitle}>
                    {mediaItems.length} foto & video terenkripsi • Terproteksi Password & OTP
                </Text>
            </View>
        </View>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.container}>
                {renderHeader()}

                {loading ? (
                    <View style={styles.centerBox}>
                        <ActivityIndicator size="large" color="#FF9F0A" />
                        <Text style={styles.loadingText}>Membuka berkas terenkripsi...</Text>
                    </View>
                ) : mediaItems.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <View style={styles.emptyIconCircle}>
                            <SFSymbol name="lock.shield" size={44} color="#FF9F0A" />
                        </View>
                        <Text style={styles.emptyTitle}>Brankas Masih Kosong</Text>
                        <Text style={styles.emptyDesc}>
                            Media sensitif yang Anda simpan di sini tersembunyi sepenuhnya dari galeri utama dan hanya bisa dibuka dengan Password & OTP.
                        </Text>
                        <TouchableOpacity
                            style={styles.emptyAddBtn}
                            onPress={handleUploadToVault}
                            activeOpacity={0.8}
                        >
                            <SFSymbol name="plus" size={15} color="#000000" style={{ marginRight: 6 }} />
                            <Text style={styles.emptyAddText}>Tambah Foto ke Brankas</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={mediaItems}
                        keyExtractor={(item) => String(item.id)}
                        numColumns={COLUMN_COUNT}
                        contentContainerStyle={styles.gridContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF9F0A" />
                        }
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={0.5}
                        renderItem={({ item, index }) => {
                            const isSelected = selectedIds.includes(item.id);

                            return (
                                <TouchableOpacity
                                    style={styles.gridItem}
                                    activeOpacity={0.8}
                                    onPress={() => {
                                        if (isSelectMode) {
                                            handleToggleSelect(item.id);
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
                                            handleToggleSelect(item.id);
                                        }
                                    }}
                                    delayLongPress={220}
                                >
                                    <SecureImage
                                        source={item.thumbnail_url}
                                        style={styles.thumbImage}
                                        resizeMode="cover"
                                    />

                                    {isSelected && <View style={styles.selectedOverlay} />}

                                    {item.type === 'video' && (
                                        <View style={styles.videoBadge}>
                                            <SFSymbol name="play.fill" size={10} color="#ffffff" />
                                        </View>
                                    )}

                                    {isSelectMode && (
                                        <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
                                            {isSelected && <SFSymbol name="checkmark" size={12} color="#ffffff" />}
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        }}
                    />
                )}

                {/* Floating Multi-Select Action Bar */}
                {isSelectMode && (
                    <View style={[styles.floatingBar, { bottom: Math.max(insets.bottom, 20) + 12 }]}>
                        <View style={styles.floatingBarLeft}>
                            <TouchableOpacity
                                style={styles.selectToggleBtn}
                                onPress={handleToggleSelectAll}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.selectToggleText}>
                                    {selectedIds.length === mediaItems.length && mediaItems.length > 0
                                        ? 'Batal Semua'
                                        : 'Pilih Semua'}
                                </Text>
                            </TouchableOpacity>
                            <Text style={styles.floatingCount}>{selectedIds.length} Dipilih</Text>
                        </View>

                        <View style={styles.floatingBarRight}>
                            {selectedIds.length > 0 && (
                                <TouchableOpacity
                                    style={styles.unlockActionBtn}
                                    onPress={handleUnlockSelected}
                                    disabled={actionLoading}
                                    activeOpacity={0.8}
                                >
                                    {actionLoading ? (
                                        <ActivityIndicator size="small" color="#ffffff" />
                                    ) : (
                                        <>
                                            <SFSymbol name="lock.open.fill" size={13} color="#ffffff" style={{ marginRight: 5 }} />
                                            <Text style={styles.unlockActionText}>Keluarkan</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={styles.doneBtn}
                                onPress={() => {
                                    setIsSelectMode(false);
                                    setSelectedIds([]);
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.doneBtnText}>Selesai</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Lightbox Viewer */}
                <PhotoViewerModal
                    visible={viewerVisible}
                    items={mediaItems}
                    initialIndex={selectedIdx}
                    onClose={() => setViewerVisible(false)}
                    onMediaDeleted={(deletedId) => {
                        setMediaItems((prev) => prev.filter((m) => m.id !== deletedId));
                    }}
                />
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    lockCloseBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(255, 159, 10, 0.15)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 159, 10, 0.3)',
    },
    lockCloseText: {
        color: '#FF9F0A',
        fontSize: 13,
        fontWeight: '700',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    selectBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    selectBtnText: {
        color: '#0A84FF',
        fontSize: 15,
        fontWeight: '600',
    },
    addBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#1c1c1e',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    titleBox: {
        marginTop: 4,
    },
    title: {
        color: '#ffffff',
        fontSize: 26,
        fontWeight: '800',
        letterSpacing: -0.4,
    },
    subtitle: {
        color: '#98989f',
        fontSize: 13,
        marginTop: 4,
    },
    centerBox: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#8E8E93',
        fontSize: 13,
        marginTop: 12,
    },
    emptyBox: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 159, 10, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 159, 10, 0.25)',
    },
    emptyTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyDesc: {
        color: '#8E8E93',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: 24,
    },
    emptyAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FF9F0A',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 14,
    },
    emptyAddText: {
        color: '#000000',
        fontSize: 14,
        fontWeight: '700',
    },
    gridContent: {
        paddingHorizontal: 2,
        paddingTop: 8,
        paddingBottom: 110,
    },
    gridItem: {
        width: ITEM_SIZE,
        height: ITEM_SIZE,
        margin: ITEM_MARGIN,
        backgroundColor: '#121214',
        position: 'relative',
    },
    selectedOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 159, 10, 0.22)',
        borderWidth: 2.5,
        borderColor: '#FF9F0A',
        zIndex: 2,
    },
    thumbImage: {
        width: '100%',
        height: '100%',
    },
    videoBadge: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        borderRadius: 4,
        padding: 4,
    },
    checkCircle: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: '#ffffff',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkCircleActive: {
        backgroundColor: '#0A84FF',
        borderColor: '#0A84FF',
    },
    floatingBar: {
        position: 'absolute',
        left: 16,
        right: 16,
        backgroundColor: 'rgba(28, 28, 32, 0.96)',
        borderRadius: 18,
        paddingVertical: 10,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
        color: '#FF9F0A',
        fontSize: 12,
        fontWeight: '600',
    },
    floatingCount: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
    },
    floatingBarRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    unlockActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FF9F0A',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    unlockActionText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
    },
    doneBtn: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 8,
    },
    doneBtnText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '600',
    },
});
