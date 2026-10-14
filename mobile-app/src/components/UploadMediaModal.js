import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Image,
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Polyline, Line, Rect } from 'react-native-svg';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { THEME } from '../constants/theme';
import { ApiService } from '../services/api';
import { ChunkUploadService } from '../services/chunkUploadService';
import { ImageWebpService } from '../services/imageWebpService';

import { GoogleDriveDirectService } from '../services/googleDriveDirectService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Upload Icon matching the Web blade template
function WebUploadIcon({ size = 32, color = '#0A84FF' }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Polyline
                points="17 8 12 3 7 8"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Line
                x1={12}
                y1={3}
                x2={12}
                y2={15}
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}

// Chevron Down Icon
function ChevronDownIcon({ size = 16, color = '#8E8E93' }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Polyline
                points="6 9 12 15 18 9"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}

// Checkmark Icon
function CheckIcon({ size = 16, color = '#30D158' }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Polyline
                points="20 6 9 17 4 12"
                stroke={color}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}

// Trash / Remove Icon
function TrashIcon({ size = 16, color = '#FF453A' }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Polyline
                points="3 6 5 6 21 6"
                stroke={color}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                stroke={color}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}

export default function UploadMediaModal({
    visible,
    currentAlbum = null,
    onClose,
    onSuccess,
}) {
    const [albums, setAlbums] = useState([]);
    const [selectedAlbumId, setSelectedAlbumId] = useState(currentAlbum?.id || '');
    const [albumDropdownOpen, setAlbumDropdownOpen] = useState(false);

    // Staged items for upload
    const [stagedFiles, setStagedFiles] = useState([]);
    const [isConverting, setIsConverting] = useState(false);
    const [convertingStatus, setConvertingStatus] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [overallProgress, setOverallProgress] = useState(0);

    // Reset when modal opens or album changes
    useEffect(() => {
        if (visible) {
            setSelectedAlbumId(currentAlbum?.id || '');
            fetchAlbums();
        } else {
            setStagedFiles([]);
            setIsConverting(false);
            setIsUploading(false);
            setOverallProgress(0);
            setAlbumDropdownOpen(false);
        }
    }, [visible, currentAlbum]);

    const fetchAlbums = async () => {
        try {
            const res = await ApiService.getAlbums();
            if (res && res.success) {
                setAlbums(res.data || []);
            }
        } catch (e) {
            console.warn('Failed to load albums for upload:', e);
        }
    };

    const selectedAlbumObj = albums.find((a) => String(a.id) === String(selectedAlbumId));

    // Handle picking files from device gallery
    const handlePickFiles = async () => {
        if (isUploading || isConverting) return;

        try {
            const pickedAssets = await ImageWebpService.pickFromGallery({
                allowsMultiple: true,
                quality: 1.0,
            });

            if (!pickedAssets || pickedAssets.length === 0) return;

            setIsConverting(true);
            const total = pickedAssets.length;
            const convertedList = [];

            for (let i = 0; i < total; i++) {
                const asset = pickedAssets[i];
                const isVideo = Boolean(
                    asset.type === 'video' ||
                    (asset.mimeType && asset.mimeType.startsWith('video/')) ||
                    (asset.mediaType === 'video') ||
                    (asset.uri && /\.(mp4|mov|m4v|webm|3gp)$/i.test(asset.uri))
                );

                if (isVideo) {
                    setConvertingStatus(`Mempersiapkan video (${i + 1}/${total})...`);
                    let thumbnailUri = null;
                    if (VideoThumbnails?.getThumbnailAsync) {
                        try {
                            const thumb = await VideoThumbnails.getThumbnailAsync(asset.uri, {
                                time: 500,
                                quality: 0.85,
                            });
                            thumbnailUri = thumb?.uri || null;
                        } catch (vtErr) {}
                    }
                    convertedList.push({
                        id: `file_${Date.now()}_${i}`,
                        asset: {
                            ...asset,
                            thumbnailUri,
                            isVideo: true,
                            isWebP: false,
                        },
                        name: asset.fileName || asset.filename || `video_${Date.now()}.mp4`,
                        sizeText: ImageWebpService.formatFileSize(asset.fileSize),
                        isWebP: false,
                        isVideo: true,
                        progress: 0,
                        status: 'ready', // 'ready' | 'uploading' | 'done' | 'error'
                        errorMsg: null,
                    });
                } else {
                    setConvertingStatus(`Mengonversi ke WebP HD (${i + 1}/${total})...`);
                    const webpAsset = await ImageWebpService.convertToWebpHD(asset, {
                        maxDimension: 2560,
                        quality: 0.90, // HD visually lossless
                    });

                    convertedList.push({
                        id: `file_${Date.now()}_${i}`,
                        asset: webpAsset,
                        name: webpAsset.fileName,
                        originalSize: webpAsset.originalSize,
                        convertedSize: webpAsset.convertedSize,
                        savingsPercent: webpAsset.savingsPercent,
                        sizeText: `${ImageWebpService.formatFileSize(webpAsset.convertedSize || webpAsset.originalSize)}`,
                        isWebP: Boolean(webpAsset.isWebP),
                        isVideo: false,
                        progress: 0,
                        status: 'ready',
                        errorMsg: null,
                    });
                }
            }

            setStagedFiles((prev) => [...prev, ...convertedList]);
        } catch (err) {
            Alert.alert('Gagal Memilih Berkas', err.message || 'Tidak dapat memproses foto dari galeri.');
        } finally {
            setIsConverting(false);
            setConvertingStatus('');
        }
    };

    // Remove single item from staged list
    const handleRemoveFile = (fileId) => {
        if (isUploading) return;
        setStagedFiles((prev) => prev.filter((item) => item.id !== fileId));
    };

    // Upload process
    const handleStartUpload = async () => {
        if (stagedFiles.length === 0 || isUploading) return;

        setIsUploading(true);
        const total = stagedFiles.length;
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < total; i++) {
            const currentItem = stagedFiles[i];
            if (currentItem.status === 'done') {
                successCount++;
                continue;
            }

            // Update item status to uploading
            setStagedFiles((prev) =>
                prev.map((item, idx) =>
                    idx === i ? { ...item, status: 'uploading', progress: 5 } : item
                )
            );

            try {
                const targetAlbum = selectedAlbumObj ? selectedAlbumObj.name : null;
                const fileAsset = currentItem.asset;

                // 100% Direct to Google Drive from Mobile (bypasses server completely)
                await GoogleDriveDirectService.directUploadMediaItem(fileAsset, {
                    albumName: targetAlbum,
                    onProgress: (percent) => {
                        setStagedFiles((prev) =>
                            prev.map((item, idx) =>
                                idx === i ? { ...item, progress: percent } : item
                            )
                        );
                    },
                });

                // Mark item as done
                setStagedFiles((prev) =>
                    prev.map((item, idx) =>
                        idx === i ? { ...item, status: 'done', progress: 100 } : item
                    )
                );
                successCount++;
            } catch (err) {
                console.warn(`[UploadModal] Error uploading ${currentItem.name}:`, err);
                setStagedFiles((prev) =>
                    prev.map((item, idx) =>
                        idx === i
                            ? { ...item, status: 'error', errorMsg: err.message || 'Gagal mengunggah ke Google Drive' }
                            : item
                    )
                );
                failCount++;
            }

            setOverallProgress(Math.round(((i + 1) / total) * 100));
        }

        setIsUploading(false);

        if (failCount === 0) {
            const albumNameText = selectedAlbumObj ? ` ke album "${selectedAlbumObj.name}"` : '';
            Alert.alert(
                'Unggahan Berhasil',
                `${successCount} berkas WebP HD berhasil diunggah langsung ke Google Drive${albumNameText}!`,
                [
                    {
                        text: 'Selesai',
                        onPress: () => {
                            if (onSuccess) onSuccess();
                            if (onClose) onClose();
                        },
                    },
                ]
            );
        } else {
            Alert.alert(
                'Sebagian Gagal',
                `${successCount} berhasil diunggah, ${failCount} berkas gagal.`
            );
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={() => {
                if (!isUploading && onClose) onClose();
            }}
        >
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.container}>
                    {/* Header: Exact replica of Web Admin page-header */}
                    <View style={styles.pageHeader}>
                        <View style={styles.headerTitleWrap}>
                            <Text style={styles.pageTitle}>Upload Media</Text>
                            <Text style={styles.pageSubtitle}>
                                Pilih foto dan video dari Galeri HP Anda
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={() => {
                                if (!isUploading && onClose) onClose();
                            }}
                            disabled={isUploading}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Text style={styles.closeBtnText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.scrollArea}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* 1. Album Selection (Matches Web .form-group / select#upload-album) */}
                        <View style={styles.albumSection}>
                            <Text style={styles.formLabel}>Upload to Album (optional)</Text>
                            <TouchableOpacity
                                style={styles.formSelect}
                                onPress={() => {
                                    if (!isUploading) setAlbumDropdownOpen(!albumDropdownOpen);
                                }}
                                activeOpacity={0.75}
                            >
                                <Text style={styles.formSelectText} numberOfLines={1}>
                                    {selectedAlbumObj ? `📁 ${selectedAlbumObj.name}` : 'Tidak ada album (No Album)'}
                                </Text>
                                <ChevronDownIcon size={16} color="#8E8E93" />
                            </TouchableOpacity>

                            {/* Dropdown Options List */}
                            {albumDropdownOpen && (
                                <View style={styles.dropdownList}>
                                    <TouchableOpacity
                                        style={[
                                            styles.dropdownItem,
                                            !selectedAlbumId && styles.dropdownItemActive,
                                        ]}
                                        onPress={() => {
                                            setSelectedAlbumId('');
                                            setAlbumDropdownOpen(false);
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.dropdownItemText,
                                                !selectedAlbumId && styles.dropdownItemTextActive,
                                            ]}
                                        >
                                            Tidak ada album (No Album)
                                        </Text>
                                        {!selectedAlbumId && <CheckIcon size={15} color="#0A84FF" />}
                                    </TouchableOpacity>

                                    {albums.map((album) => {
                                        const isSelected = String(album.id) === String(selectedAlbumId);
                                        return (
                                            <TouchableOpacity
                                                key={album.id}
                                                style={[
                                                    styles.dropdownItem,
                                                    isSelected && styles.dropdownItemActive,
                                                ]}
                                                onPress={() => {
                                                    setSelectedAlbumId(String(album.id));
                                                    setAlbumDropdownOpen(false);
                                                }}
                                            >
                                                <Text
                                                    style={[
                                                        styles.dropdownItemText,
                                                        isSelected && styles.dropdownItemTextActive,
                                                    ]}
                                                    numberOfLines={1}
                                                >
                                                    📁 {album.name}
                                                </Text>
                                                {isSelected && <CheckIcon size={15} color="#0A84FF" />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </View>

                        {/* 2. Upload Zone (Matches Web .upload-zone) */}
                        <TouchableOpacity
                            style={[
                                styles.uploadZone,
                                isConverting && styles.uploadZoneActive,
                            ]}
                            onPress={handlePickFiles}
                            disabled={isUploading || isConverting}
                            activeOpacity={0.7}
                        >
                            <View style={styles.uploadZoneIcon}>
                                {isConverting ? (
                                    <ActivityIndicator size="small" color="#0A84FF" />
                                ) : (
                                    <WebUploadIcon size={28} color="#0A84FF" />
                                )}
                            </View>

                            <Text style={styles.uploadZoneText}>
                                {isConverting
                                    ? convertingStatus || 'Sedang memproses foto...'
                                    : 'Drop files here or click to browse'}
                            </Text>

                            <Text style={styles.uploadZoneHint}>
                                Supports: JPG, PNG, GIF, WEBP, MP4, WEBM, MOV • Max 500MB per file
                            </Text>

                            <View style={styles.webpBadge}>
                                <Text style={styles.webpBadgeText}>
                                    ✨ Otomatis diubah ke WebP Kualitas HD (Jernih & Hemat Memori)
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* 3. Upload Progress List (Matches Web .upload-progress-list) */}
                        {stagedFiles.length > 0 && (
                            <View style={styles.uploadProgressList}>
                                <View style={styles.listHeaderRow}>
                                    <Text style={styles.listSectionTitle}>
                                        Berkas Siap Diunggah ({stagedFiles.length})
                                    </Text>
                                    {!isUploading && (
                                        <TouchableOpacity
                                            onPress={() => setStagedFiles([])}
                                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                        >
                                            <Text style={styles.clearAllText}>Hapus Semua</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {stagedFiles.map((item) => (
                                    <View key={item.id} style={styles.uploadProgressItem}>
                                        {/* Thumbnail preview */}
                                        <Image
                                            source={{
                                                uri: item.asset.thumbnailUri || item.asset.uri,
                                            }}
                                            style={styles.itemThumb}
                                            resizeMode="cover"
                                        />

                                        {/* Name & Details */}
                                        <View style={styles.itemInfo}>
                                            <Text style={styles.uploadProgressName} numberOfLines={1}>
                                                {item.name}
                                            </Text>

                                            <View style={styles.itemMetaRow}>
                                                {item.isWebP && (
                                                    <View style={styles.webpPill}>
                                                        <Text style={styles.webpPillText}>
                                                            WebP HD {item.savingsPercent > 0 ? `(-${item.savingsPercent}%)` : ''}
                                                        </Text>
                                                    </View>
                                                )}
                                                {item.isVideo && (
                                                    <View style={styles.videoPill}>
                                                        <Text style={styles.videoPillText}>Video</Text>
                                                    </View>
                                                )}
                                                <Text style={styles.sizeText}>{item.sizeText}</Text>
                                            </View>

                                            {/* Progress bar */}
                                            {item.status !== 'ready' && (
                                                <View style={styles.uploadProgressBar}>
                                                    <View
                                                        style={[
                                                            styles.uploadProgressFill,
                                                            { width: `${item.progress}%` },
                                                            item.status === 'done' && styles.fillSuccess,
                                                            item.status === 'error' && styles.fillError,
                                                        ]}
                                                    />
                                                </View>
                                            )}
                                        </View>

                                        {/* Status / Percentage / Actions */}
                                        <View style={styles.itemActionWrap}>
                                            {item.status === 'ready' && !isUploading && (
                                                <TouchableOpacity
                                                    onPress={() => handleRemoveFile(item.id)}
                                                    style={styles.itemRemoveBtn}
                                                >
                                                    <TrashIcon size={16} color="#FF453A" />
                                                </TouchableOpacity>
                                            )}
                                            {item.status === 'uploading' && (
                                                <Text style={styles.uploadProgressStatus}>
                                                    {item.progress}%
                                                </Text>
                                            )}
                                            {item.status === 'done' && (
                                                <View style={styles.statusDoneWrap}>
                                                    <CheckIcon size={16} color="#30D158" />
                                                </View>
                                            )}
                                            {item.status === 'error' && (
                                                <Text style={styles.statusErrorText}>Gagal</Text>
                                            )}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* 4. Action Buttons (Unggah Media & Back button) */}
                        <View style={styles.bottomActionsWrap}>
                            {stagedFiles.length > 0 && (
                                <TouchableOpacity
                                    style={[
                                        styles.btnPrimary,
                                        isUploading && styles.btnDisabled,
                                    ]}
                                    onPress={handleStartUpload}
                                    disabled={isUploading}
                                    activeOpacity={0.8}
                                >
                                    {isUploading ? (
                                        <View style={styles.btnLoadingRow}>
                                            <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                                            <Text style={styles.btnPrimaryText}>
                                                Mengunggah ({overallProgress}%)...
                                            </Text>
                                        </View>
                                    ) : (
                                        <Text style={styles.btnPrimaryText}>
                                            Unggah {stagedFiles.length} Berkas Sekarang
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            )}

                            {/* Back button: Exact replica of web .btn-secondary (← Back to Media) */}
                            <TouchableOpacity
                                style={styles.btnSecondary}
                                onPress={() => {
                                    if (!isUploading && onClose) onClose();
                                }}
                                disabled={isUploading}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.btnSecondaryText}>← Back to Media</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#000000',
    },
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    pageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 14 : 6,
        paddingBottom: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    headerTitleWrap: {
        flex: 1,
    },
    pageTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: -0.4,
    },
    pageSubtitle: {
        fontSize: 13,
        color: '#8E8E93',
        marginTop: 2,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12,
    },
    closeBtnText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    scrollArea: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 40,
    },
    // Album Selection
    albumSection: {
        marginBottom: 20,
    },
    formLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8E8E93',
        marginBottom: 8,
        letterSpacing: -0.1,
    },
    formSelect: {
        height: 48,
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
    },
    formSelectText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
        marginRight: 8,
    },
    dropdownList: {
        marginTop: 6,
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
        overflow: 'hidden',
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    dropdownItemActive: {
        backgroundColor: 'rgba(10, 132, 255, 0.12)',
    },
    dropdownItemText: {
        fontSize: 14,
        color: '#CCCCCC',
        flex: 1,
    },
    dropdownItemTextActive: {
        color: '#0A84FF',
        fontWeight: '600',
    },
    // Upload Zone
    uploadZone: {
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderStyle: 'dashed',
        borderRadius: 16,
        backgroundColor: '#161618',
        paddingVertical: 36,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    uploadZoneActive: {
        borderColor: '#0A84FF',
        backgroundColor: 'rgba(10, 132, 255, 0.05)',
    },
    uploadZoneIcon: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: 'rgba(10, 132, 255, 0.14)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    uploadZoneText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 6,
        textAlign: 'center',
    },
    uploadZoneHint: {
        fontSize: 12,
        color: '#8E8E93',
        textAlign: 'center',
        lineHeight: 17,
        maxWidth: 320,
    },
    webpBadge: {
        marginTop: 14,
        backgroundColor: 'rgba(48, 209, 88, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(48, 209, 88, 0.3)',
    },
    webpBadgeText: {
        fontSize: 11,
        color: '#30D158',
        fontWeight: '600',
    },
    // Upload Progress List
    uploadProgressList: {
        marginBottom: 24,
    },
    listHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    listSectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    clearAllText: {
        fontSize: 12,
        color: '#FF453A',
        fontWeight: '500',
    },
    uploadProgressItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    itemThumb: {
        width: 44,
        height: 44,
        borderRadius: 8,
        backgroundColor: '#2C2C2E',
        marginRight: 10,
    },
    itemInfo: {
        flex: 1,
        justifyContent: 'center',
        marginRight: 8,
    },
    uploadProgressName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 3,
    },
    itemMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    webpPill: {
        backgroundColor: 'rgba(10, 132, 255, 0.2)',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
    },
    webpPillText: {
        fontSize: 10,
        color: '#0A84FF',
        fontWeight: '700',
    },
    videoPill: {
        backgroundColor: 'rgba(255, 159, 10, 0.2)',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
    },
    videoPillText: {
        fontSize: 10,
        color: '#FF9F0A',
        fontWeight: '700',
    },
    sizeText: {
        fontSize: 11,
        color: '#8E8E93',
    },
    uploadProgressBar: {
        height: 4,
        backgroundColor: '#2C2C2E',
        borderRadius: 2,
        overflow: 'hidden',
        marginTop: 2,
    },
    uploadProgressFill: {
        height: '100%',
        backgroundColor: '#0A84FF',
        borderRadius: 2,
    },
    fillSuccess: {
        backgroundColor: '#30D158',
    },
    fillError: {
        backgroundColor: '#FF453A',
    },
    itemActionWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 36,
    },
    itemRemoveBtn: {
        padding: 6,
    },
    uploadProgressStatus: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0A84FF',
    },
    statusDoneWrap: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(48, 209, 88, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusErrorText: {
        fontSize: 11,
        color: '#FF453A',
        fontWeight: '600',
    },
    // Bottom Buttons
    bottomActionsWrap: {
        marginTop: 10,
        alignItems: 'center',
    },
    btnPrimary: {
        width: '100%',
        height: 48,
        backgroundColor: '#0A84FF',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    btnLoadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    btnPrimaryText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    btnDisabled: {
        opacity: 0.6,
    },
    btnSecondary: {
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    btnSecondaryText: {
        color: '#8E8E93',
        fontSize: 14,
        fontWeight: '500',
    },
});
