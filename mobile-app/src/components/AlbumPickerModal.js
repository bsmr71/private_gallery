import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    FlatList,
    TextInput,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { THEME } from '../constants/theme';
import { ApiService } from '../services/api';
import SecureImage from './SecureImage';
import SFSymbol from './SFSymbol';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AlbumPickerModal({
    visible,
    mediaIds = [],
    onClose,
    onSuccess,
}) {
    const [mode, setMode] = useState('move'); // 'move' or 'copy'
    const [albums, setAlbums] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [creatingNew, setCreatingNew] = useState(false);
    const [newAlbumName, setNewAlbumName] = useState('');

    const fetchAlbums = useCallback(async () => {
        try {
            setLoading(true);
            const res = await ApiService.getAlbums();
            if (res && res.success) {
                setAlbums(res.data || []);
            }
        } catch (e) {
            console.warn('Failed to fetch albums', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (visible) {
            fetchAlbums();
            setCreatingNew(false);
            setNewAlbumName('');
            setProcessing(false);
        }
    }, [visible, fetchAlbums]);

    const handleSelectAlbum = async (albumId = null, newName = null) => {
        if (!mediaIds || mediaIds.length === 0) {
            Alert.alert('Peringatan', 'Tidak ada media yang dipilih.');
            return;
        }

        setProcessing(true);
        try {
            let res;
            if (mode === 'move') {
                res = await ApiService.moveMedia(mediaIds, albumId, newName);
            } else {
                res = await ApiService.copyMedia(mediaIds, albumId, newName);
            }

            if (res && res.success) {
                Alert.alert(
                    mode === 'move' ? 'Berhasil Dipindahkan' : 'Berhasil Disalin',
                    res.message || 'Operasi berhasil dilakukan.'
                );
                onSuccess && onSuccess({
                    mode,
                    targetAlbumId: res.target_album_id,
                    targetAlbumName: res.target_album_name,
                    count: mediaIds.length,
                });
                onClose();
            } else {
                throw new Error(res?.error || 'Gagal memproses media');
            }
        } catch (err) {
            Alert.alert('Gagal', err.message || 'Terjadi kesalahan saat menyimpan ke album.');
        } finally {
            setProcessing(false);
        }
    };

    const handleCreateAndAssign = () => {
        const trimmed = newAlbumName.trim();
        if (!trimmed) {
            Alert.alert('Nama Album Kosong', 'Silakan masukkan nama album baru.');
            return;
        }
        handleSelectAlbum(null, trimmed);
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.backdrop}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={processing ? undefined : onClose}
                />

                <View style={styles.sheetContainer}>
                    <BlurView tint="dark" intensity={95} style={StyleSheet.absoluteFill} />

                    {/* Grabber indicator */}
                    <View style={styles.grabber} />

                    {/* Header */}
                    <View style={styles.header}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.headerTitle}>Atur Album</Text>
                            <Text style={styles.headerSubtitle}>
                                {mediaIds.length} media dipilih
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={onClose}
                            disabled={processing}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <SFSymbol name="xmark" size={16} color="#8E8E93" />
                        </TouchableOpacity>
                    </View>

                    {/* Segmented Mode Selector (Pindahkan / Salin) */}
                    <View style={styles.segmentedContainer}>
                        <TouchableOpacity
                            style={[
                                styles.segmentBtn,
                                mode === 'move' && styles.segmentBtnActive,
                            ]}
                            onPress={() => setMode('move')}
                            disabled={processing}
                            activeOpacity={0.7}
                        >
                            <SFSymbol
                                name="folder"
                                size={14}
                                color={mode === 'move' ? '#ffffff' : '#8E8E93'}
                                style={{ marginRight: 6 }}
                            />
                            <Text
                                style={[
                                    styles.segmentText,
                                    mode === 'move' && styles.segmentTextActive,
                                ]}
                            >
                                Pindahkan
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.segmentBtn,
                                mode === 'copy' && styles.segmentBtnActive,
                            ]}
                            onPress={() => setMode('copy')}
                            disabled={processing}
                            activeOpacity={0.7}
                        >
                            <SFSymbol
                                name="square.on.square"
                                size={14}
                                color={mode === 'copy' ? '#ffffff' : '#8E8E93'}
                                style={{ marginRight: 6 }}
                            />
                            <Text
                                style={[
                                    styles.segmentText,
                                    mode === 'copy' && styles.segmentTextActive,
                                ]}
                            >
                                Salin (Duplikat)
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.modeDescription}>
                        {mode === 'move'
                            ? 'Media akan dipindahkan ke album tujuan.'
                            : 'Salinan baru akan dibuat dan dimasukkan ke album tujuan.'}
                    </Text>

                    {/* Processing overlay */}
                    {processing && (
                        <View style={styles.processingOverlay}>
                            <ActivityIndicator size="large" color="#0A84FF" />
                            <Text style={styles.processingText}>
                                {mode === 'move' ? 'Memindahkan media...' : 'Menyalin media...'}
                            </Text>
                        </View>
                    )}

                    {/* New Album Creation Form or Toggle */}
                    {!creatingNew ? (
                        <TouchableOpacity
                            style={styles.createNewBtn}
                            onPress={() => setCreatingNew(true)}
                            disabled={processing}
                            activeOpacity={0.7}
                        >
                            <View style={styles.createNewIcon}>
                                <SFSymbol name="plus" size={16} color="#0A84FF" weight="bold" />
                            </View>
                            <Text style={styles.createNewText}>+ Buat Album Baru</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.newAlbumBox}>
                            <TextInput
                                style={styles.newAlbumInput}
                                placeholder="Nama album baru..."
                                placeholderTextColor="#8E8E93"
                                value={newAlbumName}
                                onChangeText={setNewAlbumName}
                                autoFocus
                                returnKeyType="done"
                                onSubmitEditing={handleCreateAndAssign}
                                editable={!processing}
                            />
                            <View style={styles.newAlbumActions}>
                                <TouchableOpacity
                                    style={styles.cancelNewBtn}
                                    onPress={() => {
                                        setCreatingNew(false);
                                        setNewAlbumName('');
                                    }}
                                    disabled={processing}
                                >
                                    <Text style={styles.cancelNewText}>Batal</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.saveNewBtn,
                                        !newAlbumName.trim() && { opacity: 0.5 },
                                    ]}
                                    onPress={handleCreateAndAssign}
                                    disabled={processing || !newAlbumName.trim()}
                                >
                                    <Text style={styles.saveNewText}>
                                        {mode === 'move' ? 'Buat & Pindahkan' : 'Buat & Salin'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Album List */}
                    {loading ? (
                        <View style={styles.centerLoading}>
                            <ActivityIndicator size="small" color="#0A84FF" />
                            <Text style={styles.loadingText}>Memuat album...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={albums}
                            keyExtractor={(item) => String(item.id)}
                            style={styles.list}
                            contentContainerStyle={styles.listContent}
                            ListHeaderComponent={
                                mode === 'move' ? (
                                    <TouchableOpacity
                                        style={styles.albumRow}
                                        onPress={() => handleSelectAlbum(null)}
                                        disabled={processing}
                                        activeOpacity={0.7}
                                    >
                                        <View style={[styles.albumThumb, styles.albumThumbEmpty]}>
                                            <SFSymbol name="trash" size={18} color="#8E8E93" />
                                        </View>
                                        <View style={styles.albumInfo}>
                                            <Text style={styles.albumTitle}>Tanpa Album</Text>
                                            <Text style={styles.albumCount}>Keluarkan dari album saat ini</Text>
                                        </View>
                                        <SFSymbol name="chevron.right" size={13} color="#636366" />
                                    </TouchableOpacity>
                                ) : null
                            }
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.albumRow}
                                    onPress={() => handleSelectAlbum(item.id)}
                                    disabled={processing}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.albumThumb}>
                                        {item.cover_url ? (
                                            <SecureImage
                                                source={item.cover_url}
                                                style={StyleSheet.absoluteFill}
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <SFSymbol name="folder" size={20} color="#8E8E93" />
                                        )}
                                    </View>
                                    <View style={styles.albumInfo}>
                                        <Text style={styles.albumTitle} numberOfLines={1}>
                                            {item.name}
                                        </Text>
                                        <Text style={styles.albumCount}>
                                            {item.media_count} foto & video
                                        </Text>
                                    </View>
                                    <SFSymbol name="chevron.right" size={13} color="#636366" />
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                !loading && (
                                    <View style={styles.emptyWrap}>
                                        <Text style={styles.emptyText}>
                                            Belum ada album. Buat album baru di atas.
                                        </Text>
                                    </View>
                                )
                            }
                        />
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        maxHeight: SCREEN_HEIGHT * 0.78,
        minHeight: SCREEN_HEIGHT * 0.5,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#1C1C1E',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    grabber: {
        width: 38,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    headerSubtitle: {
        color: '#8E8E93',
        fontSize: 13,
        marginTop: 2,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentedContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 10,
        marginHorizontal: 20,
        marginTop: 6,
        padding: 3,
    },
    segmentBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 8,
    },
    segmentBtnActive: {
        backgroundColor: '#0A84FF',
    },
    segmentText: {
        color: '#8E8E93',
        fontSize: 13,
        fontWeight: '600',
    },
    segmentTextActive: {
        color: '#ffffff',
    },
    modeDescription: {
        color: 'rgba(235, 235, 245, 0.6)',
        fontSize: 12,
        marginHorizontal: 22,
        marginTop: 6,
        marginBottom: 10,
    },
    createNewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        marginVertical: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(10, 132, 255, 0.12)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(10, 132, 255, 0.3)',
    },
    createNewIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(10, 132, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    createNewText: {
        color: '#0A84FF',
        fontSize: 14,
        fontWeight: '600',
    },
    newAlbumBox: {
        marginHorizontal: 20,
        marginVertical: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.07)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(10, 132, 255, 0.4)',
    },
    newAlbumInput: {
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: 8,
        color: '#ffffff',
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 14,
    },
    newAlbumActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 10,
        gap: 10,
    },
    cancelNewBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    cancelNewText: {
        color: '#8E8E93',
        fontSize: 13,
        fontWeight: '500',
    },
    saveNewBtn: {
        backgroundColor: '#0A84FF',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 8,
    },
    saveNewText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingVertical: 6,
    },
    albumRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    albumThumb: {
        width: 44,
        height: 44,
        borderRadius: 8,
        backgroundColor: '#2C2C2E',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    albumThumbEmpty: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    albumInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    albumTitle: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '600',
    },
    albumCount: {
        color: '#8E8E93',
        fontSize: 12,
        marginTop: 2,
    },
    centerLoading: {
        paddingVertical: 32,
        alignItems: 'center',
    },
    loadingText: {
        color: '#8E8E93',
        fontSize: 13,
        marginTop: 8,
    },
    emptyWrap: {
        paddingVertical: 24,
        alignItems: 'center',
    },
    emptyText: {
        color: '#8E8E93',
        fontSize: 13,
    },
    processingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        zIndex: 99,
        alignItems: 'center',
        justifyContent: 'center',
    },
    processingText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 12,
    },
});
