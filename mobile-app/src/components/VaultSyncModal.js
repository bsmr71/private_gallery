import React, { useState, useEffect, useCallback } from 'react';
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
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import SFSymbol from './SFSymbol';
import { SyncService } from '../services/syncService';
import { StorageService } from '../services/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB_SIZE = (SCREEN_WIDTH - 64) / 4;

export default function VaultSyncModal({ visible, onClose, onSyncCompleted }) {
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0 });

    const [vaultFolder, setVaultFolder] = useState('PrivateVault');
    const [pendingAssets, setPendingAssets] = useState([]);
    const [deviceAlbums, setDeviceAlbums] = useState([]);
    const [showAlbumPicker, setShowAlbumPicker] = useState(false);

    // Settings
    const [autoDelete, setAutoDelete] = useState(true);
    const [autoSyncOnOpen, setAutoSyncOnOpen] = useState(false);

    const loadSyncData = useCallback(async () => {
        try {
            setLoading(true);
            const folder = await StorageService.getVaultFolderName();
            const del = await StorageService.getAutoDeleteLocal();
            const autoSync = await StorageService.getAutoSyncOnOpen();

            setVaultFolder(folder);
            setAutoDelete(del);
            setAutoSyncOnOpen(autoSync);

            // Request permission & read pending assets
            const hasPerm = await SyncService.requestPermissions();
            if (hasPerm) {
                const { assets } = await SyncService.getPendingVaultAssets(folder);
                setPendingAssets(assets);

                const albums = await SyncService.getDeviceAlbums();
                setDeviceAlbums(albums);
            }
        } catch (e) {
            console.warn('Error loading sync data:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (visible) {
            loadSyncData();
        }
    }, [visible, loadSyncData]);

    const handleToggleAutoDelete = async (val) => {
        setAutoDelete(val);
        await StorageService.setAutoDeleteLocal(val);
    };

    const handleToggleAutoSync = async (val) => {
        setAutoSyncOnOpen(val);
        await StorageService.setAutoSyncOnOpen(val);
    };

    const handleSelectAlbum = async (albumTitle) => {
        setVaultFolder(albumTitle);
        await StorageService.setVaultFolderName(albumTitle);
        setShowAlbumPicker(false);
        setLoading(true);
        const { assets } = await SyncService.getPendingVaultAssets(albumTitle);
        setPendingAssets(assets);
        setLoading(false);
    };

    const handlePickManualImages = async () => {
        try {
            const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images', 'videos'],
                allowsMultipleSelection: true,
                selectionLimit: 20,
                quality: 1,
            });

            if (!res.canceled && res.assets && res.assets.length > 0) {
                const picked = res.assets.map((a, idx) => ({
                    id: `manual_${Date.now()}_${idx}`,
                    uri: a.uri,
                    filename: a.fileName || `manual_${Date.now()}_${idx}.${a.type === 'video' ? 'mp4' : 'jpg'}`,
                    mediaType: a.type === 'video' ? 'video' : 'photo',
                }));

                // Append to current pending queue
                setPendingAssets((prev) => [...picked, ...prev]);
            }
        } catch (e) {
            Alert.alert('Gagal', 'Tidak dapat membuka galeri untuk memilih foto.');
        }
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
                `${res.successCount} berkas berhasil dienkripsi dan diamankan di Google Drive.${
                    res.deletedCount > 0 ? `\n\n🗑️ ${res.deletedCount} file lokal telah dibersihkan dari HP.` : ''
                }`,
                [{ text: 'OK' }]
            );

            // Reload pending and notify parent
            loadSyncData();
            onSyncCompleted && onSyncCompleted();
        } catch (err) {
            Alert.alert('Error', err.message || 'Terjadi kesalahan saat sinkronisasi');
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
                    {/* Header */}
                    <View style={styles.handle} />
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
                        {/* Vault Folder Selector Card */}
                        <View style={styles.card}>
                            <View style={styles.folderRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.cardLabel}>FOLDER PENAMPUNG DI HP</Text>
                                    <Text style={styles.folderName} numberOfLines={1}>
                                        📁 {vaultFolder}
                                    </Text>
                                    <Text style={styles.folderSubtitle}>
                                        Hanya foto di dalam folder ini yang akan dipantau &amp; diamankan.
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.changeFolderBtn}
                                    onPress={() => setShowAlbumPicker((prev) => !prev)}
                                    disabled={syncing}
                                >
                                    <Text style={styles.changeFolderText}>
                                        {showAlbumPicker ? 'Tutup' : 'Ganti'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Album Dropdown Selector */}
                            {showAlbumPicker && (
                                <View style={styles.albumPickerContainer}>
                                    <Text style={styles.pickerTitle}>Pilih Folder di Ponsel Anda:</Text>
                                    {deviceAlbums.length === 0 ? (
                                        <Text style={styles.pickerEmpty}>Tidak ada album terdeteksi.</Text>
                                    ) : (
                                        deviceAlbums.slice(0, 8).map((album) => (
                                            <TouchableOpacity
                                                key={album.id}
                                                style={[
                                                    styles.albumOption,
                                                    vaultFolder.toLowerCase() === album.title.toLowerCase() && styles.albumOptionActive,
                                                ]}
                                                onPress={() => handleSelectAlbum(album.title)}
                                            >
                                                <Text style={styles.albumOptionText}>
                                                    {album.title} ({album.assetCount})
                                                </Text>
                                                {vaultFolder.toLowerCase() === album.title.toLowerCase() && (
                                                    <SFSymbol name="checkmark" size={14} color="#0A84FF" />
                                                )}
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </View>
                            )}
                        </View>

                        {/* Pending Items Preview */}
                        <View style={styles.card}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.cardLabel}>
                                    FOTO MENGANTRE ({pendingAssets.length})
                                </Text>
                                <TouchableOpacity
                                    onPress={handlePickManualImages}
                                    disabled={syncing}
                                    style={styles.addMoreBtn}
                                >
                                    <SFSymbol name="plus" size={13} color="#0A84FF" style={{ marginRight: 4 }} />
                                    <Text style={styles.addMoreText}>Pilih Foto</Text>
                                </TouchableOpacity>
                            </View>

                            {loading ? (
                                <ActivityIndicator size="small" color="#0A84FF" style={{ marginVertical: 20 }} />
                            ) : pendingAssets.length === 0 ? (
                                <View style={styles.emptyPending}>
                                    <SFSymbol name="cloud.checkmark" size={32} color="#30D158" />
                                    <Text style={styles.emptyPendingTitle}>Semua Foto Sudah Aman</Text>
                                    <Text style={styles.emptyPendingDesc}>
                                        Tidak ada foto yang mengantre di folder {vaultFolder}.
                                    </Text>
                                </View>
                            ) : (
                                <FlatList
                                    data={pendingAssets}
                                    keyExtractor={(item) => String(item.id)}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.thumbList}
                                    renderItem={({ item }) => (
                                        <View style={styles.thumbWrap}>
                                            <Image source={{ uri: item.uri }} style={styles.thumbImage} resizeMode="cover" />
                                            {item.mediaType === 'video' && (
                                                <View style={styles.videoBadge}>
                                                    <SFSymbol name="play.fill" size={7} color="#ffffff" />
                                                </View>
                                            )}
                                        </View>
                                    )}
                                />
                            )}
                        </View>

                        {/* Security Toggles (Apple Inset Grouped) */}
                        <View style={styles.card}>
                            <Text style={styles.cardLabel}>PENGATURAN PRIVASI &amp; KEAMANAN</Text>

                            {/* Auto Delete Toggle */}
                            <View style={styles.toggleRow}>
                                <View style={{ flex: 1, marginRight: 12 }}>
                                    <Text style={styles.toggleTitle}>Hapus dari HP Setelah Backup</Text>
                                    <Text style={styles.toggleDesc}>
                                        Menghapus berkas asli dari galeri HP setelah terenkripsi di cloud agar tidak ada jejak (Zero Footprint).
                                    </Text>
                                </View>
                                <Switch
                                    value={autoDelete}
                                    onValueChange={handleToggleAutoDelete}
                                    trackColor={{ false: '#3a3a3c', true: '#30D158' }}
                                    thumbColor="#ffffff"
                                    disabled={syncing}
                                />
                            </View>

                            <View style={styles.divider} />

                            {/* Auto Sync Toggle */}
                            <View style={styles.toggleRow}>
                                <View style={{ flex: 1, marginRight: 12 }}>
                                    <Text style={styles.toggleTitle}>Auto-Sync Saat Buka Aplikasi</Text>
                                    <Text style={styles.toggleDesc}>
                                        Otomatis amankan foto baru dari folder saat Private Gallery dibuka.
                                    </Text>
                                </View>
                                <Switch
                                    value={autoSyncOnOpen}
                                    onValueChange={handleToggleAutoSync}
                                    trackColor={{ false: '#3a3a3c', true: '#0A84FF' }}
                                    thumbColor="#ffffff"
                                    disabled={syncing}
                                />
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
                                        : 'Tidak Ada Foto untuk Di-Sync'}
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
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
        marginBottom: 6,
    },
    folderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    folderName: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '700',
        marginTop: 2,
    },
    folderSubtitle: {
        color: '#8E8E93',
        fontSize: 12,
        marginTop: 4,
        lineHeight: 16,
    },
    changeFolderBtn: {
        backgroundColor: 'rgba(10, 132, 255, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
    },
    changeFolderText: {
        color: '#0A84FF',
        fontSize: 13,
        fontWeight: '600',
    },
    albumPickerContainer: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    pickerTitle: {
        color: '#cbd5e1',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
    },
    pickerEmpty: {
        color: '#8E8E93',
        fontSize: 12,
        fontStyle: 'italic',
    },
    albumOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 9,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    albumOptionActive: {
        backgroundColor: 'rgba(10, 132, 255, 0.15)',
    },
    albumOptionText: {
        color: '#ffffff',
        fontSize: 14,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
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
    emptyPending: {
        alignItems: 'center',
        paddingVertical: 18,
    },
    emptyPendingTitle: {
        color: '#30D158',
        fontSize: 15,
        fontWeight: '600',
        marginTop: 8,
    },
    emptyPendingDesc: {
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
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    toggleTitle: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
    toggleDesc: {
        color: '#8E8E93',
        fontSize: 12,
        lineHeight: 16,
        marginTop: 2,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        marginVertical: 4,
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
