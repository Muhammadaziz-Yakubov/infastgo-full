import { useState, useEffect } from 'react';
import { api } from '../services/api';

const fmt = (n) => (n || 0).toLocaleString('uz-UZ');

const PAYMENT_METHODS = ['click', 'payme', 'paynet'];

const TYPE_LABELS = {
  restaurant_earning: { label: 'Buyurtma daromadi', color: '#10B981', sign: '+' },
  withdrawal: { label: 'Pul chiqarish', color: '#EF4444', sign: '-' },
  refund: { label: 'Qaytarish', color: '#F59E0B', sign: '-' },
};

export default function WalletPage() {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview | history | withdrawals

  // Withdraw form
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [payMethod, setPayMethod] = useState('click');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [walletRes, withdrawalRes] = await Promise.all([
        api.getWallet(),
        api.getWithdrawals(),
      ]);
      if (walletRes.success) {
        setWallet(walletRes.wallet);
        setTransactions(walletRes.transactions || []);
      }
      if (withdrawalRes.success) {
        setWithdrawals(withdrawalRes.withdrawals || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const amt = parseInt(amount);
    if (!amt || amt < 10000) return setError('Minimal 10,000 UZS kiriting.');
    if (!cardNumber.trim()) return setError('Karta raqamini kiriting.');

    try {
      setSubmitting(true);
      await api.requestWithdrawal(amt, cardNumber, payMethod);
      setSuccess("So'rov yuborildi! Admin tasdiqlashini kuting.");
      setAmount('');
      setCardNumber('');
      setShowForm(false);
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status) => {
    const map = {
      pending: { bg: '#FEF3C7', color: '#D97706', label: 'Kutilmoqda' },
      approved: { bg: '#D1FAE5', color: '#059669', label: 'Tasdiqlandi' },
      rejected: { bg: '#FEE2E2', color: '#DC2626', label: 'Rad etildi' },
      completed: { bg: '#DBEAFE', color: '#1D4ED8', label: 'Bajarildi' },
    };
    const s = map[status] || { bg: '#F1F5F9', color: '#64748B', label: status };
    return (
      <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
        {s.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <div style={{ width: 36, height: 36, border: '3px solid #FF9500', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#0F172A', margin: 0 }}>💰 Moliyaviy Hisobot</h1>
        <p style={{ color: '#64748B', marginTop: 6, fontSize: 14 }}>Balans, tranzaksiyalar va pul chiqarish</p>
      </div>

      {/* Balance Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div style={{ background: 'linear-gradient(135deg, #FF9500, #FF6B00)', borderRadius: 20, padding: 24, color: '#fff' }}>
          <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>Mavjud Balans</div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>{fmt(wallet?.balance)}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>UZS</div>
        </div>
        <div style={{ background: '#F8FAFC', borderRadius: 20, padding: 24, border: '1.5px solid #E2E8F0' }}>
          <div style={{ fontSize: 13, color: '#64748B', marginBottom: 8 }}>Kutilayotgan</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#0F172A' }}>{fmt(wallet?.pendingBalance)}</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>UZS</div>
        </div>
        <div style={{ background: '#F8FAFC', borderRadius: 20, padding: 24, border: '1.5px solid #E2E8F0' }}>
          <div style={{ fontSize: 13, color: '#64748B', marginBottom: 8 }}>Jami Topilgan</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#10B981' }}>{fmt(wallet?.totalEarned)}</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>UZS</div>
        </div>
        <div style={{ background: '#F8FAFC', borderRadius: 20, padding: 24, border: '1.5px solid #E2E8F0' }}>
          <div style={{ fontSize: 13, color: '#64748B', marginBottom: 8 }}>Chiqarilgan</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#EF4444' }}>{fmt(wallet?.totalWithdrawn)}</div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>UZS</div>
        </div>
      </div>

      {/* Withdraw Button */}
      <button
        onClick={() => { setShowForm(!showForm); setError(''); setSuccess(''); }}
        style={{
          background: showForm ? '#F1F5F9' : 'linear-gradient(135deg, #10B981, #059669)',
          color: showForm ? '#475569' : '#fff',
          border: 'none',
          borderRadius: 14,
          padding: '12px 28px',
          fontSize: 14,
          fontWeight: 800,
          cursor: 'pointer',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        🏧 {showForm ? 'Yopish' : 'Pul Chiqarish'}
      </button>

      {/* Withdraw Form */}
      {showForm && (
        <div style={{ background: '#F8FAFC', borderRadius: 20, padding: 24, border: '1.5px solid #E2E8F0', marginBottom: 28 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, color: '#0F172A' }}>Pul Chiqarish So'rovi</h3>
          <form onSubmit={handleWithdraw}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Miqdor (UZS)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Masalan: 100000"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1.5px solid #E2E8F0', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Karta Raqami</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={e => setCardNumber(e.target.value)}
                  placeholder="8600 xxxx xxxx xxxx"
                  maxLength={19}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1.5px solid #E2E8F0', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>To'lov Usuli</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayMethod(m)}
                    style={{
                      padding: '8px 20px',
                      borderRadius: 10,
                      border: `2px solid ${payMethod === m ? '#FF9500' : '#E2E8F0'}`,
                      background: payMethod === m ? '#FFF7ED' : '#fff',
                      color: payMethod === m ? '#FF9500' : '#475569',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {error && <div style={{ color: '#EF4444', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>⚠️ {error}</div>}
            {success && <div style={{ color: '#10B981', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>✅ {success}</div>}
            <button
              type="submit"
              disabled={submitting}
              style={{ background: '#10B981', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 32px', fontSize: 14, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? 'Yuborilmoqda...' : "So'rov Yuborish"}
            </button>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 14, padding: 4, marginBottom: 24, width: 'fit-content' }}>
        {[['overview', '📊 Tranzaksiyalar'], ['withdrawals', '🏧 Chiqarishlar']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              background: activeTab === id ? '#FFFFFF' : 'transparent',
              color: activeTab === id ? '#0F172A' : '#64748B',
              boxShadow: activeTab === id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Transactions Tab */}
      {activeTab === 'overview' && (
        <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1.5px solid #F1F5F9', overflow: 'hidden' }}>
          {transactions.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div style={{ fontWeight: 700 }}>Tranzaksiyalar yo'q</div>
            </div>
          ) : transactions.map((tx, idx) => {
            const meta = TYPE_LABELS[tx.type] || { label: tx.type, color: '#64748B', sign: '' };
            return (
              <div key={tx._id || idx} style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: meta.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14, fontSize: 18 }}>
                  {meta.sign === '+' ? '📦' : '🏧'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{meta.label}</div>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                    {new Date(tx.createdAt).toLocaleDateString('uz-UZ')} • {tx.paymentMethod}
                  </div>
                </div>
                <div style={{ fontWeight: 900, fontSize: 15, color: meta.sign === '+' ? '#10B981' : '#EF4444' }}>
                  {meta.sign}{fmt(tx.amount)} UZS
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Withdrawals Tab */}
      {activeTab === 'withdrawals' && (
        <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1.5px solid #F1F5F9', overflow: 'hidden' }}>
          {withdrawals.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏧</div>
              <div style={{ fontWeight: 700 }}>Chiqarish so'rovlari yo'q</div>
            </div>
          ) : withdrawals.map((w, idx) => (
            <div key={w._id || idx} style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #F1F5F9', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A' }}>{fmt(w.amount)} UZS</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{w.cardNumber} • {w.paymentMethod}</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>{new Date(w.createdAt).toLocaleDateString('uz-UZ')}</div>
              </div>
              {statusBadge(w.status)}
              {w.adminNote && <div style={{ fontSize: 12, color: '#64748B', fontStyle: 'italic' }}>{w.adminNote}</div>}
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
