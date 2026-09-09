import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { MediaUrlHelper } from '../services/mediaUrl';

export default function SecureImage({ source, style, resizeMode = 'cover', ...props }) {
    const rawUri = typeof source === 'string' ? source : source?.uri;
    const resolvedUri = MediaUrlHelper.resolve(rawUri);
    const token = MediaUrlHelper.getToken();

    if (!resolvedUri) {
        return null;
    }

    return (
        <Image
            source={{
                uri: resolvedUri,
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            }}
            style={style}
            resizeMode={resizeMode}
            {...props}
        />
    );
}
