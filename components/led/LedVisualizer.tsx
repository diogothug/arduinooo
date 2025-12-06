
import React, { useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store';
import { FirmwareConfig } from '../../types';

interface LedVisualizerProps {
    simMode: boolean;
    simParams: any;
    stripDirection: 'HORIZONTAL' | 'VERTICAL';
}

// Helper: Interpolate Colors
const interpolateColor = (color1: string, color2: string, factor: number) => {
    if (factor > 1) factor = 1; if (factor < 0) factor = 0;
    const r1 = parseInt(color1.substring(1, 3), 16);
    const g1 = parseInt(color1.substring(3, 5), 16);
    const b1 = parseInt(color1.substring(5, 7), 16);
    const r2 = parseInt(color2.substring(1, 3), 16);
    const g2 = parseInt(color2.substring(3, 5), 16);
    const b2 = parseInt(color2.substring(5, 7), 16);
    const r = Math.round(r1 + factor * (r2 - r1));
    const g = Math.round(g1 + factor * (g2 - g1));
    const b = Math.round(b1 + factor * (b2 - b1));
    return `rgb(${r},${g},${b})`;
};

// Helper: Hex to RGB Object
const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
};

export const LedVisualizer: React.FC<LedVisualizerProps> = ({ simMode, simParams, stripDirection }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { firmwareConfig, keyframes, simulatedTime, weatherData } = useAppStore();

    // REF PATTERN: Keep latest config in ref to avoid re-running useEffect loop on every slider change
    const configRef = useRef(firmwareConfig);
    const dataRef = useRef({ keyframes, simulatedTime, weatherData, simMode, simParams });

    useEffect(() => { configRef.current = firmwareConfig; }, [firmwareConfig]);
    useEffect(() => { dataRef.current = { keyframes, simulatedTime, weatherData, simMode, simParams }; }, [keyframes, simulatedTime, weatherData, simMode, simParams]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false }); // Optimize
        if (!ctx) return;

        let animId: number;
        
        // Simulation State for Particles
        const particles: any[] = [];
        let lastTime = Date.now();

        const render = () => {
            const now = Date.now();
            const delta = (now - lastTime) / 1000;
            lastTime = now;

            const cfg = configRef.current;
            const data = dataRef.current;
            const w = canvas.width; 
            const h = canvas.height;
            const cx = w / 2;
            const cy = h / 2;

            // 1. Determine Environment Variables
            let tide = 50, wind = 0, hum = 0, night = false;

            if (data.simMode) {
                tide = data.simParams.tide; 
                wind = data.simParams.wind; 
                hum = data.simParams.humidity; 
                night = data.simParams.isNight;
            } else {
                const cycle = cfg.cycleDuration || 24;
                let t = data.simulatedTime % cycle;
                if (data.keyframes.length > 1) {
                    let s = data.keyframes[0], e = data.keyframes[data.keyframes.length-1];
                    for(let i=0; i<data.keyframes.length-1; i++) {
                        if (t >= data.keyframes[i].timeOffset && t <= data.keyframes[i+1].timeOffset) { 
                            s = data.keyframes[i]; 
                            e = data.keyframes[i+1]; 
                            break; 
                        }
                    }
                    let dur = e.timeOffset - s.timeOffset; 
                    if (dur < 0) dur += cycle;
                    const prog = dur === 0 ? 0 : (t - s.timeOffset) / dur;
                    // Linear interpolation for tide height
                    tide = s.height + (e.height - s.height) * (prog < 0 ? prog + 1 : prog);
                }
                wind = data.weatherData.windSpeed; 
                hum = data.weatherData.humidity;
                const tod = data.simulatedTime % 24;
                const { startHour, endHour, enabled } = cfg.nightMode;
                if (enabled) {
                    night = startHour > endHour ? (tod >= startHour || tod < endHour) : (tod >= startHour && tod < endHour);
                }
            }

            // 2. Generate LED Coordinates (Recalc if layout changed)
            // Ideally we memoize this, but for < 1000 LEDs it's fast enough to do per frame or check changed
            const layout = cfg.ledLayoutType;
            const count = cfg.ledCount;
            const leds = [];
            
            if (layout === 'STRIP') {
                const margin = 40; 
                const availableW = w - margin * 2;
                const sp = availableW / (count - 1 || 1);
                for(let i=0; i<count; i++) {
                    leds.push({
                        x: stripDirection === 'HORIZONTAL' ? margin + i * sp : cx, 
                        y: stripDirection === 'HORIZONTAL' ? cy : h - margin - i * ((h - margin * 2) / (count - 1 || 1)), 
                        i
                    });
                }
            } else if (layout === 'MATRIX') {
                const mw = cfg.ledMatrixWidth || 10;
                const mh = cfg.ledMatrixHeight || Math.ceil(count / mw);
                const cell = Math.min((w - 60) / mw, (h - 60) / mh);
                const sx = (w - cell * mw) / 2 + cell / 2;
                const sy = (h - cell * mh) / 2 + cell / 2;
                for(let i=0; i<count; i++) {
                    let r = Math.floor(i / mw); 
                    let c = i % mw;
                    if (cfg.ledSerpentine && r % 2 !== 0) c = (mw - 1) - c;
                    leds.push({x: sx + c * cell, y: sy + r * cell, i, r, c, maxR: mh, maxC: mw});
                }
            } else if (layout === 'RING') {
                const r = Math.min(w, h) * 0.35;
                for(let i=0; i<count; i++) {
                    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
                    leds.push({x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, i});
                }
            } else if (layout === 'SPIRAL') {
                const turns = cfg.ledSpiralTurns || 3;
                const maxR = Math.min(w, h) * 0.4;
                for(let i=0; i<count; i++) {
                    const prog = i / count;
                    const r = prog * maxR;
                    const a = prog * Math.PI * 2 * turns - Math.PI / 2;
                    leds.push({x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, i});
                }
            } else {
                 // Mountain / Custom fallback
                 const margin = 40; const sp = (w - margin * 2) / (count - 1 || 1);
                 for(let i=0; i<count; i++) {
                     // Simple sine wave for mountain
                     const x = margin + i * sp;
                     const y = cy + Math.sin(i * 0.5) * 50;
                     leds.push({x, y, i});
                 }
            }

            // 3. Clear Canvas
            ctx.fillStyle = '#0f172a'; // Slate-900
            ctx.fillRect(0, 0, w, h);

            // 4. Render Logic (Based on Preset)
            const mode = cfg.animationMode;
            const speed = cfg.animationSpeed; 
            const intensity = cfg.animationIntensity;
            const colors = (cfg.customColors && cfg.customColors.length > 0) ? cfg.customColors : ['#000044', '#ffffff'];

            leds.forEach((led) => {
                let r=0, g=0, b=0;
                
                // --- PRESET LOGIC ---
                
                if (mode === 'tideFill2' || mode === 'coralReef') {
                    // Vertical fill logic
                    let normalizedY = 0; // 0.0 (bottom) to 1.0 (top)
                    
                    if (layout === 'MATRIX') {
                        // Matrix uses Row/Col
                         normalizedY = 1.0 - (led.r / (led.maxR || 1));
                    } else if (layout === 'STRIP' && stripDirection === 'VERTICAL') {
                         normalizedY = led.i / count;
                    } else {
                         // Default strip linear map
                         normalizedY = led.i / count;
                    }

                    const tideLevel = tide / 100.0;
                    
                    // Water Logic
                    if (normalizedY <= tideLevel) {
                         // Underwater
                         if (mode === 'coralReef') {
                             // Coral Logic
                             if (normalizedY < 0.2) { r=139; g=90; b=43; } // Rock/Sand bottom
                             else {
                                 // Water Gradient
                                 const depth = (tideLevel - normalizedY) / tideLevel; // 0 surface, 1 bottom
                                 if (depth < 0.2) { r=90; g=200; b=250; } // Surface Light Blue
                                 else { r=0; g=119; b=190; } // Deep Blue
                             }
                             // Random Coral
                             if (normalizedY < 0.3 && (led.i * 13) % 7 === 0) { r=255; g=107; b=107; }
                         } else {
                             // TideFill2 Logic (Simple Gradient)
                             const idx = normalizedY / tideLevel; 
                             // Map to first 2 colors of palette usually
                             const c1 = hexToRgb(colors[0]);
                             const c2 = hexToRgb(colors[1] || colors[0]);
                             r = c1.r + (c2.r - c1.r) * idx;
                             g = c1.g + (c2.g - c1.g) * idx;
                             b = c1.b + (c2.b - c1.b) * idx;
                             
                             // Ripple at top
                             if (tideLevel - normalizedY < 0.05) {
                                 const wave = Math.sin(led.x * 0.1 + now * 0.005 * speed);
                                 if (wave > 0.5) { r+=40; g+=40; b+=40; }
                             }
                         }
                    } else {
                        // Air (Off or Dim)
                        r=0; g=0; b=0;
                    }

                } else if (mode === 'neon') {
                    // Rainbow Cycle
                    const hue = (now * 0.1 * speed + led.i * 5) % 360;
                    // Simple HSV to RGB
                    const s = 1, v = 1 * intensity;
                    const c = v * s;
                    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
                    const m = v - c;
                    let r1=0, g1=0, b1=0;
                    if (hue < 60) { r1=c; g1=x; b1=0; }
                    else if (hue < 120) { r1=x; g1=c; b1=0; }
                    else if (hue < 180) { r1=0; g1=c; b1=x; }
                    else if (hue < 240) { r1=0; g1=x; b1=c; }
                    else if (hue < 300) { r1=x; g1=0; b1=c; }
                    else { r1=c; g1=0; b1=x; }
                    r = (r1 + m) * 255; g = (g1 + m) * 255; b = (b1 + m) * 255;

                } else if (mode === 'storm') {
                    // Dark base + Flashes
                    r=10; g=10; b=20; // Dark grey/blue base
                    // Noise for clouds
                    const noise = Math.sin(led.x * 0.05 + now * 0.002 * speed) + Math.sin(led.y * 0.05 + now * 0.003);
                    if (noise > 1) { r+=20; g+=20; b+=30; }

                    // Lightning
                    if (Math.random() < 0.005 * intensity * speed) {
                         // Global flash (simple sim)
                         // In real visualizer we'd persist flash state, but random flickering works for preview
                         r=255; g=255; b=255;
                    }

                } else if (mode === 'aurora') {
                    // Sine wave interference
                    const x = led.x * 0.1;
                    const y = led.y * 0.1;
                    const t = now * 0.001 * speed;
                    
                    const v1 = Math.sin(x * 0.5 + t);
                    const v2 = Math.sin(y * 0.3 - t * 0.5);
                    const v3 = Math.sin((x + y) * 0.2 + t);
                    
                    const val = (v1 + v2 + v3) / 3; // -1 to 1
                    
                    // Map -1..1 to Green/Purple colors
                    // Green: #00ff00, Purple: #aa00ff
                    const f = (val + 1) / 2; // 0 to 1
                    r = 10 + f * 100;
                    g = 20 + (1 - f) * 200;
                    b = 20 + f * 200;
                    
                } else if (mode === 'deepSea') {
                    // Dim Blue background
                    r=0; g=10; b=40;
                    
                    // Particles (Simulated roughly by noise here for stateless preview)
                    // Real particles need state, but noise works for "glimmer"
                    const glimmer = Math.sin(led.x * 0.3 + led.y * 0.3 + now * 0.002);
                    if (glimmer > 0.95) {
                        r=50; g=100; b=150;
                    }

                } else {
                    // DEFAULT: Ocean Caustics / Gradient Fallback
                    // Interpolate based on index/tide
                    const stops = colors.length - 1;
                    // Use Tide to shift gradient or scale it
                    const phase = (led.i / count) + (now * 0.0001 * speed);
                    const cyclePhase = phase % 1;
                    
                    // Map cyclePhase 0..1 to colors
                    const pos = cyclePhase * stops;
                    const idx = Math.floor(pos);
                    const f = pos - idx;
                    
                    const c1 = colors[idx % colors.length];
                    const c2 = colors[(idx + 1) % colors.length];
                    
                    const rgb = interpolateColor(c1, c2, f);
                    const parsed = rgb.match(/\d+/g)?.map(Number) || [0,0,0];
                    r=parsed[0]; g=parsed[1]; b=parsed[2];
                    
                    // Add Caustic Noise
                    const noise = Math.sin(led.x * 0.1 + now * 0.005) * Math.cos(led.y * 0.1 - now * 0.002);
                    if (noise > 0.5) {
                        r += 30; g += 30; b += 30;
                    }
                }

                // Apply Intensity & Night Mode
                let globalBright = intensity;
                if (night) globalBright *= 0.5;

                r *= globalBright;
                g *= globalBright;
                b *= globalBright;
                
                // Clamp
                r = Math.min(255, Math.max(0, r));
                g = Math.min(255, Math.max(0, g));
                b = Math.min(255, Math.max(0, b));

                // Draw LED
                ctx.beginPath();
                const radius = layout === 'MATRIX' ? Math.min(w, h) / (cfg.ledMatrixWidth||10) / 2.5 : 6;
                ctx.arc(led.x, led.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fill();

                // Glow Effect
                const grad = ctx.createRadialGradient(led.x, led.y, radius, led.x, led.y, radius * 3);
                grad.addColorStop(0, `rgba(${r},${g},${b},0.3)`);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(led.x, led.y, radius * 3, 0, Math.PI * 2);
                ctx.fill();
            });

            animId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animId);
    }, [stripDirection]); // Only re-bind if props change, refs handle store updates

    return (
        <div className="bg-slate-950 border border-slate-800 rounded-lg flex flex-col overflow-hidden relative h-full shadow-inner">
             <div className="absolute top-4 right-4 z-10 flex flex-col items-end pointer-events-none gap-1">
                <div className="text-[10px] font-bold text-slate-400 bg-slate-900/80 px-2 py-1 rounded border border-slate-700">
                    {firmwareConfig.ledLayoutType} • {firmwareConfig.ledCount} LEDS
                </div>
                {simMode && (
                    <div className="text-[10px] font-bold text-green-400 bg-green-900/20 border border-green-500/50 px-2 py-1 rounded animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.2)]">
                        SIMULATION ACTIVE
                    </div>
                )}
                 <div className="text-[10px] font-bold text-cyan-400 bg-cyan-900/20 border border-cyan-500/50 px-2 py-1 rounded">
                     PRESET: {firmwareConfig.animationMode.toUpperCase()}
                 </div>
            </div>
            
            {/* Grid Background for Matrix */}
            {firmwareConfig.ledLayoutType === 'MATRIX' && (
                <div className="absolute inset-0 z-0 opacity-10" 
                     style={{backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)', backgroundSize: '20px 20px'}}>
                </div>
            )}

            <canvas ref={canvasRef} width={800} height={600} className="w-full h-full object-contain relative z-1" />
        </div>
    );
};
