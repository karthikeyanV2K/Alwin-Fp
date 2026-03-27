import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useStream } from './hooks/useStream';

// ── PWA Install Banner ────────────────────────────────────────────────────────
function InstallBanner() {
  const [prompt, setPrompt] = useState(null);
  const [ios,    setIos]    = useState(false);
  const [shown,  setShown]  = useState(false);

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.navigator.standalone === true;
    if (isIos && !isStandalone) { setIos(true); setShown(true); }

    const handler = e => { e.preventDefault(); setPrompt(e); setShown(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!shown) return null;

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    setShown(false);
  };

  return (
    <div className="install-banner">
      <span className="install-icon">📲</span>
      <span className="install-text">
        {ios
          ? 'Install: tap Share → Add to Home Screen'
          : 'Install as an app on your phone'}
      </span>
      {!ios && <button className="install-btn" onClick={install}>Install</button>}
      <button className="install-close" onClick={() => setShown(false)}>✕</button>
    </div>
  );
}

// ── Config ────────────────────────────────────────────────────────────────────
const APPLIANCES = [
  { name: 'Light', icon: '💡', color: '#f59e0b' },
  { name: 'Plug',  icon: '🔌', color: '#10b981' },
  { name: 'TV',    icon: '📺', color: '#3b82f6' },
  { name: 'Fan',   icon: '🌀', color: '#06b6d4' },
  { name: 'AC',    icon: '❄️', color: '#8b5cf6' },
];
const META = Object.fromEntries(APPLIANCES.map(a => [a.name, a]));
const SERVER_DEFAULT = 'ws://localhost:8000/stream';
const MAX_LOGS = 40;
const ts = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// ── Confirmation Modal ────────────────────────────────────────────────────────
function ConfirmModal({ appliance, onConfirm, onReject }) {
  const m = META[appliance] || { icon: '🔌', color: '#7c3aed' };
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-glow" style={{ background: m.color }} />
        <div className="modal-icon" style={{ color: m.color }}>{m.icon}</div>
        <h2 className="modal-title">Appliance Detected</h2>
        <div className="modal-name" style={{ color: m.color }}>{appliance}</div>
        <p className="modal-sub">AI vision system confirmed this appliance.<br/>Turn it <strong>ON</strong>?</p>
        <div className="modal-btns">
          <button className="mbtn mbtn-no"  onClick={onReject}>✕ Skip</button>
          <button className="mbtn mbtn-yes" style={{ background: m.color }} onClick={onConfirm}>✓ Turn ON</button>
        </div>
      </div>
    </div>
  );
}

// ── Device Card ───────────────────────────────────────────────────────────────
function DeviceCard({ app, isOn, onToggle, isDetecting }) {
  const m = META[app.name] || app;
  return (
    <div className={`device-card ${isOn ? 'device-on' : ''} ${isDetecting ? 'device-detecting' : ''}`}
         style={{ '--accent': m.color }}>
      <div className="device-icon">{m.icon}</div>
      <div className="device-name">{m.name}</div>
      <div className={`device-badge ${isOn ? 'badge-on' : 'badge-off'}`}>
        {isOn ? '● ON' : '○ OFF'}
      </div>
      <div className="device-btns">
        <button className="dbtn dbtn-on"  onClick={() => onToggle(m.name, 'ON')}  disabled={isOn}>ON</button>
        <button className="dbtn dbtn-off" onClick={() => onToggle(m.name, 'OFF')} disabled={!isOn}>OFF</button>
      </div>
      {isDetecting && <div className="device-detect-ring" />}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [serverUrl, setServerUrl]   = useState(SERVER_DEFAULT);
  const [urlInput,  setUrlInput]    = useState(SERVER_DEFAULT);
  const [logs,      setLogs]        = useState([]);
  const [status,    setStatus]      = useState(null);
  const [confirm,   setConfirm]     = useState(null);
  const [detecting, setDetecting]   = useState(null); // appliance being detected
  const [devices,   setDevices]     = useState(
    Object.fromEntries(APPLIANCES.map(a => [a.name, 'OFF']))
  );
  const [camStarted, setCamStarted] = useState(false);
  const [espIp,      setEspIp]      = useState('192.168.29.129');
  const logRef = useRef(null);

  const addLog = useCallback(({ type, msg }) =>
    setLogs(p => [...p.slice(-(MAX_LOGS - 1)), { type, msg, time: ts() }]), []);

  const handleStatus = useCallback(s => {
    setStatus(s);
    if (s.label !== 'Other') setDetecting(s.label);
    else setDetecting(null);
  }, []);

  const handleConfirm = useCallback(c => {
    setConfirm(c.appliance);
    addLog({ type: 'confirm', msg: `🔍 Detected: ${c.appliance}` });
  }, [addLog]);

  const handleResult = useCallback(r => {
    if (r.rejected) {
      addLog({ type: 'warn', msg: '↩ Detection skipped' });
    } else if (r.ok) {
      setDevices(p => ({ ...p, [r.appliance]: r.state }));
      addLog({ type: 'success', msg: `✓ ${r.appliance} turned ${r.state}` });
    } else {
      addLog({ type: 'error', msg: `✗ ESP32 error for ${r.appliance}` });
    }
  }, [addLog]);

  const { videoRef, connected, streaming, connect,
          startCamera, stopCamera, startStreaming, stopStreaming,
          sendConfirm, sendReject } = useStream({
    serverUrl, onStatus: handleStatus,
    onConfirm: handleConfirm, onResult: handleResult, onLog: addLog,
  });

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const handleStart = useCallback(async () => {
    await connect();
    const ok = await startCamera();
    if (!ok) return;
    setCamStarted(true);
    await startStreaming();
    addLog({ type: 'success', msg: '▶ Detection started' });
  }, [connect, startCamera, startStreaming, addLog]);

  const handleStop = useCallback(() => {
    stopStreaming(); stopCamera();
    setCamStarted(false); setStatus(null); setDetecting(null);
    addLog({ type: 'warn', msg: '■ Detection stopped' });
  }, [stopStreaming, stopCamera, addLog]);

  const handleConfirmYes = () => { sendConfirm(confirm); setConfirm(null); };
  const handleConfirmNo  = () => { sendReject(); setConfirm(null); };

  // Manual toggle → calls FastAPI which calls ESP32
  const handleManualToggle = useCallback(async (device, state) => {
    try {
      const res = await fetch(`http://localhost:8000/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device, state }),
      });
      if (res.ok) {
        setDevices(p => ({ ...p, [device]: state }));
        addLog({ type: 'success', msg: `Manual: ${device} → ${state}` });
      } else {
        addLog({ type: 'error', msg: `Server error for ${device}` });
      }
    } catch {
      addLog({ type: 'error', msg: 'Cannot reach server' });
    }
  }, [addLog]);

  const isLive = streaming && camStarted;
  const confPct = status ? Math.round((status.confidence || 0) * 100) : 0;
  const fillPct = status ? Math.round((status.fill || 0) * 100) : 0;

  return (
    <div className="app">
      <InstallBanner />
      {/* ── NAVBAR ── */}
      <nav className="nav">
        <div className="nav-brand">
          <span className="nav-dot" />
          Vision Smart Control
        </div>
        <div className="nav-right">
          <div className={`status-pill ${connected ? 's-connected' : 's-off'}`}>
            <span />{connected ? 'Server' : 'Offline'}
          </div>
          <div className={`status-pill ${isLive ? 's-live' : 's-off'}`}>
            <span />{isLive ? 'Live' : 'Idle'}
          </div>
        </div>
      </nav>

      <div className="layout">

        {/* ── LEFT: Devices ── */}
        <aside className="sidebar-left">
          <p className="section-label">Connected Devices</p>
          <div className="device-grid">
            {APPLIANCES.map(a => (
              <DeviceCard
                key={a.name}
                app={a}
                isOn={devices[a.name] === 'ON'}
                onToggle={handleManualToggle}
                isDetecting={detecting === a.name}
              />
            ))}
          </div>

          {/* ESP32 IP */}
          <p className="section-label" style={{ marginTop: 20 }}>ESP32 Direct</p>
          <div className="esp-row">
            <input
              className="esp-input"
              value={espIp}
              onChange={e => setEspIp(e.target.value)}
              placeholder="192.168.x.x"
            />
            <a className="esp-open" href={`http://${espIp}`} target="_blank" rel="noreferrer">
              Open ↗
            </a>
          </div>
        </aside>

        {/* ── CENTER: Camera + Detection ── */}
        <main className="camera-area">
          {/* Camera view */}
          <div className="cam-wrapper">
            <video ref={videoRef} playsInline muted className="cam-video" />
            {!isLive && (
              <div className="cam-placeholder">
                <div className="cam-ph-icon">📷</div>
                <p>Camera not started</p>
              </div>
            )}
            {isLive && (
              <>
                <div className="live-badge"><span>●</span> LIVE</div>
                <div className="scan-corner tl" /><div className="scan-corner tr" />
                <div className="scan-corner bl" /><div className="scan-corner br" />
              </>
            )}
          </div>

          {/* Detection bar */}
          <div className="detect-bar">
            <div className="detect-left">
              <div className="detect-label-row">
                <span className={`detect-label ${status?.label === 'Other' || !status ? 'label-none' : 'label-active'}`}>
                  {!status ? '– Waiting' : status.label === 'Other' ? '– No appliance' : `${META[status.label]?.icon || ''} ${status.label}`}
                </span>
                {status && status.label !== 'Other' && (
                  <span className="detect-conf">{confPct}%</span>
                )}
              </div>
              {/* Temporal window fill */}
              <div className="fill-track">
                <div className="fill-bar" style={{ width: `${fillPct}%`,
                  background: fillPct > 69 ? '#10b981' : fillPct > 40 ? '#f59e0b' : '#7c3aed' }} />
              </div>
              <div className="fill-labels">
                <span>Confidence window</span><span>{fillPct}% / 70% threshold</span>
              </div>
            </div>
          </div>

          {/* Camera controls */}
          <div className="cam-controls">
            {!camStarted ? (
              <button className="cam-btn cam-start" onClick={handleStart}>
                ▶ Start Camera &amp; Detect
              </button>
            ) : (
              <div className="cam-btn-group">
                {streaming
                  ? <button className="cam-btn cam-pause" onClick={stopStreaming}>⏸ Pause</button>
                  : <button className="cam-btn cam-start" onClick={startStreaming}>▶ Resume</button>
                }
                <button className="cam-btn cam-stop" onClick={handleStop}>■ Stop</button>
              </div>
            )}
          </div>

          {/* Server URL */}
          <div className="server-row">
            <span className="server-label">WebSocket</span>
            <input className="server-input" value={urlInput} onChange={e => setUrlInput(e.target.value)} />
            <button className="server-apply" onClick={() => {
              setServerUrl(urlInput);
              addLog({ type: 'success', msg: 'Server URL updated' });
            }}>Apply</button>
          </div>
        </main>

        {/* ── RIGHT: Event Log ── */}
        <aside className="sidebar-right">
          <p className="section-label">Event Log</p>
          <div className="log-box" ref={logRef}>
            {logs.length === 0 && (
              <div className="log-empty">No events yet…</div>
            )}
            {[...logs].reverse().map((l, i) => (
              <div key={i} className={`log-row log-${l.type}`}>
                <span className="log-time">{l.time}</span>
                <span>{l.msg}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* ── CONFIRM MODAL ── */}
      {confirm && (
        <ConfirmModal
          appliance={confirm}
          onConfirm={handleConfirmYes}
          onReject={handleConfirmNo}
        />
      )}
    </div>
  );
}
