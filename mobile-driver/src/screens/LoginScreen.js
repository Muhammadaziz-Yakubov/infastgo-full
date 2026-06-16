import React, { useState, useRef, useEffect } from 'react';
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
  Image,
} from 'react-native';
import { api } from '../services/api';

export default function LoginScreen({ onOTPSent }) {
  const [phone, setPhone] = useState('+998');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Animations
  const logoAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(40)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(logoAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(formAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
        Animated.timing(formOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const handleSendOTP = async () => {
    if (phone.length < 12) {
      setError('Iltimos, to\'g\'ri telefon raqam kiriting');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.triggerSeed();
      const response = await api.requestOTP(phone);
      console.log('Driver OTP response:', response);
      onOTPSent(phone, response.devOTP || '');
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
        {/* Animated Logo */}
        <Animated.View style={[styles.header, { opacity: logoAnim }]}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>🚖</Text>
          </View>
          <Text style={styles.logo}>InFast</Text>
          <Text style={styles.logoAccent}>Driver</Text>
          <Text style={styles.subtitle}>Haydovchilar ishchi paneli</Text>
        </Animated.View>

        {/* Form */}
        <Animated.View style={[styles.form, { opacity: formOpacity, transform: [{ translateY: formAnim }] }]}>
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <Text style={styles.infoText}>
            Haydovchi hisoblari admin panel orqali yaratiladi
            </Text>
          </View>

          <Text style={styles.label}>Telefon raqamingiz</Text>
          <View style={styles.inputContainer}>
            <Image source={require('../assets/uz-flag.png')} style={styles.flagIcon} />
            <TextInput
              style={styles.input}
              placeholder="+998901234567"
              placeholderTextColor="rgba(255,255,255,0.2)"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(text) => { setPhone(text); if (error) setError(''); }}
              editable={!loading}
            />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSendOTP}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Text style={styles.buttonText}>Kodni olish</Text>
                <Text style={styles.buttonArrow}>→</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.footer}>
          <View style={styles.footerLine} />
          <Text style={styles.footerText}>InFast Go © 2024</Text>
        </View>
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

  // Header
  header: {
    marginTop: 80,
    alignItems: 'center',
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
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
  logoIcon: {
    fontSize: 28,
  },
  logo: {
    fontSize: 38,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -1,
  },
  logoAccent: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3b32db',
    letterSpacing: 4,
    marginTop: -2,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 10,
    textAlign: 'center',
  },

  // Form
  form: {
    marginBottom: 40,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(59, 50, 219, 0.04)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(59, 50, 219, 0.1)',
    marginBottom: 24,
  },
  infoIcon: {
    fontSize: 14,
    marginRight: 10,
    marginTop: 1,
  },
  infoText: {
    color: '#3b32db',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    fontWeight: '600',
  },
  label: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#EEF2FF',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1.5,
  },
  flagIcon: {
    width: 24,
    height: 16,
    marginLeft: 16,
    marginRight: 8,
    borderRadius: 2,
  },
  input: {
    flex: 1,
    color: '#0F172A',
    paddingVertical: 16,
    paddingRight: 20,
    fontSize: 17,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    marginBottom: 16,
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

  // Footer
  footer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  footerLine: {
    width: 40,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  footerText: {
    color: '#94A3B8',
    fontSize: 12,
  },
});
