import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar, ActivityIndicator, Platform, LogBox, AppState, Text, Alert, Image } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { THEME } from './src/constants/theme';
import { StorageService } from './src/services/storage';
import { SecurityService } from './src/services/securityService';
import { ApiService } from './src/services/api';
import * as ScreenCapture from 'expo-screen-capture';
import AppLockOverlay from './src/components/AppLockOverlay';
import SFSymbol from './src/components/SFSymbol';
import { LocalVaultService } from './src/services/localVaultService';

// Suppress harmless development connection warnings so user screen remains clean
LogBox.ignoreLogs([
    'Cannot connect to Expo CLI',
    'Unsupported FormDataPart',
]);

import LibraryScreen from './src/screens/LibraryScreen';
import AlbumsScreen from './src/screens/AlbumsScreen';
import FavoritesScreen from './src/screens/FavoritesScreen';
import SearchScreen from './src/screens/SearchScreen';
import LoginScreen from './src/screens/LoginScreen';

const Tab = createBottomTabNavigator();

const appTheme = {
    ...DarkTheme,
    colors: {
        ...DarkTheme.colors,
        primary: '#0A84FF',
        background: '#000000',
        card: '#121214',
        text: '#ffffff',
        border: 'rgba(255, 255, 255, 0.08)',
        notification: '#FF375F',
    },
};

function MainTabs({ onLogout }) {
    const insets = useSafeAreaInsets();
    const bottomPadding = Math.max(insets.bottom, 12);

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: '#0A84FF',
                tabBarInactiveTintColor: '#8E8E93',
                tabBarStyle: {
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(18, 18, 22, 0.88)',
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: 'rgba(255, 255, 255, 0.14)',
                    height: 50 + bottomPadding,
                    paddingBottom: bottomPadding - 2,
                    paddingTop: 6,
                    elevation: 0,
                },
                tabBarBackground: Platform.OS === 'ios' ? () => (
                    <BlurView
                        tint="dark"
                        intensity={90}
                        style={StyleSheet.absoluteFill}
                    />
                ) : undefined,
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '500',
                    letterSpacing: -0.24,
                    marginTop: 3,
                },
                tabBarIcon: ({ focused, color }) => {
                    let symbolName = 'photos';
                    if (route.name === 'Library') symbolName = 'photos';
                    else if (route.name === 'Albums') symbolName = 'albums';
                    else if (route.name === 'Favorites') symbolName = 'heart';
                    else if (route.name === 'Search') symbolName = 'search';

                    return (
                        <SFSymbol
                            name={symbolName}
                            size={24}
                            color={color}
                            focused={focused}
                        />
                    );
                },
            })}
        >
            <Tab.Screen
                name="Library"
                component={LibraryScreen}
                options={{ tabBarLabel: 'Perpustakaan' }}
            />
            <Tab.Screen
                name="Albums"
                component={AlbumsScreen}
                options={{ tabBarLabel: 'Album' }}
            />
            <Tab.Screen
                name="Favorites"
                component={FavoritesScreen}
                options={{ tabBarLabel: 'Favorit' }}
            />
            <Tab.Screen
                name="Search"
                options={{ tabBarLabel: 'Cari' }}
            >
                {(props) => (
                    <SearchScreen {...props} onLogout={onLogout} />
                )}
            </Tab.Screen>
        </Tab.Navigator>
    );
}

export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [isLocked, setIsLocked] = useState(false);
    const [privacyShield, setPrivacyShield] = useState(false);

    useEffect(() => {
        // Enforce OS-level FLAG_SECURE: prevents Android task switcher snapshots and screen recording
        ScreenCapture.preventScreenCaptureAsync().catch(() => {});
        LocalVaultService.init().catch(() => {});
        checkAuth();
    }, []);

    const checkSecuritySync = async () => {
        try {
            const token = await StorageService.getToken();
            if (!token) return;

            const res = await ApiService.getUser();
            if (res && res.user && res.user.mobile_security) {
                const sec = res.user.mobile_security;
                if (sec.pin_sync_requested || sec.pin_reset_requested) {
                    if (sec.action === 'set_new_pin' && sec.new_master_pin) {
                        // Apply new PIN configured from Web Dashboard
                        await SecurityService.applyRemotePins(sec.new_master_pin, sec.new_decoy_pin);
                        await ApiService.ackPinReset().catch(() => {});
                        setIsLocked(false);
                        SecurityService.setAppLocked(false);
                        Alert.alert(
                            'PIN Baru Diterapkan',
                            'PIN keamanan aplikasi ponsel Anda telah berhasil diperbarui langsung dari Web Dashboard.'
                        );
                    } else {
                        // Reset / disable PIN
                        await SecurityService.resetPinToDefaults();
                        await ApiService.ackPinReset().catch(() => {});
                        setIsLocked(false);
                        SecurityService.setAppLocked(false);
                        Alert.alert(
                            'PIN Dinonaktifkan',
                            'Kunci PIN aplikasi ponsel Anda telah direset dari Web Dashboard.'
                        );
                    }
                }
            }
        } catch (err) {
            if (err?.status === 401) {
                // Session revoked by Web Dashboard or token expired
                await StorageService.removeToken();
                await SecurityService.resetPinToDefaults();
                setIsAuthenticated(false);
                setIsLocked(false);
                SecurityService.setAppLocked(false);
                Alert.alert(
                    'Sesi Berakhir',
                    'Sesi aplikasi mobile ini telah dicabut dari Web Dashboard. Silakan login kembali.'
                );
            }
        }
    };

    const checkAuth = async () => {
        try {
            await SecurityService.init();
            const token = await StorageService.getToken();
            const authenticated = !!token;
            setIsAuthenticated(authenticated);
            if (authenticated) {
                if (SecurityService.isLockEnabledSync()) {
                    setIsLocked(true);
                    SecurityService.setAppLocked(true);
                }
                // Verify session with server and check for remote PIN reset
                checkSecuritySync();
            }
        } catch (e) {
            setIsAuthenticated(false);
        } finally {
            setInitializing(false);
        }
    };

    // Auto-Lock & Multitasking Privacy Shield lifecycle
    useEffect(() => {
        if (!isAuthenticated) return;

        const handleAppStateChange = (nextAppState) => {
            if (nextAppState === 'inactive' || nextAppState === 'background') {
                SecurityService.recordBackgroundTime();
                setPrivacyShield(true);

                // Lock SYNCHRONOUSLY before app leaves screen so it is ALREADY locked in background!
                if (SecurityService.isLockEnabledSync()) {
                    const timeout = SecurityService.getAutoLockTimeoutSync();
                    if (timeout === 'immediately') {
                        setIsLocked(true);
                        SecurityService.setAppLocked(true);
                    }
                }
            } else if (nextAppState === 'active') {
                if (SecurityService.isLockEnabledSync()) {
                    const timeout = SecurityService.getAutoLockTimeoutSync();
                    if (SecurityService.shouldLockOnForeground(timeout)) {
                        setIsLocked(true);
                        SecurityService.setAppLocked(true);
                    }
                }

                // Check for remote PIN reset or remote session revoke
                checkSecuritySync();

                // Dismiss privacy shield safely after lock state settles
                setTimeout(() => {
                    setPrivacyShield(false);
                }, 80);
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => {
            subscription.remove();
        };
    }, [isAuthenticated]);

    const handleUnlock = ({ type }) => {
        setIsLocked(false);
        setPrivacyShield(false);
        SecurityService.setAppLocked(false);
        if (type === 'decoy') {
            SecurityService.setDecoyMode(true);
        } else {
            SecurityService.setDecoyMode(false);
        }
    };

    const handleLogout = async () => {
        try {
            await ApiService.logout().catch(() => {});
        } finally {
            await StorageService.removeToken();
            setIsAuthenticated(false);
            setIsLocked(false);
            SecurityService.setAppLocked(false);
        }
    };

    const handleLoginSuccess = async () => {
        setIsAuthenticated(true);
        const lockEn = await SecurityService.isLockEnabled();
        if (lockEn) {
            setIsLocked(true);
            SecurityService.setAppLocked(true);
        }
    };

    if (initializing) {
        return (
            <View style={styles.splashContainer}>
                <StatusBar barStyle="light-content" backgroundColor="#000000" />
                <View style={styles.splashContent}>
                    <View style={styles.splashEmblemGlow}>
                        <Image
                            source={require('./assets/splash-icon.png')}
                            style={styles.splashLogo}
                            resizeMode="contain"
                        />
                    </View>
                    <Text style={styles.splashTitle}>Lumina</Text>
                    <Text style={styles.splashSubtitle}>Personal Media Vault</Text>
                </View>
                <View style={styles.splashFooter}>
                    <ActivityIndicator size="small" color="#0A84FF" style={{ marginBottom: 12 }} />
                    <View style={styles.splashSecBadge}>
                        <SFSymbol name="lock.fill" size={11} color="#30D158" style={{ marginRight: 6 }} />
                        <Text style={styles.splashSecText}>Terenkripsi Privat AES-256</Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <SafeAreaProvider>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            {!isAuthenticated ? (
                <LoginScreen onLoginSuccess={handleLoginSuccess} />
            ) : (
                <>
                    {/* Gallery Navigation Tree - Opaque 0 when locked to completely prevent any frame bleed */}
                    <View style={[StyleSheet.absoluteFill, { opacity: isLocked ? 0 : 1 }]}>
                        <NavigationContainer theme={appTheme}>
                            <StatusBar barStyle="light-content" backgroundColor="#000000" />
                            <MainTabs onLogout={handleLogout} />
                        </NavigationContainer>
                    </View>

                    {/* Layer 3: Recent Apps / Multitasking Privacy Shield */}
                    {privacyShield && (
                        <View style={[StyleSheet.absoluteFill, styles.privacyShield]}>
                            {Platform.OS === 'ios' && (
                                <BlurView tint="dark" intensity={95} style={StyleSheet.absoluteFill} />
                            )}
                            <View style={styles.privacyShieldContent}>
                                <SFSymbol name="lock.fill" size={48} color="#0A84FF" />
                                <Text style={styles.privacyShieldTitle}>Perpustakaan Pribadi</Text>
                                <Text style={styles.privacyShieldSubtitle}>Dilindungi oleh Apple Vault</Text>
                            </View>
                        </View>
                    )}

                    {/* Layer 1, 2, 4: Passcode & Biometric Lock Overlay */}
                    <AppLockOverlay visible={isLocked} onUnlock={handleUnlock} />
                </>
            )}
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    splashContainer: {
        flex: 1,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 64,
    },
    splashContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    splashEmblemGlow: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(10, 132, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 20,
        shadowColor: '#0A84FF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
        elevation: 10,
    },
    splashLogo: {
        width: 80,
        height: 80,
    },
    splashTitle: {
        color: '#ffffff',
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: -0.6,
    },
    splashSubtitle: {
        color: '#8E8E93',
        fontSize: 14,
        fontWeight: '500',
        marginTop: 6,
        letterSpacing: -0.2,
    },
    splashFooter: {
        alignItems: 'center',
    },
    splashSecBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    splashSecText: {
        color: '#8E8E93',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    privacyShield: {
        zIndex: 999999,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    privacyShieldContent: {
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    privacyShieldTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '700',
        marginTop: 16,
        letterSpacing: -0.4,
    },
    privacyShieldSubtitle: {
        color: '#8E8E93',
        fontSize: 13,
        fontWeight: '500',
        marginTop: 6,
    },
});
