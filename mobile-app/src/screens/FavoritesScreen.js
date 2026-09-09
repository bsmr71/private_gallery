import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { THEME } from '../constants/theme';
import { ApiService } from '../services/api';
import PhotoViewerModal from '../components/PhotoViewerModal';
import SecureImage from '../components/SecureImage';
import SFSymbol from '../components/SFSymbol';
import { SecurityService, useDecoyMode, useAppLocked } from '../services/securityService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_MARGIN = 2;
const ITEM_SIZE = (SCREEN_WIDTH - ITEM_MARGIN * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

export default function FavoritesScreen() {
    const isDecoy = useDecoyMode();
    const isLocked = useAppLocked();
    const [mediaItems, setMediaItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [viewerVisible, setViewerVisible] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(0);

    const fetchFavorites = useCallback(async () => {
        if (SecurityService.isDecoyMode()) {
            setMediaItems([]);
            setLoading(false);
            setRefreshing(false);
            return;
        }

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
        if (!isDecoy) {
            fetchFavorites();
        } else {
            setMediaItems([]);
            setViewerVisible(false);
        }
    }, [isDecoy, fetchFavorites]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchFavorites();
    };

    const displayedItems = (isDecoy || isLocked) ? [] : mediaItems;

    if (isLocked) {
        return (
            <View style={styles.container}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }]} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Apple Photos Large Title Header */}
            <View style={styles.header}>
                <Text style={styles.screenTitle}>Favorit</Text>
                <Text style={styles.subTitle}>
                    {displayedItems.length > 0
                        ? `${displayedItems.length} foto & video ditandai`
                        : 'Belum ada favorit'}
                </Text>
            </View>

            {loading ? (
                <View style={styles.centerLoader}>
                    <ActivityIndicator size="small" color="#0A84FF" />
                </View>
            ) : (
                <FlatList
                    data={displayedItems}
                    keyExtractor={(item) => String(item.id)}
                    numColumns={COLUMN_COUNT}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0A84FF" />
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
                                    <SFSymbol name="play.fill" size={8} color="#ffffff" />
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <View style={styles.emptyIconCircle}>
                                <SFSymbol name="heart" size={48} color="#48484a" />
                            </View>
                            <Text style={styles.emptyTitle}>Belum Ada Foto Favorit</Text>
                            <Text style={styles.emptyDesc}>
                                Ketuk ikon hati pada foto atau video untuk menambahkannya ke album Favorit Anda.
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
        backgroundColor: '#000000',
    },
    header: {
        paddingTop: 54,
        paddingBottom: 12,
        paddingHorizontal: 20,
    },
    screenTitle: {
        fontSize: 34,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: 0.38,
    },
    subTitle: {
        fontSize: 13,
        color: '#8E8E93',
        marginTop: 4,
    },
    listContent: {
        paddingBottom: 120,
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
    centerLoader: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
        paddingHorizontal: 36,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#1c1c1e',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 8,
    },
    emptyDesc: {
        color: '#8E8E93',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
});
