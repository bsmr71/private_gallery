import { Platform } from 'react-native';

let notifee = null;
let AndroidImportance = null;

try {
    const NotifeeModule = require('@notifee/react-native');
    notifee = NotifeeModule.default || NotifeeModule;
    AndroidImportance = NotifeeModule.AndroidImportance;
} catch (e) {
    console.log('[NativeSyncService] Notifee native module optional fallback:', e?.message);
}

const SYNC_CHANNEL_ID = 'lumina_vault_sync_channel';
const SYNC_NOTIFICATION_ID = 'lumina_vault_sync_notification';
let isChannelCreated = false;

async function ensureSyncChannel() {
    if (!notifee || Platform.OS !== 'android' || isChannelCreated) return;
    try {
        await notifee.createChannel({
            id: SYNC_CHANNEL_ID,
            name: 'Sinkronisasi Brankas',
            description: 'Notifikasi progres sinkronisasi berkas brankas ke server cloud',
            importance: AndroidImportance ? AndroidImportance.LOW : 2, // Low = shows in status bar silently without sound chime on every file
            vibration: false,
            lights: false,
        });
        isChannelCreated = true;
    } catch (err) {
        console.warn('[NativeSyncService] createChannel error:', err);
    }
}

export const NativeSyncService = {
    /**
     * Start ongoing Android system notification with native progress bar and Foreground Service.
     * This keeps the Android OS from killing the app or network sockets when minimized or screen is locked.
     */
    async startForegroundSync(title = 'Lumina: Sinkronisasi Brankas', message = 'Menyiapkan berkas...', total = 100) {
        if (!notifee || Platform.OS !== 'android') return;

        try {
            await ensureSyncChannel();

            // Request notification permission for Android 13+ (API 33+)
            try {
                await notifee.requestPermission();
            } catch (pErr) {}

            await notifee.displayNotification({
                id: SYNC_NOTIFICATION_ID,
                title: title,
                body: message,
                android: {
                    channelId: SYNC_CHANNEL_ID,
                    asForegroundService: true,
                    ongoing: true,
                    onlyAlertOnce: true,
                    autoCancel: false,
                    color: '#0A84FF',
                    progress: {
                        max: Math.max(1, total),
                        current: 0,
                        indeterminate: total <= 0,
                    },
                    pressAction: {
                        id: 'default',
                    },
                },
            });
        } catch (e) {
            console.warn('[NativeSyncService] startForegroundSync error:', e);
        }
    },

    /**
     * Update the native progress bar in Android system status bar & notification shade.
     */
    async updateProgress(current, total, message = 'Menyinkronkan...') {
        if (!notifee || Platform.OS !== 'android') return;

        try {
            await ensureSyncChannel();

            const cur = Number(current) || 0;
            const max = Math.max(1, Number(total) || 1);
            const percent = Math.min(100, Math.round((cur / max) * 100));

            await notifee.displayNotification({
                id: SYNC_NOTIFICATION_ID,
                title: 'Lumina: Sinkronisasi Brankas',
                body: `${message} • ${percent}%`,
                android: {
                    channelId: SYNC_CHANNEL_ID,
                    asForegroundService: true,
                    ongoing: true,
                    onlyAlertOnce: true,
                    autoCancel: false,
                    color: '#0A84FF',
                    progress: {
                        max: max,
                        current: Math.min(cur, max),
                        indeterminate: false,
                    },
                    pressAction: {
                        id: 'default',
                    },
                },
            });
        } catch (e) {
            console.warn('[NativeSyncService] updateProgress error:', e);
        }
    },

    /**
     * Stop foreground service and optionally post a brief completion notice.
     */
    async stopForegroundSync(summary = null) {
        if (!notifee || Platform.OS !== 'android') return;

        try {
            await notifee.stopForegroundService();

            if (summary && (summary.successCount > 0 || summary.failCount > 0)) {
                const isAllSuccess = (summary.failCount || 0) === 0;
                await notifee.displayNotification({
                    id: 'lumina_vault_sync_completed',
                    title: isAllSuccess ? 'Sinkronisasi Selesai' : 'Sinkronisasi Selesai Sebagian',
                    body: isAllSuccess
                        ? `${summary.successCount} berkas berhasil diunggah ke Cloud.`
                        : `${summary.successCount || 0} berhasil, ${summary.failCount} gagal/terlewat.`,
                    android: {
                        channelId: SYNC_CHANNEL_ID,
                        ongoing: false,
                        autoCancel: true,
                        color: isAllSuccess ? '#30D158' : '#FF9F0A',
                        pressAction: {
                            id: 'default',
                        },
                    },
                });
            }

            // Cancel the ongoing progress notification
            await notifee.cancelNotification(SYNC_NOTIFICATION_ID);
        } catch (e) {
            console.warn('[NativeSyncService] stopForegroundSync error:', e);
        }
    },
};

// Register Android foreground service runner as early as possible
if (notifee && Platform.OS === 'android') {
    try {
        notifee.registerForegroundService(() => {
            return new Promise(() => {
                // Kept active by notifee until stopForegroundService is invoked
            });
        });
    } catch (e) {
        console.warn('[NativeSyncService] registerForegroundService initialization warning:', e);
    }
}
