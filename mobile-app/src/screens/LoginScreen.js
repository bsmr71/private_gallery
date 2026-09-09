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
} from 'react-native';
import { THEME } from '../constants/theme';
import { ApiService } from '../services/api';
import { StorageService } from '../services/storage';

import SFSymbol from '../components/SFSymbol';

export default function LoginScreen({ onLoginSuccess }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [twoFactorCode, setTwoFactorCode] = useState('');
    const [requires2FA, setRequires2FA] = useState(false);
    const [loading, setLoading] = useState(false);

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

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
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

                    {/* Form Card */}
                    <View style={styles.card}>
                        <Text style={styles.inputLabel}>Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="contoh@domain.com"
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
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <Text style={styles.loginBtnText}>
                                    {requires2FA ? 'Verifikasi & Masuk' : 'Masuk'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Footer Security Badge */}
                    <View style={styles.footerBadge}>
                        <SFSymbol name="lock.fill" size={13} color="#8E8E93" style={{ marginRight: 6 }} />
                        <Text style={styles.footerText}>Terenkripsi Privat End-to-End Google Drive</Text>
                    </View>
                </ScrollView>
            </TouchableWithoutFeedback>
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
        paddingVertical: 32,
    },
    brandBox: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logoCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#1c1c1e',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    logoEmoji: {
        fontSize: 34,
    },
    brandTitle: {
        color: '#ffffff',
        fontSize: 26,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    brandSubtitle: {
        color: '#98989f',
        fontSize: 13,
        marginTop: 4,
    },
    card: {
        backgroundColor: '#1c1c1e',
        borderRadius: 20,
        padding: 24,
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
        marginBottom: 18,
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
        marginTop: 28,
    },
    footerText: {
        color: '#8E8E93',
        fontSize: 12,
        fontWeight: '500',
    },
});
