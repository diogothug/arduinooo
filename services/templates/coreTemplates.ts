



import { FirmwareConfig, DisplayConfig, Keyframe, TouchAction } from '../../types';

export const generatePlatformIO = (config: FirmwareConfig, display: DisplayConfig) => `
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
board_build.partitions = min_spiffs.csv

lib_deps =
    fastled/FastLED
    bblanchon/ArduinoJson @ ^6.21.3
    bodmer/TFT_eSPI
    ${config.enableBLE ? 'h2zero/NimBLE-Arduino' : ''}

build_flags = 
    -D USER_SETUP_LOADED=1
    -D GC9A01_DRIVER=1
    -D TFT_WIDTH=240
    -D TFT_HEIGHT=240
    -D TFT_MISO=-1
    -D TFT_MOSI=${display.pinMOSI}
    -D TFT_SCLK=${display.pinSCK}
    -D TFT_CS=${display.pinCS}
    -D TFT_DC=${display.pinDC}
    -D TFT_RST=${display.pinRST}
    -D LOAD_GLCD=1
    -D LOAD_FONT2=1
    -D LOAD_FONT4=1
    -D SPI_FREQUENCY=${display.spi.frequency}
    -D CORE_DEBUG_LEVEL=0 ; Disable system debug to use our LogManager
`;

export const generateConfigH = (config: FirmwareConfig, keyframes: Keyframe[] = []) => {
  const sourceFrames = config.compiledData?.frames || keyframes;
  const useFixedWeather = config.compiledData?.useFixedWeather || false;

  const fallbackData = sourceFrames.map(k => 
      `    {${k.timeOffset.toFixed(2)}f, ${k.height}, 0x${k.color.replace('#', '')}, ${k.intensity}, ${(k.effect === 'STATIC' ? 0 : k.effect === 'WAVE' ? 1 : k.effect === 'PULSE' ? 2 : 3)}}`
  ).join(',\n');

  return `
#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// --- HARDWARE PIN DEFAULTS ---
#define LED_PIN ${config.ledPin}
#define NUM_LEDS_DEFAULT ${config.ledCount}

// --- NETWORK CONFIG ---
#define WIFI_SSID_DEFAULT "${config.ssid}"
#define WIFI_PASSWORD_DEFAULT "${config.password}"
#define DEVICE_NAME_DEFAULT "${config.deviceName}"
#define WIFI_MODE "${config.wifiMode}" 
#define WIFI_MIN_RSSI ${config.minRssi}
#define WIFI_WATCHDOG_ENABLED ${config.wifiWatchdog ? '1' : '0'}

// --- MESH NETWORK CONFIG ---
#define MESH_ENABLED ${config.mesh?.enabled ? '1' : '0'}
#define MESH_ID "${config.mesh?.meshId || 'TideMesh'}"
#define MESH_PASSWORD "${config.mesh?.password || 'mesh_pass'}"
#define MESH_CHANNEL ${config.mesh?.channel || 6}
#define MESH_MAX_LAYERS ${config.mesh?.maxLayers || 6}

// --- POWER CONFIG ---
#define SLEEP_MODE "${config.sleepMode}"
#define WAKEUP_INTERVAL_SEC ${config.wakeupInterval}
#define LOW_POWER_FPS ${config.lowPowerMode.idleFps}
#define BATTERY_THRESH ${config.lowPowerMode.batteryThreshold}

// --- LOGGING CONFIG ---
#define LOG_LEVEL_DEFAULT "${config.logLevel}"
#define REMOTE_LOG_ENABLED ${config.remoteLog ? '1' : '0'}
#define CIRCULAR_BUFFER_ENABLED ${config.logCircularBuffer ? '1' : '0'}

// --- SYSTEM ---
#define WDT_TIMEOUT_SECONDS 10
#define LOG_BUFFER_SIZE 200

// --- FEATURE FLAGS (Compile Time) ---
#define ENABLE_BLE ${config.enableBLE ? '1' : '0'}
#define ENABLE_WEATHER ${config.weatherApi?.enabled ? '1' : '0'}
#define ENABLE_OTA ${config.ota?.enabled ? '1' : '0'}
#define ENABLE_SHADER ${config.shader?.enabled ? '1' : '0'}
#define ENABLE_TOUCH ${config.touch?.enabled ? '1' : '0'}

// --- FALLBACK DATA ---
struct TideKeyframeConfig {
    float timeOffset;
    uint8_t height;
    uint32_t color;
    uint8_t intensity;
    uint8_t effect;
};

const int FALLBACK_FRAME_COUNT = ${sourceFrames.length};
const TideKeyframeConfig FALLBACK_FRAMES[] = {
${fallbackData}
};

#endif
`;
};

export const generateLogManagerH = () => `
#ifndef LOG_MANAGER_H
#define LOG_MANAGER_H

#include <Arduino.h>
#include <vector>

enum LogLevel {
    LOG_ERROR = 0,
    LOG_WARN  = 1,
    LOG_INFO  = 2,
    LOG_DEBUG = 3,
    LOG_TRACE = 4
};

struct LogEntry {
    uint32_t timestamp;
    LogLevel level;
    String message;
};

class LogManager {
public:
    static void begin(LogLevel level = LOG_INFO);
    static void log(LogLevel level, const char* format, ...);
    static void setLevel(LogLevel level);
    static String getBufferJson();
    static void clear();

private:
    static LogLevel _currentLevel;
    static std::vector<LogEntry> _buffer;
    static const size_t _maxBufferSize = 200;
};

// Macros for cleaner code
#define TIDE_LOGE(fmt, ...) LogManager::log(LOG_ERROR, fmt, ##__VA_ARGS__)
#define TIDE_LOGW(fmt, ...) LogManager::log(LOG_WARN, fmt, ##__VA_ARGS__)
#define TIDE_LOGI(fmt, ...) LogManager::log(LOG_INFO, fmt, ##__VA_ARGS__)
#define TIDE_LOGD(fmt, ...) LogManager::log(LOG_DEBUG, fmt, ##__VA_ARGS__)

#endif
`;

export const generateLogManagerCpp = () => `
#include "LogManager.h"

LogLevel LogManager::_currentLevel = LOG_INFO;
std::vector<LogEntry> LogManager::_buffer;

void LogManager::begin(LogLevel level) {
    _currentLevel = level;
    Serial.begin(115200);
    _buffer.reserve(_maxBufferSize);
    TIDE_LOGI("Log System Initialized");
}

void LogManager::setLevel(LogLevel level) {
    _currentLevel = level;
    TIDE_LOGI("Log Level changed to %d", level);
}

void LogManager::log(LogLevel level, const char* format, ...) {
    if (level > _currentLevel) return;

    char loc_buf[64];
    char * temp = loc_buf;
    va_list arg;
    va_list copy;
    va_start(arg, format);
    va_copy(copy, arg);
    int len = vsnprintf(temp, sizeof(loc_buf), format, copy);
    va_end(copy);
    if(len < 0) {
        va_end(arg);
        return;
    };
    if(len >= sizeof(loc_buf)){
        temp = (char*) malloc(len+1);
        if(temp == NULL) {
            va_end(arg);
            return;
        }
        vsnprintf(temp, len+1, format, arg);
    }
    va_end(arg);

    // 1. Print to Serial
    const char* tag = "[UNK]";
    if (level == LOG_ERROR) tag = "[ERR]";
    else if (level == LOG_WARN) tag = "[WRN]";
    else if (level == LOG_INFO) tag = "[INF]";
    else if (level == LOG_DEBUG) tag = "[DBG]";

    Serial.printf("%s (%lu) %s\\n", tag, millis(), temp);

    // 2. Buffer Logic (Circular)
    if (_buffer.size() >= _maxBufferSize) {
        _buffer.erase(_buffer.begin());
    }
    _buffer.push_back({millis(), level, String(temp)});

    if(temp != loc_buf){
        free(temp);
    }
}

String LogManager::getBufferJson() {
    String json = "[";
    for(size_t i=0; i<_buffer.size(); i++) {
        json += "{\\"t\\":";
        json += _buffer[i].timestamp;
        json += ",\\"l\\":";
        json += _buffer[i].level;
        json += ",\\"m\\":\\"";
        json += _buffer[i].message;
        json += "\\"}";
        if (i < _buffer.size() - 1) json += ",";
    }
    json += "]";
    return json;
}

void LogManager::clear() {
    _buffer.clear();
}
`;

export const generateMainCpp = (displayConfig: DisplayConfig, firmwareConfig: FirmwareConfig) => {
    
    // Construct Touch Logic
    const touchInitLogic = firmwareConfig.touch?.enabled ? `
    TouchManager::begin();
    TouchManager::setGlobalThreshold(40);
    
    ${firmwareConfig.touch.pins.map(p => `
    TouchManager::registerButton(${p.gpio}, ${p.threshold}, [](TouchEvent e) {
        if (e == TOUCH_TAP) {
            TIDE_LOGI("Action: ${p.action}");
            // Action Dispatcher
            ${p.action === TouchAction.NEXT_MODE ? 'WS2812BConfigManager::nextMode();' : ''}
            ${p.action === TouchAction.TOGGLE_POWER ? 'display.toggle();' : ''}
            ${p.action === TouchAction.BRIGHTNESS_UP ? 'display.incBrightness();' : ''}
        }
    });
    `).join('')}
    ` : '';

    return `
#include <Arduino.h>
#include <esp_task_wdt.h>
#include "config.h"
#include "LogManager.h"
#include "NVSManager.h"
#include "WifiManager.h"
#include "OTAManager.h"
#include "MareEngine.h"
#include "RestServer.h"
#include "DisplayManager.h"
#include "SystemHealth.h"
#include "TelemetryManager.h"
#include "PerformanceManager.h"
#include "ShaderEngine.h"
#include "MeshManager.h" 
#include "TouchManager.h"
#include "modules/led_ws2812b/ws2812b_controller.h"
#include "modules/led_ws2812b/ws2812b_animations.h"
#include "modules/led_ws2812b/ws2812b_config.h"

// --- GLOBAL OBJECTS ---
WS2812BController ledController;
WifiManager wifiManager;
OTAManager otaManager;
MareEngine engine;
RestServer server(&engine);
DisplayManager display;

// --- TASK HANDLES ---
TaskHandle_t TaskHandle_Net;
TaskHandle_t TaskHandle_Anim;
TaskHandle_t TaskHandle_Telemetry;

// --- SHARED DATA & MUTEX ---
portMUX_TYPE sharedMux = portMUX_INITIALIZER_UNLOCKED;
volatile float shared_TideNorm = 0.5;
volatile int shared_Trend = 0;
volatile float shared_Wind = 0;
volatile int shared_Humidity = 60;
bool safeMode = false;

// --- TASK: TELEMETRY (Core 0, Priority 1) ---
// Collects stats every 2s
void TaskTelemetry(void *pvParameters) {
    TIDE_LOGI("Task Telemetry started on Core %d", xPortGetCoreID());
    TelemetryManager::begin();
    PerformanceManager::begin();
    
    // WDT Add only (Init done in setup)
    esp_task_wdt_add(NULL);
    
    while(1) {
        TelemetryManager::collect();
        PerformanceManager::evaluate();
        
        esp_task_wdt_reset();
        vTaskDelay(pdMS_TO_TICKS(2000));
    }
}

// --- TASK: NETWORK & SYSTEM (Core 0, Priority 2) ---
void TaskNetwork(void *pvParameters) {
    TIDE_LOGI("Task Network started on Core %d", xPortGetCoreID());
    
    // WDT Add only
    esp_task_wdt_add(NULL);

    #if MESH_ENABLED
    MeshManager::begin();
    #else
    if (!wifiManager.connect()) {
        TIDE_LOGE("Wifi Failed. System in Offline Mode.");
        TelemetryManager::addCriticalEvent("WIFI_FAIL");
    }
    
    otaManager.begin();
    otaManager.verify();
    server.begin();
    #endif

    while(1) {
        #if !MESH_ENABLED
        otaManager.handle();
        server.handle();
        #else
        MeshManager::update();
        #endif
        
        esp_task_wdt_reset();
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

// --- TASK: ANIMATION & LOGIC (Core 1, Priority 3) ---
void TaskAnimation(void *pvParameters) {
    TIDE_LOGI("Task Animation started on Core %d", xPortGetCoreID());
    
    WS2812BConfigManager::load();
    ledController.begin();
    WS2812BAnimations::attachController(&ledController);
    
    display.begin();
    display.setBrightness(${displayConfig.brightness});
    display.showSplashScreen();
    
    // Setup Touch
    #if ENABLE_TOUCH
    ${touchInitLogic}
    #endif

    esp_task_wdt_add(NULL);

    TickType_t xLastWakeTime = xTaskGetTickCount();
    const TickType_t xFrequency = pdMS_TO_TICKS(33); // Target ~30 FPS
    
    int frameCounter = 0;
    unsigned long lastFpsTime = millis();

    while(1) {
        if (!safeMode) {
            engine.update();
            if(engine.isFallbackMode()) TelemetryManager::registerFallback();

            // Native Touch Polling (Very fast)
            #if ENABLE_TOUCH
            TouchManager::update();
            #endif

            // Critical Section Update
            portENTER_CRITICAL(&sharedMux);
            shared_TideNorm = engine.getNormalizedTide();
            shared_Trend = engine.getTideTrend();
            portEXIT_CRITICAL(&sharedMux);
            
            display.update(engine.getCurrentHeightPercent());

            // Avoid allocation in loop
            const char* mode = WS2812BConfigManager::config.mode.c_str();
            
            #if ENABLE_SHADER
            if (WS2812BConfigManager::config.paletteId == 99) {
                 ShaderEngine::run("sin(time+i*0.1)*255", &ledController, millis()/1000.0, shared_TideNorm);
            } else {
                 WS2812BAnimations::run(mode, shared_TideNorm, shared_Trend, shared_Wind, shared_Humidity);
            }
            #else
            WS2812BAnimations::run(mode, shared_TideNorm, shared_Trend, shared_Wind, shared_Humidity);
            #endif
            
            // FPS Reporting
            frameCounter++;
            if (millis() - lastFpsTime >= 1000) {
                TelemetryManager::updateFPS(frameCounter);
                frameCounter = 0;
                lastFpsTime = millis();
            }

        } else {
             // Safe Mode Blink Pattern (Yielding)
             ledController.fill(CRGB::Red);
             ledController.show();
             vTaskDelay(pdMS_TO_TICKS(250));
             ledController.clear();
             ledController.show();
             vTaskDelay(pdMS_TO_TICKS(250));
             taskYIELD();
        }
        
        esp_task_wdt_reset();
        vTaskDelayUntil(&xLastWakeTime, xFrequency);
    }
}

void setup() {
    LogManager::begin(LOG_DEBUG);
    TIDE_LOGI("BOOT: TideFlux System v2.1");

    // Initialize WDT Globally here
    esp_task_wdt_init(WDT_TIMEOUT_SECONDS, true);
    esp_task_wdt_add(NULL); // For setup/loop task

    if (!NVSManager::begin()) {
        TIDE_LOGE("NVS Mount Failed!");
    }
    
    int crashCount = NVSManager::getInt("crash_count", 0);
    // CRASH LOOP PROTECTION
    if (crashCount > 5) {
        TIDE_LOGE("CRITICAL: Crash Loop (%d). Rolling back firmware...", crashCount);
        // Attempt rollback to previous partition
        otaManager.rollback();
        // If rollback fails or returns, we enter safe mode
        safeMode = true;
    }
    
    if (crashCount > 3 && !safeMode) {
        TIDE_LOGW("Warning: System unstable (%d crashes).", crashCount);
    }
    NVSManager::setInt("crash_count", crashCount + 1);

    // Launch Tasks with Adjusted Priorities
    // Animation (Prio 3) > Network (Prio 2) > Telemetry (Prio 1)
    xTaskCreatePinnedToCore(TaskNetwork, "NetTask", 6144, NULL, 2, &TaskHandle_Net, 0);
    xTaskCreatePinnedToCore(TaskTelemetry, "TelemTask", 4096, NULL, 1, &TaskHandle_Telemetry, 0);
    xTaskCreatePinnedToCore(TaskAnimation, "AnimTask", 8192, NULL, 3, &TaskHandle_Anim, 1); 

    // Stabilization Delay
    vTaskDelay(pdMS_TO_TICKS(10000));
    NVSManager::setInt("crash_count", 0);
    TIDE_LOGI("Boot Verified Stable.");
}

void loop() {
    // Loop task is handled by WDT in setup(), but we just kill it to save memory/cycles
    // or keep it alive feeding wdt. Deleting it is cleaner if setup is done.
    // However, we added it to WDT in setup. We should remove it or keep feeding.
    // Simple approach: delete task.
    esp_task_wdt_delete(NULL); 
    vTaskDelete(NULL);
}
`;
};

export const generateRestServerCpp = () => `
#include "RestServer.h"
#include "config.h"
#include "LogManager.h"
#include "SystemHealth.h"
#include "TelemetryManager.h"
#include "WebDashboard.h"
#include "OTAManager.h"

// Reference global
extern OTAManager otaManager;

RestServer::RestServer(MareEngine* engine) : _server(80), _engine(engine) {}

void RestServer::begin() {
    _server.on("/", HTTP_GET, std::bind(&RestServer::handleRoot, this));
    _server.on("/api/config", HTTP_POST, std::bind(&RestServer::handleConfig, this));
    _server.on("/api/logs", HTTP_GET, std::bind(&RestServer::handleLogs, this));
    _server.on("/api/health", HTTP_GET, std::bind(&RestServer::handleHealth, this));
    _server.on("/api/telemetry", HTTP_GET, std::bind(&RestServer::handleTelemetry, this));
    _server.on("/api/reboot", HTTP_POST, std::bind(&RestServer::handleReboot, this));
    _server.on("/api/ota", HTTP_POST, std::bind(&RestServer::handleOTA, this));
    
    _server.enableCORS(true);
    _server.begin();
    TIDE_LOGI("REST Server started on port 80");
}

void RestServer::handle() {
    _server.handleClient();
}

void RestServer::handleRoot() {
    _server.send(200, "text/html", INDEX_HTML_GZ);
}

void RestServer::handleHealth() {
    String json = SystemHealth::getReportJson();
    _server.send(200, "application/json", json);
}

void RestServer::handleTelemetry() {
    String json = TelemetryManager::getJson();
    _server.send(200, "application/json", json);
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

void RestServer::handleOTA() {
    if (!_server.hasArg("url")) {
        _server.send(400, "application/json", "{\"error\":\"Missing 'url' parameter\"}");
        return;
    }
    String url = _server.arg("url");
    _server.send(200, "application/json", "{\"status\":\"updating\", \"target\":\"" + url + "\"}");
    
    delay(500); 
    otaManager.updateFromUrl(url);
}

void RestServer::handleConfig() {
    if (!_server.hasArg("plain")) {
        _server.send(400, "text/plain", "Body missing");
        return;
    }
    _server.send(200, "application/json", "{\\"status\\":\\"ok\\"}");
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
    void handleHealth();
    void handleTelemetry();
    void handleReboot();
    void handleOTA();
};
#endif
`;