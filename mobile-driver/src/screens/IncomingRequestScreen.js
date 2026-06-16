import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { api } from '../services/api';
import { Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function IncomingRequestScreen({ request, onAccepted, onRejected }) {
  const [timeLeft, setTimeLeft] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Animations
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // Subtle pulsing border/glow effect for card
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.015, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (timeLeft === 0) { handleReject(); return; }
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleAccept = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.acceptRide(request.rideId);
      if (response.success) {
        onAccepted(response.ride);
      } else {
        setError(response.message || 'Buyurtmani qabul qilib bo\'lmadi');
      }
    } catch (err) {
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await api.rejectRide(request.rideId);
      onRejected();
    } catch (err) {
      console.log('Error rejecting ride:', err.message);
      onRejected();
    } finally {
      setLoading(false);
    }
  };

  const timerColor = timeLeft > 15 ? '#00E676' : timeLeft > 7 ? '#FFD600' : '#FF1744';
  const timerGlowColor = timeLeft > 15 ? 'rgba(0, 230, 118, 0.15)' : timeLeft > 7 ? 'rgba(255, 214, 0, 0.15)' : 'rgba(255, 23, 68, 0.15)';

  return (
    <View style={styles.overlay}>
      {/* Background neon glows with pulsing animation */}
      <Animated.View style={[styles.glowCircle, styles.glowYellow, { transform: [{ scale: pulseAnim }] }]} />
      
      <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.cardHeaderIndicator} />

        {/* Animated Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleBox}>
            <Text style={styles.offerTitle}>YANGI BUYURTMA</Text>
            <Text style={styles.offerSubtitle}>Kutayotgan faol taklif</Text>
          </View>
          <View style={styles.headerIconContainer}>
            <Text style={styles.offerIcon}>⚡</Text>
          </View>
        </View>

        {/* Tariff Badge */}
        {request.tariff && (
          <View style={styles.tariffBadgeContainer}>
            <Text style={[
              styles.tariffBadgeText,
              request.tariff === 'standart' ? { color: '#00E676', borderColor: 'rgba(0,230,118,0.25)', backgroundColor: 'rgba(0,230,118,0.06)' } :
              request.tariff === 'komfort' ? { color: '#FFD600', borderColor: 'rgba(255,214,0,0.25)', backgroundColor: 'rgba(255,214,0,0.06)' } :
              { color: '#FF1744', borderColor: 'rgba(255,23,68,0.25)', backgroundColor: 'rgba(255,23,68,0.06)' }
            ]}>
              {request.tariff.toUpperCase()}
            </Text>
          </View>
        )}

        {/* Dynamic Timer Circular Area */}
        <View style={styles.timerSection}>
          <View style={[styles.timerRing, { borderColor: timerColor, shadowColor: timerColor, backgroundColor: timerGlowColor }]}>
            <Text style={[styles.timerText, { color: timerColor }]}>{timeLeft}</Text>
            <Text style={[styles.timerUnit, { color: timerColor }]}>SONIYA</Text>
          </View>
        </View>

        {/* Route Info with Futuristic Connection Line */}
        <View style={styles.routeCard}>
          <View style={styles.routeRowItem}>
            <View style={[styles.routeIndicator, { backgroundColor: 'rgba(0, 230, 118, 0.1)', borderColor: '#00E676', borderWidth: 1.5 }]}>
              <Text style={[styles.routeIndicatorText, { color: '#00E676' }]}>A</Text>
            </View>
            <View style={styles.routeTextBox}>
              <Text style={styles.routeLabelText}>Mijoz turgan joy</Text>
              <Text style={styles.routeAddress} numberOfLines={1}>{request.pickup?.address || 'Belgilanmagan manzil'}</Text>
            </View>
          </View>

          <View style={styles.routeConnector}>
            <View style={styles.routeConnectorLine} />
            <View style={styles.routeConnectorDots}>
              {[0, 1, 2].map(i => <View key={i} style={styles.connectorDot} />)}
            </View>
          </View>

          <View style={styles.routeRowItem}>
            <View style={[styles.routeIndicator, { backgroundColor: 'rgba(255, 23, 68, 0.1)', borderColor: '#FF1744', borderWidth: 1.5 }]}>
              <Text style={[styles.routeIndicatorText, { color: '#FF1744' }]}>B</Text>
            </View>
            <View style={styles.routeTextBox}>
              <Text style={styles.routeLabelText}>Boradigan manzil</Text>
              <Text style={styles.routeAddress} numberOfLines={1}>{request.destination?.address || 'Karta orqali belgilangan'}</Text>
            </View>
          </View>
        </View>

        {/* Additional Services */}
        {request.options && (request.options.ac || request.options.luggage) ? (
          <View style={styles.servicesContainer}>
            <Text style={styles.servicesTitle}>Qo'shimcha talablar</Text>
            <View style={styles.servicesRow}>
              {request.options.ac ? (
                <View style={styles.serviceItem}>
                  <Feather name="wind" size={12} color="#00E676" style={{ marginRight: 4 }} />
                  <Text style={styles.serviceText}>Konditsioner</Text>
                </View>
              ) : null}
              {request.options.luggage ? (
                <View style={styles.serviceItem}>
                  <Feather name="package" size={12} color="#00E676" style={{ marginRight: 4 }} />
                  <Text style={styles.serviceText}>Bagaj</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Financial & Distance Info Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>KUTILAYOTGAN DAROMAD</Text>
            <Text style={styles.statValue}>
              {request.price?.toLocaleString()} <Text style={styles.currencyLabel}>UZS</Text>
            </Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>MASOFA</Text>
            <Text style={styles.statValue}>
              {request.distance} <Text style={styles.unitLabel}>km</Text>
            </Text>
          </View>
        </View>

        {/* Passenger Profile Preview */}
        <View style={styles.passengerCard}>
          <View style={styles.passengerAvatar}>
            <Text style={styles.passengerAvatarText}>
              {request.user?.name ? request.user.name[0].toUpperCase() : '👤'}
            </Text>
          </View>
          <View style={styles.passengerDetails}>
            <Text style={styles.passengerName}>
              {request.user?.name || 'Yo\'lovchi'} {request.user?.surname || ''}
            </Text>
            <Text style={styles.passengerRating}>⭐ 4.9 • Aloqa oson</Text>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Accepting & Rejecting Buttons with Glow */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.rejectBtn, loading && styles.btnDisabled]}
            onPress={handleReject}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Feather name="x" size={18} color="#FF1744" style={{ marginRight: 6 }} />
            <Text style={styles.rejectBtnText}>Rad etish</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptBtn, loading && styles.btnDisabled]}
            onPress={handleAccept}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Feather name="check" size={20} color="#000" style={{ marginRight: 6 }} />
                <Text style={styles.acceptBtnText}>Qabul qilish</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 5, 8, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  glowCircle: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    opacity: 0.15,
  },
  glowYellow: {
    top: '30%',
    backgroundColor: '#FFD600',
    shadowColor: '#FFD600',
    shadowRadius: 100,
    shadowOpacity: 0.8,
  },
  card: {
    backgroundColor: '#0F0F12',
    width: width * 0.92,
    maxWidth: 420,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#FFD600',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 8,
    overflow: 'hidden',
  },
  cardHeaderIndicator: {
    width: 50,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleBox: {
    flex: 1,
  },
  offerTitle: {
    color: '#FFD600',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  offerSubtitle: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  headerIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 214, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offerIcon: {
    fontSize: 18,
  },
  tariffBadgeContainer: {
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  tariffBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  timerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  timerRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  timerText: {
    fontSize: 32,
    fontWeight: '900',
  },
  timerUnit: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: -2,
  },
  routeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  routeRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeIndicator: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  routeIndicatorText: {
    fontSize: 13,
    fontWeight: '900',
  },
  routeTextBox: {
    flex: 1,
  },
  routeLabelText: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeAddress: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  routeConnector: {
    paddingLeft: 12,
    marginVertical: 4,
  },
  routeConnectorLine: {
    width: 1.5,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  routeConnectorDots: {
    position: 'absolute',
    left: 11,
    top: 1,
    justifyContent: 'space-between',
    height: 16,
  },
  connectorDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  currencyLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  unitLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  statDivider: {
    width: 1.5,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 12,
  },
  passengerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 18,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  passengerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  passengerAvatarText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
  passengerDetails: {
    flex: 1,
  },
  passengerName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  passengerRating: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  errorText: {
    color: '#FF1744',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36%',
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: 'rgba(255,23,68,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,23,68,0.2)',
  },
  rejectBtnText: {
    color: '#FF1744',
    fontWeight: '800',
    fontSize: 14,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '60%',
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: '#00E676',
    shadowColor: '#00E676',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  acceptBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  servicesContainer: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 18,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  servicesTitle: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  servicesRow: {
    flexDirection: 'row',
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,230,118,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.2)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 8,
  },
  serviceText: {
    color: '#00E676',
    fontSize: 11,
    fontWeight: '700',
  },
});
