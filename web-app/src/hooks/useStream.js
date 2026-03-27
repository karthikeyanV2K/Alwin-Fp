/**
 * useStream.js - WebSocket frame-streaming hook
 * Captures camera frames and sends them as Base64 JPEG over a WebSocket.
 */
import { useRef, useState, useCallback, useEffect } from 'react';

const FPS_RATE = 5;
const QUALITY = 0.75;

export function useStream({ serverUrl, onStatus, onConfirm, onResult, onLog }) {
  const wsRef = useRef(null);
  const wsConnectRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);

  const stopStreaming = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setStreaming(false);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return Promise.resolve(wsRef.current);
    }
    if (wsConnectRef.current) {
      return wsConnectRef.current;
    }

    wsConnectRef.current = new Promise((resolve) => {
      const ws = new WebSocket(serverUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        onLog?.({ type: 'success', msg: 'Connected to inference server' });
        wsConnectRef.current = null;
        resolve(ws);
      };

      ws.onmessage = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'status') onStatus?.(msg);
        if (msg.type === 'confirm') onConfirm?.(msg);
        if (msg.type === 'result') onResult?.(msg);
      };

      ws.onerror = () => {
        onLog?.({ type: 'error', msg: 'WebSocket error' });
      };

      ws.onclose = () => {
        wsConnectRef.current = null;
        wsRef.current = null;
        stopStreaming();
        setConnected(false);
        onLog?.({ type: 'error', msg: 'Disconnected from server' });
      };
    }).catch((error) => {
      wsConnectRef.current = null;
      wsRef.current = null;
      throw error;
    });

    return wsConnectRef.current;
  }, [serverUrl, onStatus, onConfirm, onResult, onLog, stopStreaming]);

  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current && videoRef.current?.srcObject) {
        return true;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => resolve();
        });
        await videoRef.current.play();
      }

      onLog?.({ type: 'success', msg: 'Camera started' });
      return true;
    } catch (err) {
      onLog?.({ type: 'error', msg: `Camera error: ${err.message}` });
      return false;
    }
  }, [onLog]);

  const stopCamera = useCallback(() => {
    stopStreaming();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause?.();
      videoRef.current.srcObject = null;
    }
  }, [stopStreaming]);

  const startStreaming = useCallback(async () => {
    if (!streamRef.current || intervalRef.current) {
      return;
    }

    const ws = await connect();
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const canvas = canvasRef.current || document.createElement('canvas');
    canvasRef.current = canvas;
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext('2d');

    intervalRef.current = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        return;
      }

      ctx.drawImage(videoRef.current, 0, 0, 224, 224);
      canvas.toBlob((blob) => {
        if (!blob || wsRef.current?.readyState !== WebSocket.OPEN) {
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const b64 = reader.result.split(',')[1];
          wsRef.current?.send(JSON.stringify({ type: 'frame', data: b64 }));
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', QUALITY);
    }, 1000 / FPS_RATE);

    setStreaming(true);
    onLog?.({ type: 'success', msg: `Streaming at ${FPS_RATE} FPS` });
  }, [connect, onLog]);

  const sendConfirm = useCallback((appliance) => {
    wsRef.current?.send(JSON.stringify({ type: 'user-confirm', appliance }));
  }, []);

  const sendReject = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'user-reject' }));
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      wsRef.current?.close();
    };
  }, [stopCamera]);

  return {
    videoRef,
    connected,
    streaming,
    connect,
    startCamera,
    stopCamera,
    startStreaming,
    stopStreaming,
    sendConfirm,
    sendReject,
  };
}
