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

// Connected: ESP32 VIN→VCC, GND→GND
//   GPIO19 → IN1  (Bedroom Light)
//   GPIO18 → IN2  (Living Room Light)
//   GPIO23 → IN3  (Kitchen Light)
//   GPIO21 → IN4  (Plug)
#define PIN_LIGHT_BEDROOM  19   // IN1 → Bedroom bulb
#define PIN_LIGHT_LIVING   18   // IN2 → Living room bulb
#define PIN_LIGHT_KITCHEN  23   // IN3 → Kitchen bulb
#define PIN_PLUG           21   // IN4 → Power plug

// ── HTTP Server Port ────────────────────────────────────────────────────────
#define HTTP_PORT 80
