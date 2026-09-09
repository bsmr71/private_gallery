import React, { useRef, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, Image, StyleSheet, Text } from 'react-native';
import { THEME } from '../constants/theme';

export default function Filmstrip({ items, activeIndex, onSelectIndex }) {
    const listRef = useRef(null);

    useEffect(() => {
        if (listRef.current && activeIndex >= 0 && activeIndex < items.length) {
            listRef.current.scrollToIndex({
                index: activeIndex,
                animated: true,
                viewPosition: 0.5, // Center the active item
            });
        }
    }, [activeIndex, items.length]);

    if (!items || items.length <= 1) return null;

    return (
        <View style={styles.container}>
            <FlatList
                ref={listRef}
                data={items}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, index) => `${item.id}-${index}`}
                contentContainerStyle={styles.listContent}
                getItemLayout={(data, index) => ({
                    length: 44, // 38px width + 6px margin
                    offset: 44 * index,
                    index,
                })}
                onScrollToIndexFailed={(info) => {
                    setTimeout(() => {
                        listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
                    }, 100);
                }}
                renderItem={({ item, index }) => {
                    const isActive = index === activeIndex;
                    return (
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => onSelectIndex(index)}
                            style={[
                                styles.thumbWrap,
                                isActive && styles.thumbWrapActive,
                            ]}
                        >
                            <Image
                                source={{ uri: item.thumbnail_url || item.stream_url }}
                                style={styles.thumbImage}
                                resizeMode="cover"
                            />
                            {item.type === 'video' && (
                                <View style={styles.videoIndicator}>
                                    <Text style={styles.videoText}>▶</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 54,
        backgroundColor: THEME.colors.filmstripBg,
        borderRadius: 12,
        marginHorizontal: 12,
        marginBottom: 8,
        paddingVertical: 4,
        paddingHorizontal: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
    },
    listContent: {
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    thumbWrap: {
        width: 36,
        height: 44,
        borderRadius: 6,
        overflow: 'hidden',
        marginRight: 8,
        opacity: 0.45,
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    thumbWrapActive: {
        opacity: 1,
        transform: [{ scale: 1.15 }],
        borderColor: THEME.colors.filmstripActiveBorder,
        elevation: 6,
        shadowColor: '#ffffff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 6,
    },
    thumbImage: {
        width: '100%',
        height: '100%',
    },
    videoIndicator: {
        position: 'absolute',
        bottom: 2,
        right: 2,
    },
    videoText: {
        color: '#ffffff',
        fontSize: 8,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
});
