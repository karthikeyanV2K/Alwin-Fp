/**
 * RoomSelectScreen.js — Premium Room Picker
 * ==========================================
 * User picks their room before starting camera detection.
 * The selected room is passed to CameraScreen → sent with every WS frame
 * → server maps "Light" → "Light_Bedroom" / "Light_Living" / "Light_Kitchen"
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar, Animated, Dimensions, ScrollView,
} from 'react-native';

const { width } = Dimensions.get('window');

const ROOMS = [
  {
    id: 'Bedroom',
    icon: '🛏️',
    label: 'Bedroom',
    desc: 'Master / guest bedroom',
    relay: 'Light_Bedroom',
    color: '#7c3aed',
    glow: '#7c3aed40',
  },
  {
    id: 'Living Room',
    icon: '🛋️',
    label: 'Living Room',
    desc: 'Main hall / lounge',
    relay: 'Light_Living',
    color: '#f59e0b',
    glow: '#f59e0b40',
  },
  {
    id: 'Kitchen',
    icon: '🍳',
    label: 'Kitchen',
    desc: 'Kitchen / dining area',
    relay: 'Light_Kitchen',
    color: '#10b981',
    glow: '#10b98140',
  },
];

// Subtle animated glow rings for selected card
function GlowPulse({ color }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] });
  const scale   = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: 22, borderWidth: 2, borderColor: color, opacity, transform: [{ scale }] },
      ]}
      pointerEvents="none"
    />
  );
}

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

export default function RoomSelectScreen({ navigation, serverIp, route }) {
  const [selected, setSelected] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const resolvedIp = serverIp ?? route?.params?.serverIp;
  const serverBase = resolvedIp?.includes(':') ? resolvedIp : `${resolvedIp}:8000`;

  // Scale animation per card
  const scales = useRef(ROOMS.map(() => new Animated.Value(1))).current;

  const handleSelect = (room, i) => {
    setSelected(room);
    Animated.sequence([
      Animated.timing(scales[i], { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.spring(scales[i], { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  };

  const handleProceed = () => {
    if (!selected) return;
    navigation.navigate('CameraScreen', { room: selected.id, serverIp: resolvedIp });
  };

  const handleAutoDetect = async () => {
    setIsScanning(true);
    try {
      // NOTE: Real WiFi RSSI scanning requires react-native-wifi-reborn (bare workflow).
      // Simulating a scan payload here so the FastAPI backend logic is exercised:
      const mockRssi = -30 - Math.random() * 50; // simulates -30 to -80
      const res = await fetch(`http://${serverBase}/wifi-position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ bssid: 'router_mac_mock', ssid: 'Home_WiFi', rssi: mockRssi }]),
      });
      const data = await res.json();
      
      if (data.status === 'success') {
        const idx = ROOMS.findIndex(r => r.id === data.room);
        if (idx !== -1) handleSelect(ROOMS[idx], idx);
      }
    } catch (e) {
      console.warn('Auto detect failed:', e);
    }
    setTimeout(() => setIsScanning(false), 800); // Artificial delay for UI effect
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#060610" />
      <AmbientGlow />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerGlow} />
          <Text style={styles.headerIcon}>💡</Text>
          <Text style={styles.headerTitle}>Select Room</Text>
          <Text style={styles.headerSub}>
            Point your camera at a bulb.{'\n'}
            We'll control the right one based on your room.
          </Text>
        </View>

        {/* ── Step indicator ── */}
        <View style={styles.steps}>
          <View style={styles.stepDone}><Text style={styles.stepNumDone}>✓</Text></View>
          <View style={styles.stepLine} />
          <View style={styles.stepActive}><Text style={styles.stepNum}>2</Text></View>
          <View style={[styles.stepLine, { opacity: 0.3 }]} />
          <View style={styles.stepInactive}><Text style={[styles.stepNum, { color: '#374151' }]}>3</Text></View>
        </View>
        <View style={styles.stepLabels}>
          <Text style={styles.stepLabelDone}>Server</Text>
          <Text style={styles.stepLabelActive}>Room</Text>
          <Text style={styles.stepLabelInactive}>Detect</Text>
        </View>

        {/* ── Room Cards ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>CHOOSE YOUR ROOM</Text>
          <TouchableOpacity 
            style={[styles.autoBtn, isScanning && { opacity: 0.6 }]} 
            onPress={handleAutoDetect}
            disabled={isScanning}
          >
            <Text style={styles.autoBtnText}>
              {isScanning ? 'Scanning WiFi...' : '🎯 Auto-Detect'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.cardList}>
          {ROOMS.map((room, i) => {
            const isSel = selected?.id === room.id;
            return (
              <Animated.View key={room.id} style={{ transform: [{ scale: scales[i] }] }}>
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => handleSelect(room, i)}
                  style={[styles.card, isSel && { borderColor: room.color, backgroundColor: '#0d0d22' }]}
                >
                  {isSel && <GlowPulse color={room.color} />}

                  {/* Left icon */}
                  <View style={[styles.iconBox, isSel && { backgroundColor: room.glow, borderColor: room.color + '66' }]}>
                    <Text style={styles.cardIcon}>{room.icon}</Text>
                  </View>

                  {/* Text */}
                  <View style={styles.cardBody}>
                    <Text style={[styles.cardTitle, isSel && { color: room.color }]}>{room.label}</Text>
                    <Text style={styles.cardDesc}>{room.desc}</Text>
                    <View style={styles.relayBadge}>
                      <Text style={[styles.relayText, isSel && { color: room.color }]}>
                        ⚡ {room.relay}
                      </Text>
                    </View>
                  </View>

                  {/* Radio */}
                  <View style={[styles.radio, isSel && { borderColor: room.color }]}>
                    {isSel && <View style={[styles.radioDot, { backgroundColor: room.color }]} />}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* ── How it works ── */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How room detection works</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoStep}>1</Text>
            <Text style={styles.infoText}>You pick a room — this sets the relay target</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoStep}>2</Text>
            <Text style={styles.infoText}>Camera detects a light bulb via ML model</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoStep}>3</Text>
            <Text style={styles.infoText}>ESP32 fires that room's relay → bulb toggles</Text>
          </View>
        </View>

      </ScrollView>

      {/* ── Proceed Button (sticky bottom) ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.proceedBtn,
            selected ? { backgroundColor: selected.color } : styles.proceedDisabled,
          ]}
          onPress={handleProceed}
          disabled={!selected}
          activeOpacity={0.85}
        >
          <Text style={styles.proceedText}>
            {selected ? `Start Camera  →  ${selected.label}` : 'Select a room to continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060610' },
  scroll: { paddingBottom: 20 },

  // Ambient Orbs
  orb: { position: 'absolute', width: 300, height: 300, borderRadius: 150, opacity: 0.15, filter: 'blur(50px)' },
  orb1: { top: -100, left: -100, backgroundColor: '#7c3aed' },
  orb2: { bottom: 100, right: -100, backgroundColor: '#10b981' },

  // Header
  header: { alignItems: 'center', paddingTop: 32, paddingBottom: 24, paddingHorizontal: 24, position: 'relative', overflow: 'hidden' },
  headerGlow: { position: 'absolute', top: -40, width: 260, height: 260, borderRadius: 130, backgroundColor: '#7c3aed18' },
  headerIcon: { fontSize: 52, marginBottom: 14 },
  headerTitle: { color: '#f0f0ff', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
  headerSub: { color: '#6b7280', fontSize: 14, textAlign: 'center', lineHeight: 22 },

  // Steps
  steps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0, marginTop: 8, paddingHorizontal: 60 },
  stepDone: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center' },
  stepNumDone: { color: '#fff', fontSize: 12, fontWeight: '900' },
  stepActive: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#7c3aed', justifyContent: 'center', alignItems: 'center' },
  stepInactive: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#111827', borderWidth: 1, borderColor: '#374151', justifyContent: 'center', alignItems: 'center' },
  stepNum: { color: '#fff', fontSize: 12, fontWeight: '800' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#7c3aed', marginHorizontal: 4 },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 40, marginTop: 6, marginBottom: 24 },
  stepLabelDone: { color: '#10b981', fontSize: 10, fontWeight: '700', textAlign: 'center', flex: 1 },
  stepLabelActive: { color: '#a78bfa', fontSize: 10, fontWeight: '700', textAlign: 'center', flex: 1 },
  stepLabelInactive: { color: '#374151', fontSize: 10, fontWeight: '700', textAlign: 'center', flex: 1 },

  // Section label & Auto-detect
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionLabel: { color: '#374151', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  autoBtn: { backgroundColor: '#7c3aed22', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#7c3aed55' },
  autoBtnText: { color: '#a78bfa', fontSize: 11, fontWeight: '800' },

  // Cards
  cardList: { paddingHorizontal: 16, gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#0b0b1a', borderRadius: 22, borderWidth: 1.5,
    borderColor: '#1a1a30', padding: 18,
    position: 'relative', overflow: 'hidden',
  },
  iconBox: {
    width: 60, height: 60, borderRadius: 18,
    backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937',
    justifyContent: 'center', alignItems: 'center',
  },
  cardIcon: { fontSize: 30 },
  cardBody: { flex: 1 },
  cardTitle: { color: '#e5e7eb', fontSize: 17, fontWeight: '800', marginBottom: 3 },
  cardDesc: { color: '#6b7280', fontSize: 12, marginBottom: 6 },
  relayBadge: { alignSelf: 'flex-start', backgroundColor: '#111827', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  relayText: { color: '#4b5563', fontSize: 10, fontWeight: '700', fontVariant: ['monospace'] },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#374151', justifyContent: 'center', alignItems: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },

  // Info box
  infoBox: { margin: 16, marginTop: 24, backgroundColor: '#0b0b1a', borderRadius: 18, borderWidth: 1, borderColor: '#1a1a30', padding: 18 },
  infoTitle: { color: '#6b7280', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  infoStep: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1f2937', textAlign: 'center', lineHeight: 22, color: '#9ca3af', fontSize: 11, fontWeight: '800', overflow: 'hidden' },
  infoText: { color: '#6b7280', fontSize: 13, flex: 1, lineHeight: 20 },

  // Footer
  footer: { padding: 16, paddingBottom: 24, backgroundColor: '#060610', borderTopWidth: 1, borderTopColor: '#0f0f20' },
  proceedBtn: { padding: 18, borderRadius: 18, alignItems: 'center' },
  proceedDisabled: { backgroundColor: '#111827' },
  proceedText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
});
