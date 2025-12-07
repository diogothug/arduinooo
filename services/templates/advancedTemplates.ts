

export const generateShaderEngineH = () => `
#ifndef SHADER_ENGINE_H
#define SHADER_ENGINE_H

#include <Arduino.h>
#include "modules/led_ws2812b/ws2812b_controller.h"

// A simplified expression evaluator (Mini Shader)
// Supported: + - * / sin cos abs min max time idx pos
// Syntax: "sin(time + pos * 5) * 255"

class ShaderEngine {
public:
    static void run(String formula, WS2812BController* ctrl, float time, float tideLevel);
    
private:
    static float evaluate(String expr, float t, float i, float pos, float tide);
    static float parseExpression(String& expr, float t, float i, float pos, float tide);
    static float parseTerm(String& expr, float t, float i, float pos, float tide);
    static float parseFactor(String& expr, float t, float i, float pos, float tide);
};

#endif
`;

export const generateShaderEngineCpp = () => `
#include "ShaderEngine.h"

// NOTE: In a real production environment, use "TinyExpr" library.
// This is a simplified recursive descent parser for demonstration/fallback.

void ShaderEngine::run(String formula, WS2812BController* ctrl, float time, float tideLevel) {
    int count = ctrl->getNumLeds();
    
    for(int i=0; i<count; i++) {
        // Prepare Uniforms
        float normPos = (float)i / (float)count;
        
        // Execute Shader for Brightness/Pattern
        // Note: For full RGB, we'd need vec3 logic. Here we map result to a gradient.
        String f = formula; // Copy
        float val = evaluate(f, time, (float)i, normPos, tideLevel);
        
        // Clamp 0-255
        if (val < 0) val = 0; if (val > 255) val = 255;
        
        // Apply to LED (Simple Blue Gradient Mapping)
        CRGB color = CRGB(0, (int)(val*0.5), (int)val);
        ctrl->setPixel(i, color);
    }
    ctrl->show();
}

float ShaderEngine::evaluate(String expr, float t, float i, float pos, float tide) {
    // Simplify input string (remove spaces)
    expr.replace(" ", "");
    return parseExpression(expr, t, i, pos, tide);
}

float ShaderEngine::parseExpression(String& expr, float t, float i, float pos, float tide) {
    float left = parseTerm(expr, t, i, pos, tide);
    while (expr.length() > 0 && (expr.charAt(0) == '+' || expr.charAt(0) == '-')) {
        char op = expr.charAt(0);
        expr.remove(0, 1);
        float right = parseTerm(expr, t, i, pos, tide);
        if (op == '+') left += right;
        else left -= right;
    }
    return left;
}

float ShaderEngine::parseTerm(String& expr, float t, float i, float pos, float tide) {
    float left = parseFactor(expr, t, i, pos, tide);
    while (expr.length() > 0 && (expr.charAt(0) == '*' || expr.charAt(0) == '/')) {
        char op = expr.charAt(0);
        expr.remove(0, 1);
        float right = parseFactor(expr, t, i, pos, tide);
        if (op == '*') left *= right;
        else if(right != 0) left /= right;
    }
    return left;
}

float ShaderEngine::parseFactor(String& expr, float t, float i, float pos, float tide) {
    if (expr.length() == 0) return 0;
    
    // Parentheses
    if (expr.charAt(0) == '(') {
        expr.remove(0, 1);
        float val = parseExpression(expr, t, i, pos, tide);
        if (expr.length() > 0 && expr.charAt(0) == ')') expr.remove(0, 1);
        return val;
    }
    
    // Functions
    if (expr.startsWith("sin")) {
        expr.remove(0, 3);
        // Expect (
        return sin(parseFactor(expr, t, i, pos, tide));
    }
    if (expr.startsWith("cos")) {
        expr.remove(0, 3);
        return cos(parseFactor(expr, t, i, pos, tide));
    }

    // Variables
    if (expr.startsWith("time")) { expr.remove(0, 4); return t; }
    if (expr.startsWith("t")) { expr.remove(0, 1); return t; }
    if (expr.startsWith("pos")) { expr.remove(0, 3); return pos; }
    if (expr.startsWith("i")) { expr.remove(0, 1); return i; }
    if (expr.startsWith("level")) { expr.remove(0, 5); return tide; }

    // Numbers
    String numStr = "";
    while (expr.length() > 0 && (isdigit(expr.charAt(0)) || expr.charAt(0) == '.')) {
        numStr += expr.charAt(0);
        expr.remove(0, 1);
    }
    if (numStr.length() > 0) return numStr.toFloat();
    
    return 0;
}
`;

export const generateSystemHealthH = () => `
#ifndef SYSTEM_HEALTH_H
#define SYSTEM_HEALTH_H

#include <Arduino.h>
#include <ArduinoJson.h>

// This module is kept for backward compatibility. 
// Advanced features should use TelemetryManager.

class SystemHealth {
public:
    static void begin();
    static void check();
    static String getReportJson();
    
private:
    static float readVoltage();
    static int getWifiQuality();
    static int _failCount;
};

#endif
`;

export const generateSystemHealthCpp = () => `
#include "SystemHealth.h"
#include <WiFi.h>

int SystemHealth::_failCount = 0;

void SystemHealth::begin() {
    analogReadResolution(12);
}

void SystemHealth::check() {
    if (WiFi.status() != WL_CONNECTED) _failCount++;
}

float SystemHealth::readVoltage() {
    return 4.95; 
}

int SystemHealth::getWifiQuality() {
    if (WiFi.status() != WL_CONNECTED) return 0;
    long rssi = WiFi.RSSI();
    int quality = 2 * (rssi + 100);
    if (quality > 100) quality = 100;
    if (quality < 0) quality = 0;
    return quality;
}

String SystemHealth::getReportJson() {
    StaticJsonDocument<256> doc;
    doc["voltage"] = readVoltage();
    doc["wifi_signal"] = getWifiQuality();
    doc["heap_free"] = ESP.getFreeHeap();
    doc["uptime"] = millis() / 1000;
    doc["api_fails"] = _failCount;
    doc["status"] = _failCount > 10 ? "WARNING" : "HEALTHY";
    
    String out;
    serializeJson(doc, out);
    return out;
}
`;

export const generateWebDashboardH = () => `
#ifndef WEB_DASHBOARD_H
#define WEB_DASHBOARD_H

// Minified embedded dashboard
const char* INDEX_HTML_GZ = 
"<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'><style>"
"body{background:#0f172a;color:#fff;font-family:sans-serif;padding:20px;}"
".card{background:#1e293b;border-radius:8px;padding:15px;margin-bottom:10px;}"
"h1{color:#22d3ee;font-size:1.2rem;} button{background:#0284c7;color:white;border:none;padding:10px;border-radius:5px;width:100%;margin-top:5px;}"
".stat{display:flex;justify-content:space-between;border-bottom:1px solid #334155;padding:5px 0;font-size:0.9rem;}"
"</style></head><body>"
"<h1>TideFlux Telemetry</h1>"
"<div class='card' id='dash'>Loading telemetry...</div>"
"<div class='card'>"
"<button onclick='cmd(\"reboot\")'>Reboot System</button>"
"<button onclick='cmd(\"test_leds\")'>Test LEDs</button>"
"</div>"
"<script>"
"function cmd(c){fetch('/api/'+c, {method:'POST'});}"
"setInterval(()=>{fetch('/api/telemetry').then(r=>r.json()).then(j=>{"
"let h='';"
"for(const [k,v] of Object.entries(j)){h+=\`<div class=\\"stat\\"><span>\${k}</span><strong>\${v}</strong></div>\`;}"
"document.getElementById('dash').innerHTML=h;"
"})}, 2000);"
"</script></body></html>";

#endif
`;

// --- NEW TELEMETRY & PERFORMANCE MODULES ---

export const generateTelemetryManagerH = () => `
#ifndef TELEMETRY_MANAGER_H
#define TELEMETRY_MANAGER_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include <vector>

struct SystemMetrics {
    int fps;
    float temp; // Internal or Simulated
    int wifiRssi;
    int cpuLoad; // Approximation 0-100
    int apiFails;
    int fallbackCount;
    float ledPowerW;
    uint32_t freeHeap;
    unsigned long uptime;
    String criticalEvents; 
};

class TelemetryManager {
public:
    static SystemMetrics metrics;
    static void begin();
    
    // Setters called by other tasks
    static void updateFPS(int fps);
    static void registerFallback();
    static void registerApiFail();
    static void updateCPULoad(int load);
    static void addCriticalEvent(String evt);
    
    // Core logic
    static void collect(); 
    static String getJson();
    
private:
    static unsigned long _lastCollect;
};

#endif
`;

export const generateTelemetryManagerCpp = () => `
#include "TelemetryManager.h"
#include <WiFi.h>

#ifdef __cplusplus
extern "C" {
uint8_t temprature_sens_read();
}
#endif

SystemMetrics TelemetryManager::metrics;
unsigned long TelemetryManager::_lastCollect = 0;

void TelemetryManager::begin() {
    metrics.fps = 0;
    metrics.temp = 0.0;
    metrics.wifiRssi = 0;
    metrics.cpuLoad = 0;
    metrics.apiFails = 0;
    metrics.fallbackCount = 0;
    metrics.ledPowerW = 0.0;
    metrics.freeHeap = 0;
    metrics.uptime = 0;
    metrics.criticalEvents = "";
}

void TelemetryManager::updateFPS(int fps) {
    metrics.fps = fps;
}

void TelemetryManager::registerFallback() {
    metrics.fallbackCount++;
}

void TelemetryManager::registerApiFail() {
    metrics.apiFails++;
}

void TelemetryManager::updateCPULoad(int load) {
    metrics.cpuLoad = load;
}

void TelemetryManager::addCriticalEvent(String evt) {
    if (metrics.criticalEvents.length() > 0) metrics.criticalEvents += "|";
    metrics.criticalEvents += evt;
}

void TelemetryManager::collect() {
    metrics.uptime = millis() / 1000;
    metrics.freeHeap = ESP.getFreeHeap();
    
    if (WiFi.status() == WL_CONNECTED) {
        metrics.wifiRssi = WiFi.RSSI();
    } else {
        metrics.wifiRssi = -127;
    }
    
    // ESP32 Internal Temp (Approximate / Hardware Dependent)
    // Some newer ESP32 variants disable this sensor by default
    uint8_t temp_farenheit = temprature_sens_read();
    metrics.temp = (temp_farenheit - 32) / 1.8;
}

String TelemetryManager::getJson() {
    StaticJsonDocument<512> doc;
    doc["fps"] = metrics.fps;
    doc["temp"] = metrics.temp;
    doc["rssi"] = metrics.wifiRssi;
    doc["cpu"] = metrics.cpuLoad;
    doc["api_fail"] = metrics.apiFails;
    doc["fallback"] = metrics.fallbackCount;
    doc["heap"] = metrics.freeHeap;
    doc["uptime"] = metrics.uptime;
    if (metrics.criticalEvents.length() > 0) doc["crit"] = metrics.criticalEvents;
    
    String out;
    serializeJson(doc, out);
    return out;
}
`;

export const generatePerformanceManagerH = () => `
#ifndef PERFORMANCE_MANAGER_H
#define PERFORMANCE_MANAGER_H

#include <Arduino.h>

class PerformanceManager {
public:
    static void begin();
    static void evaluate(); // Auto-tuning logic loop
    static bool isThrottled();
    
private:
    static bool _throttled;
    static int _originalBrightness;
};

#endif
`;

export const generatePerformanceManagerCpp = () => `
#include "PerformanceManager.h"
#include "TelemetryManager.h"
#include "modules/led_ws2812b/ws2812b_config.h"
#include "LogManager.h"
#include <FastLED.h>

bool PerformanceManager::_throttled = false;
int PerformanceManager::_originalBrightness = -1;

void PerformanceManager::begin() {
    // Initial setup
}

void PerformanceManager::evaluate() {
    SystemMetrics& m = TelemetryManager::metrics;
    WS2812BConfig& cfg = WS2812BConfigManager::config;

    // Capture original brightness once
    if (_originalBrightness == -1) _originalBrightness = cfg.brightness;

    // RULE 1: Thermal Throttling
    if (m.temp > 75.0) {
         TIDE_LOGW("PerfManager: High Temp (%.1fC). Throttling Brightness.", m.temp);
         if (cfg.brightness > 50) {
             cfg.brightness = 40; // Hard clamp
             FastLED.setBrightness(cfg.brightness);
             _throttled = true;
         }
    } else if (_throttled && m.temp < 60.0) {
         // Recovery
         if (cfg.brightness < _originalBrightness) {
             cfg.brightness = _originalBrightness;
             FastLED.setBrightness(cfg.brightness);
             TIDE_LOGI("PerfManager: Temp recovered. Restoring Brightness.");
             _throttled = false;
         }
    }

    // RULE 2: WiFi Instability
    // If signal is weak, we don't want heavy CPU load processing complex animations
    // that might cause WiFi to drop.
    if (m.wifiRssi < -85 && m.wifiRssi > -127) {
        // Signal Weak
    }

    // RULE 3: FPS Drop / Lag
    if (m.fps < 15 && m.fps > 0) {
        // System struggling?
        // Could reduce animation complexity here if engine supported LOD
    }
}

bool PerformanceManager::isThrottled() {
    return _throttled;
}
`;

// --- NEW FLUID PHYSICS ENGINE (1D Solver) ---

export const generateFluidEngineH = () => `
#ifndef FLUID_ENGINE_H
#define FLUID_ENGINE_H

#include <Arduino.h>

struct FoamParticle {
    float pos; // 0..numLeds
    float vel;
    float life; // 0..1
};

class FluidEngine {
public:
    void begin(int numNodes, float tension, float damping, float spread);
    void update();
    void setTargetHeight(float percent); // The tide level pushes the fluid mass
    void disturb(int node, float amount);
    
    float getNodeHeight(int i);
    float getNodeVelocity(int i);
    
    // Particle System
    void spawnFoam(int node, float strength);
    int getFoamCount() { return _particleCount; }
    FoamParticle* getParticles() { return _particles; }
    
    void updateParams(float t, float d, float s) { _k = t; _d = d; _spread = s; }

private:
    int _numNodes;
    float* _nodes;
    float* _vels;
    float* _targetBase; // Target level for mass movement
    
    float _k; // Tension
    float _d; // Damping
    float _spread; 
    
    // Particles (Max 50 for ESP32)
    static const int MAX_PARTICLES = 50;
    FoamParticle _particles[MAX_PARTICLES];
    int _particleCount = 0;
};

#endif
`;

export const generateFluidEngineCpp = () => `
#include "FluidEngine.h"

void FluidEngine::begin(int numNodes, float tension, float damping, float spread) {
    _numNodes = numNodes;
    _k = tension;
    _d = damping;
    _spread = spread;
    
    if(_nodes) delete[] _nodes;
    if(_vels) delete[] _vels;
    if(_targetBase) delete[] _targetBase;
    
    _nodes = new float[_numNodes];
    _vels = new float[_numNodes];
    _targetBase = new float[_numNodes];
    
    for(int i=0; i<_numNodes; i++) {
        _nodes[i] = 0; _vels[i] = 0; _targetBase[i] = 0;
    }
    
    // Clear particles
    for(int i=0; i<MAX_PARTICLES; i++) _particles[i].life = 0;
}

void FluidEngine::setTargetHeight(float percent) {
    // Fill mechanics: The water rises to a target level
    // In a vertical strip, nodes below 'percent' try to be 1.0, above 0.0
    int targetNode = (_numNodes * percent);
    for(int i=0; i<_numNodes; i++) {
        if (i < targetNode) _targetBase[i] = 1.0f; 
        else _targetBase[i] = 0.0f;
    }
}

void FluidEngine::disturb(int node, float amount) {
    if (node >= 0 && node < _numNodes) {
        _vels[node] += amount;
    }
}

void FluidEngine::spawnFoam(int node, float strength) {
    // Find dead particle slot
    for(int i=0; i<MAX_PARTICLES; i++) {
        if (_particles[i].life <= 0) {
            _particles[i].pos = node;
            _particles[i].vel = (random(100) - 50) / 100.0f; // drift
            _particles[i].life = strength;
            if (_particleCount <= i) _particleCount = i + 1;
            return;
        }
    }
}

void FluidEngine::update() {
    // 1. Hooke's Law (Springs between nodes)
    
    for (int i = 0; i < _numNodes; i++) {
        // Standard Algorithm: Force from neighbors
        float left = (i > 0) ? _nodes[i-1] : _nodes[i];
        float right = (i < _numNodes-1) ? _nodes[i+1] : _nodes[i];
        
        // Acceleration = Force / Mass (Mass=1)
        // Force = k * displacement
        float force = _k * (left + right - 2 * _nodes[i]);
        
        _vels[i] += force;
        _vels[i] *= (1.0 - _d); // Damping
        _nodes[i] += _vels[i];
    }
    
    // 2. Spread / Smoothing Pass (Lateral Propagation)
    // Run two passes for stability as per design notes
    if (_spread > 0) {
        for(int pass=0; pass<2; pass++) {
            for (int i = 0; i < _numNodes; i++) {
                float left = (i > 0) ? _nodes[i-1] : _nodes[i];
                float right = (i < _numNodes-1) ? _nodes[i+1] : _nodes[i];
                // Smooth differences
                _nodes[i] += _spread * ( (left + right)/2.0 - _nodes[i] );
            }
        }
    }

    // 3. Particle Update
    for(int i=0; i<MAX_PARTICLES; i++) {
        if (_particles[i].life > 0) {
            _particles[i].pos += _particles[i].vel;
            _particles[i].life -= 0.02; // Fade out
            // Foam rides the wave
            int n = (int)_particles[i].pos;
            if (n >= 0 && n < _numNodes) {
                 // Push particle by wave velocity
                 _particles[i].pos += _vels[n] * 0.5;
            }
        }
    }
}

float FluidEngine::getNodeHeight(int i) {
    if (i < 0 || i >= _numNodes) return 0;
    return _nodes[i];
}

float FluidEngine::getNodeVelocity(int i) {
    if (i < 0 || i >= _numNodes) return 0;
    return _vels[i];
}
`;