


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
    
    // Physical Specs for Adaptive Animation
    float lengthMeters;
    int ledDensity;   // LEDs/meter
    float maxPowerAmps;
    
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
    const phys = config.physicalSpecs || { stripLengthMeters: 1.0, ledDensity: 60, maxPowerAmps: 2.0 };

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
    ${phys.stripLengthMeters.toFixed(2)}f, // Length in Meters
    ${phys.ledDensity}, // Density (LEDs/m)
    ${phys.maxPowerAmps.toFixed(1)}f, // Max Amps
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
    
    // Power Limiting (Adaptive Brightness)
    // 5V * MaxAmps * 1000 = mW
    float maxAmps = WS2812BConfigManager::config.maxPowerAmps;
    if (maxAmps > 0.1) {
        FastLED.setMaxPowerInVoltsAndMilliamps(5, maxAmps * 1000);
    }

    FastLED.setBrightness(WS2812BConfigManager::config.brightness);
    
    clear();
    show();
}

uint16_t WS2812BController::XY(uint8_t x, uint8_t y) {
    if (!_isMatrix) return x; // Strip mode: x is index
    
    if (x >= _width || y >= _height) return 0;
    
    // Serpentine Layout Logic (ZigZag)
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
    
    // Adaptive Physical Params
    float meterPos(int pixelIndex) {
        return (float)pixelIndex / (float)WS2812BConfigManager::config.ledDensity;
    }
    float totalMeters() {
        return WS2812BConfigManager::config.lengthMeters;
    }
};

class WS2812BAnimations {
public:
    static void attachController(WS2812BController* controller);
    
    // Main Dispatcher
    static void run(String mode, float tideLevel, float windSpeed = 0, int humidity = 0);
    
    // Standard Modes
    static void idleAmbient();
    static void tideFillAnimation(float tideNorm); 

    // --- Premium Generative Engines 2.0 (Adaptive) ---
    static void tideWaveVertical(AnimationParams p, uint32_t t);
    static void oceanCaustics(AnimationParams p, uint32_t t);
    static void tideFill2(AnimationParams p, uint32_t t);
    static void auroraWaves(AnimationParams p, uint32_t t);
    static void deepSeaParticles(AnimationParams p, uint32_t t);
    static void stormSurge(AnimationParams p, uint32_t t);
    static void neonPulse(AnimationParams p, uint32_t t);
    static void coralReef(AnimationParams p, uint32_t t);
    
    static CRGBPalette16 getPaletteById(int id);
    static float _previousTideLevel;

private:
    static WS2812BController* _ctrl;
};

#endif
`;

export const generateWs2812bAnimationsCpp = () => `
#include "ws2812b_animations.h"
#include "config.h"

WS2812BController* WS2812BAnimations::_ctrl = nullptr;
float WS2812BAnimations::_previousTideLevel = 0.5f;

void WS2812BAnimations::attachController(WS2812BController* controller) {
    _ctrl = controller;
}

CRGBPalette16 WS2812BAnimations::getPaletteById(int id) {
    if (id == 1) return ForestColors_p;
    if (id == 2) return LavaColors_p;
    if (id == 3) return CloudColors_p;
    if (id == 4) return PartyColors_p;
    return OceanColors_p;
}

void WS2812BAnimations::run(String mode, float tideLevel, float windSpeed, int humidity) {
    if (!_ctrl) return;
    
    AnimationParams p;
    p.speed = WS2812BConfigManager::config.speed;
    p.intensity = WS2812BConfigManager::config.intensity;
    p.palette = getPaletteById(WS2812BConfigManager::config.paletteId);
    p.tideLevel = tideLevel;

    // --- AUTONOMOUS LOGIC INTEGRATION ---
    #if AUTO_LOGIC_ENABLED
        #if AUTO_LINK_SPEED_TIDE
           p.speed = p.speed * (0.2f + (tideLevel * 1.8f));
        #endif

        #if AUTO_LINK_BRIGHT_TIDE
           p.intensity = p.intensity * (0.4f + (tideLevel * 0.6f));
        #endif
        
        #if AUTO_LINK_WEATHER
           float safeWind = windSpeed;
           if (safeWind > 50) safeWind = 50;
           float windMult = safeWind / 10.0f; 
           if (windMult < 0.1f) windMult = 0.1f;
           if (windMult > 5.0f) windMult = 5.0f;
           p.speed = windMult;

           float humMult = humidity / 100.0f;
           if (humMult < 0.2f) humMult = 0.2f;
           if (humMult > 1.0f) humMult = 1.0f;
           p.intensity = humMult;
        #endif
    #endif

    uint32_t t = millis();

    if (mode == "tideWaveVertical") tideWaveVertical(p, t);
    else if (mode == "oceanCaustics") oceanCaustics(p, t);
    else if (mode == "coralReef") coralReef(p, t);
    else if (mode == "tideFill2") tideFill2(p, t);
    else if (mode == "aurora") auroraWaves(p, t);
    else if (mode == "deepSea") deepSeaParticles(p, t);
    else if (mode == "storm") stormSurge(p, t);
    else if (mode == "neon") neonPulse(p, t);
    else tideFillAnimation(tideLevel);

    _previousTideLevel = tideLevel;
    _ctrl->show();
}

void WS2812BAnimations::idleAmbient() {
    // Placeholder
}

void WS2812BAnimations::tideFillAnimation(float tideNorm) {
    int h = _ctrl->getHeight();
    int w = _ctrl->getWidth();
    int level = tideNorm * h;
    for(int y=0; y<h; y++) {
        CRGB c = (y < level) ? CRGB::Blue : CRGB::Black;
        for(int x=0; x<w; x++) _ctrl->setPixelXY(x,y,c);
    }
}

// 🌊 ALGORITHM: TIDE WAVE VERTICAL (ADAPTIVE)
void WS2812BAnimations::tideWaveVertical(AnimationParams p, uint32_t t) {
    int w = _ctrl->getWidth();
    int h = _ctrl->getHeight();
    
    // Density Adaptation:
    // Scale the wave logic so that 1 meter has constant wave frequency
    // regardless of whether we have 30 or 144 LEDs.
    float pixelsPerMeter = (float)WS2812BConfigManager::config.ledDensity;
    if (pixelsPerMeter < 1) pixelsPerMeter = 30; // Safety

    bool isRising = (p.tideLevel >= _previousTideLevel);
    int dir = isRising ? 1 : -1;
    int fillH = p.tideLevel * h;

    for (int y = 0; y < h; y++) {
        if (y < fillH) {
            float relDepth = (float)y / (float)fillH;
            
            // Physical Position (in Meters)
            float posMeters = y / pixelsPerMeter;
            
            // Frequency: ~10 waves per meter? Adjusted constant 30 -> 10 per meter
            // Time: t is ms. 1000ms = 1 sec.
            // Speed = 1 m/s (approx).
            
            // Use physical coords for the sine wave
            uint8_t wave = sin8((posMeters * 50) - (t * p.speed * 0.1 * dir));
            
            CRGB c1 = CRGB(0, 0, 50);   
            CRGB c2 = CRGB(0, 100, 150); 
            CRGB c3 = CRGB(150, 255, 255); 
            
            CRGB color = blend(c1, c2, relDepth * 255);
            
            if (wave > 128) {
                color += CRGB(wave/10, wave/5, wave/5);
            }
            
            if (relDepth > 0.9) {
               // Foam at top
               uint8_t foam = sin8(posMeters * 100 + t * 0.2);
               if (foam > 200) color = c3;
            }
            
            color.nscale8(p.intensity * 255);
            for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, color);
        } else {
             for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, CRGB::Black);
        }
    }
}

// 🌊 ALGORITHM: OCEAN CAUSTICS (ADAPTIVE)
void WS2812BAnimations::oceanCaustics(AnimationParams p, uint32_t t) {
    int w = _ctrl->getWidth();
    int h = _ctrl->getHeight();
    
    // Adaptive Scaling
    float density = (float)WS2812BConfigManager::config.ledDensity;
    // Base scale for noise. A scale of 30 was used for ~60leds/m.
    // If we have 144 leds/m, we need a smaller step per pixel to keep pattern size same.
    // Base density 60 -> Scale 30. Ratio = 0.5.
    float scale = (30.0 / 60.0) * density; 
    
    uint16_t speed = t * (p.speed * 0.5);

    for(int x = 0; x < w; x++) {
        for(int y = 0; y < h; y++) {
            // x/y are pixels. If density doubles, x doubles for same physical distance.
            // We want noise lookup to stay constant for distance.
            // inoise8 expects integer input.
            // Original: x * 30.
            // Adaptive: x * (30/60 * density) ? No.
            // If density is 120, x is 2x larger. To keep texture size same, we must sample slower?
            // Wait. High Density = More pixels per meter.
            // To cover same noise 'area' in 1 meter:
            // 60 pixels * Step S = NoiseArea
            // 120 pixels * Step S2 = NoiseArea -> S2 must be S/2.
            
            // So Scale factor should be INVERSE to density.
            // Let's normalize everything to "Meters".
            // float xMeters = x / density;
            // float yMeters = y / density;
            // int noiseInputX = xMeters * CONSTANT_NOISE_SCALE;
            
            // Constant to make it look good (approx 2000 units per meter for noise function)
            uint32_t noiseScale = 2000; 
            
            int nx = (x * noiseScale) / density;
            int ny = (y * noiseScale) / density;

            uint8_t noise = inoise8(nx, ny + speed, t / 3);
            
            uint8_t minBright = 10 * p.intensity;
            uint8_t maxBright = 255 * p.intensity;
            uint8_t brightness = map(noise, 0, 255, minBright, maxBright);
            
            if (brightness < (100 * p.intensity)) brightness = brightness / 3; 
            else brightness = map(brightness, 100 * p.intensity, 255 * p.intensity, 50, 255);

            CRGB color = ColorFromPalette(p.palette, noise, brightness);
            _ctrl->setPixelXY(x, y, color);
        }
    }
}

// 🌊 ALGORITHM: TIDE FILL 2
void WS2812BAnimations::tideFill2(AnimationParams p, uint32_t t) {
    int w = _ctrl->getWidth();
    int h = _ctrl->getHeight();
    float fillHeight = p.tideLevel * h;
    int waterTopY = (int)fillHeight;
    float density = (float)WS2812BConfigManager::config.ledDensity;

    for(int y = 0; y < h; y++) {
        if (y < waterTopY) {
            uint8_t depth = map(y, 0, waterTopY, 0, 255);
            CRGB color = ColorFromPalette(p.palette, depth);
            color.nscale8(p.intensity * 255);
            
            // Adaptive Ripple Frequency
            // Use physical Y (y/density) to determine wave phase
            float yMeters = y / density;
            uint8_t ripple = sin8(yMeters * 600 - t/10); // 600 is arbitrary tuning freq
            
            if (ripple > 240) color += CRGB(20 * p.intensity, 20 * p.intensity, 20 * p.intensity);
            
            for(int x=0; x<w; x++) {
                 // Adaptive Surface Wave
                 float xMeters = x / density;
                 uint8_t hWave = sin8(xMeters*600 + t/5);
                 
                 CRGB c = color;
                 if (y == waterTopY - 1 && hWave > 200) c += CRGB::White; 
                 _ctrl->setPixelXY(x, y, c);
            }
        } else {
            for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, CRGB::Black);
        }
    }
}

// 🌌 ALGORITHM: AURORA
void WS2812BAnimations::auroraWaves(AnimationParams p, uint32_t t) {
    int w = _ctrl->getWidth();
    int h = _ctrl->getHeight();
    // Simplified adaptive scaling for Aurora
    // Just scaling input coordinates down if density is high
    float scale = 60.0 / (float)WS2812BConfigManager::config.ledDensity;
    
    for (int x = 0; x < w; x++) {
        int effX = x * scale;
        
        int wave1 = sin8((effX * 10) + (t * p.speed / 3));
        int wave2 = cos8((effX * 15) - (t * p.speed / 2));
        int wave3 = sin8((effX * 5) + (t * p.speed));
        uint8_t hue = wave1 + wave2 + wave3;
        for (int y = 0; y < h; y++) {
             int effY = y * scale;
             uint8_t vShift = sin8(effY * 8 + t/5);
             CRGB color = ColorFromPalette(p.palette, hue + vShift, 255 * p.intensity);
             _ctrl->setPixelXY(x, y, color);
        }
    }
}

// ✨ ALGORITHM: DEEP SEA
void WS2812BAnimations::deepSeaParticles(AnimationParams p, uint32_t t) {
    _ctrl->fadeAll(235);
    int w = _ctrl->getWidth();
    int h = _ctrl->getHeight();
    
    // Probability scaled by total LEDs to keep particle count density similar
    // Base probability 20 for ~60 LEDs.
    int numLeds = w*h;
    int chance = map(numLeds, 0, 300, 20, 5); 
    
    if (random8() < (chance * p.intensity)) {
        int x = random16(w);
        int y = random16(h);
        CRGB c = ColorFromPalette(p.palette, random8());
        _ctrl->setPixelXY(x, y, c);
    }
}

// ⚡ ALGORITHM: STORM
void WS2812BAnimations::stormSurge(AnimationParams p, uint32_t t) {
    int w = _ctrl->getWidth();
    int h = _ctrl->getHeight();
    float density = (float)WS2812BConfigManager::config.ledDensity;
    // Noise Scale ~3000 per meter
    uint32_t scale = 3000;
    
    for(int x=0; x<w; x++) {
        for(int y=0; y<h; y++) {
             int nx = (x * scale) / density;
             int ny = (y * scale) / density;
             
             uint8_t noise = inoise8(nx, ny, t * p.speed);
             if (noise > 220) {
                 _ctrl->setPixelXY(x, y, CRGB(255 * p.intensity, 255 * p.intensity, 255 * p.intensity)); 
             } else {
                 CRGB c = ColorFromPalette(p.palette, noise);
                 c.nscale8(p.intensity * 255);
                 _ctrl->setPixelXY(x, y, c);
             }
        }
    }
}

// 🏖 ALGORITHM: CORAL REEF
void WS2812BAnimations::coralReef(AnimationParams p, uint32_t t) {
    int w = _ctrl->getWidth();
    int h = _ctrl->getHeight();
    CRGB C_SAND  = CRGB(244, 215, 155);
    CRGB C_BL1 = CRGB(90, 200, 250);
    CRGB C_BL2 = CRGB(0, 119, 190);
    CRGB C_CORAL = CRGB(255, 107, 107);
    CRGB C_ROCK  = CRGB(139, 90, 43);

    int waterH = p.tideLevel * h; 
    
    // Pixel-Art style logic, harder to make fully adaptive without losing grid alignment
    // We will just scale the region sizes roughly
    
    for(int y=0; y<h; y++) {
        for(int x=0; x<w; x++) {
            CRGB pixelColor = C_SAND;
            bool isUnderwater = (y < waterH); 
            
            if (isUnderwater) {
                if (y > waterH - 4) pixelColor = C_BL1; 
                else pixelColor = C_BL2;
                if (random8() < 10) pixelColor += CRGB(20, 20, 20);
            }
            
            // Bottom 10% is sea floor
            if (y < (h * 0.15)) { 
                if (x % 4 == 2) pixelColor = C_CORAL; 
                if (x % 7 == 0) pixelColor = C_ROCK;
            }
            
            pixelColor.nscale8(p.intensity * 255);
            _ctrl->setPixelXY(x, y, pixelColor);
        }
    }
}

// 🤖 ALGORITHM: NEON
void WS2812BAnimations::neonPulse(AnimationParams p, uint32_t t) {
     uint8_t hue = (t / 10) * p.speed;
     int num = _ctrl->getNumLeds();
     // Adaptive gradient width
     float density = (float)WS2812BConfigManager::config.ledDensity;
     float step = 255.0 / density; // 1 full rainbow per meter approximately? 
     
     for(int i=0; i<num; i++) {
         _ctrl->setPixel(i, CHSV(hue + (int)(i*step), 255, 255 * p.intensity));
     }
}
`;