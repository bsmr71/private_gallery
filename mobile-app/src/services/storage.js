import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_CONFIG } from '../constants/config';

const KEYS = {
    TOKEN: '@gallery_auth_token',
    USER: '@gallery_user',
    API_URL: '@gallery_api_url',
};

export const StorageService = {
    async getToken() {
        try {
            return await AsyncStorage.getItem(KEYS.TOKEN);
        } catch (e) {
            return null;
        }
    },

    async setToken(token) {
        try {
            await AsyncStorage.setItem(KEYS.TOKEN, token);
        } catch (e) {}
    },

    async removeToken() {
        try {
            await AsyncStorage.removeItem(KEYS.TOKEN);
        } catch (e) {}
    },

    async getUser() {
        try {
            const raw = await AsyncStorage.getItem(KEYS.USER);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    },

    async setUser(user) {
        try {
            await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
        } catch (e) {}
    },

    async removeUser() {
        try {
            await AsyncStorage.removeItem(KEYS.USER);
        } catch (e) {}
    },

    async getApiUrl() {
        try {
            const custom = await AsyncStorage.getItem(KEYS.API_URL);
            return custom || DEFAULT_CONFIG.apiBaseUrl;
        } catch (e) {
            return DEFAULT_CONFIG.apiBaseUrl;
        }
    },

    async setApiUrl(url) {
        try {
            await AsyncStorage.setItem(KEYS.API_URL, url);
        } catch (e) {}
    },

    async clearAll() {
        try {
            await AsyncStorage.multiRemove([KEYS.TOKEN, KEYS.USER]);
        } catch (e) {}
    },
};
