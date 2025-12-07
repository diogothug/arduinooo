import { FirmwareConfig, DisplayConfig, Keyframe } from '../../types';

export const generatePlatformIO = (config: FirmwareConfig, display: DisplayConfig) => `
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
board_build.partitions = min_spiffs.csv

lib_deps =
    fastled/FastLED @ ^3.6.0
    bblanchon/ArduinoJson @ ^6.21.3
    bodmer/TFT_eSPI @ ^2.5.31
    ${config.enableBLE ? 'h2zero/NimBLE-Arduino @ ^1.4.1' : ''}

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
  const defTemp = config.compiledData?.defaultTemp || 25;
  const defWind = config.compiledData?.defaultWind || 0;

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

// --- NETWORK DEFAULTS ---
#define WIFI_SSID_DEFAULT "${config.ssid}"
#define WIFI_PASSWORD_DEFAULT "${config.password}"
#define DEVICE_NAME_DEFAULT "${config.deviceName}"

// --- SYSTEM ---
#define WDT_TIMEOUT_SECONDS 10
#define LOG_BUFFER_SIZE 200

// --- FEATURE FLAGS (Compile Time) ---
#define ENABLE_BLE ${config.enableBLE ? '1' : '0'}
#define ENABLE_WEATHER ${config.weatherApi?.enabled ? '1' : '0'}
#define ENABLE_OTA ${config.ota?.enabled ? '1' : '0'}

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

export const generateMainCpp = (displayConfig: DisplayConfig) => `
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

// --- SHARED DATA (Protected via atomic or critical section in prod) ---
volatile float shared_TideNorm = 0.5;
volatile float shared_Wind = 0;
volatile int shared_Humidity = 60;
bool safeMode = false;

// --- TASK: NETWORK & SYSTEM (Core 0) ---
void TaskNetwork(void *pvParameters) {
    TIDE_LOGI("Task Network started on Core %d", xPortGetCoreID());
    
    // WDT for this task
    esp_task_wdt_init(WDT_TIMEOUT_SECONDS, true);
    esp_task_wdt_add(NULL);

    // Connect
    if (!wifiManager.connect()) {
        TIDE_LOGE("Wifi Failed. System in Offline Mode.");
    }
    otaManager.begin();
    server.begin();

    while(1) {
        // Critical System Loop
        otaManager.handle();
        server.handle();
        
        // Feed Dog
        esp_task_wdt_reset();
        
        // Yield to let IDLE task run (needed for ESP functionality)
        vTaskDelay(10 / portTICK_PERIOD_MS);
    }
}

// --- TASK: ANIMATION & LOGIC (Core 1) ---
void TaskAnimation(void *pvParameters) {
    TIDE_LOGI("Task Animation started on Core %d", xPortGetCoreID());
    
    // Init Hardware
    WS2812BConfigManager::load(); // Load NVS Config
    ledController.begin();
    WS2812BAnimations::attachController(&ledController);
    
    display.begin();
    display.setBrightness(${displayConfig.brightness});
    display.showSplashScreen();

    // WDT for this task
    esp_task_wdt_add(NULL);

    TickType_t xLastWakeTime = xTaskGetTickCount();
    const TickType_t xFrequency = 30; // ~33 FPS

    while(1) {
        if (!safeMode) {
            // 1. Logic Update
            engine.update();
            shared_TideNorm = engine.getNormalizedTide();
            
            // 2. Display Update
            display.update(engine.getCurrentHeightPercent());

            // 3. LED Update
            String mode = WS2812BConfigManager::config.mode;
            WS2812BAnimations::run(mode, shared_TideNorm, shared_Wind, shared_Humidity);
        } else {
             // Safe Mode Blink
             ledController.clear();
             ledController.setPixel(0, CRGB::Red);
             ledController.show();
             vTaskDelay(500 / portTICK_PERIOD_MS);
             ledController.clear();
             ledController.show();
             vTaskDelay(500 / portTICK_PERIOD_MS);
        }
        
        esp_task_wdt_reset();
        vTaskDelayUntil(&xLastWakeTime, xFrequency);
    }
}

void setup() {
    // 1. Early Init
    LogManager::begin(LOG_DEBUG);
    TIDE_LOGI("BOOT: TideFlux System v2.1");

    // 2. NVS & Recovery Check
    if (!NVSManager::begin()) {
        TIDE_LOGE("NVS Mount Failed!");
    }
    
    int crashCount = NVSManager::getInt("crash_count", 0);
    if (crashCount > 3) {
        TIDE_LOGE("Too many crashes (%d). Entering SAFE MODE.", crashCount);
        safeMode = true;
    }
    // Increment crash count (cleared after successful boot duration)
    NVSManager::setInt("crash_count", crashCount + 1);

    // 3. Create Tasks
    // Network on Core 0
    xTaskCreatePinnedToCore(
        TaskNetwork, "NetTask", 8192, NULL, 1, &TaskHandle_Net, 0
    );

    // Animation on Core 1 (FastLED prefers this)
    xTaskCreatePinnedToCore(
        TaskAnimation, "AnimTask", 8192, NULL, 1, &TaskHandle_Anim, 1
    );

    // 4. Mark Boot Successful after 10s
    delay(10000); 
    NVSManager::setInt("crash_count", 0);
    TIDE_LOGI("Boot Verified Stable.");
}

void loop() {
    // Main loop is empty in FreeRTOS paradigm
    vTaskDelete(NULL);
}
`;