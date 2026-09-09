import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    Platform,
    StatusBar,
    Vibration,
} from 'react-native';
import { BlurView } from 'expo-blur';
import SFSymbol from './SFSymbol';
import { SecurityService } from '../services/securityService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PIN_LENGTH = 6;

const KEYPAD = [
    { number: '1', letters: '' },
    { number: '2', letters: 'ABC' },
    { number: '3', letters: 'DEF' },
    { number: '4', letters: 'GHI' },
    { number: '5', letters: 'JKL' },
    { number: '6', letters: 'MNO' },
    { number: '7', letters: 'PQRS' },
    { number: '8', letters: 'TUV' },
    { number: '9', letters: 'WXYZ' },
    { number: '', letters: '' },
    { number: '0', letters: '' },
    { number: 'del', letters: '' },
];

export default function AppLockOverlay({ visible, onUnlock }) {
    const [pin, setPin] = useState('');
    const [errorText, setErrorText] = useState('');

    const shakeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setPin('');
            setErrorText('');
        }
    }, [visible]);

    const shake = () => {
        try {
            Vibration.vibrate(200);
        } catch (e) {}

        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 12, duration: 45, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -12, duration: 45, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 10, duration: 45, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 45, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 6, duration: 45, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 45, useNativeDriver: true }),
        ]).start();
    };

    const handleKeyPress = async (key) => {
        if (!key) return;

        if (key === 'del') {
            setPin((prev) => prev.slice(0, -1));
            setErrorText('');
            return;
        }

        if (pin.length >= PIN_LENGTH) return;

        const nextPin = pin + key;
        setPin(nextPin);
        setErrorText('');

        if (nextPin.length === PIN_LENGTH) {
            // Verify full PIN
            const verifyRes = await SecurityService.verifyPin(nextPin);
            if (verifyRes.success) {
                setPin('');
                setErrorText('');
                onUnlock && onUnlock({ type: verifyRes.type });
            } else {
                shake();
                setErrorText('Kode Sandi Salah');
                setTimeout(() => {
                    setPin('');
                }, 300);
            }
        }
    };

    if (!visible) return null;

    return (
        <View style={[StyleSheet.absoluteFill, styles.overlayRoot]}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <View style={styles.container}>
                <BlurView tint="dark" intensity={100} style={StyleSheet.absoluteFill} />

                {/* Header Icon & Title */}
                <View style={styles.header}>
                    <View style={styles.iconCircle}>
                        <SFSymbol name="lock.fill" size={32} color="#ffffff" />
                    </View>
                    <Text style={styles.title}>Masukkan Kode Sandi</Text>
                    <Text style={styles.subtitle}>
                        {errorText ? errorText : 'Perpustakaan Pribadi Terkunci'}
                    </Text>
                </View>

                {/* 6-Dot Passcode Indicator */}
                <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
                    {Array.from({ length: PIN_LENGTH }).map((_, idx) => {
                        const filled = idx < pin.length;
                        return (
                            <View
                                key={idx}
                                style={[
                                    styles.dot,
                                    filled && styles.dotFilled,
                                    errorText ? styles.dotError : null,
                                ]}
                            />
                        );
                    })}
                </Animated.View>

                {/* Numeric Keypad (Authentic Apple iOS Passcode) */}
                <View style={styles.keypad}>
                    {KEYPAD.map((btn, index) => {
                        if (!btn.number) {
                            return <View key={index} style={styles.keypadBtnPlaceholder} />;
                        }

                        if (btn.number === 'del' && pin.length === 0) {
                            return <View key={index} style={styles.keypadBtnPlaceholder} />;
                        }

                        return (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.keypadBtn,
                                    btn.number === 'del' && styles.keypadUtilityBtn,
                                ]}
                                activeOpacity={0.4}
                                onPress={() => handleKeyPress(btn.number)}
                            >
                                {btn.number === 'del' ? (
                                    <SFSymbol name="delete.left" size={24} color="#ffffff" />
                                ) : (
                                    <View style={styles.keypadNumberWrap}>
                                        <Text style={styles.keypadNumber}>{btn.number}</Text>
                                        {btn.letters ? (
                                            <Text style={styles.keypadLetters}>{btn.letters}</Text>
                                        ) : null}
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        </View>
    );
}

const BTN_SIZE = Math.min(SCREEN_WIDTH * 0.2, 76);

const styles = StyleSheet.create({
    overlayRoot: {
        zIndex: 9999999,
        elevation: 9999999,
        backgroundColor: '#000000',
    },
    container: {
        flex: 1,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    title: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.3,
        marginBottom: 6,
    },
    subtitle: {
        color: '#8E8E93',
        fontSize: 13,
        fontWeight: '500',
    },
    dotsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 40,
        height: 24,
    },
    dot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 1.5,
        borderColor: '#ffffff',
        backgroundColor: 'transparent',
    },
    dotFilled: {
        backgroundColor: '#ffffff',
    },
    dotError: {
        borderColor: '#FF453A',
        backgroundColor: '#FF453A',
    },
    keypad: {
        width: BTN_SIZE * 3 + 50,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 16,
    },
    keypadBtn: {
        width: BTN_SIZE,
        height: BTN_SIZE,
        borderRadius: BTN_SIZE / 2,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    keypadUtilityBtn: {
        backgroundColor: 'transparent',
    },
    keypadBtnPlaceholder: {
        width: BTN_SIZE,
        height: BTN_SIZE,
    },
    keypadNumberWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    keypadNumber: {
        color: '#ffffff',
        fontSize: 30,
        fontWeight: '400',
        letterSpacing: -0.5,
        lineHeight: 34,
    },
    keypadLetters: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 1.5,
        marginTop: -1,
    },
});
