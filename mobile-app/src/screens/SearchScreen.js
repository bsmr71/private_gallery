import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    Image,
    Dimensions,
    ActivityIndicator,
    Alert,
    ScrollView,
} from 'react-native';
import { THEME } from '../constants/theme';
import { ApiService } from '../services/api';
import { StorageService } from '../services/storage';
import PhotoViewerModal from '../components/PhotoViewerModal';
import SecureImage from '../components/SecureImage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_SIZE = (SCREEN_WIDTH - 36) / 3;

export default function SearchScreen({ onLogout }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [user, setUser] = useState(null);
    const [apiUrl, setApiUrl] = useState('');
    const [editingUrl, setEditingUrl] = useState(false);
    const [urlInput, setUrlInput] = useState('');

    const [viewerVisible, setViewerVisible] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(0);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const u = await StorageService.getUser();
        setUser(u);
        const url = await StorageService.getApiUrl();
        setApiUrl(url);
        setUrlInput(url);
    };

    const handleSearch = async (text) => {
        setQuery(text);
        if (!text || text.trim().length === 0) {
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
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.screenTitle}>Cari &amp; Akun</Text>
                <View style={styles.searchBar}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Cari foto, album, atau tanggal..."
                        placeholderTextColor="#8e8e93"
                        value={query}
                        onChangeText={handleSearch}
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => handleSearch('')}>
                            <Text style={styles.clearSearch}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {query.length > 0 ? (
                // Search Results
                <View style={styles.resultsContainer}>
                    {searching ? (
                        <ActivityIndicator size="small" color={THEME.colors.accent} style={{ marginTop: 20 }} />
                    ) : (
                        <FlatList
                            data={results}
                            keyExtractor={(item) => String(item.id)}
                            numColumns={3}
                            contentContainerStyle={{ paddingBottom: 90 }}
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
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View style={styles.emptySearch}>
                                    <Text style={styles.emptySearchText}>Tidak ada foto yang cocok.</Text>
                                </View>
                            }
                        />
                    )}
                </View>
            ) : (
                // Settings & Storage Info
                <ScrollView style={styles.settingsScroll} contentContainerStyle={{ paddingBottom: 100 }}>
                    {/* User Card */}
                    <View style={styles.card}>
                        <View style={styles.userRow}>
                            <View style={styles.userAvatar}>
                                <Text style={styles.userInitial}>
                                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                </Text>
                            </View>
                            <View style={styles.userInfo}>
                                <Text style={styles.userName}>{user?.name || 'Administrator'}</Text>
                                <Text style={styles.userEmail}>{user?.email || 'admin@gallery.com'}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Server Connection Card */}
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
                                        <Text style={[styles.urlBtnText, { color: '#38bdf8' }]}>Simpan</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.serverRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.serverStatusText}>🟢 Terhubung ke Backend</Text>
                                    <Text style={styles.serverUrlText} numberOfLines={1}>{apiUrl}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setEditingUrl(true)}>
                                    <Text style={styles.editBtnText}>Ganti</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Cloud Security */}
                    <View style={[styles.card, styles.securityCard]}>
                        <Text style={styles.shieldIcon}>🛡️</Text>
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
                items={results}
                initialIndex={selectedIdx}
                onClose={() => setViewerVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.colors.background,
    },
    header: {
        paddingTop: 48,
        paddingBottom: 14,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    screenTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: -0.5,
        marginBottom: 12,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1c1c1e',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    searchIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        color: '#ffffff',
        fontSize: 15,
    },
    clearSearch: {
        color: '#8e8e93',
        fontSize: 16,
        paddingHorizontal: 4,
    },
    resultsContainer: {
        flex: 1,
        padding: 4,
    },
    resultItem: {
        width: ITEM_SIZE,
        height: ITEM_SIZE,
        margin: 2,
        backgroundColor: '#121214',
    },
    resultImage: {
        width: '100%',
        height: '100%',
    },
    emptySearch: {
        alignItems: 'center',
        paddingTop: 80,
    },
    emptySearchText: {
        color: '#8e8e93',
        fontSize: 14,
    },
    settingsScroll: {
        flex: 1,
        padding: 16,
    },
    card: {
        backgroundColor: '#1c1c1e',
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: THEME.colors.accent,
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
        color: '#8e8e93',
        fontSize: 13,
        marginTop: 2,
    },
    cardHeading: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 6,
    },
    serverRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    serverStatusText: {
        color: '#30d158',
        fontSize: 13,
        fontWeight: '500',
    },
    serverUrlText: {
        color: '#8e8e93',
        fontSize: 12,
        marginTop: 2,
    },
    editBtnText: {
        color: '#38bdf8',
        fontSize: 13,
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
        borderColor: 'rgba(48, 209, 88, 0.2)',
    },
    shieldIcon: {
        fontSize: 26,
        marginRight: 14,
    },
    secTitle: {
        color: '#30d158',
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
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    logoutText: {
        color: '#f87171',
        fontSize: 15,
        fontWeight: '600',
    },
});
