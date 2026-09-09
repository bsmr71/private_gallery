import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar, ActivityIndicator, Platform, LogBox } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { THEME } from './src/constants/theme';
import { StorageService } from './src/services/storage';
import SFSymbol from './src/components/SFSymbol';

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
                tabBarBackground: () => (
                    <BlurView
                        tint="dark"
                        intensity={90}
                        style={StyleSheet.absoluteFill}
                    />
                ),
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

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const token = await StorageService.getToken();
            setIsAuthenticated(!!token);
        } catch (e) {
            setIsAuthenticated(false);
        } finally {
            setInitializing(false);
        }
    };

    if (initializing) {
        return (
            <View style={styles.splashContainer}>
                <StatusBar barStyle="light-content" backgroundColor="#000000" />
                <ActivityIndicator size="large" color="#0A84FF" />
            </View>
        );
    }

    if (!isAuthenticated) {
        return (
            <SafeAreaProvider>
                <StatusBar barStyle="light-content" backgroundColor="#000000" />
                <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />
            </SafeAreaProvider>
        );
    }

    return (
        <SafeAreaProvider>
            <NavigationContainer theme={appTheme}>
                <StatusBar barStyle="light-content" backgroundColor="#000000" />
                <MainTabs onLogout={() => setIsAuthenticated(false)} />
            </NavigationContainer>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    splashContainer: {
        flex: 1,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
