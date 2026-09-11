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

    const handleStartDownload = async (onlyAlbum = false) => {
        const albumIdToUse = onlyAlbum && targetAlbum ? targetAlbum.id : null;
        const targetLabel = albumIdToUse ? `Album "${targetAlbum.name}"` : 'Seluruh Galeri';

        Alert.alert(
            'Unduh ke Memori HP',
            `Mulai menyimpan ${targetLabel} ke memori lokal HP Anda? Proses ini akan mengunduh thumbnail dan berkas asli agar galeri dapat dibuka 100% offline dan secepat kilat (0 detik).`,
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
                                    Alert.alert('Unduhan Dibatalkan', 'Proses unduh ke memori HP telah dihentikan.');
                                } else {
                                    Alert.alert(
                                        'Unduhan Selesai 🎉',
                                        `Berhasil menyimpan ${res.successCount} berkas ke HP (${res.skippedCount} berkas sudah tersimpan sebelumnya). Galeri kini dapat dibuka seketika tanpa koneksi internet!`
                                    );
                                }
                            },
                            onError: (err) => {
                                setDownloading(false);
                                refreshStats();
                                Alert.alert('Gagal Mengunduh', err?.message || 'Terjadi kesalahan saat mengunduh berkas ke HP.');
                            },
                        });
                    },
                },
            ]
        );
    };

    const handleCancelDownload = () => {
        Alert.alert(
            'Batalkan Unduhan?',
            'Apakah Anda ingin menghentikan unduhan berkas ke HP? Berkas yang sudah selesai diunduh akan tetap tersimpan di HP.',
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
            'Kosongkan Salinan HP?',
            'Apakah Anda ingin menghapus seluruh salinan foto & video dari memori HP?\n\nSemua foto & video Anda TETAP 100% AMAN di Google Drive / Cloud. Hanya salinan offline di HP ini yang dihapus untuk membebaskan ruang memori perangkat.',
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Hapus dari HP',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await LocalVaultService.clearLocalVault();
                            await refreshStats();
                            onSyncFinished && onSyncFinished();
                            Alert.alert('Selesai', 'Ruang memori HP berhasil dibersihkan.');
                        } catch (e) {
                            Alert.alert('Gagal', 'Tidak dapat menghapus salinan lokal.');
                        }
                    },
                },
            ]
        );
    };

    const isFullyLocal = totalMediaCount > 0 && localCount >= totalMediaCount;
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
                    <Text style={styles.headerTitle}>Offline Local Vault</Text>
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
                    {/* Hero Card */}
                    <View style={styles.heroCard}>
                        <View style={styles.heroIconWrap}>
                            <SFSymbol name="arrow.down.circle.fill" size={38} color="#0A84FF" />
                        </View>
                        <Text style={styles.heroTitle}>Simpan Seluruh Galeri ke HP</Text>
                        <Text style={styles.heroDesc}>
                            Simpan semua foto & video ke memori lokal HP agar galeri dapat dibuka seketika (0 detik), scroll mulus 60 FPS tanpa patah-patah, dan dapat diakses 100% offline tanpa internet.
                        </Text>
                    </View>

                    {/* Stats Metric Card */}
                    <View style={styles.statsCard}>
                        <View style={styles.statRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Media di HP</Text>
                                <Text style={styles.statValue}>
                                    {localCount} <Text style={styles.statValueSub}>/ {totalMediaCount || localCount}</Text>
                                </Text>
                            </View>

                            <View style={styles.statDivider} />

                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Memori Terpakai</Text>
                                <Text style={styles.statValue}>{vaultUsage.formatted}</Text>
                            </View>
                        </View>

                        <View style={styles.statusBadgeWrap}>
                            {isFullyLocal ? (
                                <View style={styles.badgeSuccess}>
                                    <SFSymbol name="checkmark.circle.fill" size={13} color="#30D158" />
                                    <Text style={styles.badgeSuccessText}>100% Tersimpan di HP (Siap Offline)</Text>
                                </View>
                            ) : (
                                <View style={styles.badgePending}>
                                    <SFSymbol name="icloud" size={13} color="#FF9F0A" />
                                    <Text style={styles.badgePendingText}>
                                        {remainingCount > 0 ? `${remainingCount} media belum disimpan di HP` : 'Siap Disinkronkan'}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Live Progress Bar (when downloading) */}
                    {downloading ? (
                        <View style={styles.downloadProgressCard}>
                            <View style={styles.progressHeaderRow}>
                                <View style={styles.progressHeaderLeft}>
                                    <ActivityIndicator size="small" color="#0A84FF" style={{ marginRight: 8 }} />
                                    <Text style={styles.progressTitle}>Sedang Mengunduh ke HP...</Text>
                                </View>
                                <Text style={styles.progressPercent}>{progress.percentage || 0}%</Text>
                            </View>

                            {/* Progress bar line */}
                            <View style={styles.progressBarTrack}>
                                <View
                                    style={[
                                        styles.progressBarFill,
                                        { width: `${Math.min(100, Math.max(0, progress.percentage || 0))}%` },
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
                    ) : (
                        /* Action Buttons (when idle) */
                        <View style={styles.actionSection}>
                            {targetAlbum && (
                                <TouchableOpacity
                                    style={styles.albumDownloadBtn}
                                    onPress={() => handleStartDownload(true)}
                                    activeOpacity={0.8}
                                >
                                    <SFSymbol name="folder" size={18} color="#0A84FF" style={{ marginRight: 8 }} />
                                    <Text style={styles.albumDownloadBtnText}>
                                        Simpan Album "{targetAlbum.name}" ke HP
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={styles.primaryDownloadBtn}
                                onPress={() => handleStartDownload(false)}
                                activeOpacity={0.85}
                            >
                                <SFSymbol name="arrow.down.circle.fill" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                                <Text style={styles.primaryDownloadBtnText}>
                                    {isFullyLocal
                                        ? 'Perbarui / Unduh Berkas Terbaru'
                                        : `Unduh Semua Media ke HP (${remainingCount} Berkas)`}
                                </Text>
                            </TouchableOpacity>

                            {localCount > 0 && (
                                <TouchableOpacity
                                    style={styles.clearBtn}
                                    onPress={handleClearVault}
                                    activeOpacity={0.7}
                                >
                                    <SFSymbol name="trash" size={15} color="#FF453A" style={{ marginRight: 6 }} />
                                    <Text style={styles.clearBtnText}>Kosongkan Memori HP ({vaultUsage.formatted})</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Feature Perks */}
                    <View style={styles.perksCard}>
                        <Text style={styles.perksSectionTitle}>KEUNTUNGAN PENYIMPANAN HP</Text>

                        <View style={styles.perkRow}>
                            <View style={styles.perkIconWrap}>
                                <Text style={styles.perkEmoji}>⚡</Text>
                            </View>
                            <View style={styles.perkTextWrap}>
                                <Text style={styles.perkTitle}>Buka Instan 0 Detik</Text>
                                <Text style={styles.perkDesc}>
                                    Foto dan video terbuka seketika tanpa menunggu koneksi atau buffering.
                                </Text>
                            </View>
                        </View>

                        <View style={styles.perkRow}>
                            <View style={styles.perkIconWrap}>
                                <Text style={styles.perkEmoji}>📱</Text>
                            </View>
                            <View style={styles.perkTextWrap}>
                                <Text style={styles.perkTitle}>Scroll Super Mulus (60 FPS)</Text>
                                <Text style={styles.perkDesc}>
                                    Thumbnail diambil langsung dari memori lokal sehingga tidak patah-patah saat scrolling.
                                </Text>
                            </View>
                        </View>

                        <View style={styles.perkRow}>
                            <View style={styles.perkIconWrap}>
                                <Text style={styles.perkEmoji}>✈️</Text>
                            </View>
                            <View style={styles.perkTextWrap}>
                                <Text style={styles.perkTitle}>100% Akses Offline</Text>
                                <Text style={styles.perkDesc}>
                                    Tetap bisa menikmati seluruh galeri di pesawat atau di daerah tanpa sinyal internet.
                                </Text>
                            </View>
                        </View>

                        <View style={styles.perkRow}>
                            <View style={styles.perkIconWrap}>
                                <Text style={styles.perkEmoji}>🔒</Text>
                            </View>
                            <View style={styles.perkTextWrap}>
                                <Text style={styles.perkTitle}>Aman & Tersembunyi</Text>
                                <Text style={styles.perkDesc}>
                                    Tersimpan di ruang privat aplikasi (Sandbox), aman dari aplikasi lain dan tidak mencemari galeri umum HP.
                                </Text>
                            </View>
                        </View>
                    </View>
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
    heroCard: {
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 12,
        marginBottom: 16,
    },
    heroIconWrap: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: 'rgba(10, 132, 255, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    heroTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: -0.3,
    },
    heroDesc: {
        color: '#8E8E93',
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
        paddingHorizontal: 8,
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
        borderColor: 'rgba(10, 132, 255, 0.3)',
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
        color: '#0A84FF',
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
        backgroundColor: '#0A84FF',
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
        backgroundColor: 'rgba(10, 132, 255, 0.12)',
        borderRadius: 14,
        paddingVertical: 13,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(10, 132, 255, 0.25)',
    },
    albumDownloadBtnText: {
        color: '#0A84FF',
        fontSize: 14,
        fontWeight: '600',
    },
    primaryDownloadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0A84FF',
        borderRadius: 14,
        paddingVertical: 14,
        marginBottom: 10,
        shadowColor: '#0A84FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryDownloadBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
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
    perksCard: {
        backgroundColor: '#1C1C1E',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    perksSectionTitle: {
        color: '#8E8E93',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
        marginBottom: 14,
    },
    perkRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    perkIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    perkEmoji: {
        fontSize: 16,
    },
    perkTextWrap: {
        flex: 1,
    },
    perkTitle: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    },
    perkDesc: {
        color: '#8E8E93',
        fontSize: 12,
        lineHeight: 16,
    },
});
