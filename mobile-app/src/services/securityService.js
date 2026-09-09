import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEC_KEYS = {
    ENABLED: '@sec_app_lock_enabled',
    MASTER_PIN: '@sec_master_pin',
    DECOY_PIN: '@sec_decoy_pin',
    BIOMETRICS: '@sec_biometrics_enabled',
    TIMEOUT: '@sec_auto_lock_timeout',
};

// In-memory runtime states (resets on app kill/lock)
let runtimeDecoyMode = false;
let runtimeIsLocked = false;
let lastBackgroundTime = 0;

// In-memory synchronous config cache (0ms lookup, zero async latency)
let cachedLockEnabled = false;
let cachedTimeout = 'immediately';

const listeners = new Set();

function notifyListeners() {
    listeners.forEach((listener) => {
        try {
            listener({
                isDecoy: runtimeDecoyMode,
                isLocked: runtimeIsLocked,
            });
        } catch (e) {
            console.warn('SecurityService listener error:', e);
        }
    });
}

export const SecurityService = {
    // --- Synchronous In-Memory Cache Init ---
    async init() {
        try {
            const enabled = await AsyncStorage.getItem(SEC_KEYS.ENABLED);
            const masterPin = await AsyncStorage.getItem(SEC_KEYS.MASTER_PIN);
            const timeout = await AsyncStorage.getItem(SEC_KEYS.TIMEOUT);
            cachedLockEnabled = enabled === 'true' && !!masterPin;
            cachedTimeout = timeout || 'immediately';
        } catch (e) {
            cachedLockEnabled = false;
            cachedTimeout = 'immediately';
        }
    },

    isLockEnabledSync() {
        return cachedLockEnabled;
    },

    getAutoLockTimeoutSync() {
        return cachedTimeout;
    },

    // --- Configuration State ---
    async isLockEnabled() {
        try {
            const enabled = await AsyncStorage.getItem(SEC_KEYS.ENABLED);
            const masterPin = await AsyncStorage.getItem(SEC_KEYS.MASTER_PIN);
            const res = enabled === 'true' && !!masterPin;
            cachedLockEnabled = res;
            return res;
        } catch (e) {
            return false;
        }
    },

    async setLockEnabled(boolVal) {
        try {
            cachedLockEnabled = !!boolVal;
            await AsyncStorage.setItem(SEC_KEYS.ENABLED, boolVal ? 'true' : 'false');
        } catch (e) {}
    },

    // --- Remote Reset from Web Dashboard ---
    async resetPinToDefaults() {
        try {
            await AsyncStorage.removeItem(SEC_KEYS.MASTER_PIN);
            await AsyncStorage.removeItem(SEC_KEYS.DECOY_PIN);
            await AsyncStorage.setItem(SEC_KEYS.ENABLED, 'false');
            cachedLockEnabled = false;
            runtimeIsLocked = false;
            runtimeDecoyMode = false;
            notifyListeners();
            return true;
        } catch (e) {
            console.warn('Failed to reset PIN to defaults:', e);
            return false;
        }
    },

    // --- Remote PIN Setup from Web Dashboard ---
    async applyRemotePins(masterPin, decoyPin = null) {
        try {
            if (masterPin) {
                await AsyncStorage.setItem(SEC_KEYS.MASTER_PIN, String(masterPin));
            }
            if (decoyPin) {
                await AsyncStorage.setItem(SEC_KEYS.DECOY_PIN, String(decoyPin));
            } else {
                await AsyncStorage.removeItem(SEC_KEYS.DECOY_PIN);
            }
            await AsyncStorage.setItem(SEC_KEYS.ENABLED, 'true');
            cachedLockEnabled = true;
            runtimeIsLocked = false;
            runtimeDecoyMode = false;
            notifyListeners();
            return true;
        } catch (e) {
            console.warn('Failed to apply remote pins:', e);
            return false;
        }
    },

    async hasMasterPin() {
        try {
            const pin = await AsyncStorage.getItem(SEC_KEYS.MASTER_PIN);
            return !!pin;
        } catch (e) {
            return false;
        }
    },

    async setMasterPin(pin) {
        try {
            await AsyncStorage.setItem(SEC_KEYS.MASTER_PIN, String(pin));
            cachedLockEnabled = true;
            await this.setLockEnabled(true);
        } catch (e) {}
    },

    async isSameAsMasterPin(candidatePin) {
        try {
            const masterPin = await AsyncStorage.getItem(SEC_KEYS.MASTER_PIN);
            return masterPin === String(candidatePin);
        } catch (e) {
            return false;
        }
    },

    async hasDecoyPin() {
        try {
            const pin = await AsyncStorage.getItem(SEC_KEYS.DECOY_PIN);
            return !!pin;
        } catch (e) {
            return false;
        }
    },

    async setDecoyPin(pin) {
        try {
            if (!pin) {
                await AsyncStorage.removeItem(SEC_KEYS.DECOY_PIN);
            } else {
                await AsyncStorage.setItem(SEC_KEYS.DECOY_PIN, String(pin));
            }
        } catch (e) {}
    },

    async getAutoLockTimeout() {
        try {
            const val = await AsyncStorage.getItem(SEC_KEYS.TIMEOUT);
            cachedTimeout = val || 'immediately';
            return cachedTimeout;
        } catch (e) {
            return 'immediately';
        }
    },

    async setAutoLockTimeout(timeoutVal) {
        try {
            cachedTimeout = timeoutVal;
            await AsyncStorage.setItem(SEC_KEYS.TIMEOUT, timeoutVal);
        } catch (e) {}
    },

    // --- PIN Verification ---
    async verifyPin(inputPin) {
        try {
            const masterPin = await AsyncStorage.getItem(SEC_KEYS.MASTER_PIN);
            const decoyPin = await AsyncStorage.getItem(SEC_KEYS.DECOY_PIN);

            if (inputPin === masterPin) {
                runtimeDecoyMode = false;
                runtimeIsLocked = false;
                notifyListeners();
                return { success: true, type: 'master' };
            }

            if (decoyPin && inputPin === decoyPin) {
                runtimeDecoyMode = true; // Activate harmless decoy vault!
                runtimeIsLocked = false;
                notifyListeners();
                return { success: true, type: 'decoy' };
            }

            return { success: false };
        } catch (e) {
            return { success: false };
        }
    },

    // --- Runtime Lock & Decoy State Management ---
    isDecoyMode() {
        return runtimeDecoyMode;
    },

    setDecoyMode(val) {
        runtimeDecoyMode = !!val;
        notifyListeners();
    },

    isAppCurrentlyLocked() {
        return runtimeIsLocked;
    },

    setAppLocked(boolVal) {
        runtimeIsLocked = !!boolVal;
        if (boolVal) {
            // Reset decoy mode on lock
            runtimeDecoyMode = false;
        }
        notifyListeners();
    },

    subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },

    recordBackgroundTime() {
        lastBackgroundTime = Date.now();
    },

    shouldLockOnForeground(timeoutSetting = 'immediately') {
        if (!lastBackgroundTime) return true;
        const elapsedSeconds = (Date.now() - lastBackgroundTime) / 1000;

        if (timeoutSetting === 'immediately') return true;
        if (timeoutSetting === '1min') return elapsedSeconds >= 60;
        if (timeoutSetting === '5min') return elapsedSeconds >= 300;

        return true;
    },
};

export function useDecoyMode() {
    const [isDecoy, setIsDecoy] = useState(SecurityService.isDecoyMode());

    useEffect(() => {
        setIsDecoy(SecurityService.isDecoyMode());

        const unsubscribe = SecurityService.subscribe(({ isDecoy: nextDecoy }) => {
            setIsDecoy(nextDecoy);
        });
        return unsubscribe;
    }, []);

    return isDecoy;
}

export function useAppLocked() {
    const [isLocked, setIsLocked] = useState(SecurityService.isAppCurrentlyLocked());

    useEffect(() => {
        setIsLocked(SecurityService.isAppCurrentlyLocked());

        const unsubscribe = SecurityService.subscribe(({ isLocked: nextLocked }) => {
            setIsLocked(nextLocked);
        });
        return unsubscribe;
    }, []);

    return isLocked;
}
