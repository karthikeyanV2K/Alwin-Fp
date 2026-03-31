/**
 * ConfigScreen.js — Premium Vision AI Setup
 * ==========================================
 * Initial screen to configure the FastAPI server IP.
 * Features a glowing neon aesthetic, glassmorphism cards,
 * and animated background orbs.
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, SafeAreaView, TextInput,
  Alert, ScrollView, Animated, Dimensions, StatusBar,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// ── Background Ambient Glowing Orbs ──────────────────────────────────────────
function AmbientGlow() {
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim1, { toValue: 1, duration: 8000, useNativeDriver: true }),
        Animated.timing(anim1, { toValue: 0, duration: 8000, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim2, { toValue: 1, duration: 12000, useNativeDriver: true }),
        Animated.timing(anim2, { toValue: 0, duration: 12000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const tX1 = anim1.interpolate({ inputRange: [0, 1], outputRange: [0, 100] });
  const tY1 = anim1.interpolate({ inputRange: [0, 1], outputRange: [0, 50] });
  const tX2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [0, -80] });
  const tY2 = anim2.interpolate({ inputRange: [0, 1], outputRange: [0, 100] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.orb, styles.orb1, { transform: [{ translateX: tX1 }, { translateY: tY1 }] }]} />
      <Animated.View style={[styles.orb, styles.orb2, { transform: [{ translateX: tX2 }, { translateY: tY2 }] }]} />
    </View>
  );
}

// ── Main Controller ────────────────────────────────────────────────────────
export default function ConfigScreen({ onConfigured }) {
  const [serverIp, setServerIp] = useState(null);
  const [manualIp, setManualIp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('Awaiting connection...');

  useEffect(() => {
    initializeConfig();
  }, []);

  const initializeConfig = async () => {
    try {
      const savedIp = await AsyncStorage.getItem('SERVER_IP');
      if (savedIp) {
        if (await testConnection(savedIp)) {
          setServerIp(savedIp);
          setStatus(`Connected to ${savedIp}`);
          setTimeout(() => onConfigured(savedIp), 600);
          return;
        }
      }
      setStatus('Enter your FastAPI inference server IP');
    } catch (error) {
      setStatus('Ready for configuration');
    }
  };

  const normalizeServerHost = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return trimmed.includes(':') ? trimmed : `${trimmed}:8000`;
  };

  const testConnection = async (ip) => {
    try {
      const host = normalizeServerHost(ip);
      const url = `http://${host}/health`;
      const response = await axios.get(url, { timeout: 10000 });
      return response.status === 200;
    } catch { return false; }
  };

  const handleConnect = async () => {
    if (!manualIp.trim()) {
      Alert.alert('Required', 'Please enter a valid IP address.');
      return;
    }
    setIsLoading(true);
    setStatus('Establishing neural link...');

    try {
      const ip = normalizeServerHost(manualIp);
      const isConnected = await testConnection(ip);

      if (isConnected) {
        await AsyncStorage.setItem('SERVER_IP', ip);
        setServerIp(ip);
        setStatus('Link Established');
        setTimeout(() => onConfigured(ip), 600);
      } else {
        setStatus('Connection refused. Retrying...');
        Alert.alert(
          'Connection Failed',
          `Target: ${ip}\nStatus: Unreachable\n\nVerify server is active on the same WiFi network.`
        );
      }
    } catch (error) {
      setStatus('Error establishing link.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Success State ────────────────────────────────────────────────────────
  if (serverIp) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#060610" />
        <AmbientGlow />
        <View style={styles.successContainer}>
          <View style={styles.successRing}>
            <Text style={styles.successIcon}>✓</Text>
          </View>
          <Text style={styles.successTitle}>SYSTEM ONLINE</Text>
          <Text style={styles.successSub}>{serverIp}</Text>
          <ActivityIndicator size="small" color="#10b981" style={{ marginTop: 30 }} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Configuration State ──────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#060610" />
      <AmbientGlow />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconBox}>
            <Text style={styles.headerIcon}>👁️‍🗨️</Text>
          </View>
          <Text style={styles.title}>Vision Core</Text>
          <Text style={styles.subtitle}>APPLIANCE DETECTION ENGINE</Text>
        </View>

        {/* Status Box */}
        <View style={styles.statusBox}>
          <View style={[styles.statusDot, isLoading && { backgroundColor: '#f59e0b' }]} />
          <Text style={styles.statusText}>{status}</Text>
        </View>

        {/* Input Card */}
        <View style={styles.card}>
          <Text style={styles.label}>SERVER ADDRESS (IPv4)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 192.168.1.100"
            placeholderTextColor="#4b5563"
            value={manualIp}
            onChangeText={setManualIp}
            editable={!isLoading}
            keyboardType="decimal-pad"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.hintText}>Requires FastAPI backend running on port 8000</Text>
          
          <TouchableOpacity
            style={[styles.btn, isLoading ? styles.btnLoading : styles.btnActive]}
            onPress={handleConnect}
            activeOpacity={0.8}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>INITIALIZE LINK</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Help Module */}
        <View style={styles.helpCard}>
          <Text style={styles.helpHeader}>Diagnostic Steps</Text>
          <View style={styles.helpRow}>
            <Text style={styles.helpBullet}>1</Text>
            <Text style={styles.helpText}>Open PowerShell on target server</Text>
          </View>
          <View style={styles.helpRow}>
            <Text style={styles.helpBullet}>2</Text>
            <Text style={styles.helpText}>Run command: <Text style={styles.code}>ipconfig</Text></Text>
          </View>
          <View style={styles.helpRow}>
            <Text style={styles.helpBullet}>3</Text>
            <Text style={styles.helpText}>Locate IPv4 Address and input above</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060610' },
  scroll: { padding: 24, paddingBottom: 40 },

  // Background Animations
  orb: { position: 'absolute', width: 300, height: 300, borderRadius: 150, opacity: 0.15, filter: 'blur(50px)' },
  orb1: { top: -100, left: -100, backgroundColor: '#7c3aed' },
  orb2: { bottom: 100, right: -100, backgroundColor: '#10b981' },

  // Header
  header: { alignItems: 'center', marginTop: 40, marginBottom: 40 },
  headerIconBox: { width: 70, height: 70, borderRadius: 20, backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937', justifyContent: 'center', alignItems: 'center', shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20, marginBottom: 20 },
  headerIcon: { fontSize: 36 },
  title: { color: '#f0f0ff', fontSize: 32, fontWeight: '900', letterSpacing: -1, marginBottom: 8 },
  subtitle: { color: '#7c3aed', fontSize: 11, fontWeight: '800', letterSpacing: 3 },

  // Status
  statusBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d0d1e', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#1a1a30', marginBottom: 24 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7c3aed', marginRight: 12, shadowColor: '#7c3aed', shadowOpacity: 1, shadowRadius: 6 },
  statusText: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },

  // Input Card
  card: { backgroundColor: '#0a0a16', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#1a1a30', marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20 },
  label: { color: '#6b7280', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  input: { backgroundColor: '#111827', borderRadius: 14, borderWidth: 1, borderColor: '#374151', padding: 16, color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  hintText: { color: '#4b5563', fontSize: 11, fontWeight: '500', marginBottom: 24, textAlign: 'center' },
  
  // Button
  btn: { paddingVertical: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnActive: { backgroundColor: '#7c3aed', shadowColor: '#7c3aed', shadowOpacity: 0.4, shadowRadius: 15, shadowOffset: { width: 0, height: 6 } },
  btnLoading: { backgroundColor: '#4c1d95' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },

  // Help
  helpCard: { backgroundColor: '#0b0b1a', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#161628' },
  helpHeader: { color: '#6b7280', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 16 },
  helpRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  helpBullet: { width: 20, height: 20, borderRadius: 6, backgroundColor: '#1f2937', color: '#9ca3af', fontSize: 10, fontWeight: '800', textAlign: 'center', lineHeight: 20, marginRight: 12, overflow: 'hidden' },
  helpText: { color: '#9ca3af', fontSize: 13, flex: 1 },
  code: { color: '#7c3aed', fontWeight: '800', paddingHorizontal: 6, backgroundColor: '#1f2937', borderRadius: 4, overflow: 'hidden' },

  // Success
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  successRing: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#10b98120', borderWidth: 2, borderColor: '#10b981', justifyContent: 'center', alignItems: 'center', marginBottom: 24, shadowColor: '#10b981', shadowOpacity: 0.5, shadowRadius: 30 },
  successIcon: { color: '#10b981', fontSize: 40, fontWeight: '900' },
  successTitle: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 2, marginBottom: 8 },
  successSub: { color: '#10b981', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
});
