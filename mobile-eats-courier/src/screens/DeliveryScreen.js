import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Linking,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import MapView, { Marker } from '../components/MapComponent';
import { api } from '../services/api';

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

const { width } = Dimensions.get('window');

function haversineMeters(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  const R = 6371000;
  const toR = (v) => (v * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLng = toR(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDist(m) {
  if (m === null || m === undefined) return '—';
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

const STEPS = [
  { key: 'to_restaurant', label: 'Restoranga', icon: 'shopping-bag' },
  { key: 'at_restaurant', label: 'Olib chiq', icon: 'package' },
  { key: 'to_customer', label: 'Mijozga', icon: 'map-pin' },
];

export default function DeliveryScreen({ order, onComplete }) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('to_restaurant');

  const restaurantCoords = {
    latitude: order?.restaurantId?.location?.coordinates?.[1] || 41.3113,
    longitude: order?.restaurantId?.location?.coordinates?.[0] || 69.2797,
  };

  const deliveryCoords = {
    latitude: order?.deliveryAddress?.lat || 41.3200,
    longitude: order?.deliveryAddress?.lng || 69.2900,
  };

  const midLat = (restaurantCoords.latitude + deliveryCoords.latitude) / 2;
  const midLng = (restaurantCoords.longitude + deliveryCoords.longitude) / 2;
  const latDelta = Math.max(
    Math.abs(restaurantCoords.latitude - deliveryCoords.latitude) * 2.5,
    0.015
  );
  const lngDelta = Math.max(
    Math.abs(restaurantCoords.longitude - deliveryCoords.longitude) * 2.5,
    0.015
  );

  const initialRegion = {
    latitude: midLat,
    longitude: midLng,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };

  const distToCustomer = haversineMeters(
    restaurantCoords.latitude,
    restaurantCoords.longitude,
    deliveryCoords.latitude,
    deliveryCoords.longitude
  );

  const handleNextStep = async () => {
    if (step === 'to_restaurant') {
      setStep('at_restaurant');
    } else if (step === 'at_restaurant') {
      try {
        setLoading(true);
        const res = await api.updateOrderStatus(order._id, 'picked');
        if (res.success) {
          setStep('to_customer');
        }
      } catch (err) {
        Alert.alert('Xatolik', err.message || 'Statusni yangilashda xatolik');
      } finally {
        setLoading(false);
      }
    } else if (step === 'to_customer') {
      try {
        setLoading(true);
        const res = await api.completeDelivery(order._id);
        if (res.success) {
          Alert.alert(
            '✅ Bajarildi!',
            `Buyurtma muvaffaqiyatli yetkazib berildi!\nDaromad: ${order?.deliveryFee?.toLocaleString() || 0} UZS`,
            [{ text: 'Davom etish', onPress: onComplete }]
          );
        }
      } catch (err) {
        Alert.alert('Xatolik', err.message || 'Yakunlashda xatolik');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCallRestaurant = () => {
    if (order?.restaurantId?.phone) {
      Linking.openURL(`tel:${order.restaurantId.phone}`);
    }
  };

  const handleCallCustomer = () => {
    if (order?.userId?.phone) {
      Linking.openURL(`tel:${order.userId.phone}`);
    }
  };

  const handleOpenMaps = () => {
    const target = step === 'to_customer' ? deliveryCoords : restaurantCoords;
    const label =
      step === 'to_customer'
        ? 'Mijoz manzili'
        : order?.restaurantId?.name || 'Restoran';
    const url =
      Platform.OS === 'ios'
        ? `maps://?daddr=${target.latitude},${target.longitude}`
        : `google.navigation:q=${target.latitude},${target.longitude}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${target.latitude},${target.longitude}`
      );
    });
  };

  const currentStepIdx = STEPS.findIndex((s) => s.key === step);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBadge}>
            <Text style={{ fontSize: 16 }}>⚡</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Faol Yetkazish</Text>
            <Text style={styles.orderId}>#{order?._id?.slice(-6).toUpperCase()}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.navBtn} onPress={handleOpenMaps}>
          <Feather name="navigation" size={16} color="#FF9500" />
          <Text style={styles.navBtnText}>Navigatsiya</Text>
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          style={StyleSheet.absoluteFillObject}
          initialRegion={initialRegion}
          showsUserLocation={true}
          showsMyLocationButton={false}
          customMapStyle={lightMapStyle}
        >
          {/* Restaurant Marker */}
          <Marker
            coordinate={restaurantCoords}
            title={order?.restaurantId?.name || 'Restoran'}
            description={order?.restaurantId?.address}
          >
            <View style={styles.markerOrange}>
              <Text style={{ fontSize: 18 }}>🏪</Text>
            </View>
          </Marker>

          {/* Customer Marker */}
          <Marker
            coordinate={deliveryCoords}
            title={order?.userId?.name || 'Mijoz'}
            description={order?.deliveryAddress?.address}
          >
            <View style={styles.markerBlue}>
              <Text style={{ fontSize: 18 }}>📍</Text>
            </View>
          </Marker>
        </MapView>

        {/* Distance overlay on map */}
        <View style={styles.distOverlay}>
          <View style={styles.distItem}>
            <Text style={styles.distItemIcon}>🏪</Text>
            <View>
              <Text style={styles.distItemLabel}>Restorangacha</Text>
              <Text style={styles.distItemVal}>—</Text>
            </View>
          </View>
          <Feather name="arrow-right" size={12} color="#94A3B8" style={{ marginHorizontal: 6 }} />
          <View style={styles.distItem}>
            <Text style={styles.distItemIcon}>📍</Text>
            <View>
              <Text style={styles.distItemLabel}>Mijozgacha</Text>
              <Text style={[styles.distItemVal, { color: '#3B5BDB' }]}>
                {formatDist(distToCustomer)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        {/* Step Indicator */}
        <View style={styles.stepsRow}>
          {STEPS.map((s, idx) => {
            const isDone = idx < currentStepIdx;
            const isActive = idx === currentStepIdx;
            return (
              <React.Fragment key={s.key}>
                <View style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepCircle,
                      isDone && styles.stepCircleDone,
                      isActive && styles.stepCircleActive,
                    ]}
                  >
                    {isDone ? (
                      <Feather name="check" size={12} color="#FFFFFF" />
                    ) : (
                      <Feather
                        name={s.icon}
                        size={12}
                        color={isActive ? '#FFFFFF' : '#94A3B8'}
                      />
                    )}
                  </View>
                  <Text
                    style={[styles.stepLabel, isActive && styles.stepLabelActive]}
                  >
                    {s.label}
                  </Text>
                </View>
                {idx < STEPS.length - 1 && (
                  <View
                    style={[
                      styles.stepLine,
                      isDone && styles.stepLineDone,
                    ]}
                  />
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* Info Card */}
        {step === 'to_restaurant' || step === 'at_restaurant' ? (
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <View style={[styles.iconBox, { backgroundColor: '#FFF3E0' }]}>
                <Feather name="shopping-bag" size={18} color="#FF9500" />
              </View>
              <View style={styles.infoCardText}>
                <Text style={styles.infoCardTitle}>
                  {order?.restaurantId?.name || 'Restoran'}
                </Text>
                <Text style={styles.infoCardSub} numberOfLines={1}>
                  {order?.restaurantId?.address || 'Manzil yo\'q'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.callBtn, { backgroundColor: '#FF9500' }]}
                onPress={handleCallRestaurant}
              >
                <Feather name="phone" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.itemsList}>
              <Text style={styles.itemsTitle}>Olinadigan mahsulotlar:</Text>
              {order?.items?.slice(0, 4).map((item, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <View style={styles.itemDot} />
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQty}>×{item.quantity}</Text>
                </View>
              ))}
              {(order?.items?.length || 0) > 4 && (
                <Text style={styles.moreItems}>
                  +{order.items.length - 4} ta ko'proq
                </Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <View style={[styles.iconBox, { backgroundColor: '#EEF2FF' }]}>
                <Feather name="user" size={18} color="#3B5BDB" />
              </View>
              <View style={styles.infoCardText}>
                <Text style={styles.infoCardTitle}>
                  {order?.userId?.name || 'Mijoz'}
                </Text>
                <Text style={styles.infoCardSub} numberOfLines={2}>
                  {order?.deliveryAddress?.address || 'Manzil yo\'q'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.callBtn, { backgroundColor: '#3B5BDB' }]}
                onPress={handleCallCustomer}
              >
                <Feather name="phone" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.payRow}>
              <View style={styles.payItem}>
                <Text style={styles.payLabel}>To'lov</Text>
                <Text style={styles.payVal}>
                  {order?.paymentMethod === 'cash' ? '💵 Naqd' : '💳 Click'}
                </Text>
              </View>
              <View style={styles.payDivider} />
              <View style={styles.payItem}>
                <Text style={styles.payLabel}>Summa</Text>
                <Text style={[styles.payVal, { color: '#FF9500' }]}>
                  {order?.total?.toLocaleString()} UZS
                </Text>
              </View>
              <View style={styles.payDivider} />
              <View style={styles.payItem}>
                <Text style={styles.payLabel}>Masofa</Text>
                <Text style={[styles.payVal, { color: '#3B5BDB' }]}>
                  {formatDist(distToCustomer)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Button */}
        <TouchableOpacity
          style={[
            styles.actionBtn,
            step === 'to_customer' && styles.actionBtnGreen,
            loading && { opacity: 0.7 },
          ]}
          onPress={handleNextStep}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.actionBtnText}>
                {step === 'to_restaurant' && 'Restorange etib keldim'}
                {step === 'at_restaurant' && 'Buyurtmani oldim ✓'}
                {step === 'to_customer' && 'Mijozga topshirdim ✓'}
              </Text>
              <Feather name="arrow-right" size={18} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'android' ? 12 : 4,
    paddingBottom: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FF9500',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  orderId: { fontSize: 12, color: '#FF9500', fontWeight: '700', marginTop: 1 },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  navBtnText: { fontSize: 12, fontWeight: '800', color: '#FF9500' },

  mapContainer: { flex: 1 },

  markerOrange: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 7,
    borderWidth: 2,
    borderColor: '#FF9500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  markerBlue: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 7,
    borderWidth: 2,
    borderColor: '#3B5BDB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },

  distOverlay: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  distItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  distItemIcon: { fontSize: 18 },
  distItemLabel: { fontSize: 9, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase' },
  distItemVal: { fontSize: 13, fontWeight: '900', color: '#FF9500' },

  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 18,
    paddingBottom: Platform.OS === 'ios' ? 34 : 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },

  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  stepItem: { alignItems: 'center' },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: { backgroundColor: '#10B981' },
  stepCircleActive: { backgroundColor: '#FF9500' },
  stepLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  stepLabelActive: { color: '#FF9500', fontWeight: '800' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#E2E8F0', marginBottom: 14 },
  stepLineDone: { backgroundColor: '#10B981' },

  infoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  infoCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCardText: { flex: 1 },
  infoCardTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  infoCardSub: { fontSize: 12, color: '#64748B', fontWeight: '500', marginTop: 2 },
  callBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  itemsList: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  itemsTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  itemDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FF9500' },
  itemName: { flex: 1, fontSize: 13, color: '#334155', fontWeight: '600' },
  itemQty: { fontSize: 12, color: '#94A3B8', fontWeight: '700' },
  moreItems: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },

  payRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  payItem: { flex: 1, alignItems: 'center' },
  payLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  payVal: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 4, textAlign: 'center' },
  payDivider: { width: 1, backgroundColor: '#E2E8F0' },

  actionBtn: {
    backgroundColor: '#FF9500',
    borderRadius: 16,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  actionBtnGreen: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
