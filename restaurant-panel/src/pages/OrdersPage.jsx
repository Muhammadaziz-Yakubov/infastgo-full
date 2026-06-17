import { useState, useEffect } from 'react';
import { api } from '../services/api';

const STATUS_LABELS = {
  new: 'Yangi',
  accepted: 'Qabul qilindi',
  preparing: 'Tayyorlanmoqda',
  ready: 'Tayyor',
  picked: 'Olib ketildi',
  delivered: 'Yetkazildi',
  rejected: 'Rad etildi',
  cancelled: 'Bekor qilindi',
};

function OrderRow({ order, onStatusChange }) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleStatus = async (status) => {
    if (status === 'rejected' && !rejectionReason.trim()) {
      setShowRejectInput(true);
      return;
    }
    try {
      setLoading(true);
      await api.updateOrderStatus(order._id, status, rejectionReason);
      onStatusChange();
      setShowRejectInput(false);
      setRejectionReason('');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderActions = () => {
    switch (order.status) {
      case 'new':
        return (
          <div className="action-buttons">
            <button className="btn-success" onClick={() => handleStatus('accepted')} disabled={loading}>✓ Qabul</button>
            <button className="btn-danger" onClick={() => setShowRejectInput(true)} disabled={loading}>✗ Rad</button>
          </div>
        );
      case 'accepted':
        return (
          <button className="btn-warning" onClick={() => handleStatus('preparing')} disabled={loading}>
            🍳 Tayyorlanmoqda
          </button>
        );
      case 'preparing':
        return (
          <button className="btn-success" onClick={() => handleStatus('ready')} disabled={loading}>
            ✅ Tayyor
          </button>
        );
      case 'ready':
        return <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Kurer kutilmoqda...</span>;
      default:
        return null;
    }
  };

  const totalItems = order.items?.reduce((s, i) => s + i.quantity, 0) || 0;

  return (
    <>
      <tr>
        <td>
          <div style={{ fontWeight: 700, fontSize: 13 }}>
            #{order._id.slice(-6).toUpperCase()}
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
            {new Date(order.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </td>
        <td>
          <div style={{ fontWeight: 600 }}>{order.userId?.name || '—'}</div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>{order.userId?.phone}</div>
        </td>
        <td>
          <div style={{ fontSize: 12 }}>
            {order.items?.slice(0, 2).map((it, idx) => (
              <span key={idx} style={{ display: 'block' }}>{it.name} × {it.quantity}</span>
            ))}
            {order.items?.length > 2 && (
              <span style={{ color: '#94A3B8' }}>+{order.items.length - 2} ta</span>
            )}
          </div>
        </td>
        <td style={{ fontWeight: 800 }}>{order.total?.toLocaleString()} UZS</td>
        <td>
          <span className={`badge badge-${order.status}`}>
            {STATUS_LABELS[order.status] || order.status}
          </span>
        </td>
        <td>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {renderActions()}
          </div>
        </td>
      </tr>
      {showRejectInput && (
        <tr>
          <td colSpan={6} style={{ padding: '10px 16px', background: '#FEF2F2' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="form-input"
                style={{ flex: 1, padding: '8px 12px' }}
                placeholder="Rad etish sababini kiriting..."
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
              />
              <button className="btn-danger" onClick={() => handleStatus('rejected')} disabled={!rejectionReason.trim() || loading}>
                Rad etish
              </button>
              <button className="btn-outline" onClick={() => setShowRejectInput(false)}>Bekor</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // 'active' | 'all'
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [prevNewOrdersCount, setPrevNewOrdersCount] = useState(0);

  const loadOrders = async (isManual = false) => {
    try {
      if (isManual) setLoading(true);
      const res = await api.getOrders();
      if (res.success) {
        setOrders(res.orders);
        
        // Count new orders
        const newOrders = res.orders.filter(o => o.status === 'new');
        if (newOrders.length > prevNewOrdersCount) {
          // A new order has arrived! Play sound if enabled by user interaction
          if (soundEnabled) {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-120.wav');
            audio.play().catch(e => console.log('Audio playback blocked by browser:', e));
          }
        }
        setPrevNewOrdersCount(newOrders.length);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (isManual) setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders(true);
    const interval = setInterval(() => loadOrders(false), 8000); // Auto-refresh every 8s
    return () => clearInterval(interval);
  }, [soundEnabled, prevNewOrdersCount]);

  const filteredOrders = filter === 'active'
    ? orders.filter(o => ['new', 'accepted', 'preparing', 'ready'].includes(o.status))
    : orders;

  return (
    <div>
      <div className="page-header">
        <h1>Buyurtmalar</h1>
        <p>Barcha buyurtmalarni boshqaring va holatlari yangilang</p>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={filter === 'active' ? 'btn-primary' : 'btn-outline'}
              onClick={() => setFilter('active')}
            >
              Faol buyurtmalar
            </button>
            <button
              className={filter === 'all' ? 'btn-primary' : 'btn-outline'}
              onClick={() => setFilter('all')}
            >
              Barchasi
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button 
              className={soundEnabled ? 'btn-primary' : 'btn-outline'}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              <span>{soundEnabled ? '🔊 Ovoz yoqilgan' : '🔇 Ovoz o\'chirilgan'}</span>
            </button>
            
            <button className="btn-outline" onClick={() => loadOrders(true)} disabled={loading}>
              ↻ Yangilash
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div className="empty-state"><p>Yuklanmoqda...</p></div>
          ) : filteredOrders.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5M12 3v18" />
              </svg>
              <p>Hozircha buyurtmalar yo'q</p>
            </div>
          ) : (
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Buyurtma ID</th>
                  <th>Mijoz</th>
                  <th>Taomlar</th>
                  <th>Summa</th>
                  <th>Holat</th>
                  <th>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => (
                  <OrderRow key={order._id} order={order} onStatusChange={loadOrders} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
