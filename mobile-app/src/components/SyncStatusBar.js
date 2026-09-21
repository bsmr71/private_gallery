import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
    Platform,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import SFSymbol from './SFSymbol';
import { SyncService } from '../services/syncService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SyncStatusBar({ onOpenSyncModal }) {
    const insets = useSafeAreaInsets();
    const [syncState, setSyncState] = useState({
        isSyncing: false,
        percentage: 0,
        current: 0,
        total: 0,
        currentFilename: '',
        successCount: 0,
    });
    const [visible, setVisible] = useState(false);

    // Smooth animated progress width
    const progressAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const unsubscribe = SyncService.subscribe((state) => {
            setSyncState(state);

            if (state.isSyncing) {
                setVisible(true);
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }).start();

                Animated.timing(progressAnim, {
                    toValue: Math.max(2, Math.min(100, state.percentage || 0)),
                    duration: 300,
                    useNativeDriver: false,
                }).start();
            } else if (state.isPaused) {
                setVisible(true);
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }).start();

                const timer = setTimeout(() => {
                    Animated.timing(fadeAnim, {
                        toValue: 0,
                        duration: 350,
                        useNativeDriver: true,
                    }).start(() => {
                        setVisible(false);
                    });
                }, 6000);

                return () => clearTimeout(timer);
            } else if ((state.successCount > 0 || state.failCount > 0) && !state.isSyncing) {
                // Completed: show 100% and fade out after 4 seconds
                Animated.timing(progressAnim, {
                    toValue: 100,
                    duration: 200,
                    useNativeDriver: false,
                }).start();

                const timer = setTimeout(() => {
                    Animated.timing(fadeAnim, {
                        toValue: 0,
                        duration: 350,
                        useNativeDriver: true,
                    }).start(() => {
                        setVisible(false);
                        progressAnim.setValue(0);
                    });
                }, 4000);

                return () => clearTimeout(timer);
            } else {
                setVisible(false);
                progressAnim.setValue(0);
            }
        });

        return unsubscribe;
    }, []);

    if (!visible) return null;

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
    });

    const isPaused = syncState.isPaused;
    const hasFails = (syncState.failCount || 0) > 0;
    const isDone = !syncState.isSyncing && !isPaused && ((syncState.successCount || 0) > 0 || hasFails);

    // Calculate safe margin: TabBar height is 50 + bottomPadding
    const bottomPadding = Math.max(insets.bottom, 12);
    const tabBarHeight = 50 + bottomPadding;
    const bottomOffset = tabBarHeight + 10;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    opacity: fadeAnim,
                },
            ]}
            pointerEvents="box-none"
        >
            {/* 1. Full-Width Glowing Progress Line Docked Right Above the Tab Bar */}
            <View style={[styles.tabBarEdgeTrack, { bottom: tabBarHeight }]}>
                <Animated.View
                    style={[
                        styles.statusBarFill,
                        {
                            width: progressWidth,
                            backgroundColor: isPaused ? '#FF9F0A' : (isDone ? (hasFails ? '#FF9F0A' : '#30D158') : '#0A84FF'),
                            shadowColor: isPaused ? '#FF9F0A' : (isDone ? (hasFails ? '#FF9F0A' : '#30D158') : '#0A84FF'),
                        },
                    ]}
                />
            </View>

            {/* 2. Apple Photos Docked Floating Pill (Safely Above Bottom Tab Buttons) */}
            <View style={[styles.pillContainer, { bottom: bottomOffset }]} pointerEvents="box-none">
                <TouchableOpacity
                    style={styles.pillWrap}
                    activeOpacity={0.85}
                    onPress={() => onOpenSyncModal && onOpenSyncModal()}
                >
                <BlurView tint="dark" intensity={80} style={StyleSheet.absoluteFill} />
                <View style={styles.pillContent}>
                    {/* Icon */}
                    <View style={styles.iconBox}>
                        {isPaused ? (
                            <SFSymbol name="exclamationmark.triangle" size={13} color="#FF9F0A" />
                        ) : isDone ? (
                            hasFails && syncState.successCount === 0 ? (
                                <SFSymbol name="xmark.circle" size={13} color="#FF453A" />
                            ) : hasFails ? (
                                <SFSymbol name="exclamationmark.triangle" size={13} color="#FF9F0A" />
                            ) : (
                                <SFSymbol name="checkmark" size={13} color="#30D158" />
                            )
                        ) : (
                            <SFSymbol name="arrow.triangle.2.circlepath" size={13} color="#0A84FF" />
                        )}
                    </View>

                    {/* Text Details & Mini Progress */}
                    <View style={styles.textBox}>
                        <Text style={styles.pillTitle} numberOfLines={1}>
                            {isPaused
                                ? (syncState.pauseReason || 'Jaringan terputus (dijeda)')
                                : isDone
                                ? (hasFails
                                    ? `${syncState.successCount || 0} sukses, ${syncState.failCount} gagal/terlewat`
                                    : `${syncState.successCount} berkas tersinkronkan ke Cloud`)
                                : `${syncState.currentFilename || 'Menyinkronkan'} (${syncState.current}/${syncState.total})`}
                        </Text>
                        {!isDone && !isPaused && (
                            <View style={styles.miniTrack}>
                                <Animated.View
                                    style={[
                                        styles.miniFill,
                                        { width: progressWidth },
                                    ]}
                                />
                            </View>
                        )}
                    </View>

                    {/* Percentage / Status Badge */}
                    <View style={[
                        styles.badge,
                        isDone && !hasFails && styles.badgeSuccess,
                        (isPaused || (isDone && hasFails)) && styles.badgeWarning,
                    ]}>
                        <Text style={[
                            styles.badgeText,
                            isDone && !hasFails && styles.badgeTextSuccess,
                            (isPaused || (isDone && hasFails)) && styles.badgeTextWarning,
                        ]}>
                            {isPaused ? 'Dijeda' : isDone ? (hasFails ? 'Selesai Sebagian' : 'Selesai') : `${syncState.percentage}%`}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        </View>
    </Animated.View>
);
}

const styles = StyleSheet.create({
container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
},
tabBarEdgeTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
},
pillContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
},
statusBarFill: {
    height: '100%',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
},
pillWrap: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: Platform.OS === 'android' ? 'rgba(18, 18, 22, 0.95)' : 'transparent',
        maxWidth: SCREEN_WIDTH - 32,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
        elevation: 8,
    },
    pillContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 7,
        paddingHorizontal: 12,
    },
    iconBox: {
        marginRight: 8,
    },
    textBox: {
        maxWidth: SCREEN_WIDTH - 150,
        marginRight: 10,
    },
    pillTitle: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    miniTrack: {
        width: '100%',
        height: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 1.5,
        marginTop: 4,
        overflow: 'hidden',
    },
    miniFill: {
        height: '100%',
        backgroundColor: '#0A84FF',
        borderRadius: 1.5,
    },
    badge: {
        backgroundColor: 'rgba(10, 132, 255, 0.18)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(10, 132, 255, 0.4)',
    },
    badgeSuccess: {
        backgroundColor: 'rgba(48, 209, 88, 0.18)',
        borderColor: 'rgba(48, 209, 88, 0.4)',
    },
    badgeWarning: {
        backgroundColor: 'rgba(255, 159, 10, 0.18)',
        borderColor: 'rgba(255, 159, 10, 0.4)',
    },
    badgeText: {
        color: '#0A84FF',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    badgeTextSuccess: {
        color: '#30D158',
    },
    badgeTextWarning: {
        color: '#FF9F0A',
    },
});
