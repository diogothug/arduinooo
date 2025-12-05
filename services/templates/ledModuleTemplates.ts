
import { FirmwareConfig } from '../../types';

export const generateWs2812bConfigH = () => `
#ifndef WS2812B_CONFIG_H
#define WS2812B_CONFIG_H

#include <Arduino.h>
#include <ArduinoJson.h>

struct WS2812BConfig {
    int pin;
    int numLeds;
    uint8_t brightness;
    String order; // "GRB" or "RGB"
    String mode;  // "tideFill", "waveFlow", etc.
};

class WS2812BConfigManager {
public:
    static WS2812BConfig config;
    static void load();
    static void save();
    static void updateFromJson(JsonObject json);
    static String getJson();
};

#endif
`;

export const generateWs2812bConfigCpp = (config: FirmwareConfig) => `
#include "ws2812b_config.h"
#include "config.h" // Access to compile-time defaults

WS2812BConfig WS2812BConfigManager::config = {
    LED_PIN,
    NUM_LEDS,
    LED_BRIGHTNESS,
    "GRB",
    "tideFill"
};

void WS2812BConfigManager::load() {
    // In a real implementation, load from LittleFS/EEPROM
    // For now, use defaults from config.h
}

void WS2812BConfigManager::save() {
    // Save to LittleFS
}

void WS2812BConfigManager::updateFromJson(JsonObject json) {
    if (json.containsKey("pin")) config.pin = json["pin"];
    if (json.containsKey("num_leds")) config.numLeds = json["num_leds"];
    if (json.containsKey("brightness")) config.brightness = json["brightness"];
    if (json.containsKey("order")) config.order = json["order"].as<String>();
    if (json.containsKey("mode")) config.mode = json["mode"].as<String>();
}

String WS2812BConfigManager::getJson() {
    DynamicJsonDocument doc(512);
    doc["pin"] = config.pin;
    doc["num_leds"] = config.numLeds;
    doc["brightness"] = config.brightness;
    doc["order"] = config.order;
    doc["mode"] = config.mode;
    String output;
    serializeJson(doc, output);
    return output;
}
`;

export const generateWs2812bControllerH = () => `
#ifndef WS2812B_CONTROLLER_H
#define WS2812B_CONTROLLER_H

#include <FastLED.h>
#include "ws2812b_config.h"

class WS2812BController {
public:
    WS2812BController();
    void begin();
    void setPixelColor(int index, uint8_t r, uint8_t g, uint8_t b);
    void fillColor(uint8_t r, uint8_t g, uint8_t b);
    void fadeAll(uint8_t amount);
    void blackout();
    void show();
    void setBrightness(uint8_t b);
    int getNumLeds();

private:
    CRGB* leds;
    int _numLeds;
};

#endif
`;

export const generateWs2812bControllerCpp = () => `
#include "ws2812b_controller.h"

WS2812BController::WS2812BController() : leds(nullptr), _numLeds(0) {}

void WS2812BController::begin() {
    _numLeds = WS2812BConfigManager::config.numLeds;
    
    if (leds) delete[] leds;
    leds = new CRGB[_numLeds];
    
    // Note: FastLED requires compile-time constants for Templates. 
    // To support dynamic pins fully, we would need a switch-case macro.
    // For this firmware, we use the LED_PIN macro from config.h which corresponds to initial setup.
    // Dynamic pin changing at runtime requires reboot or advanced FastLED usage.
    
    FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, _numLeds).setCorrection(TypicalLEDStrip);
    FastLED.setBrightness(WS2812BConfigManager::config.brightness);
    
    blackout();
    show();
}

void WS2812BController::setPixelColor(int index, uint8_t r, uint8_t g, uint8_t b) {
    if (index >= 0 && index < _numLeds) {
        leds[index] = CRGB(r, g, b);
    }
}

void WS2812BController::fillColor(uint8_t r, uint8_t g, uint8_t b) {
    fill_solid(leds, _numLeds, CRGB(r, g, b));
}

void WS2812BController::fadeAll(uint8_t amount) {
    for(int i = 0; i < _numLeds; i++) { 
        leds[i].nscale8(amount); 
    }
}

void WS2812BController::blackout() {
    fillColor(0, 0, 0);
}

void WS2812BController::show() {
    FastLED.show();
}

void WS2812BController::setBrightness(uint8_t b) {
    FastLED.setBrightness(b);
}

int WS2812BController::getNumLeds() {
    return _numLeds;
}
`;

export const generateWs2812bAnimationsH = () => `
#ifndef WS2812B_ANIMATIONS_H
#define WS2812B_ANIMATIONS_H

#include "ws2812b_controller.h"

class WS2812BAnimations {
public:
    static void attachController(WS2812BController* controller);
    
    // Core animations
    static void tideFillAnimation(float levelPercent); // 0.0 - 1.0
    static void waveFlowAnimation(int speed);
    static void breathingWater(float levelPercent);
    static void alertAnimation(int type); // 1: Low, 2: High, 3: Error
    static void idleAmbient();

private:
    static WS2812BController* _controller;
};

#endif
`;

export const generateWs2812bAnimationsCpp = () => `
#include "ws2812b_animations.h"

WS2812BController* WS2812BAnimations::_controller = nullptr;

void WS2812BAnimations::attachController(WS2812BController* controller) {
    _controller = controller;
}

void WS2812BAnimations::tideFillAnimation(float levelPercent) {
    if (!_controller) return;
    
    int numLeds = _controller->getNumLeds();
    int limit = (int)(levelPercent * numLeds);
    
    // Sanity check
    if (limit < 0) limit = 0;
    if (limit > numLeds) limit = numLeds;

    _controller->blackout();

    // Water Color: Cyan/Blue
    for(int i=0; i<limit; i++) {
        // Simple Gradient from deep blue to lighter cyan
        uint8_t r = 0;
        uint8_t g = map(i, 0, numLeds, 20, 150);
        uint8_t b = map(i, 0, numLeds, 150, 255);
        _controller->setPixelColor(i, r, g, b);
    }
    
    _controller->show();
}

void WS2812BAnimations::waveFlowAnimation(int speed) {
    if (!_controller) return;
    int numLeds = _controller->getNumLeds();
    static uint16_t pos = 0;
    pos += speed;
    
    for(int i=0; i<numLeds; i++) {
        uint8_t val = sin8(i*10 + pos);
        _controller->setPixelColor(i, 0, val/2, val);
    }
    _controller->show();
}

void WS2812BAnimations::breathingWater(float levelPercent) {
    if (!_controller) return;
    int numLeds = _controller->getNumLeds();
    int limit = (int)(levelPercent * numLeds);
    
    float breath = (exp(sin(millis()/2000.0*PI)) - 0.36787944)*108.0;
    
    for(int i=0; i<limit; i++) {
        _controller->setPixelColor(i, 0, 50 + (int)breath/2, 150 + (int)breath/2);
    }
    for(int i=limit; i<numLeds; i++) {
        _controller->setPixelColor(i, 0, 0, 0);
    }
    _controller->show();
}

void WS2812BAnimations::alertAnimation(int type) {
    if (!_controller) return;
    int numLeds = _controller->getNumLeds();
    
    // Blink Red for Error, Orange for Low, Purple for High
    bool blink = (millis() / 500) % 2 == 0;
    if (!blink) {
        _controller->blackout();
        _controller->show();
        return;
    }

    uint8_t r=0, g=0, b=0;
    if (type == 1) { r=255; g=100; b=0; } // Low (Orange)
    if (type == 2) { r=150; g=0; b=255; } // High (Purple)
    if (type == 3) { r=255; g=0; b=0; }   // Error (Red)

    _controller->fillColor(r, g, b);
    _controller->show();
}

void WS2812BAnimations::idleAmbient() {
    if (!_controller) return;
    // Slow blue shift
    waveFlowAnimation(2);
}
`;
