import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { THEME } from './src/constants/theme';
import { StorageService } from './src/services/storage';

import LibraryScreen from './src/screens/LibraryScreen';
import AlbumsScreen from './src/screens/AlbumsScreen';
import FavoritesScreen from './src/screens/FavoritesScreen';
import SearchScreen from './src/screens/SearchScreen';
import LoginScreen from './src/screens/LoginScreen';

const Tab = createBottomTabNavigator();

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
                <ActivityIndicator size="large" color={THEME.colors.accent} />
            </View>
        );
    }

    if (!isAuthenticated) {
        return (
            <>
                <StatusBar barStyle="light-content" backgroundColor="#000000" />
                <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />
            </>
        );
    }

    return (
        <NavigationContainer
            theme={{
                dark: true,
                colors: {
                    primary: THEME.colors.accent,
                    background: '#000000',
                    card: '#121214',
                    text: '#ffffff',
                    border: 'rgba(255, 255, 255, 0.08)',
                    notification: THEME.colors.favorite,
                },
            }}
        >
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    headerShown: false,
                    tabBarActiveTintColor: '#38bdf8',
                    tabBarInactiveTintColor: '#8e8e93',
                    tabBarStyle: {
                        backgroundColor: 'rgba(18, 18, 22, 0.96)',
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: 'rgba(255, 255, 255, 0.12)',
                        height: 62,
                        paddingBottom: 8,
                        paddingTop: 6,
                    },
                    tabBarLabelStyle: {
                        fontSize: 11,
                        fontWeight: '600',
                    },
                    tabBarIcon: ({ focused }) => {
                        let icon = '🖼️';
                        if (route.name === 'Library') icon = '🖼️';
                        else if (route.name === 'Albums') icon = '📁';
                        else if (route.name === 'Favorites') icon = '❤️';
                        else if (route.name === 'Search') icon = '🔍';

                        return (
                            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.65 }}>
                                {icon}
                            </Text>
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
                    options={{ tabBarLabel: 'Cari & Akun' }}
                >
                    {(props) => (
                        <SearchScreen {...props} onLogout={() => setIsAuthenticated(false)} />
                    )}
                </Tab.Screen>
            </Tab.Navigator>
        </NavigationContainer>
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
