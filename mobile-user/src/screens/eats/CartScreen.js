import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../../services/api';
import * as Location from 'expo-location';

export default function CartScreen({ items, restaurant, onBack, onOrderSuccess }) {
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(41.3113);
  const [lng, setLng] = useState(69.2797);
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' or 'click'
  const [submitting, setSubmitting] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(true);

  useEffect(() => {
    getUserAddress();
  }, []);

  const getUserAddress = async () => {
    try {
      setLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 5000
        }).catch(() => Location.getLastKnownPositionAsync());

        if (loc && loc.coords) {
          setLat(loc.coords.latitude);
          setLng(loc.coords.longitude);

          const reverse = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude
          });

          if (reverse && reverse.length > 0) {
            const first = reverse[0];
            const name = first.street 
              ? `${first.street}${first.name ? ', ' + first.name : ''}` 
              : first.district || first.city || 'Toshkent';
            setAddress(name);
          }
        }
      }
    } catch (err) {
      console.warn('Error fetching location:', err);
    } finally {
      setLoadingLocation(false);
    }
  };

  const getSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const subtotal = getSubtotal();
  const serviceFee = 2000;
  const deliveryFee = 8000;
  const total = subtotal + serviceFee + deliveryFee;

  const handleOrder = async () => {
    if (!address.trim()) {
      Alert.alert('Manzil kiritilmagan', 'Iltimos, yetkazib berish manzilingizni kiriting.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        restaurantId: restaurant._id,
        items,
        deliveryAddress: {
          address,
          lat,
          lng
        },
        subtotal,
        serviceFee,
        deliveryFee,
        total,
        paymentMethod
      };

      const res = await api.createEatsOrder(payload);
      if (res.success && res.order) {
        onOrderSuccess(res.order._id);
      } else {
        Alert.alert('Xatolik', res.message || 'Buyurtma yaratishda xatolik yuz berdi.');
      }
    } catch (err) {
      Alert.alert('Xatolik', err.message || 'Server bilan ulanishda xatolik.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buyurtmani rasmiylashtirish</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Restaurant Card */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Restoran</Text>
          <View style={styles.restaurantRow}>
            <Feather name="shopping-bag" size={18} color="#FF9500" style={{ marginRight: 10 }} />
            <View>
              <Text style={styles.restaurantName}>{restaurant?.name}</Text>
              <Text style={styles.restaurantAddress}>{restaurant?.address}</Text>
            </View>
          </View>
        </View>

        {/* Delivery Address */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Yetkazib berish manzili</Text>
            {loadingLocation && <ActivityIndicator size="small" color="#FF9500" />}
          </View>
          <View style={styles.addressInputRow}>
            <Feather name="map-pin" size={16} color="#64748B" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.addressInput}
              placeholder="Manzilingizni to'liq kiriting..."
              value={address}
              onChangeText={setAddress}
            />
          </View>
        </View>

        {/* Order Items */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Taomlar ro'yxati</Text>
          {items.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <Text style={styles.itemQty}>{item.quantity}x</Text>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.itemPrice}>{(item.price * item.quantity).toLocaleString()} UZS</Text>
            </View>
          ))}
        </View>

        {/* Payment Method */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>To'lov turi</Text>
          
          <TouchableOpacity
            style={[styles.paymentOption, paymentMethod === 'cash' && styles.paymentOptionSelected]}
            onPress={() => setPaymentMethod('cash')}
            activeOpacity={0.8}
          >
            <View style={styles.paymentOptionLeft}>
              <Feather name="dollar-sign" size={18} color={paymentMethod === 'cash' ? '#FF9500' : '#475569'} style={{ marginRight: 10 }} />
              <Text style={[styles.paymentText, paymentMethod === 'cash' && styles.paymentTextSelected]}>Naqd pul orqali</Text>
            </View>
            {paymentMethod === 'cash' && <Feather name="check" size={16} color="#FF9500" />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.paymentOption, styles.paymentOptionDisabled]}
            activeOpacity={1}
          >
            <View style={styles.paymentOptionLeft}>
              <Feather name="credit-card" size={18} color="#94A3B8" style={{ marginRight: 10 }} />
              <Text style={styles.paymentTextDisabled}>Click (Tez kunda)</Text>
            </View>
            <View style={styles.badgeSoon}>
              <Text style={styles.badgeSoonText}>TEZ KUNDA</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Checkout Breakdown */}
        <View style={styles.sectionCard}>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Subtotal</Text>
            <Text style={styles.calcValue}>{subtotal.toLocaleString()} UZS</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Servis to'lovi</Text>
            <Text style={styles.calcValue}>{serviceFee.toLocaleString()} UZS</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Yetkazib berish</Text>
            <Text style={styles.calcValue}>{deliveryFee.toLocaleString()} UZS</Text>
          </View>
          <View style={[styles.calcRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Jami</Text>
            <Text style={styles.totalValue}>{total.toLocaleString()} UZS</Text>
          </View>
        </View>

      </ScrollView>

      {/* Footer Order button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.orderBtn}
          onPress={handleOrder}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.orderBtnText}>Buyurtma berish</Text>
              <Feather name="check-circle" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 30,
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
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1.5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  restaurantName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  restaurantAddress: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  addressInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  addressInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemQty: {
    fontSize: 13,
    color: '#FF9500',
    fontWeight: '800',
    width: 30,
  },
  itemName: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    fontWeight: '700',
  },
  itemPrice: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '800',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    marginBottom: 10,
  },
  paymentOptionSelected: {
    borderColor: '#FF9500',
    backgroundColor: 'rgba(255, 149, 0, 0.02)',
  },
  paymentOptionDisabled: {
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    opacity: 0.6,
  },
  paymentOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  paymentTextSelected: {
    color: '#FF9500',
    fontWeight: '800',
  },
  paymentTextDisabled: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  badgeSoon: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  badgeSoonText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  calcLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  calcValue: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '700',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 10,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FF9500',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  orderBtn: {
    backgroundColor: '#FF9500',
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 35,
  },
  orderBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
