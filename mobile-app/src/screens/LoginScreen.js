import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    TouchableWithoutFeedback,
    Keyboard,
    Modal,
} from 'react-native';
import { THEME } from '../constants/theme';
import { ApiService } from '../services/api';
import { StorageService } from '../services/storage';
import { GoogleDriveDirectService } from '../services/googleDriveDirectService';
import SFSymbol from '../components/SFSymbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen({ onLoginSuccess }) {
    const insets = useSafeAreaInsets();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [twoFactorCode, setTwoFactorCode] = useState('');
    const [requires2FA, setRequires2FA] = useState(false);
    const [loading, setLoading] = useState(false);

    // Google Sign-In state
    const [googleLoading, setGoogleLoading] = useState(false);
    const [showGoogleModal, setShowGoogleModal] = useState(false);
    const [gTokenInput, setGTokenInput] = useState('');

    const handleLogin = async () => {
        if (!email.trim() || !password) {
            Alert.alert('Perhatian', 'Harap isi email dan kata sandi Anda.');
            return;
        }

        setLoading(true);
        try {
            const res = await ApiService.login(
                email.trim(),
                password,
                requires2FA ? twoFactorCode.trim() : null
            );

            if (res.two_factor_required) {
                setRequires2FA(true);
                Alert.alert('Autentikasi 2-Faktor', 'Akun Anda mengaktifkan 2FA. Masukkan kode 6 digit dari aplikasi authenticator Anda.');
                return;
            }

            if (res.success && res.token) {
                await StorageService.setToken(res.token);
                if (res.user) {
                    await StorageService.setUser(res.user);
                }
                onLoginSuccess && onLoginSuccess();
            } else {
                Alert.alert('Gagal Masuk', res.message || 'Email atau password salah.');
            }
        } catch (err) {
            const title = err.status === 422 ? 'Verifikasi Gagal' : (err.status === 401 ? 'Gagal Masuk' : 'Gagal Terhubung');
            Alert.alert(title, err.message || 'Tidak dapat terhubung ke server galeri.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLoginPress = async () => {
        setGoogleLoading(true);
        try {
            const gInfo = await GoogleDriveDirectService.getConnectionInfo();
            if (gInfo.isConnected && gInfo.email) {
                // Already has connected Google account
                await StorageService.setUser({
                    name: gInfo.email.split('@')[0],
                    email: gInfo.email,
                });
                await StorageService.setToken('google_vault_session_' + Date.now());
                onLoginSuccess && onLoginSuccess();
                return;
            }

            // Open Google connection dialog
            setShowGoogleModal(true);
        } catch (e) {
            Alert.alert('Google Sign-In', e.message || 'Gagal memulai koneksi Google');
        } finally {
            setGoogleLoading(false);
        }
    };

    const handleConnectWithToken = async () => {
        if (!gTokenInput.trim()) {
            Alert.alert('Perhatian', 'Tempel Access Token Google Drive terlebih dahulu');
            return;
        }

        setGoogleLoading(true);
        try {
            await GoogleDriveDirectService.saveAuth(gTokenInput.trim());
            const userEmail = await GoogleDriveDirectService.fetchUserProfile(gTokenInput.trim());
            const emailToUse = userEmail || 'bismar71@gmail.com';

            await StorageService.setUser({
                name: emailToUse.split('@')[0],
                email: emailToUse,
            });
            await StorageService.setToken('google_vault_token_' + Date.now());
            setShowGoogleModal(false);
            onLoginSuccess && onLoginSuccess();
        } catch (e) {
            Alert.alert('Gagal', e.message || 'Token Google tidak valid');
        } finally {
            setGoogleLoading(false);
        }
    };

    const handleOneTapGoogleAdmin = async () => {
        // Fast one-tap login using the admin's default Google Vault account
        const adminEmail = 'bismar71@gmail.com';
        await GoogleDriveDirectService.saveAuth('direct_vault_session', null, adminEmail);
        await StorageService.setUser({
            name: 'Bismar',
            email: adminEmail,
        });
        await StorageService.setToken('google_vault_session_' + Date.now());
        setShowGoogleModal(false);
        onLoginSuccess && onLoginSuccess();
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <ScrollView
                    contentContainerStyle={[
                        styles.scrollContent,
                        {
                            paddingTop: Math.max(insets.top, 36),
                            paddingBottom: Math.max(insets.bottom, 24) + 12,
                        },
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    {/* Logo & Title */}
                    <View style={styles.brandBox}>
                        <View style={styles.logoCircle}>
                            <SFSymbol name="photos" size={38} color="#0A84FF" />
                        </View>
                        <Text style={styles.brandTitle}>Lumina</Text>
                        <Text style={styles.brandSubtitle}>Personal Media Vault</Text>
                    </View>

                    {/* Google Sign-In Primary Button */}
                    <TouchableOpacity
                        style={styles.googlePrimaryBtn}
                        onPress={handleGoogleLoginPress}
                        disabled={googleLoading || loading}
                        activeOpacity={0.85}
                    >
                        <View style={styles.googleIconBadge}>
                            <Text style={styles.googleIconChar}>G</Text>
                        </View>
                        <Text style={styles.googlePrimaryBtnText}>
                            {googleLoading ? 'Menghubungkan...' : 'Masuk dengan Akun Google'}
                        </Text>
                    </TouchableOpacity>

                    {/* Divider */}
                    <View style={styles.dividerRow}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>ATAU DENGAN EMAIL</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Email / Password Form Card */}
                    <View style={styles.card}>
                        <Text style={styles.inputLabel}>Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="bismar71@gmail.com"
                            placeholderTextColor="#8E8E93"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            returnKeyType="next"
                        />

                        <Text style={styles.inputLabel}>Kata Sandi</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            placeholderTextColor="#8E8E93"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            returnKeyType={requires2FA ? 'next' : 'done'}
                            onSubmitEditing={requires2FA ? undefined : handleLogin}
                        />

                        {requires2FA && (
                            <View style={styles.twoFactorBox}>
                                <Text style={styles.twoFactorLabel}>Kode Autentikasi 2FA (6 digit)</Text>
                                <TextInput
                                    style={[styles.input, styles.twoFactorInput]}
                                    placeholder="123456"
                                    placeholderTextColor="#8E8E93"
                                    value={twoFactorCode}
                                    onChangeText={setTwoFactorCode}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    autoFocus
                                    returnKeyType="done"
                                    onSubmitEditing={handleLogin}
                                />
                            </View>
                        )}

                        <TouchableOpacity
                            style={styles.loginBtn}
                            onPress={handleLogin}
                            disabled={loading || googleLoading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <Text style={styles.loginBtnText}>
                                    {requires2FA ? 'Verifikasi & Masuk' : 'Masuk ke Server'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Footer Security Badge */}
                    <View style={styles.footerBadge}>
                        <SFSymbol name="lock.shield.fill" size={14} color="#30D158" style={{ marginRight: 6 }} />
                        <Text style={styles.footerText}>Terenkripsi Privat End-to-End Google Drive</Text>
                    </View>
                </ScrollView>
            </TouchableWithoutFeedback>

            {/* Google Login Options Modal */}
            <Modal
                visible={showGoogleModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowGoogleModal(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={styles.googleIconBadgeLarge}>
                                <Text style={styles.googleIconCharLarge}>G</Text>
                            </View>
                            <Text style={styles.modalTitle}>Masuk dengan Google</Text>
                            <Text style={styles.modalSubtitle}>
                                Pilih metode otentikasi Google Vault Anda
                            </Text>
                        </View>

                        {/* Option 1: Fast One-Tap Admin Google Account */}
                        <TouchableOpacity
                            style={styles.modalOneTapBtn}
                            onPress={handleOneTapGoogleAdmin}
                            activeOpacity={0.8}
                        >
                            <SFSymbol name="person.crop.circle.fill" size={20} color="#0A84FF" style={{ marginRight: 10 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalOneTapTitle}>Lanjutkan sebagai bismar71@gmail.com</Text>
                                <Text style={styles.modalOneTapSub}>Akun Google Vault Utama</Text>
                            </View>
                            <SFSymbol name="chevron.right" size={13} color="#8E8E93" />
                        </TouchableOpacity>

                        {/* Option 2: Paste Access Token */}
                        <View style={styles.tokenBox}>
                            <Text style={styles.tokenLabel}>Atau tempel Access Token Google Drive:</Text>
                            <TextInput
                                style={styles.tokenInput}
                                placeholder="Tempel Access Token..."
                                placeholderTextColor="#636366"
                                value={gTokenInput}
                                onChangeText={setGTokenInput}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            <TouchableOpacity
                                style={styles.tokenBtn}
                                onPress={handleConnectWithToken}
                                disabled={googleLoading}
                            >
                                <Text style={styles.tokenBtnText}>
                                    {googleLoading ? 'Memverifikasi...' : 'Hubungkan Token'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.modalCancelBtn}
                            onPress={() => setShowGoogleModal(false)}
                        >
                            <Text style={styles.modalCancelText}>Batal</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    brandBox: {
        alignItems: 'center',
        marginBottom: 28,
    },
    logoCircle: {
        width: 76,
        height: 76,
        borderRadius: 22,
        backgroundColor: 'rgba(10, 132, 255, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(10, 132, 255, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    brandTitle: {
        fontSize: 32,
        color: '#ffffff',
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    brandSubtitle: {
        color: '#98989f',
        fontSize: 13,
        marginTop: 4,
    },
    googlePrimaryBtn: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        elevation: 4,
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
    },
    googleIconBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#EA4335',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    googleIconChar: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
    },
    googlePrimaryBtnText: {
        color: '#1C1C1E',
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    dividerText: {
        color: '#8E8E93',
        fontSize: 11,
        fontWeight: '600',
        paddingHorizontal: 12,
        letterSpacing: 0.8,
    },
    card: {
        backgroundColor: '#1c1c1e',
        borderRadius: 20,
        padding: 22,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        elevation: 8,
    },
    inputLabel: {
        color: '#cbd5e1',
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#2c2c2e',
        color: '#ffffff',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        marginBottom: 16,
    },
    twoFactorBox: {
        marginTop: 4,
    },
    twoFactorLabel: {
        color: '#38bdf8',
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
    },
    twoFactorInput: {
        borderColor: '#38bdf8',
        borderWidth: 1.5,
        letterSpacing: 4,
        textAlign: 'center',
        fontSize: 18,
    },
    loginBtn: {
        backgroundColor: '#0A84FF',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 6,
    },
    loginBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
    footerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 26,
    },
    footerText: {
        color: '#8E8E93',
        fontSize: 12,
        fontWeight: '500',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalContent: {
        backgroundColor: '#1C1C1E',
        borderRadius: 22,
        padding: 24,
        width: '100%',
        maxWidth: 380,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 18,
    },
    googleIconBadgeLarge: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#EA4335',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    googleIconCharLarge: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '900',
    },
    modalTitle: {
        color: '#FFFFFF',
        fontSize: 19,
        fontWeight: '700',
    },
    modalSubtitle: {
        color: '#8E8E93',
        fontSize: 13,
        marginTop: 4,
        textAlign: 'center',
    },
    modalOneTapBtn: {
        backgroundColor: '#2C2C2E',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(10, 132, 255, 0.3)',
    },
    modalOneTapTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    modalOneTapSub: {
        color: '#30D158',
        fontSize: 12,
        marginTop: 2,
    },
    tokenBox: {
        backgroundColor: '#161618',
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
    },
    tokenLabel: {
        color: '#8E8E93',
        fontSize: 12,
        marginBottom: 8,
    },
    tokenInput: {
        backgroundColor: '#2C2C2E',
        color: '#FFFFFF',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        marginBottom: 10,
    },
    tokenBtn: {
        backgroundColor: '#0A84FF',
        borderRadius: 10,
        paddingVertical: 10,
        alignItems: 'center',
    },
    tokenBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
    },
    modalCancelBtn: {
        paddingVertical: 10,
        alignItems: 'center',
    },
    modalCancelText: {
        color: '#8E8E93',
        fontSize: 14,
        fontWeight: '500',
    },
});
