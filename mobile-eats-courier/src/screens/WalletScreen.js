import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../services/api';

const PAYMENT_METHODS = [
  { id: 'click', label: 'Click', icon: '💳' },
  { id: 'payme', label: 'Payme', icon: '📱' },
  { id: 'paynet', label: 'Paynet', icon: '🏦' },
];

const TYPE_LABELS = {
  courier_earning: { label: 'Yetkazib berish haqi', color: '#10B981', icon: '📦' },
  cash_settlement: { label: 'Naqd topshirish', color: '#EF4444', icon: '💸' },
  withdrawal: { label: 'Pul chiqarish', color: '#F59E0B', icon: '🏧' },
};

export default function WalletScreen({ onBack }) {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Settle modal
  const [settleModal, setSettleModal] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('click');
  const [settling, setSettling] = useState(false);

  // Withdrawal modal
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawCard, setWithdrawCard] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('click');
  const [withdrawing, setWithdrawing] = useState(false);

  const loadWallet = useCallback(async () => {
    try {
      const res = await api.getWallet();
      if (res.success) {
        setWallet(res.wallet);
        setTransactions(res.transactions || []);
      }
    } catch (err) {
      console.warn('Wallet load error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadWallet(); }, []);

  const handleSettle = async () => {
    const amount = parseInt(settleAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Xatolik', 'Miqdorni to\'g\'ri kiriting.');
      return;
    }
    if (amount > (wallet?.cashDebt || 0)) {
      Alert.alert('Xatolik', `Naqd qarz (${(wallet?.cashDebt || 0).toLocaleString()} UZS) dan ko'p miqdor kiritdingiz.`);
      return;
    }
    try {
      setSettling(true);
      const res = await api.settleCash(amount, settleMethod, []);
      Alert.alert('✅ Muvaffaqiyat', res.message || 'Naqd pul muvaffaqiyatli topshirildi.');
      setSettleModal(false);
      setSettleAmount('');
      loadWallet();
    } catch (err) {
      Alert.alert('Xatolik', err.message);
    } finally {
      setSettling(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseInt(withdrawAmount);
    if (!amount || amount < 10000) {
      Alert.alert('Xatolik', 'Minimal chiqarish miqdori: 10,000 UZS');
      return;
    }
    if (!withdrawCard.trim()) {
      Alert.alert('Xatolik', 'Karta raqamini kiriting.');
      return;
    }
    try {
      setWithdrawing(true);
      await api.requestWithdrawal(amount, withdrawCard, withdrawMethod);
      Alert.alert('✅ So\'rov yuborildi', 'Admin tasdiqlashini kuting.');
      setWithdrawModal(false);
      setWithdrawAmount('');
      setWithdrawCard('');
      loadWallet();
    } catch (err) {
      Alert.alert('Xatolik', err.message);
    } finally {
      setWithdrawing(false);
    }
  };

  const fmt = (n) => (n || 0).toLocaleString();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF9500" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hamyonim</Text>
        <TouchableOpacity onPress={loadWallet} style={styles.backBtn}>
          <Feather name="refresh-cw" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadWallet(); }} tintColor="#FF9500" />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Balance Cards */}
        <View style={styles.heroSection}>
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Mavjud balans</Text>
            <Text style={styles.balanceValue}>{fmt(wallet?.balance)} UZS</Text>
            <Text style={styles.balanceSub}>Jami topilgan: {fmt(wallet?.totalEarned)} UZS</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: '#1E293B' }]}>
              <Text style={styles.statIcon}>💵</Text>
              <Text style={styles.statLabel}>Naqd qarz</Text>
              <Text style={[styles.statValue, { color: '#F59E0B' }]}>{fmt(wallet?.cashDebt)} UZS</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#1E293B' }]}>
              <Text style={styles.statIcon}>🏧</Text>
              <Text style={styles.statLabel}>Chiqarilgan</Text>
              <Text style={[styles.statValue, { color: '#94A3B8' }]}>{fmt(wallet?.totalWithdrawn)} UZS</Text>
            </View>
          </View>
        </View>

        {/* Cash Debt Warning */}
        {(wallet?.cashDebt || 0) > 0 && (
          <View style={styles.debtWarning}>
            <Feather name="alert-triangle" size={16} color="#F59E0B" />
            <Text style={styles.debtWarningText}>
              Mijozlardan {fmt(wallet?.cashDebt)} UZS naqd yig'ilgan. Topshiring!
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          {(wallet?.cashDebt || 0) > 0 && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}
              onPress={() => { setSettleAmount(String(wallet?.cashDebt || '')); setSettleModal(true); }}
              activeOpacity={0.85}
            >
              <Feather name="send" size={16} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.actionBtnText}>Naqd Topshirish</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
            onPress={() => { setWithdrawAmount(''); setWithdrawCard(''); setWithdrawModal(true); }}
            activeOpacity={0.85}
          >
            <Feather name="download" size={16} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.actionBtnText}>Pul Chiqarish</Text>
          </TouchableOpacity>
        </View>

        {/* Transactions */}
        <Text style={styles.sectionTitle}>Oxirgi tranzaksiyalar</Text>

        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Tranzaksiyalar yo'q</Text>
          </View>
        ) : (
          transactions.map((tx, idx) => {
            const meta = TYPE_LABELS[tx.type] || { label: tx.type, color: '#64748B', icon: '•' };
            return (
              <View key={tx._id || idx} style={styles.txRow}>
                <View style={[styles.txIcon, { backgroundColor: meta.color + '20' }]}>
                  <Text style={{ fontSize: 18 }}>{meta.icon}</Text>
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txLabel}>{meta.label}</Text>
                  <Text style={styles.txDate}>
                    {new Date(tx.createdAt).toLocaleDateString('uz-UZ')} •{' '}
                    {new Date(tx.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={[styles.txAmount, { color: tx.direction === 'credit' ? '#10B981' : '#EF4444' }]}>
                  {tx.direction === 'credit' ? '+' : '-'}{fmt(tx.amount)} UZS
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ─── Settle Modal ─── */}
      <Modal visible={settleModal} transparent animationType="slide" onRequestClose={() => setSettleModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>💸 Naqd Pul Topshirish</Text>
            <Text style={styles.modalSub}>Naqd qarz: {fmt(wallet?.cashDebt)} UZS</Text>

            <Text style={styles.inputLabel}>Miqdor (UZS)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={settleAmount}
              onChangeText={setSettleAmount}
              placeholder="Masalan: 300000"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>To'lov usuli</Text>
            <View style={styles.methodRow}>
              {PAYMENT_METHODS.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.methodBtn, settleMethod === m.id && styles.methodBtnActive]}
                  onPress={() => setSettleMethod(m.id)}
                >
                  <Text style={styles.methodIcon}>{m.icon}</Text>
                  <Text style={[styles.methodLabel, settleMethod === m.id && { color: '#FF9500' }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSettle} disabled={settling} activeOpacity={0.85}>
              {settling ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Topshirish</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSettleModal(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Bekor qilish</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Withdrawal Modal ─── */}
      <Modal visible={withdrawModal} transparent animationType="slide" onRequestClose={() => setWithdrawModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>🏧 Pul Chiqarish</Text>
            <Text style={styles.modalSub}>Mavjud: {fmt(wallet?.balance)} UZS</Text>

            <Text style={styles.inputLabel}>Miqdor (min: 10,000 UZS)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              placeholder="Masalan: 50000"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Karta raqami</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={withdrawCard}
              onChangeText={setWithdrawCard}
              placeholder="8600 xxxx xxxx xxxx"
              placeholderTextColor="#94A3B8"
              maxLength={19}
            />

            <Text style={styles.inputLabel}>To'lov usuli</Text>
            <View style={styles.methodRow}>
              {PAYMENT_METHODS.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.methodBtn, withdrawMethod === m.id && styles.methodBtnActive]}
                  onPress={() => setWithdrawMethod(m.id)}
                >
                  <Text style={styles.methodIcon}>{m.icon}</Text>
                  <Text style={[styles.methodLabel, withdrawMethod === m.id && { color: '#10B981' }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#10B981' }]} onPress={handleWithdraw} disabled={withdrawing} activeOpacity={0.85}>
              {withdrawing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>So'rov Yuborish</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setWithdrawModal(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Bekor qilish</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0F172A',
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },

  heroSection: { padding: 16, gap: 12 },
  balanceCard: {
    backgroundColor: '#FF9500',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  balanceValue: { fontSize: 34, fontWeight: '900', color: '#FFFFFF', marginVertical: 4 },
  balanceSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  statIcon: { fontSize: 22, marginBottom: 6 },
  statLabel: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  statValue: { fontSize: 15, fontWeight: '800', marginTop: 4 },

  debtWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#422006',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#92400E',
  },
  debtWarningText: { flex: 1, fontSize: 12, color: '#FCD34D', fontWeight: '700' },

  actionsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 24 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
  },
  actionBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#475569', fontWeight: '600' },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txInfo: { flex: 1 },
  txLabel: { fontSize: 13, fontWeight: '700', color: '#E2E8F0' },
  txDate: { fontSize: 11, color: '#475569', marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '900' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#334155', alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#F1F5F9', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#64748B', fontWeight: '600', marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 6 },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#F1F5F9',
    fontWeight: '700',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  methodRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  methodBtn: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  methodBtnActive: { borderColor: '#FF9500' },
  methodIcon: { fontSize: 20, marginBottom: 4 },
  methodLabel: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  submitBtn: {
    backgroundColor: '#FF9500',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelBtnText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
});
