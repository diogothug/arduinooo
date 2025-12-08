
import { FirmwareConfig } from '../../types';

export const generateWs2812bConfigH = () => `
#ifndef WS2812B_CONFIG_H
#define WS2812B_CONFIG_H
#include <Arduino.h>
#include <ArduinoJson.h>

struct WS2812BConfig {
    int pin; int numLeds; uint8_t brightness;
    int matrixWidth; int matrixHeight; String layout; String order;
    float lengthMeters; int ledDensity; float maxPowerAmps;
    float tension; float damping; float spread;
    String mode; float speed; float intensity; int paletteId;
    bool linkWeather; bool linkMoon;
};

class WS2812BConfigManager {
public:
    static WS2812BConfig config;
    static void load();
    static void updateFromJson(JsonObject json);
};
#endif
`;

export const generateWs2812bConfigCpp = (config: FirmwareConfig) => {
    const isMatrix = config.ledLayoutType === 'MATRIX';
    const w = isMatrix ? (config.ledMatrixWidth || 10) : config.ledCount;
    const h = isMatrix ? Math.ceil(config.ledCount / w) : 1;
    const phys = config.physicalSpecs || { stripLengthMeters: 1.0, ledDensity: 60, maxPowerAmps: 2.0 };
    const fluid = config.fluidParams || { tension: 0.025, damping: 0.02, spread: 0.1 };

    return `
#include "ws2812b_config.h"
#include "config.h" 

WS2812BConfig WS2812BConfigManager::config = {
    LED_PIN, NUM_LEDS, LED_BRIGHTNESS, ${w}, ${h}, "${config.ledLayoutType}", "GRB",
    ${phys.stripLengthMeters.toFixed(2)}f, ${phys.ledDensity}, ${phys.maxPowerAmps.toFixed(1)}f, 
    ${fluid.tension.toFixed(3)}f, ${fluid.damping.toFixed(3)}f, ${fluid.spread.toFixed(2)}f,
    "${config.animationMode || 'fluidPhysics'}", ${config.animationSpeed.toFixed(1)}f, ${config.animationIntensity.toFixed(1)}f, ${config.animationPalette},
    ${config.autonomous?.linkWeatherToLeds ? 'true' : 'false'}, ${config.autonomous?.linkPaletteToTime ? 'true' : 'false'}
};

void WS2812BConfigManager::load() { /* Future: Load from LittleFS */ }
void WS2812BConfigManager::updateFromJson(JsonObject json) {
    if (json.containsKey("brightness")) config.brightness = json["brightness"];
    if (json.containsKey("mode")) config.mode = json["mode"].as<String>();
}
`;
};

export const generateWs2812bControllerH = () => `
#ifndef WS2812B_CONTROLLER_H
#define WS2812B_CONTROLLER_H
#include <FastLED.h>
#include "ws2812b_config.h"

class WS2812BController {
public:
    WS2812BController();
    void begin();
    void setPixel(int i, CRGB color);
    void setPixelXY(int x, int y, CRGB color);
    void fadeAll(uint8_t amount);
    void fill(CRGB color);
    void clear();
    void show();
    int getWidth(); int getHeight(); int getNumLeds();
    uint16_t XY(uint8_t x, uint8_t y);
private:
    CRGB* leds;
    int _numLeds; int _width; int _height; bool _isMatrix;
};
#endif
`;

export const generateWs2812bControllerCpp = () => `
#include "ws2812b_controller.h"

WS2812BController::WS2812BController() : leds(nullptr), _numLeds(0) {}

void WS2812BController::begin() {
    _numLeds = WS2812BConfigManager::config.numLeds;
    _width = WS2812BConfigManager::config.matrixWidth;
    _height = WS2812BConfigManager::config.matrixHeight;
    _isMatrix = (WS2812BConfigManager::config.layout == "MATRIX");

    if (leds) delete[] leds;
    leds = new CRGB[_numLeds];
    FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, _numLeds).setCorrection(TypicalLEDStrip);
    if (WS2812BConfigManager::config.maxPowerAmps > 0.1) {
        FastLED.setMaxPowerInVoltsAndMilliamps(5, WS2812BConfigManager::config.maxPowerAmps * 1000);
    }
    FastLED.setBrightness(WS2812BConfigManager::config.brightness);
    clear(); show();
}

uint16_t WS2812BController::XY(uint8_t x, uint8_t y) {
    if (!_isMatrix) return x; 
    if (x >= _width || y >= _height) return 0;
    if (WS2812BConfigManager::config.layout == "MATRIX") {
        if (y & 1) return (y * _width) + (_width - 1 - x);
        else return (y * _width) + x;
    }
    return x;
}

void WS2812BController::setPixel(int i, CRGB color) { if (i >= 0 && i < _numLeds) leds[i] = color; }
void WS2812BController::setPixelXY(int x, int y, CRGB color) { uint16_t i = XY(x, y); if (i < _numLeds) leds[i] = color; }
void WS2812BController::fadeAll(uint8_t amount) { for(int i = 0; i < _numLeds; i++) leds[i].nscale8(amount); }
void WS2812BController::fill(CRGB color) { fill_solid(leds, _numLeds, color); }
void WS2812BController::clear() { fill_solid(leds, _numLeds, CRGB::Black); }
void WS2812BController::show() { FastLED.show(); }
int WS2812BController::getWidth() { return _width; }
int WS2812BController::getHeight() { return _height; }
int WS2812BController::getNumLeds() { return _numLeds; }
`;
