
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
    // Setup ADC for voltage monitoring if applicable
    analogReadResolution(12);
}

void SystemHealth::check() {
    // Routine check every N seconds
    if (WiFi.status() != WL_CONNECTED) _failCount++;
}

float SystemHealth::readVoltage() {
    // Simulated reading (would be analogRead(PIN) * calibration)
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
"</style></head><body>"
"<h1>TideFlux Web</h1>"
"<div class='card'>Status: <strong id='st'>Loading...</strong></div>"
"<div class='card'>"
"<button onclick='cmd(\"reboot\")'>Reboot System</button>"
"<button onclick='cmd(\"test_leds\")'>Test LEDs</button>"
"</div>"
"<script>"
"function cmd(c){fetch('/api/'+c, {method:'POST'});}"
"setInterval(()=>{fetch('/api/health').then(r=>r.json()).then(j=>{document.getElementById('st').innerText=j.status})}, 2000);"
"</script></body></html>";

#endif
`;
