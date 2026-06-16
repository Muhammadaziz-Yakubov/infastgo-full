import { useState, useEffect } from 'react';
import { api } from '../services/api';

function StatCard({ icon, label, value, color, bg }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: bg }}>
        {icon}
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
    </div>
  );
}

export default function DashboardPage({ restaurant }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboardStats()
      .then(res => { if (res.success) setStats(res.stats); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Xush kelibsiz, {restaurant?.name} 👋</h1>
        <p>Bugungi faoliyatingiz va buyurtmalar statistikasi</p>
      </div>

      {loading ? (
        <div className="empty-state"><p>Yuklanmoqda...</p></div>
      ) : (
        <div className="stats-grid">
          <StatCard
            icon={<svg width="20" height="20" fill="none" stroke="#FF9500" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" /></svg>}
            label="Bugungi buyurtmalar"
            value={stats?.todayOrdersCount ?? 0}
            color="#FF9500"
            bg="#FFF7ED"
          />
          <StatCard
            icon={<svg width="20" height="20" fill="none" stroke="#10B981" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            label="Yetkazilgan buyurtmalar"
            value={stats?.completedCount ?? 0}
            color="#10B981"
            bg="#ECFDF5"
          />
          <StatCard
            icon={<svg width="20" height="20" fill="none" stroke="#3B82F6" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            label="Faol buyurtmalar"
            value={stats?.activeCount ?? 0}
            color="#3B82F6"
            bg="#EFF6FF"
          />
          <StatCard
            icon={<svg width="20" height="20" fill="none" stroke="#8B5CF6" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            label="Bugungi daromad"
            value={`${(stats?.revenue ?? 0).toLocaleString()} UZS`}
            color="#8B5CF6"
            bg="#F5F3FF"
          />
        </div>
      )}

      {/* Quick info card */}
      <div className="card">
        <div className="card-header">
          <h3>Restoran ma'lumotlari</h3>
          <span className={`badge ${restaurant ? 'badge-accepted' : 'badge-cancelled'}`}>
            Faol
          </span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Restoran nomi</div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{restaurant?.name || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Kategoriya</div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{restaurant?.category || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Telefon</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{restaurant?.phone || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Reyting</div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>⭐ {restaurant?.rating?.toFixed(1) || '5.0'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
