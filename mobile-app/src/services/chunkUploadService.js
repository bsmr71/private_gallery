import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { ApiService } from './api';
import { StorageService } from './storage';

// 2MB chunk size is ideal for mobile: avoids memory spikes, fits PHP upload limits, fast retries
export const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB
export const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5 MB

export const ChunkUploadService = {
    /**
     * Checks whether a file qualifies for chunked upload (file >= 5MB or video).
     */
    shouldUseChunkUpload(fileSize, isVideo) {
        if (isVideo) return true;
        if (!fileSize) return false;
        return fileSize >= LARGE_FILE_THRESHOLD;
    },

    /**
     * Main entry point to upload large file in chunks.
     * Supports auto-resume if previous upload was interrupted.
     */
    async uploadLargeFile(asset, options = {}) {
        const {
            albumId = null,
            title = null,
            onProgress = null,
            isAbortedCheck = null,
        } = options;

        const originalFileUri = asset.uri;
        let workingFileUri = asset.uri;
        let tempCopiedUri = null;

        let originalName = asset.filename || asset.fileName || originalFileUri.split('/').pop() || 'upload_file.mp4';
        try {
            originalName = decodeURIComponent(originalName).split('/').pop() || originalName;
        } catch (e) {
            try {
                originalName = decodeURI(originalName).split('/').pop() || originalName;
            } catch (err) {}
        }

        const ext = originalName.includes('.') ? originalName.split('.').pop().toLowerCase() : '';
        const isVideo = Boolean(
            asset.mediaType === 'video' ||
            asset.type === 'video' ||
            ['mp4', 'mov', 'm4v', '3gp', 'webm', 'mkv'].includes(ext)
        );

        try {
            // Stage SAF content:// URI into real file in cache directory
            // This enables getInfoAsync to read true file size and readAsStringAsync to slice chunks with position/length
            if (workingFileUri && workingFileUri.startsWith('content://')) {
                const safeName = originalName.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
                tempCopiedUri = `${FileSystemLegacy.cacheDirectory}chunk_src_${Date.now()}_${safeName}`;
                try {
                    await FileSystemLegacy.copyAsync({
                        from: workingFileUri,
                        to: tempCopiedUri,
                    });
                    workingFileUri = tempCopiedUri;
                } catch (copyErr) {
                    console.warn('[ChunkUploadService] Gagal menyalin content URI ke cache:', copyErr);
                }
            }

            // 1. Get exact file size on device
            let totalSize = asset.fileSize || asset.size || 0;
            try {
                const info = await FileSystemLegacy.getInfoAsync(workingFileUri);
                if (info && info.exists && info.size) {
                    totalSize = info.size;
                }
            } catch (e) {
                console.warn('[ChunkUploadService] getInfoAsync error:', e);
            }

            if (!totalSize || totalSize <= 0) {
                throw new Error(`Ukuran berkas ${originalName} tidak dapat dibaca dari perangkat.`);
            }

            const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
            const mimeType = isVideo
                ? `video/${ext === 'mov' ? 'quicktime' : 'mp4'}`
                : (ext === 'png' ? 'image/png' : 'image/jpeg');

            // 2. Extract client-side video thumbnail if needed
            let thumbnailBase64 = asset.thumbnailBase64 || null;
            if (!thumbnailBase64 && isVideo && VideoThumbnails?.getThumbnailAsync) {
                try {
                    const thumbRes = await VideoThumbnails.getThumbnailAsync(workingFileUri, {
                        time: 500,
                        quality: 0.8,
                    });
                    if (thumbRes?.uri) {
                        thumbnailBase64 = await FileSystemLegacy.readAsStringAsync(thumbRes.uri, {
                            encoding: 'base64',
                        });
                        await FileSystemLegacy.deleteAsync(thumbRes.uri, { idempotent: true });
                    }
                } catch (thumbErr) {
                    console.warn('[ChunkUploadService] Video thumbnail extraction warning:', thumbErr);
                }
            }

            // 3. Check for previous active session to resume
            let savedSession = await StorageService.getActiveChunkSession(originalFileUri);
        let uploadId = savedSession?.uploadId || null;
        let uploadedChunks = new Set(savedSession?.uploadedChunks || []);

        // Verify session status with server if resuming
        if (uploadId) {
            try {
                const statusRes = await ApiService.getChunkStatus(uploadId);
                if (statusRes && statusRes.success && Array.isArray(statusRes.uploaded_chunks)) {
                    uploadedChunks = new Set(statusRes.uploaded_chunks);
                    console.log(`[ChunkUploadService] Resuming session ${uploadId}: ${uploadedChunks.size}/${totalChunks} chunks already on server.`);
                } else {
                    uploadId = null;
                }
            } catch (statusErr) {
                console.log('[ChunkUploadService] Saved session invalid or expired, starting fresh session.');
                uploadId = null;
                uploadedChunks.clear();
            }
        }

        // 4. Initialize upload session if needed
        if (!uploadId) {
            console.log(`[ChunkUploadService] Initializing chunk upload for ${originalName} (${(totalSize / (1024 * 1024)).toFixed(2)} MB, ${totalChunks} chunks)...`);
            const initRes = await ApiService.initChunkUpload({
                filename: originalName,
                total_size: totalSize,
                chunk_size: CHUNK_SIZE,
                total_chunks: totalChunks,
                mime_type: mimeType,
                album_id: albumId,
                title: title,
                thumbnail_base64: thumbnailBase64,
            });

            // Duplicate detection: server found identical file
            if (initRes.is_duplicate) {
                console.log(`[ChunkUploadService] File ${originalName} is duplicate, using existing ID.`);
                await StorageService.clearActiveChunkSession(fileUri);
                return {
                    isDuplicate: true,
                    uploaded: initRes.media ? [initRes.media] : [],
                    media: initRes.media,
                };
            }

            uploadId = initRes.upload_id;
            uploadedChunks = new Set(initRes.uploaded_chunks || []);
            await StorageService.setActiveChunkSession(fileUri, {
                uploadId,
                filename: originalName,
                totalSize,
                totalChunks,
                uploadedChunks: Array.from(uploadedChunks),
            });
        }

        // 5. Upload Chunks Sequentially with Retry
        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            if (isAbortedCheck && isAbortedCheck()) {
                console.log('[ChunkUploadService] Upload aborted by user or system.');
                throw new Error('Upload dibatalkan.');
            }

            if (uploadedChunks.has(chunkIndex)) {
                // Chunk already uploaded previously
                const percent = Math.round((uploadedChunks.size / totalChunks) * 100);
                onProgress && onProgress(percent);
                continue;
            }

            const offset = chunkIndex * CHUNK_SIZE;
            const length = Math.min(CHUNK_SIZE, totalSize - offset);

            // Read chunk slice into base64
            let chunkBase64;
            try {
                chunkBase64 = await FileSystemLegacy.readAsStringAsync(workingFileUri, {
                    encoding: 'base64',
                    position: offset,
                    length: length,
                });
            } catch (readErr) {
                console.error(`[ChunkUploadService] Error reading chunk ${chunkIndex} from disk:`, readErr);
                throw new Error(`Gagal membaca potongan berkas ${chunkIndex}: ${readErr.message}`);
            }

            // Write temporary chunk file in cache directory
            const tempChunkUri = `${FileSystemLegacy.cacheDirectory}chunk_${uploadId}_${chunkIndex}.tmp`;
            await FileSystemLegacy.writeAsStringAsync(tempChunkUri, chunkBase64, {
                encoding: 'base64',
            });

            // Free chunkBase64 from JS heap memory immediately
            chunkBase64 = null;

            // Upload chunk with up to 3 retries
            let attempts = 0;
            let uploadSuccess = false;
            let lastUploadErr = null;

            while (attempts < 3 && !uploadSuccess) {
                if (isAbortedCheck && isAbortedCheck()) {
                    await FileSystemLegacy.deleteAsync(tempChunkUri, { idempotent: true });
                    throw new Error('Upload dibatalkan.');
                }

                try {
                    await ApiService.uploadChunkPart(uploadId, chunkIndex, tempChunkUri);
                    uploadSuccess = true;
                } catch (upErr) {
                    attempts++;
                    lastUploadErr = upErr;
                    console.warn(`[ChunkUploadService] Chunk ${chunkIndex} upload attempt ${attempts} failed:`, upErr.message);
                    if (attempts < 3) {
                        await new Promise((r) => setTimeout(r, 1000 * attempts));
                    }
                }
            }

            // Clean up temporary chunk file
            await FileSystemLegacy.deleteAsync(tempChunkUri, { idempotent: true });

            if (!uploadSuccess) {
                throw new Error(`Gagal mengunggah potongan ${chunkIndex + 1}/${totalChunks} setelah 3 kali percobaan: ${lastUploadErr?.message}`);
            }

            uploadedChunks.add(chunkIndex);
            await StorageService.setActiveChunkSession(originalFileUri, {
                uploadId,
                filename: originalName,
                totalSize,
                totalChunks,
                uploadedChunks: Array.from(uploadedChunks),
            });

            const percent = Math.min(99, Math.round((uploadedChunks.size / totalChunks) * 100));
            onProgress && onProgress(percent);
        }

        // 6. Complete and Assemble on Server
        console.log(`[ChunkUploadService] All ${totalChunks} chunks uploaded for ${originalName}. Requesting server merge & cloud encryption...`);
        onProgress && onProgress(99);

        const completeRes = await ApiService.completeChunkUpload({
            upload_id: uploadId,
            album_id: albumId,
            title: title,
        });

        // Clean up session from AsyncStorage
        await StorageService.clearActiveChunkSession(originalFileUri);
        onProgress && onProgress(100);

        console.log(`[ChunkUploadService] Chunk upload complete for ${originalName}!`);
        return completeRes;
    } finally {
        if (tempCopiedUri) {
            try {
                await FileSystemLegacy.deleteAsync(tempCopiedUri, { idempotent: true });
            } catch (delErr) {}
        }
    }
},
};
