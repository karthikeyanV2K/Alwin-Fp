# 📱 Alwin Appliance Detector - React Native Mobile App

Real-time appliance detection using your phone's native camera with AI inference.

## Features

✅ **Native Camera Access** - Direct access to device camera  
✅ **Real-time Detection** - Stream and detect appliances on the fly  
✅ **Instant Feedback** - Confirm/correct predictions to improve model  
✅ **Confidence Scores** - See all predictions with confidence bars  
✅ **Works Offline** - ONNX model runs inference locally

## Setup

### Prerequisites

- Node.js 16+ installed
- Expo CLI: `npm install -g expo-cli`
- Your backend server running on: `http://192.168.x.x:8000`

### Installation

```bash
cd X:\Alwin-Fp\mobile-app

# Install dependencies
npm install

# Start the app
npm start
```

### Connect Your Phone

**Option 1: Expo Go App (Easiest)**
1. Install "Expo Go" from App Store or Google Play
2. Scan the QR code from terminal with your phone
3. App launches automatically

**Option 2: Android Phone (USB)**
```bash
npm run android
```

**Option 3: iOS (Mac only)**
```bash
npm run ios
```

## Configuration

### Set Server IP

Edit `CameraScreen.js` line 14:

```javascript
const API_BASE_URL = 'http://192.168.x.x:8000'; // Change to your server IP
```

Example:
```javascript
const API_BASE_URL = 'http://192.168.1.100:8000';
```

### Find Your Server IP

**On Windows (Server Machine):**
```powershell
ipconfig
```
Look for IPv4 Address (e.g., 192.168.1.x)

**On Android Phone:**
```
Settings > About Phone > Status > IP Address
```

## Usage

1. **Launch App** → Expo Go shows QR code
2. **Grant Permissions** → Allow camera access
3. **📷 Capture** → Take single photo
4. **▶ Stream** → Continuous detection every 2 seconds
5. **⏹ Stop** → Stop streaming

## Detected Classes

- **TV** - Televisions
- **Fan** - Electric fans
- **AC** - Air conditioners
- **Light** - Light bulbs & tubes
- **Plug** - Electrical outlets
- **Other** - Other appliances

## Troubleshooting

### "Connection refused" error
- Check server is running: `http://192.168.x.x:8000` 
- Verify IP address in `CameraScreen.js`
- Ensure phone and server are on same WiFi network

### Camera not opening
- Grant camera permission when prompted
- Check phone privacy settings

### Detection is slow
- Check network latency
- Reduce detection interval in code (default 2s)

## Project Structure

```
mobile-app/
├── App.js                    # Main app entry
├── screens/
│   └── CameraScreen.js       # Camera & detection UI
├── package.json              # Dependencies
├── app.json                  # Expo configuration
└── README.md
```

## Backend API Endpoints

**POST /detect**
```json
{
  "file": <image_file>
}
```

Response:
```json
{
  "class": "TV",
  "confidence": 0.95,
  "all_predictions": {
    "TV": 0.95,
    "Fan": 0.03,
    "AC": 0.02,
    ...
  }
}
```

**POST /feedback**
```json
{
  "predicted_class": "TV",
  "confidence": 0.95,
  "is_correct": true,
  "image_path": "/path/to/image.jpg"
}
```

## Performance Tips

- Keep phone & server on same network
- Use good lighting for better detection
- Move closer to appliances
- Try different angles for difficult cases

## Future Enhancements

- [ ] Batch detection for multiple appliances
- [ ] Gallery image selection
- [ ] Model update from phone
- [ ] Offline mode with cached model
- [ ] Statistics & history

---

Built with ❤️ using React Native + Expo
