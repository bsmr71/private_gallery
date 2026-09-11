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

    // 1. Instant 0ms synchronous check from Local Vault index
    const localVaultThumb = LocalVaultService.getLocalThumbUri(item?.id);
    const cachedMemThumb = localThumbMemoryCache.get(idStr);

    const [thumbUri, setThumbUri] = useState(localVaultThumb || cachedMemThumb || null);

    useEffect(() => {
        if (localVaultThumb) {
            setThumbUri(localVaultThumb);
            return;
        }

        let isMounted = true;

        async function resolveVideoThumbnail() {
            if (!item?.id) return;

            // Check AsyncStorage persistent cache
            try {
                const storedUri = await AsyncStorage.getItem(`@vthumb_${idStr}`);
                if (storedUri) {
                    localThumbMemoryCache.set(idStr, storedUri);
                    if (isMounted) setThumbUri(storedUri);
                    return;
                }
            } catch (e) {}

            // Only perform native frame extraction if video is ALREADY downloaded locally (file://).
            // NEVER extract frames across remote HTTP streams during list scrolling!
            const localVideoFile = LocalVaultService.getLocalUri(item.id);
            if (!localVideoFile || !localVideoFile.startsWith('file://')) {
                return;
            }

            if (inFlightExtractions.has(idStr)) return;
            inFlightExtractions.add(idStr);

            try {
                const result = await VideoThumbnails.getThumbnailAsync(localVideoFile, {
                    time: 1000,
                    quality: 0.8,
                });

                if (result?.uri) {
                    localThumbMemoryCache.set(idStr, result.uri);
                    if (isMounted) setThumbUri(result.uri);
                    AsyncStorage.setItem(`@vthumb_${idStr}`, result.uri).catch(() => {});
                }
            } catch (err) {
                // Silently fall back to server thumbnail
            } finally {
                inFlightExtractions.delete(idStr);
            }
        }

        resolveVideoThumbnail();

        return () => {
            isMounted = false;
        };
    }, [idStr, localVaultThumb]);

    if (thumbUri) {
        return (
            <Image
                source={{ uri: thumbUri }}
                style={[style, StyleSheet.absoluteFill]}
                contentFit="cover"
                transition={120}
                cachePolicy="memory-disk"
            />
        );
    }

    // Server thumbnail fallback (instant static image request cached by expo-image)
    return (
        <SecureImage
            source={item?.thumbnail_url || `/api/media/${item?.id}/thumbnail`}
            style={style}
            resizeMode="cover"
            showLoader={false}
        />
    );
}
