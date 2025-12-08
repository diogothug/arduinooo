


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
    int matrixWidth;  
    int matrixHeight; 
    String layout;    
    String order;     
    
    // Physical Specs
    float lengthMeters;
    int ledDensity;   
    float maxPowerAmps;
    
    // Physics
    float tension;
    float damping;
    float spread;
    
    // Animation & Autonomy
    String mode;      
    float speed;      
    float intensity;  
    int paletteId;    
    
    // Environment Toggles
    bool linkWeather;
    bool linkMoon;
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
    LED_PIN,
    NUM_LEDS,
    LED_BRIGHTNESS,
    ${w}, 
    ${h}, 
    "${config.ledLayoutType}",
    "GRB",
    ${phys.stripLengthMeters.toFixed(2)}f, 
    ${phys.ledDensity}, 
    ${phys.maxPowerAmps.toFixed(1)}f, 
    ${fluid.tension.toFixed(3)}f,
    ${fluid.damping.toFixed(3)}f,
    ${fluid.spread.toFixed(2)}f,
    "${config.animationMode || 'fluidPhysics'}", 
    ${config.animationSpeed.toFixed(1)}f, 
    ${config.animationIntensity.toFixed(1)}f, 
    ${config.animationPalette},
    ${config.autonomous?.linkWeatherToLeds ? 'true' : 'false'},
    ${config.autonomous?.linkPaletteToTime ? 'true' : 'false'}
};

void WS2812BConfigManager::load() {
    // Future: Load from LittleFS
}

void WS2812BConfigManager::updateFromJson(JsonObject json) {
    if (json.containsKey("brightness")) config.brightness = json["brightness"];
    if (json.containsKey("mode")) config.mode = json["mode"].as<String>();
    if (json.containsKey("speed")) config.speed = json["speed"];
    if (json.containsKey("intensity")) config.intensity = json["intensity"];
    if (json.containsKey("tension")) config.tension = json["tension"];
    if (json.containsKey("damping")) config.damping = json["damping"];
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
    
    int getWidth();
    int getHeight();
    int getNumLeds();
    
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
    
    float maxAmps = WS2812BConfigManager::config.maxPowerAmps;
    if (maxAmps > 0.1) {
        FastLED.setMaxPowerInVoltsAndMilliamps(5, maxAmps * 1000);
    }

    FastLED.setBrightness(WS2812BConfigManager::config.brightness);
    clear();
    show();
}

uint16_t WS2812BController::XY(uint8_t x, uint8_t y) {
    if (!_isMatrix) return x; 
    if (x >= _width || y >= _height) return 0;
    
    // Matrix Toplogy Mapping
    if (WS2812BConfigManager::config.layout == "MATRIX") {
        if (y & 1) { // ZigZag (Serpentine)
            return (y * _width) + (_width - 1 - x);
        } else {
            return (y * _width) + x;
        }
    }
    return x; // Fallback
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

void WS2812BController::fill(CRGB color) {
    fill_solid(leds, _numLeds, color);
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
#include "../../FluidEngine.h" 

struct AnimationParams {
    float speed;
    float intensity;
    CRGBPalette16 palette;
    float tideLevel;    // 0.0 - 1.0
    int trend;          // 1 (Rising), -1 (Falling), 0 (Steady)
    float windSpeed;    // km/h
    int moonPhase;      // 0-100 (illumination)
    bool useWeather;
    bool useMoon;
};

class WS2812BAnimations {
public:
    static void attachController(WS2812BController* controller);
    static void run(String mode, float tideLevel, int trend, float windSpeed = 0, int humidity = 0);

private:
    static WS2812BController* _ctrl;
    static FluidEngine _fluid;
    static bool _fluidInit;
    
    // Premium Modes (V2.7)
    static void runStripBasic(AnimationParams p, uint32_t t);
    static void runMatrixBeach(AnimationParams p, uint32_t t);
    static void runMatrixFluid(AnimationParams p, uint32_t t);
    static void runMoonPhase(AnimationParams p, uint32_t t);

    // Standard Modes
    static void runTideGauge(AnimationParams p, uint32_t t);
    static void runSunlightRefraction(AnimationParams p, uint32_t t);
    static void runAuroraHorizon(AnimationParams p, uint32_t t);
    static void runTideBreathing(AnimationParams p, uint32_t t);
    static void runBioluminescence(AnimationParams p, uint32_t t);
    static void runStormAlert(AnimationParams p, uint32_t t);
    static void runThermalDepth(AnimationParams p, uint32_t t);

    // Helpers
    static CRGBPalette16 getTidePalette(float tide);
};

#endif
`;

export const generateWs2812bAnimationsCpp = () => `
#include "ws2812b_animations.h"
#include "config.h"

WS2812BController* WS2812BAnimations::_ctrl = nullptr;
FluidEngine WS2812BAnimations::_fluid;
bool WS2812BAnimations::_fluidInit = false;

void WS2812BAnimations::attachController(WS2812BController* controller) {
    _ctrl = controller;
}

// 🎨 PALETTE GENERATOR (V2.5)
CRGBPalette16 WS2812BAnimations::getTidePalette(float tide) {
    if (tide < 0.25) {
        // Low Tide: Sand, Teal, Light Blue
        return CRGBPalette16(CRGB(194, 178, 128), CRGB(0, 128, 128), CRGB(100, 200, 200), CRGB(0, 50, 50));
    } else if (tide > 0.75) {
        // High Tide: Deep Blue, Navy, Cyan highlight
        return CRGBPalette16(CRGB(0, 0, 50), CRGB(0, 0, 150), CRGB(0, 100, 200), CRGB(200, 255, 255));
    } else {
        // Mid Tide: Standard Ocean
        return OceanColors_p;
    }
}

void WS2812BAnimations::run(String mode, float tideLevel, int trend, float windSpeed, int humidity) {
    if (!_ctrl) return;
    
    if (!_fluidInit) {
        _fluid.begin(_ctrl->getNumLeds(), 0.025, 0.02, 0.1);
        _fluidInit = true;
    }

    WS2812BConfig& cfg = WS2812BConfigManager::config;

    AnimationParams p;
    p.speed = cfg.speed;
    p.intensity = cfg.intensity;
    p.tideLevel = tideLevel;
    p.trend = trend;
    p.windSpeed = cfg.linkWeather ? windSpeed : 10;
    p.moonPhase = cfg.linkMoon ? humidity : 50; // Map humidity slot to moon if enabled
    p.useWeather = cfg.linkWeather;
    p.palette = getTidePalette(tideLevel);

    uint32_t t = millis();

    // Mapping new modes
    if (mode == "tideStripBasic") runStripBasic(p, t);
    else if (mode == "matrixBeach") runMatrixBeach(p, t);
    else if (mode == "matrixFluid") runMatrixFluid(p, t);
    else if (mode == "moonPhase") runMoonPhase(p, t);
    
    else if (mode == "fluidPhysics") runTideGauge(p, t);
    else if (mode == "oceanCaustics") runSunlightRefraction(p, t);
    else if (mode == "aurora") runAuroraHorizon(p, t);
    else if (mode == "deepBreath") runTideBreathing(p, t);
    else if (mode == "bio") runBioluminescence(p, t);
    else if (mode == "storm") runStormAlert(p, t);
    else if (mode == "thermal") runThermalDepth(p, t);
    else runStripBasic(p, t); 

    _ctrl->show();
}

// 1. STRIP BASIC (Tira Vertical Clássica)
void WS2812BAnimations::runStripBasic(AnimationParams p, uint32_t t) {
    int count = _ctrl->getNumLeds();
    int waterLevel = (int)(p.tideLevel * count);
    
    // Base speed factor
    float t_sec = t / 600.0f;
    
    for (int i = 0; i < count; i++) {
        if (i < waterLevel) {
            // Ripple Formula: sin((i * 0.25) + t * (trend > 0 ? 1.0 : -1.0))
            float wave = sin((i * 0.25f) + t_sec * (p.trend >= 0 ? 1.0f : -1.0f));
            uint8_t brightness = 150 + (wave * 80.0f); // dynamic brightness
            _ctrl->setPixel(i, CHSV(160, 255, brightness)); // Aqua
        } else {
            _ctrl->setPixel(i, CRGB::Black);
        }
    }
    // Surface Highlight
    if (waterLevel > 0 && waterLevel < count) {
        _ctrl->setPixel(waterLevel - 1, CHSV(180, 200, 255)); // Bright Cyan Line
    }
}

// 2. MATRIX BEACH (Praia Lateral)
void WS2812BAnimations::runMatrixBeach(AnimationParams p, uint32_t t) {
    int w = _ctrl->getWidth();
    int h = _ctrl->getHeight();
    int waterRows = (int)(p.tideLevel * h);
    
    for (int y = 0; y < h; y++) {
        for (int x = 0; x < w; x++) {
            // Y=0 is bottom
            if (y < waterRows) {
                // Horizontal Wave moving
                float wave = sin((x * 0.4f) + t / 300.0f);
                uint8_t b = 160 + (wave * 60);
                _ctrl->setPixelXY(x, y, CHSV(160, 255, b));
            } else {
                _ctrl->setPixelXY(x, y, CHSV(40, 100, 80)); // Sand Gold
            }
        }
    }
}

// 3. MATRIX FLUID (Barra Vertical Premium)
void WS2812BAnimations::runMatrixFluid(AnimationParams p, uint32_t t) {
    int w = _ctrl->getWidth();
    int h = _ctrl->getHeight();
    
    // Directional Offset for flow
    float waveOffset = (t / 400.0f) * (p.trend >= 0 ? 1.0f : -1.0f);
    
    for (int x = 0; x < w; x++) {
        // Physical height per column with wave variation
        float localH = (p.tideLevel * h) + sin(x * 0.5f + waveOffset) * 1.5f;
        int limit = constrain((int)localH, 0, h);
        
        for (int y = 0; y < h; y++) {
            if (y < limit) {
                 // Water Body
                 _ctrl->setPixelXY(x, y, CHSV(160, 255, 200));
            } else {
                 _ctrl->setPixelXY(x, y, CRGB::Black);
            }
        }
    }
}

// 4. MOON PHASE RING (Anel Lunar)
void WS2812BAnimations::runMoonPhase(AnimationParams p, uint32_t t) {
    int count = _ctrl->getNumLeds();
    
    // Background: Deep space
    for(int i=0; i<count; i++) {
        // Random star twinkle
        if (random8() > 250) _ctrl->setPixel(i, CRGB(10, 10, 15));
        else _ctrl->setPixel(i, CRGB(0, 0, 3));
    }
    
    // Lit Portion (Arc) based on Illumination % (0-100)
    int litCount = (p.moonPhase * count) / 100;
    if (litCount < 1) litCount = 0;
    if (litCount > count) litCount = count;
    
    // Center of the arc (Top of Ring = Index 0 usually, or defined by layout)
    int startIdx = (count / 2) - (litCount / 2); 
    
    for(int i=0; i<litCount; i++) {
        int idx = (startIdx + i);
        // Normalize wrap around
        while(idx < 0) idx += count;
        while(idx >= count) idx -= count;
        
        // Edge dimming for 3D effect
        uint8_t dim = 255;
        int distFromCenter = abs(i - (litCount/2));
        if (distFromCenter > (litCount/2) * 0.7) {
            dim = map(distFromCenter, (litCount/2)*0.7, litCount/2, 255, 50);
        }
        
        CRGB moonColor = CRGB(255, 245, 220); // Warm White
        moonColor.nscale8(dim);
        
        _ctrl->setPixel(idx, moonColor);
    }
}

// 📊 MODE: TIDE GAUGE (Standard) + FLOW TEXTURE
void WS2812BAnimations::runTideGauge(AnimationParams p, uint32_t t) {
    int h = _ctrl->getHeight();
    int w = _ctrl->getWidth();
    float waterHeight = p.tideLevel * h;

    _fluid.updateParams(0.025, 0.02, 0.1);
    
    if (random8() < p.windSpeed) {
         int rNode = random(h);
         if (abs(rNode - waterHeight) < 3) _fluid.disturb(rNode, (random(100)-50)/40.0f);
    }
    
    _fluid.setTargetHeight(p.tideLevel);
    _fluid.update();

    // Determine Flow Direction Texture
    uint16_t flowOffset = 0;
    if (p.trend > 0) flowOffset = -(t / 40); 
    else if (p.trend < 0) flowOffset = (t / 40);

    for(int y=0; y<h; y++) {
        float disp = _fluid.getNodeHeight(y);
        float surfaceY = waterHeight + (disp * 5.0); 
        bool isWater = y <= surfaceY;
        
        CRGB color = CRGB::Black;
        
        if (isWater) {
             float depth = (float)y / h; 
             color = ColorFromPalette(p.palette, depth * 255);
             if (p.trend != 0) {
                 uint8_t flow = sin8((y * 15) + flowOffset);
                 color += CRGB(0, flow/6, flow/5);
             }
             if (abs(y - surfaceY) < 1.0) color += CRGB(50, 50, 70);
        }

        FoamParticle* parts = _fluid.getParticles();
        for(int i=0; i<30; i++) {
             if (parts[i].life > 0 && abs(parts[i].pos - y) < 0.8) {
                 color += CRGB(parts[i].life * 150, parts[i].life * 150, parts[i].life * 180);
             }
        }
        for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, color);
    }
}

void WS2812BAnimations::runSunlightRefraction(AnimationParams p, uint32_t t) {
    int h = _ctrl->getHeight();
    int w = _ctrl->getWidth();
    uint32_t speed = t * (p.speed * 8);
    for(int y=0; y<h; y++) {
        uint8_t wave1 = sin8((y * 10) + (speed / 3));
        uint8_t wave2 = sin8((y * 23) - (speed / 2));
        uint8_t wave3 = sin8((y * 15) + speed);
        uint8_t bright = (wave1 + wave2 + wave3) / 3;
        bright = qsub8(bright, 40); 
        bright = qadd8(bright, 80);
        CRGB color = ColorFromPalette(p.palette, bright);
        if (p.trend > 0 && y % 5 == 0) color += CRGB(20,20,20);
        float lvl = p.tideLevel * h;
        if (y > lvl) color.nscale8(10); 
        for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, color);
    }
}

void WS2812BAnimations::runTideBreathing(AnimationParams p, uint32_t t) {
    int h = _ctrl->getHeight();
    int w = _ctrl->getWidth();
    float bpm = 10.0 + (p.tideLevel * 20.0); 
    if (p.trend > 0) bpm += 10;
    uint8_t beat = beatsin8(bpm, 50, 255);
    int fillLevel = p.tideLevel * h;
    for(int y=0; y<h; y++) {
        if (y <= fillLevel) {
            CRGB color = ColorFromPalette(p.palette, y * (255/h));
            color.nscale8(beat);
            for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, color);
        } else {
            for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, CRGB::Black);
        }
    }
}

void WS2812BAnimations::runBioluminescence(AnimationParams p, uint32_t t) {
    int h = _ctrl->getHeight();
    int w = _ctrl->getWidth();
    int fillLevel = p.tideLevel * h;
    if (random8() < p.windSpeed) {
        int rNode = random(h);
        if (rNode < fillLevel) _fluid.spawnFoam(rNode, 1.0);
    }
    _fluid.update();
    for (int y = 0; y < h; y++) {
        if (y <= fillLevel) {
             CRGB color = CRGB(0, 5, 15); 
             FoamParticle* parts = _fluid.getParticles();
             for(int i=0; i<30; i++) {
                if (parts[i].life > 0 && abs(parts[i].pos - y) < 1.0) {
                    uint8_t br = parts[i].life * 255;
                    color += CRGB(0, br, br/2); 
                }
             }
             if (p.trend > 0 && y < 5) color += CRGB(0, 20, 10);
             for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, color);
        } else {
             for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, CRGB::Black);
        }
    }
}

void WS2812BAnimations::runAuroraHorizon(AnimationParams p, uint32_t t) {
    int h = _ctrl->getHeight();
    int w = _ctrl->getWidth();
    int surfaceY = p.tideLevel * h;
    for(int y=0; y<h; y++) {
         int dist = abs(y - surfaceY);
         if (dist < 8) {
             uint8_t hue = (t / 20) + (y * 10);
             CRGB color = CHSV(hue, 200, 255);
             uint8_t fade = 255 - (dist * 30);
             color.nscale8(fade);
             for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, color);
         } else if (y < surfaceY) {
             for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, CRGB(0,0,30));
         } else {
             for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, CRGB::Black);
         }
    }
}

void WS2812BAnimations::runStormAlert(AnimationParams p, uint32_t t) {
    int h = _ctrl->getHeight();
    int w = _ctrl->getWidth();
    int fillLevel = p.tideLevel * h;
    for(int y=0; y<h; y++) {
        if (y <= fillLevel) {
            uint8_t noise = inoise8(y*20, t/5);
            CRGB c = CRGB(noise/2, noise/4, noise/4); 
            if (p.tideLevel > 0.9) {
                uint8_t pulse = beatsin8(60);
                c += CRGB(pulse/4, 0, 0);
            }
            for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, c);
        } else {
             for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, CRGB::Black);
        }
    }
    if (random16() < 50) {
        int flashY = random(h);
        for(int x=0; x<w; x++) _ctrl->setPixelXY(x, flashY, CRGB::White);
    }
}

void WS2812BAnimations::runThermalDepth(AnimationParams p, uint32_t t) {
    int h = _ctrl->getHeight();
    int w = _ctrl->getWidth();
    int fillLevel = p.tideLevel * h;
    for(int y=0; y<h; y++) {
         if (y <= fillLevel) {
             float relativeDepth = (float)y / fillLevel; 
             uint8_t hue = 160 - (relativeDepth * 160);
             CRGB c = CHSV(hue, 255, 255);
             for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, c);
         } else {
             for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, CRGB::Black);
         }
    }
}
`;
