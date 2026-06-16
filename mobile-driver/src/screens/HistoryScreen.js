import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { api } from '../services/api';

export default function HistoryScreen({ onBack }) {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await api.getHistory();
      if (response.success) setRides(response.rides);
    } catch (err) {
      setError(err.message || 'Tarixni yuklashda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'completed': return { bg: 'rgba(0,230,118,0.08)', color: '#00E676', text: 'YAKUNLANDI' };
      case 'cancelled': return { bg: 'rgba(255,23,68,0.08)', color: '#FF1744', text: 'BEKOR QILINDI' };
      default: return { bg: 'rgba(255,214,0,0.08)', color: '#FFD600', text: status?.toUpperCase() };
    }
  };

  const renderRideItem = ({ item, index }) => {
    const statusInfo = getStatusStyle(item.status);
    return (
      <Animated.View style={[styles.rideCard, { opacity: fadeAnim }]}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.dateRow}>
            <Text style={styles.dateIcon}>📅</Text>
            <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
          </View>
          <Text style={styles.cardPrice}>+{item.price?.toLocaleString()} <Text style={styles.priceUnit}>UZS</Text></Text>
        </View>

        {/* Route */}
        <View style={styles.routeContainer}>
          <View style={styles.routeTimeline}>
            <View style={[styles.routeDot, { backgroundColor: '#00E676' }]} />
            <View style={styles.routeLine} />
            <View style={[styles.routeDot, { backgroundColor: '#FF1744' }]} />
          </View>
          <View style={styles.routeTexts}>
            <Text style={styles.routeText} numberOfLines={1}>{item.pickup?.address}</Text>
            <Text style={styles.routeText} numberOfLines={1}>{item.destination?.address}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            <Text style={styles.footerDetail}>📏 {item.distance} km</Text>
            <Text style={styles.footerDetail}>
              👤 {item.userId?.name} {item.userId?.surname}
            </Text>
          </View>
          {item.rating > 0 ? (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingStars}>{'⭐'.repeat(Math.min(item.rating, 5))}</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.text}</Text>
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Sayohatlar tarixi</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FFD600" />
          <Text style={styles.loadingText}>Yuklanmoqda...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchHistory} activeOpacity={0.7}>
            <Text style={styles.retryText}>Qayta yuklash</Text>
          </TouchableOpacity>
        </View>
      ) : rides.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>Hali bajarilgan sayohatlar yo'q</Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item._id}
          renderItem={renderRideItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#EEF2FF',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '700',
  },
  title: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#64748B',
    marginTop: 12,
    fontSize: 13,
  },
  errorIcon: { fontSize: 32, marginBottom: 12 },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
    fontWeight: '600',
  },
  retryBtn: {
    backgroundColor: '#3b32db',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },

  listContainer: { padding: 20 },

  rideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateIcon: { fontSize: 12, marginRight: 6 },
  cardDate: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  cardPrice: {
    color: '#3b32db',
    fontWeight: '800',
    fontSize: 16,
  },
  priceUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },

  routeContainer: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  routeTimeline: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 12,
    paddingVertical: 2,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  routeLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 3,
  },
  routeTexts: {
    flex: 1,
    justifyContent: 'space-between',
  },
  routeText: {
    color: '#1E293B',
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 1,
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingTop: 12,
  },
  footerLeft: {
    flex: 1,
  },
  footerDetail: {
    color: '#64748B',
    fontSize: 11,
    marginVertical: 1,
    fontWeight: '500',
  },
  ratingBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.15)',
  },
  ratingStars: {
    fontSize: 12,
  },
  statusBadge: {
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
