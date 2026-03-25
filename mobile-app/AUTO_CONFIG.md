# 🔧 Auto-Configuration Setup Guide

Your React Native app now **automatically detects the server IP** on your network!

## How It Works

### 1️⃣ **Installation & Start**

```powershell
cd X:\Alwin-Fp\mobile-app

# Install dependencies
npm install

# Start the app
npm start
```

### 2️⃣ **Automatic Configuration Screen**

When you open the app for the first time:

1. **Auto-Scan** - The app automatically scans your local WiFi network for the server
2. **Detected Servers** - Shows all found servers (if any)
3. **Manual Entry** - If test passes, saves IP and launches camera

### 3️⃣ **Server Auto-Discovery**

The app scans for:
- **IP Range**: Your WiFi subnet (e.g., 192.168.1.0 - 192.168.1.255)
- **Ports**: 8000 (main), 5000, 3000 (fallback)
- **Health Check**: `/health` endpoint

### 4️⃣ **Manual Configuration**

If auto-detection fails:

1. On your **server PC**, open PowerShell:
   ```powershell
   ipconfig
   ```
   Find: `IPv4 Address . . . . . . . . . . . : 192.168.X.X`

2. In app, enter IP manually:
   ```
   192.168.1.100
   ```
   (Port 8000 is automatic)

3. Tap **Connect** → App tests connection

## Configuration Storage

```
Stored in: AsyncStorage (encrypted on-device)
Key: SERVER_IP
Example: 192.168.1.100:8000
```

**To Reset Configuration:**
```javascript
// In ConfigScreen.js
import { clearServerIp } from '../utils/storage';
await clearServerIp();
// Restart app
```

## Network Requirements

✅ **Same WiFi Network** - Phone and server must be on same network  
✅ **Server Running** - Backend server on port 8000  
✅ **Firewall Open** - Allow incoming on port 8000  

### Check Server is Accessible

On your phone's browser, test:
```
http://192.168.1.100:8000/health
```

Should return:
```json
{
  "status": "ok",
  "model_loaded": true,
  "esp32_ip": "192.168.1.50"
}
```

## Network Troubleshooting

### "No server found" error

**Solution 1: Check server is running**
```powershell
# Terminal 1: Check if running
netstat -ano | findstr :8000

# Terminal 2: Restart server
cd X:\Alwin-Fp\server
$env:MODEL_PATH = "X:\Alwin-Fp\model\checkpoints\mobilevit_appliance.onnx"
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

**Solution 2: Check firewall**
- Windows Defender Firewall
- Allow port 8000 inbound
- Or disable for local network testing

**Solution 3: Enter IP manually**
- Use manual configuration
- Enter exact IP: `192.168.X.X`
- Or with port: `192.168.X.X:8000`

### "Cannot connect" error

- Wrong IP address
- Server not running
- Different WiFi network
- Firewall blocking port 8000

## API Endpoints Used

### Health Check
```
GET /health
Returns: {"status": "ok", "model_loaded": true}
```

### Detection
```
POST /detect
Body: FormData with image file
Returns: {
  "class": "TV",
  "confidence": 0.95,
  "all_predictions": {...}
}
```

### Feedback
```
POST /feedback
Body: {
  "predicted_class": "TV",
  "confidence": 0.95,
  "is_correct": true
}
```

## Automatic IP Configuration Flow

```
App Start
    ↓
Get Phone's Network IP (e.g., 192.168.1.50)
    ↓
Extract Network Prefix (192.168.1)
    ↓
Scan IPs: 192.168.1.1 → 192.168.1.20
    ↓
For each IP, test ports: 8000, 5000, 3000
    ↓
Send: GET http://IP:PORT/health
    ↓
If 200 OK → Add to "Detected Servers" list
    ↓
Show all found servers
    ↓
User selects or enters manually
    ↓
Test connection → Save to device storage
    ↓
Launch Camera Screen with configured IP
```

## Saved Configuration

**Location**: Device AsyncStorage  
**Key**: `SERVER_IP`  
**Persisted**: Yes (survives app restart)

**Example Value**:
```
192.168.1.100:8000
```

## Advanced

### Change Detection Timeout
[ConfigScreen.js](./screens/ConfigScreen.js) line 96:
```javascript
timeout: 2000, // Change to desired milliseconds
```

### Change Network Scan Range
[ConfigScreen.js](./screens/ConfigScreen.js) line 88:
```javascript
const ipsToScan = Array.from({ length: 20 }, ...); // Change 20 to more/less
```

### Change Default Port
[CameraScreen.js](./screens/CameraScreen.js) line 37:
```javascript
`http://${serverIp}/detect`
// Default adds :8000 automatically
```

## Testing

### Test on Same Machine
```bash
# Terminal 1: Start server
cd X:\Alwin-Fp\server
python -m uvicorn main:app --host 0.0.0.0 --port 8000

# Terminal 2: Test detection
curl -X GET http://localhost:8000/health
```

### Test from Android Emulator
```bash
# For localhost on Android, use special IP:
# 10.0.2.2 instead of 127.0.0.1

# But better: use real device on WiFi
```

---

✅ **Setup complete!** The app now auto-configures on first launch.
