import { NativeModules, Platform } from 'react-native';

const { LuminaSyncModule } = NativeModules;

export const NativeSyncService = {
    async startForegroundSync(title = 'Lumina: Sinkronisasi Brankas', message = 'Menyinkronkan dan mengenkripsi media...') {
        if (Platform.OS === 'android' && LuminaSyncModule?.startForegroundSync) {
            try {
                await LuminaSyncModule.startForegroundSync(title, message);
            } catch (e) {
                console.warn('[NativeSyncService] startForegroundSync error:', e);
            }
        }
    },

    async updateProgress(current, total, message = 'Menyinkronkan...') {
        if (Platform.OS === 'android' && LuminaSyncModule?.updateSyncProgress) {
            try {
                await LuminaSyncModule.updateSyncProgress(Number(current) || 0, Number(total) || 0, message);
            } catch (e) {
                console.warn('[NativeSyncService] updateProgress error:', e);
            }
        }
    },

    async stopForegroundSync() {
        if (Platform.OS === 'android' && LuminaSyncModule?.stopForegroundSync) {
            try {
                await LuminaSyncModule.stopForegroundSync();
            } catch (e) {
                console.warn('[NativeSyncService] stopForegroundSync error:', e);
            }
        }
    },
};
