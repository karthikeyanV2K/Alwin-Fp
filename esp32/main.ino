/**
 * main.ino — Vision Smart Control ESP32 Firmware
 * ================================================
 * Board: ESP32 Dev Module (or any ESP32 variant)
 * Libraries required (install via Arduino Library Manager):
 *   - ArduinoJson  (v6.x)
 *   - WiFi         (built-in with ESP32 board package)
 *   - WebServer    (built-in with ESP32 board package)
 *   - ESPmDNS      (built-in with ESP32 board package)
 *
 * After flashing:
 *   - Open Serial Monitor at 115200 baud to see the assigned IP.
 *   - Alternatively, find the device at http://smart-control.local/status
 *
 * HTTP API:
 *   POST /control  — body: {"device":"TV","state":"ON"}
 *   GET  /status   — returns: {"TV":"OFF","Fan":"ON",...}
 *   GET  /         — basic info page
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <ArduinoJson.h>
#include "config.h"

// ── Pin table ────────────────────────────────────────────────────────────────
struct DevicePin { const char* name; int pin; };
const DevicePin DEVICES[] = {
  {"TV",    PIN_TV   },
  {"Fan",   PIN_FAN  },
  {"AC",    PIN_AC   },
  {"Light", PIN_LIGHT},
  {"Plug",  PIN_PLUG },
};
const int NUM_DEVICES = sizeof(DEVICES) / sizeof(DEVICES[0]);

// Track ON/OFF state
bool deviceState[5] = { false, false, false, false, false };

WebServer server(HTTP_PORT);

// ── Helpers ──────────────────────────────────────────────────────────────────
int findDevice(const char* name) {
  for (int i = 0; i < NUM_DEVICES; i++) {
    if (strcasecmp(DEVICES[i].name, name) == 0) return i;
  }
  return -1;
}

void setDevice(int idx, bool on) {
  deviceState[idx] = on;
#if RELAY_ACTIVE_LOW
  digitalWrite(DEVICES[idx].pin, on ? LOW : HIGH);
#else
  digitalWrite(DEVICES[idx].pin, on ? HIGH : LOW);
#endif
}

// ── CORS helper ──────────────────────────────────────────────────────────────
void addCORS() {
  server.sendHeader("Access-Control-Allow-Origin",  "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ── GET / ────────────────────────────────────────────────────────────────────
void handleRoot() {
  addCORS();
  String html = "<h2>Vision Smart Control</h2>";
  html += "<p>ESP32 Appliance Controller is running.</p>";
  html += "<p><a href='/status'>Device Status (JSON)</a></p>";
  server.send(200, "text/html", html);
}

// ── GET /status ──────────────────────────────────────────────────────────────
void handleStatus() {
  addCORS();
  StaticJsonDocument<256> doc;
  for (int i = 0; i < NUM_DEVICES; i++) {
    doc[DEVICES[i].name] = deviceState[i] ? "ON" : "OFF";
  }
  String body;
  serializeJson(doc, body);
  server.send(200, "application/json", body);
}

// ── POST /control ─────────────────────────────────────────────────────────────
void handleControl() {
  addCORS();
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"No body\"}");
    return;
  }

  StaticJsonDocument<128> doc;
  DeserializationError err = deserializeJson(doc, server.arg("plain"));
  if (err) {
    server.send(400, "application/json", "{\"error\":\"Bad JSON\"}");
    return;
  }

  const char* device = doc["device"];
  const char* state  = doc["state"];
  if (!device || !state) {
    server.send(400, "application/json", "{\"error\":\"Missing device or state\"}");
    return;
  }

  int idx = findDevice(device);
  if (idx < 0) {
    server.send(404, "application/json", "{\"error\":\"Unknown device\"}");
    return;
  }

  bool turnOn = (strcasecmp(state, "ON") == 0);
  setDevice(idx, turnOn);

  Serial.printf("[Control] %s → %s (pin %d)\n", device, state, DEVICES[idx].pin);

  StaticJsonDocument<128> resp;
  resp["ok"]     = true;
  resp["device"] = device;
  resp["state"]  = turnOn ? "ON" : "OFF";
  String body;
  serializeJson(resp, body);
  server.send(200, "application/json", body);
}

// ── OPTIONS (preflight) ───────────────────────────────────────────────────────
void handleOptions() {
  addCORS();
  server.send(204, "text/plain", "");
}

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(200);

  // Init GPIO pins as OUTPUT, default OFF
  for (int i = 0; i < NUM_DEVICES; i++) {
    pinMode(DEVICES[i].pin, OUTPUT);
    setDevice(i, false);   // Start in OFF state
  }

  // Connect WiFi
  Serial.printf("\n[WiFi] Connecting to: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempt = 0;
  while (WiFi.status() != WL_CONNECTED && attempt < 30) {
    delay(500);
    Serial.print(".");
    attempt++;
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\n[ERROR] WiFi failed — restarting in 5s");
    delay(5000);
    ESP.restart();
  }
  Serial.printf("\n[WiFi] Connected. IP: %s\n", WiFi.localIP().toString().c_str());

  // mDNS → http://smart-control.local
  if (MDNS.begin("smart-control")) {
    Serial.println("[mDNS] Registered: smart-control.local");
  }

  // HTTP routes
  server.on("/",        HTTP_GET,     handleRoot);
  server.on("/status",  HTTP_GET,     handleStatus);
  server.on("/control", HTTP_POST,    handleControl);
  server.on("/control", HTTP_OPTIONS, handleOptions);
  server.on("/status",  HTTP_OPTIONS, handleOptions);
  server.begin();

  Serial.printf("[HTTP] Server started on port %d\n", HTTP_PORT);
}

// ── Loop ──────────────────────────────────────────────────────────────────────
void loop() {
  server.handleClient();
  MDNS.update();
}
