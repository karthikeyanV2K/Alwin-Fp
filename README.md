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
<p align="center">Made with ❤️ for Vision-Driven Homes</p>
