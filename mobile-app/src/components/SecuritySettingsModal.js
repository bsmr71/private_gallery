import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Switch,
    TextInput,
    Alert,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import SFSymbol from './SFSymbol';
import { SecurityService } from '../services/securityService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SecuritySettingsModal({ visible, onClose }) {
    const insets = useSafeAreaInsets();
    const [enabled, setEnabled] = useState(false);
    const [hasMaster, setHasMaster] = useState(false);
    const [hasDecoy, setHasDecoy] = useState(false);
    const [autoLockTimeout, setAutoLockTimeout] = useState('immediately');

    // Editing PIN states
    const [settingMaster, setSettingMaster] = useState(false);
    const [masterInput, setMasterInput] = useState('');
    const [settingDecoy, setSettingDecoy] = useState(false);
    const [decoyInput, setDecoyInput] = useState('');

    const loadSettings = async () => {
        const isEn = await SecurityService.isLockEnabled();
        const hasM = await SecurityService.hasMasterPin();
        const hasD = await SecurityService.hasDecoyPin();
        const timeout = await SecurityService.getAutoLockTimeout();

        setEnabled(isEn);
        setHasMaster(hasM);
        setHasDecoy(hasD);
        setAutoLockTimeout(timeout);
    };

    useEffect(() => {
        if (visible) {
            loadSettings();
            setSettingMaster(false);
            setSettingDecoy(false);
            setMasterInput('');
            setDecoyInput('');
        }
    }, [visible]);

    const handleToggleEnabled = async (val) => {
        if (val && !hasMaster) {
            // Prompt to set Master PIN first
            setSettingMaster(true);
            return;
        }
        setEnabled(val);
        await SecurityService.setLockEnabled(val);
    };

    const handleSaveMasterPin = async () => {
        if (masterInput.length !== 6 || !/^\d{6}$/.test(masterInput)) {
            Alert.alert('Perhatian', 'PIN Utama harus berupa 6 digit angka.');
            return;
        }
        await SecurityService.setMasterPin(masterInput);
        setHasMaster(true);
        setEnabled(true);
        setSettingMaster(false);
        setMasterInput('');
        Alert.alert('Berhasil', 'PIN Utama 6 digit berhasil disimpan. Kunci Aplikasi sekarang aktif!');
    };

    const handleSaveDecoyPin = async () => {
        if (decoyInput.length !== 6 || !/^\d{6}$/.test(decoyInput)) {
            Alert.alert('Perhatian', 'PIN Umpan harus berupa 6 digit angka.');
            return;
        }

        const isSame = await SecurityService.isSameAsMasterPin(decoyInput);
        if (isSame) {
            Alert.alert('PIN Tidak Boleh Sama', 'PIN Umpan harus berbeda dari PIN Utama agar sistem dapat membedakan brankas asli dan brankas umpan.');
            return;
        }

        await SecurityService.setDecoyPin(decoyInput);
        setHasDecoy(true);
        setSettingDecoy(false);
        setDecoyInput('');
        Alert.alert('Berhasil', 'PIN Umpan (Decoy PIN) aktif! Memasukkan PIN ini di layar kunci akan menampilkan brankas kosong.');
    };

    const handleRemoveDecoyPin = async () => {
        await SecurityService.setDecoyPin(null);
        setHasDecoy(false);
        Alert.alert('Dihapus', 'PIN Umpan telah dinonaktifkan.');
    };

    const handleSelectTimeout = async (val) => {
        setAutoLockTimeout(val);
        await SecurityService.setAutoLockTimeout(val);
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.backdrop}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
                    <View style={styles.handle} />

                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerTitleRow}>
                            <SFSymbol name="lock.fill" size={18} color="#0A84FF" style={{ marginRight: 8 }} />
                            <Text style={styles.headerTitle}>Keamanan &amp; Kunci Aplikasi</Text>
                        </View>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <SFSymbol name="xmark" size={14} color="#8E8E93" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.body}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 30 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* 1. Master Toggle */}
                        <View style={styles.card}>
                            <View style={styles.toggleRow}>
                                <View style={{ flex: 1, marginRight: 12 }}>
                                    <Text style={styles.cardTitle}>Kunci Aplikasi (App Lock)</Text>
                                    <Text style={styles.cardDesc}>
                                        Meminta verifikasi Sidik Jari atau PIN setiap kali aplikasi dibuka agar orang lain tidak dapat melihat foto Anda.
                                    </Text>
                                </View>
                                <Switch
                                    value={enabled}
                                    onValueChange={handleToggleEnabled}
                                    trackColor={{ false: '#3a3a3c', true: '#30D158' }}
                                    thumbColor="#ffffff"
                                />
                            </View>
                        </View>

                        {/* 2. PIN Management */}
                        <View style={styles.card}>
                            <Text style={styles.sectionLabel}>PENGATURAN KODE SANDI</Text>

                            {/* Master PIN */}
                            <View style={styles.settingRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rowTitle}>PIN Utama (Master)</Text>
                                    <Text style={styles.rowDesc}>
                                        {hasMaster ? 'PIN 6-digit sudah diatur dan aktif' : 'Belum diatur (Wajib untuk kunci aplikasi)'}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.actionBtn}
                                    onPress={() => setSettingMaster(!settingMaster)}
                                >
                                    <Text style={styles.actionBtnText}>{hasMaster ? 'Ganti' : 'Atur PIN'}</Text>
                                </TouchableOpacity>
                            </View>

                            {settingMaster && (
                                <View style={styles.pinInputWrap}>
                                    <TextInput
                                        style={styles.pinInput}
                                        placeholder="Ketik 4-6 digit PIN Utama"
                                        placeholderTextColor="#8E8E93"
                                        keyboardType="number-pad"
                                        secureTextEntry
                                        maxLength={6}
                                        value={masterInput}
                                        onChangeText={setMasterInput}
                                    />
                                    <TouchableOpacity style={styles.savePinBtn} onPress={handleSaveMasterPin}>
                                        <Text style={styles.savePinText}>Simpan</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View style={styles.divider} />

                            {/* Decoy PIN */}
                            <View style={styles.settingRow}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text style={styles.rowTitle}>PIN Umpan (Decoy / Anti-Paksaan)</Text>
                                    <Text style={styles.rowDesc}>
                                        Jika dipaksa orang lain, masukkan PIN ini. Galeri akan terbuka dalam keadaan kosong bersih.
                                    </Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    {hasDecoy && (
                                        <TouchableOpacity style={styles.dangerSmallBtn} onPress={handleRemoveDecoyPin}>
                                            <Text style={styles.dangerSmallText}>Hapus</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        style={styles.actionBtn}
                                        onPress={() => setSettingDecoy(!settingDecoy)}
                                    >
                                        <Text style={styles.actionBtnText}>{hasDecoy ? 'Ganti' : 'Aktifkan'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {settingDecoy && (
                                <View style={styles.pinInputWrap}>
                                    <TextInput
                                        style={styles.pinInput}
                                        placeholder="Ketik 4-6 digit PIN Umpan"
                                        placeholderTextColor="#8E8E93"
                                        keyboardType="number-pad"
                                        secureTextEntry
                                        maxLength={6}
                                        value={decoyInput}
                                        onChangeText={setDecoyInput}
                                    />
                                    <TouchableOpacity style={styles.savePinBtn} onPress={handleSaveDecoyPin}>
                                        <Text style={styles.savePinText}>Simpan</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {/* 3. Pure PIN Security Notice */}
                        <View style={styles.card}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                <SFSymbol name="lock.fill" size={15} color="#30D158" style={{ marginRight: 8 }} />
                                <Text style={[styles.sectionLabel, { marginBottom: 0, color: '#30D158' }]}>
                                    PERLINDUNGAN MURNI PIN AKTIF
                                </Text>
                            </View>
                            <Text style={styles.cardDesc}>
                                Biometrik dinonaktifkan secara permanen demi keamanan mutlak. Orang lain tidak dapat memaksa Anda menempelkan sidik jari saat tidur atau terdesak. Hanya Anda yang memegang kendali penuh dengan PIN 6 digit.
                            </Text>
                        </View>

                        {/* 4. Auto-Lock Timeout */}
                        <View style={styles.card}>
                            <Text style={styles.sectionLabel}>KUNCI OTOMATIS (AUTO-LOCK)</Text>
                            <Text style={styles.cardDesc}>
                                Kapan aplikasi harus meminta kode sandi kembali setelah ditinggalkan:
                            </Text>

                            <View style={styles.timeoutGroup}>
                                {[
                                    { key: 'immediately', label: 'Langsung (Begitu beralih aplikasi)' },
                                    { key: '1min', label: 'Setelah 1 Menit' },
                                    { key: '5min', label: 'Setelah 5 Menit' },
                                ].map((opt) => {
                                    const selected = autoLockTimeout === opt.key;
                                    return (
                                        <TouchableOpacity
                                            key={opt.key}
                                            style={[styles.timeoutOption, selected && styles.timeoutOptionSelected]}
                                            onPress={() => handleSelectTimeout(opt.key)}
                                        >
                                            <Text style={[styles.timeoutLabel, selected && styles.timeoutLabelSelected]}>
                                                {opt.label}
                                            </Text>
                                            {selected && <SFSymbol name="checkmark" size={14} color="#0A84FF" weight="bold" />}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#1C1C1E',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        maxHeight: '90%',
        paddingBottom: 24,
    },
    handle: {
        width: 36,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    card: {
        backgroundColor: '#2C2C2E',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
    },
    sectionLabel: {
        color: '#8E8E93',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    cardTitle: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 4,
    },
    cardDesc: {
        color: '#8E8E93',
        fontSize: 12,
        lineHeight: 16,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    rowTitle: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    },
    rowDesc: {
        color: '#8E8E93',
        fontSize: 12,
        lineHeight: 16,
    },
    actionBtn: {
        backgroundColor: '#0A84FF',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 14,
    },
    actionBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
    },
    dangerSmallBtn: {
        backgroundColor: 'rgba(255, 69, 58, 0.15)',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    dangerSmallText: {
        color: '#FF453A',
        fontSize: 13,
        fontWeight: '600',
    },
    pinInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 8,
    },
    pinInput: {
        flex: 1,
        backgroundColor: '#1C1C1E',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        color: '#ffffff',
        fontSize: 15,
        letterSpacing: 4,
        borderWidth: 1,
        borderColor: '#0A84FF',
    },
    savePinBtn: {
        backgroundColor: '#30D158',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    savePinText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        marginVertical: 12,
    },
    timeoutGroup: {
        marginTop: 12,
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        overflow: 'hidden',
    },
    timeoutOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    timeoutOptionSelected: {
        backgroundColor: 'rgba(10, 132, 255, 0.12)',
    },
    timeoutLabel: {
        color: '#EBEBF5',
        fontSize: 13,
        fontWeight: '500',
    },
    timeoutLabelSelected: {
        color: '#0A84FF',
        fontWeight: '600',
    },
});
