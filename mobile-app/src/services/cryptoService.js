import { NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { LuminaCryptoModule } = NativeModules;

// Default Master Vault Key matching Laravel APP_KEY
export const DEFAULT_VAULT_KEY = 'base64:oDk6wt7/2N4g3YlkFZznYVwRK61fvmcTCcip3oNO3zg=';
const VAULT_KEY_STORAGE = '@lumina_master_vault_key';

export const CryptoService = {
    /**
     * Get active 256-bit vault key (Base64 format).
     */
    async getVaultKey() {
        try {
            const savedKey = await AsyncStorage.getItem(VAULT_KEY_STORAGE);
            return savedKey || DEFAULT_VAULT_KEY;
        } catch (e) {
            return DEFAULT_VAULT_KEY;
        }
    },

    /**
     * Save / update custom master vault key.
     */
    async setVaultKey(keyBase64) {
        if (!keyBase64) return;
        await AsyncStorage.setItem(VAULT_KEY_STORAGE, keyBase64);
    },

    /**
     * Check if hardware native crypto module is linked and ready.
     */
    isNativeCryptoAvailable() {
        return Boolean(LuminaCryptoModule && typeof LuminaCryptoModule.encryptFile === 'function');
    },

    /**
     * Encrypt a local media file into AES-256-GCM chunked vault file.
     * Compatible with Laravel FileEncryptionService.
     *
     * @param {string} sourceUri File URI to plaintext file (file://... or raw path)
     * @param {string} targetUri Destination encrypted file path (.enc)
     * @returns {Promise<string>} Target encrypted file URI
     */
    async encryptFile(sourceUri, targetUri) {
        if (!this.isNativeCryptoAvailable()) {
            throw new Error('Lumina Native Crypto Module is not available on this platform.');
        }
        const key = await this.getVaultKey();
        return await LuminaCryptoModule.encryptFile(sourceUri, targetUri, key);
    },

    /**
     * Decrypt an AES-256-GCM chunked vault file back to a local playable file.
     *
     * @param {string} sourceUri Encrypted vault file (.enc)
     * @param {string} targetUri Plaintext output file path
     * @returns {Promise<string>} Target plaintext file URI
     */
    async decryptFile(sourceUri, targetUri) {
        if (!this.isNativeCryptoAvailable()) {
            throw new Error('Lumina Native Crypto Module is not available on this platform.');
        }
        const key = await this.getVaultKey();
        return await LuminaCryptoModule.decryptFile(sourceUri, targetUri, key);
    },

    /**
     * Encrypt arbitrary metadata JSON string or object.
     * Used for creating zero-knowledge .meta manifest in Google Drive.
     *
     * @param {object|string} metadata Data to encrypt
     * @returns {Promise<string>} Base64 encrypted payload
     */
    async encryptMetadata(metadata) {
        if (!this.isNativeCryptoAvailable()) {
            throw new Error('Lumina Native Crypto Module is not available.');
        }
        const text = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
        const key = await this.getVaultKey();
        return await LuminaCryptoModule.encryptString(text, key);
    },

    /**
     * Decrypt base64 encrypted metadata manifest back to JS object.
     *
     * @param {string} ciphertextBase64
     * @returns {Promise<object>} Decrypted metadata JSON object
     */
    async decryptMetadata(ciphertextBase64) {
        if (!this.isNativeCryptoAvailable()) {
            throw new Error('Lumina Native Crypto Module is not available.');
        }
        const key = await this.getVaultKey();
        const jsonStr = await LuminaCryptoModule.decryptString(ciphertextBase64, key);
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            return jsonStr;
        }
    }
};
