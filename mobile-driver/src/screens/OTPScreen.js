import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { api, setToken } from '../services/api';

export default function OTPScreen({ phone, devCode, onVerified, onBack }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (devCode) setCode(devCode);
  }, [devCode]);

  const handleVerify = async () => {
    if (code.length < 6) {
      setError('Tasdiqlash kodi 6 ta raqamdan iborat bo\'lishi shart');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await api.verifyOTP(phone, code);
      if (response.success) {
        setToken(response.token);
        onVerified(response.user);
      } else {
        setError(response.message || 'Kodni tasdiqlashda xatolik');
      }
    } catch (err) {
      setError(err.message || 'Xatolik yuz berdi. Iltimos qaytadan urinib ko\'ring.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.innerContainer}>
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <View style={styles.lockIcon}>
            <Text style={styles.lockEmoji}>🔐</Text>
          </View>
          <Text style={styles.title}>Kodni kiriting</Text>
          <Text style={styles.subtitle}>{phone} raqamiga yuborilgan tasdiqlash kodini kiriting</Text>
        </Animated.View>

        <Animated.View style={[styles.form, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.codeInputContainer}>
            <TextInput
              style={styles.input}
              placeholder="• • • • • •"
              placeholderTextColor="rgba(255,255,255,0.15)"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={(text) => { setCode(text); if (error) setError(''); }}
              editable={!loading}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {devCode ? (
            <View style={styles.devBox}>
              <View style={styles.devBadge}>
                <Text style={styles.devBadgeText}>DEV</Text>
              </View>
              <Text style={styles.devText}>Auto-filled: {devCode}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Text style={styles.buttonText}>Tasdiqlash</Text>
                <Text style={styles.buttonArrow}>→</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity style={styles.backButton} onPress={onBack} disabled={loading} activeOpacity={0.6}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Orqaga qaytish</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  innerContainer: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
  },

  header: {
    marginTop: 80,
    alignItems: 'center',
  },
  lockIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 50, 219, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(59, 50, 219, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1.5,
  },
  lockEmoji: {
    fontSize: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '850', // Wait! iOS font weights are usually '800' or 'bold'
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 280,
  },

  form: {
    marginVertical: 40,
  },
  codeInputContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#EEF2FF',
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1.5,
  },
  input: {
    color: '#0F172A',
    paddingVertical: 20,
    paddingHorizontal: 20,
    fontSize: 28,
    textAlign: 'center',
    letterSpacing: 12,
    fontWeight: '800',
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 13,
    fontWeight: '600',
  },
  devBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 20,
  },
  devBadge: {
    backgroundColor: '#A7F3D0',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginRight: 10,
  },
  devBadgeText: {
    color: '#065F46',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  devText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b32db',
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonArrow: {
    color: '#FFFFFF',
    fontSize: 18,
    marginLeft: 8,
    fontWeight: '600',
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    padding: 10,
  },
  backArrow: {
    color: '#3b32db',
    fontSize: 16,
    marginRight: 6,
    fontWeight: '700',
  },
  backText: {
    color: '#3b32db',
    fontSize: 14,
    fontWeight: '700',
  },
});
