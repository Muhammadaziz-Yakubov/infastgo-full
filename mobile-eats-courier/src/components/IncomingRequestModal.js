import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Vibration,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const ACCEPT_TIMEOUT = 30; // seconds to accept

function formatDist(meters) {
  if (!meters && meters !== 0) return '—';
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function IncomingRequestModal({ visible, request, onAccept, onDecline }) {
  const [countdown, setCountdown] = useState(ACCEPT_TIMEOUT);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(1)).current;

  // Slide in animation
  useEffect(() => {
    if (visible) {
      setCountdown(ACCEPT_TIMEOUT);
      progressAnim.setValue(1);

      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();

      Animated.timing(progressAnim, {
        toValue: 0,
        duration: ACCEPT_TIMEOUT * 1000,
        useNativeDriver: false,
      }).start();

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();

      // Vibrate
      const pattern = [0, 400, 200, 400, 200, 400];
      Vibration.vibrate(pattern, true);

      // Countdown timer
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            Vibration.cancel();
            onDecline();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 250,
        useNativeDriver: true,
      }).start();
      Vibration.cancel();
      clearInterval(timerRef.current);
      pulseAnim.stopAnimation();
    }

    return () => {
      Vibration.cancel();
      clearInterval(timerRef.current);
    };
  }, [visible]);

  if (!request) return null;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const distRest = request.distToRestaurant;
  const distCust = request.distToCustomer;

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { transform: [{ translateY: slideAnim }] }]}>

          {/* Progress Bar */}
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
          </View>

          {/* Brand Header */}
          <View style={styles.brandRow}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandText}>⚡ InFast Go</Text>
            </View>
            <View style={styles.countdownBadge}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Text style={styles.countdownNum}>{countdown}s</Text>
              </Animated.View>
            </View>
          </View>

          {/* Title */}
          <View style={styles.titleRow}>
            <View style={styles.newBadge}>
              <View style={styles.redDot} />
              <Text style={styles.newBadgeText}>YANGI ZAKAZ</Text>
            </View>
          </View>

          {/* Distance Cards Row */}
          <View style={styles.distRow}>
            <View style={[styles.distCard, styles.distCardOrange]}>
              <Text style={styles.distIcon}>🏪</Text>
              <Text style={styles.distLabel}>Restorangacha</Text>
              <Text style={styles.distValue}>{formatDist(distRest)}</Text>
            </View>
            <View style={styles.distArrow}>
              <Feather name="arrow-right" size={16} color="#94A3B8" />
            </View>
            <View style={[styles.distCard, styles.distCardBlue]}>
              <Text style={styles.distIcon}>📍</Text>
              <Text style={styles.distLabel}>Mijozgacha</Text>
              <Text style={[styles.distValue, { color: '#3B5BDB' }]}>{formatDist(distCust)}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Restaurant Info */}
          <View style={styles.infoRow}>
            <View style={[styles.iconBox, { backgroundColor: '#FFF3E0' }]}>
              <Feather name="shopping-bag" size={18} color="#FF9500" />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>RESTORAN</Text>
              <Text style={styles.infoValue}>{request.restaurantName || 'Restoran'}</Text>
              <Text style={styles.infoSub} numberOfLines={1}>{request.restaurantAddress}</Text>
            </View>
          </View>

          {/* Customer Info */}
          <View style={styles.infoRow}>
            <View style={[styles.iconBox, { backgroundColor: '#EEF2FF' }]}>
              <Feather name="map-pin" size={18} color="#3B5BDB" />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>MIJOZ MANZILI</Text>
              <Text style={styles.infoValue} numberOfLines={2}>
                {request.deliveryAddress?.address || 'Manzil ko\'rsatilmagan'}
              </Text>
            </View>
          </View>

          {/* Earnings */}
          <View style={styles.earningsCard}>
            <View>
              <Text style={styles.earningsLabel}>Sizning daromadingiz</Text>
              <Text style={styles.earningsValue}>
                {request.deliveryFee ? request.deliveryFee.toLocaleString() : '10,000'} UZS
              </Text>
            </View>
            <View style={styles.itemsCount}>
              <Feather name="box" size={14} color="#FF9500" />
              <Text style={styles.itemsCountText}>
                {request.items?.length || 1} mahsulot
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.declineBtn} onPress={onDecline} activeOpacity={0.75}>
              <Feather name="x" size={18} color="#64748B" />
              <Text style={styles.declineText}>Rad etish</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.acceptBtn} onPress={onAccept} activeOpacity={0.85}>
              <Feather name="check" size={18} color="#FFFFFF" />
              <Text style={styles.acceptText}>Qabul qilish</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 30, 0.65)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 0,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 42 : 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 30,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 20,
    marginTop: 12,
    marginHorizontal: -20,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#FF9500',
    borderRadius: 2,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  brandBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  brandText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  countdownBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FF9500',
  },
  countdownNum: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FF9500',
  },
  titleRow: {
    marginBottom: 16,
  },
  newBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  newBadgeText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  distCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
  },
  distCardOrange: {
    backgroundColor: '#FFF8F0',
    borderWidth: 1.5,
    borderColor: '#FFE0B2',
  },
  distCardBlue: {
    backgroundColor: '#F0F4FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
  },
  distArrow: {
    width: 28,
    alignItems: 'center',
  },
  distIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  distLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  distValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FF9500',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  infoSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  earningsCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#BBF7D0',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 20,
  },
  earningsLabel: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  earningsValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#16A34A',
    marginTop: 2,
  },
  itemsCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  itemsCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF9500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  declineBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  declineText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '800',
  },
  acceptBtn: {
    flex: 2,
    backgroundColor: '#FF9500',
    borderRadius: 16,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  acceptText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
});
