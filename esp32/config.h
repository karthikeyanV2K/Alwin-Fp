/**
 * config.h — ESP32 WiFi & Pin Configuration
 * ==========================================
 * Edit WIFI_SSID, WIFI_PASSWORD and the pin map before flashing.
 */
#pragma once

// ── WiFi ───────────────────────────────────────────────────────────────────
#define WIFI_SSID     "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// ── GPIO Pin Map (label → GPIO number) ────────────────────────────────────
//   Relay modules are typically ACTIVE-LOW: HIGH = off, LOW = on.
//   Set RELAY_ACTIVE_LOW to 1 if using an active-low relay board.
#define RELAY_ACTIVE_LOW 1

#define PIN_TV    4
#define PIN_FAN   5
#define PIN_AC    18
#define PIN_LIGHT 19
#define PIN_PLUG  21

// ── HTTP Server Port ────────────────────────────────────────────────────────
#define HTTP_PORT 80
