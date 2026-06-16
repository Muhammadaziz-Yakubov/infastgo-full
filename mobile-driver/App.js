import React, { useState, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import OTPScreen from './src/screens/OTPScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import IncomingRequestScreen from './src/screens/IncomingRequestScreen';
import RideProgressScreen from './src/screens/RideProgressScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import StatisticsScreen from './src/screens/StatisticsScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { api } from './src/services/api';

export default function App() {
  const [screen, setScreen] = useState('Splash'); // Splash, Login, OTP, Dashboard, IncomingRequest, RideProgress, History
  const [phone, setPhone] = useState('');
  const [devCode, setDevCode] = useState('');
  const [driver, setDriver] = useState(null);
  
  const [activeRequest, setActiveRequest] = useState(null);
  const [activeRide, setActiveRide] = useState(null);

  // Auto-login flow on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await api.loadToken();
        const profileRes = await api.getProfile();
        if (profileRes.success && profileRes.user && profileRes.user.role === 'driver') {
          setDriver(profileRes.user);
          
          // Check for active rides
          const rideRes = await api.getActiveRide();
          if (rideRes.success && rideRes.ride) {
            setActiveRide(rideRes.ride);
            setScreen('RideProgress');
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

    checkAuth();
  }, []);

  const handleOTPSent = (phoneNumber, code) => {
    setPhone(phoneNumber);
    setDevCode(code);
    setScreen('OTP');
  };

  const handleVerified = (driverData) => {
    setDriver(driverData);
    
    // Recover state
    api.getActiveRide().then((res) => {
      if (res.success && res.ride) {
        setActiveRide(res.ride);
        setScreen('RideProgress');
      } else {
        setScreen('Dashboard');
      }
    }).catch(() => {
      setScreen('Dashboard');
    });
  };

  const handleIncomingRequest = (requestData) => {
    setActiveRequest(requestData);
    // Keep screen as Dashboard to show the slide-up bottom sheet directly on the map
  };

  const handleRideAccepted = (rideData) => {
    setActiveRequest(null);
    setActiveRide(rideData);
    setScreen('RideProgress');
  };

  const handleRideRejected = () => {
    setActiveRequest(null);
  };

  const handleRideFinished = () => {
    setActiveRide(null);
    setScreen('Dashboard');
  };

  const handleLogout = async () => {
    await api.clearToken();
    setDriver(null);
    setActiveRide(null);
    setActiveRequest(null);
    setScreen('Login');
  };

  const renderScreen = () => {
    switch (screen) {
      case 'Splash':
        return (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#FFD600" />
          </View>
        );
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
      case 'Dashboard':
        return (
          <DashboardScreen
            driver={driver}
            activeRequest={activeRequest}
            onRideAccepted={handleRideAccepted}
            onRideRejected={handleRideRejected}
            onLogout={handleLogout}
            onViewProfile={() => setScreen('Profile')}
            onViewHistory={() => setScreen('History')}
            onViewStatistics={() => setScreen('Statistics')}
            onIncomingRequest={handleIncomingRequest}
          />
        );
      case 'Profile':
        return (
          <ProfileScreen
            driver={driver}
            onProfileUpdated={(updatedDriver) => setDriver(updatedDriver)}
            onViewHistory={() => setScreen('History')}
            onBack={() => setScreen('Dashboard')}
          />
        );
      case 'IncomingRequest':
        return (
          <IncomingRequestScreen
            request={activeRequest}
            onAccepted={handleRideAccepted}
            onRejected={handleRideRejected}
          />
        );
      case 'RideProgress':
        return (
          <RideProgressScreen
            initialRide={activeRide}
            driver={driver}
            onRideFinished={handleRideFinished}
          />
        );
      case 'Statistics':
        return <StatisticsScreen onBack={() => setScreen('Dashboard')} />;
      case 'History':
        return <HistoryScreen onBack={() => setScreen('Dashboard')} />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar 
          barStyle="light-content" 
          backgroundColor="#0A0A0C" 
        />
        {renderScreen()}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
