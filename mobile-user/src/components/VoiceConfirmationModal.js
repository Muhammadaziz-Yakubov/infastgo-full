import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

const DEFAULT_COORDS = {
  pickup: { name: "Milliy Bog'", address: "Toshkent", lat: 41.3023, lng: 69.2312 },
  destination: { name: "Toshkent City Mall", address: "Toshkent", lat: 41.3146, lng: 69.2435 },
};

export default function VoiceConfirmationModal({ visible, onClose, data, onConfirm }) {
  const [pickupName, setPickupName] = useState('');
  const [destName, setDestName] = useState('');
  const [tariff, setTariff] = useState('standart');
  const [error, setError] = useState('');

  useEffect(() => {
    if (data) {
      setPickupName(data.coordinates?.pickup?.name || data.parsed?.pickup || '');
      setDestName(data.coordinates?.destination?.name || data.parsed?.destination || '');
      setTariff(data.parsed?.tariff || 'standart');
      setError('');
    }
  }, [data]);

  if (!data) return null;

  const handleConfirm = () => {
    setError('');

    if (!pickupName.trim()) {
      setError("Jo'nash manzili nomi bo'sh bo'lishi mumkin emas");
      return;
    }
    if (!destName.trim()) {
      setError("Borish manzili nomi bo'sh bo'lishi mumkin emas");
      return;
    }

    const resolvedPickup = data.coordinates?.pickup
      ? { ...data.coordinates.pickup, name: pickupName }
      : { name: pickupName, address: '', lat: DEFAULT_COORDS.pickup.lat, lng: DEFAULT_COORDS.pickup.lng };

    const resolvedDest = data.coordinates?.destination
      ? { ...data.coordinates.destination, name: destName }
      : { name: destName, address: '', lat: DEFAULT_COORDS.destination.lat, lng: DEFAULT_COORDS.destination.lng };

    // Map to DB tariff naming (Uzbek keys)
    let dbTariff = 'standart';
    if (tariff === 'komfort') dbTariff = 'komfort';
    else if (tariff === 'biznes') dbTariff = 'biznes';

    onConfirm(resolvedPickup, resolvedDest, dbTariff);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>🎤 Ovozli Buyurtma Tasdiqlash</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Transcribed Text Preview */}
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>Siz aytgan matn:</Text>
              <Text style={styles.previewText}>"{data.text}"</Text>
            </View>

            {/* Pickup Field */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <View style={[styles.dot, { backgroundColor: '#00E676' }]} />
                <Text style={styles.label}>Jo'nash joyi (Qayerdan)</Text>
              </View>
              <TextInput
                style={styles.input}
                value={pickupName}
                onChangeText={setPickupName}
                placeholder="Jo'nash manzili..."
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
              <Text style={styles.coordsStatus}>
                {data.coordinates?.pickup
                  ? '🟢 Xaritadan manzil topildi'
                  : "🟡 Manzil koordinatalari taxminiy o'rnatildi"}
              </Text>
            </View>

            {/* Destination Field */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <View style={[styles.dot, { backgroundColor: '#FF1744' }]} />
                <Text style={styles.label}>Borish joyi (Qayerga)</Text>
              </View>
              <TextInput
                style={styles.input}
                value={destName}
                onChangeText={setDestName}
                placeholder="Borish manzili..."
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
              <Text style={styles.coordsStatus}>
                {data.coordinates?.destination
                  ? '🟢 Xaritadan manzil topildi'
                  : "🟡 Manzil koordinatalari taxminiy o'rnatildi"}
              </Text>
            </View>

            {/* Tariff Selector */}
            <Text style={styles.label}>Tarif turi:</Text>
            <View style={styles.tariffRow}>
              {[
                { id: 'standart', name: 'Standart', icon: 'zap' },
                { id: 'komfort', name: 'Komfort', icon: 'award' },
                { id: 'biznes', name: 'Biznes', icon: 'shield' },
              ].map((t) => {
                const isSelected = tariff === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.tariffButton,
                      isSelected && styles.tariffButtonSelected,
                    ]}
                    onPress={() => setTariff(t.id)}
                  >
                    <Feather
                      name={t.icon}
                      size={14}
                      color={isSelected ? '#000' : 'rgba(255,255,255,0.6)'}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.tariffText,
                        isSelected && styles.tariffTextSelected,
                      ]}
                    >
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Confirm Button */}
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>Buyurtmani Tasdiqlash</Text>
              <Feather name="check-circle" size={18} color="#000" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#0F0F12',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    padding: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
  },
  content: {
    marginBottom: 20,
  },
  previewBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 20,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  previewText: {
    fontSize: 15,
    fontStyle: 'italic',
    color: '#00E676',
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  coordsStatus: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
    paddingLeft: 4,
  },
  tariffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 20,
  },
  tariffButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 10,
    marginHorizontal: 4,
  },
  tariffButtonSelected: {
    backgroundColor: '#00E676',
    borderColor: '#00E676',
  },
  tariffText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  tariffTextSelected: {
    color: '#000',
    fontWeight: '700',
  },
  errorText: {
    color: '#FF1744',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00E676',
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#00E676',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  confirmButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
