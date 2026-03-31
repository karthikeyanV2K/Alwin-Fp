/**
 * CameraScreen.js — Premium Vision Detection UI
 * ================================================
 * Streams camera frames via WebSocket to FastAPI server.
 * Sends room context with every frame for multi-bulb routing.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, Modal, SafeAreaView, Animated, Dimensions, ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// Room-specific light devices + others
const APPLIANCES = [
  { name: 'Light_Bedroom', label: 'Bedroom',     icon: '🛏️', color: '#7c3aed', pin: 19 },
  { name: 'Light_Living',  label: 'Living Room', icon: '🛋️', color: '#f59e0b', pin: 18 },
  { name: 'Light_Kitchen', label: 'Kitchen',     icon: '🍳', color: '#10b981', pin: 23 },
  { name: 'Plug',          label: 'Plug',        icon: '🔌', color: '#3b82f6', pin: 21 },
  { name: 'TV',            label: 'TV',          icon: '📺', color: '#06b6d4', pin: 4  },
  { name: 'Fan',           label: 'Fan',         icon: '🌀', color: '#ec4899', pin: 5  },
];
const META = Object.fromEntries(APPLIANCES.map(a => [a.name, a]));
const FPS_RATE = 2;

// ── Animated scanning corners ─────────────────────────────────────────────────
function ScanCorners({ color }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.0] });
  const c = color || '#a78bfa';
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      <View style={[styles.corner, styles.cornerTL, { borderColor: c }]} />
      <View style={[styles.corner, styles.cornerTR, { borderColor: c }]} />
      <View style={[styles.corner, styles.cornerBL, { borderColor: c }]} />
      <View style={[styles.corner, styles.cornerBR, { borderColor: c }]} />
    </Animated.View>
  );
}

// ── Circular confidence arc ───────────────────────────────────────────────────
function ConfidenceArc({ fill, color }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: fill, duration: 300, useNativeDriver: false }).start();
  }, [fill]);
  const barWidth = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.arcTrack}>
      <Animated.View style={[styles.arcBar, { width: barWidth, backgroundColor: color || '#7c3aed' }]} />
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CameraScreen({ serverIp, route }) {
  const room          = route?.params?.room ?? null;
  const resolvedIp    = serverIp ?? route?.params?.serverIp;

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef   = useRef(null);
  const wsRef       = useRef(null);
  const intervalRef = useRef(null);

  const [connected,        setConnected]        = useState(false);
  const [streaming,        setStreaming]         = useState(false);
  const [status,           setStatus]           = useState(null);
  const [confirmAppliance, setConfirmAppliance] = useState(null);
  const [detecting,        setDetecting]        = useState(null);
  const [devices,          setDevices]          = useState(
    Object.fromEntries(APPLIANCES.map(a => [a.name, 'OFF']))
  );

  const serverBase = resolvedIp?.includes(':') ? resolvedIp : `${resolvedIp}:8000`;
  const httpUrl    = `http://${serverBase}`;
  const wsUrl      = `ws://${serverBase}/stream`;

  // ── WebSocket ──────────────────────────────────────────────────────────────
  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen  = () => setConnected(true);
    ws.onclose = () => { setConnected(false); stopStreaming(); };
    ws.onerror = () => setConnected(false);
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'status') {
          setStatus(msg);
          setDetecting(msg.label !== 'Other' ? (msg.resolved ?? msg.label) : null);
        } else if (msg.type === 'confirm') {
          setConfirmAppliance(msg.appliance);
        } else if (msg.type === 'result') {
          if (msg.ok && !msg.rejected) {
            setDevices(prev => ({ ...prev, [msg.appliance]: msg.state }));
          }
        }
      } catch (_) {}
    };
  }, [wsUrl]);

  useEffect(() => {
    connectWs();
    return () => { stopStreaming(); wsRef.current?.close(); };
  }, [connectWs]);

  // ── Streaming ──────────────────────────────────────────────────────────────
  const startStreaming = () => {
    if (!cameraRef.current) return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      connectWs();
      Alert.alert('Connecting…', 'Waiting for server connection.');
      return;
    }
    setStreaming(true);
    intervalRef.current = setInterval(async () => {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.1, base64: true, scale: 0.5 });
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'frame', data: photo.base64, room }));
        }
      } catch (_) {}
    }, 1000 / FPS_RATE);
  };

  const stopStreaming = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setStreaming(false);
    setStatus(null);
    setDetecting(null);
  };

  // ── Manual toggle ──────────────────────────────────────────────────────────
  const manualToggle = async (device, state) => {
    try {
      const res = await fetch(`${httpUrl}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device, state }),
      });
      if (res.ok) setDevices(prev => ({ ...prev, [device]: state }));
    } catch { Alert.alert('Error', 'Server unreachable'); }
  };

  // ── Permission gate ────────────────────────────────────────────────────────
  if (!permission) return <View style={styles.root} />;
  if (!permission.granted) {
    return (
      <View style={styles.permBox}>
        <Text style={styles.permIcon}>📷</Text>
        <Text style={styles.permTitle}>Camera Access Needed</Text>
        <Text style={styles.permSub}>Required to detect appliances via ML vision</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const confPct      = status ? Math.round((status.confidence || 0) * 100) : 0;
  const fillRatio    = status?.fill ?? 0;
  const resolvedKey  = status?.resolved ?? status?.label;
  const activeMeta   = META[resolvedKey] || META[detecting] || null;
  const accentColor  = activeMeta?.color || '#7c3aed';

  // ── Room info ──────────────────────────────────────────────────────────────
  const roomMeta = room ? APPLIANCES.find(a => a.id === room || a.label === room) : null;

  return (
    <SafeAreaView style={styles.root}>

      {/* ══════════════════════════════════════════════
           CAMERA AREA (top ~55% of screen)
      ══════════════════════════════════════════════ */}
      <View style={styles.cameraWrap}>

        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

        {/* Dim overlay when not streaming */}
        {!streaming && <View style={styles.dimOverlay} />}

        {/* Scanning corners */}
        {streaming && <ScanCorners color={accentColor} />}

        {/* ── Top HUD row ── */}
        <View style={styles.hudTop}>
          {/* Room badge */}
          {room ? (
            <View style={[styles.roomBadge, { borderColor: accentColor + '88', backgroundColor: accentColor + '22' }]}>
              <Text style={styles.roomBadgeIcon}>{activeMeta?.icon ?? '💡'}</Text>
              <Text style={[styles.roomBadgeText, { color: accentColor }]}>{room}</Text>
            </View>
          ) : (
            <View style={styles.roomBadgeEmpty} />
          )}

          {/* Connection pill */}
          <View style={[styles.connPill, connected ? styles.connOk : styles.connErr]}>
            <View style={[styles.connDot, { backgroundColor: connected ? '#10b981' : '#ef4444' }]} />
            <Text style={styles.connText}>{connected ? 'Live' : 'Offline'}</Text>
          </View>
        </View>

        {/* ── Center reticle ── */}
        {streaming && (
          <View style={styles.reticle} pointerEvents="none">
            <View style={[styles.reticleInner, { borderColor: accentColor }]} />
            {activeMeta && (
              <Text style={styles.reticleLabel}>
                {activeMeta.icon}  {activeMeta.label}  {confPct}%
              </Text>
            )}
          </View>
        )}

        {/* ── LIVE badge ── */}
        {streaming && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveTxt}>LIVE</Text>
          </View>
        )}
      </View>

      {/* ══════════════════════════════════════════════
           BOTTOM PANEL
      ══════════════════════════════════════════════ */}
      <View style={styles.panel}>

        {/* ── Detection status ── */}
        <View style={styles.detectSection}>
          <View style={styles.detectRow}>
            <View style={styles.detectLeft}>
              <Text style={styles.detectLabel}>
                {!status
                  ? 'Waiting for camera…'
                  : status.label === 'Other'
                  ? 'No appliance in frame'
                  : `${activeMeta?.icon ?? '💡'}  ${status.label}${room ? ` · ${room}` : ''}`}
              </Text>
              {status && status.label !== 'Other' && (
                <Text style={[styles.detectConf, { color: accentColor }]}>{confPct}%</Text>
              )}
            </View>
          </View>

          {/* Confidence bar */}
          <View style={styles.barGroup}>
            <ConfidenceArc fill={fillRatio} color={fillRatio > 0.69 ? '#10b981' : accentColor} />
            <View style={styles.barMeta}>
              <Text style={styles.barLabel}>Confidence window</Text>
              <Text style={[styles.barPct, { color: fillRatio > 0.69 ? '#10b981' : '#9ca3af' }]}>
                {Math.round(fillRatio * 100)}% / 70%
              </Text>
            </View>
          </View>
        </View>

        {/* ── Start / Stop button ── */}
        <TouchableOpacity
          style={[styles.mainBtn, streaming ? styles.mainBtnStop : { backgroundColor: accentColor }]}
          onPress={streaming ? stopStreaming : startStreaming}
          activeOpacity={0.85}
        >
          <Text style={styles.mainBtnText}>
            {streaming ? '■  Stop Detection' : '▶  Start Camera & Detect'}
          </Text>
        </TouchableOpacity>

        {/* ── Device grid ── */}
        <Text style={styles.deviceHeading}>DEVICES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.deviceRow}>
          {APPLIANCES.map(a => {
            const isOn  = devices[a.name] === 'ON';
            const isDet = detecting === a.name;
            return (
              <View
                key={a.name}
                style={[
                  styles.deviceCard,
                  isOn  && { borderColor: a.color, backgroundColor: a.color + '18' },
                  isDet && { borderColor: a.color },
                ]}
              >
                {isDet && <View style={[styles.devicePulse, { borderColor: a.color }]} />}
                <Text style={styles.deviceIcon}>{a.icon}</Text>
                <Text style={styles.deviceLabel}>{a.label}</Text>
                <Text style={[styles.deviceState, isOn && { color: a.color }]}>
                  {isOn ? '● ON' : '○ OFF'}
                </Text>
                <View style={styles.deviceBtns}>
                  <TouchableOpacity
                    style={[styles.dBtn, styles.dBtnOn, isOn && styles.dBtnDim]}
                    onPress={() => manualToggle(a.name, 'ON')}
                    disabled={isOn}
                  >
                    <Text style={styles.dBtnTxt}>ON</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dBtn, styles.dBtnOff, !isOn && styles.dBtnDim]}
                    onPress={() => manualToggle(a.name, 'OFF')}
                    disabled={!isOn}
                  >
                    <Text style={styles.dBtnTxt}>OFF</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* ══════════════════════════════════════════════
           CONFIRM MODAL
      ══════════════════════════════════════════════ */}
      <Modal visible={!!confirmAppliance} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { borderColor: META[confirmAppliance]?.color ?? accentColor }]}>
            {/* Glow top */}
            <View style={[styles.modalGlow, { backgroundColor: (META[confirmAppliance]?.color ?? accentColor) + '30' }]} />

            <Text style={styles.modalEmoji}>{META[confirmAppliance]?.icon ?? '💡'}</Text>
            <Text style={styles.modalTitle}>Appliance Detected!</Text>
            <Text style={[styles.modalName, { color: META[confirmAppliance]?.color ?? '#fff' }]}>
              {META[confirmAppliance]?.label ?? confirmAppliance}
            </Text>
            {room && <Text style={styles.modalRoom}>📍 {room}</Text>}
            <Text style={styles.modalQ}>Turn it ON?</Text>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalSkip}
                onPress={() => {
                  wsRef.current?.send(JSON.stringify({ type: 'user-reject' }));
                  setConfirmAppliance(null);
                }}
              >
                <Text style={styles.modalSkipTxt}>✕  Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, { backgroundColor: META[confirmAppliance]?.color ?? accentColor }]}
                onPress={() => {
                  wsRef.current?.send(JSON.stringify({ type: 'user-confirm', appliance: confirmAppliance }));
                  setConfirmAppliance(null);
                }}
              >
                <Text style={styles.modalConfirmTxt}>✓  Turn ON</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const PANEL_H = height * 0.46;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060610' },

  // Permission
  permBox: { flex: 1, backgroundColor: '#060610', justifyContent: 'center', alignItems: 'center', padding: 32 },
  permIcon: { fontSize: 56, marginBottom: 20 },
  permTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 8 },
  permSub: { color: '#6b7280', fontSize: 14, textAlign: 'center', marginBottom: 28 },
  permBtn: { backgroundColor: '#7c3aed', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  permBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  // Camera
  cameraWrap: { height: height - PANEL_H, position: 'relative', overflow: 'hidden' },
  dimOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000055' },

  // HUD
  hudTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 20,
  },
  roomBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 30,
    borderWidth: 1, backgroundColor: '#00000050',
  },
  roomBadgeIcon: { fontSize: 14 },
  roomBadgeText: { fontSize: 13, fontWeight: '800' },
  roomBadgeEmpty: { width: 80 },

  connPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    backgroundColor: '#00000070',
  },
  connOk: { borderWidth: 1, borderColor: '#10b98144' },
  connErr: { borderWidth: 1, borderColor: '#ef444444' },
  connDot: { width: 7, height: 7, borderRadius: 4 },
  connText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Scanning corners
  corner: { position: 'absolute', width: 28, height: 28 },
  cornerTL: { top: 60, left: 20, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 60, right: 20, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 20, left: 20, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 20, right: 20, borderBottomWidth: 3, borderRightWidth: 3 },

  // Reticle
  reticle: { position: 'absolute', top: '30%', left: '50%', transform: [{ translateX: -40 }, { translateY: -40 }], alignItems: 'center' },
  reticleInner: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, opacity: 0.7 },
  reticleLabel: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 8, backgroundColor: '#00000088', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },

  // LIVE
  liveBadge: { position: 'absolute', bottom: 16, left: 16, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#ef444490', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveTxt: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  // Bottom panel
  panel: { flex: 1, backgroundColor: '#080818', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 20, paddingHorizontal: 16, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#14142a' },

  // Detection
  detectSection: { marginBottom: 14 },
  detectRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  detectLeft: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detectLabel: { color: '#e5e7eb', fontSize: 17, fontWeight: '700', flex: 1 },
  detectConf: { fontSize: 20, fontWeight: '900' },
  barGroup: { gap: 6 },
  arcTrack: { height: 5, backgroundColor: '#111827', borderRadius: 4, overflow: 'hidden' },
  arcBar: { height: '100%', borderRadius: 4 },
  barMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { color: '#374151', fontSize: 10 },
  barPct: { fontSize: 10, fontWeight: '700' },

  // Main button
  mainBtn: { padding: 17, borderRadius: 16, alignItems: 'center', marginBottom: 16 },
  mainBtnStop: { backgroundColor: '#ef4444' },
  mainBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },

  // Devices
  deviceHeading: { color: '#374151', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 10 },
  deviceRow: { flexGrow: 0 },
  deviceCard: {
    width: 110, backgroundColor: '#0d0d20', borderRadius: 16, padding: 12,
    marginRight: 10, borderWidth: 1.5, borderColor: '#1a1a30', position: 'relative',
  },
  devicePulse: { position: 'absolute', top: -2, bottom: -2, left: -2, right: -2, borderWidth: 2, borderRadius: 18, opacity: 0.5 },
  deviceIcon: { fontSize: 22, marginBottom: 4 },
  deviceLabel: { color: '#e5e7eb', fontSize: 12, fontWeight: '700', marginBottom: 2 },
  deviceState: { color: '#374151', fontSize: 9, fontWeight: '800', marginBottom: 8 },
  deviceBtns: { flexDirection: 'row', gap: 5 },
  dBtn: { flex: 1, paddingVertical: 5, borderRadius: 7, alignItems: 'center' },
  dBtnOn: { backgroundColor: '#1f2937' },
  dBtnOff: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937' },
  dBtnDim: { opacity: 0.3 },
  dBtnTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Modal
  modalBg: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#0d0d1e', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 32, alignItems: 'center', borderWidth: 1, borderBottomWidth: 0, overflow: 'hidden',
  },
  modalGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 120, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  modalEmoji: { fontSize: 60, marginBottom: 16, zIndex: 1 },
  modalTitle: { color: '#9ca3af', fontSize: 14, fontWeight: '700', letterSpacing: 1, marginBottom: 6, zIndex: 1 },
  modalName: { fontSize: 32, fontWeight: '900', marginBottom: 4, zIndex: 1 },
  modalRoom: { color: '#6b7280', fontSize: 13, marginBottom: 16, zIndex: 1 },
  modalQ: { color: '#a78bfa', fontSize: 15, fontWeight: '600', marginBottom: 28, zIndex: 1 },
  modalBtns: { flexDirection: 'row', gap: 12, width: '100%', zIndex: 1 },
  modalSkip: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center', backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937' },
  modalSkipTxt: { color: '#6b7280', fontWeight: '800', fontSize: 15 },
  modalConfirm: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  modalConfirmTxt: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
