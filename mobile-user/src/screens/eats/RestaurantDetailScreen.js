import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  FlatList,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';


const { width } = Dimensions.get('window');

export default function RestaurantDetailScreen({ restaurantId, onBack, onViewCart }) {
  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState({}); // foodId -> { item, quantity }

  useEffect(() => {
    loadRestaurantDetails();
  }, [restaurantId]);

  const loadSavedCart = async (currentRestaurant) => {
    try {
      const val = await AsyncStorage.getItem('infast_cart');
      if (val) {
        const parsed = JSON.parse(val);
        if (parsed.restaurant?._id === restaurantId && currentRestaurant) {
          const newCart = {};
          parsed.items.forEach(it => {
            newCart[it.foodId] = {
              item: it.item || { _id: it.foodId, name: it.name, price: it.price },
              quantity: it.quantity
            };
          });
          setCart(newCart);
        }
      }
    } catch (e) {
      console.warn('Error loading saved cart:', e);
    }
  };

  const saveCartToStorage = async (updatedCart, currentRestaurant = restaurant) => {
    try {
      const itemsList = [];
      Object.keys(updatedCart).forEach(id => {
        itemsList.push({
          foodId: id,
          name: updatedCart[id].item.name,
          price: updatedCart[id].item.price,
          quantity: updatedCart[id].quantity,
          item: updatedCart[id].item
        });
      });
      if (itemsList.length > 0 && currentRestaurant) {
        await AsyncStorage.setItem('infast_cart', JSON.stringify({
          items: itemsList,
          restaurant: currentRestaurant
        }));
      } else {
        await AsyncStorage.removeItem('infast_cart');
      }
    } catch (e) {
      console.warn('Error saving cart to storage:', e);
    }
  };

  const loadRestaurantDetails = async () => {
    try {
      setLoading(true);
      const res = await api.getEatsRestaurantDetail(restaurantId);
      if (res.success) {
        setRestaurant(res.restaurant);
        setMenu(res.menu);
        await loadSavedCart(res.restaurant);
      }
    } catch (err) {
      console.warn('Error loading restaurant menu:', err);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (item) => {
    setCart(prev => {
      const currentQty = prev[item._id]?.quantity || 0;
      const updated = {
        ...prev,
        [item._id]: {
          item,
          quantity: currentQty + 1
        }
      };
      saveCartToStorage(updated, restaurant);
      return updated;
    });
  };

  const removeFromCart = (item) => {
    setCart(prev => {
      const currentQty = prev[item._id]?.quantity || 0;
      let updated;
      if (currentQty <= 1) {
        updated = { ...prev };
        delete updated[item._id];
      } else {
        updated = {
          ...prev,
          [item._id]: {
            item,
            quantity: currentQty - 1
          }
        };
      }
      saveCartToStorage(updated, restaurant);
      return updated;
    });
  };


  const getCartSummary = () => {
    let totalItems = 0;
    let totalPrice = 0;
    const itemsList = [];

    Object.keys(cart).forEach(id => {
      totalItems += cart[id].quantity;
      totalPrice += cart[id].item.price * cart[id].quantity;
      itemsList.push({
        foodId: id,
        name: cart[id].item.name,
        price: cart[id].item.price,
        quantity: cart[id].quantity
      });
    });

    return { totalItems, totalPrice, itemsList };
  };

  const { totalItems, totalPrice, itemsList } = getCartSummary();

  const renderMenuItem = ({ item }) => {
    const qty = cart[item._id]?.quantity || 0;
    return (
      <View style={styles.menuItem}>
        <View style={styles.menuItemInfo}>
          <Text style={styles.menuItemName}>{item.name}</Text>
          <Text style={styles.menuItemDesc} numberOfLines={2}>{item.description}</Text>
          <Text style={styles.menuItemPrice}>{item.price.toLocaleString()} UZS</Text>
        </View>
        <View style={styles.menuItemRight}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.menuItemImage} />
          ) : (
            <View style={[styles.menuItemImage, styles.menuItemImagePlaceholder]}>
              <Feather name="image" size={20} color="#94A3B8" />
            </View>
          )}

          {qty > 0 ? (
            <View style={styles.quantityContainer}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => removeFromCart(item)}>
                <Feather name="minus" size={14} color="#FF9500" />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{qty}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => addToCart(item)}>
                <Feather name="plus" size={14} color="#FF9500" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addBtn} onPress={() => addToCart(item)}>
              <Text style={styles.addBtnText}>Qo'shish</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF9500" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E293B" />
      
      {/* Scrollable Content */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Banner with absolute actions */}
        <View style={styles.bannerContainer}>
          <Image
            source={{ uri: restaurant?.image || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600' }}
            style={styles.bannerImage}
          />
          <TouchableOpacity style={styles.headerBackBtn} onPress={onBack}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Restaurant Profile details */}
        <View style={styles.infoCard}>
          <Text style={styles.restaurantName}>{restaurant?.name}</Text>
          <Text style={styles.restaurantCategory}>{restaurant?.category} • Tezkor yetkazish</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Feather name="star" size={14} color="#FF9500" style={{ marginRight: 4 }} />
              <Text style={styles.statValue}>{restaurant?.rating.toFixed(1)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Feather name="clock" size={14} color="#64748B" style={{ marginRight: 4 }} />
              <Text style={styles.statValue}>{restaurant?.estimatedDeliveryTime} daq</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Feather name="truck" size={14} color="#64748B" style={{ marginRight: 4 }} />
              <Text style={styles.statValue}>{restaurant?.deliveryPrice.toLocaleString()} UZS</Text>
            </View>
          </View>
        </View>

        {/* Categories Menu List */}
        {menu.map((cat, index) => (
          <View key={index} style={styles.categoryBlock}>
            <Text style={styles.categoryTitle}>{cat.categoryName}</Text>
            <FlatList
              data={cat.items}
              keyExtractor={item => item._id}
              scrollEnabled={false}
              renderItem={renderMenuItem}
            />
          </View>
        ))}
      </ScrollView>

      {/* Floating Bottom Cart Bar */}
      {totalItems > 0 && (
        <View style={styles.cartBar}>
          <View style={styles.cartBarInfo}>
            <Text style={styles.cartBarQty}>{totalItems} ta taom</Text>
            <Text style={styles.cartBarTotal}>{totalPrice.toLocaleString()} UZS</Text>
          </View>
          <TouchableOpacity
            style={styles.cartBarBtn}
            onPress={() => onViewCart(itemsList, restaurant)}
          >
            <Text style={styles.cartBarBtnText}>Savatchaga o'tish</Text>
            <Feather name="arrow-right" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  bannerContainer: {
    height: 200,
    width: '100%',
    position: 'relative',
    backgroundColor: '#1E293B',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },
  headerBackBtn: {
    position: 'absolute',
    top: 24,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: -30,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 15,
    elevation: 4,
  },
  restaurantName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  restaurantCategory: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  statDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 20,
  },
  categoryBlock: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
    paddingLeft: 10,
  },
  menuItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1.5,
  },
  menuItemInfo: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 12,
  },
  menuItemName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  menuItemDesc: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 4,
    lineHeight: 15,
  },
  menuItemPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  menuItemRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemImage: {
    width: 80,
    height: 80,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  menuItemImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FF9500',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 12,
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addBtnText: {
    color: '#FF9500',
    fontSize: 12,
    fontWeight: '800',
  },
  quantityContainer: {
    position: 'absolute',
    bottom: -6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FF9500',
    borderRadius: 10,
    height: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  qtyBtn: {
    paddingHorizontal: 8,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    paddingHorizontal: 4,
  },
  cartBar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 6,
  },
  cartBarInfo: {
    flex: 1,
  },
  cartBarQty: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  cartBarTotal: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  cartBarBtn: {
    backgroundColor: '#FF9500',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartBarBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
