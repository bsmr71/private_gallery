import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

export const ImageWebpService = {
    /**
     * Request permissions and pick media from device gallery.
     */
    async pickFromGallery(options = {}) {
        const { allowsMultiple = true, quality = 1.0 } = options;
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            throw new Error('Aplikasi memerlukan izin untuk mengakses galeri ponsel Anda.');
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            allowsMultipleSelection: allowsMultiple,
            quality: quality,
            orderedSelection: true,
        });

        if (result.canceled || !result.assets) {
            return [];
        }

        return result.assets;
    },

    /**
     * Convert an image asset to WebP format while preserving HD quality.
     * WebP with quality=0.90 retains high-fidelity HD sharpness (visually lossless)
     * while dramatically slashing 50% - 85% off file sizes.
     * 
     * Target max dimension: 2560px (2K HD boundary).
     * If the image is <= 2560px in both width & height, 100% of original dimensions are kept intact.
     */
    async convertToWebpHD(asset, options = {}) {
        const {
            maxDimension = 2560,
            quality = 0.90,
        } = options;

        const isVideo = Boolean(
            asset.type === 'video' ||
            (asset.mimeType && asset.mimeType.startsWith('video/')) ||
            (asset.mediaType === 'video') ||
            (asset.uri && /\.(mp4|mov|m4v|webm|3gp)$/i.test(asset.uri))
        );

        if (isVideo) {
            let fileSize = asset.fileSize || 0;
            if (!fileSize && asset.uri) {
                try {
                    const info = await FileSystemLegacy.getInfoAsync(asset.uri);
                    if (info.exists) fileSize = info.size || 0;
                } catch (e) {}
            }
            return {
                ...asset,
                isVideo: true,
                isWebP: false,
                fileSize,
            };
        }

        try {
            let width = asset.width;
            let height = asset.height;

            // Determine original file size
            let originalSize = asset.fileSize || 0;
            if (!originalSize && asset.uri) {
                try {
                    const info = await FileSystemLegacy.getInfoAsync(asset.uri);
                    if (info.exists) originalSize = info.size || 0;
                } catch (e) {}
            }

            // High Definition scaling: only scale down if larger than 2K HD boundary
            const actions = [];
            if (width && height) {
                if (width > maxDimension || height > maxDimension) {
                    if (width >= height) {
                        actions.push({ resize: { width: maxDimension } });
                    } else {
                        actions.push({ resize: { height: maxDimension } });
                    }
                }
            }

            // Convert to WebP format with HD compression quality
            const manipResult = await ImageManipulator.manipulateAsync(
                asset.uri,
                actions,
                {
                    compress: quality,
                    format: ImageManipulator.SaveFormat.WEBP,
                }
            );

            // Read converted WebP file size
            let convertedSize = 0;
            try {
                const webpInfo = await FileSystemLegacy.getInfoAsync(manipResult.uri);
                if (webpInfo.exists) convertedSize = webpInfo.size || 0;
            } catch (e) {}

            // Calculate byte savings
            let savingsPercent = 0;
            if (originalSize > 0 && convertedSize > 0 && originalSize > convertedSize) {
                savingsPercent = Math.round(((originalSize - convertedSize) / originalSize) * 100);
            }

            const rawName = asset.fileName || asset.filename || asset.uri.split('/').pop() || 'photo.jpg';
            const baseName = rawName.replace(/\.[^/.]+$/, '');
            const newFileName = `${baseName}.webp`;

            return {
                ...asset,
                uri: manipResult.uri,
                width: manipResult.width,
                height: manipResult.height,
                fileName: newFileName,
                mimeType: 'image/webp',
                type: 'image',
                originalSize,
                convertedSize: convertedSize || originalSize,
                fileSize: convertedSize || originalSize,
                savingsPercent,
                isWebP: true,
                isVideo: false,
            };
        } catch (err) {
            console.warn('[ImageWebpService] WebP conversion fallback to original:', err);
            return {
                ...asset,
                isWebP: false,
                isVideo: false,
            };
        }
    },

    /**
     * Batch convert multiple assets to WebP HD with progress callback.
     */
    async batchConvertToWebpHD(assets, onProgress) {
        const results = [];
        for (let i = 0; i < assets.length; i++) {
            if (onProgress) {
                onProgress(i + 1, assets.length, assets[i]);
            }
            const converted = await this.convertToWebpHD(assets[i]);
            results.push(converted);
        }
        return results;
    },

    /**
     * Human-readable file size formatter (e.g. 1.8 MB, 320 KB).
     */
    formatFileSize(bytes) {
        if (!bytes || bytes <= 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },
};
