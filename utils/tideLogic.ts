import { Keyframe } from '../types';

export const generateSevenDayForecast = (baseKeyframes: Keyframe[]): Keyframe[] => {
    // 1. Sort base frames (assuming they are within 0-24h)
    const sortedBase = [...baseKeyframes].sort((a, b) => a.timeOffset - b.timeOffset);
    if (sortedBase.length === 0) return [];

    const result: Keyframe[] = [];
    const LUNAR_SHIFT_PER_DAY = 0.84; // ~50.4 minutes shift per day

    for (let day = 0; day < 7; day++) {
        const dayShift = day * LUNAR_SHIFT_PER_DAY;
        
        sortedBase.forEach(kf => {
            // Calculate new time: original time + daily shift + (24h * day)
            let newTime = kf.timeOffset + dayShift + (day * 24.0);
            
            // Note: In a real lunar cycle, the amplitude also varies (spring/neap tides).
            // For this offline simulator, we keep height constant or could apply a simple Sin wave to amplitude.
            // Let's add a slight variation to height to make it look organic (Spring/Neap simulation)
            // 7 days is roughly 1/4 of a lunar cycle (29 days).
            // Amplitude factor goes from 1.0 to 0.8 or 1.2.
            const amplitudeFactor = 1.0 + (Math.sin((day / 7.0) * Math.PI) * 0.15); 
            
            let newHeight = kf.height * amplitudeFactor;
            if (newHeight > 100) newHeight = 100;
            if (newHeight < 0) newHeight = 0;

            result.push({
                ...kf,
                id: `${kf.id}_d${day}`,
                timeOffset: parseFloat(newTime.toFixed(2)),
                height: parseFloat(newHeight.toFixed(1)),
            });
        });
    }
    
    // Final Sort
    return result.sort((a, b) => a.timeOffset - b.timeOffset);
};