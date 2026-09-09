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
    RefreshControl,
} from 'react-native';
import { THEME } from '../constants/theme';
import { ApiService } from '../services/api';
import PhotoViewerModal from '../components/PhotoViewerModal';
import SecureImage from '../components/SecureImage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_MARGIN = 2;
const ITEM_SIZE = (SCREEN_WIDTH - ITEM_MARGIN * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

export default function FavoritesScreen() {
    const [mediaItems, setMediaItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [viewerVisible, setViewerVisible] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(0);

    const fetchFavorites = useCallback(async () => {
        try {
            setLoading(true);
            const res = await ApiService.getMedia({ favorite: 1, per_page: 50 });
            if (res.success) {
                setMediaItems(res.data);
            }
        } catch (e) {
            console.warn('Fetch favorites error', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchFavorites();
    }, [fetchFavorites]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchFavorites();
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.screenTitle}>Favorit ❤️</Text>
                <Text style={styles.subTitle}>{mediaItems.length} foto &amp; video favorit</Text>
            </View>

            {loading ? (
                <View style={styles.centerLoader}>
                    <ActivityIndicator size="large" color={THEME.colors.favorite} />
                </View>
            ) : (
                <FlatList
                    data={mediaItems}
                    keyExtractor={(item) => String(item.id)}
                    numColumns={COLUMN_COUNT}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.colors.favorite} />
                    }
                    renderItem={({ item, index }) => (
                        <TouchableOpacity
                            style={styles.gridItem}
                            activeOpacity={0.8}
                            onPress={() => {
                                setSelectedIdx(index);
                                setViewerVisible(true);
                            }}
                        >
                            <SecureImage
                                source={item.thumbnail_url || item.stream_url}
                                style={styles.itemImage}
                                resizeMode="cover"
                            />
                            {item.type === 'video' && (
                                <View style={styles.videoBadge}>
                                    <Text style={styles.videoBadgeText}>▶</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <Text style={styles.emptyIcon}>🤍</Text>
                            <Text style={styles.emptyTitle}>Belum Ada Foto Favorit</Text>
                            <Text style={styles.emptyDesc}>
                                Beri tanda hati (❤️) pada foto di perpustakaan agar muncul di sini.
                            </Text>
                        </View>
                    }
                />
            )}

            <PhotoViewerModal
                visible={viewerVisible}
                items={mediaItems}
                initialIndex={selectedIdx}
                onClose={() => setViewerVisible(false)}
                onMediaUpdated={() => fetchFavorites()}
                onMediaDeleted={() => fetchFavorites()}
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
    },
    subTitle: {
        fontSize: 12,
        color: THEME.colors.textSecondary,
        marginTop: 2,
    },
    listContent: {
        paddingBottom: 90,
    },
    gridItem: {
        width: ITEM_SIZE,
        height: ITEM_SIZE,
        marginRight: ITEM_MARGIN,
        marginBottom: ITEM_MARGIN,
        position: 'relative',
        backgroundColor: '#121214',
    },
    itemImage: {
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
    videoBadgeText: {
        color: '#ffffff',
        fontSize: 9,
    },
    centerLoader: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 120,
        paddingHorizontal: 30,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 12,
        opacity: 0.5,
    },
    emptyTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 6,
    },
    emptyDesc: {
        color: THEME.colors.textSecondary,
        fontSize: 13,
        textAlign: 'center',
    },
});
