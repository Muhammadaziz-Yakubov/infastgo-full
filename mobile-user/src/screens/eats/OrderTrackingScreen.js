import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Linking,
  Platform,
  Alert,
  Modal,
  TextInput,
  Animated,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { api } from '../../services/api';
import { connectSocket, getSocket } from '../../services/socket';

const { width, height } = Dimensions.get('window');

const STATUS_STEPS = [
  { key: 'new', label: 'Yuborildi', desc: 'Restoran tasdiqlashini kutilmoqda' },
  { key: 'accepted', label: 'Qabul qilindi', desc: 'Restoran buyurtmani qabul qildi' },
  { key: 'preparing', label: 'Tayyorlanmoqda', desc: 'Mazali taomlar pishirilmoqda' },
  { key: 'ready', label: 'Tayyor', desc: 'Kurer yetkazib berishga tayyor' },
  { key: 'picked', label: 'Yo\'lda', desc: 'Kurer buyurtmangizni olib kelmoqda' },
  { key: 'delivered', label: 'Yetkazildi', desc: 'Yoqimli ishtaha!' },
];

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

export default function OrderTrackingScreen({ orderId, userId, onBack }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [courierLocation, setCourierLocation] = useState(null);
  const mapRef = useRef(null);

  // Rating modal state
  const [showRating, setShowRating] = useState(false);
  const [selectedRating, setSelectedRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const ratingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadOrderDetails();

    // Socket listeners setup
    let socket = getSocket();
    if (!socket) {
      socket = connectSocket(userId);
    }

    if (socket) {
      // Join order tracking room
      socket.emit('join', { room: `order_${orderId}` });

      socket.on('order_status_changed', (data) => {
        if (data.orderId === orderId) {
          setOrder(prev => prev ? { ...prev, status: data.status } : null);
          if (data.status === 'delivered') {
            setTimeout(() => triggerRatingModal(), 1500);
          }
        }
      });

      socket.on('courier_tracking', (data) => {
        if (data.coordinates) {
          const loc = {
            latitude: data.coordinates[1],
            longitude: data.coordinates[0],
          };
          setCourierLocation(loc);
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('order_status_changed');
        socket.off('courier_tracking');
      }
    };
  }, [orderId]);

  // Real-time camera auto-fit tracking
  useEffect(() => {
    if (mapRef.current && order) {
      const coordinates = [];

      // Customer
      if (order.deliveryAddress?.lat && order.deliveryAddress?.lng) {
        coordinates.push({
          latitude: order.deliveryAddress.lat,
          longitude: order.deliveryAddress.lng,
        });
      }

      // Restaurant
      if (order.restaurantId?.location?.coordinates) {
        coordinates.push({
          latitude: order.restaurantId.location.coordinates[1],
          longitude: order.restaurantId.location.coordinates[0],
        });
      }

      // Courier
      if (courierLocation) {
        coordinates.push(courierLocation);
      }

      if (coordinates.length > 0 && Platform.OS !== 'web') {
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
          animated: true,
        });
      }
    }
  }, [courierLocation, order]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      const res = await api.trackEatsOrder(orderId);
      if (res.success && res.order) {
        setOrder(res.order);
        if (res.order.courierId && res.order.courierId.location) {
          setCourierLocation({
            latitude: res.order.courierId.location.coordinates[1],
            longitude: res.order.courierId.location.coordinates[0]
          });
        }
        // Auto-show rating if delivered and not yet rated
        if (res.order.status === 'delivered' && !res.order.isRated) {
          setTimeout(() => triggerRatingModal(), 800);
        }
      }
    } catch (err) {
      console.warn('Error fetching track order details:', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerRatingModal = () => {
    setShowRating(true);
    Animated.spring(ratingAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();
  };

  const closeRatingModal = () => {
    Animated.timing(ratingAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setShowRating(false));
  };

  const handleSubmitRating = async () => {
    if (selectedRating === 0) {
      Alert.alert('Baho tanlang', 'Iltimos, yulduz bosing.');
      return;
    }
    try {
      setSubmittingRating(true);
      await api.rateEatsOrder(orderId, selectedRating, ratingComment);
      setOrder(prev => prev ? { ...prev, isRated: true } : null);
      closeRatingModal();
      Alert.alert('Rahmat! 🙏', 'Sizning bahoyingiz qabul qilindi.');
    } catch (err) {
      Alert.alert('Xatolik', err.message || 'Baho yuborishda xatolik.');
    } finally {
      setSubmittingRating(false);
    }
  };

  const getStepIndex = (status) => {
    if (status === 'rejected') return -1;
    return STATUS_STEPS.findIndex(step => step.key === status);
  };

  const stepIndex = order ? getStepIndex(order.status) : 0;

  const handleCallCourier = () => {
    if (order?.courierId?.phone) {
      Linking.openURL(`tel:${order.courierId.phone}`);
    }
  };

  const handleNavigate = () => {
    const lat = order?.deliveryAddress?.lat;
    const lng = order?.deliveryAddress?.lng;
    if (!lat || !lng) return;
    // Yandex Navigator deep link
    const yandexNaviUrl = `yandexnavi://build_route_on_map?lat_to=${lat}&lon_to=${lng}`;
    Linking.canOpenURL(yandexNaviUrl)
      .then(supported => {
        if (supported) {
          return Linking.openURL(yandexNaviUrl);
        } else {
          // Fallback: Yandex Maps web
          return Linking.openURL(`https://yandex.com/maps/?rtext=~${lat},${lng}&rtt=auto`);
        }
      })
      .catch(() => Alert.alert('Xatolik', 'Yandex Navigator ochilmadi.'));
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF9500" />
      </View>
    );
  }

  // Set default initial region for map
  const initialRegion = {
    latitude: order?.deliveryAddress?.lat || 41.3113,
    longitude: order?.deliveryAddress?.lng || 69.2797,
    latitudeDelta: 0.025,
    longitudeDelta: 0.025,
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buyurtmani kuzatish</Text>
        <TouchableOpacity style={styles.backBtn} onPress={loadOrderDetails}>
          <Feather name="refresh-cw" size={16} color="#0F172A" />
        </TouchableOpacity>
      </View>

      {/* Map View */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          customMapStyle={lightMapStyle}
          showsUserLocation={false}
          showsMyLocationButton={false}
        >
          {/* Customer Location Marker */}
          {order?.deliveryAddress && (
            <Marker
              coordinate={{ latitude: order.deliveryAddress.lat, longitude: order.deliveryAddress.lng }}
              title="Sizning manzilingiz"
            >
              <View style={styles.customerMarker}>
                <Feather name="home" size={13} color="#FFFFFF" />
              </View>
            </Marker>
          )}

          {/* Restaurant Location Marker */}
          {order?.restaurantId?.location && (
            <Marker
              coordinate={{
                latitude: order.restaurantId.location.coordinates[1],
                longitude: order.restaurantId.location.coordinates[0],
              }}
              title={order.restaurantId.name}
            >
              <View style={styles.restaurantMarker}>
                <Feather name="shopping-bag" size={13} color="#FFFFFF" />
              </View>
            </Marker>
          )}

          {/* Courier Real-time Location Marker */}
          {courierLocation && (
            <Marker
              coordinate={courierLocation}
              title={order?.courierId?.name || "Kurer"}
            >
              <View style={styles.courierMarker}>
                <Feather
                  name={
                    order?.courierId?.vehicleType === 'car' ? 'truck' :
                    order?.courierId?.vehicleType === 'bicycle' ? 'zap' : 'navigation'
                  }
                  size={13}
                  color="#FFFFFF"
                />
              </View>
            </Marker>
          )}

          {/* Path routing Polyline */}
          {courierLocation && order?.deliveryAddress && (
            <Polyline
              coordinates={[
                courierLocation,
                ...(order.status !== 'picked' && order.restaurantId?.location ? [{
                  latitude: order.restaurantId.location.coordinates[1],
                  longitude: order.restaurantId.location.coordinates[0]
                }] : []),
                { latitude: order.deliveryAddress.lat, longitude: order.deliveryAddress.lng }
              ]}
              strokeColor="#FF9500"
              strokeWidth={3}
              lineDashPattern={[5, 5]}
            />
          )}
        </MapView>
      </View>

      {/* Bottom Info Sheet */}
      <View style={styles.infoSheet}>
        {order?.status === 'rejected' ? (
          <View style={styles.rejectedContainer}>
            <Feather name="alert-triangle" size={24} color="#EF4444" />
            <Text style={styles.rejectedTitle}>Buyurtma rad etildi</Text>
            <Text style={styles.rejectedDesc}>{order.rejectionReason || "Siz kiritgan mahsulotlar hozirda mavjud emas."}</Text>
          </View>
        ) : (
          <View style={styles.statusContainer}>
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusLabel}>Buyurtma holati</Text>
              <Text style={styles.statusTitle}>
                {STATUS_STEPS[stepIndex]?.label || "Noma'lum"}
              </Text>
              <Text style={styles.statusDesc}>
                {STATUS_STEPS[stepIndex]?.desc}
              </Text>
            </View>

            {/* Custom Step indicator */}
            <View style={styles.progressContainer}>
              {STATUS_STEPS.map((step, idx) => (
                <View key={idx} style={styles.progressStepWrapper}>
                  <View
                    style={[
                      styles.progressDot,
                      idx <= stepIndex && styles.progressDotActive,
                      idx === stepIndex && styles.progressDotCurrent
                    ]}
                  />
                  {idx < STATUS_STEPS.length - 1 && (
                    <View
                      style={[
                        styles.progressLine,
                        idx < stepIndex && styles.progressLineActive
                      ]}
                    />
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Premium Order Summary Details */}
        {order && (
          <View style={styles.orderSummaryCard}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.orderSummaryTitle} numberOfLines={1}>
                {order.restaurantId?.name || 'Restoran'}
              </Text>
              <Text style={styles.orderSummarySub} numberOfLines={1}>
                {order.items?.map(it => `${it.name} (${it.quantity}x)`).join(', ')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.orderSummaryTotal}>{order.total?.toLocaleString()} UZS</Text>
              <Text style={styles.orderSummaryPayment}>{order.paymentMethod === 'cash' ? '💵 Naqd pul' : '💳 Click'}</Text>
            </View>
          </View>
        )}

        {/* Courier Section (Only show if courierId is assigned) */}
        {order?.courierId ? (
          <View style={styles.courierCard}>
            <View style={styles.courierInfo}>
              <View style={styles.courierAvatar}>
                <Text style={styles.avatarText}>
                  {order.courierId.name[0].toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.courierName}>{order.courierId.name}</Text>
                <Text style={styles.courierVehicle}>
                  {order.courierId.vehicleType === 'walking' && '🚶‍♂️ Piyoda'}
                  {order.courierId.vehicleType === 'bicycle' && '🚴‍♂️ Velosiped'}
                  {order.courierId.vehicleType === 'scooter' && '🛵 Skuter'}
                  {order.courierId.vehicleType === 'car' && '🚗 Avtomobil'}
                  {` • ⭐ ${order.courierId.rating || '5.0'}`}
                </Text>
              </View>
            </View>
            <View style={styles.courierActions}>
              <TouchableOpacity style={styles.navBtn} onPress={handleNavigate}>
                <Feather name="navigation" size={16} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.callBtn} onPress={handleCallCourier}>
                <Feather name="phone" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          order?.status !== 'rejected' && (
            <View style={styles.searchingCourierContainer}>
              <ActivityIndicator size="small" color="#FF9500" style={{ marginRight: 10 }} />
              <Text style={styles.searchingCourierText}>Kurer qidirilmoqda...</Text>
            </View>
          )
        )}
      </View>

      {/* ⭐ Rating Modal */}
      <Modal
        visible={showRating}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeRatingModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.ratingSheet,
              {
                opacity: ratingAnim,
                transform: [{
                  translateY: ratingAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [80, 0],
                  })
                }]
              }
            ]}
          >
            {/* Handle */}
            <View style={styles.ratingHandle} />

            {/* Emoji */}
            <Text style={styles.ratingEmoji}>🍽️</Text>
            <Text style={styles.ratingTitle}>Buyurtmangiz qanday bo'ldi?</Text>
            <Text style={styles.ratingSubtitle}>
              {order?.restaurantId?.name || 'Restoran'} dan buyurtma
            </Text>

            {/* Stars */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setSelectedRating(star)}
                  activeOpacity={0.7}
                  style={styles.starBtn}
                >
                  <Text style={[
                    styles.starIcon,
                    star <= selectedRating && styles.starIconActive
                  ]}>
                    {star <= selectedRating ? '★' : '☆'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Rating label */}
            <Text style={styles.ratingLabel}>
              {selectedRating === 0 && 'Yulduz bosing'}
              {selectedRating === 1 && '😞 Juda yomon'}
              {selectedRating === 2 && '😕 Yomon'}
              {selectedRating === 3 && '😐 O\'rtacha'}
              {selectedRating === 4 && '😊 Yaxshi'}
              {selectedRating === 5 && '🤩 Ajoyib!'}
            </Text>

            {/* Comment */}
            <TextInput
              style={styles.ratingInput}
              placeholder="Izoh qoldiring (ixtiyoriy)..."
              placeholderTextColor="#94A3B8"
              value={ratingComment}
              onChangeText={setRatingComment}
              multiline
              maxLength={200}
            />

            {/* Buttons */}
            <TouchableOpacity
              style={[
                styles.submitRatingBtn,
                selectedRating === 0 && styles.submitRatingBtnDisabled
              ]}
              onPress={handleSubmitRating}
              disabled={submittingRating || selectedRating === 0}
              activeOpacity={0.85}
            >
              {submittingRating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitRatingBtnText}>Yuborish</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={closeRatingModal} style={styles.skipBtn}>
              <Text style={styles.skipBtnText}>Keyinroq</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  
  // Custom styled map markers
  restaurantMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF9500',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  customerMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b32db',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  courierMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0EA5E9',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },

  infoSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
  },
  statusContainer: {
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  statusDesc: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingHorizontal: 6,
  },
  progressStepWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
    zIndex: 2,
  },
  progressDotActive: {
    backgroundColor: '#FF9500',
  },
  progressDotCurrent: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.3 }],
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 3,
  },
  progressLine: {
    height: 3,
    backgroundColor: '#E2E8F0',
    flex: 1,
    marginHorizontal: -2,
    zIndex: 1,
  },
  progressLineActive: {
    backgroundColor: '#FF9500',
  },

  // Summary Card style
  orderSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#EEF2FF',
    padding: 12,
    marginBottom: 12,
  },
  orderSummaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  orderSummarySub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  orderSummaryTotal: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FF9500',
  },
  orderSummaryPayment: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    marginTop: 2,
  },

  courierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEF2FF',
  },
  courierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  courierAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF9500',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  courierName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  courierVehicle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  courierActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF2D2D',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF2D2D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  searchingCourierContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  searchingCourierText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D97706',
  },
  rejectedContainer: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 16,
  },
  rejectedTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#EF4444',
    marginTop: 8,
  },
  rejectedDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },

  // ⭐ Rating Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  ratingSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 44 : 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 20,
  },
  ratingHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 24,
  },
  ratingEmoji: {
    fontSize: 52,
    marginBottom: 12,
  },
  ratingTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  ratingSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 28,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  starBtn: {
    padding: 4,
  },
  starIcon: {
    fontSize: 42,
    color: '#E2E8F0',
  },
  starIconActive: {
    color: '#FF9500',
  },
  ratingLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 20,
    height: 22,
  },
  ratingInput: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  submitRatingBtn: {
    width: '100%',
    backgroundColor: '#FF9500',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 12,
  },
  submitRatingBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitRatingBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  skipBtn: {
    paddingVertical: 8,
  },
  skipBtnText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '700',
  },
});

