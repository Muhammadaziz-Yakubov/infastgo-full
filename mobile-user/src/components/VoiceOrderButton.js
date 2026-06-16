import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Text,
  View,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import { api } from '../services/api';

export default function VoiceOrderButton({ onSuccess, onError, style }) {
  const [recording, setRecording] = useState(null);
  const [status, setStatus] = useState('idle'); // 'idle' | 'recording' | 'processing'

  // Animation for recording pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef(null);

  useEffect(() => {
    if (status === 'recording') {
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoopRef.current.start();
    } else {
      if (pulseLoopRef.current) {
        pulseLoopRef.current.stop();
      }
      pulseAnim.setValue(1);
    }

    return () => {
      if (pulseLoopRef.current) {
        pulseLoopRef.current.stop();
      }
    };
  }, [status]);

  async function startRecording() {
    try {
      console.log('Requesting microphone permissions...');
      const { status: permStatus } = await Audio.requestPermissionsAsync();
      if (permStatus !== 'granted') {
        onError('Mikrofon ruxsati berilmadi. Iltimos, sozlamalardan ruxsat bering.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording...');
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setStatus('recording');
    } catch (err) {
      console.error('Failed to start recording', err);
      onError('Ovoz yozishni boshlashda xatolik yuz berdi');
    }
  }

  async function stopRecording() {
    if (!recording) return;

    console.log('Stopping recording...');
    setStatus('processing');
    setRecording(null);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (!uri) {
        setStatus('idle');
        onError('Yozib olingan ovoz topilmadi');
        return;
      }

      console.log('Recording stopped, stored at:', uri);

      // Upload recording to backend STT endpoint
      const response = await api.transcribeVoice(uri);
      onSuccess(response);
    } catch (err) {
      console.error('Failed to stop/upload recording', err);
      onError(err.message || 'Ovozli buyurtmani qayta ishlashda xatolik yuz berdi');
    } finally {
      setStatus('idle');
    }
  }

  const handlePress = () => {
    if (status === 'idle') {
      startRecording();
    } else if (status === 'recording') {
      stopRecording();
    }
  };

  return (
    <View style={[styles.container, style]}>
      {status === 'recording' && (
        <Animated.View
          style={[
            styles.pulseRing,
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
      )}

      <TouchableOpacity
        style={[
          styles.button,
          status === 'recording' && styles.buttonRecording,
          status === 'processing' && styles.buttonProcessing,
        ]}
        onPress={handlePress}
        disabled={status === 'processing'}
        activeOpacity={0.8}
      >
        {status === 'processing' ? (
          <ActivityIndicator color="#000" size="small" />
        ) : (
          <Feather
            name={status === 'recording' ? 'square' : 'mic'}
            size={22}
            color={status === 'recording' ? '#FF1744' : '#000'}
          />
        )}
      </TouchableOpacity>

      <Text style={styles.statusText}>
        {status === 'recording'
          ? 'Gapiring...'
          : status === 'processing'
          ? 'Qayta ishlanmoqda...'
          : 'Ovozli buyurtma'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 20,
    right: 16,
    zIndex: 99,
  },
  button: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#00E676',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00E676',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonRecording: {
    backgroundColor: '#fff',
    shadowColor: '#FF1744',
  },
  buttonProcessing: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    shadowOpacity: 0,
  },
  pulseRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 230, 118, 0.25)',
    zIndex: -1,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 6,
    backgroundColor: 'rgba(12, 12, 16, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
});
