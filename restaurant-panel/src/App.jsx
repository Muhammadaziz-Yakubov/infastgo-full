import { useState, useEffect, useRef } from 'react';
import { api } from './services/api';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OrdersPage from './pages/OrdersPage';
import MenuPage from './pages/MenuPage';
import WalletPage from './pages/WalletPage';
import './index.css';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Bosh sahifa', icon: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )},
  { id: 'orders', label: 'Buyurtmalar', icon: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
    </svg>
  )},
  { id: 'menu', label: 'Menyu', icon: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
    </svg>
  )},
  { id: 'wallet', label: 'Moliya', icon: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18-3a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V9" />
    </svg>
  )},
];

export default function App() {
  const [restaurant, setRestaurant] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const prevOrderCountRef = useRef(0);

  // Restore session on load
  useEffect(() => {
    const savedToken = localStorage.getItem('restaurant_token');
    const savedInfo = localStorage.getItem('restaurant_info');
    if (savedToken && savedInfo) {
      api.setToken(savedToken);
      setRestaurant(JSON.parse(savedInfo));
    }
  }, []);

  // Poll for new orders and show notification
  useEffect(() => {
    if (!restaurant) return;

    const check = async () => {
      try {
        const res = await api.getOrders();
        if (res.success) {
          const activeOrders = res.orders.filter(o => o.status === 'new');
          if (activeOrders.length > prevOrderCountRef.current) {
            setNewOrderAlert(true);
            setTimeout(() => setNewOrderAlert(false), 4000);
          }
          prevOrderCountRef.current = activeOrders.length;
        }
      } catch (e) { /* silent */ }
    };

    const interval = setInterval(check, 20000);
    return () => clearInterval(interval);
  }, [restaurant]);

  const handleLogout = () => {
    api.clearToken();
    setRestaurant(null);
  };

  if (!restaurant) {
    return <LoginPage onLogin={setRestaurant} />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardPage restaurant={restaurant} />;
      case 'orders':    return <OrdersPage />;
      case 'menu':      return <MenuPage />;
      case 'wallet':    return <WalletPage />;
      default:          return <DashboardPage restaurant={restaurant} />;
    }
  };

  const initial = restaurant.name?.[0]?.toUpperCase() || 'R';

  return (
    <div className="app-layout">
      {/* New order notification */}
      {newOrderAlert && (
        <div className="new-order-alert">
          🔔 Yangi buyurtma keldi!
        </div>
      )}

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>InFast <span>Eats</span></h2>
          <p>Restoran paneli</p>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="restaurant-info">
            <div className="restaurant-avatar">{initial}</div>
            <div>
              <div className="restaurant-name-small">{restaurant.name}</div>
              <div className="restaurant-category-small">{restaurant.category}</div>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Chiqish
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}
