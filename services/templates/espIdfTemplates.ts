
import { FirmwareConfig, DataSourceConfig, Keyframe } from '../../types';

export const generateIdfCMakeListsProject = () => `
cmake_minimum_required(VERSION 3.5)
include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(TideFlux)
`;

export const generateIdfCMakeListsMain = () => `
idf_component_register(
    SRCS "main.cpp" 
         "WifiManager.cpp" 
         "LedController.cpp"
         "MareEngine.cpp"
         "WeatherManager.cpp"
    INCLUDE_DIRS "."
    REQUIRES nvs_flash esp_wifi esp_event driver log freertos esp_http_client esp_timer json cjson
)
`;

export const generateIdfComponentYml = () => `
dependencies:
  espressif/led_strip: "^2.5.0"
  idf:
    version: ">=5.0"
`;

export const generateIdfMainCpp = (config: FirmwareConfig) => `
#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_event.h"
#include "WifiManager.h"
#include "LedController.h"
#include "MareEngine.h"
#include "WeatherManager.h"

static const char *TAG = "MAIN";

// --- GLOBAL OBJECTS ---
WifiManager wifiManager;
LedController ledController;
MareEngine mareEngine;
WeatherManager weatherManager;

// --- SHARED DATA ---
// Protected by mutex if needed, but for simple read/write of floats on 32-bit arch it's mostly atomic enough for visual apps
volatile float g_tideLevel = 0.5f; 
volatile int g_tideTrend = 0;

// --- TASKS ---

void task_network(void *pvParameters) {
    ESP_LOGI(TAG, "Network Task Started on Core %d", xPortGetCoreID());
    
    // Connect to WiFi
    wifiManager.connect();
    
    // Initial Fetch
    if (wifiManager.isConnected()) {
        weatherManager.update(&mareEngine);
    }
    
    TickType_t xLastWakeTime = xTaskGetTickCount();
    const TickType_t xFrequency = pdMS_TO_TICKS(15 * 60 * 1000); // 15 mins

    while(1) {
        // Periodic Weather Update
        if (wifiManager.isConnected()) {
            weatherManager.update(&mareEngine);
        }
        
        vTaskDelayUntil(&xLastWakeTime, xFrequency);
    }
}

void task_animation(void *pvParameters) {
    ESP_LOGI(TAG, "Animation Task Started on Core %d", xPortGetCoreID());
    
    ledController.begin();
    
    while(1) {
        // 1. Update Engine Physics/Math
        mareEngine.update();
        
        // 2. Extract Data
        float currentTide = mareEngine.getNormalizedTide();
        int trend = mareEngine.getTideTrend();
        
        // 3. Update LEDs
        ledController.update(currentTide, trend);
        
        // Approx 30 FPS
        vTaskDelay(pdMS_TO_TICKS(33)); 
    }
}

// --- APP MAIN (Entry Point) ---

extern "C" void app_main(void) {
    ESP_LOGI(TAG, "--------------------------------");
    ESP_LOGI(TAG, "   TideFlux ESP-IDF Native v2   ");
    ESP_LOGI(TAG, "--------------------------------");
    
    // 1. Initialize NVS
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
      ESP_ERROR_CHECK(nvs_flash_erase());
      ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);
    
    // 2. Initialize Event Loop
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    // 3. Create Tasks
    // ESP-IDF handles core affinity automatically unless xTaskCreatePinnedToCore is used.
    // Core 0: Network/Radio
    xTaskCreatePinnedToCore(task_network, "network", 4096, NULL, 5, NULL, 0);
    
    // Core 1: Logic/Animation
    xTaskCreatePinnedToCore(task_animation, "anim", 4096, NULL, 10, NULL, 1);
    
    ESP_LOGI(TAG, "System Initialization Complete. Tasks running.");
}
`;

export const generateIdfWifiManagerH = () => `
#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H
#include "esp_wifi.h"
#include "esp_event.h"

class WifiManager {
public:
    void connect();
    bool isConnected();
private:
    static void event_handler(void* arg, esp_event_base_t event_base, int32_t event_id, void* event_data);
    static bool _connected;
};
#endif
`;

export const generateIdfWifiManagerCpp = (config: FirmwareConfig) => `
#include "WifiManager.h"
#include "esp_log.h"
#include <string.h>

static const char *TAG = "WIFI";
static int s_retry_num = 0;
bool WifiManager::_connected = false;

void WifiManager::event_handler(void* arg, esp_event_base_t event_base, int32_t event_id, void* event_data) {
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        _connected = false;
        if (s_retry_num < 20) {
            esp_wifi_connect();
            s_retry_num++;
            ESP_LOGW(TAG, "WiFi Disconnected. Retrying... (%d)", s_retry_num);
        } else {
            ESP_LOGE(TAG, "Failed to connect to AP.");
        }
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) event_data;
        ESP_LOGI(TAG, "Got IP Address: " IPSTR, IP2STR(&event->ip_info.ip));
        s_retry_num = 0;
        _connected = true;
    }
}

void WifiManager::connect() {
    ESP_LOGI(TAG, "Initializing WiFi Station Mode...");

    esp_netif_init();
    esp_netif_create_default_wifi_sta();
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    esp_event_handler_instance_t instance_any_id;
    esp_event_handler_instance_t instance_got_ip;
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT,
                                                        ESP_EVENT_ANY_ID,
                                                        &WifiManager::event_handler,
                                                        NULL,
                                                        &instance_any_id));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT,
                                                        IP_EVENT_STA_GOT_IP,
                                                        &WifiManager::event_handler,
                                                        NULL,
                                                        &instance_got_ip));

    wifi_config_t wifi_config = {
        .sta = {
            .threshold = { .authmode = WIFI_AUTH_WPA2_PSK },
        },
    };
    
    strncpy((char*)wifi_config.sta.ssid, "${config.ssid}", 32);
    strncpy((char*)wifi_config.sta.password, "${config.password}", 64);

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "WiFi Init finished. Connecting to %s...", wifi_config.sta.ssid);
}

bool WifiManager::isConnected() {
    return _connected;
}
`;

export const generateIdfLedControllerH = () => `
#ifndef LED_CONTROLLER_H
#define LED_CONTROLLER_H
#include "driver/rmt.h"
#include "led_strip.h"

class LedController {
public:
    void begin();
    void update(float tideLevel, int trend);
    void setPixel(int i, uint8_t r, uint8_t g, uint8_t b);
    void refresh();
private:
    led_strip_handle_t strip;
    int tick = 0;
    
    // Helpers
    void animateWave(float tideLevel, int trend);
};
#endif
`;

export const generateIdfLedControllerCpp = (config: FirmwareConfig) => `
#include "LedController.h"
#include "esp_log.h"
#include <math.h>

static const char *TAG = "LEDS";

#define LED_STRIP_GPIO_PIN ${config.ledPin}
#define LED_STRIP_LED_NUM  ${config.ledCount}

void LedController::begin() {
    ESP_LOGI(TAG, "Initializing LED Strip (RMT) on Pin %d", LED_STRIP_GPIO_PIN);

    led_strip_config_t strip_config = {
        .strip_gpio_num = LED_STRIP_GPIO_PIN,
        .max_leds = LED_STRIP_LED_NUM,
        .led_pixel_format = LED_PIXEL_FORMAT_GRB,
        .led_model = LED_MODEL_WS2812,
        .flags = { .invert_out = false },
    };
    
    led_strip_rmt_config_t rmt_config = {
        .clk_src = RMT_CLK_SRC_DEFAULT,
        .resolution_hz = 10 * 1000 * 1000, // 10MHz
        .flags = { .with_dma = false },
    };

    ESP_ERROR_CHECK(led_strip_new_rmt_device(&strip_config, &rmt_config, &strip));
    
    led_strip_clear(strip);
}

void LedController::setPixel(int i, uint8_t r, uint8_t g, uint8_t b) {
    led_strip_set_pixel(strip, i, r, g, b);
}

void LedController::refresh() {
    led_strip_refresh(strip);
}

void LedController::update(float tideLevel, int trend) {
    tick++;
    animateWave(tideLevel, trend);
    refresh();
}

void LedController::animateWave(float tideLevel, int trend) {
    // 1. Calculate Active LED count
    int waterLevel = (int)(tideLevel * LED_STRIP_LED_NUM);
    
    // 2. Wave parameters
    float timeSec = tick * 0.05f; 
    float direction = (trend >= 0) ? 1.0f : -1.0f;
    
    for (int i = 0; i < LED_STRIP_LED_NUM; i++) {
        if (i < waterLevel) {
            // Ripple Effect
            float wave = sinf((i * 0.3f) + (timeSec * direction));
            uint8_t brightness = 100 + (uint8_t)(wave * 50.0f); 
            
            // Teal/Blue Gradient
            uint8_t r = 0;
            uint8_t g = brightness / 2;
            uint8_t b = brightness;
            
            setPixel(i, r, g, b);
        } else {
            setPixel(i, 0, 0, 0);
        }
    }
    
    // Surface Tension Line
    if (waterLevel > 0 && waterLevel < LED_STRIP_LED_NUM) {
        setPixel(waterLevel - 1, 50, 200, 200); // Bright Cyan
    }
}
`;

export const generateIdfMareEngineH = () => `
#ifndef MARE_ENGINE_H
#define MARE_ENGINE_H

#include <math.h>
#include <vector>

// Native C++ Struct for IDF
struct Keyframe {
    float timeOffset;
    float height;
};

class MareEngine {
public:
    MareEngine();
    void update();
    void setCycleDuration(float hours);
    float getNormalizedTide();
    int getTideTrend();
    
    void addKeyframe(float time, float height);
    void clearKeyframes();

private:
    std::vector<Keyframe> _keyframes;
    float _simulatedHours;
    float _cycleDuration;
    int64_t _lastTimeMicros;
    
    float _currentHeight;
    float _prevHeight;
    int _trend;
    
    float calculateSynthetic(float t);
};

#endif
`;

export const generateIdfMareEngineCpp = (keyframes: Keyframe[]) => {
    // Inject default keyframes into the C++ constructor for standalone operation
    const initCode = keyframes.map(k => `    addKeyframe(${k.timeOffset.toFixed(2)}f, ${k.height.toFixed(1)}f);`).join('\n');

    return `
#include "MareEngine.h"
#include "esp_timer.h"
#include "esp_log.h"
#include <algorithm>

static const char *TAG = "ENGINE";

MareEngine::MareEngine() 
    : _simulatedHours(0.0f), 
      _cycleDuration(24.0f),
      _lastTimeMicros(0),
      _currentHeight(50.0f),
      _trend(0)
{
${initCode}
}

void MareEngine::update() {
    int64_t now = esp_timer_get_time(); // Microseconds
    if (_lastTimeMicros == 0) _lastTimeMicros = now;
    
    float dt = (now - _lastTimeMicros) / 1000000.0f; // Seconds
    _lastTimeMicros = now;
    
    // 1 Real Second = 1 Simulated Hour (Speedup for demo)
    // Or 1 Real Hour = 1 Real Hour (Normal)
    // For visual effect, let's use 1s = 10 mins approx? 
    // Let's stick to real time approximation for production or slightly fast for demo.
    // 1 second real time adds X simulated hours.
    float speedFactor = 1.0f; 
    _simulatedHours += (dt / 3600.0f) * speedFactor; 
    
    if (_simulatedHours >= _cycleDuration) _simulatedHours = 0;
    
    _prevHeight = _currentHeight;
    
    if (_keyframes.size() < 2) {
        _currentHeight = calculateSynthetic(_simulatedHours);
    } else {
        // Interpolation
        Keyframe start = _keyframes.back();
        Keyframe end = _keyframes.front();
        
        for (size_t i = 0; i < _keyframes.size() - 1; i++) {
            if (_simulatedHours >= _keyframes[i].timeOffset && _simulatedHours <= _keyframes[i+1].timeOffset) {
                start = _keyframes[i];
                end = _keyframes[i+1];
                break;
            }
        }
        
        float dur = end.timeOffset - start.timeOffset;
        if (dur < 0) dur += _cycleDuration;
        
        float offset = _simulatedHours - start.timeOffset;
        if (offset < 0) offset += _cycleDuration;
        
        float p = (dur > 0.001f) ? (offset / dur) : 0.0f;
        if (p > 1.0f) p = 1.0f;
        
        _currentHeight = start.height + (end.height - start.height) * p;
    }
    
    // Trend Calculation
    if (_currentHeight > _prevHeight + 0.01f) _trend = 1;
    else if (_currentHeight < _prevHeight - 0.01f) _trend = -1;
}

float MareEngine::calculateSynthetic(float t) {
    return 50.0f + 45.0f * sinf(2.0f * M_PI * t / 12.42f);
}

float MareEngine::getNormalizedTide() {
    return _currentHeight / 100.0f;
}

int MareEngine::getTideTrend() {
    return _trend;
}

void MareEngine::addKeyframe(float time, float height) {
    _keyframes.push_back({time, height});
    // Keep sorted
    std::sort(_keyframes.begin(), _keyframes.end(), 
        [](const Keyframe &a, const Keyframe &b) { return a.timeOffset < b.timeOffset; });
}

void MareEngine::clearKeyframes() {
    _keyframes.clear();
}

void MareEngine::setCycleDuration(float hours) {
    _cycleDuration = hours;
}
`;
};

export const generateIdfWeatherManagerH = () => `
#ifndef WEATHER_MANAGER_H
#define WEATHER_MANAGER_H

#include "esp_http_client.h"
#include "MareEngine.h"

class WeatherManager {
public:
    void update(MareEngine* engine);
    
private:
    void fetchWeather();
    void fetchTide(MareEngine* engine);
    static esp_err_t _http_event_handler(esp_http_client_event_t *evt);
};

#endif
`;

export const generateIdfWeatherManagerCpp = (config: FirmwareConfig, dataSource: DataSourceConfig) => {
    // Determine which URL to use based on config
    const isWeatherApi = dataSource.activeSource === 'API';
    const apiUrl = isWeatherApi 
        ? `http://api.weatherapi.com/v1/marine.json?key=${config.weatherApi?.apiKey}&q=${config.weatherApi?.location}`
        : `${dataSource.tabuaMare.baseUrl}/tabua-mare/${dataSource.tabuaMare.harborId}/1`; // Simplified for template

    return `
#include "WeatherManager.h"
#include "esp_log.h"
#include "cJSON.h"

static const char *TAG = "WEATHER";
static char *response_buffer = NULL;
static int response_len = 0;

esp_err_t WeatherManager::_http_event_handler(esp_http_client_event_t *evt) {
    switch(evt->event_id) {
        case HTTP_EVENT_ON_DATA:
            if (!esp_http_client_is_chunked_response(evt->client)) {
                // Append data to buffer (simplistic)
                // In production, use ringbuffer or process stream
                // Here we skip complex buffer realloc for template brevity
                ESP_LOGI(TAG, "HTTP Data received len=%d", evt->data_len);
            }
            break;
        default:
            break;
    }
    return ESP_OK;
}

void WeatherManager::update(MareEngine* engine) {
    ESP_LOGI(TAG, "Updating Weather Data...");
    fetchTide(engine);
}

void WeatherManager::fetchTide(MareEngine* engine) {
    esp_http_client_config_t config = {
        .url = "${apiUrl}",
        .event_handler = _http_event_handler,
        .timeout_ms = 5000,
    };
    
    esp_http_client_handle_t client = esp_http_client_init(&config);
    esp_err_t err = esp_http_client_perform(client);

    if (err == ESP_OK) {
        ESP_LOGI(TAG, "HTTP Status = %d, content_length = %lld",
                esp_http_client_get_status_code(client),
                esp_http_client_get_content_length(client));
        
        // --- PARSING MOCK LOGIC ---
        // Since we didn't fully implement buffer collection in the event handler above 
        // (requires malloc management), we assume successful fetch triggers logic update here.
        // In a real device, you'd parse 'response_buffer' with cJSON_Parse.
        
        /*
        cJSON *root = cJSON_Parse(response_buffer);
        if (root) {
             // Parse logic matching Arduino version...
             cJSON_Delete(root);
        }
        */
        
    } else {
        ESP_LOGE(TAG, "HTTP GET request failed: %s", esp_err_to_name(err));
    }
    esp_http_client_cleanup(client);
}
`;
};
