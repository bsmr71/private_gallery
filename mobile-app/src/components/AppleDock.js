import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import SFSymbol from './SFSymbol';

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
        <View style={styles.dockOuter}>
            <BlurView tint="dark" intensity={90} style={StyleSheet.absoluteFill} />
            <View style={styles.dockInner}>
                {/* Share */}
                <TouchableOpacity style={styles.dockBtn} onPress={onShare} activeOpacity={0.6}>
                    <SFSymbol name="share" size={21} color="#0A84FF" />
                    <Text style={styles.dockLabel}>Bagikan</Text>
                </TouchableOpacity>

                {/* Favorite */}
                <TouchableOpacity style={styles.dockBtn} onPress={onFavorite} activeOpacity={0.6}>
                    <SFSymbol
                        name="heart"
                        size={21}
                        color={item.is_favorite ? '#FF375F' : '#ffffff'}
                        focused={item.is_favorite}
                    />
                    <Text style={[styles.dockLabel, item.is_favorite && styles.favLabelActive]}>
                        Favorit
                    </Text>
                </TouchableOpacity>

                {/* Info */}
                <TouchableOpacity style={styles.dockBtn} onPress={onInfo} activeOpacity={0.6}>
                    <SFSymbol name="info" size={21} color="#ffffff" />
                    <Text style={styles.dockLabel}>Info</Text>
                </TouchableOpacity>

                {/* Move / Album */}
                <TouchableOpacity style={styles.dockBtn} onPress={onMove} activeOpacity={0.6}>
                    <SFSymbol name="folder" size={21} color="#ffffff" />
                    <Text style={styles.dockLabel}>Album</Text>
                </TouchableOpacity>

                {/* Delete */}
                <TouchableOpacity style={styles.dockBtn} onPress={onDelete} activeOpacity={0.6}>
                    <SFSymbol name="trash" size={21} color="#FF453A" />
                    <Text style={[styles.dockLabel, styles.dangerLabel]}>Hapus</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    dockOuter: {
        borderRadius: 28,
        overflow: 'hidden',
        alignSelf: 'center',
        width: '92%',
        marginBottom: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.18)',
        backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(28, 28, 32, 0.88)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.55,
        shadowRadius: 20,
        elevation: 12,
    },
    dockInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    dockBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 2,
        paddingHorizontal: 10,
        minWidth: 52,
    },
    dockLabel: {
        color: '#EBEBF5',
        fontSize: 10,
        fontWeight: '500',
        letterSpacing: -0.2,
        marginTop: 4,
    },
    favLabelActive: {
        color: '#FF375F',
        fontWeight: '600',
    },
    dangerLabel: {
        color: '#FF453A',
        fontWeight: '600',
    },
});
