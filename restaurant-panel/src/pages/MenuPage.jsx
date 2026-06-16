import { useState, useEffect } from 'react';
import { api } from '../services/api';

const CATEGORIES = ['Burgerlar', 'Lavashlar', 'Pitsalar', 'Ichimliklar', 'Salatlar', 'Shirinliklar', 'Asosiy taomlar', 'Boshqa'];

function MenuModal({ item, onClose, onSave }) {
  const [form, setForm] = useState({
    name: item?.name || '',
    description: item?.description || '',
    price: item?.price || '',
    category: item?.category || CATEGORIES[0],
    image: item?.image || '',
    available: item?.available !== false,
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) {
      alert('Iltimos, taom nomi va narxini kiriting.');
      return;
    }
    try {
      setSaving(true);
      await onSave({ ...form, price: Number(form.price) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>{item ? 'Taomni tahrirlash' : 'Yangi taom qo\'shish'}</h3>

        <div className="form-group">
          <label className="form-label">Taom nomi *</label>
          <input className="form-input" value={form.name} onChange={e => handleChange('name', e.target.value)} placeholder="Masalan: Klassik Burger" />
        </div>

        <div className="form-group">
          <label className="form-label">Tavsif</label>
          <input className="form-input" value={form.description} onChange={e => handleChange('description', e.target.value)} placeholder="Qisqacha tavsif..." />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Narxi (UZS) *</label>
            <input className="form-input" type="number" value={form.price} onChange={e => handleChange('price', e.target.value)} placeholder="25000" />
          </div>
          <div className="form-group">
            <label className="form-label">Kategoriya</label>
            <select className="form-input" value={form.category} onChange={e => handleChange('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Rasm URL (ixtiyoriy)</label>
          <input className="form-input" value={form.image} onChange={e => handleChange('image', e.target.value)} placeholder="https://..." />
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label className="form-label" style={{ margin: 0 }}>Sotuvda mavjud</label>
          <button
            className={`toggle-switch ${form.available ? 'on' : ''}`}
            onClick={() => handleChange('available', !form.available)}
            type="button"
          >
            <div className="toggle-knob" />
          </button>
        </div>

        <div className="modal-actions">
          <button className="btn-outline" onClick={onClose}>Bekor qilish</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saqlanmoqda...' : item ? 'Saqlash' : 'Qo\'shish'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MenuPage() {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const loadMenu = async () => {
    try {
      setLoading(true);
      const res = await api.getMenu();
      if (res.success) setMenu(res.menu);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMenu(); }, []);

  const handleSave = async (data) => {
    try {
      if (editingItem) {
        await api.updateMenuItem(editingItem._id, data);
      } else {
        await api.addMenuItem(data);
      }
      setShowModal(false);
      setEditingItem(null);
      loadMenu();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Ushbu taomni o\'chirishni tasdiqlaysizmi?')) return;
    try {
      await api.deleteMenuItem(id);
      loadMenu();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleAvailability = async (item) => {
    try {
      await api.updateMenuItem(item._id, { available: !item.available });
      loadMenu();
    } catch (err) {
      alert(err.message);
    }
  };

  const openAdd = () => { setEditingItem(null); setShowModal(true); };
  const openEdit = (item) => { setEditingItem(item); setShowModal(true); };

  // Group by category
  const categories = [...new Set(menu.map(m => m.category))];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Menyu</h1>
          <p>Taomlarni boshqaring, narx va mavjudligini yangilang</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Yangi taom qo'shish
        </button>
      </div>

      {loading ? (
        <div className="empty-state"><p>Yuklanmoqda...</p></div>
      ) : menu.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
          </svg>
          <p>Menyu bo'sh. Taom qo'shish uchun yuqoridagi tugmani bosing.</p>
        </div>
      ) : (
        categories.map(cat => (
          <div key={cat} style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 14, borderLeft: '4px solid #FF9500', paddingLeft: 12 }}>
              {cat}
            </h3>
            <div className="menu-grid">
              {menu.filter(m => m.category === cat).map(item => (
                <div className="menu-item-card" key={item._id} style={{ opacity: item.available ? 1 : 0.55 }}>
                  {item.image ? (
                    <img src={item.image} alt={item.name} onError={e => e.target.style.display='none'} />
                  ) : (
                    <div style={{ width: '100%', height: 140, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="36" height="36" fill="none" stroke="#CBD5E1" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 12a2.25 2.25 0 112.25 2.25A2.25 2.25 0 0113.5 12z" />
                      </svg>
                    </div>
                  )}
                  <div className="menu-item-card-body">
                    <h4>{item.name}</h4>
                    <p>{item.description || 'Tavsif yo\'q'}</p>
                    <div className="menu-price">{item.price?.toLocaleString()} UZS</div>
                    <div className="menu-item-actions">
                      <button
                        className={`toggle-switch ${item.available ? 'on' : ''}`}
                        onClick={() => handleToggleAvailability(item)}
                        title={item.available ? 'Mavjud — o\'chirish' : 'Mavjud emas — yoqish'}
                      >
                        <div className="toggle-knob" />
                      </button>
                      <button className="btn-outline" style={{ flex: 1 }} onClick={() => openEdit(item)}>
                        Tahrirlash
                      </button>
                      <button className="btn-danger" onClick={() => handleDelete(item._id)}>
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {showModal && (
        <MenuModal
          item={editingItem}
          onClose={() => { setShowModal(false); setEditingItem(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
