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
  SafeAreaView,
  StatusBar,
  Modal
} from 'react-native';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';
import { api } from '../services/api';
import { connectCourierSocket, disconnectCourierSocket } from '../services/socket';
import MapView, { Marker, Circle } from '../components/MapComponent';
import WalletScreen from './WalletScreen';

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

const VEHICLE_LABELS = {
  walking: { label: 'Piyoda', icon: '🚶' },
  bicycle: { label: 'Velosiped', icon: '🚴' },
  scooter: { label: 'Skuter', icon: '🛵' },
  car: { label: 'Avtomobil', icon: '🚗' },
};

export default function DashboardScreen({ courier, onLogout, onIncomingRequest }) {
  const [isOnline, setIsOnline] = useState(false);
  const [profile, setProfile] = useState(courier);
  const [totalDeliveries, setTotalDeliveries] = useState(0);
  const [toggling, setToggling] = useState(false);
  const [courierLocation, setCourierLocation] = useState(null);
  const locationWatcherRef = useRef(null);
  const mapRef = useRef(null);

  // Wallet screen
  const [showWallet, setShowWallet] = useState(false);

  // History state
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyDeliveries, setHistoryDeliveries] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleOpenHistory = async () => {
    setHistoryVisible(true);
    setLoadingHistory(true);
    try {
      const res = await api.getHistory();
      if (res.success) {
        setHistoryDeliveries(res.deliveries);
      }
    } catch (err) {
      console.warn('Error loading history:', err);
      Alert.alert('Xatolik', err.message || 'Tarixni yuklashda xatolik yuz berdi');
    } finally {
      setLoadingHistory(false);
    }
  };


  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const toggleScaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const recenterMap = () => {
    if (courierLocation && mapRef.current && Platform.OS !== 'web') {
      mapRef.current.animateToRegion({
        latitude: courierLocation.latitude,
        longitude: courierLocation.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      }, 600);
    }
  };

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    
    api.getProfile()
      .then(res => {
        if (res.success) {
          setProfile(res.courier);
          setTotalDeliveries(res.totalDeliveries || 0);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isOnline) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.6, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isOnline]);

  // Location tracking and Socket Connection
  useEffect(() => {
    let active = true;

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Ruxsat berilmadi', 'Ilovadan foydalanish uchun geolokatsiya ruxsatini bering.');
          setIsOnline(false);
          return;
        }

        const initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }).catch(() => Location.getLastKnownPositionAsync());

        if (initialLoc && active) {
          const lat = initialLoc.coords.latitude;
          const lng = initialLoc.coords.longitude;
          setCourierLocation({ latitude: lat, longitude: lng });
          api.updateLocation(lat, lng).catch(() => {});
        }

        locationWatcherRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 8000,
            distanceInterval: 10,
          },
          (newLocation) => {
            if (!active) return;
            const lat = newLocation.coords.latitude;
            const lng = newLocation.coords.longitude;
            setCourierLocation({ latitude: lat, longitude: lng });
            api.updateLocation(lat, lng).catch(() => {});
          }
        );
      } catch (err) {
        console.error('Courier location tracking error:', err);
      }
    };

    if (isOnline && profile?._id) {
      connectCourierSocket(profile._id, {
        onDeliveryRequest: (data) => {
          // Trigger vibration when order arrives
          Vibration.vibrate([0, 500, 200, 500], true);
          onIncomingRequest(data);
        },
      });
      startLocationTracking();
    } else {
      setCourierLocation(null);
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
      disconnectCourierSocket();
    }

    return () => {
      active = false;
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
      disconnectCourierSocket();
    };
  }, [isOnline]);

  const handleToggleOnline = async () => {
    if (!isOnline) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Ruxsat kerak', 'Online bo\'lish uchun joylashuv ruxsatini yoqing.');
        return;
      }
    }

    // Press animation feedback
    Animated.sequence([
      Animated.timing(toggleScaleAnim, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.timing(toggleScaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();

    try {
      setToggling(true);
      const res = await api.toggleOnline(!isOnline);
      if (res.success) {
        setIsOnline(prev => !prev);
        Vibration.vibrate(80);
      }
    } catch (err) {
      Alert.alert('Xatolik', err.message || 'Tarmoqqa ulanishda xatolik yuz berdi');
    } finally {
      setToggling(false);
    }
  };

  const vehicle = VEHICLE_LABELS[profile?.vehicleType] || { label: 'Kurer', icon: '🚴' };
  const defaultCoords = { latitude: 41.311081, longitude: 69.240562 };
  const currentCoords = courierLocation || defaultCoords;

  // Show wallet screen if triggered
  if (showWallet) {
    return <WalletScreen onBack={() => setShowWallet(false)} />;
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* MAP VIEW BACKGROUND */}
      <View style={styles.mapWrapper}>
        {Platform.OS === 'web' ? (
          <View style={styles.webMapPlaceholder}>
            <Feather name="map" size={48} color="#94A3B8" />
            <Text style={styles.webMapText}>Xarita yuklandi (Apple Premium Style)</Text>
            {courierLocation && (
              <Text style={styles.webMapCoords}>
                GPS: {courierLocation.latitude.toFixed(6)}, {courierLocation.longitude.toFixed(6)}
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
            {courierLocation && (
              <>
                <Marker
                  coordinate={{
                    latitude: courierLocation.latitude,
                    longitude: courierLocation.longitude,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={styles.courierPulseOuter}>
                    <Animated.View style={[
                      styles.courierPulseRing,
                      { transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({ inputRange: [1, 1.6], outputRange: [0.6, 0] }) }
                    ]} />
                    <View style={styles.courierPulseInner} />
                  </View>
                </Marker>
                <Circle
                  center={{
                    latitude: courierLocation.latitude,
                    longitude: courierLocation.longitude,
                  }}
                  radius={150}
                  fillColor="rgba(255, 149, 0, 0.06)"
                  strokeColor="rgba(255, 149, 0, 0.18)"
                  strokeWidth={1.5}
                />
              </>
            )}
          </MapView>
        )}

        {/* Offline Overlay - dim map when offline for visual focus */}
        {!isOnline && <View style={styles.offlineOverlay} />}
      </View>

      {/* FLOATING TOP HEADER */}
      <View style={styles.headerFloatingContainer}>
        {/* Left Side: Avatar and Rating */}
        <View style={styles.headerLeftCol}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={onLogout}
            activeOpacity={0.7}
          >
            <Feather name="log-out" size={18} color="#0F172A" />
          </TouchableOpacity>
          
          <View style={styles.headerRatingCard}>
            <Feather name="star" size={12} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.headerRatingText}>{profile?.rating?.toFixed(1) || '5.0'}</Text>
          </View>
        </View>

        {/* Center: Online/Offline Toggle pill */}
        <Animated.View style={{ transform: [{ scale: toggleScaleAnim }] }}>
          <TouchableOpacity
            style={[
              styles.statusTogglePill,
              isOnline ? styles.statusTogglePillOnline : styles.statusTogglePillOffline
            ]}
            onPress={handleToggleOnline}
            disabled={toggling}
            activeOpacity={0.85}
          >
            {toggling ? (
              <ActivityIndicator size="small" color={isOnline ? "#FFFFFF" : "#FF9500"} />
            ) : (
              <>
                <View style={[
                  styles.statusPillDot,
                  { backgroundColor: isOnline ? '#10B981' : '#64748B' }
                ]} />
                <Text style={[
                  styles.statusPillText,
                  isOnline ? styles.statusPillTextOnline : styles.statusPillTextOffline
                ]}>
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Right Side: Balance display */}
        <View style={styles.headerEarningsCard}>
          <Text style={styles.earningsCardLabel}>BALANS</Text>
          <Text style={styles.earningsCardValue}>
            {((profile?.balance || 0)).toLocaleString()} <Text style={styles.earningsCardCurrency}>UZS</Text>
          </Text>
        </View>
      </View>

      {/* FLOATING CONTROLS */}
      <View style={styles.floatingControls}>
        {isOnline && courierLocation && (
          <TouchableOpacity
            style={styles.floatingRecenterBtn}
            onPress={recenterMap}
            activeOpacity={0.7}
          >
            <Feather name="navigation" size={18} color="#FF9500" />
          </TouchableOpacity>
        )}
      </View>

      {/* MAIN BOTTOM SHEET */}
      <View style={styles.mainBottomSheet}>
        <View style={styles.dragHandle} />

        {/* Profile Info Header */}
        <View style={styles.profileRow}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{profile?.name?.[0]?.toUpperCase() || 'K'}</Text>
          </View>
          <View style={styles.profileTextCol}>
            <Text style={styles.profileName}>{profile?.name || 'Kuryer'}</Text>
            <Text style={styles.profilePhone}>{profile?.phone || ''}</Text>
          </View>
          <View style={styles.vehicleBadge}>
            <Text style={styles.vehicleBadgeText}>{vehicle.icon} {vehicle.label}</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.shiftStatsRow}>
          <View style={styles.shiftStatBox}>
            <View style={styles.shiftStatIconBg}>
              <Feather name="package" size={16} color="#FF9500" />
            </View>
            <View>
              <Text style={styles.shiftStatLabel}>Yetkazildi</Text>
              <Text style={styles.shiftStatValue}>{totalDeliveries} ta</Text>
            </View>
          </View>

          <View style={styles.shiftStatDivider} />

          <View style={styles.shiftStatBox}>
            <View style={[styles.shiftStatIconBg, { backgroundColor: 'rgba(34, 197, 94, 0.08)' }]}>
              <Feather name="credit-card" size={16} color="#22C55E" />
            </View>
            <View>
              <Text style={styles.shiftStatLabel}>Balans</Text>
              <Text style={styles.shiftStatValue}>{((profile?.balance || 0)).toLocaleString()} UZS</Text>
            </View>
          </View>
        </View>

        {/* Delivery History Trigger Button */}
        <TouchableOpacity
          style={styles.historyTriggerBtn}
          activeOpacity={0.8}
          onPress={handleOpenHistory}
        >
          <Feather name="clock" size={16} color="#FF9500" style={{ marginRight: 8 }} />
          <Text style={styles.historyTriggerBtnText}>Yetkazmalar tarixi</Text>
          <Feather name="chevron-right" size={16} color="#94A3B8" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* Wallet Button */}
        <TouchableOpacity
          style={[styles.historyTriggerBtn, { borderColor: '#10B981', marginTop: 0 }]}
          activeOpacity={0.8}
          onPress={() => setShowWallet(true)}
        >
          <Feather name="dollar-sign" size={16} color="#10B981" style={{ marginRight: 8 }} />
          <Text style={[styles.historyTriggerBtnText, { color: '#10B981' }]}>💰 Mening Hamyonim</Text>
          <Feather name="chevron-right" size={16} color="#94A3B8" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* Offline hint instruction card */}
        {!isOnline && (
          <View style={styles.hintCard}>
            <View style={styles.hintIconWrap}>
              <Text style={{ fontSize: 18 }}>💡</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hintTitle}>Qanday buyurtma olinadi?</Text>
              <Text style={styles.hintText}>
                Tepadagi "ONLINE" tugmasini bosing va faol holatga o'ting. Restoranga buyurtma kelganda, tizim avtomatik sizni yo'naltiradi.
              </Text>
            </View>
          </View>
        )}

        {/* Online status indicator */}
        {isOnline && (
          <View style={styles.activeHintCard}>
            <View style={styles.greenPulseGlow} />
            <Text style={styles.activeHintText}>
              Buyurtmalar kutilmoqda. Ekraningizni yopmang...
            </Text>
          </View>
        )}
      </View>

      {/* Delivery History Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={historyVisible}
        onRequestClose={() => setHistoryVisible(false)}
      >
        <View style={styles.historyModalContainer}>
          <View style={styles.historyModalContent}>
            <View style={styles.historyModalHeader}>
              <Text style={styles.historyModalTitle}>Yetkazilgan buyurtmalar</Text>
              <TouchableOpacity style={styles.historyModalCloseBtn} onPress={() => setHistoryVisible(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {loadingHistory ? (
              <View style={styles.historyCenter}>
                <ActivityIndicator size="large" color="#FF9500" />
                <Text style={styles.historyLoadingText}>Tarix yuklanmoqda...</Text>
              </View>
            ) : historyDeliveries.length === 0 ? (
              <View style={styles.historyCenter}>
                <Feather name="archive" size={48} color="#CBD5E1" style={{ marginBottom: 12 }} />
                <Text style={styles.historyEmptyText}>Kuryerlik tarixi mavjud emas</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                {historyDeliveries.map((item, idx) => {
                  const d = item.deliveredAt ? new Date(item.deliveredAt) : new Date(item.createdAt);
                  const formattedDate = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                  const orderDetails = item.orderId;

                  return (
                    <View key={idx} style={styles.historyCard}>
                      <View style={styles.historyCardHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyRestaurantName}>
                            {orderDetails?.restaurantId?.name || 'Restoran'}
                          </Text>
                          <Text style={styles.historyCardDate}>{formattedDate}</Text>
                        </View>
                        <View style={[
                          styles.historyStatusBadge,
                          { backgroundColor: item.status === 'completed' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)' }
                        ]}>
                          <Text style={[
                            styles.historyStatusText,
                            { color: item.status === 'completed' ? '#22C55E' : '#EF4444' }
                          ]}>
                            {item.status === 'completed' ? 'Yetkazildi' : 'Bekor qilindi'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.historyAddressRow}>
                        <Feather name="map-pin" size={12} color="#64748B" style={{ marginRight: 6 }} />
                        <Text style={styles.historyAddressText} numberOfLines={1}>
                          {orderDetails?.deliveryAddress?.address || 'Yetkazish manzili yo\'q'}
                        </Text>
                      </View>

                      <View style={styles.historyCardFooter}>
                        <Text style={styles.historyDistanceText}>Masofa: ~{((item.distanceToRestaurant + item.distanceToCustomer) / 1000).toFixed(1)} km</Text>
                        <Text style={styles.historyEarningsText}>
                          {item.earning?.toLocaleString() || 0} UZS
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
    ...StyleSheet.absoluteFillObject,
  },
  webMapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  webMapText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
  webMapCoords: {
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  offlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
  },
  courierPulseOuter: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courierPulseRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 149, 0, 0.4)',
  },
  courierPulseInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF9500',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  // Floating Header
  headerFloatingContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 36,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  headerLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  headerRatingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    height: 42,
    borderRadius: 21,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  headerRatingText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 21,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  statusTogglePillOffline: {
    backgroundColor: '#FFFFFF',
  },
  statusTogglePillOnline: {
    backgroundColor: '#FF9500',
  },
  statusPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  statusPillTextOffline: {
    color: '#0F172A',
  },
  statusPillTextOnline: {
    color: '#FFFFFF',
  },
  headerEarningsCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  earningsCardLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  earningsCardValue: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 1,
  },
  earningsCardCurrency: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '700',
  },

  // Floating Controls
  floatingControls: {
    position: 'absolute',
    bottom: 240,
    right: 14,
    zIndex: 9,
    gap: 10,
  },
  floatingRecenterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },

  // Bottom Sheet
  mainBottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 10,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: '#FFE0B2',
  },
  avatarText: {
    color: '#FF9500',
    fontSize: 20,
    fontWeight: '900',
  },
  profileTextCol: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  profilePhone: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  vehicleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#FFF3E0',
  },
  vehicleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C',
  },

  // Stats Grid
  shiftStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 14,
  },
  shiftStatBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 8,
  },
  shiftStatIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 149, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  shiftStatValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  shiftStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },

  // Hint Cards
  hintCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hintIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  hintText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    lineHeight: 16,
  },

  activeHintCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  greenPulseGlow: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  activeHintText: {
    flex: 1,
    fontSize: 12,
    color: '#15803D',
    fontWeight: '700',
  },
  
  // History UI styles
  historyTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#EEF2FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 2,
    marginBottom: 10,
  },
  historyTriggerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  historyModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  historyModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  historyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  historyModalTitle: {
    fontSize: 18,
    fontWeight: '950',
    color: '#0F172A',
  },
  historyModalCloseBtn: {
    padding: 4,
  },
  historyCenter: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyLoadingText: {
    marginTop: 10,
    color: '#FF9500',
    fontWeight: '700',
    fontSize: 14,
  },
  historyEmptyText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '700',
  },
  historyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#EEF2FF',
    padding: 14,
    marginBottom: 12,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  historyRestaurantName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  historyCardDate: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 2,
  },
  historyStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  historyStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  historyAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  historyAddressText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    flex: 1,
  },
  historyCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyDistanceText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  historyEarningsText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FF9500',
  },
});
