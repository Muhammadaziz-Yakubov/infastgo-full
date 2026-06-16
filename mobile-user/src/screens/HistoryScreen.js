import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  StatusBar,
  Modal,
  ScrollView,
} from 'react-native';
import { api } from '../services/api';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const EATS_STATUS_MAP = {
  new: { label: 'Yuborildi', color: '#D97706', bg: '#FEF3C7' },
  pending: { label: 'Kutilmoqda', color: '#D97706', bg: '#FEF3C7' },
  accepted: { label: 'Qabul qilindi', color: '#2563EB', bg: '#DBEAFE' },
  preparing: { label: 'Tayyorlanmoqda', color: '#4F46E5', bg: '#EEF2FF' },
  ready: { label: 'Tayyor', color: '#10B981', bg: '#D1FAE5' },
  picked: { label: 'Kurer yo‘lda', color: '#06B6D4', bg: '#CFFAFE' },
  delivered: { label: 'Yetkazildi', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  rejected: { label: 'Rad etildi', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  cancelled: { label: 'Bekor qilindi', color: '#64748B', bg: '#F1F5F9' }
};

export default function HistoryScreen({ onBack, onViewHome, onViewProfile, onTrackEatsOrder }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('rides'); // 'rides' or 'eats'
  const [rides, setRides] = useState([]);
  const [eatsOrders, setEatsOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Detailed Receipt Modal state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchRidesHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getHistory();
      if (response.success) {
        setRides(response.rides);
      }
    } catch (err) {
      setError(err.message || 'Tarixni yuklashda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const fetchEatsHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getEatsHistory();
      if (response.success) {
        setEatsOrders(response.orders);
      }
    } catch (err) {
      setError(err.message || 'Eats buyurtmalar tarixini yuklashda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'rides') {
      fetchRidesHistory();
    } else {
      fetchEatsHistory();
    }
  }, [activeTab]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const handleOrderClick = (item) => {
    const activeStatuses = ['new', 'pending', 'accepted', 'preparing', 'ready', 'picked'];
    if (activeStatuses.includes(item.status)) {
      if (onTrackEatsOrder) {
        onTrackEatsOrder(item._id);
      }
    } else {
      setSelectedOrder(item);
      setModalVisible(true);
    }
  };

  const renderRideItem = ({ item }) => (
    <View style={styles.rideCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
        <Text style={styles.cardPrice}>{item.price?.toLocaleString()} UZS</Text>
      </View>

      <View style={styles.routeContainer}>
        <View style={styles.routeRow}>
          <Feather name="circle" size={12} color="#10B981" style={styles.routeIcon} />
          <Text style={styles.routeText} numberOfLines={2}>{item.pickup?.address}</Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routeRow}>
          <Feather name="map-pin" size={12} color="#EF4444" style={styles.routeIcon} />
          <Text style={styles.routeText} numberOfLines={2}>{item.destination?.address}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.footerDetail}>Masofa: {item.distance} km</Text>
        {item.driverId ? (
          <Text style={styles.footerDetail}>
            Haydovchi: {item.driverId.name} ({item.driverId.carInfo?.model})
          </Text>
        ) : (
          <Text style={styles.footerDetail}>Haydovchi tayinlanmagan</Text>
        )}
      </View>

      {item.rating > 0 ? (
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingText}>Siz bergan baho: {'⭐️'.repeat(item.rating)}</Text>
        </View>
      ) : item.status === 'completed' ? (
        <View style={styles.ratingContainer}>
          <Text style={styles.noRatingText}>Baholanmagan</Text>
        </View>
      ) : (
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'cancelled' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)' }]}>
          <Text style={{ color: item.status === 'cancelled' ? '#EF4444' : '#10B981', fontSize: 12, fontWeight: 'bold' }}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );

  const renderEatsItem = ({ item }) => {
    const statusInfo = EATS_STATUS_MAP[item.status] || { label: item.status, color: '#000000', bg: '#F1F5F9' };
    const activeStatuses = ['new', 'pending', 'accepted', 'preparing', 'ready', 'picked'];
    const isActive = activeStatuses.includes(item.status);

    const itemsSummary = item.items?.map(it => `${it.name} (${it.quantity}x)`).join(', ');

    return (
      <TouchableOpacity
        style={styles.eatsCard}
        activeOpacity={0.8}
        onPress={() => handleOrderClick(item)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.restaurantNameText} numberOfLines={1}>{item.restaurantId?.name || 'Restoran'}</Text>
            <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
          </View>
          <View style={[styles.eatsBadge, { backgroundColor: statusInfo.bg }]}>
            <Text style={[styles.eatsBadgeText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
        </View>

        <Text style={styles.eatsItemsText} numberOfLines={2}>
          {itemsSummary || 'Mahsulotlar mavjud emas'}
        </Text>

        <View style={styles.eatsFooter}>
          <Text style={styles.cardPrice}>{item.total?.toLocaleString()} UZS</Text>
          {isActive ? (
            <View style={styles.trackPill}>
              <Text style={styles.trackPillText}>Kuzatish</Text>
              <Feather name="chevron-right" size={14} color="#FF9500" />
            </View>
          ) : (
            <Text style={styles.eatsDetailsText}>Chekni ko'rish</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const currentList = activeTab === 'rides' ? rides : eatsOrders;
  const currentRenderItem = activeTab === 'rides' ? renderRideItem : renderEatsItem;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 8) }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.6}>
          <Feather name="arrow-left" size={20} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buyurtmalar tarixi</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Premium Segment Control */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'rides' && styles.segmentBtnActive]}
          onPress={() => setActiveTab('rides')}
          activeOpacity={0.9}
        >
          <Feather name="navigation" size={14} color={activeTab === 'rides' ? '#FFFFFF' : '#64748B'} style={{ marginRight: 6 }} />
          <Text style={[styles.segmentBtnText, activeTab === 'rides' && styles.segmentBtnTextActive]}>Sayohatlar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, activeTab === 'eats' && styles.segmentBtnActive]}
          onPress={() => setActiveTab('eats')}
          activeOpacity={0.9}
        >
          <Feather name="shopping-bag" size={14} color={activeTab === 'eats' ? '#FFFFFF' : '#64748B'} style={{ marginRight: 6 }} />
          <Text style={[styles.segmentBtnText, activeTab === 'eats' && styles.segmentBtnTextActive]}>InFast Eats</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b32db" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={activeTab === 'rides' ? fetchRidesHistory : fetchEatsHistory} activeOpacity={0.8}>
            <Text style={styles.retryText}>Qayta yuklash</Text>
          </TouchableOpacity>
        </View>
      ) : currentList.length === 0 ? (
        <View style={styles.center}>
          <Feather name="archive" size={48} color="#CBD5E1" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyText}>Tarix mavjud emas</Text>
        </View>
      ) : (
        <FlatList
          data={currentList}
          keyExtractor={(item) => item._id}
          renderItem={currentRenderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Bottom Tab Navigation Bar */}
      <View style={[styles.bottomTabBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={styles.tabItem} onPress={onViewHome} activeOpacity={0.8}>
          <View style={styles.inactiveTabIcon}>
            <Feather name="home" size={20} color="#64748B" />
          </View>
          <Text style={styles.inactiveTabLabel}>Bosh sahifa</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} activeOpacity={0.8}>
          <View style={styles.activeTabPill}>
            <Feather name="clock" size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.activeTabLabel}>Buyurtmalar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={onViewProfile} activeOpacity={0.8}>
          <View style={styles.inactiveTabIcon}>
            <Feather name="user" size={20} color="#64748B" />
          </View>
          <Text style={styles.inactiveTabLabel}>Profil</Text>
        </TouchableOpacity>
      </View>

      {/* Detailed Eats Order Modal */}
      {selectedOrder && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Buyurtma tafsiloti</Text>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
                  <Feather name="x" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                {/* Status card */}
                <View style={styles.modalStatusCard}>
                  <View style={[styles.eatsBadge, { alignSelf: 'flex-start', backgroundColor: EATS_STATUS_MAP[selectedOrder.status]?.bg || '#F1F5F9' }]}>
                    <Text style={[styles.eatsBadgeText, { color: EATS_STATUS_MAP[selectedOrder.status]?.color || '#0F172A', fontSize: 13 }]}>
                      {EATS_STATUS_MAP[selectedOrder.status]?.label}
                    </Text>
                  </View>
                  <Text style={styles.modalDateText}>{formatDate(selectedOrder.createdAt)}</Text>
                  {selectedOrder.status === 'rejected' && selectedOrder.rejectionReason && (
                    <Text style={styles.rejectionReasonText}>
                      Rad etilish sababi: "{selectedOrder.rejectionReason}"
                    </Text>
                  )}
                </View>

                {/* Restoran information */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Restoran</Text>
                  <Text style={styles.modalRestaurantName}>{selectedOrder.restaurantId?.name || 'Noma\'lum Restoran'}</Text>
                  <Text style={styles.modalRestaurantAddress}>{selectedOrder.restaurantId?.address || ''}</Text>
                </View>

                {/* Items list */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Buyurtma tarkibi</Text>
                  {selectedOrder.items?.map((item, idx) => (
                    <View key={idx} style={styles.modalItemRow}>
                      <Text style={styles.modalItemQty}>{item.quantity}x</Text>
                      <Text style={styles.modalItemName}>{item.name}</Text>
                      <Text style={styles.modalItemPrice}>{(item.price * item.quantity).toLocaleString()} UZS</Text>
                    </View>
                  ))}
                </View>

                {/* Payment breakdown */}
                <View style={styles.modalSection}>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Subtotal</Text>
                    <Text style={styles.modalValue}>{selectedOrder.subtotal?.toLocaleString()} UZS</Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Yetkazib berish</Text>
                    <Text style={styles.modalValue}>{selectedOrder.deliveryFee?.toLocaleString()} UZS</Text>
                  </View>
                  <View style={[styles.modalRow, { borderTopWidth: 1, borderColor: '#F1F5F9', paddingTop: 10, marginTop: 6 }]}>
                    <Text style={[styles.modalLabel, { fontWeight: '800', color: '#0F172A' }]}>Jami</Text>
                    <Text style={[styles.modalValue, { fontWeight: '900', color: '#FF9500', fontSize: 16 }]}>
                      {selectedOrder.total?.toLocaleString()} UZS
                    </Text>
                  </View>
                </View>

                {/* Delivery details */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Yetkazib berish manzili</Text>
                  <Text style={styles.modalAddressText}>{selectedOrder.deliveryAddress?.address}</Text>
                  <Text style={styles.modalSubtext}>To'lov turi: {selectedOrder.paymentMethod === 'cash' ? 'Naqd pul' : 'Click'}</Text>
                </View>

                {/* Courier Details */}
                {selectedOrder.courierId && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Kuryer ma'lumotlari</Text>
                    <View style={styles.courierRow}>
                      <View style={styles.courierAvatar}>
                        <Text style={styles.courierAvatarText}>
                          {selectedOrder.courierId.name?.[0]?.toUpperCase() || 'K'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.courierName}>{selectedOrder.courierId.name}</Text>
                        <Text style={styles.courierVehicle}>
                          {selectedOrder.courierId.vehicleType === 'walking' && '🚶‍♂️ Piyoda'}
                          {selectedOrder.courierId.vehicleType === 'bicycle' && '🚴‍♂️ Velosiped'}
                          {selectedOrder.courierId.vehicleType === 'scooter' && '🛵 Skuter'}
                          {selectedOrder.courierId.vehicleType === 'car' && '🚗 Avtomobil'}
                          {` • ⭐ ${selectedOrder.courierId.rating || '5.0'}`}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#EEF0F8',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 15,
    fontWeight: '600',
  },
  retryBtn: {
    backgroundColor: '#3b32db',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '500',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  
  // Segment Controller
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 4,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#3b32db',
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
  },

  // Ride history card
  rideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEF0F8',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardDate: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
  },
  cardPrice: {
    color: '#3b32db',
    fontWeight: '800',
    fontSize: 15,
  },
  routeContainer: {
    marginVertical: 12,
    paddingLeft: 4,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeIcon: {
    marginRight: 10,
  },
  routeText: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  routeLine: {
    width: 2,
    height: 12,
    backgroundColor: '#E2E8F0',
    marginLeft: 5,
    marginVertical: 3,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 12,
  },
  footerDetail: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
  ratingContainer: {
    marginTop: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.1)',
  },
  ratingText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '700',
  },
  noRatingText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  statusBadge: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 10,
  },

  // Eats history card styling
  eatsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEF0F8',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  restaurantNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  eatsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eatsBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  eatsItemsText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    lineHeight: 18,
  },
  eatsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 12,
    paddingTop: 10,
  },
  eatsDetailsText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  trackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 149, 0, 0.08)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  trackPillText: {
    color: '#FF9500',
    fontSize: 12,
    fontWeight: '800',
  },

  // Bottom Navigation Bar
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#EEF0F8',
    paddingTop: 10,
    paddingBottom: 12,
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
  },
  tabItem: {
    alignItems: 'center',
    flex: 1,
  },
  activeTabPill: {
    backgroundColor: '#3b32db',
    width: 58,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  inactiveTabIcon: {
    width: 58,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  activeTabLabel: {
    color: '#3b32db',
    fontSize: 12,
    fontWeight: '700',
  },
  inactiveTabLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },

  // Modal styling
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '950',
    color: '#0F172A',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalStatusCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalDateText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 6,
  },
  rejectionReasonText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
    marginTop: 6,
  },
  modalSection: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    paddingBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  modalRestaurantName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalRestaurantAddress: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  modalItemQty: {
    fontSize: 13,
    color: '#3b32db',
    fontWeight: '800',
    width: 28,
  },
  modalItemName: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    fontWeight: '700',
  },
  modalItemPrice: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '800',
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  modalLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  modalValue: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '700',
  },
  modalAddressText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    lineHeight: 18,
  },
  modalSubtext: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 4,
  },
  courierRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  courierAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  courierAvatarText: {
    color: '#0284C7',
    fontSize: 16,
    fontWeight: '800',
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
    marginTop: 1,
  },
});

