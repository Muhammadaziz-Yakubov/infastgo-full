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
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { api } from '../services/api';

export default function ProfileSetupScreen({ onProfileSetupComplete }) {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !surname.trim()) {
      setError('Iltimos, ism va familiyangizni to\'liq kiriting');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const response = await api.updateProfile(name, surname);
      if (response.success) {
        onProfileSetupComplete(response.user);
      } else {
        setError(response.message || 'Profilni saqlashda xatolik');
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
          <View style={styles.header}>
            <Text style={styles.title}>Profil yaratish</Text>
            <Text style={styles.subtitle}>Sizga tezkor va qulay xizmat ko'rsatishimiz uchun ma'lumotlaringizni kiriting</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Ismingiz</Text>
            <TextInput
              style={styles.input}
              placeholder="Ali"
              placeholderTextColor="#888"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (error) setError('');
              }}
              editable={!loading}
            />

            <Text style={styles.label}>Familiyangiz</Text>
            <TextInput
              style={styles.input}
              placeholder="Valiyev"
              placeholderTextColor="#888"
              value={surname}
              onChangeText={(text) => {
                setSurname(text);
                if (error) setError('');
              }}
              editable={!loading}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Davom etish</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.space} />
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
    paddingHorizontal: 16,
  },
  form: {
    marginVertical: 40,
  },
  label: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 8,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#EEF2FF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    fontWeight: '600',
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
  button: {
    backgroundColor: '#3b32db',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
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
  space: {
    height: 50,
  },
});
