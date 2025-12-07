

import { FirmwareConfig, DisplayConfig, Keyframe } from '../../types';

export const generatePlatformIO = (config: FirmwareConfig, display: DisplayConfig) => `
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200

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
    -D SPI_READ_FREQUENCY=20000000
    -D SPI_TOUCH_FREQUENCY=2500000
`;

export const generateConfigH = (config: FirmwareConfig, keyframes: Keyframe[] = []) => {
  // Logic: If user compiled custom data, use that. Otherwise use the passed keyframes (usually current chart).
  const sourceFrames = config.compiledData?.frames || keyframes;
  const useFixedWeather = config.compiledData?.useFixedWeather || false;
  const defTemp = config.compiledData?.defaultTemp || 25;
  const defWind = config.compiledData?.defaultWind || 0;

  // Serialize keyframes for fallback C++ array
  const fallbackData = sourceFrames.map(k => 
      `    {${k.timeOffset.toFixed(2)}f, ${k.height}, 0x${k.color.replace('#', '')}, ${k.intensity}, ${(k.effect === 'STATIC' ? 0 : k.effect === 'WAVE' ? 1 : k.effect === 'PULSE' ? 2 : 3)}}`
  ).join(',\n');

  return `
#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

#define WIFI_SSID "${config.ssid}"
#define WIFI_PASSWORD "${config.password}"
#define DEVICE_NAME "${config.deviceName}"

#define LED_PIN ${config.ledPin}
#define NUM_LEDS ${config.ledCount}
#define LED_BRIGHTNESS 200

// Autonomous Logic Configuration (Logic on Chip)
#define AUTO_LOGIC_ENABLED ${config.autonomous.enabled ? 'true' : 'false'}
#define AUTO_LINK_SPEED_TIDE ${config.autonomous.linkSpeedToTide ? 'true' : 'false'}
#define AUTO_LINK_BRIGHT_TIDE ${config.autonomous.linkBrightnessToTide ? 'true' : 'false'}
#define AUTO_LINK_PALETTE_TIME ${config.autonomous.linkPaletteToTime ? 'true' : 'false'}
#define AUTO_LINK_WEATHER ${config.autonomous.linkWeatherToLeds ? 'true' : 'false'}

// Night Mode
#define NIGHT_MODE_ENABLED ${config.nightMode.enabled ? 'true' : 'false'}
#define NIGHT_START_HOUR ${config.nightMode.startHour}
#define NIGHT_END_HOUR ${config.nightMode.endHour}
#define NIGHT_BRIGHTNESS_FACTOR ${config.nightMode.brightnessFactor}

// Low Power Island Mode
#define LP_MODE_ENABLED ${config.lowPowerMode.enabled ? 'true' : 'false'}
#define LP_BATTERY_THRESH ${config.lowPowerMode.batteryThreshold}
#define LP_IDLE_FPS ${config.lowPowerMode.idleFps}

// Weather API
#define WEATHER_API_ENABLED ${config.weatherApi?.enabled ? 'true' : 'false'}
#define WEATHER_API_KEY "${config.weatherApi?.apiKey || ''}"
#define WEATHER_LOCATION "${config.weatherApi?.location || ''}"
#define WEATHER_INTERVAL ${config.weatherApi?.intervalMinutes || 15}
#define TABUA_MARE_HARBOR_ID_DEFAULT ${config.weatherApi?.enabled ? 0 : 8} 

// Static Weather Defaults (User Compiled)
#define FIXED_WEATHER_ENABLED ${useFixedWeather ? 'true' : 'false'}
#define FIXED_TEMP ${defTemp}
#define FIXED_WIND ${defWind}

#define API_PORT 80
#define DEFAULT_CYCLE_DURATION ${config.cycleDuration}.0f

// UUIDs for BLE
#define SERVICE_UUID        "12345678-1234-1234-1234-1234567890ab"
#define CHARACTERISTIC_UUID "87654321-4321-4321-4321-ba0987654321"

// --- DATA ROBUSTNESS LAYER ---
// Hardcoded Fallback Data (Generated from App State)
// Used if API fails or device is offline
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

export const generateMainCpp = (displayConfig: DisplayConfig) => `
#include <Arduino.h>
#include "config.h"
#include "WifiManager.h"
#include "MareEngine.h" // Tide Data Manager
#include "RestServer.h"
#include "DisplayManager.h"
#include "SerialManager.h"

// --- NEW MODULAR LED SYSTEM ---
#include "modules/led_ws2812b/ws2812b_controller.h"
#include "modules/led_ws2812b/ws2812b_animations.h"
#include "modules/led_ws2812b/ws2812b_config.h"

#ifdef ENABLE_BLE
#include "BleManager.h"
#endif
#if WEATHER_API_ENABLED
#include "WeatherManager.h"
#endif

// Global Instances
WS2812BController ledController;
WifiManager wifiManager;
MareEngine engine; // Holds Tide Data
RestServer server(&engine);
DisplayManager display;
SerialManager serialManager(&engine);

#ifdef ENABLE_BLE
BleManager bleManager(&engine);
#endif

#if WEATHER_API_ENABLED
WeatherManager weatherManager(&engine);
#endif

// Fake sensor reading
float readBatteryLevel() { return 100.0; } 

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n==================================");
  Serial.println("[SYSTEM] Iniciando Controlador TideFlux...");
  Serial.println("==================================");

  // Init LED Module
  Serial.println("[INIT] WS2812B LED Controller...");
  WS2812BConfigManager::load();
  ledController.begin();
  WS2812BAnimations::attachController(&ledController);
  WS2812BAnimations::idleAmbient(); // Start with idle

  // Display Setup
  Serial.println("[INIT] Display GC9A01...");
  display.begin();
  display.setBrightness(${displayConfig.brightness});
  display.showSplashScreen();
  delay(2000);

  // --- Dependency Injection for Weather/Port Config ---
  #if WEATHER_API_ENABLED
  Serial.println("[INIT] Weather Manager Dependencies...");
  serialManager.setWeatherManager(&weatherManager);
  server.setWeatherManager(&weatherManager);
  #ifdef ENABLE_BLE
  bleManager.setWeatherManager(&weatherManager);
  #endif
  #endif

  // WiFi
  wifiManager.connect();
  
  // Servers
  Serial.println("[INIT] Starting REST Server...");
  server.begin();

  #ifdef ENABLE_BLE
  Serial.println("[INIT] Starting BLE Stack...");
  bleManager.begin(DEVICE_NAME);
  #endif

  Serial.println("[SYSTEM] Sistema Pronto. Loop ativo.");
}

void loop() {
  server.handle();
  engine.update();
  serialManager.handle(); 
  
  // Variables for Logic
  float currentWindSpeed = 0.0f;
  int currentHumidity = 0;

  #if WEATHER_API_ENABLED
  weatherManager.update();
  WeatherData w = weatherManager.getData();
  display.setWeatherData(w.temp, w.humidity, w.windSpeed, w.windDir);
  currentWindSpeed = w.windSpeed;
  currentHumidity = w.humidity;
  #else
    // Check if fixed weather compiled in
    #if FIXED_WEATHER_ENABLED
       currentWindSpeed = FIXED_WIND;
       // Humidity not currently compiled in template but could be added
       display.setWeatherData(FIXED_TEMP, 60, FIXED_WIND, 0);
    #endif
  #endif

  // --- HIERARCHY INTEGRATION ---
  // 1. Get Data (Data Manager)
  float tideNorm = engine.getNormalizedTide(); // 0.0 - 1.0
  float tidePct = engine.getCurrentHeightPercent();
  
  // 2. Update Display
  display.update(tidePct);

  // 3. Update LEDs (Animations Module)
  // The Run() method in Animations now handles Autonomous Logic based on config.h flags
  // We pass the current Animation Mode string from config manager AND weather data
  WS2812BAnimations::run(WS2812BConfigManager::config.mode, tideNorm, currentWindSpeed, currentHumidity);
  
  // --- LOW POWER ---
  int frameDelay = 30; 
  if (LP_MODE_ENABLED) {
      if (readBatteryLevel() < LP_BATTERY_THRESH) {
          frameDelay = 1000 / LP_IDLE_FPS; 
      }
  }
  delay(frameDelay); 
}
`;