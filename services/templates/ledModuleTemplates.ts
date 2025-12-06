

import { FirmwareConfig } from '../../types';

export const generateWs2812bConfigH = () => `
#ifndef WS2812B_CONFIG_H
#define WS2812B_CONFIG_H

#include <Arduino.h>
#include <ArduinoJson.h>

// --- LAYER 1: CONFIGURATION ---
// Handles persistence and parameter state

struct WS2812BConfig {
    int pin;
    int numLeds;
    uint8_t brightness;
    int matrixWidth;  // 0 or 1 for strip
    int matrixHeight; 
    String layout;    // "STRIP", "MATRIX", "RING"
    String order;     // "GRB"
    
    // Animation Engine Params
    String mode;      
    float speed;      // 0.1 - 5.0
    float intensity;  // 0.0 - 1.0
    int paletteId;    // 0:Ocean, 1:Forest, 2:Lava, 3:Cloud, 4:Party
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

    return `
#include "ws2812b_config.h"
#include "config.h" 

WS2812BConfig WS2812BConfigManager::config = {
    LED_PIN,
    NUM_LEDS,
    LED_BRIGHTNESS,
    ${w}, // Width
    ${h}, // Height
    "${config.ledLayoutType}",
    "GRB",
    "${config.animationMode || 'oceanCaustics'}", 
    ${config.animationSpeed.toFixed(1)}f, 
    ${config.animationIntensity.toFixed(1)}f, 
    ${config.animationPalette}
};

void WS2812BConfigManager::load() {
    // Future: Load from LittleFS 'led_config.json'
}

void WS2812BConfigManager::updateFromJson(JsonObject json) {
    if (json.containsKey("brightness")) config.brightness = json["brightness"];
    if (json.containsKey("mode")) config.mode = json["mode"].as<String>();
    if (json.containsKey("speed")) config.speed = json["speed"];
    if (json.containsKey("intensity")) config.intensity = json["intensity"];
    if (json.containsKey("palette")) config.paletteId = json["palette"];
}
`;
};

export const generateWs2812bControllerH = () => `
#ifndef WS2812B_CONTROLLER_H
#define WS2812B_CONTROLLER_H

#include <FastLED.h>
#include "ws2812b_config.h"

// --- LAYER 2: HARDWARE ABSTRACTION (CONTROLLER) ---
// Handles physical LED mapping, buffers, and matrix logic

class WS2812BController {
public:
    WS2812BController();
    void begin();
    
    // Core Drawing API
    void setPixel(int i, CRGB color);
    void setPixelXY(int x, int y, CRGB color); // Handles Matrix Mapping
    void fadeAll(uint8_t amount);
    void clear();
    void show();
    
    int getWidth();
    int getHeight();
    int getNumLeds();
    
    // Internal Mapping
    uint16_t XY(uint8_t x, uint8_t y);

private:
    CRGB* leds;
    int _numLeds;
    int _width;
    int _height;
    bool _isMatrix;
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
    FastLED.setBrightness(WS2812BConfigManager::config.brightness);
    
    clear();
    show();
}

uint16_t WS2812BController::XY(uint8_t x, uint8_t y) {
    if (!_isMatrix) return x; // Strip mode: x is index
    
    if (x >= _width || y >= _height) return 0;
    
    // Serpentine Layout Logic (ZigZag)
    // Even rows L->R, Odd rows R->L (or configurable)
    // This assumes standard WS2812B matrix standard
    if (y & 1) {
        return (y * _width) + (_width - 1 - x);
    } else {
        return (y * _width) + x;
    }
}

void WS2812BController::setPixel(int i, CRGB color) {
    if (i >= 0 && i < _numLeds) leds[i] = color;
}

void WS2812BController::setPixelXY(int x, int y, CRGB color) {
    uint16_t i = XY(x, y);
    if (i < _numLeds) leds[i] = color;
}

void WS2812BController::fadeAll(uint8_t amount) {
    for(int i = 0; i < _numLeds; i++) leds[i].nscale8(amount);
}

void WS2812BController::clear() {
    fill_solid(leds, _numLeds, CRGB::Black);
}

void WS2812BController::show() {
    FastLED.show();
}

int WS2812BController::getWidth() { return _width; }
int WS2812BController::getHeight() { return _height; }
int WS2812BController::getNumLeds() { return _numLeds; }
`;

export const generateWs2812bAnimationsH = () => `
#ifndef WS2812B_ANIMATIONS_H
#define WS2812B_ANIMATIONS_H

#include "ws2812b_controller.h"

// --- LAYER 3: ANIMATION LOGIC ---
// Pure logic functions, unaware of specific hardware pins

struct AnimationParams {
    float speed;        // 0.1 to 5.0
    float intensity;    // 0.0 to 1.0
    CRGBPalette16 palette;
    float tideLevel;    // 0.0 to 1.0 (Normalized)
};

class WS2812BAnimations {
public:
    static void attachController(WS2812BController* controller);
    
    // Main Dispatcher (Called by loop)
    // Accepts weather params for autonomous logic
    static void run(String mode, float tideLevel, float windSpeed = 0, int humidity = 0);
    
    // Standard Modes
    static void idleAmbient();
    static void tideFillAnimation(float tideNorm); // Legacy

    // --- Premium Generative Engines 2.0 ---
    static void oceanCaustics(AnimationParams p, uint32_t t);
    static void tideFill2(AnimationParams p, uint32_t t);
    static void auroraWaves(AnimationParams p, uint32_t t);
    static void deepSeaParticles(AnimationParams p, uint32_t t);
    static void stormSurge(AnimationParams p, uint32_t t);
    static void neonPulse(AnimationParams p, uint32_t t);
    
    // Helpers
    static CRGBPalette16 getPaletteById(int id);

private:
    static WS2812BController* _ctrl;
};

#endif
`;

export const generateWs2812bAnimationsCpp = () => `
#include "ws2812b_animations.h"
#include "config.h"

WS2812BController* WS2812BAnimations::_ctrl = nullptr;

void WS2812BAnimations::attachController(WS2812BController* controller) {
    _ctrl = controller;
}

CRGBPalette16 WS2812BAnimations::getPaletteById(int id) {
    if (id == 1) return ForestColors_p;
    if (id == 2) return LavaColors_p;
    if (id == 3) return CloudColors_p;
    if (id == 4) return PartyColors_p;
    return OceanColors_p; // Default 0
}

void WS2812BAnimations::run(String mode, float tideLevel, float windSpeed, int humidity) {
    if (!_ctrl) return;
    
    // Construct Params from Config + Live Data
    AnimationParams p;
    p.speed = WS2812BConfigManager::config.speed;
    p.intensity = WS2812BConfigManager::config.intensity;
    p.palette = getPaletteById(WS2812BConfigManager::config.paletteId);
    p.tideLevel = tideLevel;

    // --- AUTONOMOUS LOGIC INTEGRATION ---
    // This runs directly on the ESP32
    #if AUTO_LOGIC_ENABLED
        #if AUTO_LINK_SPEED_TIDE
           // Low Tide (0.0) = 0.2x speed (Calm)
           // High Tide (1.0) = 2.0x speed (Energetic)
           p.speed = p.speed * (0.2f + (tideLevel * 1.8f));
        #endif

        #if AUTO_LINK_BRIGHT_TIDE
           // Low Tide = Dimmer (Energy saving/Visual cue)
           // Scale intensity between 0.4 and 1.0 based on tide
           p.intensity = p.intensity * (0.4f + (tideLevel * 0.6f));
        #endif
        
        #if AUTO_LINK_WEATHER
           // Wind (0-50km/h) scales Speed (0.1x to 5.0x)
           // Clamp wind for safety
           float safeWind = windSpeed;
           if (safeWind > 50) safeWind = 50;
           float windMult = safeWind / 10.0f; 
           if (windMult < 0.1f) windMult = 0.1f;
           if (windMult > 5.0f) windMult = 5.0f;
           p.speed = windMult;

           // Humidity (0-100%) scales Intensity (0.2x to 1.0x)
           float humMult = humidity / 100.0f;
           if (humMult < 0.2f) humMult = 0.2f;
           if (humMult > 1.0f) humMult = 1.0f;
           p.intensity = humMult;
        #endif
        
        // Note: Palette linkage would require RTC time check, omitted for simplicity in this loop
    #endif

    uint32_t t = millis();

    if (mode == "oceanCaustics") oceanCaustics(p, t);
    else if (mode == "tideFill2") tideFill2(p, t);
    else if (mode == "aurora") auroraWaves(p, t);
    else if (mode == "deepSea") deepSeaParticles(p, t);
    else if (mode == "storm") stormSurge(p, t);
    else if (mode == "neon") neonPulse(p, t);
    else tideFillAnimation(tideLevel); // Default Legacy
    
    _ctrl->show();
}

void WS2812BAnimations::idleAmbient() {
    // Simple placeholder
}

void WS2812BAnimations::tideFillAnimation(float tideNorm) {
    // Legacy simple fill
    int h = _ctrl->getHeight();
    int w = _ctrl->getWidth();
    int level = tideNorm * h;
    for(int y=0; y<h; y++) {
        CRGB c = (y < level) ? CRGB::Blue : CRGB::Black;
        for(int x=0; x<w; x++) _ctrl->setPixelXY(x,y,c);
    }
}

// ==========================================
// 🌊 ALGORITHM A: OCEAN CAUSTICS (Noise)
// ==========================================
void WS2812BAnimations::oceanCaustics(AnimationParams p, uint32_t t) {
    int w = _ctrl->getWidth();
    int h = _ctrl->getHeight();
    
    // Scale noise coords
    uint16_t scale = 30; 
    uint16_t speed = t * (p.speed * 0.5);

    for(int x = 0; x < w; x++) {
        for(int y = 0; y < h; y++) {
            // 2D Simplex Noise approximation
            uint8_t noise = inoise8(x * scale, y * scale + speed, t / 3);
            
            // Map noise to palette brightness
            // "Caustics" look: Dark base with bright highlights
            // Apply intensity scaling to brightness map
            uint8_t minBright = 10 * p.intensity;
            uint8_t maxBright = 255 * p.intensity;
            uint8_t brightness = map(noise, 0, 255, minBright, maxBright);
            
            // Cutoff for sharp lines
            if (brightness < (100 * p.intensity)) brightness = brightness / 3; 
            else brightness = map(brightness, 100 * p.intensity, 255 * p.intensity, 50, 255);

            CRGB color = ColorFromPalette(p.palette, noise, brightness);
            _ctrl->setPixelXY(x, y, color);
        }
    }
}

// ==========================================
// 🌊 ALGORITHM B: TIDE FILL 2.0 (Gradient)
// ==========================================
void WS2812BAnimations::tideFill2(AnimationParams p, uint32_t t) {
    int w = _ctrl->getWidth();
    int h = _ctrl->getHeight();
    
    // Calculate top pixel Y based on level (0.0 - 1.0)
    // Flip coordinate system so 0 is bottom
    float fillHeight = p.tideLevel * h;
    int waterTopY = (int)fillHeight;

    for(int y = 0; y < h; y++) {
        // Assuming cable at bottom left.
        // If your strip goes UP from 0, standard Y is fine. 
        // If 0 is TOP, we invert. Let's assume 0 is BOTTOM for physics feel.
        int effectiveY = y; 
        
        if (effectiveY < waterTopY) {
            // Underwater Gradient
            uint8_t depth = map(effectiveY, 0, waterTopY, 0, 255);
            CRGB color = ColorFromPalette(p.palette, depth);
            
            // Apply Intensity
            color.nscale8(p.intensity * 255);
            
            // Add subtle ripple
            uint8_t ripple = sin8(effectiveY * 10 - t/10);
            if (ripple > 240) color += CRGB(20 * p.intensity, 20 * p.intensity, 20 * p.intensity);
            
            _ctrl->setPixelXY(0, y, color); // Logic simplified
            // For matrix, fill whole row with X variation
            for(int x=0; x<w; x++) {
                 uint8_t hWave = sin8(x*10 + t/5);
                 CRGB c = color;
                 // Surface foam
                 if (effectiveY == waterTopY - 1 && hWave > 200) c += CRGB::White; 
                 _ctrl->setPixelXY(x, y, c);
            }
        } else {
             // Air
            for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, CRGB::Black);
        }
    }
}

// ==========================================
// 🌌 ALGORITHM C: AURORA WAVES
// ==========================================
void WS2812BAnimations::auroraWaves(AnimationParams p, uint32_t t) {
    int w = _ctrl->getWidth();
    int h = _ctrl->getHeight();

    for (int x = 0; x < w; x++) {
        // Interference pattern
        int wave1 = sin8((x * 10) + (t * p.speed / 3));
        int wave2 = cos8((x * 15) - (t * p.speed / 2));
        int wave3 = sin8((x * 5) + (t * p.speed));

        uint8_t hue = wave1 + wave2 + wave3;
        
        for (int y = 0; y < h; y++) {
             // Vertical shift
             uint8_t vShift = sin8(y * 8 + t/5);
             CRGB color = ColorFromPalette(p.palette, hue + vShift, 255 * p.intensity);
             _ctrl->setPixelXY(x, y, color);
        }
    }
}

// ==========================================
// ✨ ALGORITHM D: DEEP SEA PARTICLES
// ==========================================
void WS2812BAnimations::deepSeaParticles(AnimationParams p, uint32_t t) {
    _ctrl->fadeAll(235); // Slow fade trails
    
    int w = _ctrl->getWidth();
    int h = _ctrl->getHeight();
    
    // Spawn new particle randomly based on intensity
    if (random8() < (20 * p.intensity)) {
        int x = random16(w);
        int y = random16(h);
        CRGB c = ColorFromPalette(p.palette, random8());
        _ctrl->setPixelXY(x, y, c);
    }
}

// ==========================================
// ⚡ ALGORITHM E: STORM SURGE
// ==========================================
void WS2812BAnimations::stormSurge(AnimationParams p, uint32_t t) {
    int w = _ctrl->getWidth();
    int h = _ctrl->getHeight();
    
    // Turbulent noise
    for(int x=0; x<w; x++) {
        for(int y=0; y<h; y++) {
             uint8_t noise = inoise8(x*50, y*50, t * p.speed);
             if (noise > 220) {
                 // Flash brightness scales with intensity
                 _ctrl->setPixelXY(x, y, CRGB(255 * p.intensity, 255 * p.intensity, 255 * p.intensity)); 
             } else {
                 CRGB c = ColorFromPalette(p.palette, noise);
                 c.nscale8(p.intensity * 255);
                 _ctrl->setPixelXY(x, y, c);
             }
        }
    }
}

void WS2812BAnimations::neonPulse(AnimationParams p, uint32_t t) {
     uint8_t hue = (t / 10) * p.speed;
     int num = _ctrl->getNumLeds();
     for(int i=0; i<num; i++) {
         _ctrl->setPixel(i, CHSV(hue + (i*5), 255, 255 * p.intensity));
     }
}
`;