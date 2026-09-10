import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import * as VideoThumbnails from 'expo-video-thumbnails';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalVaultService } from '../services/localVaultService';
import { MediaUrlHelper } from '../services/mediaUrl';
import { ApiService } from '../services/api';
import SecureImage from './SecureImage';

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

            // 2. Check AsyncStorage persistent cache
            try {
                const storedUri = await AsyncStorage.getItem(`@vthumb_${idStr}`);
                if (storedUri) {
                    localThumbMemoryCache.set(idStr, storedUri);
                    if (isMounted) setLocalThumbUri(storedUri);
                    return;
                }
            } catch (e) {}

            // Prevent duplicate simultaneous extractions
            if (inFlightExtractions.has(idStr)) return;
            inFlightExtractions.add(idStr);

            try {
                // 3. Source selection: Local Vault (0.01s) or Cloud Stream URL
                let videoSource = LocalVaultService.getLocalUri(item.id);
                const token = MediaUrlHelper.getToken();

                if (!videoSource) {
                    const rawStream = item.stream_url || `/api/media/${item.id}/stream`;
                    videoSource = MediaUrlHelper.resolve(rawStream, token);
                }

                if (!videoSource) {
                    inFlightExtractions.delete(idStr);
                    return;
                }

                console.log(`[VideoGridThumbnail] Extracting frame for media ${idStr}...`);

                // 4. Extract frame at 1000ms according to official Expo SDK documentation
                const options = {
                    time: 1000,
                    quality: 0.85,
                };
                if (token && !videoSource.startsWith('file://')) {
                    options.headers = { Authorization: `Bearer ${token}` };
                }

                const result = await VideoThumbnails.getThumbnailAsync(videoSource, options);

                if (result?.uri) {
                    // Use result.uri directly as per official Expo documentation
                    localThumbMemoryCache.set(idStr, result.uri);
                    if (isMounted) {
                        setLocalThumbUri(result.uri);
                    }
                    AsyncStorage.setItem(`@vthumb_${idStr}`, result.uri).catch(() => {});
                    console.log(`[VideoGridThumbnail] Successfully extracted thumbnail for media ${idStr}: ${result.uri}`);

                    // 5. Background auto-heal: upload extracted frame to server
                    try {
                        const formData = new FormData();
                        formData.append('thumbnail', {
                            uri: result.uri,
                            name: `thumb_${idStr}.jpg`,
                            type: 'image/jpeg',
                        });
                        await ApiService.request(`/media/${idStr}/thumbnail`, {
                            method: 'POST',
                            body: formData,
                        });
                        console.log(`[VideoGridThumbnail] Auto-uploaded thumbnail for media ${idStr} to server`);
                    } catch (uploadErr) {
                        // Best-effort auto sync
                    }
                }
            } catch (err) {
                console.warn(`[VideoGridThumbnail] Thumbnail extraction failed for media ${idStr}:`, err?.message || err);
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

    // While extracting, display server thumbnail as fallback via SecureImage
    return (
        <SecureImage
            source={item?.thumbnail_url || `/api/media/${item?.id}/thumbnail`}
            style={style}
            resizeMode="cover"
        />
    );
}
