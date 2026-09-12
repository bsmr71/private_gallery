import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Dimensions,
    ScrollView,
    Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SFSymbol from './SFSymbol';
import { LocalVaultService } from '../services/localVaultService';
import { DeviceGalleryService } from '../services/deviceGalleryService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LocalOfflineSyncModal({
    visible,
    onClose,
    totalMediaCount = 0,
    targetAlbum = null, // { id, name } if opened from album view
    onSyncFinished,
}) {
    const insets = useSafeAreaInsets();
    const [localCount, setLocalCount] = useState(0);
    const [vaultUsage, setVaultUsage] = useState({ formatted: '0 MB', count: 0 });
    const [downloading, setDownloading] = useState(false);
    const [progress, setProgress] = useState({
        current: 0,
        total: 0,
        percentage: 0,
        activeFilename: '',
    });

    // Export to Device Gallery state
    const [exportingToDevice, setExportingToDevice] = useState(false);
    const [exportProgress, setExportProgress] = useState({
        current: 0,
        total: 0,
        percentage: 0,
        activeFilename: '',
    });

    const refreshStats = useCallback(async () => {
        try {
            await LocalVaultService.init();
            const count = LocalVaultService.getLocalCount();
            const usage = await LocalVaultService.getVaultStorageUsage();
            setLocalCount(count);
            setVaultUsage(usage);

            const running = LocalVaultService.isDownloadAllRunning();
            setDownloading(running);
            if (running) {
                const prog = LocalVaultService.getDownloadProgress();
                setProgress(prog);
            }
        } catch (e) {
            console.warn('[LocalOfflineSyncModal] Stats error:', e);
        }
    }, []);

    useEffect(() => {
        if (visible) {
            refreshStats();
        }
    }, [visible, refreshStats]);

    // Periodically update progress if download is running
    useEffect(() => {
        let interval = null;
        if (visible && downloading) {
            interval = setInterval(() => {
                const prog = LocalVaultService.getDownloadProgress();
                setProgress(prog);
                setDownloading(LocalVaultService.isDownloadAllRunning());
            }, 500);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [visible, downloading]);

    // 1. Download to App Cache (Private Sandbox - No loading & 60 FPS in this app)
    const handleStartAppCacheDownload = async (onlyAlbum = false) => {
        const albumIdToUse = onlyAlbum && targetAlbum ? targetAlbum.id : null;
        const targetLabel = albumIdToUse ? `Album "${targetAlbum.name}"` : 'Seluruh Galeri';

        Alert.alert(
            'Simpan ke Cache Aplikasi',
            `Unduh ${targetLabel} ke memori internal aplikasi ini agar scroll super mulus 60 FPS dan terbuka instan 0 detik tanpa loading?\n\n🔒 Privasi Aman: Berkas disimpan di ruang privat aplikasi, TIDAK akan muncul di Galeri umum HP / Google Photos.`,
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Mulai Unduh',
                    style: 'default',
                    onPress: () => {
                        setDownloading(true);
                        LocalVaultService.downloadAllToLocal({
                            albumId: albumIdToUse,
                            onProgress: (prog) => {
                                setProgress(prog);
                            },
                            onComplete: (res) => {
                                setDownloading(false);
                                refreshStats();
                                onSyncFinished && onSyncFinished(res);

                                if (res.cancelled) {
                                    Alert.alert('Unduhan Dibatalkan', 'Proses unduh ke cache aplikasi telah dihentikan.');
                                } else if (res.successCount === 0 && res.skippedCount > 0) {
                                    Alert.alert(
                                        'Semua Berkas Sudah Lengkap! ⚡',
                                        `Seluruh ${res.skippedCount} foto & video sudah tersimpan di memori cache aplikasi Anda sebelumnya.\n\nTidak ada berkas baru yang perlu diunduh. Galeri di aplikasi ini sudah 100% offline dan siap dibuka instan 0 detik tanpa loading!`
                                    );
                                } else {
                                    Alert.alert(
                                        'Unduhan Selesai ⚡',
                                        `Berhasil mengunduh ${res.successCount} berkas baru ke cache aplikasi${res.skippedCount > 0 ? ` (${res.skippedCount} berkas sudah lengkap sebelumnya)` : ''}.\n\nGaleri di aplikasi ini kini dapat dibuka seketika tanpa loading dan 100% offline!`
                                    );
                                }
                            },
                            onError: (err) => {
                                setDownloading(false);
                                refreshStats();
                                Alert.alert('Gagal Mengunduh', err?.message || 'Terjadi kesalahan saat mengunduh berkas.');
                            },
                        });
                    },
                },
            ]
        );
    };

    // 2. Export to Phone's Public Gallery (Google Photos, Samsung Gallery, DCIM)
    const handleExportToPublicGallery = async (onlyAlbum = false) => {
        const albumIdToUse = onlyAlbum && targetAlbum ? targetAlbum.id : null;
        const targetLabel = albumIdToUse ? `Album "${targetAlbum.name}"` : 'Seluruh Galeri';

        Alert.alert(
            'Simpan ke Galeri HP (Publik)',
            `Apakah Anda ingin mengekspor seluruh foto & video dari ${targetLabel} ke aplikasi Galeri bawaan HP (Samsung Gallery, Google Photos, DCIM)?\n\n⚠️ Perhatian: Berkas akan dapat dilihat secara publik di luar aplikasi ini. Lanjutkan?`,
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Ekspor ke Galeri HP',
                    onPress: async () => {
                        setExportingToDevice(true);
                        try {
                            const { ApiService } = require('../services/api');
                            let currentPage = 1;
                            let itemsToExport = [];
                            let hasMore = true;

                            while (hasMore) {
                                const params = { all: 1, per_page: 2000, page: currentPage };
                                if (albumIdToUse) params.album_id = albumIdToUse;
                                const res = await ApiService.getMedia(params);
                                if (res && res.success && Array.isArray(res.data)) {
                                    const pag = res.pagination || res.meta;
                                    const hasNextPage = pag
                                        ? (Boolean(pag.has_more) || pag.current_page < pag.last_page)
                                        : false;
                                    if (hasNextPage && res.data.length > 0) {
                                        currentPage++;
                                    } else {
                                        hasMore = false;
                                    }
                                } else {
                                    hasMore = false;
                                }
                            }

                            if (itemsToExport.length === 0) {
                                Alert.alert('Informasi', 'Tidak ada media untuk diekspor.');
                                setExportingToDevice(false);
                                return;
                            }

                            await DeviceGalleryService.saveMultipleToDeviceGallery(itemsToExport, {
                                onProgress: (prog) => {
                                    setExportProgress(prog);
                                },
                                onComplete: (result) => {
                                    setExportingToDevice(false);
                                    Alert.alert(
                                        'Ekspor Selesai 🎉',
                                        `Berhasil menyimpan ${result.successCount} berkas ke Galeri HP Anda (Album: Private Gallery). Anda dapat melihatnya di Google Photos atau Galeri ponsel!`
                                    );
                                },
                            });
                        } catch (err) {
                            setExportingToDevice(false);
                            Alert.alert('Gagal Ekspor', err?.message || 'Terjadi kesalahan saat mengekspor ke galeri HP.');
                        }
                    },
                },
            ]
        );
    };

    const handleCancelDownload = () => {
        Alert.alert(
            'Batalkan Unduhan?',
            'Apakah Anda ingin menghentikan unduhan berkas ke cache aplikasi? Berkas yang sudah selesai diunduh akan tetap tersimpan.',
            [
                { text: 'Lanjutkan Unduh', style: 'cancel' },
                {
                    text: 'Batalkan',
                    style: 'destructive',
                    onPress: () => {
                        LocalVaultService.cancelDownloadAll();
                    },
                },
            ]
        );
    };

    const handleClearVault = () => {
        Alert.alert(
            'Kosongkan Cache Aplikasi?',
            'Hapus seluruh salinan foto & video dari cache internal aplikasi ini?\n\nSemua foto & video Anda TETAP 100% AMAN di Google Drive / Cloud. Hanya cache internal aplikasi ini yang dibersihkan untuk menghemat memori HP.',
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Kosongkan Cache',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await LocalVaultService.clearLocalVault();
                            await refreshStats();
                            onSyncFinished && onSyncFinished();
                            Alert.alert('Selesai', 'Cache internal aplikasi berhasil dibersihkan.');
                        } catch (e) {
                            Alert.alert('Gagal', 'Tidak dapat menghapus cache lokal.');
                        }
                    },
                },
            ]
        );
    };

    const isFullyCached = totalMediaCount > 0 && localCount >= totalMediaCount;
    const remainingCount = Math.max(0, totalMediaCount - localCount);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header Bar */}
                <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
                    <TouchableOpacity
                        style={styles.closeBtn}
                        onPress={onClose}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text style={styles.closeBtnText}>Tutup</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Penyimpanan &amp; Ekspor</Text>
                    <View style={{ width: 44 }} />
                </View>

                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: Math.max(insets.bottom, 24) + 32 },
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Concept Distinction Card */}
                    <View style={styles.explainerCard}>
                        <Text style={styles.explainerCardTitle}>PILIHAN PENYIMPANAN</Text>
                        <View style={styles.explainerRow}>
                            <View style={[styles.explainerBadge, { backgroundColor: 'rgba(48, 209, 88, 0.15)' }]}>
                                <Text style={{ fontSize: 16 }}>⚡</Text>
                            </View>
                            <View style={styles.explainerTextWrap}>
                                <Text style={[styles.explainerTypeTitle, { color: '#30D158' }]}>
                                    Cache Cepat Aplikasi (Anti-Loading)
                                </Text>
                                <Text style={styles.explainerTypeDesc}>
                                    Tersimpan di dalam aplikasi ini saja agar scroll 60 FPS dan buka 0 detik. <Text style={{ color: '#ffffff', fontWeight: '600' }}>TIDAK muncul di Galeri HP</Text> (privasi aman).
                                </Text>
                            </View>
                        </View>

                        <View style={[styles.explainerRow, { marginTop: 12 }]}>
                            <View style={[styles.explainerBadge, { backgroundColor: 'rgba(10, 132, 255, 0.15)' }]}>
                                <Text style={{ fontSize: 16 }}>🖼️</Text>
                            </View>
                            <View style={styles.explainerTextWrap}>
                                <Text style={[styles.explainerTypeTitle, { color: '#0A84FF' }]}>
                                    Simpan ke Galeri HP (Publik)
                                </Text>
                                <Text style={styles.explainerTypeDesc}>
                                    Diekspor ke album perangkat HP Anda agar bisa dibuka di <Text style={{ color: '#ffffff', fontWeight: '600' }}>Google Photos, Samsung Gallery</Text>, atau dikirim ke WhatsApp.
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Cache Stats Metric Card */}
                    <View style={styles.statsCard}>
                        <View style={styles.statRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Media di Cache App</Text>
                                <Text style={styles.statValue}>
                                    {localCount} <Text style={styles.statValueSub}>/ {totalMediaCount || localCount}</Text>
                                </Text>
                            </View>

                            <View style={styles.statDivider} />

                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Memori Cache</Text>
                                <Text style={styles.statValue}>{vaultUsage.formatted}</Text>
                            </View>
                        </View>

                        <View style={styles.statusBadgeWrap}>
                            {isFullyCached ? (
                                <View style={styles.badgeSuccess}>
                                    <SFSymbol name="checkmark.circle.fill" size={13} color="#30D158" />
                                    <Text style={styles.badgeSuccessText}>100% Tersimpan di Cache (Siap Bebas Loading)</Text>
                                </View>
                            ) : (
                                <View style={styles.badgePending}>
                                    <SFSymbol name="icloud" size={13} color="#FF9F0A" />
                                    <Text style={styles.badgePendingText}>
                                        {remainingCount > 0 ? `${remainingCount} media belum di-cache di aplikasi` : 'Siap Disinkronkan'}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Progress Bar 1: Downloading to App Cache */}
                    {downloading && (
                        <View style={styles.downloadProgressCard}>
                            <View style={styles.progressHeaderRow}>
                                <View style={styles.progressHeaderLeft}>
                                    <ActivityIndicator size="small" color="#30D158" style={{ marginRight: 8 }} />
                                    <Text style={styles.progressTitle}>Menyimpan ke Cache Aplikasi...</Text>
                                </View>
                                <Text style={[styles.progressPercent, { color: '#30D158' }]}>{progress.percentage || 0}%</Text>
                            </View>

                            <View style={styles.progressBarTrack}>
                                <View
                                    style={[
                                        styles.progressBarFill,
                                        { backgroundColor: '#30D158', width: `${Math.min(100, Math.max(0, progress.percentage || 0))}%` },
                                    ]}
                                />
                            </View>

                            <View style={styles.progressInfoRow}>
                                <Text style={styles.progressCountText}>
                                    {progress.current || 0} dari {progress.total || totalMediaCount} berkas
                                </Text>
                                <Text style={styles.progressFilenameText} numberOfLines={1}>
                                    {progress.activeFilename || 'Menyiapkan berkas...'}
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={handleCancelDownload}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.cancelBtnText}>Batalkan Unduhan</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Progress Bar 2: Exporting to Phone Public Gallery */}
                    {exportingToDevice && (
                        <View style={[styles.downloadProgressCard, { borderColor: 'rgba(10, 132, 255, 0.4)' }]}>
                            <View style={styles.progressHeaderRow}>
                                <View style={styles.progressHeaderLeft}>
                                    <ActivityIndicator size="small" color="#0A84FF" style={{ marginRight: 8 }} />
                                    <Text style={styles.progressTitle}>Mengekspor ke Galeri HP...</Text>
                                </View>
                                <Text style={[styles.progressPercent, { color: '#0A84FF' }]}>{exportProgress.percentage || 0}%</Text>
                            </View>

                            <View style={styles.progressBarTrack}>
                                <View
                                    style={[
                                        styles.progressBarFill,
                                        { backgroundColor: '#0A84FF', width: `${Math.min(100, Math.max(0, exportProgress.percentage || 0))}%` },
                                    ]}
                                />
                            </View>

                            <View style={styles.progressInfoRow}>
                                <Text style={styles.progressCountText}>
                                    {exportProgress.current || 0} dari {exportProgress.total || totalMediaCount} berkas
                                </Text>
                                <Text style={styles.progressFilenameText} numberOfLines={1}>
                                    {exportProgress.activeFilename || 'Menyimpan ke album...'}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Action Buttons Section */}
                    {!downloading && !exportingToDevice && (
                        <View style={styles.actionSection}>
                            {targetAlbum && (
                                <TouchableOpacity
                                    style={styles.albumDownloadBtn}
                                    onPress={() => handleStartAppCacheDownload(true)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={{ fontSize: 16, marginRight: 8 }}>⚡</Text>
                                    <Text style={styles.albumDownloadBtnText}>
                                        Cache Album "{targetAlbum.name}" (Anti-Loading)
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {/* Button 1: Cache App (Anti Loading) */}
                            <TouchableOpacity
                                style={styles.primaryCacheBtn}
                                onPress={() => handleStartAppCacheDownload(false)}
                                activeOpacity={0.85}
                            >
                                <Text style={{ fontSize: 18, marginRight: 8 }}>⚡</Text>
                                <View>
                                    <Text style={styles.primaryBtnText}>
                                        {isFullyCached
                                            ? 'Perbarui Cache Aplikasi'
                                            : `Unduh Semua ke Cache App (${remainingCount} Berkas)`}
                                    </Text>
                                    <Text style={styles.primaryBtnSub}>
                                        Buka kilat 0 detik &amp; scroll mulus di aplikasi ini (Privat)
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* Button 2: Export to Phone Public Gallery */}
                            <TouchableOpacity
                                style={styles.secondaryExportBtn}
                                onPress={() => handleExportToPublicGallery(false)}
                                activeOpacity={0.85}
                            >
                                <Text style={{ fontSize: 18, marginRight: 8 }}>🖼️</Text>
                                <View>
                                    <Text style={styles.secondaryBtnText}>
                                        Ekspor Semua ke Galeri HP (Publik)
                                    </Text>
                                    <Text style={styles.secondaryBtnSub}>
                                        Muncul di Samsung Gallery, Google Photos, &amp; DCIM
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* Button 3: Clear Cache */}
                            {localCount > 0 && (
                                <TouchableOpacity
                                    style={styles.clearBtn}
                                    onPress={handleClearVault}
                                    activeOpacity={0.7}
                                >
                                    <SFSymbol name="trash" size={14} color="#FF453A" style={{ marginRight: 6 }} />
                                    <Text style={styles.clearBtnText}>Kosongkan Cache Aplikasi ({vaultUsage.formatted})</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121214',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.12)',
        backgroundColor: '#121214',
    },
    closeBtn: {
        paddingVertical: 6,
        paddingHorizontal: 8,
    },
    closeBtnText: {
        color: '#0A84FF',
        fontSize: 16,
        fontWeight: '600',
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '700',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    explainerCard: {
        backgroundColor: '#1C1C1E',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    explainerCardTitle: {
        color: '#8E8E93',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
        marginBottom: 12,
    },
    explainerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    explainerBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    explainerTextWrap: {
        flex: 1,
    },
    explainerTypeTitle: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 3,
    },
    explainerTypeDesc: {
        color: '#8E8E93',
        fontSize: 12,
        lineHeight: 16,
    },
    statsCard: {
        backgroundColor: '#1C1C1E',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    statRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        marginBottom: 14,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statLabel: {
        color: '#8E8E93',
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 4,
    },
    statValue: {
        color: '#ffffff',
        fontSize: 22,
        fontWeight: '800',
    },
    statValueSub: {
        color: '#636366',
        fontSize: 14,
        fontWeight: '500',
    },
    statDivider: {
        width: 1,
        height: 36,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    statusBadgeWrap: {
        alignItems: 'center',
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    badgeSuccess: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(48, 209, 88, 0.12)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    badgeSuccessText: {
        color: '#30D158',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 6,
    },
    badgePending: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 159, 10, 0.12)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    badgePendingText: {
        color: '#FF9F0A',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 6,
    },
    downloadProgressCard: {
        backgroundColor: '#1C1C1E',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(48, 209, 88, 0.3)',
    },
    progressHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    progressHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    progressTitle: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
    progressPercent: {
        fontSize: 16,
        fontWeight: '800',
    },
    progressBarTrack: {
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
        marginBottom: 10,
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    progressInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    progressCountText: {
        color: '#8E8E93',
        fontSize: 12,
        fontWeight: '500',
    },
    progressFilenameText: {
        color: '#636366',
        fontSize: 11,
        maxWidth: 180,
    },
    cancelBtn: {
        backgroundColor: 'rgba(255, 69, 58, 0.12)',
        borderRadius: 10,
        paddingVertical: 9,
        alignItems: 'center',
    },
    cancelBtnText: {
        color: '#FF453A',
        fontSize: 13,
        fontWeight: '600',
    },
    actionSection: {
        marginBottom: 20,
    },
    albumDownloadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(48, 209, 88, 0.12)',
        borderRadius: 14,
        paddingVertical: 13,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(48, 209, 88, 0.25)',
    },
    albumDownloadBtnText: {
        color: '#30D158',
        fontSize: 14,
        fontWeight: '600',
    },
    primaryCacheBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#248A3D',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 12,
        shadowColor: '#30D158',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
    primaryBtnSub: {
        color: 'rgba(255, 255, 255, 0.75)',
        fontSize: 11,
        marginTop: 2,
    },
    secondaryExportBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(10, 132, 255, 0.14)',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(10, 132, 255, 0.3)',
    },
    secondaryBtnText: {
        color: '#0A84FF',
        fontSize: 15,
        fontWeight: '700',
    },
    secondaryBtnSub: {
        color: '#8E8E93',
        fontSize: 11,
        marginTop: 2,
    },
    clearBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    clearBtnText: {
        color: '#FF453A',
        fontSize: 13,
        fontWeight: '500',
    },
});
