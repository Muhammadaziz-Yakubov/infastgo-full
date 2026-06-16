import { useState } from 'react';
import { api } from '../services/api';

export default function LoginPage({ onLogin }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!login.trim() || !password.trim()) {
      setError('Iltimos, login va parolni kiriting.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const res = await api.login(login.trim(), password.trim());
      if (res.success && res.token) {
        api.setToken(res.token);
        localStorage.setItem('restaurant_info', JSON.stringify(res.restaurant));
        onLogin(res.restaurant);
      }
    } catch (err) {
      setError(err.message || 'Login yoki parol noto\'g\'ri.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <h1>InFast <span>Eats</span></h1>
          <p>Restoran boshqaruv paneli</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Login</label>
            <input
              className="form-input"
              type="text"
              placeholder="Restoran loginingizni kiriting"
              value={login}
              onChange={e => setLogin(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Parol</label>
            <input
              className="form-input"
              type="password"
              placeholder="Parolingizni kiriting"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button className="btn-login" type="submit" disabled={loading}>
            {loading ? 'Tekshirilmoqda...' : 'Kirish'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#94A3B8', marginTop: 20, fontWeight: 500 }}>
          Hisob ma'lumotlari uchun administratorga murojaat qiling.
        </p>
      </div>
    </div>
  );
}
