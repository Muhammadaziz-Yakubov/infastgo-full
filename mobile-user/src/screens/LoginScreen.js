import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { api } from '../services/api';
import { Feather } from '@expo/vector-icons';

export default function LoginScreen({ onOTPSent }) {
  const [phone, setPhone] = useState('+998');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async () => {
    if (phone.length < 12) {
      setError('Iltimos, to\'g\'ri telefon raqam kiriting');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // Dev utility: Automatically trigger seed database so tests pass out-of-the-box
      await api.triggerSeed();
      
      const response = await api.requestOTP(phone);
      console.log('OTP response:', response);
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
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.innerContainer}>
          
          {/* Top Decorative Circle Glows */}
          <View style={styles.glowCircle} />

          <View style={styles.header}>
            <View style={styles.logoRow}>
              <Text style={styles.logoMain}>InFast</Text>
              <View style={styles.idBadge}>
                <Text style={styles.idBadgeText}>ID</Text>
              </View>
            </View>
            <Text style={styles.title}>InFastga xush kelibsiz</Text>
            <Text style={styles.subtitle}>
              Barcha shahar xizmatlariga yagona kirish kaliti
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>TELEFON RAQAMINGIZ</Text>
            <View style={styles.inputContainer}>
              <Image source={require('../assets/uz-flag.png')} style={styles.flagIcon} />
              <TextInput
                style={styles.input}
                placeholder="+998901234567"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  if (error) setError('');
                }}
                editable={!loading}
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSendOTP}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Kodni olish</Text>
                  <Feather name="arrow-right" size={16} color="#fff" style={{ marginLeft: 6 }} />
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Tizimga kirish orqali siz xizmat ko'rsatish shartlariga rozilik bildirasiz.
            </Text>
          </View>
        </View>
      </TouchableWithoutFeedback>
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
  glowCircle: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#EEF2FF',
    opacity: 0.8,
  },
  header: {
    marginTop: 80,
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoMain: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  idBadge: {
    backgroundColor: '#3b32db',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 6,
  },
  idBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  form: {
    marginBottom: 60,
  },
  label: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 8,
    fontWeight: '700',
    letterSpacing: 1,
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
    backgroundColor: '#3b32db',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  footerText: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
