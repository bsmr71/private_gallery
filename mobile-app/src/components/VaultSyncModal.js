import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    Image,
    ActivityIndicator,
    Switch,
    Alert,
    Dimensions,
    ScrollView,
} from 'react-native';
import SFSymbol from './SFSymbol';
import { SyncService } from '../services/syncService';
import { StorageService } from '../services/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB_SIZE = (SCREEN_WIDTH - 72) / 4;

export default function VaultSyncModal({ visible, onClose, onSyncCompleted }) {
    const [syncing, setSyncing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0 });
    const [pendingAssets, setPendingAssets] = useState([]);
    const [autoDelete, setAutoDelete] = useState(true);

    const handlePickMedia = async () => {
        try {
            const picked = await SyncService.pickMediaFromDevice({ limit: 50 });
            if (picked.length > 0) {
                setPendingAssets((prev) => {
                    const existingUris = new Set(prev.map((p) => p.uri));
                    const newItems = picked.filter((p) => !existingUris.has(p.uri));
                    return [...prev, ...newItems];
                });
            }
        } catch (e) {
            Alert.alert('Gagal', 'Tidak dapat membuka galeri perangkat.');
        }
    };

    const handleRemoveItem = (index) => {
        setPendingAssets((prev) => prev.filter((_, i) => i !== index));
    };

    const handleClearQueue = () => {
        setPendingAssets([]);
    };

    const handleStartSync = async () => {
        if (pendingAssets.length === 0) return;

        setSyncing(true);
        setProgress({ current: 0, total: pendingAssets.length, percentage: 0 });

        try {
            const res = await SyncService.syncAssets(pendingAssets, {
                onProgress: (p) => setProgress(p),
            });

            Alert.alert(
                'Sinkronisasi Selesai',
                `${res.successCount} berkas berhasil dienkripsi dengan AES-256 dan diamankan di Google Drive.`,
                [{ text: 'OK' }]
            );

            setPendingAssets([]);
            onSyncCompleted && onSyncCompleted();
        } catch (err) {
            Alert.alert('Error', err.message || 'Terjadi kendala saat sinkronisasi');
        } finally {
            setSyncing(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    {/* Grab Handle */}
                    <View style={styles.handle} />

                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerTitleRow}>
                            <SFSymbol name="lock.fill" size={18} color="#0A84FF" style={{ marginRight: 8 }} />
                            <Text style={styles.headerTitle}>Isolated Vault Sync</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={onClose}
                            disabled={syncing}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <SFSymbol name="xmark" size={14} color="#8E8E93" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                        {/* Info Banner */}
                        <View style={styles.bannerCard}>
                            <SFSymbol name="cloud.arrow.up" size={26} color="#0A84FF" style={{ marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.bannerTitle}>Sinkronisasi Privat &amp; Terisolasi</Text>
                                <Text style={styles.bannerDesc}>
                                    Pilih foto atau video rahasia dari perangkat Anda untuk langsung dienkripsi AES-256 ke Google Drive tanpa tercecer di galeri publik.
                                </Text>
                            </View>
                        </View>

                        {/* Staged Queue Preview Card */}
                        <View style={styles.card}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.cardLabel}>
                                    ANTREAN DIAMANKAN ({pendingAssets.length})
                                </Text>
                                <View style={styles.actionLinks}>
                                    {pendingAssets.length > 0 && (
                                        <TouchableOpacity
                                            onPress={handleClearQueue}
                                            disabled={syncing}
                                            style={styles.clearBtn}
                                        >
                                            <Text style={styles.clearText}>Kosongkan</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        onPress={handlePickMedia}
                                        disabled={syncing}
                                        style={styles.addMoreBtn}
                                    >
                                        <SFSymbol name="plus" size={13} color="#0A84FF" style={{ marginRight: 4 }} />
                                        <Text style={styles.addMoreText}>Pilih Foto</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {pendingAssets.length === 0 ? (
                                <TouchableOpacity
                                    style={styles.pickDashedBox}
                                    onPress={handlePickMedia}
                                    activeOpacity={0.7}
                                    disabled={syncing}
                                >
                                    <SFSymbol name="photo.on.rectangle" size={32} color="#0A84FF" />
                                    <Text style={styles.pickDashedTitle}>Ketuk untuk Memilih Foto / Video</Text>
                                    <Text style={styles.pickDashedDesc}>
                                        Buka folder foto di ponsel untuk diamankan ke Vault.
                                    </Text>
                                </TouchableOpacity>
                            ) : (
                                <FlatList
                                    data={pendingAssets}
                                    keyExtractor={(item, idx) => `${item.id}_${idx}`}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.thumbList}
                                    renderItem={({ item, index }) => (
                                        <View style={styles.thumbWrap}>
                                            <Image source={{ uri: item.uri }} style={styles.thumbImage} resizeMode="cover" />
                                            {item.mediaType === 'video' && (
                                                <View style={styles.videoBadge}>
                                                    <SFSymbol name="play.fill" size={7} color="#ffffff" />
                                                </View>
                                            )}
                                            <TouchableOpacity
                                                style={styles.removeThumbBtn}
                                                onPress={() => handleRemoveItem(index)}
                                                disabled={syncing}
                                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                            >
                                                <SFSymbol name="xmark.circle.fill" size={16} color="#ffffff" />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                />
                            )}
                        </View>

                        {/* Security Info Card */}
                        <View style={styles.card}>
                            <Text style={styles.cardLabel}>STATUS ENKRIPSI &amp; PRIVASI</Text>
                            <View style={styles.securityRow}>
                                <SFSymbol name="lock.fill" size={16} color="#30D158" style={{ marginRight: 10 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.securityRowTitle}>Enkripsi Militer AES-256</Text>
                                    <Text style={styles.securityRowDesc}>
                                        Setiap berkas dienkripsi secara privat sebelum disimpan di Google Drive Cloud Storage.
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Sync Action Area */}
                        {syncing ? (
                            <View style={styles.syncingCard}>
                                <ActivityIndicator size="small" color="#0A84FF" style={{ marginBottom: 8 }} />
                                <Text style={styles.syncingTitle}>
                                    Mengenkripsi &amp; Mengunggah ({progress.current} dari {progress.total})
                                </Text>
                                <View style={styles.progressBarBg}>
                                    <View style={[styles.progressBarFill, { width: `${progress.percentage}%` }]} />
                                </View>
                                <Text style={styles.syncingSubtitle}>
                                    Terenkripsi biner AES-256 menuju Google Drive...
                                </Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[
                                    styles.syncBtn,
                                    pendingAssets.length === 0 && styles.syncBtnDisabled,
                                ]}
                                onPress={handleStartSync}
                                disabled={pendingAssets.length === 0}
                                activeOpacity={0.8}
                            >
                                <SFSymbol name="arrow.clockwise" size={17} color="#ffffff" style={{ marginRight: 8 }} />
                                <Text style={styles.syncBtnText}>
                                    {pendingAssets.length > 0
                                        ? `Amankan ${pendingAssets.length} Foto ke Cloud`
                                        : 'Pilih Foto Terlebih Dahulu'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#1c1c1e',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '88%',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    handle: {
        width: 36,
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 6,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
    },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#2c2c2e',
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    bannerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(10, 132, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(10, 132, 255, 0.22)',
        borderRadius: 16,
        padding: 14,
        marginBottom: 14,
    },
    bannerTitle: {
        color: '#0A84FF',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    },
    bannerDesc: {
        color: '#cbd5e1',
        fontSize: 12,
        lineHeight: 16,
    },
    card: {
        backgroundColor: '#2c2c2e',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
    },
    cardLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#8E8E93',
        letterSpacing: 0.5,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    actionLinks: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    clearBtn: {
        paddingVertical: 2,
        paddingHorizontal: 4,
    },
    clearText: {
        color: '#8E8E93',
        fontSize: 12,
    },
    addMoreBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 2,
        paddingHorizontal: 6,
    },
    addMoreText: {
        color: '#0A84FF',
        fontSize: 13,
        fontWeight: '600',
    },
    pickDashedBox: {
        borderWidth: 1.5,
        borderColor: 'rgba(10, 132, 255, 0.35)',
        borderStyle: 'dashed',
        borderRadius: 14,
        paddingVertical: 24,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(10, 132, 255, 0.04)',
    },
    pickDashedTitle: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 10,
    },
    pickDashedDesc: {
        color: '#8E8E93',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 4,
    },
    thumbList: {
        paddingVertical: 4,
        gap: 8,
    },
    thumbWrap: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: 10,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#1c1c1e',
    },
    thumbImage: {
        width: '100%',
        height: '100%',
    },
    videoBadge: {
        position: 'absolute',
        bottom: 3,
        right: 3,
        backgroundColor: 'rgba(0,0,0,0.65)',
        width: 14,
        height: 14,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
    },
    removeThumbBtn: {
        position: 'absolute',
        top: 2,
        right: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 8,
    },
    securityRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 8,
    },
    securityRowTitle: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
    },
    securityRowDesc: {
        color: '#8E8E93',
        fontSize: 12,
        lineHeight: 16,
        marginTop: 2,
    },
    syncingCard: {
        backgroundColor: 'rgba(10, 132, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(10, 132, 255, 0.25)',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
    },
    syncingTitle: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 8,
    },
    progressBarBg: {
        width: '100%',
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#0A84FF',
        borderRadius: 3,
    },
    syncingSubtitle: {
        color: '#8E8E93',
        fontSize: 12,
    },
    syncBtn: {
        backgroundColor: '#0A84FF',
        borderRadius: 14,
        paddingVertical: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    syncBtnDisabled: {
        backgroundColor: '#2c2c2e',
        opacity: 0.6,
    },
    syncBtnText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
});
