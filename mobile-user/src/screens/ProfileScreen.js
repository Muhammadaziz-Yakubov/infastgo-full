import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  StatusBar,
  Image,
} from 'react-native';
import { api } from '../services/api';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function ProfileScreen({ user, onProfileUpdated, onViewHistory, onBack, onViewHome }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(user.name || '');
  const [surname, setSurname] = useState(user.surname || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !surname.trim()) {
      setError('Ism va familiyani kiritish majburiy');
      setSuccess('');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await api.updateProfile(name, surname);
      if (res.success && res.user) {
        setSuccess('Profil muvaffaqiyatli saqlandi!');
        onProfileUpdated(res.user);
      } else {
        setError(res.message || 'Xatolik yuz berdi');
      }
    } catch (err) {
      setError(err.message || 'Serverga bog\'lanishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { paddingTop: Math.max(insets.top, 8) }]}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.6}>
              <Feather name="arrow-left" size={20} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mening hisobim</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Avatar Section */}
            <View style={styles.avatarContainer}>
              <Image
                source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }}
                style={styles.avatarBig}
              />
              <Text style={styles.userPhone}>{user.phone}</Text>
              <Text style={styles.userRole}>InFast Go Foydalanuvchisi</Text>
            </View>

            {/* Form */}
            <View style={styles.formCard}>
              <Text style={styles.cardTitle}>Profil ma'lumotlari</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Ism</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ismingizni kiriting"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Familiya</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Familiyangizni kiriting"
                  placeholderTextColor="#94A3B8"
                  value={surname}
                  onChangeText={setSurname}
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {success ? <Text style={styles.successText}>{success}</Text> : null}

              <TouchableOpacity
                style={[styles.saveBtn, loading && styles.disabledBtn]}
                onPress={handleSave}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Saqlash</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Shortcuts */}
            <View style={styles.shortcutsCard}>
              <Text style={styles.cardTitle}>Tezkor amallar</Text>

              <TouchableOpacity style={styles.shortcutItem} onPress={onViewHistory} activeOpacity={0.7}>
                <View style={styles.shortcutIconBg}>
                  <Feather name="clock" size={15} color="#3b32db" />
                </View>
                <Text style={styles.shortcutText}>Sayohatlar tarixi</Text>
                <Feather name="arrow-right" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Bottom Tab Navigation Bar styled exactly like screenshot */}
          <View style={[styles.bottomTabBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TouchableOpacity style={styles.tabItem} onPress={onViewHome} activeOpacity={0.8}>
              <View style={styles.inactiveTabIcon}>
                <Feather name="home" size={20} color="#64748B" />
              </View>
              <Text style={styles.inactiveTabLabel}>Bosh sahifa</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tabItem} onPress={onViewHistory} activeOpacity={0.8}>
              <View style={styles.inactiveTabIcon}>
                <Feather name="clock" size={20} color="#64748B" />
              </View>
              <Text style={styles.inactiveTabLabel}>Sayohatlar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tabItem} activeOpacity={0.8}>
              <View style={styles.activeTabPill}>
                <Feather name="user" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.activeTabLabel}>Profil</Text>
            </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#EEF0F8',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  avatarContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatarBig: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2.5,
    borderColor: '#3b32db',
    marginBottom: 12,
  },
  userPhone: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '700',
  },
  userRole: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EEF0F8',
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0F172A',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  saveBtn: {
    backgroundColor: '#3b32db',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  disabledBtn: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  successText: {
    color: '#10B981',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  shortcutsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EEF0F8',
    marginBottom: 40,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  shortcutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shortcutIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(59,50,219,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shortcutText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },

  // Bottom Navigation Bar styled exactly like screenshot
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#EEF0F8',
    paddingTop: 10,
    paddingBottom: 12,
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
  },
  tabItem: {
    alignItems: 'center',
    flex: 1,
  },
  activeTabPill: {
    backgroundColor: '#3b32db',
    width: 58,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  inactiveTabIcon: {
    width: 58,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  activeTabLabel: {
    color: '#3b32db',
    fontSize: 12,
    fontWeight: '700',
  },
  inactiveTabLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
});
