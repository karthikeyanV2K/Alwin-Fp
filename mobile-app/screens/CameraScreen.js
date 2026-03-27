import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  Image,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import axios from 'axios';

export default function CameraScreen({ serverIp }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detection, setDetection] = useState(null);
  const [lastPhoto, setLastPhoto] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const detectionIntervalRef = useRef(null);
  const serverBaseUrl = serverIp?.includes(':')
    ? `http://${serverIp}`
    : `http://${serverIp}:8000`;

  useEffect(() => {
    if (!permission) {
      return;
    }

    if (!permission.granted) {
      requestPermission();
    }
  }, [permission]);

  const captureAndDetect = async () => {
    if (!cameraRef.current || isDetecting) return;

    try {
      setIsDetecting(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      setLastPhoto(photo.uri);

      // Send to backend
      const formData = new FormData();
      formData.append('file', {
        uri: photo.uri,
        type: 'image/jpeg',
        name: 'frame.jpg',
      });

      const response = await axios.post(
        `${serverBaseUrl}/detect`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 10000,
        }
      );

      if (response.data) {
        setDetection(response.data);
        setShowModal(true);
      }
    } catch (error) {
      console.error('Detection error:', error);
      Alert.alert('Error', 'Failed to detect. Check server connection.');
    } finally {
      setIsDetecting(false);
    }
  };

  const startStreaming = () => {
    if (isStreaming) {
      stopStreaming();
      return;
    }

    setIsStreaming(true);
    detectionIntervalRef.current = setInterval(() => {
      captureAndDetect();
    }, 2000); // Detect every 2 seconds
  };

  const stopStreaming = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    setIsStreaming(false);
  };

  const handleConfirm = async (isCorrect) => {
    try {
      if (detection && lastPhoto) {
        await axios.post(
          `${serverBaseUrl}/feedback`,
          {
            predicted_class: detection.class,
            confidence: detection.confidence,
            is_correct: isCorrect,
            image_path: lastPhoto,
          },
          { timeout: 5000 }
        );

        Alert.alert(
          'Thanks!',
          isCorrect ? 'Feedback saved!' : 'We will improve!'
        );
      }
    } catch (error) {
      console.error('Feedback error:', error);
    }

    setShowModal(false);
  };

  if (!permission) {
    return <Text>Loading...</Text>;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>
            Camera permission required
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={requestPermission}
          >
            <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
        />
        
        {isDetecting && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Detecting...</Text>
          </View>
        )}
      </View>

      <View style={styles.controlPanel}>
        <TouchableOpacity
          style={[styles.button, isStreaming && styles.buttonActive]}
          onPress={startStreaming}
          disabled={isDetecting}
        >
          <Text style={styles.buttonText}>
            {isStreaming ? '⏹ Stop Stream' : '▶ Start Stream'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={captureAndDetect}
          disabled={isDetecting || isStreaming}
        >
          <Text style={styles.buttonText}>📷 Capture</Text>
        </TouchableOpacity>
      </View>

      {/* Detection Result Modal */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Detection Result</Text>

            {lastPhoto && (
              <Image
                source={{ uri: lastPhoto }}
                style={styles.previewImage}
              />
            )}

            {detection && (
              <ScrollView style={styles.resultsScroll}>
                <View style={styles.resultBox}>
                  <Text style={styles.resultLabel}>Detected Class:</Text>
                  <Text style={styles.resultValue}>{detection.class}</Text>

                  <Text style={styles.resultLabel}>Confidence:</Text>
                  <Text style={styles.resultValue}>
                    {(detection.confidence * 100).toFixed(1)}%
                  </Text>

                  <Text style={styles.resultLabel}>All Predictions:</Text>
                  {Object.entries(detection.all_predictions || {}).map(
                    ([cls, conf]) => (
                      <View key={cls} style={styles.predictionRow}>
                        <Text style={styles.predictionClass}>{cls}</Text>
                        <View style={styles.confidenceBar}>
                          <View
                            style={[
                              styles.confidenceFill,
                              { width: `${conf * 100}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.predictionConf}>
                          {(conf * 100).toFixed(1)}%
                        </Text>
                      </View>
                    )
                  )}
                </View>

                <Text style={styles.confirmQuestion}>Is this correct?</Text>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonYes]}
                    onPress={() => handleConfirm(true)}
                  >
                    <Text style={styles.buttonText}>✓ Yes</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, styles.buttonNo]}
                    onPress={() => handleConfirm(false)}
                  >
                    <Text style={styles.buttonText}>✗ No</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.button, styles.buttonClose]}
                  onPress={() => setShowModal(false)}
                >
                  <Text style={styles.buttonText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
    borderBottomWidth: 2,
    borderBottomColor: '#333',
  },
  camera: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  controlPanel: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#1a1a1a',
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: {
    backgroundColor: '#ff3b30',
  },
  buttonSecondary: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  permissionText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    padding: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 15,
  },
  resultsScroll: {
    maxHeight: '50%',
  },
  resultBox: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  resultLabel: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 10,
  },
  resultValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 5,
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  predictionClass: {
    color: '#fff',
    width: 60,
    fontWeight: '600',
  },
  confidenceBar: {
    flex: 1,
    height: 20,
    backgroundColor: '#444',
    borderRadius: 4,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  predictionConf: {
    color: '#fff',
    width: 50,
    textAlign: 'right',
    fontWeight: '600',
  },
  confirmQuestion: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 15,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  buttonYes: {
    flex: 1,
    backgroundColor: '#34C759',
  },
  buttonNo: {
    flex: 1,
    backgroundColor: '#ff3b30',
  },
  buttonClose: {
    backgroundColor: '#5a5a5a',
  },
});
