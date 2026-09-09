import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    TouchableWithoutFeedback,
    Keyboard,
} from 'react-native';
import { THEME } from '../constants/theme';
import { ApiService } from '../services/api';
import SFSymbol from './SFSymbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SecureVaultUnlockModal({ visible, onClose, onUnlocked }) {
    const insets = useSafeAreaInsets();
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [otpType, setOtpType] = useState('email'); // 'email' or 'authenticator'
    const [loading, setLoading] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [statusData, setStatusData] = useState(null);

    useEffect(() => {
        if (visible) {
            setPassword('');
            setOtpCode('');
            setCountdown(0);
            fetchStatus();
        }
    }, [visible]);

    useEffect(() => {
        let timer;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    const fetchStatus = async () => {
        try {
            const res = await ApiService.getVaultStatus();
            if (res.success) {
                setStatusData(res.data);
                // Default to authenticator if user has it, else email
                if (res.data.has_authenticator) {
                    setOtpType('authenticator');
                } else {
                    setOtpType('email');
                }
            }
        } catch (e) {
            // fallback default
        }
    };

    const handleSendEmailOtp = async () => {
        setSendingOtp(true);
        try {
            const res = await ApiService.requestVaultEmailOtp();
            if (res.success) {
                setCountdown(45);
                Alert.alert('Kode OTP Terkirim', res.message || 'Silakan periksa kotak masuk email Anda.');
            }
        } catch (err) {
            Alert.alert('Gagal Mengirim OTP', err.message || 'Tidak dapat mengirim kode OTP email.');
        } finally {
            setSendingOtp(false);
        }
    };

    const handleUnlock = async () => {
        if (!password) {
            Alert.alert('Perhatian', 'Harap masukkan kata sandi akun Anda.');
            return;
        }
        if (!otpCode || otpCode.length !== 6) {
            Alert.alert('Perhatian', 'Harap masukkan 6-digit kode OTP.');
            return;
        }

        setLoading(true);
        try {
            const res = await ApiService.unlockVault(password, otpCode, otpType);
            if (res.success && res.vault_token) {
                setPassword('');
                setOtpCode('');
                onUnlocked(res.vault_token);
            } else {
                Alert.alert('Gagal Membuka', res.message || 'Verifikasi gagal.');
            }
        } catch (err) {
            Alert.alert('Verifikasi Gagal', err.message || 'Kata sandi atau kode OTP tidak valid.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.backdrop}>
                        <View style={styles.sheetCard}>
                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                contentContainerStyle={[styles.scrollInner, { paddingBottom: Math.max(insets.bottom, 20) + 24 }]}
                            >
                                {/* Vault Icon Emblem */}
                                <View style={styles.iconCircle}>
                                    <SFSymbol name="lock.fill" size={32} color="#FF9F0A" />
                                </View>

                                <Text style={styles.modalTitle}>Brankas Terkunci</Text>
                                <Text style={styles.modalSubtitle}>
                                    Masukkan kata sandi dan kode OTP untuk membuka folder rahasia Anda.
                                </Text>

                                {/* Password Input */}
                                <View style={styles.fieldBlock}>
                                    <Text style={styles.label}>Kata Sandi Akun</Text>
                                    <View style={styles.passwordWrapper}>
                                        <TextInput
                                            style={styles.passwordInput}
                                            placeholder="Kata Sandi Anda"
                                            placeholderTextColor="#8E8E93"
                                            value={password}
                                            onChangeText={setPassword}
                                            secureTextEntry={!showPassword}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                        <TouchableOpacity
                                            style={styles.eyeBtn}
                                            onPress={() => setShowPassword(!showPassword)}
                                        >
                                            <SFSymbol
                                                name={showPassword ? 'eye.slash' : 'eye'}
                                                size={18}
                                                color="#8E8E93"
                                            />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Method Switcher: Authenticator vs Email */}
                                <View style={styles.fieldBlock}>
                                    <Text style={styles.label}>Metode Verifikasi OTP</Text>
                                    <View style={styles.tabSwitch}>
                                        {statusData?.has_authenticator && (
                                            <TouchableOpacity
                                                style={[styles.tabBtn, otpType === 'authenticator' && styles.tabBtnActive]}
                                                onPress={() => setOtpType('authenticator')}
                                                activeOpacity={0.8}
                                            >
                                                <SFSymbol
                                                    name="key.fill"
                                                    size={13}
                                                    color={otpType === 'authenticator' ? '#ffffff' : '#8E8E93'}
                                                    style={{ marginRight: 6 }}
                                                />
                                                <Text style={[styles.tabText, otpType === 'authenticator' && styles.tabTextActive]}>
                                                    Authenticator
                                                </Text>
                                            </TouchableOpacity>
                                        )}

                                        <TouchableOpacity
                                            style={[styles.tabBtn, otpType === 'email' && styles.tabBtnActive]}
                                            onPress={() => setOtpType('email')}
                                            activeOpacity={0.8}
                                        >
                                            <SFSymbol
                                                name="envelope.fill"
                                                size={13}
                                                color={otpType === 'email' ? '#ffffff' : '#8E8E93'}
                                                style={{ marginRight: 6 }}
                                            />
                                            <Text style={[styles.tabText, otpType === 'email' && styles.tabTextActive]}>
                                                OTP Email
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Email OTP Action Button */}
                                {otpType === 'email' && (
                                    <View style={styles.emailOtpActionBox}>
                                        <TouchableOpacity
                                            style={[styles.sendOtpBtn, countdown > 0 && styles.sendOtpBtnDisabled]}
                                            onPress={handleSendEmailOtp}
                                            disabled={sendingOtp || countdown > 0}
                                            activeOpacity={0.8}
                                        >
                                            {sendingOtp ? (
                                                <ActivityIndicator size="small" color="#0A84FF" />
                                            ) : (
                                                <Text style={styles.sendOtpText}>
                                                    {countdown > 0
                                                        ? `Kirim ulang (${countdown}s)`
                                                        : 'Kirim Kode OTP ke Email'}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                        {statusData?.email && (
                                            <Text style={styles.emailHint}>
                                                Ke: {statusData.email}
                                            </Text>
                                        )}
                                    </View>
                                )}

                                {/* OTP 6-Digit Input */}
                                <View style={styles.fieldBlock}>
                                    <Text style={styles.label}>
                                        {otpType === 'authenticator' ? 'Kode Authenticator (6 digit)' : 'Kode OTP Email (6 digit)'}
                                    </Text>
                                    <TextInput
                                        style={styles.otpInput}
                                        placeholder="000000"
                                        placeholderTextColor="#636366"
                                        value={otpCode}
                                        onChangeText={setOtpCode}
                                        keyboardType="number-pad"
                                        maxLength={6}
                                        textAlign="center"
                                    />
                                </View>

                                {/* Action Buttons */}
                                <TouchableOpacity
                                    style={styles.unlockBtn}
                                    onPress={handleUnlock}
                                    disabled={loading}
                                    activeOpacity={0.8}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#ffffff" />
                                    ) : (
                                        <Text style={styles.unlockBtnText}>Buka Brankas Terkunci</Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.cancelBtn}
                                    onPress={onClose}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.cancelBtnText}>Batal</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    sheetCard: {
        width: '100%',
        maxHeight: '90%',
        backgroundColor: '#1c1c1e',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        overflow: 'hidden',
        elevation: 20,
    },
    scrollInner: {
        padding: 24,
        alignItems: 'center',
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 159, 10, 0.16)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 159, 10, 0.3)',
    },
    modalTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.4,
        textAlign: 'center',
    },
    modalSubtitle: {
        color: '#98989f',
        fontSize: 13,
        textAlign: 'center',
        marginTop: 6,
        marginBottom: 20,
        lineHeight: 18,
    },
    fieldBlock: {
        width: '100%',
        marginBottom: 16,
    },
    label: {
        color: '#cbd5e1',
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
    },
    passwordWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2c2c2e',
        borderRadius: 12,
        paddingHorizontal: 14,
    },
    passwordInput: {
        flex: 1,
        color: '#ffffff',
        paddingVertical: 12,
        fontSize: 15,
    },
    eyeBtn: {
        padding: 8,
    },
    tabSwitch: {
        flexDirection: 'row',
        backgroundColor: '#2c2c2e',
        borderRadius: 12,
        padding: 4,
    },
    tabBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 9,
    },
    tabBtnActive: {
        backgroundColor: '#3a3a3c',
    },
    tabText: {
        color: '#8E8E93',
        fontSize: 13,
        fontWeight: '600',
    },
    tabTextActive: {
        color: '#ffffff',
    },
    emailOtpActionBox: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 14,
    },
    sendOtpBtn: {
        paddingVertical: 9,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(10, 132, 255, 0.15)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(10, 132, 255, 0.3)',
    },
    sendOtpBtnDisabled: {
        opacity: 0.5,
    },
    sendOtpText: {
        color: '#0A84FF',
        fontSize: 13,
        fontWeight: '600',
    },
    emailHint: {
        color: '#636366',
        fontSize: 11,
        marginTop: 6,
    },
    otpInput: {
        backgroundColor: '#2c2c2e',
        color: '#FF9F0A',
        fontSize: 24,
        fontWeight: '700',
        letterSpacing: 8,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 159, 10, 0.35)',
    },
    unlockBtn: {
        width: '100%',
        backgroundColor: '#FF9F0A',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    unlockBtnText: {
        color: '#000000',
        fontSize: 16,
        fontWeight: '700',
    },
    cancelBtn: {
        paddingVertical: 12,
        marginTop: 4,
    },
    cancelBtnText: {
        color: '#8E8E93',
        fontSize: 14,
        fontWeight: '500',
    },
});
