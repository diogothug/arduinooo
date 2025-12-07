import { DataSourceConfig, FirmwareConfig } from '../../types';

export const generateWifiManagerH = () => `
#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H
#include <WiFi.h>
#include "time.h"

class WifiManager {
public:
    bool connect();
};
#endif
`;

export const generateWifiManagerCpp = () => `
#include "WifiManager.h"
#include "config.h"
#include "LogManager.h"
#include "NVSManager.h"

bool WifiManager::connect() {
    String ssid = NVSManager::getString("wifi_ssid", WIFI_SSID_DEFAULT);
    String pass = NVSManager::getString("wifi_pass", WIFI_PASSWORD_DEFAULT);
    String host = NVSManager::getString("hostname", DEVICE_NAME_DEFAULT);

    WiFi.mode(WIFI_STA);
    WiFi.setHostname(host.c_str());
    WiFi.begin(ssid.c_str(), pass.c_str());
    
    TIDE_LOGI("WiFi Connecting to %s...", ssid.c_str());
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 15) {
        delay(500);
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        TIDE_LOGI("WiFi Connected! IP: %s", WiFi.localIP().toString().c_str());
        
        configTime(-3 * 3600, 0, "pool.ntp.org", "time.nist.gov");
        return true;
    } else {
        TIDE_LOGE("WiFi Failed.");
        return false;
    }
}
`;

export const generateNVSManagerH = () => `
#ifndef NVS_MANAGER_H
#define NVS_MANAGER_H

#include <Preferences.h>

class NVSManager {
public:
    static bool begin();
    
    static void setInt(const char* key, int value);
    static int getInt(const char* key, int defaultVal);
    
    static void setString(const char* key, String value);
    static String getString(const char* key, String defaultVal);
    
    static void reset();

private:
    static Preferences prefs;
};
#endif
`;

export const generateNVSManagerCpp = () => `
#include "NVSManager.h"
#include "LogManager.h"

Preferences NVSManager::prefs;

bool NVSManager::begin() {
    return prefs.begin("tideflux", false);
}

void NVSManager::setInt(const char* key, int value) {
    prefs.putInt(key, value);
}

int NVSManager::getInt(const char* key, int defaultVal) {
    return prefs.getInt(key, defaultVal);
}

void NVSManager::setString(const char* key, String value) {
    prefs.putString(key, value);
}

String NVSManager::getString(const char* key, String defaultVal) {
    return prefs.getString(key, defaultVal);
}

void NVSManager::reset() {
    prefs.clear();
    TIDE_LOGW("NVS Factory Reset Performed");
}
`;

export const generateOTAManagerH = () => `
#ifndef OTA_MANAGER_H
#define OTA_MANAGER_H
#include <ArduinoOTA.h>

class OTAManager {
public:
    void begin();
    void handle();
};
#endif
`;

export const generateOTAManagerCpp = () => `
#include "OTAManager.h"
#include "config.h"
#include "LogManager.h"

void OTAManager::begin() {
    #if ENABLE_OTA
    ArduinoOTA.setHostname(DEVICE_NAME_DEFAULT);

    ArduinoOTA.onStart([]() {
        String type;
        if (ArduinoOTA.getCommand() == U_FLASH) type = "sketch";
        else type = "filesystem";
        TIDE_LOGW("OTA Start updating %s", type.c_str());
    });

    ArduinoOTA.onEnd([]() {
        TIDE_LOGI("OTA End");
    });

    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
        // Log sparingly to avoid flooding
        if (progress % 10 == 0) TIDE_LOGI("OTA Progress: %u%%", (progress / (total / 100)));
    });

    ArduinoOTA.onError([](ota_error_t error) {
        TIDE_LOGE("OTA Error[%u]", error);
    });

    ArduinoOTA.begin();
    TIDE_LOGI("OTA Service Ready");
    #endif
}

void OTAManager::handle() {
    #if ENABLE_OTA
    ArduinoOTA.handle();
    #endif
}
`;

export const generateSerialManagerH = () => `
#ifndef SERIAL_MANAGER_H
#define SERIAL_MANAGER_H
#include "MareEngine.h"

class WeatherManager; 

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
#include "LogManager.h"
#include <ArduinoJson.h>

SerialManager::SerialManager(MareEngine* engine) : _engine(engine) {}

void SerialManager::handle() {
    if (Serial.available()) {
        String line = Serial.readStringUntil('\\n');
        line.trim();
        if (line.length() > 0) processCommand(line);
    }
}

void SerialManager::processCommand(String cmd) {
    TIDE_LOGI("Serial CMD: %s", cmd.c_str());
    // ... command logic
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
    void handleLogs();
    void handleReboot();
};
#endif
`;

export const generateRestServerCpp = () => `
#include "RestServer.h"
#include "config.h"
#include "LogManager.h"

RestServer::RestServer(MareEngine* engine) : _server(80), _engine(engine) {}

void RestServer::begin() {
    _server.on("/", HTTP_GET, std::bind(&RestServer::handleRoot, this));
    _server.on("/api/config", HTTP_POST, std::bind(&RestServer::handleConfig, this));
    _server.on("/api/logs", HTTP_GET, std::bind(&RestServer::handleLogs, this));
    _server.on("/api/reboot", HTTP_POST, std::bind(&RestServer::handleReboot, this));
    
    _server.enableCORS(true);
    _server.begin();
    TIDE_LOGI("REST Server started on port 80");
}

void RestServer::handle() {
    _server.handleClient();
}

void RestServer::handleRoot() {
    _server.send(200, "text/plain", "TideFlux OS v2.1 - Active");
}

void RestServer::handleLogs() {
    String json = LogManager::getBufferJson();
    _server.send(200, "application/json", json);
}

void RestServer::handleReboot() {
    _server.send(200, "application/json", "{\\"status\\":\\"rebooting\\"}");
    delay(500);
    ESP.restart();
}

void RestServer::handleConfig() {
    if (!_server.hasArg("plain")) {
        _server.send(400, "text/plain", "Body missing");
        return;
    }
    // Implement config parsing to NVS
    _server.send(200, "application/json", "{\\"status\\":\\"ok\\"}");
}
`;

// BLE Manager remains mostly same but using LogManager
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
    
    void processJson(std::string jsonStr);
};
#endif
`;

export const generateBleManagerCpp = () => `
#include "BleManager.h"
#include <ArduinoJson.h>
#include "config.h"
#include "LogManager.h"

BleManager::BleManager(MareEngine* engine) : _engine(engine) {}

void BleManager::begin(std::string deviceName) {
    BLEDevice::init(deviceName);
    BLEServer* pServer = BLEDevice::createServer();
    BLEService* pService = pServer->createService("12345678-1234-1234-1234-1234567890ab");
    
    BLECharacteristic* pCharacteristic = pService->createCharacteristic(
                                            "87654321-4321-4321-4321-ba0987654321",
                                            NIMBLE_PROPERTY::READ |
                                            NIMBLE_PROPERTY::WRITE
                                        );
    pCharacteristic->setCallbacks(this);
    pService->start();
    
    BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID("12345678-1234-1234-1234-1234567890ab");
    pAdvertising->setScanResponse(true);
    pAdvertising->start();
    TIDE_LOGI("BLE Stack Started");
}

void BleManager::onWrite(BLECharacteristic* pCharacteristic) {
    std::string value = pCharacteristic->getValue();
    if (value.length() > 0) {
        processJson(value);
    }
}

void BleManager::processJson(std::string jsonStr) {
    // ...
    TIDE_LOGD("BLE Recv: %s", jsonStr.c_str());
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
#include "LogManager.h"

WeatherManager::WeatherManager(MareEngine* engine) : _engine(engine), _lastUpdate(0) {
    _data = {25.0, 60, 0.0, 0};
}

WeatherData WeatherManager::getData() {
    return _data;
}

void WeatherManager::update() {
    if (millis() - _lastUpdate > (15 * 60 * 1000UL) || _lastUpdate == 0) {
        forceUpdate();
    }
}

void WeatherManager::forceUpdate() {
    if (WiFi.status() != WL_CONNECTED) return;
    TIDE_LOGI("Updating Weather...");
    // Logic fetch...
    _lastUpdate = millis();
}

void WeatherManager::fetchFromApi() {
    // ...
}

void WeatherManager::fetchFromTabuaMare() {
    // ...
}
`;