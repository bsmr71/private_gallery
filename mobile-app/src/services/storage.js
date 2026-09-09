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
            const { MediaUrlHelper } = require('./mediaUrl');
            MediaUrlHelper.setToken(token);
        } catch (e) {}
    },

    async removeToken() {
        try {
            await AsyncStorage.removeItem(KEYS.TOKEN);
            const { MediaUrlHelper } = require('./mediaUrl');
            MediaUrlHelper.setToken(null);
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
            const { MediaUrlHelper } = require('./mediaUrl');
            MediaUrlHelper.setApiUrl(url);
        } catch (e) {}
    },

    async clearAll() {
        try {
            await AsyncStorage.multiRemove([KEYS.TOKEN, KEYS.USER]);
            const { MediaUrlHelper } = require('./mediaUrl');
            MediaUrlHelper.setToken(null);
        } catch (e) {}
    },

    // Vault Sync Settings
    async getVaultFolderName() {
        try {
            const name = await AsyncStorage.getItem('@vault_folder_name');
            return name || 'PrivateVault';
        } catch (e) {
            return 'PrivateVault';
        }
    },

    async setVaultFolderName(name) {
        try {
            await AsyncStorage.setItem('@vault_folder_name', name || 'PrivateVault');
        } catch (e) {}
    },

    async getVaultDirectoryUri() {
        try {
            return await AsyncStorage.getItem('@vault_directory_uri');
        } catch (e) {
            return null;
        }
    },

    async setVaultDirectoryUri(uri) {
        try {
            if (uri) {
                await AsyncStorage.setItem('@vault_directory_uri', uri);
            } else {
                await AsyncStorage.removeItem('@vault_directory_uri');
            }
        } catch (e) {}
    },

    async getAutoDeleteLocal() {
        try {
            const val = await AsyncStorage.getItem('@vault_auto_delete_local');
            return val !== null ? val === 'true' : true; // Default true (zero footprint)
        } catch (e) {
            return true;
        }
    },

    async setAutoDeleteLocal(boolVal) {
        try {
            await AsyncStorage.setItem('@vault_auto_delete_local', boolVal ? 'true' : 'false');
        } catch (e) {}
    },

    async getAutoSyncOnOpen() {
        try {
            const val = await AsyncStorage.getItem('@vault_auto_sync_on_open');
            return val === 'true'; // Default false
        } catch (e) {
            return false;
        }
    },

    async setAutoSyncOnOpen(boolVal) {
        try {
            await AsyncStorage.setItem('@vault_auto_sync_on_open', boolVal ? 'true' : 'false');
        } catch (e) {}
    },

    async getSyncedAssetIds() {
        try {
            const raw = await AsyncStorage.getItem('@vault_synced_asset_ids');
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    },

    async addSyncedAssetIds(newIds) {
        try {
            const current = await this.getSyncedAssetIds();
            const set = new Set([...current, ...newIds]);
            await AsyncStorage.setItem('@vault_synced_asset_ids', JSON.stringify(Array.from(set)));
        } catch (e) {}
    },
};
