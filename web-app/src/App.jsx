import React, { useState, useCallback, useRef } from 'react';
import { useStream } from './hooks/useStream';

// ── Appliance metadata ────────────────────────────────────────────────────────
const APPLIANCES = [
  { name: 'TV',    icon: '📺', pin: 4  },
  { name: 'Fan',   icon: '🌀', pin: 5  },
  { name: 'AC',    icon: '❄️', pin: 18 },
  { name: 'Light', icon: '💡', pin: 19 },
  { name: 'Plug',  icon: '🔌', pin: 21 },
];

const SERVER_DEFAULT = 'ws://localhost:8000/stream';
const MAX_LOGS = 30;

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ appliance, onConfirm, onReject }) {
  const meta = APPLIANCES.find(a => a.name === appliance) || { icon: '🔌' };
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-icon">{meta.icon}</div>
        <h2>Appliance Detected!</h2>
        <p>The AI vision system has identified:</p>
        <span className="modal-appliance">{appliance}</span>
        <p>Turn it <strong>ON</strong>?</p>
        <div className="modal-actions" style={{ marginTop: 28 }}>
          <button className="btn btn-danger"  onClick={onReject}  style={{ flex: 1 }}>✕ No</button>
          <button className="btn btn-success" onClick={onConfirm} style={{ flex: 1 }}>✓ Yes, Turn ON</button>
        </div>
      </div>
    </div>
  );
}

// ── Appliance List ────────────────────────────────────────────────────────────
function ApplianceList({ states, onToggle }) {
  return (
    <div className="appliance-list">
      {APPLIANCES.map(a => {
        const isOn = states[a.name] === 'ON';
        return (
          <div key={a.name} className={`appliance-item ${isOn ? 'on' : ''}`}>
            <div className="appliance-icon">{a.icon}</div>
            <div className="appliance-info">
              <div className="appliance-name">{a.name}</div>
              <div className="appliance-state">{isOn ? '● ON' : '○ Standby'}</div>
            </div>
            <button
              className={`toggle-pill ${isOn ? 'on-pill' : 'off'}`}
              onClick={() => onToggle(a.name, isOn ? 'OFF' : 'ON')}
            >
              {isOn ? 'ON' : 'OFF'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Log Panel ────────────────────────────────────────────────────────────────
function LogPanel({ logs }) {
  return (
    <div className="log-list">
      {logs.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', marginTop: 16 }}>
          No events yet…
        </div>
      )}
      {[...logs].reverse().map((l, i) => (
        <div key={i} className={`log-entry ${l.type}`}>
          <div className="log-time">{l.time}</div>
          {l.msg}
        </div>
      ))}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [serverUrl,  setServerUrl]  = useState(SERVER_DEFAULT);
  const [urlInput,   setUrlInput]   = useState(SERVER_DEFAULT);
  const [logs,       setLogs]       = useState([]);
  const [status,     setStatus]     = useState(null);    // {label, confidence, fill}
  const [confirm,    setConfirm]    = useState(null);    // pending appliance name
  const [devices,    setDevices]    = useState(
    Object.fromEntries(APPLIANCES.map(a => [a.name, 'OFF']))
  );
  const [camStarted, setCamStarted] = useState(false);

  const addLog = useCallback(({ type, msg }) => {
    setLogs(prev => [...prev.slice(-(MAX_LOGS - 1)), { type, msg, time: timeNow() }]);
  }, []);

  const handleStatus  = useCallback(s  => setStatus(s), []);
  const handleConfirm = useCallback(c  => {
    setConfirm(c.appliance);
    addLog({ type: 'confirm', msg: `🔍 Detected: ${c.appliance}` });
  }, [addLog]);
  const handleResult  = useCallback(r  => {
    if (r.rejected) {
      addLog({ type: 'error', msg: '✕ Rejected by user' });
    } else if (r.ok) {
      setDevices(prev => ({ ...prev, [r.appliance]: r.state }));
      addLog({ type: 'success', msg: `✓ ${r.appliance} turned ${r.state}` });
    } else {
      addLog({ type: 'error', msg: `ESP32 error for ${r.appliance}` });
    }
  }, [addLog]);

  const { videoRef, connected, streaming, connect, startCamera, stopCamera,
    startStreaming, stopStreaming, sendConfirm, sendReject } = useStream({
    serverUrl, onStatus: handleStatus, onConfirm: handleConfirm,
    onResult: handleResult, onLog: addLog,
  });

  const handleStartAll = useCallback(async () => {
    await connect();
    const cameraStarted = await startCamera();
    if (!cameraStarted) {
      return;
    }
    setCamStarted(true);
    await startStreaming();
  }, [connect, startCamera, startStreaming]);

  const handleStop = useCallback(() => {
    stopStreaming(); stopCamera();
    setCamStarted(false); setStatus(null);
  }, [stopStreaming, stopCamera]);

  const handleConfirmYes = () => {
    sendConfirm(confirm);
    setConfirm(null);
  };
  const handleConfirmNo = () => {
    sendReject();
    setConfirm(null);
  };

  // Manual toggle (bypasses camera)
  const handleManualToggle = useCallback(async (device, state) => {
    try {
      const res = await fetch('/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device, state }),
      });
      if (res.ok) {
        setDevices(prev => ({ ...prev, [device]: state }));
        addLog({ type: 'success', msg: `Manual: ${device} → ${state}` });
      }
    } catch {
      addLog({ type: 'error', msg: 'Server unreachable for manual toggle' });
    }
  }, [addLog]);

  const isStreaming = streaming && camStarted;

  return (
    <div className="app-wrapper">
      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <nav className="navbar">
        <div className="navbar-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#a78bfa" strokeWidth="1.5"/>
            <path d="M8 12l3 3 5-5" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="12" r="3" fill="#7c3aed" opacity="0.4"/>
          </svg>
          Vision Smart Control
        </div>
        <div className="navbar-status">
          <div className={`dot ${connected ? 'connected' : streaming ? 'error' : ''}`} />
          {connected ? 'Server Connected' : 'Disconnected'}
          &nbsp;&nbsp;|&nbsp;&nbsp;
          <div className={`dot ${isStreaming ? 'connected' : ''}`} />
          {isStreaming ? 'Streaming' : 'Idle'}
        </div>
      </nav>

      {/* ── Main ───────────────────────────────────────────────────── */}
      <div className="main-content">

        {/* ── Left: Device List ──────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-title">
              <span>🏠</span> Devices
            </div>
            <ApplianceList states={devices} onToggle={handleManualToggle} />
          </div>

          {/* Server config */}
          <div className="card">
            <div className="card-title"><span>⚙️</span> Server</div>
            <div className="config-form">
              <input
                className="config-input"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="ws://host:8000/stream"
              />
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '7px 12px' }}
                onClick={() => { setServerUrl(urlInput); addLog({ type: 'success', msg: `Server URL updated` }); }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* ── Center: Camera ─────────────────────────────────────── */}
        <div className="camera-panel">
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="video-wrapper">
              <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {isStreaming && (
                <div className="video-overlay">
                  <div className="video-badge">
                    <span>●</span> LIVE
                  </div>
                </div>
              )}
              <div className={`scan-ring ${isStreaming ? 'active' : ''}`} />
            </div>
          </div>

          {/* Current prediction */}
          <div className="card">
            <div className="card-title"><span>🤖</span> AI Prediction</div>
            {status ? (
              <>
                <div className="prediction-row">
                  <span className={`prediction-label ${status.label === 'Other' ? 'prediction-other' : ''}`}>
                    {status.label === 'Other' ? '– No appliance' : status.label}
                  </span>
                  <span className="prediction-conf">
                    {(status.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="fill-bar-wrapper" style={{ marginTop: 12 }}>
                  <div className="fill-bar-label">
                    <span>Confidence window</span>
                    <span>{Math.round((status.fill || 0) * 100)}%</span>
                  </div>
                  <div className="fill-bar-track">
                    <div className="fill-bar-fill" style={{ width: `${(status.fill || 0) * 100}%` }} />
                  </div>
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Start camera to begin detection…
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="cam-controls">
            {!camStarted ? (
              <button className="btn btn-primary" onClick={handleStartAll} style={{ flex: 1 }}>
                ▶ Start Camera & Stream
              </button>
            ) : (
              <>
                {streaming
                  ? <button className="btn btn-secondary" onClick={stopStreaming}>⏸ Pause</button>
                  : <button className="btn btn-primary"   onClick={startStreaming}>▶ Resume</button>
                }
                <button className="btn btn-danger" onClick={handleStop}>■ Stop</button>
              </>
            )}
          </div>
        </div>

        {/* ── Right: Event Log ────────────────────────────────────── */}
        <div className="sidebar-right">
          <div className="card" style={{ height: '100%' }}>
            <div className="card-title"><span>📋</span> Event Log</div>
            <LogPanel logs={logs} />
          </div>
        </div>
      </div>

      {/* ── Confirm Modal ──────────────────────────────────────────── */}
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
