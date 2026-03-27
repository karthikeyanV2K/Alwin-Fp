import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ConfigScreen({ onConfigured }) {
  const [serverIp, setServerIp] = useState(null);
  const [manualIp, setManualIp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('Enter your server IP address');

  useEffect(() => {
    initializeConfig();
  }, []);

  const initializeConfig = async () => {
    try {
      // Check if we have saved IP
      const savedIp = await AsyncStorage.getItem('SERVER_IP');
      if (savedIp) {
        if (await testConnection(savedIp)) {
          setServerIp(savedIp);
          setStatus(`Connected to ${savedIp}`);
          setTimeout(() => onConfigured(savedIp), 500);
          return;
        }
      }
      setStatus('Enter your server IP (e.g., 192.168.1.100)');
    } catch (error) {
      console.error('Config error:', error);
      setStatus('Enter your server IP');
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
    } catch (error) {
      console.error('Connection test error for', ip, ':', error.message);
      return false;
    }
  };

  const handleConnect = async () => {
    if (!manualIp.trim()) {
      Alert.alert('Error', 'Please enter an IP address');
      return;
    }

    setIsLoading(true);
    setStatus('Testing connection...');

    try {
      const ip = normalizeServerHost(manualIp);
      const isConnected = await testConnection(ip);

      if (isConnected) {
        await AsyncStorage.setItem('SERVER_IP', ip);
        setServerIp(ip);
        setStatus(`✓ Connected to ${ip}`);
        setTimeout(() => onConfigured(ip), 500);
      } else {
        Alert.alert(
          'Connection Failed',
          `Cannot connect to ${ip}:8000\n\nMake sure:\n1. Server is running\n2. IP is correct\n3. Same WiFi network`
        );
        setStatus('Connection failed. Try again.');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
      setStatus('Error. Try again.');
    } finally {
      setIsLoading(false);
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Server Configuration</Text>
          <Text style={styles.subtitle}>Alwin Appliance Detector</Text>
        </View>

        <View style={styles.statusBox}>
          <Text style={styles.statusText}>{status}</Text>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.label}>Server IP Address</Text>
          <TextInput
            style={styles.input}
            placeholder="192.168.1.100"
            placeholderTextColor="#999"
            value={manualIp}
            onChangeText={setManualIp}
            editable={!isLoading}
            keyboardType="decimal-pad"
          />
          <Text style={styles.hint}>
            On your server PC, open PowerShell and run: ipconfig
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleConnect}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Connect</Text>
          )}
        </TouchableOpacity>

        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>How to find your server IP:</Text>
          <Text style={styles.helpText}>
            1. On your Windows PC, open PowerShell{'\n'}
            2. Type: ipconfig{'\n'}
            3. Look for "IPv4 Address" (e.g., 192.168.1.100){'\n'}
            4. Enter it above{'\n'}
            5. Make sure server is running on port 8000
          </Text>
        </View>

        <View style={styles.exampleBox}>
          <Text style={styles.exampleLabel}>Example:</Text>
          <Text style={styles.exampleText}>192.168.1.100</Text>
          <TouchableOpacity onPress={() => setManualIp('192.168.1.100')}>
            <Text style={styles.copyText}>Tap to use example</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  header: {
    marginBottom: 25,
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
  inputSection: {
    marginBottom: 25,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
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
  hint: {
    color: '#999',
    fontSize: 12,
    marginTop: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 25,
  },
  buttonDisabled: {
    backgroundColor: '#0052CC',
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
  exampleBox: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#444',
  },
  exampleLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 5,
  },
  exampleText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  copyText: {
    color: '#007AFF',
    fontSize: 12,
    fontStyle: 'italic',
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
