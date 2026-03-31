<div align="center">

# 🏠 Alwin-Fp: Vision-Driven Smart Appliance Control

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
[![React Native](https://img.shields.io/badge/react_native-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://reactnative.dev/)
[![ESP32](https://img.shields.io/badge/esp32-E7352C?style=for-the-badge&logo=espressif&logoColor=white)](https://www.espressif.com/en/products/socs/esp32)
[![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)](https://www.python.org/)

A full-stack AI-powered appliance control system. Control your physical appliances in real-time by just pointing your phone camera at them!

[Features](#-key-features) • [Architecture](#-system-architecture) • [Getting Started](#-getting-started) • [Full Guide](docs/DEVELOPER_GUIDE.md)

</div>

## ✨ Key Features

- **Real-Time Appliance Detection:** Uses a custom-trained MobileViT model to detect TVs, Fans, ACs, Lights, and Plugs at up to 5 FPS.
- **Smart Temporal Validation:** Eradicates false positives by validating predictions over a rolling time window.
- **Cross-Platform Access:** Operates securely via a React web dashboard or a native React Native Expo mobile app.
- **Hardware Integration:** Instantly commands an ESP32 microcontroller over HTTP to flip physical relays on or off.
- **High Performance:** Lightweight ONNX inference enables snappy performance across regular machine architectures.

## 🏗 System Architecture

The project acts as a robust end-to-end pipeline linking Vision AI to bare-metal hardware.

1. **Camera Feed**: React (Web) or Expo (Mobile) app captures and base64-encodes frames.
2. **WebSocket Streaming**: Frames are streamed smoothly to the FastAPI inference server.
3. **AI Inference**: The FastAPI app pushes frames through the `mobilevit_appliance.onnx` neural model.
4. **Validation Engine**: The Temporal Validator ensures stable detections (70%+ confidence over a 10-frame window).
5. **User Confirmation**: The user confirms the detection on the frontend via an interactive popup.
6. **Hardware Action**: A direct command is dispatched to the ESP32, flipping the GPIO relay and turning the actual appliance physically ON/OFF.

## 📁 Repository Structure

| Component | Stack | Description |
|-----------|-------|-------------|
| [`/model`](model/) | PyTorch, ONNX | ML pipeline for dataset collection, MobileViT training, and ONNX export. |
| [`/server`](server/) | FastAPI, Python | High-speed inference server that handles WebSocket video streams & routing. |
| [`/web-app`](web-app/) | React.js, Vite/CRA | A responsive browser-based dashboard to control appliances via webcam. |
| [`/mobile-app`](mobile-app/) | React Native, Expo | Native iOS/Android app utilizing device camera for smooth streaming. |
| [`/esp32`](esp32/) | C++, Arduino IDE | Microcontroller firmware mapped to physical relays handling 220V/110V output. |

## 🚀 Getting Started

To get the application up and running on your local machine, check out our comprehensive **[Developer & Setup Guide](docs/DEVELOPER_GUIDE.md)**!

### Quick Start Overview

> [!TIP]
> For detailed commands and hardware wiring lists, refer to the [Developer Guide](docs/DEVELOPER_GUIDE.md).

1. **Start the AI Server**
   ```bash
   cd server
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

2. **Launch the Frontend Experience**
   *For Web:*
   ```bash
   cd web-app
   npm install && npm start
   ```
   *For Mobile:*
   ```bash
   cd mobile-app
   npm install && npx expo start
   ```

3. **Deploy Hardware (ESP32)**
   * Flash your `.ino` files via the Arduino IDE using the ESP32 Board Definitions.
   * Attach your relay outputs according to the map in `config.h` (or similar definition file).

---

## 💡 Multi-Room Bulb Detection

This system supports **multiple identical-looking bulbs** in different rooms. Since all bulbs look the same to the camera, room context is used to route the correct relay.

### How It Works

```
📱 Pick "Bedroom"
    ↓
📷 Camera streams frames + room="Bedroom"
    ↓
🖥️  Server detects "Light" → maps to "Light_Bedroom"
    ↓
✅  Confirm popup appears
    ↓
⚡  ESP32 GPIO 19 → Bedroom relay clicks ON
```

| Fixed Camera approach | Mobile Camera approach (this system) |
|---|---|
| Bulb 1 always at frame X=0.1–0.3 | You pick the room first |
| Bulb 2 always at frame X=0.4–0.6 | ML detects "Light" |
| Requires zone calibration | Server maps room → relay. No spatial calibration! ✅ |

---

### 📍 Setting the ESP32 IP

There are **2 separate IPs** in this system:

```
Mobile App ──→ FastAPI Server   ← entered in the app's Config screen
FastAPI Server ──→ ESP32        ← set in server/main.py
```

Open `server/main.py` line 51 and change the IP:

```python
# ── Config ──────────────────────────────────────────────────────
ESP32_IP = os.getenv("ESP32_IP", "192.168.29.129")  # ← Change this!
```

Or set it as an environment variable (no code change needed):

```powershell
$env:ESP32_IP = "192.168.1.50"
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

> [!IMPORTANT]
> Restart the server after changing the ESP32 IP.

---

### ⚡ Room → Relay Pin Map

Each room's bulb is wired to a dedicated ESP32 relay channel:

```c
// esp32/main/config.h
#define PIN_LIGHT_BEDROOM  19   // GPIO19 → IN1 → Bedroom bulb
#define PIN_LIGHT_LIVING   18   // GPIO18 → IN2 → Living room bulb
#define PIN_LIGHT_KITCHEN  23   // GPIO23 → IN3 → Kitchen bulb
#define PIN_PLUG           21   // GPIO21 → IN4 → Power plug
```

Server routing (`server/main.py`):

```python
ROOM_TO_DEVICE = {
    "Bedroom":     "Light_Bedroom",
    "Living Room": "Light_Living",
    "Kitchen":     "Light_Kitchen",
}
```

---

### 🔦 Calibration Guide

Calibration for this system has two parts:

#### A) Model Calibration — does it detect your bulbs?

Take a photo of your bulb and test the `/detect` endpoint:

```powershell
cd server
curl -X POST "http://localhost:8000/detect" -F "file=@bulb_photo.jpg"
# Expected: {"class": "Light", "confidence": 0.85}
```

> [!TIP]
> If confidence is below 0.6, retrain the model with photos of your specific bulbs.

#### B) Room-Relay Calibration — is each wire in the right room?

1. Open `http://<ESP32_IP>` in your browser
2. Click **Scan Hardware** → then **Open Controls**
3. Toggle each relay individually
4. Verify which physical bulb switches ON/OFF
5. If wires are swapped, update the pin numbers in `config.h` and re-flash

---

### 🚀 Quick Test

```bash
# 1. Start server (with correct ESP32 IP)
cd server
python -m uvicorn main:app --host 0.0.0.0 --port 8000

# 2. Start mobile app
cd mobile-app
npm start
```

Then on your phone:
1. Enter your server IP on the Config screen
2. Select a room (Bedroom / Living Room / Kitchen)
3. Point camera at that room's bulb
4. Tap **"Turn ON"** on the confirm popup → relay clicks! ⚡

---
<p align="center">Made with ❤️ for Vision-Driven Homes</p>
