"""
main.py — FastAPI Inference Server
===================================
Endpoints:
  WS  /stream        ← Receives Base64-encoded JPEG frames from React app
  POST /user-confirm ← React app calls when user taps "Yes"
  POST /user-reject  ← React app calls when user taps "No"
  GET  /status       ← Returns all device states from ESP32
  GET  /health       ← Liveness check

WebSocket message protocol
---------------------------
Client → Server (frame):
  { "type": "frame", "data": "<base64-jpeg>" }

Server → Client:
  { "type": "status",  "label": "TV",  "confidence": 0.93, "fill": 0.80 }
  { "type": "confirm", "appliance": "TV" }   ← fires when confirmed
  { "type": "result",  "ok": true }          ← after user acts

Configuration
-------------
Set env vars or edit CONFIG below:
  ESP32_IP    (default: 192.168.1.100)
  MODEL_PATH  (default: ../model/checkpoints/mobilevit_appliance.onnx)
"""

from __future__ import annotations

import asyncio
import base64
import io
import os
import json
import sys
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

# ── Local modules ─────────────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent.parent / "model"))
from inference import ApplianceInference
from temporal_validator import TemporalValidator
from esp32_client import ESP32Client

# ── Config ────────────────────────────────────────────────────────────────────
ESP32_IP   = os.getenv("ESP32_IP",   "192.168.1.100")
MODEL_PATH = os.getenv("MODEL_PATH",
    str(Path(__file__).parent.parent / "model" / "checkpoints" / "mobilevit_appliance.onnx"))

# ── Globals ───────────────────────────────────────────────────────────────────
app         = FastAPI(title="Appliance Vision Server", version="1.0.0")
engine:     Optional[ApplianceInference] = None
esp32:      Optional[ESP32Client]        = None
_device_states: dict[str, str] = {
    "TV": "OFF", "Fan": "OFF", "AC": "OFF", "Light": "OFF", "Plug": "OFF"
}
# Per-connection validators stored by ws connection id
_validators: dict[int, TemporalValidator] = {}

# CORS — allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    global engine, esp32
    if Path(MODEL_PATH).exists():
        engine = ApplianceInference(MODEL_PATH, confidence_threshold=0.72)
        print(f"[Server] Model loaded: {MODEL_PATH}")
    else:
        print(f"[Server] ⚠ Model NOT found at {MODEL_PATH}. Running in MOCK mode.")
    esp32 = ESP32Client(ESP32_IP)


# ── WebSocket streaming endpoint ──────────────────────────────────────────────
@app.websocket("/stream")
async def stream_endpoint(ws: WebSocket):
    await ws.accept()
    conn_id = id(ws)
    validator = TemporalValidator(
        window_size=10,
        agree_ratio=0.70,
        confidence_threshold=0.72,
        cooldown_frames=30,
    )
    _validators[conn_id] = validator
    pending_appliance: Optional[str] = None

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)

            if msg.get("type") == "frame":
                # Decode Base64 JPEG
                jpeg_bytes = base64.b64decode(msg["data"])

                # Run inference (or mock)
                if engine is not None:
                    label, conf = engine.predict_from_bytes(jpeg_bytes)
                else:
                    # Mock: always return AC with 90% confidence for testing
                    label, conf = "AC", 0.90

                # Feed temporal validator
                confirmed = validator.update(label, conf)

                # Send per-frame status back to client
                await ws.send_json({
                    "type":       "status",
                    "label":      label,
                    "confidence": round(conf, 4),
                    "fill":       round(validator.fill_ratio, 2),
                })

                if confirmed and confirmed != "Other":
                    pending_appliance = confirmed
                    await ws.send_json({
                        "type":      "confirm",
                        "appliance": confirmed,
                    })

            elif msg.get("type") == "user-confirm":
                appliance = msg.get("appliance") or pending_appliance
                if appliance:
                    result = await esp32.send_command(appliance, "ON")
                    _device_states[appliance] = "ON"
                    validator.reset()
                    pending_appliance = None
                    await ws.send_json({
                        "type":      "result",
                        "ok":        result["ok"],
                        "appliance": appliance,
                        "state":     "ON",
                    })

            elif msg.get("type") == "user-reject":
                validator.reset()
                pending_appliance = None
                await ws.send_json({"type": "result", "ok": True, "rejected": True})

    except WebSocketDisconnect:
        pass
    finally:
        _validators.pop(conn_id, None)


# ── REST endpoints ────────────────────────────────────────────────────────────
class ControlCmd(BaseModel):
    device: str
    state:  str  # "ON" | "OFF"


@app.post("/control")
async def manual_control(cmd: ControlCmd):
    """Manually override a device (bypass camera)."""
    result = await esp32.send_command(cmd.device, cmd.state)
    if result["ok"]:
        _device_states[cmd.device] = cmd.state
    return result


@app.get("/status")
async def get_status():
    """Returns device states (merged local + ESP32)."""
    esp_result = await esp32.get_status()
    if esp_result["ok"]:
        return {"source": "esp32", "devices": esp_result["devices"]}
    return {"source": "local", "devices": _device_states}


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": engine is not None, "esp32_ip": ESP32_IP}


@app.post("/detect")
async def detect_appliance(file: UploadFile):
    """Detect appliance from uploaded image."""
    try:
        if engine is None:
            raise HTTPException(status_code=503, detail="Model not loaded")
        
        # Read image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Run inference
        result = engine.predict(image)
        
        return {
            "class": result["class"],
            "confidence": float(result["confidence"]),
            "all_predictions": {k: float(v) for k, v in result.get("predictions", {}).items()}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/feedback")
async def submit_feedback(feedback: dict):
    """Record user feedback for model improvement."""
    try:
        # Log feedback for future model retraining
        print(f"[FEEDBACK] {feedback}")
        return {"status": "received"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
