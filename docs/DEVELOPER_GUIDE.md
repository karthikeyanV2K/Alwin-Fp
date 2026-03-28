# 🛠️ Developer & Starting Guide

Welcome to the **Alwin-Fp** smart home setup! This document covers the comprehensive setup instructions for starting the AI model from scratch, deploying the FastAPI backend server, running the React/Expo frontends, and wiring your ESP32 microcontroller.

---

## 📋 Prerequisites

Please ensure your system meets the following requirements before proceeding:
- **Python 3.10+**: For the ML Model and FastAPI inference server.
- **Node.js (v18+) & npm (v9+)**: For the React Web App and React Native Mobile App.
- **Arduino IDE 2.x**: For compiling and flashing the ESP32 firmware.
- **Expo Go App**: Installed on your mobile device (iOS/Android) for testing the mobile application.

---

## 1️⃣ Model Training & Processing

This folder tracks the entire ML pipeline from data ingestion to ONNX export. *(Note: If you already have `mobilevit_appliance.onnx` in the `checkpoints/` folder, you can skip to Step 2.)*

1. **Install dependencies:**
   ```bash
   cd model
   pip install -r requirements.txt
   ```

2. **Organize your Data:**
   Your dataset must be placed in `model/data/`:
   ```
   model/data/
     ├── train/
     │   ├── TV/
     │   ├── Fan/
     │   └── ...
     └── val/
   ```

3. **Train the Model:**
   *A GPU (NVIDIA CUDA) is highly recommended for faster training.*
   ```bash
   python train.py --data_dir ./data --epochs 30 --batch_size 32
   ```

4. **Export to ONNX (Production Ready Format):**
   ```bash
   python export_onnx.py --checkpoint checkpoints/mobilevit_appliance_best.pth --output checkpoints/mobilevit_appliance.onnx
   ```

---

## 2️⃣ Backend — FastAPI Inference Server

The server acts as the central brain—processing camera feeds via WebSocket, verifying confidence iteratively, and relaying hardware commands.

1. **Install required packages:**
   ```bash
   cd server
   pip install -r requirements.txt
   ```

2. **Setup Environment Variables:**
   You will need to pass the IP of your running ESP32 and path to your model:
   ```bash
   # Windows PowerShell
   $env:ESP32_IP = "192.168.1.100"  # Replace with actual ESP32 IP
   $env:MODEL_PATH = "..\model\checkpoints\mobilevit_appliance.onnx"
   
   # Mac/Linux
   export ESP32_IP="192.168.1.100"
   export MODEL_PATH="../model/checkpoints/mobilevit_appliance.onnx"
   ```

   > [!WARNING]
   > If the server cannot find your `.onnx` model, it will gracefully fallback to **MOCK MODE**, returning an "AC" prediction at 90% confidence indefinitely for fallback testing.

3. **Start the Uvicorn Server:**
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

---

## 3️⃣ Frontend Experiences

You have two choices for your client: Web or Mobile. Both connect seamlessly to the server over WebSockets.

### Option A: React Web Dashboard
```bash
cd web-app
npm install
npm run start # Use `npm run dev` if constructed with Vite
```
Open `http://localhost:3000`. Click **▶ Start Camera & Stream**. Point the camera at appliances.

### Option B: React Native Mobile Application
```bash
cd mobile-app
npm install
npx expo start -c
```
- Open the **Expo Go** app on your physical phone.
- Scan the QR code presented in your terminal.
- Ensure your phone and development computer are on the **SAME Wi-Fi network**.

---

## 4️⃣ ESP32 Hardware Wiring & Flashing

The physical side handles the 110/220V appliance switching securely using Relays (Isolators).

1. **Arduino Setup**: Open the Arduino IDE. Open the `esp32/main/main.ino` script.
2. **Library Requirements**: Install **ArduinoJson** (Version 6.x) via the built-in Library Manager (`Tools -> Manage Libraries`).
3. **Configuration**: 
   Open `esp32/config.h` (or the equivalent location defining your settings) and edit your Wi-Fi credentials:
   ```cpp
   #define WIFI_SSID "Your_WiFi_Name"
   #define WIFI_PASSWORD "Your_WiFi_Password"
   ```
4. **Check GPIO Mappings**:
   Ensure your physical relay pins match the configured pins in your code:
   
   | Appliance | Target GPIO Pin |
   |-----------|-----------------|
   | TV        | 4               |
   | Fan       | 5               |
   | AC        | 18              |
   | Light     | 19              |
   | Plug      | 21              |

   > [!CAUTION]
   > When wiring mains voltage (AC Power), be absolutely certain your electrical system is fully disconnected from the wall. Insulate strictly. If you are inexperienced, use safely enclosed IoT Relays or simple LEDs for testing!

5. **Flash & Run**: Connect your board via USB and hit Upload (`Ctrl+U`). Once done, open the Serial Monitor (115200 baud) to retrieve the ESP's dynamically assigned IP address. Plug this IP into the server's `$env:ESP32_IP` from Step 2!

## 🧪 Temporal Validator Tuning
If your model stutters between predictions or produces transient false positives, you can tune the temporal validation filter. Open `server/main.py`.

The logic resides here:
```python
validator = TemporalValidator(
    window_size=10,             # Rolling buffer size (frames)
    agree_ratio=0.70,           # Consistency threshold (e.g. 70% must be the same prediction)
    confidence_threshold=0.72,  # Raw neural-net inference min score
    cooldown_frames=30          # Wait limit (in frames) after an action is dispatched
)
```
Tuning these upwards creates a slower, but incredibly stable, control system.
