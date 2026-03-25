import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  FlatList,
  Alert,
  TextInput,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

export default function ConfigScreen({ onConfigured }) {
  const [serverIp, setServerIp] = useState(null);
  const [detectedServers, setDetectedServers] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    initializeConfig();
  }, []);

  const initializeConfig = async () => {
    try {
      // Check if we have saved IP
      const savedIp = await AsyncStorage.getItem('SERVER_IP');
      if (savedIp && await testServerConnection(savedIp)) {
        setServerIp(savedIp);
        onConfigured(savedIp);
        return;
      }

      // Get phone's network info
      const ipAddress = await Network.getIpAddressAsync();
      setStatus(`Phone IP: ${ipAddress}\nScanning for server...`);

      // Scan for server on local network
      scanForServer(ipAddress);
    } catch (error) {
      console.error('Config init error:', error);
      setStatus('Failed to get network info. Enter IP manually.');
    }
  };

  const getNetworkPrefix = (ip) => {
    // From 192.168.1.50 → get 192.168.1
    return ip.substring(0, ip.lastIndexOf('.'));
  };

  const scanForServer = async (phoneIp) => {
    setIsScanning(true);
    const networkPrefix = getNetworkPrefix(phoneIp);
    const found = [];

    // Common server ports
    const ports = [8000, 5000, 3000];

    // Scan IPs 1-20 on the network
    const ipsToScan = Array.from({ length: 20 }, (_, i) => `${networkPrefix}.${i + 1}`);

    const promises = [];
    for (const ip of ipsToScan) {
      for (const port of ports) {
        promises.push(
          testServerConnection(`${ip}:${port}`)
            .then((isValid) => {
              if (isValid) {
                found.push(`${ip}:${port}`);
              }
            })
            .catch(() => {}) // Ignore errors
        );
      }
    }

    // Use Promise.allSettled to wait for all attempts (fast timeout)
    await Promise.allSettled(promises);

    setIsScanning(false);

    if (found.length > 0) {
      setDetectedServers(found);
      setStatus(`Found ${found.length} server(s)`);
    } else {
      setStatus('No server found. Enter IP manually.');
    }
  };

  const testServerConnection = async (serverUrl) => {
    try {
      const fullUrl = `http://${serverUrl}`;
      const response = await axios.get(`${fullUrl}/health`, {
        timeout: 2000, // 2 second timeout
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  };

  const selectServer = async (server) => {
    try {
      setStatus(`Testing ${server}...`);
      const isValid = await testServerConnection(server);

      if (isValid) {
        await AsyncStorage.setItem('SERVER_IP', server);
        setServerIp(server);
        setStatus(`✓ Connected to ${server}`);
        setTimeout(() => onConfigured(server), 1000);
      } else {
        Alert.alert('Error', `Cannot connect to ${server}`);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleManualIp = async () => {
    if (!manualIp.trim()) {
      Alert.alert('Error', 'Please enter an IP address');
      return;
    }

    const ip = manualIp.includes(':') ? manualIp : `${manualIp}:8000`;

    try {
      setStatus(`Testing ${ip}...`);
      const isValid = await testServerConnection(ip);

      if (isValid) {
        await AsyncStorage.setItem('SERVER_IP', ip);
        setServerIp(ip);
        setStatus(`✓ Connected to ${ip}`);
        setTimeout(() => onConfigured(ip), 1000);
      } else {
        Alert.alert('Error', `Cannot connect to ${ip}. Check IP and try again.`);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  if (serverIp) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successText}>Connected!</Text>
          <Text style={styles.serverIpText}>{serverIp}</Text>
          <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Server Configuration</Text>
        <Text style={styles.subtitle}>Auto-detecting server on your network...</Text>
      </View>

      <View style={styles.statusBox}>
        <Text style={styles.statusText}>{status}</Text>
      </View>

      {isScanning && (
        <View style={styles.scanningBox}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.scanningText}>Scanning network...</Text>
        </View>
      )}

      {detectedServers.length > 0 && (
        <View style={styles.serversSection}>
          <Text style={styles.sectionTitle}>Detected Servers</Text>
          <FlatList
            data={detectedServers}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.serverItem}
                onPress={() => selectServer(item)}
              >
                <Text style={styles.serverItemText}>🖥️ {item}</Text>
                <Text style={styles.serverItemPort}>Port 8000</Text>
              </TouchableOpacity>
            )}
            scrollEnabled={false}
          />
        </View>
      )}

      <View style={styles.divider}>
        <Text style={styles.dividerText}>Or</Text>
      </View>

      <View style={styles.manualSection}>
        <Text style={styles.sectionTitle}>Enter Manually</Text>
        <TextInput
          style={styles.input}
          placeholder="192.168.1.100"
          placeholderTextColor="#999"
          value={manualIp}
          onChangeText={setManualIp}
          keyboardType="decimal-pad"
        />
        <Text style={styles.inputHint}>Enter server IP (e.g., 192.168.1.100)</Text>

        <TouchableOpacity
          style={styles.button}
          onPress={handleManualIp}
          disabled={isScanning}
        >
          <Text style={styles.buttonText}>Connect</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.helpSection}>
        <Text style={styles.helpTitle}>Need help?</Text>
        <Text style={styles.helpText}>
          1. On your server PC, open PowerShell{'\n'}
          2. Run: ipconfig{'\n'}
          3. Find "IPv4 Address" (e.g., 192.168.1.100){'\n'}
          4. Enter it above
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
  },
  header: {
    marginTop: 30,
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 14,
  },
  statusBox: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  scanningBox: {
    alignItems: 'center',
    paddingVertical: 30,
    marginBottom: 20,
  },
  scanningText: {
    color: '#aaa',
    marginTop: 10,
    fontSize: 14,
  },
  serversSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  serverItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  serverItemText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  serverItemPort: {
    color: '#007AFF',
    fontSize: 12,
  },
  divider: {
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerText: {
    color: '#666',
    fontSize: 14,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 10,
  },
  manualSection: {
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    color: '#fff',
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  inputHint: {
    color: '#999',
    fontSize: 12,
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpSection: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  helpTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  helpText: {
    color: '#aaa',
    fontSize: 12,
    lineHeight: 18,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  successText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  serverIpText: {
    color: '#007AFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
