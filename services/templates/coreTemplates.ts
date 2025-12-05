
import { FirmwareConfig, DisplayConfig } from '../../types';

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

export const generateConfigH = (config: FirmwareConfig) => `
#ifndef CONFIG_H
#define CONFIG_H

#define WIFI_SSID "${config.ssid}"
#define WIFI_PASSWORD "${config.password}"
#define DEVICE_NAME "${config.deviceName}"

#define LED_PIN ${config.ledPin}
#define NUM_LEDS ${config.ledCount}
#define LED_BRIGHTNESS 200

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

#define API_PORT 80
#define DEFAULT_CYCLE_DURATION ${config.cycleDuration}.0f

// UUIDs for BLE
#define SERVICE_UUID        "12345678-1234-1234-1234-1234567890ab"
#define CHARACTERISTIC_UUID "87654321-4321-4321-4321-ba0987654321"

#endif
`;

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
  Serial.println("Iniciando Controlador TideFlux...");

  // Init LED Module
  WS2812BConfigManager::load();
  ledController.begin();
  WS2812BAnimations::attachController(&ledController);
  WS2812BAnimations::idleAmbient(); // Start with idle

  // Display Setup
  display.begin();
  display.setBrightness(${displayConfig.brightness});
  display.showSplashScreen();
  delay(2000);

  wifiManager.connect();
  server.begin();

  #ifdef ENABLE_BLE
  bleManager.begin(DEVICE_NAME);
  #endif

  Serial.println("Sistema Pronto.");
}

void loop() {
  server.handle();
  engine.update();
  serialManager.handle(); 
  
  #if WEATHER_API_ENABLED
  weatherManager.update();
  WeatherData w = weatherManager.getData();
  display.setWeatherData(w.temp, w.humidity, w.windSpeed, w.windDir);
  #endif

  // --- HIERARCHY INTEGRATION ---
  // 1. Get Data (Data Manager)
  float tideNorm = engine.getNormalizedTide(); // 0.0 - 1.0
  float tidePct = engine.getCurrentHeightPercent();
  
  // 2. Update Display
  display.update(tidePct);

  // 3. Update LEDs (Animations Module)
  // Use config mode or default to tideFill
  WS2812BAnimations::tideFillAnimation(tideNorm);
  
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
