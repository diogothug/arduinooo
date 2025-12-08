
import { DisplayWidget, WidgetType, DisplayConfig } from '../../types';

export const generateDisplayManagerH = () => `
#ifndef DISPLAY_MANAGER_H
#define DISPLAY_MANAGER_H

#include <TFT_eSPI.h> 
#include <SPI.h>

class DisplayManager {
public:
    void begin();
    void update(float tideHeightPct);
    void showSplashScreen();
    void setBrightness(uint8_t val);
    void toggle();
    void incBrightness();
    void setWeatherData(float temp, int humidity, float windSpeed, int windDir);

private:
    TFT_eSPI tft = TFT_eSPI(); 
    TFT_eSprite spr = TFT_eSprite(&tft); // Use Sprite for flicker-free updates
    
    // Primitives
    void drawWidget(int type, int x, int y, float scale, uint32_t color, String label, String valueSrc, float thickness, float rotation);
    
    // Helpers
    uint32_t hexTo565(String hex);
    String getValueString(String src);
    float getValueNum(String src);
    
    // Data Store
    float _tide = 50.0;
    float _temp = 25.0;
    int _humidity = 60;
    float _windSpeed = 0;
    int _windDir = 0;
    bool _isOn = true;
    uint8_t _brightness = 200;
};

#endif
`;

export const generateDisplayManagerCpp = (widgets: DisplayWidget[], config: DisplayConfig) => {
    
    const widgetLoop = widgets.map(w => {
         let typeCode = 0;
         if (w.type === WidgetType.ARC_GAUGE) typeCode = 10;
         if (w.type === WidgetType.RADIAL_COMPASS) typeCode = 20;
         if (w.type === WidgetType.GRAPH_LINE) typeCode = 30;
         if (w.type === WidgetType.RAIN_CHART) typeCode = 35; // NEW
         if (w.type === WidgetType.DIGITAL_CLOCK) typeCode = 40;
         if (w.type === WidgetType.ANALOG_CLOCK) typeCode = 41;
         if (w.type === WidgetType.TEXT_VALUE) typeCode = 50;
         if (w.type === WidgetType.TEXT_SIMPLE) typeCode = 51;
         if (w.type === WidgetType.ICON_WEATHER) typeCode = 60;
         if (w.type === WidgetType.GRID_BACKGROUND) typeCode = 90;
         if (w.type === WidgetType.RING_OUTER) typeCode = 91;

         const label = w.label || "";
         const src = w.valueSource || "NONE";
         return `    drawWidget(${typeCode}, ${w.x}, ${w.y}, ${w.scale}f, hexTo565("${w.color}"), "${label}", "${src}", ${w.thickness||1}f, ${w.rotation||0}f);`;
    }).join('\n');

    return `
#include "DisplayManager.h"
#include "Arduino.h"

// Native ESP32 LEDC PWM settings
#define BACKLIGHT_PWM_FREQ 5000
#define BACKLIGHT_PWM_RES  8
#define BACKLIGHT_PWM_CHAN 0

void DisplayManager::begin() {
    tft.init();
    tft.setRotation(0); 
    tft.fillScreen(TFT_BLACK);
    
    // Setup LEDC for Native Hardware Dimming (Flicker Free)
    // NOTE: ESP32 Arduino 3.x has different ledc API. Using compatible approach.
    #ifdef ESP_ARDUINO_VERSION_MAJOR
      #if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
        ledcAttach(TFT_BL, BACKLIGHT_PWM_FREQ, BACKLIGHT_PWM_RES);
      #else
        ledcSetup(BACKLIGHT_PWM_CHAN, BACKLIGHT_PWM_FREQ, BACKLIGHT_PWM_RES);
        ledcAttachPin(TFT_BL, BACKLIGHT_PWM_CHAN);
      #endif
    #endif
    
    // Allocate Sprite (Full screen or partial if memory limited)
    // For 240x240, full sprite requires ~115KB RAM. ESP32 usually has enough.
    spr.createSprite(240, 240);
}

void DisplayManager::setBrightness(uint8_t val) {
    _brightness = val;
    if(!_isOn) {
        #if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
        ledcWrite(TFT_BL, 0);
        #else
        ledcWrite(BACKLIGHT_PWM_CHAN, 0);
        #endif
        return;
    }
    
    // Native Hardware PWM Write
    #if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
    ledcWrite(TFT_BL, val);
    #else
    ledcWrite(BACKLIGHT_PWM_CHAN, val);
    #endif
}

void DisplayManager::toggle() {
    _isOn = !_isOn;
    setBrightness(_brightness);
}

void DisplayManager::incBrightness() {
    int b = _brightness + 50;
    if (b > 255) b = 50;
    setBrightness(b);
}

void DisplayManager::setWeatherData(float temp, int humidity, float windSpeed, int windDir) {
    _temp = temp;
    _humidity = humidity;
    _windSpeed = windSpeed;
    _windDir = windDir;
}

void DisplayManager::update(float tideHeightPct) {
    if (!_isOn) return;

    _tide = tideHeightPct;
    
    // Clear Background
    spr.fillSprite(TFT_BLACK); // Or theme background color
    
${widgetLoop}
    
    // Push Sprite to Screen
    spr.pushSprite(0, 0);
}

void DisplayManager::drawWidget(int type, int x, int y, float scale, uint32_t color, String label, String valueSrc, float thickness, float rotation) {
    
    float val = getValueNum(valueSrc);
    String txt = getValueString(valueSrc);
    if (valueSrc == "NONE" && label != "") txt = label;

    switch(type) {
        case 10: // ARC_GAUGE
        {
            // Center is x,y. Radius approx 40*scale.
            int r = 40 * scale;
            // Draw Background Track (Dark Gray)
            spr.drawSmoothArc(x, y, r, r - thickness, 45, 315, 0x3333, 0x0000);
            
            // Draw Active Arc
            if (val > 0) {
               // Map 0-100 to 45-315 degrees
               // TFT_eSPI arcs are 0 at top? Check specific implementation usually 0 is right.
               // Assuming standard: 135 to 405 range for gauge
               int endAngle = 45 + (val/100.0 * 270);
               spr.drawSmoothArc(x, y, r, r - thickness, 45, endAngle, color, 0x0000);
            }
            // Value Text
            spr.setTextColor(color, TFT_BLACK);
            spr.setTextDatum(MC_DATUM);
            spr.drawString(String((int)val), x, y);
            break;
        }
        case 20: // RADIAL_COMPASS (Wind)
        {
             // Draw Arrow rotated by val (degrees)
             // Need vector math or sprite rotation
             break;
        }
        case 30: // GRAPH_LINE
        {
             // Draw Box
             spr.drawRect(x - 30*scale, y - 15*scale, 60*scale, 30*scale, color);
             // Mock Sine for now
             break;
        }
        case 35: // RAIN_CHART (New)
        {
             // Mock Logic for Template - In real C++, this would read from WeatherManager
             // Draw simple histogram
             int w = 60 * scale; 
             int h = 30 * scale;
             int bars = 8;
             int bw = (w / bars) - 2;
             
             for(int i=0; i<bars; i++) {
                 // Simulate data or read static array
                 int h_bar = random(0, h);
                 spr.fillRect((x - w/2) + i*(bw+2), (y + h/2) - h_bar, bw, h_bar, color);
             }
             if (label != "") {
                 spr.setTextColor(color, TFT_BLACK);
                 spr.setTextDatum(TR_DATUM); // Top Right relative to anchor? 
                 spr.drawString(label, x + w/2, y - h/2 - 10);
             }
             break;
        }
        case 40: // DIGITAL_CLOCK
        {
             spr.setTextColor(color, TFT_BLACK);
             spr.setTextDatum(MC_DATUM);
             spr.setTextSize(2 * scale);
             spr.drawString(txt, x, y);
             spr.setTextSize(1);
             break;
        }
        case 50: // TEXT_VALUE
        {
             spr.setTextColor(color, TFT_BLACK);
             spr.setTextDatum(MC_DATUM);
             spr.setTextSize(2 * scale);
             spr.drawString(txt, x, y);
             if (label != "") {
                 spr.setTextSize(1);
                 spr.setTextColor(TFT_SILVER, TFT_BLACK);
                 spr.drawString(label, x, y + 20*scale);
             }
             break;
        }
        case 90: // GRID
        {
             spr.drawCircle(120, 120, 80, 0x2222);
             spr.drawLine(120, 0, 120, 240, 0x2222);
             spr.drawLine(0, 120, 240, 120, 0x2222);
             break;
        }
    }
}

String DisplayManager::getValueString(String src) {
    if (src == "TIDE") return String((int)_tide) + "%";
    if (src == "TEMP") return String((int)_temp) + "C";
    if (src == "HUM") return String(_humidity) + "%";
    if (src == "WIND") return String((int)_windSpeed);
    // Time handled by local RTC in C++ usually
    return "";
}

float DisplayManager::getValueNum(String src) {
    if (src == "TIDE") return _tide;
    if (src == "TEMP") return _temp;
    if (src == "HUM") return (float)_humidity;
    if (src == "WIND") return _windSpeed;
    if (src == "WIND_DIR") return (float)_windDir;
    return 0;
}

uint32_t DisplayManager::hexTo565(String hex) {
    long rgb = strtol(hex.c_str() + 1, NULL, 16);
    return tft.color565((rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF);
}

void DisplayManager::showSplashScreen() {
    tft.fillScreen(TFT_BLACK);
    tft.setTextColor(TFT_CYAN, TFT_BLACK);
    tft.drawCentreString("TideFlux", 120, 100, 4);
}
`;
};
