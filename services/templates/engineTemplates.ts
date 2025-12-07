
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
    bool isFallbackMode();

private:
    std::vector<TideKeyframe> _keyframes;
    float _simulatedHours;
    float _cycleDuration;
    unsigned long _lastMillis;
    float _currentHeight;
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
    // Note: We use the keyframes passed merely to init the JS logic if needed, 
    // but the actual Hardcoded fallback is now in config.h
    return `
#include "MareEngine.h"

MareEngine::MareEngine() 
    : _simulatedHours(0.0f), 
      _cycleDuration(DEFAULT_CYCLE_DURATION),
      _lastMillis(0), 
      _currentHeight(50.0f),
      _dayMaxHeight(0), _dayMinHeight(100),
      _usingSyntheticMode(false)
{
    // Try to load fallback from config.h immediately on boot
    loadHardcodedFallback();
}

void MareEngine::loadHardcodedFallback() {
    // Load from CONFIG.H FALLBACK_FRAMES
    if (FALLBACK_FRAME_COUNT > 0) {
        _keyframes.clear();
        for(int i=0; i<FALLBACK_FRAME_COUNT; i++) {
            TideKeyframeConfig k = FALLBACK_FRAMES[i];
            _keyframes.push_back({k.timeOffset, k.height, k.color, k.intensity, k.effect});
        }
        recalculateMaxMin();
        Serial.printf("[MareEngine] Loaded %d hardcoded fallback frames.\\n", FALLBACK_FRAME_COUNT);
    } else {
        Serial.println("[MareEngine] No hardcoded frames found. Switch to Synthetic.");
        _usingSyntheticMode = true;
    }
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

void MareEngine::update() {
    // 1. Time Update
    unsigned long currentMillis = millis();
    if (currentMillis - _lastMillis > 100) { // 10 ticks per second simulation speed
        // In simulation mode or simple daily cycle, we increment hours.
        // In Realtime mode with NTP, this logic would differ (using struct tm).
        // For this robust firmware, we assume 'uptime' driven cycle if no NTP.
        
        _simulatedHours += 0.01; 
        
        // Handle Cycle Wrap or Extension
        if (_simulatedHours >= _cycleDuration) {
             // If we are in "Daily Cycle" mode (e.g. 24h), we wrap.
             // If we are in "Prediction" mode (e.g. 7 days), and we pass the end...
             if (_cycleDuration <= 25.0f) {
                 _simulatedHours = 0.0f; // Wrap 24h
             } else {
                 // We passed the end of our data!
                 Serial.println("[MareEngine] Data expired! Switching to Algorithmic Fallback.");
                 _usingSyntheticMode = true;
             }
        }
        _lastMillis = currentMillis;
    }

    // LAYER 3: ALGORITHMIC FALLBACK
    if (_usingSyntheticMode || _keyframes.size() < 2) {
        _currentHeight = calculateSyntheticTide(_simulatedHours);
        return;
    }

    // LAYER 2: INTERPOLATION (Hardcoded or API data)
    TideKeyframe start = _keyframes.front();
    TideKeyframe end = _keyframes.back();
    bool found = false;

    for (size_t i = 0; i < _keyframes.size() - 1; i++) {
        if (_simulatedHours >= _keyframes[i].timeOffset && _simulatedHours <= _keyframes[i+1].timeOffset) {
            start = _keyframes[i];
            end = _keyframes[i+1];
            found = true;
            break;
        }
    }

    if (!found && _keyframes.size() > 0) {
        // If we didn't find a segment but we are wrapping (e.g. end to start)
        start = _keyframes.back();
        end = _keyframes.front();
    }

    float duration = end.timeOffset - start.timeOffset;
    if (end.timeOffset < start.timeOffset) {
        // Wrap around case
        duration = (_cycleDuration - start.timeOffset) + end.timeOffset;
    }

    float currentOffset = _simulatedHours - start.timeOffset;
    if (currentOffset < 0) currentOffset += _cycleDuration;
    
    float progress = (duration > 0.001f) ? (currentOffset / duration) : 0;
    if (progress > 1.0f) progress = 1.0f;
    
    // Linear Interpolation
    _currentHeight = start.height + (end.height - start.height) * progress;
}

// M2 Constituent Approximation (Lunar Semidiurnal)
// Period ~12.42 hours.
// This ensures that even if all data is lost, the tide map still "breathes" 
// with the ocean's rhythm.
float MareEngine::calculateSyntheticTide(float t) {
    // 50% base level
    // 45% amplitude (swings 5% to 95%)
    // Period 12.42h
    // 2 * PI * t / 12.42
    float val = 50.0f + 45.0f * cos(2.0f * PI * t / 12.42f);
    return val;
}

void MareEngine::setKeyframes(std::vector<TideKeyframe> frames) {
    if (frames.size() > 0) {
        _keyframes = frames;
        _usingSyntheticMode = false;
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

bool MareEngine::isFallbackMode() {
    return _usingSyntheticMode;
}
`;
};
