import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { api, setToken } from '../services/api';
import { Feather } from '@expo/vector-icons';

export default function OTPScreen({ phone, devCode, onVerified, onBack }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Automatically auto-fill devOTP in dev mode for easy testing
    if (devCode) {
      setCode(devCode);
    }
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
      console.log('Verify response:', response);
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
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.innerContainer}>
          
          {/* Top Decorative Glow */}
          <View style={styles.glowCircle} />

          <View style={styles.header}>
            <Text style={styles.title}>Tasdiqlash kodi</Text>
            <Text style={styles.subtitle}>
              {phone} raqamiga yuborilgan 6 xonali SMS kodini kiriting
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="000000"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={(text) => {
                setCode(text);
                if (error) setError('');
              }}
              editable={!loading}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {devCode ? (
              <View style={styles.devBox}>
                <Feather name="cpu" size={16} color="#10B981" style={{ marginRight: 6 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.devTitle}>DEV MOCK MODE</Text>
                  <Text style={styles.devText}>SMS kodi: {devCode}</Text>
                </View>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Kodni tasdiqlash</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.backButton} onPress={onBack} disabled={loading} activeOpacity={0.7}>
            <Feather name="edit-3" size={14} color="#3b32db" style={{ marginRight: 6 }} />
            <Text style={styles.backText}>Telefon raqamni tahrirlash</Text>
          </TouchableOpacity>
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
  title: {
    fontSize: 26,
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
    paddingHorizontal: 20,
  },
  form: {
    marginVertical: 40,
  },
  input: {
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#EEF2FF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 26,
    textAlign: 'center',
    letterSpacing: 10,
    fontWeight: '800',
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1.5,
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
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 20,
  },
  devTitle: {
    color: '#065F46',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  devText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  button: {
    backgroundColor: '#3b32db',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    padding: 10,
  },
  backText: {
    color: '#3b32db',
    fontSize: 14,
    fontWeight: '700',
  },
});
