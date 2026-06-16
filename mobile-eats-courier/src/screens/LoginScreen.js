import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  TextInput, ActivityIndicator, SafeAreaView,
  StatusBar, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

export default function LoginScreen({ onLogin }) {
  const [phone, setPhone] = useState('+998');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const cleaned = phone.trim();
    if (cleaned.length < 9) {
      Alert.alert('Xatolik', 'Iltimos, to\'liq telefon raqamini kiriting.');
      return;
    }
    try {
      setLoading(true);
      const res = await api.login(cleaned);
      if (res.success && res.token) {
        await api.setToken(res.token);
        await AsyncStorage.setItem('eats_courier_info', JSON.stringify(res.courier));
        onLogin(res.courier);
      }
    } catch (err) {
      Alert.alert('Kirish xatosi', err.message || 'Bunday raqam topilmadi. Admin orqali ro\'yxatdan o\'ting.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A2E" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        
        {/* Logo Area */}
        <View style={styles.logoArea}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoIconText}>🛵</Text>
          </View>
          <Text style={styles.logoTitle}>InFast <Text style={styles.logoAccent}>Eats</Text></Text>
          <Text style={styles.logoSubtitle}>Kurer ilovasi</Text>
        </View>

        {/* Login Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tizimga kirish</Text>
          <Text style={styles.cardDesc}>
            Admin tomonidan ro'yxatga kiritilgan telefon raqamingizni kiriting
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Telefon raqam</Text>
            <View style={styles.inputRow}>
              <Text style={styles.inputFlag}>🇺🇿</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+998 90 123 45 67"
                placeholderTextColor="#64748B"
                keyboardType="phone-pad"
                autoFocus
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.loginBtnText}>Kirish</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.helpText}>
          Hisob yo'qmi? Admin bilan bog'laning
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoIcon: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: 'rgba(255,149,0,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,149,0,0.3)',
  },
  logoIconText: { fontSize: 36 },
  logoTitle: { fontSize: 30, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  logoAccent: { color: '#FF9500' },
  logoSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 4 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 24,
    padding: 24, marginBottom: 16,
  },
  cardTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 6 },
  cardDesc: { fontSize: 13, color: '#64748B', fontWeight: '500', lineHeight: 18, marginBottom: 24 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E2E8F0',
    borderRadius: 12, paddingHorizontal: 14, height: 50,
  },
  inputFlag: { fontSize: 20, marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#0F172A', fontWeight: '600' },
  inputContainer: { marginBottom: 20 },
  loginBtn: {
    backgroundColor: '#FF9500', borderRadius: 14,
    height: 52, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF9500', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  helpText: { textAlign: 'center', color: '#475569', fontSize: 12, fontWeight: '500' },
});
