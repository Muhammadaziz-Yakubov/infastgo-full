import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Animated,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../services/api';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'InFast GO',
    subtitle: 'Tezkor va qulay shahar sayohatlari',
    desc: 'Siz uchun yangi avtomobillar va tajribali, professional haydovchilar shahar bo\'ylab xizmatingizda. Bir zumda buyurtma bering.',
    emoji: '🚖',
    bg: '#EEF2FF',
    color: '#3b32db',
  },
  {
    id: '2',
    title: 'InFast Eats',
    subtitle: 'Sevimli taomlaringiz uyingizgacha',
    desc: 'Eng mashhur restoran va kafelardan issiq taomlar, shirinliklar hamda oziq-ovqatlarni tezkorlik bilan yetkazib beramiz.',
    emoji: '🍔',
    bg: '#FFF7ED',
    color: '#FF9500',
  },
  {
    id: '3',
    title: 'InFast Courier',
    subtitle: 'Ishonchli va tezkor yetkazib berish',
    desc: 'Hujjatlar, kalitlar va posilkalaringizni ishonchli qo\'llarga topshiring. Shahar bo\'ylab tez va 100% xavfsiz yetkazamiz.',
    emoji: '📦',
    bg: '#ECFDF5',
    color: '#10B981',
  },
];

export default function OnboardingScreen({ onComplete }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const handleNext = async () => {
    if (activeSlide < SLIDES.length - 1) {
      // Transition to next slide with fade animation
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -width * (activeSlide + 1), duration: 0, useNativeDriver: false }),
      ]).start(() => {
        setActiveSlide(activeSlide + 1);
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      });
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = async () => {
    // Save onboarding completion in AsyncStorage
    await api.setOnboardingCompleted();
    onComplete();
  };

  const slide = SLIDES[activeSlide];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" translucent />

      {/* Skip Button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} activeOpacity={0.7}>
          <Text style={styles.skipText}>O'tkazib yuborish</Text>
        </TouchableOpacity>
      </View>

      {/* Main Slide Content */}
      <Animated.View style={[styles.slideContainer, { opacity: fadeAnim }]}>
        <View style={[styles.iconContainer, { backgroundColor: slide.bg }]}>
          <Text style={styles.emojiIcon}>{slide.emoji}</Text>
        </View>
        
        <View style={styles.textContainer}>
          <Text style={[styles.subtitle, { color: slide.color }]}>{slide.subtitle}</Text>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.desc}>{slide.desc}</Text>
        </View>
      </Animated.View>

      {/* Footer Navigation Bar */}
      <View style={styles.footer}>
        {/* Pagination Dots */}
        <View style={styles.paginationRow}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === activeSlide && [styles.dotActive, { backgroundColor: slide.color }],
              ]}
            />
          ))}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: slide.color }]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>
            {activeSlide === SLIDES.length - 1 ? 'Boshlash' : 'Keyingisi'}
          </Text>
          <Feather
            name={activeSlide === SLIDES.length - 1 ? 'check' : 'arrow-right'}
            size={16}
            color="#fff"
            style={{ marginLeft: 6 }}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  header: {
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    marginTop: 20,
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  skipText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  slideContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  emojiIcon: {
    fontSize: 64,
  },
  textContainer: {
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 16,
  },
  desc: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 24,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  dotActive: {
    width: 20,
    borderRadius: 4,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
