import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  Modal,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { api } from '../services/api';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function StatisticsScreen({ onBack }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('week');

  const [stats, setStats] = useState({
    today: { earnings: 0, commission: 0, netEarnings: 0, count: 0, distance: 0, rating: 5.0 },
    week: { earnings: 0, commission: 0, netEarnings: 0, count: 0, distance: 0, rating: 5.0, daily: [] },
    month: { earnings: 0, commission: 0, netEarnings: 0, count: 0, distance: 0, rating: 5.0, daily: [] },
  });

  const [driverInfo, setDriverInfo] = useState({
    pendingCommission: 0,
    totalCommissionPaid: 0,
    status: 'offline',
  });
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paying, setPaying] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
    fetchStats();
  }, []);

  const showAlert = (title, message) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handlePayCommission = async () => {
    const amountNum = parseInt(paymentAmount);
    if (!amountNum || amountNum <= 0) {
      showAlert('Xatolik', "Iltimos, to'g'ri to'lov miqdorini kiriting.");
      return;
    }
    setPaying(true);
    try {
      const response = await api.createPayment(amountNum);
      if (response.success && response.paymentUrl) {
        showAlert(
          "To'lov boshlandi",
          "Click to'lov tizimi orqali to'lash uchun brauzer ochilmoqda."
        );
        setShowPaymentModal(false);
        setPaymentAmount('');
        Linking.openURL(response.paymentUrl).catch(() => {
          showAlert('Xatolik', 'Havolani ochishda xatolik yuz berdi.');
        });
      } else {
        showAlert('Xatolik', response.message || "To'lov havolasini yaratib bo'lmadi.");
      }
    } catch (err) {
      showAlert('Xatolik', err.message || 'Tarmoq xatoligi yuz berdi.');
    } finally {
      setPaying(false);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const [historyResponse, profileResponse] = await Promise.all([
        api.getHistory().catch((err) => ({ success: false, message: err.message })),
        api.getProfile().catch((err) => ({ success: false, message: err.message })),
      ]);

      if (profileResponse.success && profileResponse.user) {
        setDriverInfo({
          pendingCommission: profileResponse.user.pendingCommission || 0,
          totalCommissionPaid: profileResponse.user.totalCommissionPaid || 0,
          status: profileResponse.user.status || 'offline',
        });
      }

      if (historyResponse.success && historyResponse.rides) {
        const completedRides = historyResponse.rides.filter((r) => r.status === 'completed');
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);

        const calc = (rides) => {
          const earnings = rides.reduce((s, r) => s + (r.price || 0), 0);
          const commission = rides.reduce((s, r) => s + (r.commissionAmount || Math.round((r.price || 0) * (r.commissionPercent || 10) / 100)), 0);
          const rated = rides.filter((r) => r.rating > 0);
          return {
            earnings,
            commission,
            netEarnings: earnings - commission,
            count: rides.length,
            distance: parseFloat(rides.reduce((s, r) => s + (parseFloat(r.distance) || 0), 0).toFixed(1)),
            rating: parseFloat((rated.length > 0 ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 5.0).toFixed(1)),
          };
        };

        const weekDaily = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(startOfToday.getTime() - i * 24 * 60 * 60 * 1000);
          const label = d.toLocaleDateString('uz-UZ', { weekday: 'short' });
          const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          const de = new Date(ds.getTime() + 86400000);
          const dayRides = completedRides.filter((r) => { const dt = new Date(r.createdAt); return dt >= ds && dt < de; });
          const e = dayRides.reduce((s, r) => s + (r.price || 0), 0);
          const c = dayRides.reduce((s, r) => s + (r.commissionAmount || Math.round((r.price || 0) * (r.commissionPercent || 10) / 100)), 0);
          weekDaily.push({ label, val: e - c });
        }

        const monthDaily = [];
        for (let i = 3; i >= 0; i--) {
          const wStart = new Date(startOfToday.getTime() - (i + 1) * 7 * 86400000);
          const wEnd = new Date(startOfToday.getTime() - i * 7 * 86400000);
          const label = `${4 - i}-hafta`;
          const wRides = completedRides.filter((r) => { const dt = new Date(r.createdAt); return dt >= wStart && dt < wEnd; });
          const e = wRides.reduce((s, r) => s + (r.price || 0), 0);
          const c = wRides.reduce((s, r) => s + (r.commissionAmount || Math.round((r.price || 0) * (r.commissionPercent || 10) / 100)), 0);
          monthDaily.push({ label, val: e - c });
        }

        const todayRides = completedRides.filter((r) => new Date(r.createdAt) >= startOfToday);
        const weekRides = completedRides.filter((r) => new Date(r.createdAt) >= startOfWeek);
        const monthRides = completedRides.filter((r) => new Date(r.createdAt) >= startOfMonth);

        setStats({
          today: calc(todayRides),
          week: { ...calc(weekRides), daily: weekDaily },
          month: { ...calc(monthRides), daily: monthDaily },
        });
      } else {
        setError("Ma'lumotlarni yuklab bo'lmadi");
      }
    } catch (err) {
      setError(err.message || 'Tarmoq xatoligi yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const currentStats = stats[activeTab];
  const maxDailyVal = Math.max(...(currentStats.daily || []).map((d) => d.val), 1000);

  const debtLevel =
    driverInfo.pendingCommission > 50000 ? 'danger' :
    driverInfo.pendingCommission > 40000 ? 'warning' : 'ok';

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#3b32db" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Statistika</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchStats} activeOpacity={0.7}>
          <Feather name="refresh-cw" size={18} color="#3b32db" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b32db" />
          <Text style={styles.loadingText}>Statistika yuklanmoqda...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={styles.errorIconBg}>
            <Feather name="alert-triangle" size={28} color="#EF4444" />
          </View>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchStats} activeOpacity={0.8}>
            <Feather name="refresh-cw" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.retryText}>Qayta urinish</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* Tab Selector */}
          <View style={styles.tabBar}>
            {['week', 'month'].map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                  {tab === 'week' ? '7 Kunlik' : '30 Kunlik'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

            {/* Commission / Debt Card */}
            <View style={[
              styles.debtCard,
              debtLevel === 'danger' && styles.debtCardDanger,
              debtLevel === 'warning' && styles.debtCardWarning,
            ]}>
              <View style={styles.debtCardHeader}>
                <View style={styles.debtCardLeft}>
                  <View style={[
                    styles.debtIconBg,
                    debtLevel === 'danger' ? { backgroundColor: 'rgba(239,68,68,0.1)' } :
                    debtLevel === 'warning' ? { backgroundColor: 'rgba(245,158,11,0.1)' } :
                    { backgroundColor: 'rgba(34,197,94,0.1)' },
                  ]}>
                    <Feather
                      name={debtLevel === 'danger' ? 'alert-octagon' : debtLevel === 'warning' ? 'alert-triangle' : 'shield'}
                      size={18}
                      color={debtLevel === 'danger' ? '#EF4444' : debtLevel === 'warning' ? '#F59E0B' : '#22C55E'}
                    />
                  </View>
                  <Text style={styles.debtTitle}>Tizim Qarzdorligi</Text>
                </View>
                <View style={[
                  styles.debtBadge,
                  debtLevel === 'danger' ? styles.debtBadgeDanger :
                  debtLevel === 'warning' ? styles.debtBadgeWarning :
                  styles.debtBadgeOk,
                ]}>
                  <Text style={[
                    styles.debtBadgeText,
                    debtLevel === 'danger' ? { color: '#EF4444' } :
                    debtLevel === 'warning' ? { color: '#F59E0B' } :
                    { color: '#22C55E' },
                  ]}>
                    {debtLevel === 'danger' ? 'Bloklangan' : debtLevel === 'warning' ? 'Xavfli' : 'Faol'}
                  </Text>
                </View>
              </View>

              <View style={styles.debtAmountRow}>
                <Text style={styles.debtAmount}>
                  {driverInfo.pendingCommission.toLocaleString()}
                  <Text style={styles.debtCurrency}> UZS</Text>
                </Text>
                <Text style={styles.debtLimit}>Limit: 50 000 UZS</Text>
              </View>

              {/* Progress bar */}
              <View style={styles.progressBg}>
                <View style={[
                  styles.progressFill,
                  {
                    width: `${Math.min((driverInfo.pendingCommission / 50000) * 100, 100)}%`,
                    backgroundColor: debtLevel === 'danger' ? '#EF4444' : debtLevel === 'warning' ? '#F59E0B' : '#22C55E',
                  },
                ]} />
              </View>

              <Text style={styles.debtDesc}>
                {debtLevel === 'danger'
                  ? "Komissiya qarzingiz limitdan oshdi va hisobingiz bloklandi. Tizimni faollashtirish uchun to'lovni admin orqali amalga oshiring."
                  : "Komissiya qarzi 50 000 UZS ga yetsa, tizim avtomatik bloklaydi. To'lovni admin orqali to'lashingiz mumkin."}
              </Text>

              <View style={{ gap: 10 }}>
                <TouchableOpacity
                  style={styles.payBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    Linking.openURL('https://t.me/mister_yakubov').catch(() => {
                      showAlert('Xatolik', 'Telegram ilovasini ochib bo\'lmadi.');
                    });
                  }}
                >
                  <Feather name="send" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.payBtnText}>Admin orqali to'lash</Text>
                </TouchableOpacity>

                <View style={[styles.payBtn, { backgroundColor: '#E2E8F0', shadowColor: 'transparent', shadowOpacity: 0, elevation: 0 }]}>
                  <Feather name="credit-card" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                  <Text style={[styles.payBtnText, { color: '#94A3B8' }]}>Click orqali to'lash (Tez kunda)</Text>
                </View>
              </View>
            </View>

            {/* Net Earnings Card */}
            <View style={styles.earningsCard}>
              <View style={styles.earningsHeader}>
                <View style={styles.earningsIconBg}>
                  <Feather name="trending-up" size={16} color="#3b32db" />
                </View>
                <Text style={styles.earningsLabel}>Sof Daromad</Text>
              </View>
              <Text style={styles.earningsValue}>
                {currentStats.netEarnings.toLocaleString()}
                <Text style={styles.earningsCurrency}> UZS</Text>
              </Text>
              <View style={styles.earningsDivider} />
              <View style={styles.earningsBreakdown}>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Umumiy Tushum</Text>
                  <Text style={styles.breakdownValue}>{currentStats.earnings.toLocaleString()} UZS</Text>
                </View>
                <View style={styles.breakdownDivider} />
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>Komissiya</Text>
                  <Text style={[styles.breakdownValue, { color: '#EF4444' }]}>
                    -{currentStats.commission.toLocaleString()} UZS
                  </Text>
                </View>
              </View>
            </View>

            {/* Stats Grid */}
            <View style={styles.grid}>
              {[
                { icon: 'navigation', color: '#3b32db', bg: 'rgba(59,50,219,0.08)', label: 'Buyurtmalar', value: `${currentStats.count}` },
                { icon: 'map', color: '#0EA5E9', bg: 'rgba(14,165,233,0.08)', label: 'Masofa', value: `${currentStats.distance} km` },
                { icon: 'star', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', label: "O'rtacha Reyting", value: `⭐ ${currentStats.rating}` },
                { icon: 'clock', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', label: 'Vaqt', value: `${Math.round(currentStats.count * 25 / 60)}s` },
              ].map((item, i) => (
                <View key={i} style={styles.gridCard}>
                  <View style={[styles.gridIconBg, { backgroundColor: item.bg }]}>
                    <Feather name={item.icon} size={18} color={item.color} />
                  </View>
                  <Text style={styles.gridValue}>{item.value}</Text>
                  <Text style={styles.gridLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* Bar Chart */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <View style={styles.chartIconBg}>
                  <Feather name="bar-chart-2" size={14} color="#3b32db" />
                </View>
                <Text style={styles.chartTitle}>Daromad Grafigi</Text>
              </View>
              <View style={styles.chartContainer}>
                {(currentStats.daily || []).map((day, idx) => {
                  const percent = (day.val / maxDailyVal) * 100;
                  return (
                    <View key={idx} style={styles.chartColumn}>
                      <View style={styles.barWrapper}>
                        {day.val > 0 && (
                          <Text style={styles.barValueText} numberOfLines={1}>
                            {Math.round(day.val / 1000)}k
                          </Text>
                        )}
                        <View style={[
                          styles.barFill,
                          { height: `${Math.max(percent, 4)}%` },
                          idx === (currentStats.daily || []).length - 1 && styles.barFillActive,
                        ]} />
                      </View>
                      <Text style={styles.barLabel}>{day.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Daily List */}
            <View style={styles.listCard}>
              <View style={styles.listCardHeader}>
                <View style={styles.chartIconBg}>
                  <Feather name="list" size={14} color="#3b32db" />
                </View>
                <Text style={styles.chartTitle}>Kunlik Hisobot</Text>
              </View>
              {(currentStats.daily || []).slice().reverse().map((day, idx, arr) => (
                <View key={idx} style={[styles.listItem, idx === arr.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.listItemLeft}>
                    <View style={styles.listDateDot} />
                    <Text style={styles.listItemLabel}>{day.label}</Text>
                  </View>
                  <Text style={[styles.listItemVal, day.val > 0 ? styles.listValPositive : styles.listValEmpty]}>
                    {day.val > 0 ? `+${day.val.toLocaleString()} UZS` : '0 UZS'}
                  </Text>
                </View>
              ))}
            </View>

          </ScrollView>
        </Animated.View>
      )}

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconBg}>
              <Feather name="credit-card" size={24} color="#3b32db" />
            </View>
            <Text style={styles.modalTitle}>Click orqali to'lov</Text>
            <Text style={styles.modalSubtitle}>Komissiya hisobini to'ldirish</Text>

            <Text style={styles.modalLabel}>To'lov summasi (UZS)</Text>
            <View style={styles.modalInputWrapper}>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                placeholder="Masalan: 10000"
                placeholderTextColor="#94A3B8"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowPaymentModal(false)}
                disabled={paying}
              >
                <Text style={styles.modalCancelText}>Bekor qilish</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPayBtn, paying && styles.modalPayBtnDisabled]}
                onPress={handlePayCommission}
                disabled={paying}
              >
                {paying ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalPayText}>To'lash</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Header
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
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  // States
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(239,68,68,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.15)',
  },
  loadingText: {
    color: '#64748B',
    marginTop: 12,
    fontSize: 13,
    fontWeight: '500',
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    marginVertical: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b32db',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: '#3b32db',
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  tabLabel: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 13,
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },

  // Debt Card
  debtCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  debtCardDanger: {
    backgroundColor: '#FFF5F5',
    borderColor: 'rgba(239,68,68,0.2)',
  },
  debtCardWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: 'rgba(245,158,11,0.2)',
  },
  debtCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  debtCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  debtIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  debtTitle: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  debtBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  debtBadgeDanger: { backgroundColor: 'rgba(239,68,68,0.1)' },
  debtBadgeWarning: { backgroundColor: 'rgba(245,158,11,0.1)' },
  debtBadgeOk: { backgroundColor: 'rgba(34,197,94,0.1)' },
  debtBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  debtAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  debtAmount: {
    color: '#0F172A',
    fontSize: 26,
    fontWeight: '800',
  },
  debtCurrency: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  debtLimit: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
  },
  progressBg: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  debtDesc: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 16,
  },
  payBtn: {
    flexDirection: 'row',
    backgroundColor: '#3b32db',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  payBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Earnings Card
  earningsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  earningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  earningsIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(59,50,219,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  earningsLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  earningsValue: {
    color: '#0F172A',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 6,
  },
  earningsCurrency: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  earningsDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  earningsBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownItem: {
    flex: 1,
  },
  breakdownDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#EEF2FF',
    marginHorizontal: 16,
  },
  breakdownLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  breakdownValue: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },

  // Grid Stats
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1.5,
  },
  gridIconBg: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gridValue: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '800',
  },
  gridLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },

  // Chart
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  chartIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(59,50,219,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chartContainer: {
    flexDirection: 'row',
    height: 140,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 20,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barWrapper: {
    flex: 1,
    width: 14,
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  barValueText: {
    color: '#3b32db',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  barFill: {
    width: '100%',
    backgroundColor: '#E0E7FF',
    borderRadius: 6,
  },
  barFillActive: {
    backgroundColor: '#3b32db',
  },
  barLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 8,
    textTransform: 'uppercase',
  },

  // List Card
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  listCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listDateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3b32db',
  },
  listItemLabel: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  listItemVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  listValPositive: {
    color: '#22C55E',
  },
  listValEmpty: {
    color: '#CBD5E1',
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 40,
    elevation: 20,
    alignItems: 'center',
  },
  modalIconBg: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(59,50,219,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(59,50,219,0.12)',
  },
  modalTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  modalInputWrapper: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 24,
  },
  modalInput: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalCancelText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 14,
  },
  modalPayBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#3b32db',
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  modalPayBtnDisabled: {
    opacity: 0.6,
  },
  modalPayText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
