


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
#include <HTTPUpdate.h>

class OTAManager {
public:
    void begin();
    void handle();
    void updateFromUrl(String url);
    void verify();
    void rollback();
};
#endif
`;

export const generateOTAManagerCpp = () => `
#include "OTAManager.h"
#include "config.h"
#include "LogManager.h"
#include <esp_ota_ops.h>
#include <esp_partition.h>

void OTAManager::begin() {
    #if ENABLE_OTA
    // 1. Setup ArduinoOTA (Push)
    ArduinoOTA.setHostname(DEVICE_NAME_DEFAULT);
    ArduinoOTA.onStart([]() { 
        TIDE_LOGW("OTA: Start Push Update"); 
    });
    ArduinoOTA.onEnd([]() { 
        TIDE_LOGI("OTA: End"); 
    });
    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
        if (progress % 20 == 0) TIDE_LOGI("OTA: %u%%", (progress / (total / 100)));
    });
    ArduinoOTA.onError([](ota_error_t error) { 
        TIDE_LOGE("OTA Error[%u]", error); 
    });
    ArduinoOTA.begin();

    // 2. Check Native Partition State (ESP-IDF)
    const esp_partition_t *running = esp_ota_get_running_partition();
    esp_ota_img_states_t ota_state;
    if (esp_ota_get_state_partition(running, &ota_state) == ESP_OK) {
        if (ota_state == ESP_OTA_IMG_PENDING_VERIFY) {
            TIDE_LOGW("OTA: New image pending verification...");
        } else {
            TIDE_LOGI("OTA: Running partition state: %d", ota_state);
        }
    }
    #endif
}

void OTAManager::handle() {
    #if ENABLE_OTA
    ArduinoOTA.handle();
    #endif
}

void OTAManager::updateFromUrl(String url) {
    #if ENABLE_OTA
    TIDE_LOGW("OTA: Starting HTTP Pull from %s", url.c_str());
    
    WiFiClient client;
    
    t_httpUpdate_return ret = httpUpdate.update(client, url);

    switch (ret) {
      case HTTP_UPDATE_FAILED:
        TIDE_LOGE("OTA: Update Failed. Error (%d): %s", httpUpdate.getLastError(), httpUpdate.getLastErrorString().c_str());
        break;
      case HTTP_UPDATE_NO_UPDATES:
        TIDE_LOGI("OTA: No Updates");
        break;
      case HTTP_UPDATE_OK:
        TIDE_LOGI("OTA: Update OK. Rebooting...");
        break;
    }
    #endif
}

void OTAManager::verify() {
    #if ENABLE_OTA
    // Mark current app as valid to prevent rollback on next boot
    if (esp_ota_mark_app_valid_cancel_rollback() == ESP_OK) {
        TIDE_LOGI("OTA: Boot verified. App marked valid.");
    } else {
        TIDE_LOGW("OTA: Failed to mark app valid (or not pending).");
    }
    #endif
}

void OTAManager::rollback() {
    #if ENABLE_OTA
    TIDE_LOGE("OTA: Rolling back to previous firmware due to instability...");
    esp_ota_mark_app_invalid_rollback_and_reboot();
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

// --- NEW TOUCH MANAGER FOR NATIVE ESP32 CAPACITIVE SENSORS ---

export const generateTouchManagerH = () => `
#ifndef TOUCH_MANAGER_H
#define TOUCH_MANAGER_H

#include <Arduino.h>
#include <vector>
#include <functional>

enum TouchEvent {
    TOUCH_TAP,
    TOUCH_LONG_PRESS
};

typedef std::function<void(TouchEvent)> TouchCallback;

struct TouchButton {
    int pin;
    int threshold;
    unsigned long pressStartTime;
    bool isPressed;
    TouchCallback callback;
};

class TouchManager {
public:
    static void begin();
    static void update();
    static void registerButton(int pin, int threshold, TouchCallback cb);
    static void setGlobalThreshold(int threshold);

private:
    static std::vector<TouchButton> _buttons;
    static int _globalThreshold;
    static const int DEBOUNCE_MS = 50;
    static const int LONG_PRESS_MS = 800;
};

#endif
`;

export const generateTouchManagerCpp = () => `
#include "TouchManager.h"
#include "LogManager.h"

std::vector<TouchButton> TouchManager::_buttons;
int TouchManager::_globalThreshold = 40;

void TouchManager::begin() {
    TIDE_LOGI("TouchManager: Initializing Native Capacitive Sensors");
}

void TouchManager::setGlobalThreshold(int threshold) {
    _globalThreshold = threshold;
}

void TouchManager::registerButton(int pin, int threshold, TouchCallback cb) {
    TouchButton btn;
    btn.pin = pin;
    btn.threshold = threshold > 0 ? threshold : _globalThreshold;
    btn.isPressed = false;
    btn.pressStartTime = 0;
    btn.callback = cb;
    _buttons.push_back(btn);
    TIDE_LOGI("Touch: Registered Pin %d (Thresh: %d)", pin, btn.threshold);
}

void TouchManager::update() {
    for (auto &btn : _buttons) {
        // Native ESP32 Capacitive Read
        // Value decreases when touched. < Threshold = Pressed.
        int val = touchRead(btn.pin);
        
        // Simple smoothing/debouncing logic
        bool currentlyPressed = (val < btn.threshold);

        if (currentlyPressed && !btn.isPressed) {
            // Press Start
            btn.isPressed = true;
            btn.pressStartTime = millis();
        } 
        else if (!currentlyPressed && btn.isPressed) {
            // Release
            unsigned long duration = millis() - btn.pressStartTime;
            if (duration > DEBOUNCE_MS) {
                if (duration > LONG_PRESS_MS) {
                    TIDE_LOGD("Touch: Long Press Detected on %d", btn.pin);
                    if(btn.callback) btn.callback(TOUCH_LONG_PRESS);
                } else {
                    TIDE_LOGD("Touch: Tap Detected on %d", btn.pin);
                    if(btn.callback) btn.callback(TOUCH_TAP);
                }
            }
            btn.isPressed = false;
        }
    }
}
`;