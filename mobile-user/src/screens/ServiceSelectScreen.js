import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Animated,
  StatusBar,
  SafeAreaView,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48 - 12) / 2; // Spacing logic for 2-column grid

export default function ServiceSelectScreen({ user, onSelectGo, onSelectEats, onLogout }) {
  const [comingSoonService, setComingSoonService] = useState(null);
  const [locationName, setLocationName] = useState('Yuklanmoqda...');
  const [locationCoords, setLocationCoords] = useState(null);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [pickerRegion, setPickerRegion] = useState(null);
  const [pickerAddress, setPickerAddress] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const pickerGeoTimer = useRef(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const heroCardScale = useRef(new Animated.Value(1)).current;
  const goTileScale = useRef(new Animated.Value(1)).current;
  const eatsTileScale = useRef(new Animated.Value(1)).current;
  const courierTileScale = useRef(new Animated.Value(1)).current;
  const marketTileScale = useRef(new Animated.Value(1)).current;

  // Coming Soon Sheet Animations
  const overlayFade = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Fetch geolocation — avval cached (tez), keyin yangilash
    const reverseGeocode = async (loc) => {
      try {
        const address = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (address && address.length > 0) {
          const first = address[0];
          const name = first.street
            ? `${first.street}${first.name ? ', ' + first.name : ''}`
            : first.district || first.city || 'Toshkent shahri';
          setLocationName(name);
        }
      } catch {
        // silent
      }
    };

    const fetchLocation = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationName('Toshkent shahri');
          return;
        }

        // 1-qadam: Darhol cached joylashuvni ko'rsatish (bir zumda)
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown && lastKnown.coords) {
          setLocationCoords(lastKnown.coords);
          setPickerRegion({
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
          reverseGeocode(lastKnown);
        }

        // 2-qadam: Background'da aniqroq joylashuvni olish va yangilash
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
          timeout: 3000,
        })
          .then((freshLoc) => {
            if (freshLoc && freshLoc.coords) {
              setLocationCoords(freshLoc.coords);
              setPickerRegion({
                latitude: freshLoc.coords.latitude,
                longitude: freshLoc.coords.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              });
              reverseGeocode(freshLoc);
            }
          })
          .catch(() => {
            if (!lastKnown) setLocationName('Toshkent shahri');
          });
      } catch (err) {
        console.warn('Error fetching location:', err);
        setLocationName('Toshkent shahri');
      }
    };

    fetchLocation();
  }, []);

  // Karta siljiganda manzilni qayta aniqlash
  const onPickerRegionChange = (region) => {
    setPickerRegion(region);
    setPickerLoading(true);
    if (pickerGeoTimer.current) clearTimeout(pickerGeoTimer.current);
    pickerGeoTimer.current = setTimeout(async () => {
      try {
        const address = await Location.reverseGeocodeAsync({
          latitude: region.latitude,
          longitude: region.longitude,
        });
        if (address && address.length > 0) {
          const first = address[0];
          const name = first.street
            ? `${first.street}${first.name ? ', ' + first.name : ''}`
            : first.district || first.city || 'Toshkent shahri';
          setPickerAddress(name);
        }
      } catch { }
      setPickerLoading(false);
    }, 600);
  };

  const confirmPickedLocation = () => {
    if (pickerAddress) setLocationName(pickerAddress);
    if (pickerRegion) {
      setLocationCoords({
        latitude: pickerRegion.latitude,
        longitude: pickerRegion.longitude,
      });
    }
    setLocationPickerVisible(false);
  };

  const openLocationPicker = () => {
    setPickerAddress(locationName !== 'Yuklanmoqda...' ? locationName : '');
    setLocationPickerVisible(true);
  };

  const handleGoPress = () => {
    Animated.sequence([
      Animated.timing(heroCardScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(heroCardScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      onSelectGo();
    });
  };

  const handleTilePress = (serviceName, scaleVal) => {
    Animated.sequence([
      Animated.timing(scaleVal, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleVal, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      if (serviceName === 'go') {
        onSelectGo();
      } else {
        openComingSoon(serviceName);
      }
    });
  };

  const openComingSoon = (service) => {
    setComingSoonService(service);
    Animated.parallel([
      Animated.timing(overlayFade, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeComingSoon = () => {
    Animated.parallel([
      Animated.timing(overlayFade, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: 350, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setComingSoonService(null);
    });
  };

  const getComingSoonDetails = () => {
    switch (comingSoonService) {
      case 'eats':
        return {
          title: 'InFast Eats',
          icon: 'shopping-bag',
          color: '#FF9500',
          desc: 'Sevimli restoranlaringizdan eng shirin taomlar va shirinliklarni tezkor yetkazib berish xizmati. Juda yaqin kunlarda siz uchun ishga tushadi!',
          bg: '#FFF7ED',
        };
      case 'courier':
        return {
          title: 'InFast Courier',
          icon: 'box',
          color: '#10B981',
          desc: 'Hujjatlar, kalitlar va boshqa muhim narsalarni shahar bo\'ylab bir zumda yetkazish. Kuryerlarimiz tez va ishonchli xizmat ko\'rsatadi.',
          bg: '#ECFDF5',
        };
      case 'market':
        return {
          title: 'InFast Store',
          icon: 'shopping-cart',
          color: '#3b32db',
          desc: 'Oziq-ovqat va kundalik mahsulotlarni to\'g\'ridan-to\'g\'ri uyingizga buyurtma qiling. Biz eng sifatli va yangi mahsulotlarni tanlaymiz.',
          bg: '#EEF2FF',
        };
      default:
        return {};
    }
  };

  const details = getComingSoonDetails();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F4F6" translucent />

      {/* Background soft layout grids */}
      <View style={styles.backgroundBlur} />

      <Animated.View style={[styles.mainScroll, { opacity: fadeAnim }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* Top Address & Profile Section */}
          <View style={styles.topHeader}>
            <TouchableOpacity
              style={styles.locationSelector}
              activeOpacity={0.7}
              onPress={openLocationPicker}
            >
              <View style={styles.pinIconBg}>
                <Feather name="map-pin" size={14} color="#3b32db" />
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.locationLabel}>Hozirgi joylashuv</Text>
                <View style={styles.locationRow}>
                  <Text style={styles.locationText} numberOfLines={1}>{locationName}</Text>
                  <Feather name="chevron-down" size={12} color="#64748B" style={{ marginLeft: 4, marginTop: 2 }} />
                </View>
              </View>
            </TouchableOpacity>

            <View style={styles.profileSection}>
              <TouchableOpacity onPress={onLogout} style={styles.logoutBtn} activeOpacity={0.7}>
                <Feather name="log-out" size={16} color="#64748B" />
              </TouchableOpacity>
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>
                  {user?.name ? user.name[0].toUpperCase() : 'U'}
                </Text>
              </View>
            </View>
          </View>

          {/* User Welcome */}
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeSub}>Salom, {user?.name || 'Mijoz'} 👋</Text>
            <Text style={styles.welcomeTitle}>Bugun qayerga boramiz?</Text>
          </View>

          {/* Hero Uber-style Prominent Go Card */}
          <Animated.View style={{ transform: [{ scale: heroCardScale }], marginBottom: 16 }}>
            <TouchableOpacity
              style={styles.heroCard}
              activeOpacity={0.9}
              onPress={handleGoPress}
            >
              <View style={styles.heroLeft}>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>ENG OMMABOP</Text>
                </View>
                <Text style={styles.heroTitle}>InFast Go</Text>
                <Text style={styles.heroDesc}>
                  Taksi buyurtma qilish va shahar bo'ylab sayohat qilish
                </Text>
                <View style={styles.heroBtn}>
                  <Text style={styles.heroBtnText}>Hozir chaqirish</Text>
                  <Feather name="arrow-right" size={14} color="#3b32db" style={{ marginLeft: 6 }} />
                </View>
              </View>
              <View style={styles.heroRight}>
                <View style={styles.heroCircleGlow} />
                <Image
                  source={require('../../assets/bmw.webp')}
                  style={styles.heroImage}
                  resizeMode="contain"
                />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Quick Actions Title */}
          <Text style={styles.sectionTitle}>Xizmatlarimiz</Text>

          {/* Services Grid (2x2) */}
          <View style={styles.gridContainer}>
            {/* TILE 1: GO (TAXI) */}
            <Animated.View style={[styles.gridTileWrapper, { transform: [{ scale: goTileScale }] }]}>
              <TouchableOpacity
                style={[styles.gridTile, styles.tileActive]}
                activeOpacity={0.8}
                onPress={() => handleTilePress('go', goTileScale)}
              >
                <View style={[styles.tileIconContainer, { backgroundColor: 'rgba(59, 50, 219, 0.08)' }]}>
                  <Feather name="navigation" size={20} color="#3b32db" />
                </View>
                <Text style={styles.tileTitle}>InFast Go</Text>
                <Text style={styles.tileSub}>Tezkor Taksi</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* TILE 2: EATS (FOOD) */}
            <Animated.View style={[styles.gridTileWrapper, { transform: [{ scale: eatsTileScale }] }]}>
              <TouchableOpacity
                style={styles.gridTile}
                activeOpacity={0.8}
                onPress={() => handleTilePress('eats', eatsTileScale)}
              >
                <View style={styles.badgeSoon}>
                  <Text style={styles.badgeSoonText}>TEZ KUNDA</Text>
                </View>

                <View style={[styles.tileIconContainer, { backgroundColor: '#FFF7ED' }]}>
                  <Feather name="shopping-bag" size={20} color="#FF9500" />
                </View>

                <Text style={styles.tileTitle}>InFast Eats</Text>
                <Text style={styles.tileSub}>Taom yetkazish</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* TILE 3: COURIER (DELIVERY) */}
            <Animated.View style={[styles.gridTileWrapper, { transform: [{ scale: courierTileScale }] }]}>
              <TouchableOpacity
                style={styles.gridTile}
                activeOpacity={0.8}
                onPress={() => handleTilePress('courier', courierTileScale)}
              >
                <View style={styles.badgeSoon}>
                  <Text style={styles.badgeSoonText}>TEZ KUNDA</Text>
                </View>
                <View style={[styles.tileIconContainer, { backgroundColor: '#ECFDF5' }]}>
                  <Feather name="box" size={20} color="#10B981" />
                </View>
                <Text style={styles.tileTitle}>InFast Courier</Text>
                <Text style={styles.tileSub}>Kuryer xizmati</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* TILE 4: MARKET (STORE) */}
            <Animated.View style={[styles.gridTileWrapper, { transform: [{ scale: marketTileScale }] }]}>
              <TouchableOpacity
                style={styles.gridTile}
                activeOpacity={0.8}
                onPress={() => handleTilePress('market', marketTileScale)}
              >
                <View style={styles.badgeSoon}>
                  <Text style={styles.badgeSoonText}>TEZ KUNDA</Text>
                </View>
                <View style={[styles.tileIconContainer, { backgroundColor: '#EFF6FF' }]}>
                  <Feather name="shopping-cart" size={20} color="#3B82F6" />
                </View>
                <Text style={styles.tileTitle}>InFast Market</Text>
                <Text style={styles.tileSub}>Do'kon mahsulotlari</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Footer details */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerLogo}>InFast</Text>
            <Text style={styles.footerNote}>Super-app toifasidagi shahar platformasi</Text>
            <Text style={styles.footerVersion}>Versiya 1.0.4</Text>
          </View>

        </ScrollView>
      </Animated.View>

      {/* ===== LOCATION PICKER MODAL ===== */}
      <Modal
        visible={locationPickerVisible}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setLocationPickerVisible(false)}
      >
        <View style={styles.pickerContainer}>
          {/* Header */}
          <View style={styles.pickerHeader}>
            <TouchableOpacity
              onPress={() => setLocationPickerVisible(false)}
              style={styles.pickerBackBtn}
              activeOpacity={0.7}
            >
              <Feather name="x" size={20} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.pickerHeaderTitle}>Joylashuvni tanlang</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Map */}
          {pickerRegion ? (
            <MapView
              style={styles.pickerMap}
              initialRegion={pickerRegion}
              onRegionChangeComplete={onPickerRegionChange}
              showsUserLocation
              showsMyLocationButton
            />
          ) : (
            <View style={[styles.pickerMap, styles.pickerMapPlaceholder]}>
              <ActivityIndicator size="large" color="#3b32db" />
              <Text style={{ color: '#64748B', marginTop: 12, fontWeight: '600' }}>
                Xarita yuklanmoqda...
              </Text>
            </View>
          )}

          {/* Center pin overlay */}
          <View style={styles.pickerPinWrapper} pointerEvents="none">
            <View style={styles.pickerPinContainer}>
              <Feather name="map-pin" size={32} color="#3b32db" />
              <View style={styles.pickerPinShadow} />
            </View>
          </View>

          {/* Bottom address card */}
          <View style={styles.pickerBottom}>
            <View style={styles.pickerAddressRow}>
              <View style={styles.pickerAddressIcon}>
                <Feather name="map-pin" size={16} color="#3b32db" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerAddressLabel}>Tanlangan manzil</Text>
                {pickerLoading ? (
                  <ActivityIndicator size="small" color="#3b32db" style={{ alignSelf: 'flex-start', marginTop: 4 }} />
                ) : (
                  <Text style={styles.pickerAddressText} numberOfLines={2}>
                    {pickerAddress || 'Kartani suring...'}
                  </Text>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.pickerConfirmBtn, (!pickerAddress || pickerLoading) && { opacity: 0.5 }]}
              onPress={confirmPickedLocation}
              activeOpacity={0.85}
              disabled={!pickerAddress || pickerLoading}
            >
              <Feather name="check" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.pickerConfirmText}>Tasdiqlash</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modern Bottom Sheet Coming Soon Overlay */}
      {comingSoonService && (
        <Animated.View style={[styles.overlay, { opacity: overlayFade }]}>
          <TouchableOpacity style={styles.overlayDismiss} onPress={closeComingSoon} activeOpacity={1} />

          <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
            <View style={styles.dragHandle} />

            <View style={styles.sheetContent}>
              <View style={[styles.sheetIconBg, { backgroundColor: details.bg }]}>
                <Feather name={details.icon} size={36} color={details.color} />
              </View>

              <Text style={styles.sheetTitle}>{details.title}</Text>
              <View style={[styles.sheetBadge, { backgroundColor: details.color }]}>
                <Text style={styles.sheetBadgeText}>TEZ KUNDA TAShKIL ETILADI</Text>
              </View>

              <Text style={styles.sheetDesc}>{details.desc}</Text>

              <View style={styles.benefitBox}>
                <View style={styles.benefitItem}>
                  <Feather name="zap" size={16} color="#3b32db" style={{ marginRight: 10 }} />
                  <Text style={styles.benefitText}>Bir zumda va yuqori sifat bilan</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Feather name="shield" size={16} color="#3b32db" style={{ marginRight: 10 }} />
                  <Text style={styles.benefitText}>Xavfsiz va kafolatlangan xizmatlar</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.closeBtn} onPress={closeComingSoon} activeOpacity={0.8}>
                <Text style={styles.closeBtnText}>Tushunarli</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6', // Light clean grey background matching Yandex Go
  },
  backgroundBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: '#EEF2FF', // Indigo gradient feel at top
    opacity: 0.8,
  },
  mainScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 40,
  },

  // Top header section
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 29,
  },
  locationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1.5,
    marginRight: 16,
    flexShrink: 1,
  },
  pinIconBg: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(59, 50, 219, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  locationLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3b32db',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },

  // Welcome section
  welcomeContainer: {
    marginBottom: 20,
  },
  welcomeSub: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginTop: 2,
  },

  // Hero Go Card (like Uber / Yandex main tile)
  heroCard: {
    backgroundColor: '#3b32db',
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  heroLeft: {
    flex: 1,
    zIndex: 2,
  },
  heroBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
  },
  heroDesc: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: '90%',
  },
  heroBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 18,
  },
  heroBtnText: {
    color: '#3b32db',
    fontSize: 12,
    fontWeight: '800',
  },
  heroRight: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 90,
    height: 90,
  },
  heroCircleGlow: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.08)',
    zIndex: 0,
  },
  heroEmoji: {
    fontSize: 58,
    zIndex: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  heroImage: {
    width: 130,
    height: 100,
    zIndex: 1,
    position: 'absolute',
    right: -20,
  },

  // Services Grid Layout
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridTileWrapper: {
    width: CARD_WIDTH,
  },
  gridTile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    height: 120,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    position: 'relative',
    overflow: 'hidden',
  },
  tileActive: {
    borderColor: 'rgba(59, 50, 219, 0.08)',
  },
  tileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  tileTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  tileSub: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  badgeSoon: {
    position: 'absolute',
    top: 12,
    right: -20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    transform: [{ rotate: '45deg' }],
    paddingVertical: 2,
    width: 80,
    alignItems: 'center',
  },
  badgeSoonText: {
    fontSize: 7,
    fontWeight: '800',
    color: '#64748B',
  },

  // Footer branding
  footerContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 10,
  },
  footerLogo: {
    fontSize: 16,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  footerNote: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 4,
  },
  footerVersion: {
    fontSize: 9,
    color: '#CBD5E1',
    fontWeight: '500',
    marginTop: 4,
  },

  // Bottom Sheet Details
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  overlayDismiss: {
    flex: 1,
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 24,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginVertical: 14,
  },
  sheetContent: {
    alignItems: 'center',
  },
  sheetIconBg: {
    width: 76,
    height: 76,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  sheetBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 6,
    marginBottom: 16,
  },
  sheetBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sheetDesc: {
    color: '#475569',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  benefitBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EEF2FF',
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  closeBtn: {
    backgroundColor: '#3b32db',
    width: '100%',
    paddingVertical: 15,
    marginBottom: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  // ===== LOCATION PICKER MODAL STYLES =====
  pickerContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    zIndex: 10,
  },
  pickerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  pickerMap: {
    flex: 1,
  },
  pickerMapPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  pickerPinWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerPinContainer: {
    alignItems: 'center',
  },
  pickerPinShadow: {
    width: 10,
    height: 4,
    borderRadius: 5,
    backgroundColor: 'rgba(59,50,219,0.25)',
    marginTop: 2,
  },
  pickerBottom: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 12,
  },
  pickerAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EEF2FF',
  },
  pickerAddressIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(59,50,219,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pickerAddressLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    marginBottom: 2,
  },
  pickerAddressText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 20,
  },
  pickerConfirmBtn: {
    backgroundColor: '#3b32db',
    borderRadius: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b32db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  pickerConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
