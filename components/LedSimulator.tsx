
import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { EffectType, Keyframe } from '../types';

const interpolate = (start: number, end: number, progress: number) => start + (end - start) * progress;

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

export const LedSimulator: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { keyframes, simulatedTime, firmwareConfig } = useAppStore();
  const numLeds = firmwareConfig.ledCount || 60;

  // Calculate Max/Min statistics
  const tideStats = React.useMemo(() => {
    if (keyframes.length === 0) return { dayMax: 0, dayMin: 0, histMax: 0, histMin: 0 };
    
    // For this simulation, we'll treat the visible keyframes as the "History"
    // and the current 24h cycle window as the "Day".
    
    // Historical (Global)
    let histMax = 0;
    let histMin = 100;
    keyframes.forEach(k => {
      if (k.height > histMax) histMax = k.height;
      if (k.height < histMin) histMin = k.height;
    });

    // Daily (Current 24h window)
    const currentDayStart = Math.floor(simulatedTime / 24) * 24;
    const currentDayEnd = currentDayStart + 24;
    
    let dayMax = 0;
    let dayMin = 100;
    
    // Filter frames relevant to current day cycle (simple approximation for simulation)
    // In a real scenario, this would check timestamps. 
    // Here we use the base keyframes as the daily cycle template.
    keyframes.forEach(k => {
        // Assuming keyframes array represents the active cycle (whether 24h or 7d)
        // If 7d, we check frames within current day window.
        if (firmwareConfig.cycleDuration > 24) {
             if (k.timeOffset >= currentDayStart && k.timeOffset < currentDayEnd) {
                 if (k.height > dayMax) dayMax = k.height;
                 if (k.height < dayMin) dayMin = k.height;
             }
        } else {
             // 24h mode
             if (k.height > dayMax) dayMax = k.height;
             if (k.height < dayMin) dayMin = k.height;
        }
    });

    // Fallback if no frames in window (shouldn't happen with interpolated data)
    if (dayMax === 0 && dayMin === 100) { dayMax = histMax; dayMin = histMin; }

    return { dayMax, dayMin, histMax, histMin };
  }, [keyframes, simulatedTime, firmwareConfig.cycleDuration]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      // Clear
      ctx.fillStyle = '#111827'; // Dark background
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // --- 1. State Calculation ---
      let currentHeight = 0;
      let currentColor = { r: 0, g: 0, b: 255 };
      let currentEffect = EffectType.STATIC;

      if (keyframes.length >= 2) {
        let start: Keyframe = keyframes[0];
        let end: Keyframe = keyframes[keyframes.length - 1];
        const cycleTime = simulatedTime % firmwareConfig.cycleDuration;

        for (let i = 0; i < keyframes.length - 1; i++) {
          if (cycleTime >= keyframes[i].timeOffset && cycleTime <= keyframes[i + 1].timeOffset) {
            start = keyframes[i];
            end = keyframes[i + 1];
            break;
          }
        }

        const duration = end.timeOffset - start.timeOffset;
        const progress = duration === 0 ? 0 : (cycleTime - start.timeOffset) / duration;

        currentHeight = interpolate(start.height, end.height, progress);
        
        const c1 = hexToRgb(start.color);
        const c2 = hexToRgb(end.color);
        currentColor = {
          r: interpolate(c1.r, c2.r, progress),
          g: interpolate(c1.g, c2.g, progress),
          b: interpolate(c1.b, c2.b, progress),
        };
        currentEffect = start.effect;
      }

      // --- 2. Night Mode Check ---
      let globalBrightness = 1.0;
      const { enabled, startHour, endHour, brightnessFactor } = firmwareConfig.nightMode;
      const t = simulatedTime % 24;
      const isNight = startHour > endHour ? (t >= startHour || t < endHour) : (t >= startHour && t < endHour);
      if (enabled && isNight) globalBrightness = brightnessFactor;

      // --- 3. Draw LEDs ---
      const ledHeight = canvas.height / numLeds;
      const activeLedsCount = Math.floor((currentHeight / 100) * numLeds);
      
      const dayMaxIdx = Math.floor((tideStats.dayMax / 100) * numLeds);
      const dayMinIdx = Math.floor((tideStats.dayMin / 100) * numLeds);
      const histMaxIdx = Math.floor((tideStats.histMax / 100) * numLeds);
      const histMinIdx = Math.floor((tideStats.histMin / 100) * numLeds);

      for (let i = 0; i < numLeds; i++) {
        const y = canvas.height - ((i + 1) * ledHeight);
        
        const isActive = i < activeLedsCount;
        
        // Determine markers
        const isDayMax = i === dayMaxIdx;
        const isDayMin = i === dayMinIdx;
        const isHistMax = i === histMaxIdx;
        const isHistMin = i === histMinIdx;

        let r = currentColor.r, g = currentColor.g, b = currentColor.b;
        let alpha = isActive ? 1 : 0.05;

        // Ghost Marker Logic
        if (!isActive) {
             if (isHistMax || isHistMin) {
                 // Historical Extreme: Purple/Redish
                 r = 255; g = 50; b = 200; 
                 alpha = 0.4;
             } else if (isDayMax || isDayMin) {
                 // Daily Extreme: White
                 r = 255; g = 255; b = 255; 
                 alpha = 0.2;
             }
        }

        // Effect Simulation
        if (isActive) {
          if (currentEffect === EffectType.PULSE) {
             const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
             alpha *= (0.5 + pulse * 0.5);
          } else if (currentEffect === EffectType.WAVE) {
             const wave = (Math.sin(i * 0.5 + Date.now() / 300) + 1) / 2;
             alpha *= (0.7 + wave * 0.3); 
          }
        }
        
        alpha *= globalBrightness;

        // Render Glow
        if (isActive || isHistMax || isDayMax) {
          const grd = ctx.createRadialGradient(
            canvas.width / 2, y + ledHeight / 2, 0,
            canvas.width / 2, y + ledHeight / 2, ledHeight * 2
          );
          grd.addColorStop(0, `rgba(${r},${g},${b}, ${alpha})`);
          grd.addColorStop(1, `rgba(${r},${g},${b}, 0)`);
          ctx.fillStyle = grd;
          ctx.fillRect(0, y - ledHeight, canvas.width, ledHeight * 3);
        }

        // Render LED Core
        ctx.fillStyle = `rgba(${r},${g},${b}, ${Math.max(alpha, 0.05)})`;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, y + ledHeight/2, ledHeight * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Text Labels for Debugging visual
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('HIST MAX', canvas.width - 15, canvas.height - (histMaxIdx * ledHeight));
      ctx.fillText('DAY MAX', canvas.width - 15, canvas.height - (dayMaxIdx * ledHeight) + 10);

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [keyframes, simulatedTime, numLeds, firmwareConfig.nightMode, tideStats]);

  return (
    <div className="bg-black rounded-xl border border-slate-700 shadow-xl overflow-hidden h-full flex flex-col items-center p-4">
      <h3 className="text-slate-400 text-xs font-bold tracking-widest uppercase mb-4">Simulação LED</h3>
      
      <div className="mb-2 flex flex-col gap-1 items-center">
          {firmwareConfig.nightMode.enabled && (
             <span className="text-[10px] text-indigo-400 border border-indigo-900 px-2 rounded">
                 {(() => {
                    const t = simulatedTime % 24;
                    const { startHour, endHour } = firmwareConfig.nightMode;
                    const isNight = startHour > endHour ? (t >= startHour || t < endHour) : (t >= startHour && t < endHour);
                    return isNight ? "Modo Noturno ON" : "Modo Diurno";
                 })()}
             </span>
          )}
          <div className="flex gap-2 text-[9px] text-slate-500">
             <span className="flex items-center gap-1"><div className="w-2 h-2 bg-purple-500 rounded-full"></div> Histórico</span>
             <span className="flex items-center gap-1"><div className="w-2 h-2 bg-white rounded-full"></div> Do Dia</span>
          </div>
      </div>

      <div className="flex-1 w-full max-w-[100px] relative">
         <canvas ref={canvasRef} width={100} height={600} className="w-full h-full object-contain" />
         <div className="absolute inset-0 pointer-events-none border-x-4 border-slate-800 opacity-50"></div>
      </div>
      
      <div className="mt-4 text-center">
        <p className="text-slate-500 text-xs">Nível Atual</p>
        <p className="text-xl font-mono text-cyan-400">
           {Math.round(interpolate(
               keyframes[0]?.height || 0, 
               keyframes[keyframes.length-1]?.height || 0, 
               0.5 // rough approx for display text
           ))}%
        </p>
      </div>
    </div>
  );
};
