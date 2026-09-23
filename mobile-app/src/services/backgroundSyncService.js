import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { StorageService } from './storage';
import { SyncService } from './syncService';

export const BACKGROUND_VAULT_SYNC_TASK = 'BACKGROUND_VAULT_SYNC_TASK';

// Define task in global scope so OS can wake it up even when app is closed / terminated
TaskManager.defineTask(BACKGROUND_VAULT_SYNC_TASK, async () => {
    const now = new Date().toISOString();
    console.log(`[BackgroundSyncService] Background fetch task executed at ${now}`);

    try {
        const token = await StorageService.getToken();
        if (!token) {
            console.log('[BackgroundSyncService] Skipping: User not authenticated');
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        const autoSyncEnabled = await StorageService.getAutoSyncEnabled();
        const backgroundSyncEnabled = await StorageService.getBackgroundSyncEnabled();

        if (!autoSyncEnabled || !backgroundSyncEnabled) {
            console.log('[BackgroundSyncService] Skipping: AutoSync or BackgroundSync disabled');
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        const folderUri = await StorageService.getVaultDirectoryUri();
        if (!folderUri) {
            console.log('[BackgroundSyncService] Skipping: No vault folder configured');
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        // Trigger sync if pending files exist
        const result = await SyncService.triggerAutoSyncIfPending();

        if (result && result.successCount > 0) {
            console.log(`[BackgroundSyncService] Background sync finished: ${result.successCount} files synced.`);
            return BackgroundFetch.BackgroundFetchResult.NewData;
        }

        return BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (err) {
        console.warn('[BackgroundSyncService] Background task error:', err);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

export const BackgroundSyncService = {
    /**
     * Register background task with Android JobScheduler / iOS Background Processing.
     */
    async register() {
        try {
            // Expo Go does not include native Background Fetch module; only available in Development Build / Standalone APK
            if (typeof isRunningInExpoGo === 'function' && isRunningInExpoGo()) {
                console.log('[BackgroundSyncService] Background fetch is not available in Expo Go (available in Development Build / APK). Skipping registration.');
                return false;
            }

            const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_VAULT_SYNC_TASK);
            if (isRegistered) {
                console.log('[BackgroundSyncService] Background task already registered.');
                return true;
            }

            console.log('[BackgroundSyncService] Registering background task...');
            await BackgroundFetch.registerTaskAsync(BACKGROUND_VAULT_SYNC_TASK, {
                minimumInterval: 15 * 60, // 15 minutes minimum interval for battery efficiency
                stopOnTerminate: false,   // CRITICAL: keep scheduled after app is swiped closed / terminated
                startOnBoot: true,        // CRITICAL: re-register automatically after device reboot
            });

            console.log('[BackgroundSyncService] Background task registered successfully.');
            return true;
        } catch (e) {
            console.warn('[BackgroundSyncService] Failed to register background task:', e);
            return false;
        }
    },

    /**
     * Unregister background task.
     */
    async unregister() {
        try {
            if (typeof isRunningInExpoGo === 'function' && isRunningInExpoGo()) {
                return true;
            }

            const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_VAULT_SYNC_TASK);
            if (isRegistered) {
                await BackgroundFetch.unregisterTaskAsync(BACKGROUND_VAULT_SYNC_TASK);
                console.log('[BackgroundSyncService] Background task unregistered.');
            }
            return true;
        } catch (e) {
            console.warn('[BackgroundSyncService] Failed to unregister background task:', e);
            return false;
        }
    },

    /**
     * Check current registration status.
     */
    async isRegistered() {
        try {
            return await TaskManager.isTaskRegisteredAsync(BACKGROUND_VAULT_SYNC_TASK);
        } catch (e) {
            return false;
        }
    },

    /**
     * Initialize background sync if enabled.
     */
    async init() {
        const bgEnabled = await StorageService.getBackgroundSyncEnabled();
        if (bgEnabled) {
            await this.register();
        } else {
            await this.unregister();
        }
    },
};
