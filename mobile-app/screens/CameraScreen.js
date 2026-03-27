import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, Modal, SafeAreaView, Dimensions, ScrollView
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const APPLIANCES = [
  { name: 'Light', icon: '💡', color: '#f59e0b', pin: 19 },
  { name: 'Plug',  icon: '🔌', color: '#10b981', pin: 21 },
  { name: 'TV',    icon: '📺', color: '#3b82f6', pin: 4  },
  { name: 'Fan',   icon: '🌀', color: '#06b6d4', pin: 5  },
];
const META = Object.fromEntries(APPLIANCES.map(a => [a.name, a]));
const FPS_RATE = 2; // Real-time frame capture rate

export default function CameraScreen({ serverIp }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState(null);
  const [confirmAppliance, setConfirmAppliance] = useState(null);
  const [devices, setDevices] = useState(
    Object.fromEntries(APPLIANCES.map(a => [a.name, 'OFF']))
  );
  const [detecting, setDetecting] = useState(null);
  
  const wsRef = useRef(null);
  const intervalRef = useRef(null);

  const serverBaseUrl = serverIp?.includes(':') ? serverIp : `${serverIp}:8000`;
  const httpUrl = `http://${serverBaseUrl}`;
  const wsUrl   = `ws://${serverBaseUrl}/stream`;

  // ── WebSocket Connection ──
  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => { setConnected(false); stopStreaming(); };
    ws.onerror = () => { setConnected(false); };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'status') {
          setStatus(msg);
          setDetecting(msg.label !== 'Other' ? msg.label : null);
        } else if (msg.type === 'confirm') {
          setConfirmAppliance(msg.appliance);
        } else if (msg.type === 'result') {
          if (msg.ok) {
            setDevices(prev => ({ ...prev, [msg.appliance]: msg.state }));
            Alert.alert('Success', `${msg.appliance} turned ${msg.state}`);
          } else if (!msg.rejected) {
            Alert.alert('Error', `ESP32 error for ${msg.appliance}`);
          }
        }
      } catch (e) {
        console.log('WS msg parse error:', e);
      }
    };
  }, [wsUrl]);

  useEffect(() => {
    connectWs();
    return () => {
      stopStreaming();
      wsRef.current?.close();
    };
  }, [connectWs]);

  // ── Camera Streaming ──
  const startStreaming = () => {
    if (!cameraRef.current) return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      connectWs();
      Alert.alert('Connecting', 'Wait a moment for server connection...');
      return;
    }

    setStreaming(true);
    intervalRef.current = setInterval(async () => {
      try {
        if (!cameraRef.current) return;
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.1, // Lowest quality for speed/size
          base64: true,
          scale: 0.5,
        });
        
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'frame',
            data: photo.base64
          }));
        }
      } catch (error) {
        console.log('Frame capture error:', error);
      }
    }, 1000 / FPS_RATE);
  };

  const stopStreaming = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setStreaming(false);
    setStatus(null);
    setDetecting(null);
  };

  // ── Manual Control ──
  const handleManualToggle = async (device, state) => {
    try {
      const res = await fetch(`${httpUrl}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device, state }),
      });
      if (res.ok) {
        setDevices(prev => ({ ...prev, [device]: state }));
      }
    } catch {
      Alert.alert('Error', 'Server unreachable');
    }
  };

  // ── Render ──
  if (!permission) return <View style={styles.bg} />;
  if (!permission.granted) {
    return (
      <View style={styles.bgCenter}>
        <Text style={styles.text}>Camera access required.</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const confPct = status ? Math.round((status.confidence || 0) * 100) : 0;
  const fillPct = status ? Math.round((status.fill || 0) * 100) : 0;
  const fillM = META[status?.label] || { color: '#7c3aed' };

  return (
    <SafeAreaView style={styles.bg}>
      {/* ── Top Bar ── */}
      <View style={styles.navBar}>
        <Text style={styles.navTitle}>
          <Text style={{color: '#a78bfa'}}>●</Text> Vision Smart Control
        </Text>
        <View style={styles.statusPills}>
          <View style={[styles.pill, connected ? styles.pillOk : styles.pillErr]}>
            <Text style={styles.pillText}>{connected ? 'Server' : 'Offline'}</Text>
          </View>
          <View style={[styles.pill, streaming ? styles.pillLive : styles.pillWait]}>
            <Text style={styles.pillText}>{streaming ? 'Live' : 'Idle'}</Text>
          </View>
        </View>
      </View>

      {/* ── Camera Area ── */}
      <View style={styles.cameraFrame}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        
        {streaming && <View style={styles.liveBadge}><Text style={styles.liveBadgeTxt}>● LIVE</Text></View>}
        {streaming && (
          <>
            <View style={[styles.scanCorner, styles.tl]} />
            <View style={[styles.scanCorner, styles.tr]} />
            <View style={[styles.scanCorner, styles.bl]} />
            <View style={[styles.scanCorner, styles.br]} />
          </>
        )}
      </View>

      {/* ── Detection Bar ── */}
      <View style={styles.detectBar}>
        <View style={styles.detectRow}>
          <Text style={styles.detectLabel}>
            {!status ? '– Waiting' : status.label === 'Other' ? '– No appliance' : `${META[status.label]?.icon} ${status.label}`}
          </Text>
          {status && status.label !== 'Other' && <Text style={styles.detectConf}>{confPct}%</Text>}
        </View>
        
        <View style={styles.fillTrack}>
          <View style={[styles.fillBar, { width: `${fillPct}%`, backgroundColor: fillPct > 69 ? '#10b981' : fillPct > 40 ? '#f59e0b' : fillM.color }]} />
        </View>
        <View style={styles.fillLabels}>
          <Text style={styles.fillText}>Confidence window</Text>
          <Text style={styles.fillText}>{fillPct}% / 70% threshold</Text>
        </View>

        <TouchableOpacity 
          style={[styles.btnStart, streaming ? styles.btnStop : {}]}
          onPress={streaming ? stopStreaming : startStreaming}
        >
          <Text style={styles.btnText}>{streaming ? '■ Stop Detection' : '▶ Start Camera & Detect'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Device List ── */}
      <Text style={styles.sectionLabel}>CONNECTED DEVICES</Text>
      <ScrollView style={styles.deviceScroll} horizontal showsHorizontalScrollIndicator={false}>
        {APPLIANCES.map(a => {
          const isOn = devices[a.name] === 'ON';
          const isDet = detecting === a.name;
          return (
            <View key={a.name} style={[styles.deviceCard, isOn ? { borderColor: a.color, backgroundColor: `${a.color}15` } : {}]}>
              {isDet && <View style={[styles.detectRing, { borderColor: a.color }]} />}
              <Text style={styles.deviceIcon}>{a.icon}</Text>
              <Text style={styles.deviceName}>{a.name}</Text>
              <Text style={[styles.deviceState, isOn ? { color: a.color } : {}]}>{isOn ? '● ON' : '○ OFF'}</Text>
              <View style={styles.deviceBtns}>
                <TouchableOpacity style={[styles.dbtn, styles.dbtnOn, isOn ? {opacity:0.3} : {}]} onPress={()=>handleManualToggle(a.name, 'ON')} disabled={isOn}>
                  <Text style={styles.dbtnText}>ON</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.dbtn, styles.dbtnOff, !isOn ? {opacity:0.3} : {}]} onPress={()=>handleManualToggle(a.name, 'OFF')} disabled={!isOn}>
                  <Text style={styles.dbtnText}>OFF</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* ── Confirm Modal ── */}
      <Modal visible={!!confirmAppliance} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { borderColor: META[confirmAppliance]?.color || '#7c3aed' }]}>
            <Text style={styles.modalIcon}>{META[confirmAppliance]?.icon || '✨'}</Text>
            <Text style={styles.modalTitle}>Appliance Detected</Text>
            <Text style={[styles.modalName, { color: META[confirmAppliance]?.color || '#fff' }]}>{confirmAppliance}</Text>
            <Text style={styles.modalSub}>Turn it ON?</Text>
            
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.mbtn, styles.mbtnNo]} onPress={() => {
                wsRef.current?.send(JSON.stringify({ type: 'user-reject' }));
                setConfirmAppliance(null);
              }}>
                <Text style={styles.mbtnNoTxt}>✕ Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mbtn, { backgroundColor: META[confirmAppliance]?.color || '#7c3aed' }]} onPress={() => {
                wsRef.current?.send(JSON.stringify({ type: 'user-confirm', appliance: confirmAppliance }));
                setConfirmAppliance(null);
              }}>
                <Text style={styles.btnText}>✓ Turn ON</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#080812' },
  bgCenter: { flex: 1, backgroundColor: '#080812', justifyContent:'center', alignItems:'center' },
  text: { color: '#e2e2ff', marginBottom: 20 },
  
  // NavBar
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#0f0f1e', borderBottomWidth: 1, borderBottomColor: '#1e1e38' },
  navTitle: { color: '#a78bfa', fontSize: 16, fontWeight: '700' },
  statusPills: { flexDirection: 'row', gap: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: 'bold' },
  pillOk: { borderColor: '#10b98144', backgroundColor: '#10b98111' },
  pillErr: { borderColor: '#ef444444', backgroundColor: '#ef444411' },
  pillLive: { borderColor: '#ef444444', backgroundColor: '#ef444411' },
  pillWait: { borderColor: '#55556a44', backgroundColor: '#55556a11' },

  // Camera
  cameraFrame: { flex: 1, backgroundColor: '#000', margin: 16, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  camera: { flex: 1 },
  liveBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: '#ef4444aa', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  liveBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  scanCorner: { position: 'absolute', width: 24, height: 24, borderColor: '#a78bfa', opacity: 0.8 },
  tl: { top: 16, left: 16, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: 16, right: 16, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: 16, left: 16, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: 16, right: 16, borderBottomWidth: 3, borderRightWidth: 3 },

  // Detect Bar
  detectBar: { paddingHorizontal: 16, paddingBottom: 16 },
  detectRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detectLabel: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  detectConf: { color: '#a78bfa', fontSize: 16, fontWeight: 'bold' },
  fillTrack: { height: 6, backgroundColor: '#161628', borderRadius: 3, overflow: 'hidden' },
  fillBar: { height: '100%', borderRadius: 3 },
  fillLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 16 },
  fillText: { color: '#55556a', fontSize: 10 },
  btnStart: { backgroundColor: '#7c3aed', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnStop: { backgroundColor: '#ef4444' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // Devices
  sectionLabel: { color: '#55556a', fontSize: 10, fontWeight: 'bold', marginLeft: 16, letterSpacing: 1 },
  deviceScroll: { paddingHorizontal: 12, marginTop: 8, maxHeight: 120, minHeight: 120 },
  deviceCard: { width: 140, backgroundColor: '#161628', borderRadius: 14, padding: 12, marginHorizontal: 4, borderWidth: 1, borderColor: '#1e1e38', position: 'relative' },
  detectRing: { position: 'absolute', top: -2, bottom: -2, left: -2, right: -2, borderWidth: 2, borderRadius: 16, opacity: 0.5 },
  deviceIcon: { fontSize: 24, marginBottom: 4 },
  deviceName: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  deviceState: { color: '#55556a', fontSize: 10, fontWeight: 'bold', marginVertical: 4 },
  deviceBtns: { flexDirection: 'row', gap: 6, marginTop: 'auto' },
  dbtn: { flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  dbtnOn: { backgroundColor: '#333' },
  dbtnOff: { backgroundColor: '#222', borderWidth: 1, borderColor: '#333' },
  dbtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  // Modal
  modalBg: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '80%', backgroundColor: '#0f0f1e', borderRadius: 24, padding: 24, alignItems: 'center', borderWidth: 1 },
  modalIcon: { fontSize: 48, marginBottom: 12 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  modalName: { fontSize: 28, fontWeight: '900', marginBottom: 8 },
  modalSub: { color: '#a78bfa', fontSize: 14, marginBottom: 24 },
  modalBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  mbtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  mbtnNo: { backgroundColor: '#161628', borderWidth: 1, borderColor: '#2a2a4a' },
  mbtnNoTxt: { color: '#a78bfa', fontWeight: 'bold', fontSize: 16 },
  
  btnPrimary: { backgroundColor: '#7c3aed', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 }
});
