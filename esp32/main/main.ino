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
 * HTTP API:
 *   GET  /        — Two-phase control dashboard (HTML)
 *   GET  /probe   — Detect which relay pins have hardware connected
 *   POST /control — {"device":"TV","state":"ON"}
 *   GET  /status  — Returns {"TV":"OFF","Fan":"ON",...}
 */

#include <WiFi.h>
#include <WiFiMulti.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <ArduinoJson.h>
#include "config.h"

WiFiMulti wifiMulti;

// ── Pin table ─────────────────────────────────────────────────────────────────
// Each room's bulb has its own relay channel.
// Device names MUST match what the server sends (e.g. "Light_Bedroom").
struct DevicePin { const char* name; int pin; };
const DevicePin DEVICES[] = {
  {"Yellow", PIN_LIGHT_BEDROOM},  // GPIO19 → IN1 → Bedroom bulb
  {"White",  PIN_LIGHT_LIVING },  // GPIO18 → IN2 → Living room bulb
  {"Light_Kitchen", PIN_LIGHT_KITCHEN},  // GPIO23 → IN3 → Kitchen bulb
  {"Blue",          PIN_PLUG         },  // GPIO21 → IN4 → Power plug
};
const int NUM_DEVICES = sizeof(DEVICES) / sizeof(DEVICES[0]);

bool deviceState[4] = { false, false, false, false };

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

void addCORS() {
  server.sendHeader("Access-Control-Allow-Origin",  "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ── GET /probe — Hardware Detection ──────────────────────────────────────────
// Briefly switches each pin to INPUT_PULLUP.
// Active-low relay board with coil connected pulls the line LOW = connected.
// Floating unconnected pin stays HIGH = nothing there.
void handleProbe() {
  addCORS();
  StaticJsonDocument<512> doc;

  for (int i = 0; i < NUM_DEVICES; i++) {
    int p = DEVICES[i].pin;

    // Safe OFF state first
    setDevice(i, false);
    delay(10);

    // Use INPUT_PULLDOWN: ESP32's 45k pulldown vs relay module's 10k pull-up
    // Connected relay module: 10k up wins  → reads HIGH = connected
    // Floating unconnected pin: 45k down wins → reads LOW = nothing
    pinMode(p, INPUT_PULLDOWN);
    delay(25);
    int reading = digitalRead(p);

    bool connected = (reading == HIGH);  // HIGH = relay module pull-up detected

    // Restore OUTPUT and keep OFF
    pinMode(p, OUTPUT);
    setDevice(i, false);

    JsonObject obj = doc.createNestedObject(DEVICES[i].name);
    obj["pin"]       = p;
    obj["connected"] = connected;

    Serial.printf("[Probe] %s (GPIO%d): %s\n",
                  DEVICES[i].name, p, connected ? "CONNECTED" : "not detected");
  }

  String body;
  serializeJson(doc, body);
  server.send(200, "application/json", body);
}

// ── GET /status ───────────────────────────────────────────────────────────────
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
  Serial.printf("[Control] %s -> %s (GPIO%d)\n", device, state, DEVICES[idx].pin);

  StaticJsonDocument<128> resp;
  resp["ok"]     = true;
  resp["device"] = device;
  resp["state"]  = turnOn ? "ON" : "OFF";
  String body;
  serializeJson(resp, body);
  server.send(200, "application/json", body);
}

void handleOptions() {
  addCORS();
  server.send(204, "text/plain", "");
}

// ── GET / — Two-Phase Dashboard ───────────────────────────────────────────────
void handleRoot() {
  addCORS();
  server.send(200, "text/html",
R"rawhtml(<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Smart Control Panel</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',sans-serif;background:#0d0d1a;color:#e0e0ff;min-height:100vh;padding:16px}
h1{text-align:center;font-size:1.5rem;margin-bottom:4px;color:#a78bfa}
.sub{text-align:center;font-size:.8rem;color:#555;margin-bottom:24px}
#phase1,#phase2{max-width:680px;margin:0 auto}
#phase2{display:none}
.scan-box{display:flex;flex-direction:column;align-items:center;gap:16px;margin-top:30px}
.scan-btn{background:#7c3aed;color:#fff;border:none;border-radius:14px;padding:14px 36px;font-size:1rem;font-weight:700;cursor:pointer;transition:background .2s}
.scan-btn:hover{background:#6d28d9}
.scan-btn:disabled{background:#333;color:#555;cursor:not-allowed}
.scan-info{font-size:.82rem;color:#555;text-align:center;max-width:300px;line-height:1.6}
.probe-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin:20px 0}
.pcard{background:#141424;border-radius:12px;padding:14px;text-align:center;border:1px solid #222;transition:border .3s}
.pcard.ok{border-color:#7c3aed}
.pcard.nope{opacity:.4}
.picon{font-size:1.8rem;margin-bottom:6px}
.pname{font-size:.85rem;font-weight:600;margin-bottom:3px}
.ppin{font-size:.68rem;color:#444;margin-bottom:6px}
.pbadge{font-size:.7rem;font-weight:700;padding:2px 10px;border-radius:10px}
.pbadge.ok{background:#7c3aed22;color:#a78bfa;border:1px solid #7c3aed55}
.pbadge.nope{background:#111;color:#444;border:1px solid #222}
.ctrl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:12px;margin-top:8px}
.ccard{background:#141424;border-radius:14px;padding:18px;display:flex;flex-direction:column;align-items:center;gap:10px;border:1px solid #222;transition:border-color .3s,background .3s}
.ccard.on{border-color:#7c3aed;background:#160f2a}
.cicon{font-size:2rem}
.cname{font-size:.95rem;font-weight:600}
.badge{font-size:.7rem;padding:2px 12px;border-radius:20px;font-weight:700;letter-spacing:1px}
.badge.on{background:#7c3aed33;color:#a78bfa;border:1px solid #7c3aed}
.badge.off{background:#1a1a1a;color:#555;border:1px solid #222}
.btns{display:flex;gap:8px;width:100%}
.btn{flex:1;padding:9px 4px;border:none;border-radius:8px;font-size:.9rem;font-weight:700;cursor:pointer;transition:transform .1s}
.btn:active{transform:scale(.94)}
.bon{background:#7c3aed;color:#fff}
.bon:hover{background:#6d28d9}
.boff{background:#1e1e36;color:#777;border:1px solid #2a2a4a}
.boff:hover{background:#23233f;color:#aaa}
.row{display:flex;justify-content:space-between;align-items:center;margin:10px 0}
.row span{font-size:.75rem;color:#444}
.rbtn{background:transparent;color:#7c3aed;border:1px solid #7c3aed44;border-radius:8px;padding:5px 14px;font-size:.78rem;cursor:pointer}
.rbtn:hover{background:#7c3aed22}
.bbtn{background:transparent;color:#555;border:1px solid #333;border-radius:8px;padding:6px 18px;font-size:.8rem;cursor:pointer;margin-top:14px}
.bbtn:hover{color:#aaa;border-color:#555}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1035;border:1px solid #7c3aed;color:#c4b5fd;padding:9px 22px;border-radius:10px;font-size:.85rem;opacity:0;transition:opacity .3s;pointer-events:none;white-space:nowrap}
.toast.show{opacity:1}
.ftr{text-align:center;margin-top:28px;font-size:.72rem;color:#2a2a3a}
</style>
</head>
<body>
<h1>&#x26A1; Smart Control Panel</h1>
<p class="sub" id="ipline">ESP32 Hardware Control</p>

<!-- Phase 1: Hardware Scan -->
<div id="phase1">
  <div class="scan-box">
    <div style="font-size:3.5rem">&#x1F50C;</div>
    <p style="font-size:1rem;font-weight:600;color:#c4b5fd">Hardware Detection</p>
    <p class="scan-info">Scans each relay GPIO pin to detect what is physically connected before enabling manual controls.</p>
    <button class="scan-btn" id="scanBtn" onclick="doScan()">&#x1F50D; Scan Connected Hardware</button>
  </div>
  <div class="probe-grid" id="probeGrid" style="display:none"></div>
  <div style="text-align:center;display:none" id="goRow">
    <button class="scan-btn" style="padding:11px 28px;font-size:.92rem" onclick="showControls()">&#x25B6; Open Controls</button>
  </div>
</div>

<!-- Phase 2: Controls -->
<div id="phase2">
  <div class="row">
    <span id="lastRefresh">Live status</span>
    <button class="rbtn" onclick="refreshStatus()">&#x21BA; Refresh</button>
  </div>
  <div class="ctrl-grid" id="ctrlGrid"></div>
  <div style="text-align:center">
    <button class="bbtn" onclick="goBack()">&#x2190; Re-scan Hardware</button>
  </div>
</div>

<div class="toast" id="toast"></div>
<p class="ftr">Auto-refresh 4s &middot; Vision Smart Control</p>

<script>
const ICONS={TV:'&#x1F4FA;',Fan:'&#x1F300;',AC:'&#x2744;&#xFE0F;',Light:'&#x1F4A1;',Plug:'&#x1F50C;'};
let probe={};
let st={};
let timer=null;

async function getJson(u){const r=await fetch(u);return r.json();}
async function postJson(u,b){
  const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
  return r.json();
}

function toast(m,d=2400){
  const t=document.getElementById('toast');
  t.innerHTML=m;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),d);
}

async function doScan(){
  const btn=document.getElementById('scanBtn');
  btn.disabled=true;btn.textContent='Scanning...';
  document.getElementById('probeGrid').style.display='none';
  document.getElementById('goRow').style.display='none';
  try{
    probe=await getJson('/probe');
    renderProbe();
  }catch(e){toast('Scan failed: '+e.message);}
  finally{btn.disabled=false;btn.innerHTML='&#x1F50D; Scan Connected Hardware';}
}

function renderProbe(){
  const g=document.getElementById('probeGrid');
  g.innerHTML='';
  let cnt=0;
  Object.entries(probe).forEach(([dev,info])=>{
    const ok=info.connected;
    if(ok)cnt++;
    g.innerHTML+=`<div class="pcard ${ok?'ok':'nope'}">
      <div class="picon">${ICONS[dev]||'&#x1F532;'}</div>
      <div class="pname">${dev}</div>
      <div class="ppin">GPIO ${info.pin}</div>
      <span class="pbadge ${ok?'ok':'nope'}">${ok?'&#x2714; Connected':'&#x2718; Not found'}</span>
    </div>`;
  });
  g.style.display='grid';
  if(cnt>0){
    document.getElementById('goRow').style.display='block';
  } else {
    toast('No relays detected. Check your wiring.');
  }
}

async function showControls(){
  document.getElementById('phase1').style.display='none';
  document.getElementById('phase2').style.display='block';
  await refreshStatus();
  timer=setInterval(refreshStatus,4000);
}

function goBack(){
  clearInterval(timer);
  document.getElementById('phase2').style.display='none';
  document.getElementById('phase1').style.display='block';
}

async function refreshStatus(){
  try{
    st=await getJson('/status');
    renderControls();
    document.getElementById('lastRefresh').textContent='Updated '+new Date().toLocaleTimeString();
  }catch(e){}
}

function renderControls(){
  const g=document.getElementById('ctrlGrid');
  const connected=Object.keys(probe).filter(k=>probe[k].connected);
  g.innerHTML='';
  connected.forEach(dev=>{
    const on=st[dev]==='ON';
    g.innerHTML+=`<div class="ccard ${on?'on':''}" id="cc-${dev}">
      <div class="cicon">${ICONS[dev]||'&#x1F50C;'}</div>
      <div class="cname">${dev}</div>
      <span class="badge ${on?'on':'off'}">${on?'ON':'OFF'}</span>
      <div class="btns">
        <button class="btn bon" onclick="ctrl('${dev}','ON')">ON</button>
        <button class="btn boff" onclick="ctrl('${dev}','OFF')">OFF</button>
      </div>
    </div>`;
  });
}

async function ctrl(dev,s){
  try{
    const j=await postJson('/control',{device:dev,state:s});
    if(j.ok){st[dev]=s;renderControls();toast(dev+' turned '+s);}
  }catch(e){toast('Error: '+e.message);}
}

document.getElementById('ipline').textContent='ESP32 \u00B7 '+window.location.hostname;
</script>
</body>
</html>)rawhtml");
}

// ── Setup ──────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(200);

  for (int i = 0; i < NUM_DEVICES; i++) {
    pinMode(DEVICES[i].pin, OUTPUT);
    setDevice(i, false);
  }

  Serial.println("\n[WiFi] Connecting to WiFi...");
  WiFi.mode(WIFI_STA);
  
  // Register multiple networks. It will try to connect to the strongest one available.
  wifiMulti.addAP(WIFI_SSID_1, WIFI_PASSWORD_1);
  wifiMulti.addAP(WIFI_SSID_2, WIFI_PASSWORD_2);
  // wifiMulti.addAP("SSID_3", "PASSWORD_3"); // You can add even more here if needed
  
  int attempt = 0;
  while (wifiMulti.run() != WL_CONNECTED && attempt < 30) {
    delay(500); Serial.print("."); attempt++;
  }
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\n[ERROR] WiFi failed - restarting in 5s");
    delay(5000); ESP.restart();
  }
  
  Serial.printf("\n[WiFi] Connected to: %s\n", WiFi.SSID().c_str());
  Serial.printf("[WiFi] IP Address: %s\n", WiFi.localIP().toString().c_str());

  if (MDNS.begin("smart-control")) {
    Serial.println("[mDNS] Registered: smart-control.local");
  }

  server.on("/",        HTTP_GET,     handleRoot);
  server.on("/status",  HTTP_GET,     handleStatus);
  server.on("/probe",   HTTP_GET,     handleProbe);
  server.on("/control", HTTP_POST,    handleControl);
  server.on("/control", HTTP_OPTIONS, handleOptions);
  server.on("/status",  HTTP_OPTIONS, handleOptions);
  server.on("/probe",   HTTP_OPTIONS, handleOptions);
  server.begin();

  Serial.printf("[HTTP] Server started on port %d\n", HTTP_PORT);
}

// ── Loop ───────────────────────────────────────────────────────────────────────
void loop() {
  server.handleClient();
}
