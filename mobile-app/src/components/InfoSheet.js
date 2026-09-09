import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { THEME } from '../constants/theme';
import SFSymbol from './SFSymbol';

export default function InfoSheet({ visible, item, onClose, onRename }) {
    if (!item) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.backdrop}
                activeOpacity={1}
                onPress={onClose}
            >
                <TouchableOpacity
                    style={styles.sheetContainer}
                    activeOpacity={1}
                    onPress={(e) => e.stopPropagation()}
                >
                    {/* Grab handle */}
                    <View style={styles.handle} />

                    <View style={styles.header}>
                        <Text style={styles.title}>Info Media</Text>
                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={onClose}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <SFSymbol name="xmark" size={14} color="#8E8E93" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Title & Rename */}
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>Judul</Text>
                            <View style={styles.titleRow}>
                                <Text style={styles.itemTitle}>{item.title}</Text>
                                <TouchableOpacity onPress={onRename} style={styles.renameBtn} activeOpacity={0.7}>
                                    <SFSymbol name="pencil" size={12} color="#0A84FF" style={{ marginRight: 4 }} />
                                    <Text style={styles.renameBtnText}>Ubah</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Metadata Grid */}
                        <View style={styles.sectionCard}>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Tipe Berkas</Text>
                                <Text style={styles.infoValue}>{(item.mime_type || item.type).toUpperCase()}</Text>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Ukuran</Text>
                                <Text style={styles.infoValue}>{item.formatted_size || `${(item.size / 1024).toFixed(1)} KB`}</Text>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Album</Text>
                                <Text style={styles.infoValue}>{item.album_name || 'Tanpa Album'}</Text>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Tanggal Unggah</Text>
                                <Text style={styles.infoValue}>{item.formatted_date || item.created_at || '-'}</Text>
                            </View>
                        </View>

                        {/* Security Card */}
                        <View style={styles.securityCard}>
                            <SFSymbol name="lock.fill" size={22} color="#30D158" style={{ marginRight: 12, marginTop: 2 }} />
                            <View style={styles.securityTextWrap}>
                                <Text style={styles.securityTitle}>Google Drive Cloud Storage</Text>
                                <Text style={styles.securityDesc}>
                                    Terenkripsi AES-256-CBC End-to-End dengan Private Encryption Key server.
                                </Text>
                            </View>
                        </View>
                    </ScrollView>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: '#1c1c1e',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '65%',
        paddingBottom: 30,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    handle: {
        width: 38,
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        color: '#ffffff',
    },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#2c2c2e',
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    section: {
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 12,
        color: '#8e8e93',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    itemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
        flex: 1,
        marginRight: 10,
    },
    renameBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(10, 132, 255, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },
    renameBtnText: {
        fontSize: 13,
        color: '#0A84FF',
        fontWeight: '600',
    },
    sectionCard: {
        backgroundColor: '#2c2c2e',
        borderRadius: 12,
        paddingHorizontal: 14,
        marginBottom: 16,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    infoLabel: {
        color: '#8e8e93',
        fontSize: 14,
    },
    infoValue: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '500',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    securityCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(48, 209, 88, 0.08)',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(48, 209, 88, 0.2)',
        marginBottom: 20,
    },
    securityTextWrap: {
        flex: 1,
    },
    securityTitle: {
        color: '#30d158',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    },
    securityDesc: {
        color: '#cbd5e1',
        fontSize: 12,
        lineHeight: 16,
    },
});
