import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, StatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen from './src/screens/LoginScreen';
import OTPScreen from './src/screens/OTPScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import HomeScreen from './src/screens/HomeScreen';
import RideProgressScreen from './src/screens/RideProgressScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ServiceSelectScreen from './src/screens/ServiceSelectScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import EatsHomeScreen from './src/screens/eats/EatsHomeScreen';
import RestaurantDetailScreen from './src/screens/eats/RestaurantDetailScreen';
import CartScreen from './src/screens/eats/CartScreen';
import OrderTrackingScreen from './src/screens/eats/OrderTrackingScreen';
import { api } from './src/services/api';

export default function App() {
  const [screen, setScreen] = useState('Splash'); // Splash, Login, OTP, ProfileSetup, ServiceSelect, Home, RideProgress, History
  const [phone, setPhone] = useState('');
  const [devCode, setDevCode] = useState('');
  const [user, setUser] = useState(null);
  const [activeRide, setActiveRide] = useState(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [cartRestaurant, setCartRestaurant] = useState(null);
  const [activeEatsOrderId, setActiveEatsOrderId] = useState(null);

  // Auto-login flow on mount
  useEffect(() => {
    const checkAuth = async () => {
      console.log('checkAuth boshlandi');
      try {
        console.log('Tokenni yuklash boshlandi...');
        await api.loadToken();
        console.log('Token yuklandi, profilni olishga so\'rov yuborilmoqda...');
        const profileRes = await api.getProfile();
        console.log('Profil olindi:', profileRes);
        if (profileRes.success && profileRes.user) {
          setUser(profileRes.user);
          
          console.log('Aktiv sayohatni tekshirish...');
          const rideRes = await api.getActiveRide();
          if (rideRes.success && rideRes.ride) {
            setActiveRide(rideRes.ride);
            console.log('Aktiv sayohat topildi, RideProgress ekraniga o\'tilmoqda');
            setScreen('RideProgress');
          } else {
            if (profileRes.user.name && profileRes.user.surname) {
              console.log('Profil to\'liq, ServiceSelect ekraniga o\'tilmoqda');
              setScreen('ServiceSelect');
            } else {
              console.log('Profil to\'liq emas, ProfileSetup ekraniga o\'tilmoqda');
              setScreen('ProfileSetup');
            }
          }
        } else {
          console.log('Profil muvaffaqiyatli emas, Onboarding tekshirilmoqda');
          const completed = await api.isOnboardingCompleted();
          if (completed) {
            setScreen('Login');
          } else {
            setScreen('Onboarding');
          }
        }
      } catch (err) {
        console.log('checkAuth da xatolik yuz berdi:', err.message);
        const completed = await api.isOnboardingCompleted();
        if (completed) {
          setScreen('Login');
        } else {
          setScreen('Onboarding');
        }
      }
    };

    checkAuth();
  }, []);

  const handleOTPSent = (phoneNumber, code) => {
    setPhone(phoneNumber);
    setDevCode(code);
    setScreen('OTP');
  };

  const handleVerified = (userData) => {
    setUser(userData);
    if (userData.name && userData.surname) {
      // Check if there is any active ride first
      api.getActiveRide().then((res) => {
        if (res.success && res.ride) {
          setActiveRide(res.ride);
          setScreen('RideProgress');
        } else {
          setScreen('ServiceSelect');
        }
      }).catch(() => {
        setScreen('ServiceSelect');
      });
    } else {
      setScreen('ProfileSetup');
    }
  };

  const handleProfileSetupComplete = (userData) => {
    setUser(userData);
    setScreen('ServiceSelect');
  };

  const handleRideCreated = (rideData) => {
    setActiveRide(rideData);
    setScreen('RideProgress');
  };

  const handleRideFinished = () => {
    setActiveRide(null);
    setScreen('Home');
  };

  const handleLogout = async () => {
    await api.clearToken();
    setUser(null);
    setActiveRide(null);
    setScreen('Login');
  };

  const renderScreen = () => {
    switch (screen) {
      case 'Splash':
        return (
          <View style={[styles.center, { backgroundColor: '#F8FAFC' }]}>
            <View style={styles.splashLogoContainer}>
              <Text style={styles.splashLogoText}>InFast</Text>
              <View style={styles.splashBadge}>
                <Text style={styles.splashBadgeText}>GO</Text>
              </View>
            </View>
            <ActivityIndicator size="small" color="#3b32db" style={{ marginTop: 24 }} />
          </View>
        );
      case 'Onboarding':
        return <OnboardingScreen onComplete={() => setScreen('Login')} />;
      case 'Login':
        return <LoginScreen onOTPSent={handleOTPSent} />;
      case 'OTP':
        return (
          <OTPScreen
            phone={phone}
            devCode={devCode}
            onVerified={handleVerified}
            onBack={() => setScreen('Login')}
          />
        );
      case 'ProfileSetup':
        return <ProfileSetupScreen onProfileSetupComplete={handleProfileSetupComplete} />;
      case 'ServiceSelect':
        return (
          <ServiceSelectScreen
            user={user}
            onSelectGo={() => setScreen('Home')}
            onSelectEats={() => setScreen('EatsHome')}
            onLogout={handleLogout}
          />
        );
      case 'Home':
        return (
          <HomeScreen
            user={user}
            onRideCreated={handleRideCreated}
            onViewProfile={() => setScreen('Profile')}
            onLogout={handleLogout}
            onViewHistory={() => setScreen('History')}
            onViewServices={() => setScreen('ServiceSelect')}
          />
        );
      case 'Profile':
        return (
          <ProfileScreen
            user={user}
            onProfileUpdated={(updatedUser) => setUser(updatedUser)}
            onViewHistory={() => setScreen('History')}
            onBack={() => setScreen('Home')}
            onViewHome={() => setScreen('Home')}
          />
        );
      case 'RideProgress':
        return (
          <RideProgressScreen
            initialRide={activeRide}
            user={user}
            onRideFinished={handleRideFinished}
            onViewHome={handleRideFinished}
            onViewHistory={() => { handleRideFinished(); setScreen('History'); }}
            onViewProfile={() => { handleRideFinished(); setScreen('Profile'); }}
          />
        );
      case 'History':
        return (
          <HistoryScreen
            onBack={() => setScreen('Home')}
            onViewHome={() => setScreen('Home')}
            onViewProfile={() => setScreen('Profile')}
            onTrackEatsOrder={(orderId) => {
              setActiveEatsOrderId(orderId);
              setScreen('EatsOrderTracking');
            }}
          />
        );
      case 'EatsHome':
        return (
          <EatsHomeScreen
            onBack={() => setScreen('ServiceSelect')}
            onSelectRestaurant={(id) => {
              setSelectedRestaurantId(id);
              setScreen('EatsRestaurantDetail');
            }}
            onViewCart={async () => {
              try {
                const val = await AsyncStorage.getItem('infast_cart');
                if (val) {
                  const parsed = JSON.parse(val);
                  setCartItems(parsed.items);
                  setCartRestaurant(parsed.restaurant);
                  setSelectedRestaurantId(parsed.restaurant._id);
                  setScreen('EatsCart');
                }
              } catch (e) {
                console.error('Error fetching persistent cart:', e);
              }
            }}
          />
        );
      case 'EatsRestaurantDetail':
        return (
          <RestaurantDetailScreen
            restaurantId={selectedRestaurantId}
            onBack={() => setScreen('EatsHome')}
            onViewCart={(items, restaurant) => {
              setCartItems(items);
              setCartRestaurant(restaurant);
              setScreen('EatsCart');
            }}
          />
        );
      case 'EatsCart':
        return (
          <CartScreen
            items={cartItems}
            restaurant={cartRestaurant}
            onBack={() => setScreen('EatsRestaurantDetail')}
            onOrderSuccess={async (orderId) => {
              setActiveEatsOrderId(orderId);
              setCartItems([]);
              setCartRestaurant(null);
              try {
                await AsyncStorage.removeItem('infast_cart');
              } catch (e) {}
              setScreen('EatsOrderTracking');
            }}
          />
        );
      case 'EatsOrderTracking':
        return (
          <OrderTrackingScreen
            orderId={activeEatsOrderId}
            userId={user?._id}
            onBack={() => setScreen('ServiceSelect')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        {renderScreen()}
      </View>
    </SafeAreaProvider>
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
  splashLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  splashLogoText: {
    fontSize: 38,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  splashBadge: {
    backgroundColor: '#3b32db',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 6,
  },
  splashBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
});
