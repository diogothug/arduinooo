
import { DisplayWidget, DisplayConfig, WidgetType } from '../../types';

export const generateDisplayManagerH = () => `
#ifndef DISPLAY_MANAGER_H
#define DISPLAY_MANAGER_H

#include <TFT_eSPI.h> // Hardware-specific library
#include <SPI.h>

class DisplayManager {
public:
    void begin();
    void update(float tideHeightPct);
    void showSplashScreen();
    void setBrightness(uint8_t val);
    void setWeatherData(float temp, int humidity, float windSpeed, int windDir);

private:
    TFT_eSPI tft = TFT_eSPI(); 
    void drawTideGauge(float pct, uint32_t color);
    void drawTideFill(float pct, uint32_t color);
    void drawWindVector(float speed, int angle, uint32_t color);
    void drawWidget(int type, int x, int y, float scale, uint32_t color, String label);
    
    uint32_t hexTo565(String hex);
    
    // Stored Weather Data
    float _temp = 25.0;
    int _humidity = 60;
    float _windSpeed = 0;
    int _windDir = 0;
};

#endif
`;

export const generateDisplayManagerCpp = (widgets: DisplayWidget[], config: DisplayConfig) => {
    // Generate static C++ widget loop
    const widgetLoop = widgets.map(w => {
         let typeCode = 0; // Default
         if (w.type === WidgetType.TIDE_GAUGE) typeCode = 1;
         if (w.type === WidgetType.CLOCK_DIGITAL) typeCode = 2;
         if (w.type === WidgetType.TEXT_LABEL) typeCode = 3;
         if (w.type === WidgetType.TIDE_RADAR) typeCode = 4;
         if (w.type === WidgetType.MOON_PHASE) typeCode = 5;
         if (w.type === WidgetType.TIDE_FILL) typeCode = 6;
         if (w.type === WidgetType.TIDE_RING) typeCode = 7;
         if (w.type === WidgetType.WIND_VECTOR) typeCode = 8;
         if (w.type === WidgetType.WEATHER_TEMP_TEXT) typeCode = 9;
         if (w.type === WidgetType.WEATHER_HUMIDITY_TEXT) typeCode = 10;
         if (w.type === WidgetType.WEATHER_WIND_TEXT) typeCode = 11;
         if (w.type === WidgetType.WEATHER_CONDITION_TEXT) typeCode = 12;
         
         const label = w.label || "";
         return `    drawWidget(${typeCode}, ${w.x}, ${w.y}, ${w.scale}f, hexTo565("${w.color}"), "${label}");`;
    }).join('\n');

    return `
#include "DisplayManager.h"
#include "Arduino.h"

void DisplayManager::begin() {
    tft.init();
    tft.setRotation(0); 
    tft.fillScreen(TFT_BLACK);
}

void DisplayManager::setBrightness(uint8_t val) {
    // Note: Use analogWrite on BLK pin if configured
}

void DisplayManager::setWeatherData(float temp, int humidity, float windSpeed, int windDir) {
    _temp = temp;
    _humidity = humidity;
    _windSpeed = windSpeed;
    _windDir = windDir;
}

void DisplayManager::showSplashScreen() {
    tft.fillScreen(TFT_BLACK);
    tft.setTextSize(2);
    tft.setTextColor(TFT_CYAN);
    tft.drawCentreString("TideFlux", 120, 100, 4);
    tft.setTextSize(1);
    tft.setTextColor(TFT_WHITE);
    tft.drawCentreString("GC9A01 V2.1", 120, 140, 2);
}

void DisplayManager::update(float tideHeightPct) {
    tft.startWrite(); // Transaction begin
    
    // Clear handled by overwrite or use Sprites for performance
    // For simplicity in template, we might flicker or should use sprites
    // tft.fillScreen(TFT_BLACK); 
    
    // In real partial update, we only redraw changed regions.
    // Here we iterate configured widgets.
${widgetLoop}
    
    tft.endWrite(); // Transaction end
}

void DisplayManager::drawWidget(int type, int x, int y, float scale, uint32_t color, String label) {
    String finalLabel = label;
    finalLabel.replace("%VAL%", String((int)50)); // Placeholder for tide pct
    finalLabel.replace("%TEMP%", String((int)_temp) + "C");

    if (type == 1) { // Tide Gauge
       // Logic to draw arc or fill...
    } else if (type == 3) { // Text
       tft.setTextColor(color, TFT_BLACK);
       tft.drawCentreString(finalLabel, x, y, 4);
    } else if (type == 6) {
       drawTideFill(50, color); // Example
    } else if (type == 8) {
       drawWindVector(_windSpeed, _windDir, color);
    } 
    // --- New Granular Weather Types ---
    else if (type == 9) { // TEMP
       tft.setTextColor(color, TFT_BLACK);
       String t = String((int)_temp) + "C";
       tft.drawCentreString(t, x, y, 4);
    }
    else if (type == 10) { // HUMIDITY
       tft.setTextColor(color, TFT_BLACK);
       String h = String(_humidity) + "%";
       tft.drawCentreString(h, x, y, 4);
    }
    else if (type == 11) { // WIND TEXT
       tft.setTextColor(color, TFT_BLACK);
       String w = String((int)_windSpeed) + "km/h";
       tft.drawCentreString(w, x, y, 2);
    }
}

void DisplayManager::drawTideFill(float pct, uint32_t color) {
    // Placeholder for sine wave fill logic
}

void DisplayManager::drawWindVector(float speed, int angle, uint32_t color) {
    // Basic arrow logic
    // Calculate rotation coordinates based on angle
    // Draw Triangle
}

uint32_t DisplayManager::hexTo565(String hex) {
    long rgb = strtol(hex.c_str() + 1, NULL, 16);
    return tft.color565((rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF);
}
`;
}
