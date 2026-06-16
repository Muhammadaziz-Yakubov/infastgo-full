import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import DeliveryScreen from './src/screens/DeliveryScreen';
import IncomingRequestModal from './src/components/IncomingRequestModal';
import { api } from './src/services/api';

export default function App() {
  const [screen, setScreen] = useState('Splash'); // Splash, Login, Dashboard, Delivery
  const [courier, setCourier] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);

  useEffect(() => {
    checkCourierSession();
  }, []);

  const checkCourierSession = async () => {
    try {
      const token = await api.loadToken();
      const info = await AsyncStorage.getItem('eats_courier_info');
      if (token && info) {
        const parsed = JSON.parse(info);
        setCourier(parsed);
        
        // Fetch fresh profile state to see if there is any active delivery
        const profileRes = await api.getProfile();
        if (profileRes.success && profileRes.activeOrder) {
          setActiveOrder(profileRes.activeOrder);
          setScreen('Delivery');
        } else {
          setScreen('Dashboard');
        }
      } else {
        setScreen('Login');
      }
    } catch (err) {
      setScreen('Login');
    }
  };

  const handleLogin = (courierData) => {
    setCourier(courierData);
    setScreen('Dashboard');
  };

  const handleLogout = async () => {
    await api.clearToken();
    setCourier(null);
    setScreen('Login');
  };

  const handleIncomingRequest = (requestData) => {
    setIncomingRequest(requestData);
    setShowRequestModal(true);
  };

  const handleAcceptRequest = async () => {
    if (!incomingRequest) return;
    try {
      const res = await api.acceptOrder(incomingRequest.orderId);
      if (res.success && res.order) {
        setActiveOrder(res.order);
        setShowRequestModal(false);
        setIncomingRequest(null);
        setScreen('Delivery');
      }
    } catch (err) {
      alert(err.message || 'Buyurtmani qabul qilishda xatolik yuz berdi.');
      setShowRequestModal(false);
      setIncomingRequest(null);
    }
  };

  const handleDeclineRequest = () => {
    setShowRequestModal(false);
    setIncomingRequest(null);
  };

  const handleDeliveryComplete = () => {
    setActiveOrder(null);
    setScreen('Dashboard');
  };

  const renderScreen = () => {
    switch (screen) {
      case 'Splash':
        return (
          <View style={styles.splashCenter}>
            <View style={styles.splashLogo}>
              <Text style={{ fontSize: 40 }}>⚡</Text>
            </View>
            <Text style={styles.splashTitle}>InFast Go</Text>
            <Text style={styles.splashSub}>Kuryer Panel</Text>
            <ActivityIndicator size="small" color="#FF9500" style={{ marginTop: 32 }} />
          </View>
        );
      case 'Login':
        return <LoginScreen onLogin={handleLogin} />;
      case 'Dashboard':
        return (
          <DashboardScreen
            courier={courier}
            onLogout={handleLogout}
            onIncomingRequest={handleIncomingRequest}
          />
        );
      case 'Delivery':
        return (
          <DeliveryScreen
            order={activeOrder}
            onComplete={handleDeliveryComplete}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {renderScreen()}
      
      <IncomingRequestModal
        visible={showRequestModal}
        request={incomingRequest}
        onAccept={handleAcceptRequest}
        onDecline={handleDeclineRequest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  splashLogo: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: '#FF9500',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  splashTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  splashSub: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 6,
  },
});
