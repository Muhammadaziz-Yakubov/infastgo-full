import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Alert
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../../services/api';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';


const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'All', name: 'Barchasi', icon: 'grid' },
  { id: 'Fast Food', name: 'Fast Food', icon: 'smile' },
  { id: 'National Food', name: 'Milliy', icon: 'coffee' },
  { id: 'Desserts', name: 'Shirinliklar', icon: 'heart' },
  { id: 'Drinks', name: 'Ichimliklar', icon: 'wind' },
];

export default function EatsHomeScreen({ onBack, onSelectRestaurant, onViewCart }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [locationName, setLocationName] = useState('Yuklanmoqda...');
  const [userCoords, setUserCoords] = useState(null);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    loadLocationAndRestaurants();
    loadCartCount();
  }, [selectedCategory]);

  const loadCartCount = async () => {
    try {
      const val = await AsyncStorage.getItem('infast_cart');
      if (val) {
        const parsed = JSON.parse(val);
        if (parsed && parsed.items) {
          const count = parsed.items.reduce((sum, item) => sum + item.quantity, 0);
          setCartCount(count);
          return;
        }
      }
      setCartCount(0);
    } catch (e) {
      setCartCount(0);
    }
  };


  const loadLocationAndRestaurants = async () => {
    try {
      setLoading(true);
      let lat = 41.3113; // Default Tashkent coordinates
      let lng = 69.2797;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 5000
        }).catch(() => Location.getLastKnownPositionAsync());

        if (loc && loc.coords) {
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
          setUserCoords({ lat, lng });

          const address = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
          if (address && address.length > 0) {
            const first = address[0];
            setLocationName(first.street ? `${first.street}, ${first.name}` : first.district || first.city || 'Toshkent');
          }
        }
      } else {
        setLocationName('Toshkent, Amir Temur');
      }

      const res = await api.getEatsRestaurants(lat, lng, selectedCategory !== 'All' ? selectedCategory : '', searchQuery);
      if (res.success) {
        setRestaurants(res.restaurants);
      }
    } catch (err) {
      console.warn('Error loading restaurants:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      const lat = userCoords?.lat || 41.3113;
      const lng = userCoords?.lng || 69.2797;
      const res = await api.getEatsRestaurants(lat, lng, selectedCategory !== 'All' ? selectedCategory : '', searchQuery);
      if (res.success) {
        setRestaurants(res.restaurants);
      }
    } catch (err) {
      console.warn('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderRestaurantItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.95}
      onPress={() => onSelectRestaurant(item._id)}
    >
      <Image
        source={{ uri: item.image || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600' }}
        style={styles.cardImage}
      />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <View style={styles.ratingBadge}>
            <Feather name="star" size={12} color="#FFFFFF" style={{ marginRight: 2 }} />
            <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
          </View>
        </View>
        <Text style={styles.cardCategory}>{item.category} • Xizmat ko'rsatish</Text>
        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Feather name="clock" size={12} color="#64748B" style={{ marginRight: 4 }} />
            <Text style={styles.metaText}>{item.estimatedDeliveryTime} daq</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Feather name="truck" size={12} color="#64748B" style={{ marginRight: 4 }} />
            <Text style={styles.metaText}>{item.deliveryPrice.toLocaleString()} UZS</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Feather name="arrow-left" size={20} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.addressContainer}>
          <Text style={styles.addressLabel}>Yetkazish manzili</Text>
          <View style={styles.addressRow}>
            <Feather name="map-pin" size={12} color="#FF9500" style={{ marginRight: 4 }} />
            <Text style={styles.addressText} numberOfLines={1}>{locationName}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.cartHeaderBtn}
          onPress={() => {
            if (cartCount > 0) {
              onViewCart();
            } else {
              Alert.alert("Savatchangiz bo'sh", "Buyurtma berish uchun restoranlardan taom qo'shing.");
            }
          }}
        >
          <Feather name="shopping-bag" size={20} color="#0F172A" />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>

      </View>

      {/* Search and Categories inside Scrollable Header area */}
      <View style={styles.filterSection}>
        <View style={styles.searchContainer}>
          <Feather name="search" size={16} color="#64748B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Restoran yoki taomlarni qidirish..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => { setSearchQuery(''); handleSearch(); }}>
              <Feather name="x" size={16} color="#64748B" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Category lists */}
        <View style={{ height: 44, marginVertical: 14 }}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={CATEGORIES}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.categoriesScroll}
            renderItem={({ item }) => {
              const selected = selectedCategory === item.id;
              return (
                <TouchableOpacity
                  style={[styles.categoryPill, selected && styles.categoryPillSelected]}
                  onPress={() => setSelectedCategory(item.id)}
                  activeOpacity={0.8}
                >
                  <Feather name={item.icon} size={14} color={selected ? '#FFFFFF' : '#475569'} style={{ marginRight: 6 }} />
                  <Text style={[styles.categoryName, selected && styles.categoryNameSelected]}>{item.name}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>

      {/* Restaurants list */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#FF9500" />
          <Text style={styles.loaderText}>Yaqin atrofdagi restoranlar yuklanmoqda...</Text>
        </View>
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={item => item._id}
          renderItem={renderRestaurantItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="frown" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>Hech qanday restoran topilmadi</Text>
            </View>
          }
        />
      )}
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
    paddingVertical: 12,
    paddingTop:40,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    padding: 8,
  },
  addressContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  addressLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  addressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    maxWidth: '90%',
  },
  cartHeaderBtn: {
    padding: 8,
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    right: 2,
    top: 2,
    backgroundColor: '#FF9500',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },

  filterSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  categoriesScroll: {
    paddingRight: 16,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    height: 36,
  },
  categoryPillSelected: {
    backgroundColor: '#FF9500',
  },
  categoryName: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '700',
  },
  categoryNameSelected: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  cardImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#E2E8F0',
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  cardCategory: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 4,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
  },
  metaDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 10,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loaderText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '700',
    marginTop: 12,
  },
});
