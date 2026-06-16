import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import { api } from '../services/api';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProfileScreen({ driver, onProfileUpdated, onViewHistory, onBack }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(driver.name || '');
  const [surname, setSurname] = useState(driver.surname || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Active inputs states for border highlights
  const [focusedInput, setFocusedInput] = useState(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSave = async () => {
    if (!name.trim() || !surname.trim()) {
      setError("Ism va familiyani kiritish majburiy!");
      setSuccess('');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await api.updateProfile({
        name: name.trim(),
        surname: surname.trim(),
        status: driver.status, // preserve status
      });
      if (res.success && res.user) {
        setSuccess("Profil muvaffaqiyatli saqlandi!");
        onProfileUpdated(res.user);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(res.message || 'Xatolik yuz berdi');
      }
    } catch (err) {
      setError(err.message || "Serverga bog'lanishda xatolik");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#000000ff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil Ma'lumotlari</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarOuterCircle}>
              <View style={styles.avatarInnerCircle}>
                <Text style={styles.avatarText}>{(name || 'D')[0].toUpperCase()}</Text>
              </View>
              <View style={styles.editBadge}>
                <Feather name="camera" size={14} color="#000000" />
              </View>
            </View>
            <Text style={styles.driverNameText}>{driver.name} {driver.surname}</Text>
            <Text style={styles.userPhone}>{driver.phone}</Text>

            {/* Driver ID Badge */}
            {driver.driverId && (
              <View style={styles.idBadge}>
                <Feather name="hash" size={12} color="#3b32db" style={{ marginRight: 4 }} />
                <Text style={styles.idBadgeText}>ID: {driver.driverId}</Text>
              </View>
            )}

            {/* Status, Rating & ID Pill Grid */}
            <View style={styles.pillsRow}>
              <View style={styles.pillCard}>
                <Feather name="star" size={14} color="#FFD600" style={{ marginRight: 4 }} />
                <Text style={styles.pillValue}>{driver.rating ? driver.rating.toFixed(1) : '5.0'}</Text>
                <Text style={styles.pillLabel}>Reyting</Text>
              </View>
              <View style={styles.pillCard}>
                <View style={[styles.statusDot, { backgroundColor: driver.status === 'online' ? '#00E676' : '#9CA3AF' }]} />
                <Text style={[styles.pillValue, { color: driver.status === 'online' ? '#00E676' : '#9CA3AF' }]}>
                  {driver.status === 'online' ? 'Online' : 'Offline'}
                </Text>
                <Text style={styles.pillLabel}>Holat</Text>
              </View>
              <View style={[styles.pillCard, styles.idPillCard]}>
                <Feather name="shield" size={13} color="#3b32db" />
                <Text style={[styles.pillValue, { color: '#3b32db' }]}>{driver.driverId || '—'}</Text>
                <Text style={styles.pillLabel}>ID</Text>
              </View>
            </View>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <Text style={styles.cardTitle}>Shaxsiy Ma'lumotlar</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ism</Text>
              <View style={[styles.inputWrapper, focusedInput === 'name' && styles.inputWrapperFocused]}>
                <Feather name="user" size={16} color={focusedInput === 'name' ? '#FFD600' : 'rgba(0, 0, 0, 1)'} style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Ismingizni kiriting"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocusedInput('name')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Familiya</Text>
              <View style={[styles.inputWrapper, focusedInput === 'surname' && styles.inputWrapperFocused]}>
                <Feather name="users" size={16} color={focusedInput === 'surname' ? '#FFD600' : 'rgba(0, 0, 0, 1)'} style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Familiyangizni kiriting"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={surname}
                  onChangeText={setSurname}
                  onFocus={() => setFocusedInput('surname')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>
            </View>

            {error ? (
              <View style={styles.alertError}>
                <Feather name="alert-circle" size={14} color="#FF1744" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {success ? (
              <View style={styles.alertSuccess}>
                <Feather name="check-circle" size={14} color="#00E676" style={{ marginRight: 6 }} />
                <Text style={styles.successText}>{success}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.saveBtn, loading && styles.disabledBtn]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <>
                  <Feather name="save" size={16} color="#ffffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.saveBtnText}>Saqlash</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Car Details Card */}
          {driver.carInfo ? (
            <View style={styles.formCard}>
              <Text style={styles.cardTitle}>Avtomobil Ma'lumotlari</Text>

              <View style={styles.carDetailRow}>
                <View style={styles.carDetailLeft}>
                  <View style={styles.carIconContainer}>
                    <Feather name="truck" size={16} color="#000000ff" />
                  </View>
                  <Text style={styles.carDetailLabel}>Model</Text>
                </View>
                <Text style={styles.carDetailValue}>
                  {driver.carInfo.color} {driver.carInfo.make} {driver.carInfo.model}
                </Text>
              </View>

              <View style={styles.carDetailRow}>
                <View style={styles.carDetailLeft}>
                  <View style={styles.carIconContainer}>
                    <Feather name="credit-card" size={16} color="#000000ff" />
                  </View>
                  <Text style={styles.carDetailLabel}>Davlat raqami</Text>
                </View>
                <View style={styles.plateBadge}>
                  <Text style={styles.plateText}>{driver.carInfo.plateNumber}</Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Quick Actions Card */}
          <View style={styles.shortcutsCard}>
            <Text style={styles.cardTitle}>Tezkor Amallar</Text>

            <TouchableOpacity style={styles.shortcutItem} onPress={onViewHistory} activeOpacity={0.7}>
              <View style={styles.shortcutIconBg}>
                <Feather name="calendar" size={16} color="#000000ff" />
              </View>
              <Text style={styles.shortcutText}>Sayohatlar tarixi</Text>
              <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.shortcutItem} onPress={onBack} activeOpacity={0.7}>
              <View style={styles.shortcutIconBg}>
                <Feather name="home" size={16} color="#000000ff" />
              </View>
              <Text style={styles.shortcutText}>Bosh sahifaga qaytish</Text>
              <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#EEF2FF',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatarOuterCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#3b32db',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 14,
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarInnerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#3b32db',
    fontSize: 34,
    fontWeight: '800',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#3b32db',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F8FAFC',
  },
  driverNameText: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  userPhone: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  pillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 24,
  },
  pillCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF2FF',
    borderRadius: 16,
    paddingVertical: 10,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1.5,
  },
  pillValue: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  pillLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  idBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 50, 219, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(59, 50, 219, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 8,
  },
  idBadgeText: {
    color: '#3b32db',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  idPillCard: {
    borderColor: 'rgba(59, 50, 219, 0.15)',
    backgroundColor: 'rgba(59, 50, 219, 0.03)',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 48,
  },
  inputWrapperFocused: {
    borderColor: '#3b32db',
    backgroundColor: 'rgba(59, 50, 219, 0.02)',
  },
  input: {
    flex: 1,
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
    height: '100%',
  },
  alertError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  alertSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
  },
  successText: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#000000ff',
    borderRadius: 16,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  disabledBtn: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  carDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  carDetailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 50, 219, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  carDetailLabel: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  carDetailValue: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
  plateBadge: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  plateText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '850',
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  shortcutsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    marginBottom: 40,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  shortcutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 6,
  },
  shortcutIconBg: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 50, 219, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shortcutText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
});
