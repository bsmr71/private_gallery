import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Alert,
    Dimensions,
    ScrollView,
    RefreshControl,
} from 'react-native';
import SFSymbol from './SFSymbol';
import SecureImage from './SecureImage';
import { ApiService } from '../services/api';
import { THEME } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_ITEM_WIDTH = (SCREEN_WIDTH - 64) / 2;

export default function DuplicatesModal({ visible, onClose, onDuplicatesMerged }) {
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [duplicateData, setDuplicateData] = useState({
        duplicate_groups_count: 0,
        total_duplicate_copies: 0,
        formatted_total_wasted: '0 B',
        groups: [],
    });
    const [mergingKey, setMergingKey] = useState(null);
    const [mergingAll, setMergingAll] = useState(false);

    const loadDuplicates = useCallback(async (isRefresh = false) => {
        try {
            if (!isRefresh) setLoading(true);
            const res = await ApiService.getDuplicates();
            if (res.success) {
                setDuplicateData(res);
            }
        } catch (e) {
            console.warn('Load duplicates error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (visible) {
            loadDuplicates();
        }
    }, [visible, loadDuplicates]);

    const handleMergeGroup = (group) => {
        const copyCount = group.items.length;
        const deleteCount = copyCount - 1;

        Alert.alert(
            `Gabungkan ${copyCount} Salinan Tepat?`,
            `1 foto/video primer akan dipertahankan, dan ${deleteCount} salinan ganda akan dihapus permanen dari Google Drive untuk menghemat ruang.`,
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: `Gabungkan (${group.formatted_wasted} hemat)`,
                    style: 'default',
                    onPress: async () => {
                        setMergingKey(group.group_key);
                        try {
                            const duplicateIds = group.items
                                .filter((m) => m.id !== group.keeper_id)
                                .map((m) => m.id);

                            const res = await ApiService.mergeDuplicates(group.keeper_id, duplicateIds);
                            if (res.success) {
                                Alert.alert('Berhasil Digabungkan', `${res.message}\nRuang hemat: ${res.formatted_freed}`);
                                loadDuplicates(true);
                                onDuplicatesMerged && onDuplicatesMerged();
                            }
                        } catch (err) {
                            Alert.alert('Gagal Menggabungkan', err.message || 'Terjadi kendala saat menggabungkan salinan');
                        } finally {
                            setMergingKey(null);
                        }
                    },
                },
            ]
        );
    };

    const handleMergeAll = () => {
        const totalCopies = duplicateData.total_duplicate_copies;
        if (totalCopies === 0) return;

        Alert.alert(
            `Gabungkan Semua ${duplicateData.duplicate_groups_count} Kelompok Duplikat?`,
            `Sebanyak ${totalCopies} file salinan berlebih akan dibersihkan dari Google Drive. Ruang penyimpanan yang akan dihemat: ${duplicateData.formatted_total_wasted}.`,
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Gabungkan Semua',
                    style: 'destructive',
                    onPress: async () => {
                        setMergingAll(true);
                        try {
                            const res = await ApiService.mergeAllDuplicates();
                            if (res.success) {
                                Alert.alert('Pembersihan Selesai', `${res.message}\nTotal ruang dihemat: ${res.formatted_freed}`);
                                loadDuplicates(true);
                                onDuplicatesMerged && onDuplicatesMerged();
                            }
                        } catch (err) {
                            Alert.alert('Gagal', err.message || 'Terjadi kendala saat menggabungkan semua duplikat');
                        } finally {
                            setMergingAll(false);
                        }
                    },
                },
            ]
        );
    };

    const handleDeleteSingle = (item) => {
        Alert.alert(
            'Hapus Salinan Ini?',
            `Apakah Anda yakin ingin menghapus salinan "${item.title || item.original_filename}" dari Google Drive?`,
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Hapus Salinan',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await ApiService.deleteDuplicate(item.id);
                            if (res.success) {
                                loadDuplicates(true);
                                onDuplicatesMerged && onDuplicatesMerged();
                            }
                        } catch (err) {
                            Alert.alert('Gagal', err.message || 'Tidak dapat menghapus salinan');
                        }
                    },
                },
            ]
        );
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={[styles.container, { paddingTop: Math.max(insets.top, 14) }]}>
                {/* Header (Apple Photos Style) */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.closeBtn}
                        onPress={onClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <SFSymbol name="xmark.circle.fill" size={28} color="#48484A" />
                    </TouchableOpacity>

                    <View style={styles.headerTitleCenter}>
                        <Text style={styles.headerTitle}>Duplikat</Text>
                        {duplicateData.duplicate_groups_count > 0 && (
                            <Text style={styles.headerSubtitle}>
                                {duplicateData.duplicate_groups_count} Kelompok • Hemat {duplicateData.formatted_total_wasted}
                            </Text>
                        )}
                    </View>

                    {duplicateData.duplicate_groups_count > 0 ? (
                        <TouchableOpacity
                            style={styles.mergeAllBtn}
                            onPress={handleMergeAll}
                            disabled={mergingAll}
                            activeOpacity={0.7}
                        >
                            {mergingAll ? (
                                <ActivityIndicator size="small" color="#0A84FF" />
                            ) : (
                                <Text style={styles.mergeAllBtnText}>Gabung Semua</Text>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <View style={{ width: 44 }} />
                    )}
                </View>

                {loading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color="#0A84FF" />
                        <Text style={styles.loadingText}>Memindai foto &amp; video duplikat...</Text>
                    </View>
                ) : duplicateData.duplicate_groups_count === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconCircle}>
                            <SFSymbol name="square.on.square" size={46} color="#30D158" />
                        </View>
                        <Text style={styles.emptyTitle}>Tidak Ada Duplikat</Text>
                        <Text style={styles.emptyDesc}>
                            Semua foto dan video di galeri Anda unik. Ketika ada file yang terunggah ganda, file tersebut akan otomatis terdeteksi di sini.
                        </Text>
                    </View>
                ) : (
                    <FlatList
                        data={duplicateData.groups}
                        keyExtractor={(item) => item.group_key}
                        contentContainerStyle={[
                            styles.listContent,
                            { paddingBottom: Math.max(insets.bottom, 20) + 32 },
                        ]}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => loadDuplicates(true)}
                                tintColor="#0A84FF"
                            />
                        }
                        renderItem={({ item: group }) => {
                            const isThisMerging = mergingKey === group.group_key;
                            return (
                                <View style={styles.groupCard}>
                                    {/* Group Header */}
                                    <View style={styles.groupHeaderRow}>
                                        <View style={{ flex: 1, marginRight: 10 }}>
                                            <Text style={styles.groupFilename} numberOfLines={1}>
                                                {group.filename}
                                            </Text>
                                            <Text style={styles.groupMeta}>
                                                {group.copy_count} Salinan • {group.formatted_size} per file • Hemat {group.formatted_wasted}
                                            </Text>
                                        </View>

                                        <TouchableOpacity
                                            style={styles.mergeGroupBtn}
                                            onPress={() => handleMergeGroup(group)}
                                            disabled={isThisMerging}
                                            activeOpacity={0.7}
                                        >
                                            {isThisMerging ? (
                                                <ActivityIndicator size="small" color="#0A84FF" />
                                            ) : (
                                                <Text style={styles.mergeGroupBtnText}>Gabungkan</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>

                                    {/* Horizontal Comparison of Copies */}
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.copiesRow}
                                    >
                                        {group.items.map((copyItem) => (
                                            <View key={copyItem.id} style={styles.copyCard}>
                                                <View style={styles.thumbWrapper}>
                                                    <SecureImage
                                                        source={copyItem.thumbnail_url || copyItem.stream_url}
                                                        style={styles.copyThumb}
                                                        resizeMode="cover"
                                                    />

                                                    {copyItem.is_keeper && (
                                                        <View style={styles.keeperBadge}>
                                                            <SFSymbol name="star.fill" size={10} color="#FFD60A" style={{ marginRight: 4 }} />
                                                            <Text style={styles.keeperBadgeText}>Dipertahankan</Text>
                                                        </View>
                                                    )}

                                                    {copyItem.type === 'video' && (
                                                        <View style={styles.videoBadge}>
                                                            <SFSymbol name="play.fill" size={8} color="#ffffff" />
                                                        </View>
                                                    )}
                                                </View>

                                                <View style={styles.copyDetails}>
                                                    <Text style={styles.copyDate} numberOfLines={1}>
                                                        {copyItem.formatted_date || copyItem.created_at?.slice(0, 10)}
                                                    </Text>
                                                    {copyItem.album_name ? (
                                                        <Text style={styles.copyAlbum} numberOfLines={1}>
                                                            📁 {copyItem.album_name}
                                                        </Text>
                                                    ) : (
                                                        <Text style={styles.copyAlbum} numberOfLines={1}>
                                                            Semua Foto
                                                        </Text>
                                                    )}

                                                    {!copyItem.is_keeper && (
                                                        <TouchableOpacity
                                                            style={styles.deleteSingleBtn}
                                                            onPress={() => handleDeleteSingle(copyItem)}
                                                            activeOpacity={0.7}
                                                        >
                                                            <SFSymbol name="trash" size={12} color="#FF453A" style={{ marginRight: 4 }} />
                                                            <Text style={styles.deleteSingleBtnText}>Hapus</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            </View>
                                        ))}
                                    </ScrollView>
                                </View>
                            );
                        }}
                    />
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    },
    closeBtn: {
        padding: 4,
    },
    headerTitleCenter: {
        alignItems: 'center',
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: -0.4,
    },
    headerSubtitle: {
        color: '#8E8E93',
        fontSize: 11,
        fontWeight: '500',
        marginTop: 2,
    },
    mergeAllBtn: {
        backgroundColor: 'rgba(10, 132, 255, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
    },
    mergeAllBtnText: {
        color: '#0A84FF',
        fontSize: 13,
        fontWeight: '600',
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    loadingText: {
        color: '#8E8E93',
        fontSize: 13,
        marginTop: 14,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 36,
    },
    emptyIconCircle: {
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: 'rgba(48, 209, 88, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
    },
    emptyTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.4,
        marginBottom: 8,
    },
    emptyDesc: {
        color: '#8E8E93',
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },
    listContent: {
        padding: 16,
    },
    groupCard: {
        backgroundColor: '#161618',
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    groupHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    groupFilename: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
    groupMeta: {
        color: '#8E8E93',
        fontSize: 11,
        marginTop: 2,
    },
    mergeGroupBtn: {
        backgroundColor: 'rgba(10, 132, 255, 0.2)',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(10, 132, 255, 0.4)',
    },
    mergeGroupBtnText: {
        color: '#0A84FF',
        fontSize: 12,
        fontWeight: '600',
    },
    copiesRow: {
        paddingTop: 2,
    },
    copyCard: {
        width: CARD_ITEM_WIDTH,
        marginRight: 12,
        backgroundColor: '#1F1F23',
        borderRadius: 12,
        overflow: 'hidden',
    },
    thumbWrapper: {
        width: '100%',
        height: CARD_ITEM_WIDTH,
        position: 'relative',
    },
    copyThumb: {
        width: '100%',
        height: '100%',
    },
    keeperBadge: {
        position: 'absolute',
        top: 6,
        left: 6,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
    },
    keeperBadgeText: {
        color: '#ffffff',
        fontSize: 9,
        fontWeight: '700',
    },
    videoBadge: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    copyDetails: {
        padding: 8,
    },
    copyDate: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '500',
    },
    copyAlbum: {
        color: '#8E8E93',
        fontSize: 10,
        marginTop: 2,
    },
    deleteSingleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 69, 58, 0.12)',
        paddingVertical: 4,
        borderRadius: 6,
        marginTop: 8,
    },
    deleteSingleBtnText: {
        color: '#FF453A',
        fontSize: 10,
        fontWeight: '600',
    },
});
