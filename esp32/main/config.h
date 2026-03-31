/**
 * config.h — ESP32 WiFi & Pin Configuration
 * ==========================================
 * Edit WIFI_SSID, WIFI_PASSWORD and the pin map before flashing.
 */
#pragma once

// ── WiFi ────────────────────────────────────────────────────────────────────
#define WIFI_SSID_1      "Sweethome"
#define WIFI_PASSWORD_1  "sweethome@2026"

#define WIFI_SSID_2      "Akash"
#define WIFI_PASSWORD_2  "Akaash@123"

// ── Relay Config ─────────────────────────────────────────────────────────────
//   Active-low relay board: HIGH = OFF, LOW = ON
//   Set to 0 if your relay board is active-high
#define RELAY_ACTIVE_LOW 1

// ── GPIO Pin Map ──────────────────────────────────────────────────────────────
//   ESP32 → Relay Module
//   GPIO19 → IN1  (Bedroom Light)
//   GPIO18 → IN2  (Living Room Light)
//   GPIO23 → IN3  (Kitchen Light)
//   GPIO21 → IN4  (Plug)
#define PIN_LIGHT_BEDROOM  19
#define PIN_LIGHT_LIVING   18
#define PIN_LIGHT_KITCHEN  23
#define PIN_PLUG           21

// ── HTTP Server ───────────────────────────────────────────────────────────────
#define HTTP_PORT 80