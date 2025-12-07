








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
    
    // Physics Engine Params
    float tension;
    float damping;
    float spread;
    
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
    const fluid = config.fluidParams || { tension: 0.025, damping: 0.02, spread: 0.1 };

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
    ${fluid.tension.toFixed(3)}f,
    ${fluid.damping.toFixed(3)}f,
    ${fluid.spread.toFixed(2)}f,
    "${config.animationMode || 'fluidPhysics'}", 
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
    
    if (json.containsKey("tension")) config.tension = json["tension"];
    if (json.containsKey("damping")) config.damping = json["damping"];
    if (json.containsKey("spread")) config.spread = json["spread"];
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
#include "../../FluidEngine.h" // Import 1D Wave Physics

// --- LAYER 3: ANIMATION LOGIC ---
// Includes Fluid Physics, PBR Shading, and Particle Systems

struct AnimationParams {
    float speed;        // 0.1 to 5.0
    float intensity;    // 0.0 to 1.0
    CRGBPalette16 palette;
    float tideLevel;    // 0.0 to 1.0 (Normalized)
    
    // Adaptive Physical Params
    float meterPos(int pixelIndex) {
        return (float)pixelIndex / (float)WS2812BConfigManager::config.ledDensity;
    }
};

class WS2812BAnimations {
public:
    static void attachController(WS2812BController* controller);
    
    // Main Dispatcher
    static void run(String mode, float tideLevel, float windSpeed = 0, int humidity = 0);
    
    // --- PREMIUM ENGINES (Physics + PBR) ---
    static void runFluidPhysics(AnimationParams p, uint32_t t, float wind);
    static void runBioluminescence(AnimationParams p, uint32_t t);
    static void runThermalDrift(AnimationParams p, uint32_t t, int temp);
    
    // --- LEGACY/STANDARD MODES ---
    static void oceanCaustics(AnimationParams p, uint32_t t);
    static void tideWaveVertical(AnimationParams p, uint32_t t);
    
    static CRGBPalette16 getPremiumPalette(float tideLevel, bool isNight, bool isStorm);
    static float _previousTideLevel;

private:
    static WS2812BController* _ctrl;
    static FluidEngine _fluid; // Persistent physics state
    static bool _fluidInit;
};

#endif
`;

export const generateWs2812bAnimationsCpp = () => `
#include "ws2812b_animations.h"
#include "config.h"

WS2812BController* WS2812BAnimations::_ctrl = nullptr;
FluidEngine WS2812BAnimations::_fluid;
bool WS2812BAnimations::_fluidInit = false;
float WS2812BAnimations::_previousTideLevel = 0.5f;

void WS2812BAnimations::attachController(WS2812BController* controller) {
    _ctrl = controller;
}

// 🎨 DYNAMIC PALETTES "EMOTION-BASED"
CRGBPalette16 WS2812BAnimations::getPremiumPalette(float tideLevel, bool isNight, bool isStorm) {
    if (isStorm) {
        // Storm: Greys, Electric Blues, Deep Purples
        return CRGBPalette16(CRGB(10,10,20), CRGB(30,30,50), CRGB(100,100,120), CRGB(0,0,255));
    }
    if (isNight) {
        // Bioluminescent Night: Deep Blue to Neon Cyan
        return CRGBPalette16(CRGB(0,0,30), CRGB(0,0,80), CRGB(0,40,100), CRGB(0,255,200));
    }
    if (tideLevel < 0.2) {
        // Low Tide: Amber, Turquoise (Sand & Shallow Water)
        return CRGBPalette16(CRGB(200,150,50), CRGB(0,180,180), CRGB(0,100,150), CRGB(0,50,100));
    }
    // Standard Ocean
    return OceanColors_p; 
}

void WS2812BAnimations::run(String mode, float tideLevel, float windSpeed, int humidity) {
    if (!_ctrl) return;
    
    // Init Fluid Engine if needed
    if (!_fluidInit) {
        _fluid.begin(
            _ctrl->getNumLeds(), 
            WS2812BConfigManager::config.tension, 
            WS2812BConfigManager::config.damping, 
            WS2812BConfigManager::config.spread
        );
        _fluidInit = true;
    }

    // Dynamic Palette Selection based on Env
    bool isNight = false; // TODO: Pass real time
    bool isStorm = (windSpeed > 30);
    CRGBPalette16 pal = getPremiumPalette(tideLevel, isNight, isStorm);

    AnimationParams p;
    p.speed = WS2812BConfigManager::config.speed;
    p.intensity = WS2812BConfigManager::config.intensity;
    p.palette = pal;
    p.tideLevel = tideLevel;

    // --- PHYSICS PARAMETERS ---
    // User configuration is primary, wind speed adds "impulses" via disturb()
    
    _fluid.updateParams(WS2812BConfigManager::config.tension, WS2812BConfigManager::config.damping, WS2812BConfigManager::config.spread);

    uint32_t t = millis();

    // Mode Dispatch
    if (mode == "fluidPhysics") runFluidPhysics(p, t, windSpeed);
    else if (mode == "bio") runBioluminescence(p, t);
    else if (mode == "thermal") runThermalDrift(p, t, 25); // Pass temp
    else if (mode == "oceanCaustics") oceanCaustics(p, t);
    else tideWaveVertical(p, t); // Fallback

    _previousTideLevel = tideLevel;
    _ctrl->show();
}

// 🌊 PREMIUM: 1D FLUID SOLVER + PBR SHADING
void WS2812BAnimations::runFluidPhysics(AnimationParams p, uint32_t t, float wind) {
    int h = _ctrl->getHeight();
    int w = _ctrl->getWidth();
    int waterHeight = p.tideLevel * h;

    // 1. Inject Energy (Wind/Turbulence)
    if (random8() < (wind * 2)) { // More wind = more random disturbances
        int rNode = random(h);
        if (abs(rNode - waterHeight) < 5) { // Surface disturbance
             _fluid.disturb(rNode, (random(100)-50)/50.0f);
        }
    }
    
    // 2. Update Physics
    _fluid.update();

    // 4. Render
    for (int y = 0; y < h; y++) {
        // Physical displacement from simulation
        float displacement = _fluid.getNodeHeight(y); 
        float velocity = _fluid.getNodeVelocity(y);
        
        // Base "Water" calculation
        // The simulation treats 0 as rest. 
        // We map Y coordinate relative to WaterHeight + Displacement
        float effectiveHeight = waterHeight + (displacement * 10.0); // Amplify simulation
        
        bool isWater = y < effectiveHeight;
        
        if (isWater) {
            // --- PBR SHADING FAKE ---
            // Depth attenuation
            float depth = (effectiveHeight - y) / (float)h;
            
            // 1. Base Color (Deep to Shallow)
            uint8_t palIdx = map(depth * 255, 0, 255, 0, 240);
            CRGB color = ColorFromPalette(p.palette, palIdx);
            
            // 2. Specular Highlight (Velocity based glint)
            // High velocity = glistening surface
            if (abs(velocity) > 0.05) {
                uint8_t spec = abs(velocity) * 500; 
                if (spec > 255) spec = 255;
                color += CRGB(spec, spec, spec);
            }
            
            // 3. Sub-surface scattering (Fake)
            // If near surface, add light bleeding
            if (depth < 0.1) {
                color += CRGB(20, 40, 50);
            }
            
            color.nscale8(p.intensity * 255);
            
            // Matrix Expansion
            for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, color);
            
        } else {
            // Air / Foam Particles
            CRGB color = CRGB::Black;
            
            // Check particles
            // Simple check: iterate particles (inefficient O(N) but N=50 is fine)
            FoamParticle* parts = _fluid.getParticles();
            for(int i=0; i<50; i++) {
                if (parts[i].life > 0 && abs(parts[i].pos - y) < 0.5) {
                    uint8_t b = parts[i].life * 255;
                    color += CRGB(b,b,b);
                }
            }
             for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, color);
        }
    }
}

// 🦠 PREMIUM: BIOLUMINESCENCE
void WS2812BAnimations::runBioluminescence(AnimationParams p, uint32_t t) {
    // Similar to fluid, but impact causes blue flash
    _fluid.update();
    int h = _ctrl->getHeight();
    int w = _ctrl->getWidth();
    int waterHeight = p.tideLevel * h;

    // Random Impact
    if (random8() < 5) {
        int rNode = random(h);
        if (rNode < waterHeight) {
            _fluid.spawnFoam(rNode, 1.0); // Reuse particle system for bio-flash
        }
    }

    for (int y = 0; y < h; y++) {
        if (y < waterHeight) {
             CRGB base = CRGB(0, 5, 10); // Very dark water
             
             // Check Bio-particles
             FoamParticle* parts = _fluid.getParticles();
             for(int i=0; i<50; i++) {
                if (parts[i].life > 0 && abs(parts[i].pos - y) < 1.5) {
                    uint8_t b = parts[i].life * 255;
                    // Neon Blue/Green flash
                    base += CRGB(0, b, b/2); 
                }
             }
             for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, base);
        } else {
             for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, CRGB::Black);
        }
    }
}

// 🔥 PREMIUM: THERMAL DRIFT
void WS2812BAnimations::runThermalDrift(AnimationParams p, uint32_t t, int temp) {
    // Map Temperature to Color Temperature
    // Hot -> Red/Orange, Fast turbulence
    // Cold -> Blue/Cyan, Slow crystal movement
    
    // Determine target color based on Temp
    CRGB targetC = (temp > 30) ? CRGB(255, 50, 0) : CRGB(0, 100, 255);
    
    int h = _ctrl->getHeight();
    int w = _ctrl->getWidth();
    
    float noiseScale = (temp > 25) ? 0.3 : 0.05; // Hot = noisy
    float speed = (temp > 25) ? 2.0 : 0.5;
    
    for (int y = 0; y < h; y++) {
         uint8_t noise = inoise8(y * 30, t * speed);
         CRGB c = targetC;
         c.nscale8(noise);
         
         // Heat shimmer at top
         if (temp > 30 && y > h*0.8) {
             if (random8() > 200) c += CRGB(50,50,0);
         }
         
         for(int x=0; x<w; x++) _ctrl->setPixelXY(x, y, c);
    }
}

// ... Legacy functions (OceanCaustics, TideWaveVertical) remain as fallbacks ...
void WS2812BAnimations::oceanCaustics(AnimationParams p, uint32_t t) {
    // (Existing Implementation)
    int w = _ctrl->getWidth();
    int h = _ctrl->getHeight();
    for(int x=0; x<w; x++) {
        for(int y=0; y<h; y++) {
             uint8_t noise = inoise8(x*20, y*20 + t/2, t/3);
             CRGB color = ColorFromPalette(p.palette, noise, 255 * p.intensity);
             _ctrl->setPixelXY(x, y, color);
        }
    }
}

void WS2812BAnimations::tideWaveVertical(AnimationParams p, uint32_t t) {
     // (Existing Implementation)
}
`;