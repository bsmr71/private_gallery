import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    Dimensions,
    ActivityIndicator,
    Alert,
    ScrollView,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../constants/theme';
import { ApiService } from '../services/api';
import { StorageService } from '../services/storage';
import { SecurityService, useDecoyMode } from '../services/securityService';
import { GoogleDriveDirectService } from '../services/googleDriveDirectService';
import { CryptoService } from '../services/cryptoService';
import PhotoViewerModal from '../components/PhotoViewerModal';
import SecureImage from '../components/SecureImage';
import SFSymbol from '../components/SFSymbol';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_MARGIN = 2;
const ITEM_SIZE = (SCREEN_WIDTH - ITEM_MARGIN * 2) / 3;

export default function SearchScreen({ onLogout }) {
    const insets = useSafeAreaInsets();
    const isDecoy = useDecoyMode();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [user, setUser] = useState(null);
    const [apiUrl, setApiUrl] = useState('');
    const [editingUrl, setEditingUrl] = useState(false);
    const [urlInput, setUrlInput] = useState('');

    const [viewerVisible, setViewerVisible] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(0);

    const [gdriveInfo, setGdriveInfo] = useState({ isConnected: false, email: null, folderName: 'MediaGalleryEncrypted' });
    const [connectingGdrive, setConnectingGdrive] = useState(false);
    const [showTokenInput, setShowTokenInput] = useState(false);
    const [tokenInput, setTokenInput] = useState('');
    const [editingFolder, setEditingFolder] = useState(false);
    const [folderInput, setFolderInput] = useState('');

    const loadData = async () => {
        const u = await StorageService.getUser();
        setUser(u);
        const url = await StorageService.getApiUrl();
        setApiUrl(url);
        setUrlInput(url);
        const gInfo = await GoogleDriveDirectService.getConnectionInfo();
        setGdriveInfo(gInfo);
    };

    const handleSaveGdriveToken = async () => {
        if (!tokenInput.trim()) {
            Alert.alert('Perhatian', 'Token tidak boleh kosong');
            return;
        }
        setConnectingGdrive(true);
        try {
            await GoogleDriveDirectService.saveAuth(tokenInput.trim());
            const email = await GoogleDriveDirectService.fetchUserProfile(tokenInput.trim());
            const gInfo = await GoogleDriveDirectService.getConnectionInfo();
            setGdriveInfo(gInfo);
            setShowTokenInput(false);
            setTokenInput('');
            Alert.alert('Sukses', `Google Drive terhubung${email ? ` sebagai ${email}` : ''}`);
        } catch (e) {
            Alert.alert('Gagal', e.message || 'Gagal menghubungkan Google Drive');
        } finally {
            setConnectingGdrive(false);
        }
    };

    const handleDisconnectGdrive = async () => {
        Alert.alert(
            'Putuskan Google Drive',
            'Apakah Anda yakin ingin memutuskan Google Drive dari HP ini?',
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Putuskan',
                    style: 'destructive',
                    onPress: async () => {
                        await GoogleDriveDirectService.disconnect();
                        const gInfo = await GoogleDriveDirectService.getConnectionInfo();
                        setGdriveInfo(gInfo);
                    },
                },
            ]
        );
    };

    const handleSaveFolderId = async () => {
        let clean = folderInput.trim();
        if (clean.includes('/folders/')) {
            clean = clean.split('/folders/')[1].split('?')[0].split('/')[0];
        }
        await GoogleDriveDirectService.setCustomFolderId(clean);
        const gInfo = await GoogleDriveDirectService.getConnectionInfo();
        setGdriveInfo(gInfo);
        setEditingFolder(false);
        Alert.alert('Sukses', clean ? 'Folder ID Google Drive berhasil disetel!' : 'Folder ID direset ke Auto-Detect.');
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (isDecoy) {
            setResults([]);
            setViewerVisible(false);
        }
    }, [isDecoy]);

    const handleSearch = async (text) => {
        setQuery(text);
        if (!text || text.trim().length === 0 || isDecoy) {
            setResults([]);
            return;
        }

        setSearching(true);
        try {
            const res = await ApiService.getMedia({ search: text.trim(), per_page: 30 });
            if (res.success) {
                setResults(res.data);
            }
        } catch (e) {
            console.warn('Search error', e);
        } finally {
            setSearching(false);
        }
    };

    const handleSaveUrl = async () => {
        if (!urlInput.trim()) return;
        await StorageService.setApiUrl(urlInput.trim());
        setApiUrl(urlInput.trim());
        setEditingUrl(false);
        Alert.alert('Sukses', 'Alamat server API berhasil diperbarui.');
    };

    const handleLogout = () => {
        Alert.alert('Keluar Akun?', 'Apakah Anda yakin ingin keluar dari aplikasi galeri?', [
            { text: 'Batal', style: 'cancel' },
            {
                text: 'Keluar',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await ApiService.logout();
                    } catch (e) {}
                    await StorageService.clearAll();
                    onLogout && onLogout();
                },
            },
        ]);
    };

    return (
        <View style={styles.container}>
            {/* Apple Photos Large Title Header */}
            <View style={[styles.header, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 48 : 36) }]}>
                <Text style={styles.screenTitle}>Cari</Text>
                <View style={styles.searchBar}>
                    <SFSymbol name="search" size={16} color="#8E8E93" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Foto, album, atau tanggal..."
                        placeholderTextColor="#8E8E93"
                        value={query}
                        onChangeText={handleSearch}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {query.length > 0 && (
                        <TouchableOpacity
                            onPress={() => handleSearch('')}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <SFSymbol name="xmark.circle.fill" size={17} color="#8E8E93" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {query.length > 0 ? (
                // Search Results Grid
                <View style={styles.resultsContainer}>
                    {searching ? (
                        <ActivityIndicator size="small" color="#0A84FF" style={{ marginTop: 30 }} />
                    ) : (
                        <FlatList
                            data={results}
                            keyExtractor={(item) => String(item.id)}
                            numColumns={3}
                            contentContainerStyle={[styles.resultsListContent, { paddingBottom: Math.max(insets.bottom, 16) + 120 }]}
                            renderItem={({ item, index }) => (
                                <TouchableOpacity
                                    style={styles.resultItem}
                                    activeOpacity={0.8}
                                    onPress={() => {
                                        setSelectedIdx(index);
                                        setViewerVisible(true);
                                    }}
                                >
                                    <SecureImage
                                        source={item.thumbnail_url || item.stream_url}
                                        style={styles.resultImage}
                                        resizeMode="cover"
                                    />
                                    {item.type === 'video' && (
                                        <View style={styles.videoBadge}>
                                            <SFSymbol name="play.fill" size={8} color="#ffffff" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View style={styles.emptySearch}>
                                    <View style={styles.emptyIconCircle}>
                                        <SFSymbol name="search" size={40} color="#48484a" />
                                    </View>
                                    <Text style={styles.emptySearchTitle}>Tidak Ada Hasil</Text>
                                    <Text style={styles.emptySearchText}>
                                        Tidak ditemukan foto atau video yang cocok dengan pencarian Anda.
                                    </Text>
                                </View>
                            }
                        />
                    )}
                </View>
            ) : (
                // Settings & Storage Info (Apple Inset Grouped Style)
                <ScrollView
                    style={styles.settingsScroll}
                    contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 120 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* User Profile Card */}
                    <View style={styles.card}>
                        <View style={styles.userRow}>
                            <View style={styles.userAvatar}>
                                <Text style={styles.userInitial}>
                                    {isDecoy ? 'P' : (user?.name ? user.name.charAt(0).toUpperCase() : 'U')}
                                </Text>
                            </View>
                            <View style={styles.userInfo}>
                                <Text style={styles.userName}>{isDecoy ? 'Pengguna' : (user?.name || 'Administrator')}</Text>
                                <Text style={styles.userEmail}>{isDecoy ? 'Tamu / Offline' : (user?.email || 'admin@gallery.com')}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Server Connection Card */}
                    {!isDecoy && (
                        <View style={styles.card}>
                            <Text style={styles.cardHeading}>Koneksi Server</Text>
                            {editingUrl ? (
                                <View style={{ marginTop: 8 }}>
                                    <TextInput
                                        style={styles.urlInput}
                                        value={urlInput}
                                        onChangeText={setUrlInput}
                                        autoCapitalize="none"
                                    />
                                    <View style={styles.urlButtons}>
                                        <TouchableOpacity style={styles.urlBtnCancel} onPress={() => setEditingUrl(false)}>
                                            <Text style={styles.urlBtnText}>Batal</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.urlBtnSave} onPress={handleSaveUrl}>
                                            <Text style={[styles.urlBtnText, { color: '#0A84FF' }]}>Simpan</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.serverRow}>
                                    <View style={{ flex: 1 }}>
                                        <View style={styles.statusRow}>
                                            <View style={styles.statusDot} />
                                            <Text style={styles.serverStatusText}>Terhubung ke Backend</Text>
                                        </View>
                                        <Text style={styles.serverUrlText} numberOfLines={1}>{apiUrl}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setEditingUrl(true)}>
                                        <Text style={styles.editBtnText}>Ubah</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Google Drive Direct Vault Card */}
                    <View style={styles.card}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                            <SFSymbol name="arrow.triangle.2.circlepath.circle.fill" size={24} color="#0A84FF" style={{ marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardHeading}>Google Drive Direct (Zero-Knowledge)</Text>
                                <Text style={{ fontSize: 13, color: '#8E8E93', marginTop: 2 }}>
                                    Backup langsung ke Google Drive saat server offline
                                </Text>
                            </View>
                        </View>

                        {gdriveInfo.isConnected ? (
                            <View>
                                <View style={styles.serverRow}>
                                    <View style={{ flex: 1 }}>
                                        <View style={styles.statusRow}>
                                            <View style={[styles.statusDot, { backgroundColor: '#30D158' }]} />
                                            <Text style={styles.serverStatusText}>Terhubung Langsung</Text>
                                        </View>
                                        <Text style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '600', marginTop: 2 }}>
                                            {gdriveInfo.email || 'Akun Google Aktif'}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>
                                            Folder: {gdriveInfo.folderName} {gdriveInfo.folderId ? `(ID: ${gdriveInfo.folderId.slice(0, 8)}...)` : '(Auto Shared/Drive)'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={handleDisconnectGdrive}>
                                        <Text style={[styles.editBtnText, { color: '#FF453A' }]}>Putuskan</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Shared Folder ID Override Button */}
                                <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)' }}>
                                    {editingFolder ? (
                                        <View>
                                            <Text style={{ fontSize: 12, color: '#8E8E93', marginBottom: 6 }}>
                                                Tempel ID atau Link Shared Folder Google Drive:
                                            </Text>
                                            <TextInput
                                                style={styles.urlInput}
                                                placeholder="Contoh: 1a2b3c4d... atau https://drive.google.com/..."
                                                placeholderTextColor="#636366"
                                                value={folderInput}
                                                onChangeText={setFolderInput}
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                            />
                                            <View style={styles.urlButtons}>
                                                <TouchableOpacity style={styles.urlBtnCancel} onPress={() => setEditingFolder(false)}>
                                                    <Text style={styles.urlBtnText}>Batal</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.urlBtnSave} onPress={handleSaveFolderId}>
                                                    <Text style={[styles.urlBtnText, { color: '#0A84FF' }]}>Simpan Folder</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}
                                            onPress={() => {
                                                setFolderInput(gdriveInfo.folderId || '');
                                                setEditingFolder(true);
                                            }}
                                        >
                                            <Text style={{ fontSize: 12, color: '#0A84FF', fontWeight: '500' }}>
                                                {gdriveInfo.folderId ? 'Ubah ID Shared Folder' : 'Atur ID Shared Folder Khusus (Opsional)'}
                                            </Text>
                                            <SFSymbol name="chevron.right" size={11} color="#0A84FF" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        ) : (
                            <View>
                                <Text style={{ fontSize: 13, color: '#EBEBF599', marginBottom: 12 }}>
                                    Hubungkan akun Google Drive untuk mengaktifkan backup mandiri langsung dari HP tanpa membebani server.
                                </Text>
                                {showTokenInput ? (
                                    <View>
                                        <TextInput
                                            style={styles.urlInput}
                                            placeholder="Tempel Access Token Google Drive..."
                                            placeholderTextColor="#636366"
                                            value={tokenInput}
                                            onChangeText={setTokenInput}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                        <View style={styles.urlButtons}>
                                            <TouchableOpacity style={styles.urlBtnCancel} onPress={() => setShowTokenInput(false)}>
                                                <Text style={styles.urlBtnText}>Batal</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.urlBtnSave} onPress={handleSaveGdriveToken} disabled={connectingGdrive}>
                                                <Text style={[styles.urlBtnText, { color: '#0A84FF' }]}>
                                                    {connectingGdrive ? 'Menghubungkan...' : 'Simpan'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.urlBtnSave, { backgroundColor: '#1C1C1E', borderRadius: 8, paddingVertical: 10, alignItems: 'center' }]}
                                        onPress={() => setShowTokenInput(true)}
                                    >
                                        <Text style={{ color: '#0A84FF', fontWeight: '600', fontSize: 14 }}>
                                            Hubungkan Akun Google Drive
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Hardware Cryptography Card */}
                    <View style={[styles.card, styles.securityCard]}>
                        <SFSymbol name="lock.shield.fill" size={26} color="#30D158" style={{ marginRight: 14 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.secTitle}>Enkripsi Militer AES-256-GCM (At-Rest)</Text>
                            <Text style={styles.secDesc}>
                                Akselerasi Hardware ARMv8 aktif. File di HP dan di Google Drive tersimpan sebagai ciphertext (.enc) yang mustahil ditembus tanpa Master Vault Key.
                            </Text>
                        </View>
                    </View>

                    {/* Logout Button */}
                    <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
                        <Text style={styles.logoutText}>Keluar dari Akun</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}

            <PhotoViewerModal
                visible={viewerVisible}
                items={isDecoy ? [] : results}
                initialIndex={selectedIdx}
                onClose={() => setViewerVisible(false)}
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
        paddingTop: 54,
        paddingBottom: 14,
        paddingHorizontal: 20,
    },
    screenTitle: {
        fontSize: 34,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: 0.38,
        marginBottom: 12,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1c1c1e',
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 38,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        color: '#ffffff',
        fontSize: 16,
        paddingVertical: 0,
    },
    resultsContainer: {
        flex: 1,
    },
    resultsListContent: {
        paddingBottom: 120,
    },
    resultItem: {
        width: ITEM_SIZE,
        height: ITEM_SIZE,
        margin: ITEM_MARGIN,
        backgroundColor: '#121214',
    },
    resultImage: {
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
    emptySearch: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        paddingHorizontal: 36,
    },
    emptyIconCircle: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: '#1c1c1e',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptySearchTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 6,
    },
    emptySearchText: {
        color: '#8E8E93',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    settingsScroll: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    card: {
        backgroundColor: '#1c1c1e',
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#0A84FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    userInitial: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '700',
    },
    userName: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '600',
    },
    userEmail: {
        color: '#8E8E93',
        fontSize: 13,
        marginTop: 2,
    },
    cardHeading: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 8,
    },
    serverRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 3,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#30D158',
        marginRight: 6,
    },
    serverStatusText: {
        color: '#30D158',
        fontSize: 13,
        fontWeight: '600',
    },
    serverUrlText: {
        color: '#8E8E93',
        fontSize: 12,
    },
    editBtnText: {
        color: '#0A84FF',
        fontSize: 14,
        fontWeight: '600',
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    urlInput: {
        backgroundColor: '#2c2c2e',
        color: '#ffffff',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        marginBottom: 8,
    },
    urlButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    urlBtnCancel: {
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    urlBtnSave: {
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    urlBtnText: {
        color: '#ffffff',
        fontWeight: '600',
        fontSize: 13,
    },
    securityCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(48, 209, 88, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(48, 209, 88, 0.2)',
    },
    secTitle: {
        color: '#30D158',
        fontSize: 14,
        fontWeight: '600',
    },
    secDesc: {
        color: '#cbd5e1',
        fontSize: 12,
        marginTop: 2,
        lineHeight: 16,
    },
    logoutBtn: {
        backgroundColor: 'rgba(255, 69, 58, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255, 69, 58, 0.25)',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    logoutText: {
        color: '#FF453A',
        fontSize: 15,
        fontWeight: '600',
    },
});
