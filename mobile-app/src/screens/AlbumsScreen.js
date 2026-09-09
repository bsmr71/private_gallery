import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    Dimensions,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Modal,
    TextInput,
} from 'react-native';
import { THEME } from '../constants/theme';
import { ApiService } from '../services/api';
import SecureImage from '../components/SecureImage';
import SFSymbol from '../components/SFSymbol';
import { SecurityService } from '../services/securityService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ALBUM_CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

export default function AlbumsScreen({ navigation }) {
    const [albums, setAlbums] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [newAlbumName, setNewAlbumName] = useState('');
    const [creating, setCreating] = useState(false);

    const fetchAlbums = useCallback(async () => {
        if (SecurityService.isDecoyMode()) {
            setAlbums([]);
            setLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            const res = await ApiService.getAlbums();
            if (res.success) {
                setAlbums(res.data);
            }
        } catch (e) {
            console.warn('Fetch albums error', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchAlbums();
    }, [fetchAlbums]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchAlbums();
    };

    const handleCreateAlbum = async () => {
        if (!newAlbumName.trim()) return;
        setCreating(true);
        try {
            const res = await ApiService.createAlbum(newAlbumName.trim());
            if (res.success) {
                setNewAlbumName('');
                setModalVisible(false);
                fetchAlbums();
            }
        } catch (err) {
            Alert.alert('Gagal', err.message || 'Tidak dapat membuat album');
        } finally {
            setCreating(false);
        }
    };

    const renderHeader = () => (
        <View style={styles.headerArea}>
            <View style={styles.headerTop}>
                <Text style={styles.screenTitle}>Album</Text>
                <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => setModalVisible(true)}
                    activeOpacity={0.7}
                >
                    <SFSymbol name="plus" size={17} color="#0A84FF" weight="semibold" />
                    <Text style={styles.addBtnText}>Album</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.subHeading}>Album Saya</Text>
        </View>
    );

    const renderFooter = () => (
        <View style={styles.footerArea}>
            <Text style={styles.subHeading}>Jenis Media</Text>
            <View style={styles.mediaTypesCard}>
                <TouchableOpacity
                    style={styles.typeRow}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('Library', { filterType: 'image' })}
                >
                    <View style={styles.typeLeft}>
                        <View style={[styles.typeIconBubble, { backgroundColor: 'rgba(10, 132, 255, 0.15)' }]}>
                            <SFSymbol name="photos" size={17} color="#0A84FF" />
                        </View>
                        <Text style={styles.typeLabel}>Foto</Text>
                    </View>
                    <SFSymbol name="chevron.right" size={13} color="#8E8E93" />
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity
                    style={styles.typeRow}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('Library', { filterType: 'video' })}
                >
                    <View style={styles.typeLeft}>
                        <View style={[styles.typeIconBubble, { backgroundColor: 'rgba(175, 82, 222, 0.15)' }]}>
                            <SFSymbol name="play" size={15} color="#AF52DE" />
                        </View>
                        <Text style={styles.typeLabel}>Video</Text>
                    </View>
                    <SFSymbol name="chevron.right" size={13} color="#8E8E93" />
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity
                    style={styles.typeRow}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('Favorites')}
                >
                    <View style={styles.typeLeft}>
                        <View style={[styles.typeIconBubble, { backgroundColor: 'rgba(255, 55, 95, 0.15)' }]}>
                            <SFSymbol name="heart" size={16} color="#FF375F" focused />
                        </View>
                        <Text style={styles.typeLabel}>Favorit</Text>
                    </View>
                    <SFSymbol name="chevron.right" size={13} color="#8E8E93" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {loading ? (
                <View style={styles.centerLoader}>
                    <ActivityIndicator size="large" color={THEME.colors.accent} />
                </View>
            ) : (
                <FlatList
                    data={albums}
                    keyExtractor={(item) => String(item.id)}
                    numColumns={2}
                    ListHeaderComponent={renderHeader}
                    ListFooterComponent={renderFooter}
                    contentContainerStyle={styles.listContainer}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.colors.accent} />
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.albumCard}
                            activeOpacity={0.8}
                            onPress={() => navigation.navigate('Library', { albumId: item.id, albumName: item.name })}
                        >
                            <View style={styles.coverWrapper}>
                                {item.cover_url ? (
                                    <SecureImage source={item.cover_url} style={styles.coverImage} resizeMode="cover" />
                                ) : (
                                    <View style={styles.emptyCover}>
                                        <SFSymbol name="folder" size={38} color="#8E8E93" />
                                    </View>
                                )}
                                <View style={styles.badgeCount}>
                                    <Text style={styles.badgeText}>{item.media_count}</Text>
                                </View>
                            </View>
                            <Text style={styles.albumTitle} numberOfLines={1}>
                                {item.name}
                            </Text>
                            <Text style={styles.albumCount}>
                                {item.media_count} foto &amp; video
                            </Text>
                        </TouchableOpacity>
                    )}
                />
            )}

            {/* Create Album Modal */}
            <Modal visible={modalVisible} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Buat Album Baru</Text>
                        <Text style={styles.modalSub}>Masukkan nama untuk album baru ini:</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Nama Album"
                            placeholderTextColor="#8e8e93"
                            value={newAlbumName}
                            onChangeText={setNewAlbumName}
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.mBtn, styles.mBtnCancel]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.mBtnCancelText}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.mBtn, styles.mBtnSave]}
                                onPress={handleCreateAlbum}
                                disabled={creating}
                            >
                                {creating ? (
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <Text style={styles.mBtnSaveText}>Simpan</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.colors.background,
    },
    listContainer: {
        paddingHorizontal: 16,
        paddingTop: 48,
        paddingBottom: 90,
    },
    headerArea: {
        marginBottom: 16,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    screenTitle: {
        fontSize: 32,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: -0.6,
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    addBtnText: {
        color: '#0A84FF',
        fontSize: 14,
        fontWeight: '600',
    },
    subHeading: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: -0.4,
        marginBottom: 14,
    },
    albumCard: {
        width: ALBUM_CARD_WIDTH,
        marginRight: 16,
        marginBottom: 20,
    },
    coverWrapper: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#1c1c1e',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        position: 'relative',
    },
    coverImage: {
        width: '100%',
        height: '100%',
    },
    emptyCover: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyFolderEmoji: {
        fontSize: 40,
        opacity: 0.5,
    },
    badgeCount: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    badgeText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '600',
    },
    albumTitle: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 6,
    },
    albumCount: {
        color: THEME.colors.textSecondary,
        fontSize: 12,
        marginTop: 2,
    },
    footerArea: {
        marginTop: 20,
    },
    mediaTypesCard: {
        backgroundColor: '#1c1c1e',
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    typeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    typeLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    typeIconBubble: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconEmoji: {
        fontSize: 16,
    },
    typeLabel: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '500',
    },
    typeChevron: {
        color: '#636366',
        fontSize: 20,
        fontWeight: '400',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        marginLeft: 60,
    },
    centerLoader: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    modalBox: {
        backgroundColor: '#1c1c1e',
        borderRadius: 18,
        padding: 20,
        width: '100%',
        maxWidth: 320,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    modalTitle: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 6,
    },
    modalSub: {
        color: '#8e8e93',
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 16,
    },
    modalInput: {
        backgroundColor: '#2c2c2e',
        color: '#ffffff',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        fontSize: 15,
        marginBottom: 18,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    mBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mBtnCancel: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    mBtnCancelText: {
        color: '#ffffff',
        fontWeight: '600',
    },
    mBtnSave: {
        backgroundColor: THEME.colors.accent,
    },
    mBtnSaveText: {
        color: '#ffffff',
        fontWeight: '600',
    },
});
