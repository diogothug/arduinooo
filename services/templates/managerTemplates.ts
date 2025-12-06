
import { DataSourceConfig, FirmwareConfig } from '../../types';

export const generateWifiManagerH = () => `
#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H
#include <WiFi.h>
#include "time.h"

class WifiManager {
public:
    void connect();
};
#endif
`;

export const generateWifiManagerCpp = () => `
#include "WifiManager.h"
#include "config.h"

void WifiManager::connect() {
    WiFi.mode(WIFI_STA);
    WiFi.setHostname(DEVICE_NAME);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    Serial.print("Conectando ao WiFi");
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("");
        Serial.print("Conectado! IP: ");
        Serial.println(WiFi.localIP());
        
        configTime(-3 * 3600, 0, "pool.ntp.org", "time.nist.gov");
        Serial.print("Sincronizando relogio...");
        struct tm timeinfo;
        if(getLocalTime(&timeinfo)){
           Serial.println("OK");
        } else {
           Serial.println("Falha NTP");
        }
    } else {
        Serial.println("\\nFalha na conexao WiFi!");
    }
}
`;

export const generateLedManagerH = () => `
#ifndef LED_MANAGER_H
#define LED_MANAGER_H
#include <FastLED.h>
#include "config.h"

class LedManager {
public:
    void begin();
    void setPixel(int index, uint8_t r, uint8_t g, uint8_t b);
    void clear();
    void show();
    int getNumLeds() { return NUM_LEDS; }

private:
    CRGB leds[NUM_LEDS];
};
#endif
`;

export const generateLedManagerCpp = () => `
#include "LedManager.h"

void LedManager::begin() {
    FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS).setCorrection(TypicalLEDStrip);
    FastLED.setBrightness(LED_BRIGHTNESS);
    clear();
    show();
}

void LedManager::setPixel(int index, uint8_t r, uint8_t g, uint8_t b) {
    if (index >= 0 && index < NUM_LEDS) {
        leds[index] = CRGB(r, g, b);
    }
}

void LedManager::clear() {
    fill_solid(leds, NUM_LEDS, CRGB::Black);
}

void LedManager::show() {
    FastLED.show();
}
`;

export const generateSerialManagerH = () => `
#ifndef SERIAL_MANAGER_H
#define SERIAL_MANAGER_H
#include "MareEngine.h"

class WeatherManager; // Forward declaration

class SerialManager {
public:
    SerialManager(MareEngine* engine);
    void handle();
    void setWeatherManager(WeatherManager* wm) { _weather = wm; }
private:
    MareEngine* _engine;
    WeatherManager* _weather = nullptr;
    String _inputBuffer;
    void processCommand(String json);
};
#endif
`;

export const generateSerialManagerCpp = () => `
#include "SerialManager.h"
#include "WeatherManager.h"
#include <ArduinoJson.h>

SerialManager::SerialManager(MareEngine* engine) : _engine(engine) {}

void SerialManager::handle() {
    while (Serial.available()) {
        char c = (char)Serial.read();
        if (c == '\\n') {
            processCommand(_inputBuffer);
            _inputBuffer = "";
        } else {
            _inputBuffer += c;
        }
    }
}

void SerialManager::processCommand(String json) {
    DynamicJsonDocument doc(8192);
    DeserializationError error = deserializeJson(doc, json);

    if (error) {
        Serial.println("Erro: JSON Invalido");
        return;
    }
    
    // Update Harbor ID if provided
    if (doc.containsKey("harborId") && _weather != nullptr) {
        int pid = doc["harborId"];
        _weather->setHarborId(pid);
        Serial.print("Port Updated: "); Serial.println(pid);
    }

    std::vector<TideKeyframe> newFrames;
    JsonArray frames;

    if (doc.is<JsonArray>()) {
        frames = doc.as<JsonArray>();
    } else if (doc.containsKey("frames")) {
        frames = doc["frames"].as<JsonArray>();
        if (doc.containsKey("cycleDuration")) {
             _engine->setCycleDuration(doc["cycleDuration"].as<float>());
        }
    }

    if (!frames.isNull()) {
        for (JsonObject k : frames) {
            float t = k["timeOffset"];
            uint8_t h = k["height"];
            String c = k["color"]; 
            uint8_t i = k["intensity"];
            String e = k["effect"];
            
            uint8_t effectType = 0;
            if(e == "WAVE") effectType = 1;
            else if(e == "PULSE") effectType = 2;
            else if(e == "GLOW") effectType = 3;

            uint32_t colorInt = strtoul(c.c_str() + 1, NULL, 16);
            
            newFrames.push_back({t, h, colorInt, i, effectType});
        }
        _engine->setKeyframes(newFrames);
    }
    Serial.println("OK: Config Atualizada");
}
`;

export const generateBleManagerH = () => `
#ifndef BLE_MANAGER_H
#define BLE_MANAGER_H

#include <NimBLEDevice.h>
#include "MareEngine.h"

class WeatherManager;

class BleManager {
public:
    BleManager(MareEngine* engine);
    void begin(String deviceName);
    void setWeatherManager(WeatherManager* wm) { _weather = wm; }
    WeatherManager* getWeatherManager() { return _weather; }
private:
    MareEngine* _engine;
    WeatherManager* _weather = nullptr;
};
#endif
`;

export const generateBleManagerCpp = () => `
#include "BleManager.h"
#include "config.h"
#include "WeatherManager.h"
#include <ArduinoJson.h>

class ConfigCallbacks: public NimBLECharacteristicCallbacks {
    BleManager* _manager;
public:
    ConfigCallbacks(BleManager* m) : _manager(m) {}
    
    void onWrite(NimBLECharacteristic* pCharacteristic) {
        std::string value = pCharacteristic->getValue();
        if (value.length() > 0) {
            String json = String(value.c_str());
            DynamicJsonDocument doc(8192);
            if (!deserializeJson(doc, json)) {
                 if (doc.containsKey("harborId")) {
                    WeatherManager* w = _manager->getWeatherManager();
                    if (w) w->setHarborId(doc["harborId"]);
                 }
                 // Frames logic omitted for brevity in this callback for now, usually handled same as Serial
            }
        }
    }
};

BleManager::BleManager(MareEngine* engine) : _engine(engine) {}

void BleManager::begin(String deviceName) {
    NimBLEDevice::init(deviceName.c_str());
    NimBLEServer *pServer = NimBLEDevice::createServer();
    NimBLEService *pService = pServer->createService(SERVICE_UUID);
    NimBLECharacteristic *pConfigChar = pService->createCharacteristic(
                                            CHARACTERISTIC_UUID,
                                            NIMBLE_PROPERTY::READ |
                                            NIMBLE_PROPERTY::WRITE
                                        );
    
    pConfigChar->setCallbacks(new ConfigCallbacks(this));
    pService->start();
    NimBLEAdvertising *pAdvertising = NimBLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->start();
}
`;

export const generateWeatherManagerH = () => `
#ifndef WEATHER_MANAGER_H
#define WEATHER_MANAGER_H

#include "config.h"
#include "MareEngine.h"

struct WeatherData {
    float temp;
    int humidity;
    float windSpeed;
    int windDir;
    bool valid;
};

class WeatherManager {
public:
    WeatherManager(MareEngine* engine);
    void update();
    WeatherData getData() { return _data; }
    void setHarborId(int id);
    int getHarborId();
private:
    MareEngine* _engine;
    WeatherData _data;
    unsigned long _lastUpdate;
    bool _firstRun;
    int _harborId;
    
    String urlEncode(String str);
    void fetchWeatherData();
    void fetchTabuaMareData();
};
#endif
`;

export const generateWeatherManagerCpp = (config: FirmwareConfig, dataSrc: DataSourceConfig) => {
    const baseUrl = dataSrc.tabuaMare.baseUrl || "https://tabuamare.devtu.qzz.io//api/v1";
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const latLng = `[${dataSrc.tabuaMare.lat},${dataSrc.tabuaMare.lng}]`;
    const uf = dataSrc.tabuaMare.uf.toLowerCase();
    
    // Default build-time harbor ID if available, else 0
    const buildTimeHarborId = dataSrc.tabuaMare.harborId || 0;

    return `
#include "WeatherManager.h"
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include "time.h"

#define TABUA_MARE_BASE "${cleanBaseUrl}"
#define TABUA_MARE_COORDS "${latLng}"
#define TABUA_MARE_STATE "${uf}"

WeatherManager::WeatherManager(MareEngine* engine) : _engine(engine) {
    _data = {0.0f, 0, 0.0f, 0, false};
    _lastUpdate = 0;
    _firstRun = true;
    
    // Load Port ID from NVS
    Preferences prefs;
    prefs.begin("tide", true); // Read-only
    _harborId = prefs.getInt("port", ${buildTimeHarborId});
    prefs.end();
    
    Serial.print("WeatherManager Init. Active Harbor ID: ");
    Serial.println(_harborId);
}

void WeatherManager::setHarborId(int id) {
    if (id != _harborId) {
        _harborId = id;
        Preferences prefs;
        prefs.begin("tide", false); // R/W
        prefs.putInt("port", id);
        prefs.end();
        Serial.print("Saved New Harbor ID to NVS: "); Serial.println(id);
        
        // Force update on next cycle
        _firstRun = true;
        update();
    }
}

int WeatherManager::getHarborId() {
    return _harborId;
}

String WeatherManager::urlEncode(String str) {
    String encodedString = "";
    char c;
    char code0;
    char code1;
    for (int i = 0; i < str.length(); i++) {
        c = str.charAt(i);
        if (c == ' ') {
            encodedString += '+';
        } else if (isalnum(c) || c == '-' || c == '.') {
            encodedString += c;
        } else {
            code1 = (c & 0xf) + '0';
            if ((c & 0xf) > 9) code1 = (c & 0xf) - 10 + 'A';
            c = (c >> 4) & 0xf;
            code0 = c + '0';
            if (c > 9) code0 = c - 10 + 'A';
            encodedString += '%';
            encodedString += code0;
            encodedString += code1;
        }
    }
    return encodedString;
}

void WeatherManager::update() {
    unsigned long currentMillis = millis();
    unsigned long intervalMs = WEATHER_INTERVAL * 60 * 1000;
    
    if (_firstRun || (currentMillis - _lastUpdate > intervalMs)) {
        if (WiFi.status() == WL_CONNECTED) {
            fetchWeatherData();
            fetchTabuaMareData();
            _lastUpdate = currentMillis;
            _firstRun = false;
        }
    }
}

void WeatherManager::fetchWeatherData() {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    
    String encodedLoc = urlEncode(WEATHER_LOCATION);
    String url = "https://api.weatherapi.com/v1/current.json?key=" + String(WEATHER_API_KEY) + "&q=" + encodedLoc + "&lang=pt";
    
    Serial.print("GET Weather: "); Serial.println(url);

    if (http.begin(client, url)) {
        int httpCode = http.GET();
        if (httpCode == HTTP_CODE_OK) {
             DynamicJsonDocument doc(2048);
             DeserializationError error = deserializeJson(doc, http.getStream());
             if (!error) {
                 _data.temp = doc["current"]["temp_c"] | 25.0;
                 _data.humidity = doc["current"]["humidity"] | 60;
                 _data.windSpeed = doc["current"]["wind_kph"] | 0;
                 _data.windDir = doc["current"]["wind_degree"] | 0;
                 _data.valid = true;
                 Serial.println("Weather Updated.");
             }
        }
        http.end();
    }
}

void WeatherManager::fetchTabuaMareData() {
    struct tm timeinfo;
    if(!getLocalTime(&timeinfo)){
        Serial.println("Time not set, skipping Tabua Mare");
        return;
    }
    
    int month = timeinfo.tm_mon + 1;
    int day = timeinfo.tm_mday;
    
    String url;
    
    // Dynamic Port Logic
    if (_harborId > 0) {
        url = String(TABUA_MARE_BASE) + "/tabua-mare/" + String(_harborId) + "/" + String(month) + "/[" + String(day) + "]";
    } else {
        // Fallback to build-time Geo if no port set
        url = String(TABUA_MARE_BASE) + "/geo-tabua-mare/" + TABUA_MARE_COORDS + "/" + TABUA_MARE_STATE + "/" + String(month) + "/[" + String(day) + "]";
    }

    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    
    Serial.print("GET Tides: "); Serial.println(url);
    
    if (http.begin(client, url)) {
        int httpCode = http.GET();
        if (httpCode == HTTP_CODE_OK) {
            DynamicJsonDocument doc(4096);
            DeserializationError error = deserializeJson(doc, http.getStream());
            
            if (!error && doc.containsKey("data")) {
                JsonArray dataList = doc["data"];
                if (dataList.size() > 0) {
                     JsonObject dayData = dataList[0];
                     JsonArray tides = dayData["tides"];
                     
                     if (tides.size() > 0) {
                        std::vector<TideKeyframe> newFrames;
                        
                        float maxH = -100.0f;
                        float minH = 100.0f;
                        for (JsonObject t : tides) {
                            float h = t["height"];
                            if (h > maxH) maxH = h;
                            if (h < minH) minH = h;
                        }
                        
                        float range = maxH - minH;
                        if (range < 0.1) range = 1.0;
                        float absMin = minH - (range * 0.1);
                        float absMax = maxH + (range * 0.1);

                        for (JsonObject t : tides) {
                            String timeStr = t["time"].as<String>();
                            int colon = timeStr.indexOf(':');
                            int h = timeStr.substring(0, colon).toInt();
                            int m = timeStr.substring(colon+1).toInt();
                            float offset = h + (m/60.0f);
                            
                            float val = t["height"];
                            float pct = ((val - absMin) / (absMax - absMin)) * 100.0f;
                            if (pct < 0) pct = 0; if (pct > 100) pct = 100;
                            
                            String type = t["type"];
                            bool isHigh = (type.indexOf("HIGH") >= 0 || type.indexOf("alta") >= 0);
                            
                            uint32_t color = isHigh ? 0x00eebb : 0x004488;
                            uint8_t effect = isHigh ? 1 : 0;

                            newFrames.push_back({offset, (uint8_t)pct, color, 255, effect});
                        }
                        
                        std::sort(newFrames.begin(), newFrames.end(), [](const TideKeyframe& a, const TideKeyframe& b) {
                            return a.timeOffset < b.timeOffset;
                        });

                        _engine->setKeyframes(newFrames);
                        Serial.println("Tides Updated via TabuaMare.");
                     }
                }
            }
        }
        http.end();
    }
}
`;
};

export const generateRestServerH = () => `
#ifndef REST_SERVER_H
#define REST_SERVER_H

#include <WebServer.h>
#include <ArduinoJson.h>
#include "MareEngine.h"

class WeatherManager;

class RestServer {
public:
    RestServer(MareEngine* engine);
    void begin();
    void handle();
    void setWeatherManager(WeatherManager* wm) { _weather = wm; }
private:
    MareEngine* _engine;
    WeatherManager* _weather = nullptr;
    WebServer _server;
    void handleConfig();
    void handleStatus();
    void handleOptions();
};
#endif
`;

export const generateRestServerCpp = () => `
#include "RestServer.h"
#include "config.h"
#include "WeatherManager.h"

RestServer::RestServer(MareEngine* engine) : _engine(engine), _server(API_PORT) {}

void RestServer::begin() {
    _server.on("/api/config", HTTP_POST, [this](){ handleConfig(); });
    _server.on("/api/config", HTTP_OPTIONS, [this](){ handleOptions(); });
    _server.on("/api/status", HTTP_GET, [this](){ handleStatus(); });
    _server.onNotFound([this](){ _server.send(404, "text/plain", "Not Found"); });
    _server.begin();
    Serial.println("REST Server Started");
}

void RestServer::handle() {
    _server.handleClient();
}

void RestServer::handleOptions() {
    _server.sendHeader("Access-Control-Allow-Origin", "*");
    _server.sendHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    _server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    _server.send(204);
}

void RestServer::handleConfig() {
    _server.sendHeader("Access-Control-Allow-Origin", "*");
    
    if (!_server.hasArg("plain")) {
        _server.send(400, "application/json", "{\\"error\\":\\"No body\\"}");
        return;
    }
    
    String body = _server.arg("plain");
    DynamicJsonDocument doc(8192);
    DeserializationError error = deserializeJson(doc, body);
    
    if (error) {
        _server.send(400, "application/json", "{\\"error\\":\\"Invalid JSON\\"}");
        return;
    }
    
    if (doc.containsKey("harborId") && _weather != nullptr) {
        _weather->setHarborId(doc["harborId"]);
    }
    
    std::vector<TideKeyframe> newFrames;
    JsonArray frames;

    if (doc.is<JsonArray>()) {
        frames = doc.as<JsonArray>();
    } else if (doc.containsKey("frames")) {
        frames = doc["frames"].as<JsonArray>();
        if (doc.containsKey("cycleDuration")) {
             _engine->setCycleDuration(doc["cycleDuration"].as<float>());
        }
    }

    if (!frames.isNull()) {
         for (JsonObject k : frames) {
            float t = k["timeOffset"];
            uint8_t h = k["height"];
            String c = k["color"]; 
            uint8_t i = k["intensity"];
            String e = k["effect"];
            
            uint8_t effectType = 0;
            if(e == "WAVE") effectType = 1;
            else if(e == "PULSE") effectType = 2;
            else if(e == "GLOW") effectType = 3;

            uint32_t colorInt = strtoul(c.c_str() + 1, NULL, 16);
            newFrames.push_back({t, h, colorInt, i, effectType});
         }
         _engine->setKeyframes(newFrames);
         _server.send(200, "application/json", "{\\"status\\":\\"ok\\"}");
    } else {
         // It might be just a config update (port) without frames
         if (doc.containsKey("harborId")) {
             _server.send(200, "application/json", "{\\"status\\":\\"ok\\"}");
         } else {
             _server.send(400, "application/json", "{\\"error\\":\\"Invalid format\\"}");
         }
    }
}

void RestServer::handleStatus() {
    _server.sendHeader("Access-Control-Allow-Origin", "*");
    float currentTide = _engine->getCurrentHeightPercent();
    String json = "{\\"tide\\":" + String(currentTide) + "}";
    _server.send(200, "application/json", json);
}
`;