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
import SFSymbol from './SFSymbol';
import { SyncService } from '../services/syncService';
import { StorageService } from '../services/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB_SIZE = (SCREEN_WIDTH - 72) / 4;

export default function VaultSyncModal({ visible, onClose, onSyncCompleted }) {
    const insets = useSafeAreaInsets();
    const [loadingFolder, setLoadingFolder] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0 });

    const [folderName, setFolderName] = useState('Belum Ditentukan');
    const [hasFolderUri, setHasFolderUri] = useState(false);
    const [pendingAssets, setPendingAssets] = useState([]);
    const [autoDelete, setAutoDelete] = useState(true);
    const [autoSync, setAutoSync] = useState(true);
    const [stealthMode, setStealthMode] = useState(false);

    const loadAndScan = useCallback(async () => {
        try {
            setLoadingFolder(true);
            const name = await StorageService.getVaultFolderName();
            const uri = await StorageService.getVaultDirectoryUri();
            const del = await StorageService.getAutoDeleteLocal();
            const syncOnOpen = await StorageService.getAutoSyncEnabled();

            setFolderName(name);
            setHasFolderUri(!!uri);
            setAutoDelete(del);
            setAutoSync(syncOnOpen);

            if (uri) {
                // Auto scan the designated folder
                const scanned = await SyncService.scanVaultFolder();
                setPendingAssets(scanned);
            }
        } catch (e) {
            console.warn('Scan error:', e);
        } finally {
            setLoadingFolder(false);
        }
    }, []);

    useEffect(() => {
        if (visible) {
            loadAndScan();
        }
    }, [visible, loadAndScan]);

    const handleSelectFolder = async () => {
        try {
            const folder = await SyncService.selectVaultFolder();
            if (folder && !folder.cancelled) {
                setFolderName(folder.name);
                setHasFolderUri(true);
                // Scan folder right away
                setLoadingFolder(true);
                const scanned = await SyncService.scanVaultFolder();
                setPendingAssets(scanned);
                setLoadingFolder(false);
            }
        } catch (e) {
            console.error('[VaultSyncModal] Error selecting folder:', e);
            Alert.alert('Gagal Membuka Folder', e?.message || 'Tidak dapat membuka pemilih folder di perangkat Anda.');
        }
    };

    const handlePickAdditionalMedia = async () => {
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

    const handleToggleAutoDelete = async (val) => {
        setAutoDelete(val);
        await StorageService.setAutoDeleteLocal(val);
    };

    const handleToggleAutoSync = async (val) => {
        setAutoSync(val);
        await StorageService.setAutoSyncEnabled(val);
    };

    const handleRemoveItem = (index) => {
        setPendingAssets((prev) => prev.filter((_, i) => i !== index));
    };

    const handleStartSync = async () => {
        if (pendingAssets.length === 0) return;

        setSyncing(true);
        setProgress({ current: 0, total: pendingAssets.length, percentage: 0 });

        try {
            const res = await SyncService.syncAssets(pendingAssets, {
                onProgress: (p) => setProgress(p),
            });

            if (res.failCount > 0 && res.successCount === 0) {
                const detail = res.lastError ? `\n\nKendala: ${res.lastError}` : '\n\nPastikan koneksi internet stabil.';
                Alert.alert(
                    'Sinkronisasi Belum Berhasil',
                    `Gagal mengunggah ${res.failCount} berkas ke server.${detail}`,
                    [{ text: 'OK' }]
                );
            } else {
                Alert.alert(
                    'Sinkronisasi Selesai',
                    `${res.successCount} berkas berhasil dienkripsi AES-256 dan disimpan di Google Drive.${
                        res.failCount > 0 ? `\n⚠️ ${res.failCount} berkas gagal diunggah.` : ''
                    }${
                        res.deletedCount > 0 ? `\n\n🗑️ ${res.deletedCount} file lokal telah dibersihkan dari folder HP (Zero Footprint).` : ''
                    }`,
                    [{ text: 'OK' }]
                );
            }

            // Rescan folder
            loadAndScan();
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
                <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
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

                    <ScrollView
                        style={styles.body}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 36 }}
                    >
                        {/* 1 Designated Folder Selector Card */}
                        <View style={styles.card}>
                            <Text style={styles.cardLabel}>1 FOLDER KHUSUS DI HP</Text>
                            <View style={styles.folderRow}>
                                <View style={{ flex: 1, marginRight: 12 }}>
                                    <Text style={styles.folderName} numberOfLines={1}>
                                        📁 {folderName}
                                    </Text>
                                    <Text style={styles.folderSubtitle}>
                                        {hasFolderUri
                                            ? 'Folder ini dipantau secara otomatis. Foto di dalamnya siap di-sync.'
                                            : 'Tunjuk 1 folder di HP yang khusus Anda gunakan untuk menyimpan foto rahasia.'}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.changeFolderBtn}
                                    onPress={handleSelectFolder}
                                    disabled={syncing}
                                >
                                    <Text style={styles.changeFolderText}>
                                        {hasFolderUri ? 'Ganti' : 'Pilih Folder'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Staged Queue Preview Card */}
                        <View style={styles.card}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.cardLabel}>
                                    FOTO TERDETEKSI ({pendingAssets.length})
                                </Text>
                                <View style={styles.actionLinks}>
                                    {hasFolderUri && (
                                        <TouchableOpacity
                                            onPress={loadAndScan}
                                            disabled={syncing || loadingFolder}
                                            style={styles.rescanBtn}
                                        >
                                            <SFSymbol name="arrow.clockwise" size={12} color="#8E8E93" style={{ marginRight: 3 }} />
                                            <Text style={styles.rescanText}>Pindai Ulang</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        onPress={handlePickAdditionalMedia}
                                        disabled={syncing}
                                        style={styles.addMoreBtn}
                                    >
                                        <SFSymbol name="plus" size={13} color="#0A84FF" style={{ marginRight: 4 }} />
                                        <Text style={styles.addMoreText}>Pilih Manual</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {loadingFolder ? (
                                <ActivityIndicator size="small" color="#0A84FF" style={{ marginVertical: 24 }} />
                            ) : pendingAssets.length === 0 ? (
                                <View style={styles.emptyPending}>
                                    <SFSymbol name="cloud.checkmark" size={36} color="#30D158" />
                                    <Text style={styles.emptyPendingTitle}>Folder Vault Bersih</Text>
                                    <Text style={styles.emptyPendingDesc}>
                                        {hasFolderUri
                                            ? `Tidak ada foto baru di folder "${folderName}". Foto yang dimasukkan ke folder ini akan otomatis terdeteksi.`
                                            : 'Ketuk "Pilih Folder" di atas untuk menghubungkan 1 folder di ponsel Anda.'}
                                    </Text>
                                </View>
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

                        {/* Privacy & Zero Footprint Toggle */}
                        <View style={styles.card}>
                            <Text style={styles.cardLabel}>PENGATURAN KERAHASIAAN</Text>
                            <View style={styles.toggleRow}>
                                <View style={{ flex: 1, marginRight: 12 }}>
                                    <Text style={styles.toggleTitle}>Hapus dari Folder HP Setelah Backup</Text>
                                    <Text style={styles.toggleDesc}>
                                        Membersihkan file mentah di folder HP setelah berhasil dienkripsi di Google Drive agar tidak ada jejak fisik di ponsel (Zero Footprint).
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

                            {/* Auto-Sync Toggle */}
                            <View style={styles.toggleRow}>
                                <View style={{ flex: 1, marginRight: 12 }}>
                                    <Text style={styles.toggleTitle}>Auto-Sync Saat Buka Aplikasi</Text>
                                    <Text style={styles.toggleDesc}>
                                        Otomatis memindai dan mencadangkan foto baru saat Anda membuka atau beralih ke galeri tanpa perlu menekan tombol manual.
                                    </Text>
                                </View>
                                <Switch
                                    value={autoSync}
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

                                {/* Background Sync & Stealth Mode Action Buttons */}
                                <View style={styles.syncAuxRow}>
                                    <TouchableOpacity
                                        style={styles.auxBtn}
                                        onPress={() => setStealthMode(true)}
                                        activeOpacity={0.7}
                                    >
                                        <SFSymbol name="eye.slash.fill" size={14} color="#FF9F0A" style={{ marginRight: 6 }} />
                                        <Text style={styles.auxBtnTextAmber}>Layar Senyap (Stealth)</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.auxBtn}
                                        onPress={onClose}
                                        activeOpacity={0.7}
                                    >
                                        <SFSymbol name="arrow.down.right.and.arrow.up.left" size={13} color="#0A84FF" style={{ marginRight: 6 }} />
                                        <Text style={styles.auxBtnTextBlue}>Lanjut di Background</Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={styles.bgSyncHint}>
                                    🔒 Aman: Anda dapat beralih aplikasi atau mengunci HP, sinkronisasi tetap berjalan senyap di latar belakang.
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

            {/* Stealth Blackout Mode (Layar Hitam Senyap) */}
            <Modal visible={stealthMode} transparent={false} animationType="fade">
                <TouchableOpacity
                    style={styles.stealthBackdrop}
                    activeOpacity={1}
                    onPress={() => setStealthMode(false)}
                >
                    <View style={styles.stealthCenter}>
                        <View style={styles.stealthPulseDot} />
                        <Text style={styles.stealthProgressText}>{progress.percentage}%</Text>
                    </View>
                    <Text style={styles.stealthHintText}>Ketuk di mana saja untuk mengembalikan layar</Text>
                </TouchableOpacity>
            </Modal>
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
        paddingVertical: 7,
        borderRadius: 14,
    },
    changeFolderText: {
        color: '#0A84FF',
        fontSize: 13,
        fontWeight: '600',
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
    rescanBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 2,
        paddingHorizontal: 4,
    },
    rescanText: {
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
    emptyPending: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 16,
    },
    emptyPendingTitle: {
        color: '#30D158',
        fontSize: 15,
        fontWeight: '600',
        marginTop: 10,
    },
    emptyPendingDesc: {
        color: '#8E8E93',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 16,
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
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        marginVertical: 12,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
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
    syncAuxRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 14,
        marginBottom: 10,
        width: '100%',
        justifyContent: 'center',
    },
    auxBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2c2c2e',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    auxBtnTextAmber: {
        color: '#FF9F0A',
        fontSize: 12,
        fontWeight: '600',
    },
    auxBtnTextBlue: {
        color: '#0A84FF',
        fontSize: 12,
        fontWeight: '600',
    },
    bgSyncHint: {
        color: '#8E8E93',
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 16,
        marginTop: 6,
        paddingHorizontal: 8,
    },
    stealthBackdrop: {
        flex: 1,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    stealthCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        opacity: 0.35,
    },
    stealthPulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#30D158',
    },
    stealthProgressText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '500',
        letterSpacing: 0.5,
    },
    stealthHintText: {
        position: 'absolute',
        bottom: 40,
        color: '#3a3a3c',
        fontSize: 11,
        textAlign: 'center',
    },
});
