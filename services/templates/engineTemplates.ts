

import { Keyframe } from '../../types';

export const generateMareEngineH = () => `
#ifndef MARE_ENGINE_H
#define MARE_ENGINE_H

#include <vector>
#include <Arduino.h>
#include "config.h"

// This engine acts as the "TideDataManager", calculating the normalized tide level
// based on time and keyframes.

struct TideKeyframe {
    float timeOffset;
    uint8_t height;
    uint32_t color;
    uint8_t intensity;
    uint8_t effect; // 0: Static, 1: Wave, 2: Pulse, 3: Glow
};

class MareEngine {
public:
    MareEngine();
    void update();
    void setKeyframes(std::vector<TideKeyframe> frames);
    void setTimeOverride(float hours); 
    void setCycleDuration(float hours);
    float getCurrentHeightPercent(); // 0.0 - 100.0
    float getNormalizedTide();       // 0.0 - 1.0
    int getTideTrend();              // 1 (Rising), -1 (Falling), 0 (Steady)
    bool isFallbackMode();

private:
    std::vector<TideKeyframe> _keyframes;
    float _simulatedHours;
    float _cycleDuration;
    unsigned long _lastMillis;
    float _currentHeight;
    float _prevHeight; 
    int _trend;
    bool _usingSyntheticMode; // If true, using math fallback
    
    // Day Min/Max tracking
    uint8_t _dayMaxHeight;
    uint8_t _dayMinHeight;
    void recalculateMaxMin();
    
    // Robustness
    void loadHardcodedFallback();
    float calculateSyntheticTide(float t);
};

#endif
`;

export const generateMareEngineCpp = (keyframes: Keyframe[]) => {
    return `
#include "MareEngine.h"
#include <algorithm> // Required for std::sort
#include <math.h>    // Required for fmod

#define SIM_SPEED 1.0f             // 1s = 1h simulada
#define TREND_EPS 0.02f            // hysteresis para reduzir flicker
#define SMOOTHING 0.05f            // suavização da altura (5%)

MareEngine::MareEngine() 
    : _simulatedHours(0.0f), 
      _cycleDuration(DEFAULT_CYCLE_DURATION),
      _lastMillis(0), 
      _currentHeight(50.0f),
      _prevHeight(50.0f),
      _trend(0),
      _dayMaxHeight(0), 
      _dayMinHeight(100),
      _usingSyntheticMode(false)
{
    loadHardcodedFallback();
}

void MareEngine::loadHardcodedFallback() {
    if (FALLBACK_FRAME_COUNT > 0) {
        _keyframes.clear();
        for(int i=0; i<FALLBACK_FRAME_COUNT; i++) {
            TideKeyframeConfig k = FALLBACK_FRAMES[i];
            _keyframes.push_back({k.timeOffset, k.height, k.color, k.intensity, k.effect});
        }
        
        // Ordena keyframes por tempo
        std::sort(_keyframes.begin(), _keyframes.end(), 
            [](auto &a, auto &b){ return a.timeOffset < b.timeOffset; });
            
        recalculateMaxMin();
        
        Serial.printf("[MareEngine] Loaded %d fallback frames.\\n", FALLBACK_FRAME_COUNT);
    } else {
        Serial.println("[MareEngine] No fallback. Using synthetic.");
        _usingSyntheticMode = true;
    }
}

void MareEngine::update() {
    unsigned long now = millis();
    
    if (_lastMillis == 0) _lastMillis = now;
    
    // Tempo real suavizado
    // (now - _lastMillis) is ms. *0.001 is seconds.
    // If SIM_SPEED is 1.0, then 1 real second = 1 simulated hour.
    float deltaHours = (now - _lastMillis) * 0.001f * SIM_SPEED;
    _simulatedHours += deltaHours;
    _lastMillis = now;
    
    // Wrap Cycle (Circular)
    if (_simulatedHours >= _cycleDuration) 
        _simulatedHours = fmod(_simulatedHours, _cycleDuration);

    _prevHeight = _currentHeight;

    float rawHeight;

    if (_usingSyntheticMode || _keyframes.size() < 2) {
        rawHeight = calculateSyntheticTide(_simulatedHours);
    } 
    else {
        // Encontra segmento atual
        TideKeyframe start, end;
        bool found = false;

        for (size_t i = 0; i < _keyframes.size(); i++) {
            size_t j = (i + 1) % _keyframes.size();
            float t0 = _keyframes[i].timeOffset;
            float t1 = _keyframes[j].timeOffset;

            // Check if current time is between two keyframes
            // Note: This logic assumes sorted frames and handles non-wrapping segments
            if (_simulatedHours >= t0 && _simulatedHours <= t1) {
                start = _keyframes[i];
                end = _keyframes[j];
                found = true;
                break;
            }
        }

        // Fallback: Segmento de virada (último -> primeiro)
        if (!found) {
            start = _keyframes.back();
            end   = _keyframes.front();
        }

        // Interpolação circular
        float t0 = start.timeOffset;
        float t1 = end.timeOffset;
        
        // Se t1 < t0, significa que virou o ciclo (ex: 23h -> 1h)
        if (t1 < t0) t1 += _cycleDuration;

        // Ajusta tempo atual para relativo ao inicio do segmento
        float T = fmod(_simulatedHours - t0 + _cycleDuration, _cycleDuration);
        float duration = t1 - t0;
        
        float progress = (duration > 0.0001f) ? (T / duration) : 0.0f;
        if (progress > 1.0f) progress = 1.0f;
        
        rawHeight = start.height + (end.height - start.height) * progress;
    }

    // Smoothing Suave (Low Pass Filter)
    _currentHeight = _currentHeight * (1.0f - SMOOTHING) + rawHeight * SMOOTHING;

    // Trend com Hysteresis (Estabilidade)
    float diff = _currentHeight - _prevHeight;
    if (diff > TREND_EPS) _trend = 1;
    else if (diff < -TREND_EPS) _trend = -1;
    else _trend = 0;
}

void MareEngine::setCycleDuration(float hours) {
    if(hours > 0) _cycleDuration = hours;
}

void MareEngine::recalculateMaxMin() {
    _dayMaxHeight = 0;
    _dayMinHeight = 100;
    for (auto &k : _keyframes) {
        if(k.height > _dayMaxHeight) _dayMaxHeight = k.height;
        if(k.height < _dayMinHeight) _dayMinHeight = k.height;
    }
}

// M2 Constituent Approximation (Lunar Semidiurnal)
float MareEngine::calculateSyntheticTide(float t) {
    // 12.42h period typically
    float val = 50.0f + 45.0f * cos(2.0f * PI * t / 12.42f);
    return val;
}

void MareEngine::setKeyframes(std::vector<TideKeyframe> frames) {
    if (frames.size() > 0) {
        _keyframes = frames;
        _usingSyntheticMode = false;
        // Ensure sorted for the interpolation logic
        std::sort(_keyframes.begin(), _keyframes.end(), 
            [](auto &a, auto &b){ return a.timeOffset < b.timeOffset; });
        recalculateMaxMin();
    }
}

void MareEngine::setTimeOverride(float hours) {
    _simulatedHours = hours;
}

float MareEngine::getCurrentHeightPercent() {
    return _currentHeight;
}

float MareEngine::getNormalizedTide() {
    return _currentHeight / 100.0f;
}

int MareEngine::getTideTrend() {
    return _trend;
}

bool MareEngine::isFallbackMode() {
    return _usingSyntheticMode;
}
`;
};