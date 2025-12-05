
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

private:
    std::vector<TideKeyframe> _keyframes;
    float _simulatedHours;
    float _cycleDuration;
    unsigned long _lastMillis;
    float _currentHeight;
    
    // Day Min/Max tracking
    uint8_t _dayMaxHeight;
    uint8_t _dayMinHeight;
    void recalculateMaxMin();
};

#endif
`;

export const generateMareEngineCpp = (keyframes: Keyframe[]) => {
    const initFrames = keyframes.map(k => 
        `    _keyframes.push_back({${k.timeOffset}f, ${k.height}, 0x${k.color.replace('#', '')}, ${k.intensity}, ${(k.effect === 'STATIC' ? 0 : k.effect === 'WAVE' ? 1 : k.effect === 'PULSE' ? 2 : 3)}});`
    ).join('\n');

    return `
#include "MareEngine.h"

MareEngine::MareEngine() 
    : _simulatedHours(0.0f), 
      _cycleDuration(DEFAULT_CYCLE_DURATION),
      _lastMillis(0), 
      _currentHeight(50.0f),
      _dayMaxHeight(0), _dayMinHeight(100)
{
    // Initial Default Config
${initFrames}
    recalculateMaxMin();
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
    if (currentMillis - _lastMillis > 100) {
        _simulatedHours += 0.01; 
        if (_simulatedHours >= _cycleDuration) _simulatedHours = 0.0f;
        _lastMillis = currentMillis;
    }

    if (_keyframes.size() < 2) return;

    // 2. Interpolation Logic
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
        start = _keyframes.back();
        end = _keyframes.front();
    }

    float duration = end.timeOffset - start.timeOffset;
    if (end.timeOffset < start.timeOffset) {
        duration = (_cycleDuration - start.timeOffset) + end.timeOffset;
    }

    float currentOffset = _simulatedHours - start.timeOffset;
    if (currentOffset < 0) currentOffset += _cycleDuration;
    
    float progress = (duration > 0.001f) ? (currentOffset / duration) : 0;
    if (progress > 1.0f) progress = 1.0f;
    
    // Height Calculation
    _currentHeight = start.height + (end.height - start.height) * progress;
}

void MareEngine::setKeyframes(std::vector<TideKeyframe> frames) {
    _keyframes = frames;
    recalculateMaxMin();
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
`;
};
