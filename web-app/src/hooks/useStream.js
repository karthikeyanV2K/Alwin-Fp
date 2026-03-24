/**
 * useStream.js — WebSocket frame-streaming hook
 * ==============================================
 * Captures camera frames at FPS_RATE and sends them as Base64 JPEG
 * over a WebSocket to the FastAPI server.
 * Exposes server messages (status, confirm, result) via callbacks.
 */
import { useRef, useState, useCallback, useEffect } from 'react';

const FPS_RATE = 5;       // frames per second sent to server
const QUALITY  = 0.75;    // JPEG quality [0-1]

export function useStream({ serverUrl, onStatus, onConfirm, onResult, onLog }) {
  const wsRef         = useRef(null);
  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);
  const streamRef     = useRef(null);
  const intervalRef   = useRef(null);
  const [connected,   setConnected]   = useState(false);
  const [streaming,   setStreaming]   = useState(false);

  // ── Connect WebSocket ────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(serverUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      onLog?.({ type: 'success', msg: 'Connected to inference server' });
    };

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'status')  onStatus?.(msg);
      if (msg.type === 'confirm') onConfirm?.(msg);
      if (msg.type === 'result')  onResult?.(msg);
    };

    ws.onerror = () => {
      onLog?.({ type: 'error', msg: 'WebSocket error' });
    };

    ws.onclose = () => {
      setConnected(false);
      setStreaming(false);
      onLog?.({ type: 'error', msg: 'Disconnected from server' });
    };
  }, [serverUrl, onStatus, onConfirm, onResult, onLog]);

  // ── Start Camera ─────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      onLog?.({ type: 'success', msg: 'Camera started' });
    } catch (err) {
      onLog?.({ type: 'error', msg: `Camera error: ${err.message}` });
    }
  }, [onLog]);

  // ── Stop Camera ──────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    stopStreaming();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // ── Start Streaming ──────────────────────────────────────────────────
  const startStreaming = useCallback(() => {
    if (!streamRef.current || !wsRef.current) return;
    if (wsRef.current.readyState !== WebSocket.OPEN) {
      connect();
      return;
    }
    const canvas = canvasRef.current || document.createElement('canvas');
    canvasRef.current = canvas;
    canvas.width = 224; canvas.height = 224;
    const ctx = canvas.getContext('2d');

    intervalRef.current = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      ctx.drawImage(videoRef.current, 0, 0, 224, 224);
      canvas.toBlob(blob => {
        if (!blob || wsRef.current?.readyState !== WebSocket.OPEN) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          const b64 = reader.result.split(',')[1];
          wsRef.current.send(JSON.stringify({ type: 'frame', data: b64 }));
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', QUALITY);
    }, 1000 / FPS_RATE);

    setStreaming(true);
    onLog?.({ type: 'success', msg: `Streaming at ${FPS_RATE} FPS` });
  }, [connect, onLog]);

  // ── Stop Streaming ───────────────────────────────────────────────────
  const stopStreaming = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setStreaming(false);
  }, []);

  // ── Send user-confirm / user-reject ──────────────────────────────────
  const sendConfirm = useCallback((appliance) => {
    wsRef.current?.send(JSON.stringify({ type: 'user-confirm', appliance }));
  }, []);

  const sendReject = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'user-reject' }));
  }, []);

  // ── Cleanup ──────────────────────────────────────────────────────────
  useEffect(() => () => {
    stopCamera();
    wsRef.current?.close();
  }, [stopCamera]);

  return {
    videoRef, connected, streaming,
    connect, startCamera, stopCamera, startStreaming, stopStreaming,
    sendConfirm, sendReject,
  };
}
