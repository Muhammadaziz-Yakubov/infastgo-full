import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  Alert,
  Platform,
  ScrollView,
  Vibration,
} from 'react-native';
import { api } from '../services/api';
import { Feather } from '@expo/vector-icons';
import { connectSocket, disconnectSocket, emitLocation } from '../services/socket';
import * as Location from 'expo-location';
import MapView, { Marker, Circle } from '../components/MapComponent';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Premium light map styling for clean Apple-level UI
const lightMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [{ "color": "#F8FAFC" }]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#64748B" }]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#FFFFFF" }]
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [{ "color": "#F1F5F9" }]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#475569" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#FFFFFF" }]
  },
  {
    "featureType": "road.arterial",
    "elementType": "geometry",
    "stylers": [{ "color": "#E2E8F0" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [{ "color": "#CBD5E1" }]
  },
  {
    "featureType": "road.local",
    "elementType": "labels",
    "stylers": [{ "visibility": "off" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#E0F2FE" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#0284C7" }]
  }
];

export default function DashboardScreen({ 
  driver, 
  activeRequest, 
  onRideAccepted, 
  onRideRejected, 
  onLogout, 
  onViewProfile, 
  onViewHistory, 
  onViewStatistics, 
  onIncomingRequest 
}) {
  const [online, setOnline] = useState(driver.status === 'online');
  const [earnings, setEarnings] = useState(driver.earnings || 0);
  const [rating, setRating] = useState(driver.rating || 5.0);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  
  // Tracking & Map
  const [driverLocation, setDriverLocation] = useState(null);
  const locationWatcherRef = useRef(null);
  const mapRef = useRef(null);

  // Daily statistics
  const [dailyStats, setDailyStats] = useState({
    earnings: 0,
    ridesCount: 0,
    distance: 0,
    avgRating: 5.0,
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(-SCREEN_WIDTH * 0.8)).current;

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const requestSheetY = useRef(new Animated.Value(450)).current; // starts off-screen
  const acceptScale = useRef(new Animated.Value(1)).current;
  const declineScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Recenter map helper
  const recenterMap = () => {
    if (driverLocation && mapRef.current && Platform.OS !== 'web') {
      mapRef.current.animateToRegion({
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      }, 600);
    }
  };

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    fetchDailyStats();
    
    // Auto-recenter once we get location on mount
    if (driverLocation) {
      recenterMap();
    }
  }, [driverLocation !== null]);

  // Handle incoming request animation
  useEffect(() => {
    if (activeRequest) {
      // Trigger smooth slide-up
      Animated.spring(requestSheetY, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }).start();

      // Trigger continuous pulse for accept button and sound trigger/vibration
      const pulseSequence = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulseSequence.start();

      // Vibrate to alert driver
      Vibration.vibrate([0, 400, 200, 400], true);

      return () => {
        pulseSequence.stop();
        Vibration.cancel();
      };
    } else {
      // Hide request card
      Animated.timing(requestSheetY, {
        toValue: 450,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [activeRequest]);

  // Session hours online
  useEffect(() => {
    let timer = null;
    if (online) {
      timer = setInterval(() => {
        setSessionSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [online]);

  const totalSecondsToday = (dailyStats.ridesCount * 25 * 60) + sessionSeconds;

  const formatOnlineTimeShort = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}soat ${minutes}d`;
  };

  const fetchDailyStats = async () => {
    setLoadingStats(true);
    try {
      const response = await api.getHistory();
      if (response.success && response.rides) {
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const ridesToday = response.rides.filter(ride => {
          const rideDate = new Date(ride.createdAt);
          return ride.status === 'completed' && rideDate >= startOfToday;
        });

        const todayEarnings = ridesToday.reduce((sum, ride) => sum + (ride.price || 0), 0);
        const todayDistance = ridesToday.reduce((sum, ride) => sum + (parseFloat(ride.distance) || 0), 0);
        const todayRidesCount = ridesToday.length;

        const ratedRides = ridesToday.filter(ride => ride.rating > 0);
        const todayAvgRating = ratedRides.length > 0
          ? ratedRides.reduce((sum, r) => sum + r.rating, 0) / ratedRides.length
          : 5.0;

        setDailyStats({
          earnings: todayEarnings,
          ridesCount: todayRidesCount,
          distance: parseFloat(todayDistance.toFixed(1)),
          avgRating: parseFloat(todayAvgRating.toFixed(1)),
        });
        setEarnings(todayEarnings);
      }
    } catch (err) {
      console.error('Statistika yuklashda xatolik:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Status handler (Go online / offline)
  const toggleStatus = async () => {
    setUpdating(true);
    setError('');
    const newStatus = online ? 'offline' : 'online';
    try {
      const data = await api.updateProfile({
        status: newStatus,
        name: driver.name,
        surname: driver.surname,
      });
      if (data.success) {
        setOnline(newStatus === 'online');
        Vibration.vibrate(80);
      } else {
        throw new Error(data.message || 'Statusni o\'zgartirib bo\'lmadi');
      }
    } catch (err) {
      setError(err.message);
      Alert.alert('Xatolik', err.message || 'Serverga ulanishda muammo yuz berdi');
    } finally {
      setUpdating(false);
    }
  };

  // Location tracking logic
  useEffect(() => {
    let active = true;

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Ruxsat berilmadi', 'Ilovadan foydalanish uchun geolokatsiya ruxsatini bering.');
          setOnline(false);
          return;
        }

        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }).catch(() => Location.getLastKnownPositionAsync());

        if (initialLoc && active) {
          const lat = initialLoc.coords.latitude;
          const lng = initialLoc.coords.longitude;
          setDriverLocation({ latitude: lat, longitude: lng });
          if (online) {
            emitLocation(driver.id, lat, lng);
          }
        }

        locationWatcherRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 6000,
            distanceInterval: 10,
          },
          (newLocation) => {
            if (!active) return;
            const lat = newLocation.coords.latitude;
            const lng = newLocation.coords.longitude;
            setDriverLocation({ latitude: lat, longitude: lng });
            if (online) {
              emitLocation(driver.id, lat, lng);
            }
          }
        );
      } catch (err) {
        console.error('Location tracking error:', err);
      }
    };

    if (online) {
      connectSocket(driver.id, (rideRequest) => {
        onIncomingRequest(rideRequest);
      });
      startLocationTracking();
    } else {
      setDriverLocation(null);
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
      disconnectSocket();
    }

    return () => {
      active = false;
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
      disconnectSocket();
    };
  }, [online]);

  // Sidebar controllers
  const toggleSidebar = (open) => {
    if (open) {
      setSidebarOpen(true);
      Animated.timing(sidebarAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(sidebarAnim, {
        toValue: -SCREEN_WIDTH * 0.8,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setSidebarOpen(false));
    }
  };

  // Ride Request handlers
  const handleAcceptRide = async () => {
    if (!activeRequest) return;
    
    // Scale animation feedback
    Animated.sequence([
      Animated.timing(acceptScale, { toValue: 0.95, duration: 60, useNativeDriver: true }),
      Animated.timing(acceptScale, { toValue: 1, duration: 60, useNativeDriver: true })
    ]).start();

    try {
      const response = await api.acceptRide(activeRequest.rideId);
      if (response.success) {
        onRideAccepted(response.ride);
      } else {
        Alert.alert('Xatolik', response.message || 'Buyurtmani qabul qilib bo\'lmadi');
      }
    } catch (err) {
      Alert.alert('Xatolik', err.message || 'Serverga bog\'lanishda xatolik');
    }
  };

  const handleDeclineRide = async () => {
    if (!activeRequest) return;

    // Scale animation feedback
    Animated.sequence([
      Animated.timing(declineScale, { toValue: 0.95, duration: 60, useNativeDriver: true }),
      Animated.timing(declineScale, { toValue: 1, duration: 60, useNativeDriver: true })
    ]).start();

    try {
      await api.rejectRide(activeRequest.rideId);
      onRideRejected();
    } catch (err) {
      console.log('Error rejecting ride:', err.message);
      onRideRejected(); // fallback to clear UI
    }
  };

  const defaultCoords = {
    latitude: 41.311081,
    longitude: 69.240562,
  };

  const currentCoords = driverLocation || defaultCoords;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      
      {/* MAP SECTION */}
      <View style={styles.mapWrapper}>
        {Platform.OS === 'web' ? (
          <View style={styles.webMapPlaceholder}>
            <Feather name="map" size={48} color="#94A3B8" />
            <Text style={styles.webMapText}>Shahar xaritasi yuklandi (Light Theme)</Text>
            {driverLocation && (
              <Text style={styles.webMapCoords}>
                Driver GPS: {driverLocation.latitude.toFixed(6)}, {driverLocation.longitude.toFixed(6)}
              </Text>
            )}
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            customMapStyle={lightMapStyle}
            initialRegion={{
              latitude: currentCoords.latitude,
              longitude: currentCoords.longitude,
              latitudeDelta: 0.012,
              longitudeDelta: 0.012,
            }}
            showsUserLocation={false}
          >
            {driverLocation && (
              <>
                <Marker
                  coordinate={{
                    latitude: driverLocation.latitude,
                    longitude: driverLocation.longitude,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.driverPulseOuter}>
                    <View style={styles.driverPulseInner} />
                  </View>
                </Marker>
                <Circle
                  center={{
                    latitude: driverLocation.latitude,
                    longitude: driverLocation.longitude,
                  }}
                  radius={120}
                  fillColor="rgba(59, 50, 219, 0.06)"
                  strokeColor="rgba(59, 50, 219, 0.18)"
                  strokeWidth={1.5}
                />
              </>
            )}
          </MapView>
        )}

        {/* Offline Overlay - dim map when offline for visual focus */}
        {!online && <View style={styles.offlineOverlay} />}
      </View>

      {/* TOP FLOATING HEADER - Uber/Yandex Header layout */}
      <View style={styles.headerFloatingContainer}>
        {/* Left Side: Profile menu and Rating */}
        <View style={styles.headerLeftCol}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => toggleSidebar(true)}
            activeOpacity={0.7}
          >
            <Feather name="menu" size={20} color="#0F172A" />
          </TouchableOpacity>
          
          <View style={styles.headerRatingCard}>
            <Feather name="star" size={13} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.headerRatingText}>{rating.toFixed(1)}</Text>
          </View>
        </View>

        {/* Center: Online/Offline Toggle */}
        <TouchableOpacity
          style={[
            styles.statusTogglePill,
            online ? styles.statusTogglePillOnline : styles.statusTogglePillOffline
          ]}
          onPress={toggleStatus}
          disabled={updating}
          activeOpacity={0.85}
        >
          {updating ? (
            <ActivityIndicator size="small" color={online ? "#FFFFFF" : "#3b32db"} />
          ) : (
            <>
              <View style={[
                styles.statusPillDot, 
                { backgroundColor: online ? '#22C55E' : '#94A3B8' }
              ]} />
              <Text style={[
                styles.statusPillText, 
                online ? styles.statusPillTextOnline : styles.statusPillTextOffline
              ]}>
                {online ? 'ONLINE' : 'OFFLINE'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Right Side: Earnings Today Card */}
        <View style={styles.headerEarningsCard}>
          <Text style={styles.earningsCardLabel}>BUGUN</Text>
          <Text style={styles.earningsCardValue}>
            {earnings.toLocaleString()} <Text style={styles.earningsCardCurrency}>UZS</Text>
          </Text>
        </View>
      </View>

      {/* FLOATING ACTION OVERLAYS */}
      <View style={styles.floatingControls}>
        {/* Recenter GPS marker button */}
        {online && driverLocation && (
          <TouchableOpacity 
            style={styles.floatingRecenterBtn} 
            onPress={recenterMap}
            activeOpacity={0.7}
          >
            <Feather name="navigation" size={18} color="#3b32db" />
          </TouchableOpacity>
        )}
      </View>

      {/* MAIN BOTTOM SHEET - Shift details */}
      {!activeRequest && (
        <View style={styles.mainBottomSheet}>
          <View style={styles.dragHandle} />
          
          {/* Shift stats cards row */}
          <View style={styles.shiftStatsRow}>
            <View style={styles.shiftStatBox}>
              <View style={styles.shiftStatIconBg}>
                <Feather name="navigation" size={16} color="#3b32db" />
              </View>
              <View>
                <Text style={styles.shiftStatLabel}>Sayohatlar</Text>
                <Text style={styles.shiftStatValue}>{dailyStats.ridesCount} ta</Text>
              </View>
            </View>

            <View style={styles.shiftStatDivider} />

            <View style={styles.shiftStatBox}>
              <View style={[styles.shiftStatIconBg, { backgroundColor: 'rgba(34, 197, 94, 0.08)' }]}>
                <Feather name="clock" size={16} color="#22C55E" />
              </View>
              <View>
                <Text style={styles.shiftStatLabel}>Faol vaqt</Text>
                <Text style={styles.shiftStatValue}>{formatOnlineTimeShort(totalSecondsToday)}</Text>
              </View>
            </View>
          </View>

          {/* Quick Action Navigation Bar */}
          <View style={styles.quickActionsBar}>
            <TouchableOpacity 
              style={styles.quickActionItem} 
              onPress={onViewHistory}
              activeOpacity={0.7}
            >
              <View style={styles.quickActionIconContainer}>
                <Feather name="list" size={18} color="#475569" />
              </View>
              <Text style={styles.quickActionLabel}>Tarix</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionItem} 
              onPress={onViewStatistics}
              activeOpacity={0.7}
            >
              <View style={styles.quickActionIconContainer}>
                <Feather name="bar-chart-2" size={18} color="#475569" />
              </View>
              <Text style={styles.quickActionLabel}>Statistika</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionItem} 
              onPress={onViewProfile}
              activeOpacity={0.7}
            >
              <View style={styles.quickActionIconContainer}>
                <Feather name="user" size={18} color="#475569" />
              </View>
              <Text style={styles.quickActionLabel}>Profil</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* CORE RIDE REQUEST BOTTOM SHEET (SLIDE-UP CARD) */}
      {activeRequest && (
        <Animated.View style={[
          styles.requestBottomSheet, 
          { transform: [{ translateY: requestSheetY }] }
        ]}>
          <View style={styles.requestAlertGlow} />

          {/* Header section */}
          <View style={styles.requestHeader}>
            <View>
              <Text style={styles.requestTitle}>YANGI BUYURTMA TAKLIFI</Text>
              <Text style={styles.requestSubtitle}>Buyurtma ma'lumotlarini tekshiring</Text>
            </View>
            <View style={styles.requestPriceBadge}>
              <Text style={styles.requestPriceText}>
                {activeRequest.price?.toLocaleString()} <Text style={styles.requestPriceCurrency}>UZS</Text>
              </Text>
            </View>
          </View>

          {/* Map info section */}
          <View style={styles.requestRouteBox}>
            <View style={styles.requestRouteRow}>
              <View style={styles.greenDotIndicator}>
                <View style={styles.innerDotGreen} />
              </View>
              <View style={styles.routeTextCol}>
                <Text style={styles.routeLabelText}>MIJOZNING JOYLASHUVI</Text>
                <Text style={styles.routeAddressText} numberOfLines={1}>
                  {activeRequest.pickup?.address || 'Belgilanmagan manzil'}
                </Text>
              </View>
            </View>

            <View style={styles.routeDottedLine}>
              <View style={styles.verticalDot} />
              <View style={styles.verticalDot} />
            </View>

            <View style={styles.requestRouteRow}>
              <View style={styles.redDotIndicator}>
                <View style={styles.innerDotRed} />
              </View>
              <View style={styles.routeTextCol}>
                <Text style={styles.routeLabelText}>BORADIGAN MANZIL</Text>
                <Text style={styles.routeAddressText} numberOfLines={1}>
                  {activeRequest.destination?.address || 'Belgilanmagan manzil'}
                </Text>
              </View>
            </View>
          </View>

          {/* Distance and User profile row */}
          <View style={styles.requestFooterDetails}>
            <View style={styles.passengerProfile}>
              <View style={styles.passengerAvatar}>
                <Text style={styles.passengerAvatarText}>
                  {activeRequest.user?.name ? activeRequest.user.name[0].toUpperCase() : '👤'}
                </Text>
              </View>
              <View>
                <Text style={styles.passengerName}>
                  {activeRequest.user?.name || 'Mijoz'} {activeRequest.user?.surname || ''}
                </Text>
                <Text style={styles.passengerRating}>⭐ 4.9 Reyting</Text>
              </View>
            </View>

            <View style={styles.requestDistanceBadge}>
              <Feather name="navigation" size={13} color="#64748B" style={{ marginRight: 4 }} />
              <Text style={styles.requestDistanceText}>{activeRequest.distance} km</Text>
            </View>
          </View>

          {/* Action buttons with scale feedback */}
          <View style={styles.requestActionsRow}>
            <Animated.View style={{ flex: 1, marginRight: 12, transform: [{ scale: declineScale }] }}>
              <TouchableOpacity
                style={styles.requestDeclineBtn}
                onPress={handleDeclineRide}
                activeOpacity={0.8}
              >
                <Feather name="x" size={18} color="#EF4444" style={{ marginRight: 6 }} />
                <Text style={styles.declineBtnText}>Rad etish</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{ flex: 2, transform: [{ scale: Animated.multiply(acceptScale, pulseAnim) }] }}>
              <TouchableOpacity
                style={styles.requestAcceptBtn}
                onPress={handleAcceptRide}
                activeOpacity={0.85}
              >
                <Feather name="check" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.acceptBtnText}>Qabul qilish</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
      )}

      {/* SIDEBAR DRAWER OVERLAY */}
      {sidebarOpen && (
        <TouchableOpacity
          style={styles.sidebarBackdrop}
          activeOpacity={1}
          onPress={() => toggleSidebar(false)}
        />
      )}

      {/* SIDEBAR DRAWER CONTAINER (LIGHT STYLE) */}
      <Animated.View style={[styles.sidebarContainer, { transform: [{ translateX: sidebarAnim }] }]}>
        {/* Sidebar Header */}
        <View style={styles.sidebarHeader}>
          <View style={styles.sidebarProfileInfo}>
            <View style={styles.sidebarAvatarLarge}>
              <Text style={styles.sidebarAvatarTextLarge}>{driver.name ? driver.name[0] : 'U'}</Text>
            </View>
            <View style={styles.sidebarNameDetails}>
              <Text style={styles.sidebarDriverName}>{driver.name} {driver.surname}</Text>
              <View style={styles.sidebarRatingRow}>
                <Feather name="star" size={12} color="#F59E0B" fill="#F59E0B" />
                <Text style={styles.sidebarRatingText}> {rating.toFixed(1)} Reyting</Text>
              </View>
            </View>
          </View>
          <View style={styles.sidebarStatusBadgeRow}>
            <View style={[styles.sidebarStatusDot, { backgroundColor: online ? '#22C55E' : '#94A3B8' }]} />
            <Text style={[styles.sidebarStatusText, { color: online ? '#1E293B' : '#64748B' }]}>
              {online ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </View>
        </View>

        {/* Sidebar Menu Items */}
        <ScrollView style={styles.sidebarMenuScroll} showsVerticalScrollIndicator={false}>
          <TouchableOpacity 
            style={styles.sidebarMenuItem} 
            onPress={() => toggleSidebar(false)}
          >
            <Feather name="home" size={20} color="#3b32db" style={styles.sidebarMenuIcon} />
            <Text style={[styles.sidebarMenuItemText, styles.sidebarMenuItemActiveText]}>Bosh sahifa</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.sidebarMenuItem} 
            onPress={() => {
              toggleSidebar(false);
              onViewHistory();
            }}
          >
            <Feather name="list" size={20} color="#64748B" style={styles.sidebarMenuIcon} />
            <Text style={styles.sidebarMenuItemText}>Sayohatlar tarixi</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.sidebarMenuItem} 
            onPress={() => {
              toggleSidebar(false);
              onViewStatistics();
            }}
          >
            <Feather name="bar-chart-2" size={20} color="#64748B" style={styles.sidebarMenuIcon} />
            <Text style={styles.sidebarMenuItemText}>Statistika</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.sidebarMenuItem} 
            onPress={() => {
              toggleSidebar(false);
              onViewProfile();
            }}
          >
            <Feather name="user" size={20} color="#64748B" style={styles.sidebarMenuIcon} />
            <Text style={styles.sidebarMenuItemText}>Profil sozlamalari</Text>
          </TouchableOpacity>

          <View style={styles.sidebarSeparator} />

          <View style={styles.comingSoonHeader}>
            <Text style={styles.comingSoonTitle}>Tez kunda</Text>
          </View>

          <View style={styles.sidebarMenuItemDisabled}>
            <Feather name="message-square" size={20} color="#CBD5E1" style={styles.sidebarMenuIcon} />
            <Text style={styles.sidebarMenuItemTextDisabled}>Haydovchilar chati</Text>
          </View>

          <View style={styles.sidebarMenuItemDisabled}>
            <Feather name="phone-call" size={20} color="#CBD5E1" style={styles.sidebarMenuIcon} />
            <Text style={styles.sidebarMenuItemTextDisabled}>24/7 Yordam xizmati</Text>
          </View>
        </ScrollView>

        {/* Sidebar Footer Logout */}
        <View style={styles.sidebarFooter}>
          <TouchableOpacity 
            style={styles.sidebarLogoutBtn} 
            onPress={() => {
              toggleSidebar(false);
              setTimeout(() => {
                Alert.alert(
                  "Tizimdan chiqish",
                  "Haqiqatan ham chiqmoqchimisiz?",
                  [
                    { text: "Bekor qilish", style: "cancel" },
                    { text: "Chiqish", onPress: onLogout, style: "destructive" }
                  ]
                );
              }, 400);
            }}
          >
            <Feather name="log-out" size={20} color="#EF4444" style={styles.sidebarMenuIcon} />
            <Text style={styles.sidebarLogoutText}>Tizimdan chiqish</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  offlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(248, 250, 252, 0.45)', // soft light overlay when offline
    zIndex: 1,
  },
  webMapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  webMapText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
  },
  webMapCoords: {
    color: '#3b32db',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },

  // Driver marker design
  driverPulseOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(59, 50, 219, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#3b32db',
  },
  driverPulseInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3b32db',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  // Floating controls
  floatingControls: {
    position: 'absolute',
    right: 16,
    bottom: 260,
    zIndex: 10,
    gap: 12,
  },
  floatingRecenterBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  // TOP FLOATING HEADER LAYOUT
  headerFloatingContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 20,
    left: 16,
    right: 16,
    marginTop: 17,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
  headerLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  headerRatingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 44,
    gap: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  headerRatingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },

  // Toggle switch pill
  statusTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    paddingHorizontal: 20,
    height: 44,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    gap: 8,
    minWidth: 120,
  },
  statusTogglePillOffline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  statusTogglePillOnline: {
    backgroundColor: '#3b32db',
    shadowColor: '#3b32db',
  },
  statusPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusPillTextOffline: {
    color: '#475569',
  },
  statusPillTextOnline: {
    color: '#FFFFFF',
  },

  // Earnings header card
  headerEarningsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  earningsCardLabel: {
    fontSize: 8,
    color: '#94A3B8',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  earningsCardValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: -2,
  },
  earningsCardCurrency: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
  },

  // MAIN DASHBOARD BOTTOM PANEL
  mainBottomSheet: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 34 : 16,
    left: 16,
    marginBottom: 30,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    zIndex: 5,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  shiftStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    marginBottom: 16,
  },
  shiftStatBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shiftStatIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 50, 219, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftStatLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  shiftStatValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  shiftStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },

  // Quick Action Navigation inside bottom sheet
  quickActionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  quickActionItem: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickActionLabel: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
  },

  // CORE RIDE REQUEST BOTTOM SHEET (SLIDE-UP OVERLAY CARD)
  requestBottomSheet: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 34 : 16,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 2,
    borderColor: '#22C55E', // highlight border
    zIndex: 100,
    overflow: 'hidden',
  },
  requestAlertGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#22C55E',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  requestTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#22C55E',
    letterSpacing: 1.5,
  },
  requestSubtitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  requestPriceBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.18)',
  },
  requestPriceText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#22C55E',
  },
  requestPriceCurrency: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Route indicator layout
  requestRouteBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    marginBottom: 20,
  },
  requestRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greenDotIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  innerDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  redDotIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  innerDotRed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  routeTextCol: {
    flex: 1,
  },
  routeLabelText: {
    fontSize: 8,
    color: '#94A3B8',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  routeAddressText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 1,
  },
  routeDottedLine: {
    marginLeft: 9,
    marginVertical: 4,
    gap: 3,
  },
  verticalDot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: '#CBD5E1',
  },

  // Details
  requestFooterDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  passengerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  passengerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#475569',
  },
  passengerName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  passengerRating: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  requestDistanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  requestDistanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },

  // Actions
  requestActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestDeclineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFF5F5',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  declineBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#EF4444',
  },
  requestAcceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  acceptBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // SIDEBAR DRAWER OVERLAYS
  sidebarBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    zIndex: 99,
  },
  sidebarContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.8,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 100,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  sidebarHeader: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  sidebarProfileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sidebarAvatarLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b32db',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  sidebarAvatarTextLarge: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  sidebarNameDetails: {
    flex: 1,
  },
  sidebarDriverName: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  sidebarRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  sidebarRatingText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  sidebarStatusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#EEF2FF',
  },
  sidebarStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  sidebarStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sidebarMenuScroll: {
    flex: 1,
    paddingVertical: 15,
  },
  sidebarMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  sidebarMenuItemDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    opacity: 0.55,
  },
  sidebarMenuIcon: {
    marginRight: 16,
    width: 20,
    textAlign: 'center',
  },
  sidebarMenuItemText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  sidebarMenuItemActiveText: {
    color: '#3b32db',
    fontWeight: '800',
  },
  sidebarMenuItemTextDisabled: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  sidebarSeparator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 15,
    marginHorizontal: 20,
  },
  comingSoonHeader: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  comingSoonTitle: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sidebarFooter: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    marginBottom: 25,
    borderColor: '#F1F5F9',
  },
  sidebarLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  sidebarLogoutText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800',
  },
});
