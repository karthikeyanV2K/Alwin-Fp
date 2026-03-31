/**
 * config.h — ESP32 WiFi & Pin Configuration
 * ==========================================
 * Edit WIFI_SSID, WIFI_PASSWORD and the pin map before flashing.
 */
#pragma once

// ── WiFi ───────────────────────────────────────────────────────────────────
#define WIFI_SSID_1     "Sweethome"
#define WIFI_PASSWORD_1 "sweethome@2026"

#define WIFI_SSID_2     "Backup_WiFi"       // Change this to your 2nd WiFi SSID
#define WIFI_PASSWORD_2 "backup_password"   // Change this to your 2nd WiFi Password

// ── GPIO Pin Map (label → GPIO number) ────────────────────────────────────
//   Relay modules are typically ACTIVE-LOW: HIGH = off, LOW = on.
//   Set RELAY_ACTIVE_LOW to 1 if using an active-low relay board.
#define RELAY_ACTIVE_LOW 1

// Connected: ESP32 VIN→VCC, GND→GND, GPIO19→IN1, GPIO21→IN2
#define PIN_LIGHT 19   // IN1 → Relay channel 1 (bulb)
#define PIN_PLUG  21   // IN2 → Relay channel 2

// ── HTTP Server Port ────────────────────────────────────────────────────────
#define HTTP_PORT 80
