# Vision-Driven Smart Control System

A full-stack AI-powered appliance control system using MobileViT, FastAPI, React, and ESP32.

---

## 📁 Project Structure

```
Alwin-Fp/
├── model/               ← MobileViT training + inference
│   ├── train.py
│   ├── export_onnx.py
│   ├── inference.py
│   ├── temporal_validator.py
│   └── requirements.txt
├── server/              ← FastAPI inference server
│   ├── main.py
│   ├── esp32_client.py
│   └── requirements.txt
├── web-app/             ← React streaming dashboard
│   └── src/
│       ├── App.jsx
│       ├── hooks/useStream.js
│       └── index.css
└── esp32/               ← Arduino firmware
    ├── main.ino
    └── config.h
```

---

## 🔧 Setup Guide

### 1. Model — Train MobileViT

```bash
cd model
pip install -r requirements.txt
```

Prepare your dataset:
```
model/data/
  train/ TV/ Fan/ AC/ Light/ Plug/ Other/
  val/   TV/ Fan/ AC/ Light/ Plug/ Other/
```

Train (GPU recommended):
```bash
python train.py --data_dir ./data --epochs 30 --batch_size 32
```

Export to ONNX:
```bash
python export_onnx.py --checkpoint checkpoints/mobilevit_appliance_best.pth \
                      --output     checkpoints/mobilevit_appliance.onnx
```

Test single image:
```bash
python inference.py --model checkpoints/mobilevit_appliance.onnx --image test.jpg
```

---

### 2. Server — FastAPI Inference Server

```bash
cd server
pip install -r requirements.txt
```

Set environment variables:
```bash
# Windows PowerShell
$env:ESP32_IP   = "192.168.1.100"         # your ESP32 IP
$env:MODEL_PATH = "..\model\checkpoints\mobilevit_appliance.onnx"
```

Start server:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

> **Note:** If the ONNX model is not found, the server starts in **mock mode** (returns AC at 90% for testing).

---

### 3. React App — Web Streaming Dashboard

```bash
cd web-app
npm install
npm start
```

Open `http://localhost:3000` in your browser.

- Click **▶ Start Camera & Stream**
- Point camera at an appliance
- Confirm detection in the popup

---

### 4. ESP32 Firmware

1. Install [Arduino IDE](https://www.arduino.cc/en/software) + ESP32 board package
2. Install library: **ArduinoJson** (≥ 6.x) via Library Manager
3. Edit `esp32/config.h`:
   - Set `WIFI_SSID` and `WIFI_PASSWORD`
   - Check GPIO pin assignments match your relay module
   - Set `RELAY_ACTIVE_LOW 1` (most relay modules) or `0`
4. Flash `esp32/main.ino` to your ESP32
5. Open Serial Monitor (115200 baud) to see assigned IP
6. Set that IP as `ESP32_IP` in your server env var

---

## 🌊 Data Flow

```
Camera (browser) → Base64 JPEG frames @ 5 FPS
        ↓  WebSocket
FastAPI server → MobileViT ONNX inference
        ↓
Temporal Validator (10-frame window, 70% agreement)
        ↓  "confirm" event
React app → Confirmation modal
        ↓  User taps "Yes"
FastAPI → HTTP POST /control → ESP32
        ↓
GPIO relay → Physical appliance
```

---

## ⚡ Appliance → GPIO Mapping

| Appliance | GPIO |
|-----------|------|
| TV        | 4    |
| Fan       | 5    |
| AC        | 18   |
| Light     | 19   |
| Plug      | 21   |

Edit `esp32/config.h` to change pin assignments.

---

## 📊 Temporal Validator Tuning

Edit in `server/main.py`:

| Parameter | Default | Meaning |
|-----------|---------|---------|
| `window_size` | 10 frames | Rolling buffer size |
| `agree_ratio` | 0.70 | 70% of frames must agree |
| `confidence_threshold` | 0.72 | Per-frame min confidence |
| `cooldown_frames` | 30 | Frames to skip after firing |
