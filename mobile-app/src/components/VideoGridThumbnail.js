import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { LocalVaultService } from '../services/localVaultService';
import { MediaUrlHelper } from '../services/mediaUrl';
import { ApiService } from '../services/api';
import SecureImage from './SecureImage';

const THUMB_CACHE_DIR = `${FileSystemLegacy.cacheDirectory}video_thumbs/`;
const localThumbMemoryCache = new Map();
const inFlightExtractions = new Set();

export default function VideoGridThumbnail({ item, style }) {
    const idStr = String(item?.id);
    const [localThumbUri, setLocalThumbUri] = useState(
        localThumbMemoryCache.get(idStr) || null
    );

    useEffect(() => {
        let isMounted = true;

        async function resolveVideoThumbnail() {
            if (!item?.id) return;

            // 1. Check in-memory cache
            if (localThumbMemoryCache.has(idStr)) {
                if (isMounted) setLocalThumbUri(localThumbMemoryCache.get(idStr));
                return;
            }

            try {
                // 2. Ensure cache directory exists
                const dirInfo = await FileSystemLegacy.getInfoAsync(THUMB_CACHE_DIR);
                if (!dirInfo.exists) {
                    await FileSystemLegacy.makeDirectoryAsync(THUMB_CACHE_DIR, { intermediates: true });
                }

                // 3. Check persistent disk cache
                const cachedFilePath = `${THUMB_CACHE_DIR}thumb_${idStr}.jpg`;
                const fileInfo = await FileSystemLegacy.getInfoAsync(cachedFilePath);
                if (fileInfo.exists && fileInfo.size > 0) {
                    localThumbMemoryCache.set(idStr, cachedFilePath);
                    if (isMounted) setLocalThumbUri(cachedFilePath);
                    return;
                }

                // Prevent duplicate simultaneous extractions for same item
                if (inFlightExtractions.has(idStr)) return;
                inFlightExtractions.add(idStr);

                // 4. Source selection: Local Vault (0.01s) or Cloud Stream URL
                let videoSource = LocalVaultService.getLocalUri(item.id);

                if (!videoSource) {
                    const token = MediaUrlHelper.getToken();
                    const rawStream = item.stream_url || `/api/media/${item.id}/stream`;
                    videoSource = MediaUrlHelper.resolve(rawStream, token);
                }

                if (!videoSource) {
                    inFlightExtractions.delete(idStr);
                    return;
                }

                // 5. Extract frame at 0.5s via native MediaMetadataRetriever
                const result = await VideoThumbnails.getThumbnailAsync(videoSource, {
                    time: 500,
                    quality: 0.82,
                });

                if (result?.uri) {
                    await FileSystemLegacy.copyAsync({
                        from: result.uri,
                        to: cachedFilePath,
                    });

                    localThumbMemoryCache.set(idStr, cachedFilePath);
                    if (isMounted) {
                        setLocalThumbUri(cachedFilePath);
                    }

                    // 6. Background auto-heal: upload extracted frame to server so Google Drive and web benefit
                    try {
                        const formData = new FormData();
                        formData.append('thumbnail', {
                            uri: cachedFilePath,
                            name: `thumb_${idStr}.jpg`,
                            type: 'image/jpeg',
                        });
                        await ApiService.request(`/media/${idStr}/thumbnail`, {
                            method: 'POST',
                            body: formData,
                        });
                    } catch (uploadErr) {
                        // Best-effort auto sync
                    }
                }
            } catch (err) {
                // Silently fallback to SecureImage server thumbnail
            } finally {
                inFlightExtractions.delete(idStr);
            }
        }

        resolveVideoThumbnail();

        return () => {
            isMounted = false;
        };
    }, [idStr, item?.stream_url]);

    if (localThumbUri) {
        return (
            <Image
                source={{ uri: localThumbUri }}
                style={[style, StyleSheet.absoluteFill]}
                contentFit="cover"
                transition={150}
                cachePolicy="memory-disk"
            />
        );
    }

    // While extracting or if extraction failed, display server thumbnail via SecureImage
    return (
        <SecureImage
            source={item?.thumbnail_url || `/api/media/${item?.id}/thumbnail`}
            style={style}
            resizeMode="cover"
        />
    );
}
