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

    const loadData = async () => {
        const u = await StorageService.getUser();
        setUser(u);
        const url = await StorageService.getApiUrl();
        setApiUrl(url);
        setUrlInput(url);
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

                    {/* Cloud Security Card */}
                    <View style={[styles.card, styles.securityCard]}>
                        <SFSymbol name="lock.fill" size={24} color="#30D158" style={{ marginRight: 14 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.secTitle}>Penyimpanan Terenkripsi AES-256</Text>
                            <Text style={styles.secDesc}>
                                Semua foto dan video dienkripsi secara privat sebelum disimpan di Google Drive.
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
