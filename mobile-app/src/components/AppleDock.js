import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { THEME } from '../constants/theme';

export default function AppleDock({
    item,
    onFavorite,
    onInfo,
    onShare,
    onMove,
    onDelete,
}) {
    if (!item) return null;

    return (
        <View style={styles.dockContainer}>
            {/* Share */}
            <TouchableOpacity style={styles.dockBtn} onPress={onShare} activeOpacity={0.7}>
                <Text style={styles.dockIcon}>📤</Text>
                <Text style={styles.dockLabel}>Bagikan</Text>
            </TouchableOpacity>

            {/* Favorite */}
            <TouchableOpacity style={styles.dockBtn} onPress={onFavorite} activeOpacity={0.7}>
                <Text style={[styles.dockIcon, item.is_favorite && styles.favIconActive]}>
                    {item.is_favorite ? '❤️' : '🤍'}
                </Text>
                <Text style={[styles.dockLabel, item.is_favorite && styles.favLabelActive]}>
                    Favorit
                </Text>
            </TouchableOpacity>

            {/* Info */}
            <TouchableOpacity style={styles.dockBtn} onPress={onInfo} activeOpacity={0.7}>
                <Text style={styles.dockIcon}>ℹ️</Text>
                <Text style={styles.dockLabel}>Info</Text>
            </TouchableOpacity>

            {/* Move / Album */}
            <TouchableOpacity style={styles.dockBtn} onPress={onMove} activeOpacity={0.7}>
                <Text style={styles.dockIcon}>📁</Text>
                <Text style={styles.dockLabel}>Album</Text>
            </TouchableOpacity>

            {/* Delete */}
            <TouchableOpacity style={styles.dockBtn} onPress={onDelete} activeOpacity={0.7}>
                <Text style={[styles.dockIcon, styles.dangerIcon]}>🗑️</Text>
                <Text style={[styles.dockLabel, styles.dangerLabel]}>Hapus</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    dockContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: THEME.colors.glass,
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: THEME.radius.full,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        alignSelf: 'center',
        width: '90%',
        marginBottom: 10,
        elevation: 8,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
    },
    dockBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    dockIcon: {
        fontSize: 18,
        marginBottom: 2,
    },
    dockLabel: {
        color: '#cbd5e1',
        fontSize: 10,
        fontWeight: '500',
    },
    favIconActive: {
        transform: [{ scale: 1.1 }],
    },
    favLabelActive: {
        color: THEME.colors.favorite,
        fontWeight: '600',
    },
    dangerIcon: {
        opacity: 0.9,
    },
    dangerLabel: {
        color: '#f87171',
    },
});
