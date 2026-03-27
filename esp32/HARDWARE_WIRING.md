# ESP32 + 2-Channel Relay + Bulb — Hardware Wiring Guide

---

## 📦 Components

| Component | Details |
|---|---|
| ESP32 Dev Module | Any 30-pin or 38-pin variant |
| 2-Channel Relay Module | 5V coil, Active-LOW |
| Bulb + Holder | 220V AC (or any AC load) |
| Power Supply | USB → ESP32, Wall socket → Relay load side |

---

## 1. LOW-VOLTAGE SIDE — ESP32 → Relay Control Pins

```
          ESP32 Dev Module
         ┌──────────────────┐
         │               VIN├──────────────────── VCC  ┐
         │               GND├──────────────────── GND  │  2-Channel
         │                  │                           │  Relay Module
         │            GPIO19├──────────────────── IN1  │  (CH1 → Light)
         │            GPIO21├──────────────────── IN2  │  (CH2 → Plug)
         │                  │                          ─┘
         └──────────────────┘
```

> **VIN = 5V from USB.** Use VIN, not 3.3V — relay coils need 5V.

---

## 2. HIGH-VOLTAGE SIDE — Relay → Bulb (⚡ 220V AC)

> ⚠️ **DANGER: Mains voltage. Cut power before wiring. Only touch insulated parts.**

Each relay channel has 3 screw terminals: **COM**, **NO**, **NC**

```
  Wall Socket
  ┌──────────┐
  │          │
  │  LIVE ───┼──────────────────────┐
  │          │                      │
  │ NEUTRAL──┼──────────────────┐   │
  │          │                  │   │
  └──────────┘                  │   │
                                │   │
              2-Channel Relay   │   │
             ┌──────────────────┴───┴────┐
             │ CH1                       │
             │  COM ◄────────────── LIVE │
             │  NO  ─────────────────────┼──────┐
             │  NC  (leave empty)        │      │
             └───────────────────────────┘      │
                                                │
                            BULB                │
                          ┌──────┐              │
                          │  💡  │              │
                      ────┤  +   ├──────────────┘  ← from NO
                          │  -   ├──────────────── NEUTRAL
                          └──────┘
```

### In plain words:
1. **Cut only the LIVE wire** from your wall plug cable
2. One cut end → screw into **COM**
3. Other cut end → screw into **NO**
4. **Neutral wire** passes straight through to the bulb — don't cut it
5. Repeat for CH2 if wiring a second device

---

## 3. Full End-to-End Diagram

```
 USB Power                                    Wall Socket (220V)
    │                                         LIVE ──┐  NEUTRAL ──┐
    ▼                                                │             │
┌─────────────────────────────┐                     │             │
│       ESP32 Dev Module      │    ┌────────────────────────────────────────┐
│                             │    │         2-Channel Relay Module         │
│  VIN ───────────────────────┼────┤ VCC                                    │
│  GND ───────────────────────┼────┤ GND                                    │
│                             │    │                                        │
│  GPIO19 ────────────────────┼────┤ IN1   CH1: COM ◄── LIVE               │
│  GPIO21 ────────────────────┼────┤ IN2         NO  ───────────────────┐   │
│                             │    │             NC  (unused)           │   │
│  (GPIO4,5,18 unused        │    │                                    │   │
│   on relay — only 2 CH)    │    │        CH2: COM ◄── (2nd device)  │   │
└─────────────────────────────┘    └────────────────────────────────────────┘
                                                                        │
                                          ┌─────────────────────────────┘
                                          │
                                     ┌────┴────┐
                                     │   💡    │
                                     │  BULB   │
                                     └────┬────┘
                                          │
                                       NEUTRAL ──────────────────────────────┘
```

---

## 4. GPIO → Device Map (your config.h)

| Device | GPIO | Relay Channel | Notes |
|---|---|---|---|
| **Light** | **GPIO 19** | **CH1** | ✅ Wire bulb here |
| **Plug** | **GPIO 21** | **CH2** | ✅ Wire 2nd device here |
| TV | GPIO 4 | — | ❌ No relay (expand later) |
| Fan | GPIO 5 | — | ❌ No relay (expand later) |
| AC | GPIO 18 | — | ❌ No relay (expand later) |

---

## 5. Test It (after flashing)

Open Serial Monitor at **115200 baud**, then send an HTTP request:

```bash
# Turn Light ON
curl -X POST http://<ESP32_IP>/control \
     -H "Content-Type: application/json" \
     -d '{"device":"Light","state":"ON"}'

# Check status
curl http://<ESP32_IP>/status
```

Or use the web dashboard — the ESP32's IP is printed in Serial Monitor on boot.

---

> [!CAUTION]
> Always double-check all 220V connections are properly insulated with electrical tape before powering on. When testing for the first time, use a low-power bulb (≤ 40W).
