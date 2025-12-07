

import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../../store';

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
        const ctx = canvas.getContext('2d', { alpha: false }); 
        if (!ctx) return;

        let animId: number;
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
            let isRising = true;

            if (data.simMode) {
                tide = data.simParams.tide; 
                wind = data.simParams.wind; 
                hum = data.simParams.humidity; 
                night = data.simParams.isNight;
                isRising = data.simParams.tideDirection === 'RISING';
            } else {
                const cycle = cfg.cycleDuration || 24;
                let t = data.simulatedTime % cycle;
                let currentH = 50;
                let nextH = 50;

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
                    currentH = s.height + (e.height - s.height) * (prog < 0 ? prog + 1 : prog);
                    
                    // Simple prediction for direction: Compare current with slightly future time
                    const futureT = (t + 0.1) % cycle;
                    let nextProg = prog + (0.1 / dur);
                    if(nextProg > 1) nextProg = 1; 
                    nextH = s.height + (e.height - s.height) * nextProg;
                    isRising = nextH > currentH;
                    tide = currentH;
                }
                wind = data.weatherData.windSpeed; 
                hum = data.weatherData.humidity;
                const tod = data.simulatedTime % 24;
                const { startHour, endHour, enabled } = cfg.nightMode;
                if (enabled) {
                    night = startHour > endHour ? (tod >= startHour || tod < endHour) : (tod >= startHour && tod < endHour);
                }
            }

            // 2. Generate LED Coordinates
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
                 const margin = 40; const sp = (w - margin * 2) / (count - 1 || 1);
                 for(let i=0; i<count; i++) {
                     const x = margin + i * sp;
                     const y = cy + Math.sin(i * 0.5) * 50;
                     leds.push({x, y, i});
                 }
            }

            // 3. Clear Canvas
            ctx.fillStyle = '#0f172a'; // Slate-900
            ctx.fillRect(0, 0, w, h);

            // 4. Render Logic
            const mode = cfg.animationMode;
            const speed = cfg.animationSpeed; 
            const intensity = cfg.animationIntensity;
            const colors = (cfg.customColors && cfg.customColors.length > 0) ? cfg.customColors : ['#000044', '#ffffff'];

            leds.forEach((led) => {
                let r=0, g=0, b=0;
                
                if (mode === 'tideWaveVertical') {
                    // NEW ANIMATION: Wave moves UP if rising, DOWN if falling
                    let normalizedY = 0;
                    if (layout === 'MATRIX') {
                         normalizedY = 1.0 - (led.r / (led.maxR || 1));
                    } else {
                         normalizedY = led.i / count;
                    }
                    const tideLevel = tide / 100.0;
                    
                    if (normalizedY <= tideLevel) {
                        // Depth Gradient (Deep Blue to Light Cyan)
                        // Deep at 0, Light at tideLevel
                        const relativeDepth = normalizedY / (tideLevel || 0.001); // 0.0(bot) -> 1.0(surf)
                        
                        // Internal Wave Logic
                        // Direction multiplier: +1 for Up (Rising), -1 for Down (Falling)
                        const dirMult = isRising ? 1 : -1;
                        const waveSpeed = speed * 2.0;
                        
                        // Wave calculation
                        // y * 10 creates the spatial wave frequency
                        // now * speed * dir creates the movement
                        const wave = Math.sin(normalizedY * 15 - (now * 0.005 * waveSpeed * dirMult));
                        
                        // Color Mixing
                        // Base: Dark Blue (0, 0, 100) -> Surface: Cyan (0, 255, 255)
                        // Modulated by wave
                        
                        // Deep color
                        const r1=0, g1=10, b1=80; 
                        // Surface color
                        const r2=0, g2=150, b2=220;
                        
                        // Mix factor based on depth + wave
                        let mix = relativeDepth + (wave * 0.1); 
                        if (mix > 1) mix = 1; if (mix < 0) mix = 0;
                        
                        r = r1 + (r2-r1)*mix;
                        g = g1 + (g2-g1)*mix;
                        b = b1 + (b2-b1)*mix;
                        
                        // Add foam/sparkle at the very surface
                        if (relativeDepth > 0.95) {
                             // Foam logic
                             const foam = Math.sin(led.x * 0.2 + now * 0.01);
                             if (foam > 0) { r+=40; g+=40; b+=40; }
                        }
                    } else {
                        r=0; g=0; b=0;
                    }

                } else if (mode === 'tideFill2' || mode === 'coralReef') {
                    let normalizedY = 0;
                    if (layout === 'MATRIX') {
                         normalizedY = 1.0 - (led.r / (led.maxR || 1));
                    } else {
                         normalizedY = led.i / count;
                    }

                    const tideLevel = tide / 100.0;
                    
                    if (tideLevel >= 0) {
                        if (normalizedY <= tideLevel) {
                             if (mode === 'coralReef') {
                                 if (normalizedY < 0.2) { r=139; g=90; b=43; } 
                                 else {
                                     const depth = (tideLevel - normalizedY) / tideLevel;
                                     if (depth < 0.2) { r=90; g=200; b=250; } else { r=0; g=119; b=190; }
                                 }
                                 if (normalizedY < 0.3 && (led.i * 13) % 7 === 0) { r=255; g=107; b=107; }
                             } else {
                                 const idx = normalizedY / (tideLevel || 1); 
                                 const c1 = hexToRgb(colors[0]);
                                 const c2 = hexToRgb(colors[1] || colors[0]);
                                 r = c1.r + (c2.r - c1.r) * idx;
                                 g = c1.g + (c2.g - c1.g) * idx;
                                 b = c1.b + (c2.b - c1.b) * idx;
                             }
                        } else {
                            r=0; g=0; b=0;
                        }
                    } else {
                        const exposedHeight = Math.abs(tideLevel);
                        if (normalizedY <= exposedHeight) {
                            r=101; g=67; b=33; 
                            if ((led.i % 3) === 0) { r+=20; g+=20; b+=10; }
                        } else {
                            r=0; g=0; b=0;
                        }
                    }

                } else if (mode === 'neon') {
                    const hue = (now * 0.1 * speed + led.i * 5) % 360;
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
                    r=10; g=10; b=20; 
                    const noise = Math.sin(led.x * 0.05 + now * 0.002 * speed) + Math.sin(led.y * 0.05 + now * 0.003);
                    if (noise > 1) { r+=20; g+=20; b+=30; }
                    if (Math.random() < 0.005 * intensity * speed) { r=255; g=255; b=255; }
                } else if (mode === 'aurora') {
                    const x = led.x * 0.1; const y = led.y * 0.1; const t = now * 0.001 * speed;
                    const v1 = Math.sin(x * 0.5 + t); const v2 = Math.sin(y * 0.3 - t * 0.5); const v3 = Math.sin((x + y) * 0.2 + t);
                    const val = (v1 + v2 + v3) / 3; 
                    const f = (val + 1) / 2; 
                    r = 10 + f * 100; g = 20 + (1 - f) * 200; b = 20 + f * 200;
                } else if (mode === 'deepSea') {
                    r=0; g=10; b=40;
                    const glimmer = Math.sin(led.x * 0.3 + led.y * 0.3 + now * 0.002);
                    if (glimmer > 0.95) { r=50; g=100; b=150; }
                } else {
                    const stops = colors.length - 1;
                    const phase = (led.i / count) + (now * 0.0001 * speed);
                    const cyclePhase = phase % 1;
                    const pos = cyclePhase * stops;
                    const idx = Math.floor(pos);
                    const f = pos - idx;
                    const c1 = colors[idx % colors.length];
                    const c2 = colors[(idx + 1) % colors.length];
                    const rgb = interpolateColor(c1, c2, f);
                    const parsed = rgb.match(/\d+/g)?.map(Number) || [0,0,0];
                    r=parsed[0]; g=parsed[1]; b=parsed[2];
                    const noise = Math.sin(led.x * 0.1 + now * 0.005) * Math.cos(led.y * 0.1 - now * 0.002);
                    if (noise > 0.5) { r += 30; g += 30; b += 30; }
                }

                let globalBright = intensity;
                if (night) globalBright *= 0.5;
                r *= globalBright; g *= globalBright; b *= globalBright;
                r = Math.min(255, Math.max(0, r)); g = Math.min(255, Math.max(0, g)); b = Math.min(255, Math.max(0, b));

                ctx.beginPath();
                const radius = layout === 'MATRIX' ? Math.min(w, h) / (cfg.ledMatrixWidth||10) / 2.5 : 6;
                ctx.arc(led.x, led.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fill();

                const grad = ctx.createRadialGradient(led.x, led.y, radius, led.x, led.y, radius * 3);
                grad.addColorStop(0, `rgba(${r},${g},${b},0.3)`);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(led.x, led.y, radius * 3, 0, Math.PI * 2); ctx.fill();
            });

            animId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animId);
    }, [stripDirection]); 

    return (
        <div className="bg-slate-950 border border-slate-800 rounded-lg flex flex-col overflow-hidden relative h-[500px] shadow-inner">
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
            
            {firmwareConfig.ledLayoutType === 'MATRIX' && (
                <div className="absolute inset-0 z-0 opacity-10" 
                     style={{backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)', backgroundSize: '20px 20px'}}>
                </div>
            )}

            <canvas ref={canvasRef} width={800} height={600} className="w-full h-full object-contain relative z-1" />
        </div>
    );
};
