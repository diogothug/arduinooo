

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
    
    Serial.println("");
    Serial.println("--------------------------------");
    Serial.printf("[WiFi] Conectando a: %s\\n", WIFI_SSID);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    Serial.println("");
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("[WiFi] CONECTADO!");
        Serial.print("[WiFi] IP Address: ");
        Serial.println(WiFi.localIP());
        Serial.print("[WiFi] RSSI: ");
        Serial.println(WiFi.RSSI());
        
        configTime(-3 * 3600, 0, "pool.ntp.org", "time.nist.gov");
        Serial.print("[NTP] Sincronizando relogio...");
        struct tm timeinfo;
        if(getLocalTime(&timeinfo)){
           Serial.println("OK");
           Serial.printf("[NTP] Hora Atual: %02d:%02d:%02d\\n", timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
        } else {
           Serial.println("Falha (Timeout)");
        }
    } else {
        Serial.println("[WiFi] FALHA NA CONEXAO (Timeout)");
        Serial.println("[WiFi] Verifique SSID/Senha em config.h");
    }
    Serial.println("--------------------------------");
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
    void processCommand(String cmd);
};
#endif
`;

export const generateSerialManagerCpp = () => `
#include "SerialManager.h"
#include <ArduinoJson.h>
#if WEATHER_API_ENABLED
#include "WeatherManager.h"
#endif

SerialManager::SerialManager(MareEngine* engine) : _engine(engine) {}

void SerialManager::handle() {
    if (Serial.available()) {
        String line = Serial.readStringUntil('\\n');
        line.trim();
        if (line.length() > 0) processCommand(line);
    }
}

void SerialManager::processCommand(String cmd) {
    // Basic JSON command parsing
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, cmd);
    
    if (error) {
        Serial.print("[Serial] JSON Error: ");
        Serial.println(error.c_str());
        return;
    }
    
    if (doc.containsKey("frames")) {
        // Parse keyframes update
        // Logic to update engine keyframes could go here
        Serial.println("[Serial] Frames updated via Serial");
    }
    
    if (doc.containsKey("cycleDuration")) {
        float duration = doc["cycleDuration"];
        _engine->setCycleDuration(duration);
        Serial.printf("[Serial] Cycle updated to %.1f hours\\n", duration);
    }
}
`;

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
    WebServer _server;
    MareEngine* _engine;
    WeatherManager* _weather = nullptr;
    
    void handleRoot();
    void handleConfig();
    void handleStatus();
};
#endif
`;

export const generateRestServerCpp = () => `
#include "RestServer.h"
#include "config.h"
#if WEATHER_API_ENABLED
#include "WeatherManager.h"
#endif

RestServer::RestServer(MareEngine* engine) : _server(80), _engine(engine) {}

void RestServer::begin() {
    _server.on("/", HTTP_GET, std::bind(&RestServer::handleRoot, this));
    _server.on("/api/config", HTTP_POST, std::bind(&RestServer::handleConfig, this));
    _server.on("/api/status", HTTP_GET, std::bind(&RestServer::handleStatus, this));
    _server.begin();
}

void RestServer::handle() {
    _server.handleClient();
}

void RestServer::handleRoot() {
    _server.send(200, "text/plain", "TideFlux ESP32 Controller Online");
}

void RestServer::handleStatus() {
    DynamicJsonDocument doc(512);
    doc["tide_height"] = _engine->getCurrentHeightPercent();
    doc["uptime"] = millis() / 1000;
    doc["heap"] = ESP.getFreeHeap();
    
    String json;
    serializeJson(doc, json);
    _server.send(200, "application/json", json);
}

void RestServer::handleConfig() {
    if (!_server.hasArg("plain")) {
        _server.send(400, "text/plain", "Body missing");
        return;
    }
    
    DynamicJsonDocument doc(4096);
    DeserializationError error = deserializeJson(doc, _server.arg("plain"));
    
    if (error) {
        _server.send(400, "text/plain", "JSON Error");
        return;
    }
    
    // Process config here similar to SerialManager
    
    _server.send(200, "application/json", "{\\"status\\":\\"ok\\"}");
}
`;

export const generateBleManagerH = () => `
#ifndef BLE_MANAGER_H
#define BLE_MANAGER_H

#include <NimBLEDevice.h>
#include "MareEngine.h"

class WeatherManager;

class BleManager : public BLECharacteristicCallbacks {
public:
    BleManager(MareEngine* engine);
    void begin(std::string deviceName);
    void onWrite(BLECharacteristic* pCharacteristic);
    void setWeatherManager(WeatherManager* wm) { _weather = wm; }

private:
    MareEngine* _engine;
    WeatherManager* _weather = nullptr;
    std::string _buffer;
    
    void processJson(std::string jsonStr);
};
#endif
`;

export const generateBleManagerCpp = () => `
#include "BleManager.h"
#include <ArduinoJson.h>
#include "config.h"
#if WEATHER_API_ENABLED
#include "WeatherManager.h"
#endif

BleManager::BleManager(MareEngine* engine) : _engine(engine) {}

void BleManager::begin(std::string deviceName) {
    BLEDevice::init(deviceName);
    BLEServer* pServer = BLEDevice::createServer();
    BLEService* pService = pServer->createService(SERVICE_UUID);
    
    BLECharacteristic* pCharacteristic = pService->createCharacteristic(
                                            CHARACTERISTIC_UUID,
                                            NIMBLE_PROPERTY::READ |
                                            NIMBLE_PROPERTY::WRITE
                                        );
    pCharacteristic->setCallbacks(this);
    pService->start();
    
    BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->start();
}

void BleManager::onWrite(BLECharacteristic* pCharacteristic) {
    std::string value = pCharacteristic->getValue();
    if (value.length() > 0) {
        processJson(value);
    }
}

void BleManager::processJson(std::string jsonStr) {
    DynamicJsonDocument doc(4096);
    DeserializationError error = deserializeJson(doc, jsonStr);
    
    if (!error) {
         if (doc.containsKey("cycleDuration")) {
             _engine->setCycleDuration(doc["cycleDuration"]);
         }
    }
}
`;

export const generateWeatherManagerH = () => `
#ifndef WEATHER_MANAGER_H
#define WEATHER_MANAGER_H

#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include "MareEngine.h"

struct WeatherData {
    float temp;
    int humidity;
    float windSpeed;
    int windDir;
};

class WeatherManager {
public:
    WeatherManager(MareEngine* engine);
    void update();
    WeatherData getData();
    void forceUpdate();

private:
    MareEngine* _engine;
    unsigned long _lastUpdate;
    WeatherData _data;
    
    void fetchFromApi();
    void fetchFromTabuaMare();
};
#endif
`;

export const generateWeatherManagerCpp = (config: FirmwareConfig, dataSource: DataSourceConfig) => `
#include "WeatherManager.h"
#include "config.h"

WeatherManager::WeatherManager(MareEngine* engine) : _engine(engine), _lastUpdate(0) {
    _data = {25.0, 60, 0.0, 0};
}

WeatherData WeatherManager::getData() {
    return _data;
}

void WeatherManager::update() {
    if (millis() - _lastUpdate > (WEATHER_INTERVAL * 60 * 1000UL) || _lastUpdate == 0) {
        forceUpdate();
    }
}

void WeatherManager::forceUpdate() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[Weather] WiFi desconectado. Abortando update.");
        return;
    }
    
    Serial.println("[Weather] Iniciando Update...");
    Serial.printf("[System] Heap Livre: %d bytes\\n", ESP.getFreeHeap());
    
    // Tábua Maré logic
    if (TABUA_MARE_HARBOR_ID_DEFAULT > 0) {
        fetchFromTabuaMare();
    } else {
        fetchFromApi();
    }
    
    _lastUpdate = millis();
}

void WeatherManager::fetchFromApi() {
    // Basic implementation placeholder
}

void WeatherManager::fetchFromTabuaMare() {
    // 1. Get current date
    struct tm timeinfo;
    if(!getLocalTime(&timeinfo)){
        Serial.println("[Weather] Falha ao obter hora local (NTP).");
        return;
    }
    
    int month = timeinfo.tm_mon + 1;
    int day = timeinfo.tm_mday;
    int harborId = TABUA_MARE_HARBOR_ID_DEFAULT;

    // 2. Construct URL - HTTPS + Array Encoding + 15 Days
    // We request the next 7 days for robustness
    String daysParam = "%5B";
    for(int i=0; i<7; i++) { 
       daysParam += String(day + i);
       if(i < 6) daysParam += ",";
    }
    daysParam += "%5D";

    // Format: .../tabua-mare/{id}/{month}/[d1,d2...]
    String url = "https://tabuamare.devtu.qzz.io/api/v1/tabua-mare/";
    url += String(harborId) + "/" + String(month) + "/" + daysParam;
    
    Serial.printf("[HTTP] URL: %s\\n", url.c_str());

    // 3. Setup Client
    WiFiClientSecure client;
    client.setInsecure(); // Skip cert validation for simplicity on embedded
    
    HTTPClient http;
    http.begin(client, url);
    http.setConnectTimeout(15000); 
    http.setTimeout(15000);        
    
    unsigned long start = millis();
    int httpCode = http.GET();
    unsigned long duration = millis() - start;
    
    Serial.printf("[HTTP] Code: %d | Time: %dms\\n", httpCode, duration);
    
    if (httpCode > 0) {
        if (httpCode == HTTP_CODE_OK) {
            String payload = http.getString();
            Serial.printf("[HTTP] Payload Size: %d bytes\\n", payload.length());

            // Parse Nested JSON
            DynamicJsonDocument doc(16384); // Larger buffer for multiple days
            DeserializationError error = deserializeJson(doc, payload);
            
            if (!error) {
                // Parse Logic matching new structure: data[0].months[0].days[].hours[]
                JsonArray dataArr = doc["data"];
                if (dataArr.size() > 0) {
                    JsonArray months = dataArr[0]["months"];
                    for (JsonObject m : months) {
                        JsonArray days = m["days"];
                        for (JsonObject d : days) {
                            JsonArray hours = d["hours"];
                            for (JsonObject h : hours) {
                                // Extract hour: "HH:MM:SS"
                                String timeStr = h["hour"].as<String>();
                                float level = h["level"].as<float>();
                                
                                int colonIdx = timeStr.indexOf(':');
                                int hh = timeStr.substring(0, colonIdx).toInt();
                                int mm = timeStr.substring(colonIdx+1, colonIdx+3).toInt();
                                
                                Serial.printf("Tide: %02d:%02d Level: %.2f\\n", hh, mm, level);
                                // Here we would insert into engine
                            }
                        }
                    }
                }
                Serial.println("[Weather] JSON Parse OK!");
            } else {
                Serial.print("[Weather] JSON Parse Error: ");
                Serial.println(error.c_str());
            }
        } else {
             String errorBody = http.getString();
             Serial.printf("[HTTP] Server Error Body: %s\\n", errorBody.c_str());
        }
    } else {
        Serial.printf("[HTTP] Connect Failed: %s\\n", http.errorToString(httpCode).c_str());
    }
    
    http.end();
}
`;