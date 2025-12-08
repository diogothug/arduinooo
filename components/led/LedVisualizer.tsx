

import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../../store';

interface LedVisualizerProps {
    simMode: boolean;
    simParams: any;
}

// Helper: HSV to RGB
function HSVtoRGB(h: number, s: number, v: number) {
    let r = 0, g = 0, b = 0;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return { 
        r: Math.floor(r * 255), 
        g: Math.floor(g * 255), 
        b: Math.floor(b * 255) 
    };
}

// --- JS FLUID SOLVER (1D) v2.5 ---
class FluidEngineJS {
    nodes: number[];
    vels: number[];
    particles: {pos: number, vel: number, life: number}[];
    
    constructor(size: number) {
        this.nodes = new Array(size).fill(0);
        this.vels = new Array(size).fill(0);
        this.particles = [];
        for(let i=0; i<30; i++) this.particles.push({pos:0, vel:0, life:0});
    }

    resize(size: number) {
        if(this.nodes.length !== size) {
            this.nodes = new Array(size).fill(0);
            this.vels = new Array(size).fill(0);
        }
    }

    update(targetLevel: number, tension: number, damping: number) { 
        const size = this.nodes.length;
        
        for(let i=0; i<size; i++) {
            const left = i > 0 ? this.nodes[i-1] : this.nodes[i];
            const right = i < size-1 ? this.nodes[i+1] : this.nodes[i];
            
            const force = tension * (left + right - 2 * this.nodes[i]);
            this.vels[i] += force;
            this.vels[i] *= (1 - damping);
            this.nodes[i] += this.vels[i];
        }
        
        this.particles.forEach(p => {
            if (p.life > 0) {
                p.pos += p.vel;
                p.life -= 0.05; 
            }
        });
    }

    disturb(idx: number, amount: number) {
        if(idx>=0 && idx<this.nodes.length) this.vels[idx] += amount;
    }
    
    spawnFoam(idx: number, strength: number) {
        const p = this.particles.find(p => p.life <= 0);
        if (p) {
            p.pos = idx;
            p.vel = (Math.random() - 0.5) * 0.1;
            p.life = strength;
        }
    }
}

const interpolateColor = (color1: number[], color2: number[], factor: number) => {
    return color1.map((c, i) => Math.round(c + factor * (color2[i] - c)));
};

// V2.5 Palette Logic
const getTidePaletteColor = (tideLevel: number, depthPercent: number): string => {
    // Colors [R, G, B]
    const SAND = [194, 178, 128];
    const TEAL = [0, 128, 128];
    const DEEP_BLUE = [0, 0, 50];
    const CYAN = [0, 200, 200];
    const NAVY = [0, 0, 100];

    if (tideLevel < 0.25) {
        // Low Tide
        const rgb = interpolateColor(SAND, TEAL, depthPercent);
        return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    } else if (tideLevel > 0.75) {
        // High Tide
        const rgb = interpolateColor(NAVY, CYAN, depthPercent);
        return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    } else {
        // Mid
        const rgb = interpolateColor(TEAL, DEEP_BLUE, depthPercent);
        return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    }
};

export const LedVisualizer: React.FC<LedVisualizerProps> = ({ simMode, simParams }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { firmwareConfig, keyframes, simulatedTime, weatherData } = useAppStore();

    const fluidRef = useRef<FluidEngineJS | null>(null);
    const configRef = useRef(firmwareConfig);
    const dataRef = useRef({ keyframes, simulatedTime, weatherData, simMode, simParams });

    const trendRef = useRef<{lastTide: number, trend: number}>({ lastTide: 50, trend: 0 });

    useEffect(() => { configRef.current = firmwareConfig; }, [firmwareConfig]);
    useEffect(() => { dataRef.current = { keyframes, simulatedTime, weatherData, simMode, simParams }; }, [keyframes, simulatedTime, weatherData, simMode, simParams]);

    useEffect(() => {
        if (!containerRef.current || !canvasRef.current) return;
        const resizeObserver = new ResizeObserver(entries => {
             for (const entry of entries) {
                 if (entry.target === containerRef.current && canvasRef.current) {
                     canvasRef.current.width = entry.contentRect.width;
                     canvasRef.current.height = entry.contentRect.height;
                 }
             }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false }); 
        if (!ctx) return;

        let animId: number;
        let startTime = performance.now();

        const render = () => {
            const now = performance.now();
            const timeMs = now - startTime;
            const cfg = configRef.current;
            const data = dataRef.current;
            
            const w = canvas.width; 
            const h = canvas.height;
            const count = cfg.ledCount || 60;

            // Init Fluid Engine
            if (!fluidRef.current) fluidRef.current = new FluidEngineJS(count);
            const fluid = fluidRef.current;
            fluid.resize(count);

            // Determine Tide Level & Trend
            let tide = 50, wind = 0, trend = 0;

            if (data.simMode) {
                tide = data.simParams.tide; 
                wind = data.simParams.wind; 
                trend = data.simParams.tideDirection === 'RISING' ? 1 : -1;
            } else {
                const cycle = cfg.cycleDuration || 24;
                let t = data.simulatedTime % cycle;
                if (data.keyframes.length > 0) {
                     let s = data.keyframes[0], e = data.keyframes[data.keyframes.length-1];
                     for(let i=0; i<data.keyframes.length-1; i++) {
                        if (t >= data.keyframes[i].timeOffset && t <= data.keyframes[i+1].timeOffset) { 
                            s = data.keyframes[i]; e = data.keyframes[i+1]; break; 
                        }
                     }
                     if (t < s.timeOffset && data.keyframes.length > 1) { 
                        e = data.keyframes[0]; s = data.keyframes[data.keyframes.length-1];
                     }
                     let dur = e.timeOffset - s.timeOffset; 
                     if (dur < 0) dur += cycle;
                     let offset = t - s.timeOffset;
                     if (offset < 0) offset += cycle;
                     const prog = dur === 0 ? 0 : offset / dur;
                     tide = s.height + (e.height - s.height) * Math.max(0, Math.min(1, prog));
                }
                wind = data.weatherData.windSpeed || 0; 
                
                if (Math.abs(tide - trendRef.current.lastTide) > 0.001) {
                    trend = tide > trendRef.current.lastTide ? 1 : -1;
                    trendRef.current.trend = trend;
                } else {
                    trend = trendRef.current.trend;
                }
                trendRef.current.lastTide = tide;
            }

            const tideNorm = tide / 100.0;

            // Update Physics (for Fluid mode)
            fluid.update(tideNorm, cfg.fluidParams?.tension || 0.025, 0.02);
            if (Math.random() < (wind * 0.002) + 0.02) {
                const surfaceNode = Math.floor(tideNorm * count);
                fluid.disturb(surfaceNode, (Math.random()-0.5) * 0.5);
                if (cfg.animationMode === 'fluidPhysics') fluid.spawnFoam(surfaceNode, 1.0);
            }

            // --- RENDER ---
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, w, h);

            const layout = cfg.ledLayoutType || 'STRIP';
            const mode = cfg.animationMode || 'fluidPhysics';
            let ledRadius = 2;
            
            // PRECALC FOR MATRIX LAYOUT
            const cols = cfg.ledMatrixWidth || 16;
            const rows = Math.ceil(count / cols);
            const margin = 20;
            const cellS = Math.min((w - margin*2)/cols, (h - margin*2)/rows);

            for(let i=0; i<count; i++) {
                let px = 0; let py = 0;
                let mx = 0; let my = 0; // Matrix coords (logical)

                // --- TOPOLOGY CALC ---
                if (layout === 'MATRIX') {
                    ledRadius = Math.max(2, cellS * 0.35);
                    let row = Math.floor(i / cols);
                    let col = i % cols;
                    if (cfg.ledSerpentine && row % 2 !== 0) col = cols - 1 - col;
                    
                    mx = col;
                    my = row;

                    const offsetX = (w - (cols * cellS)) / 2;
                    const offsetY = (h - (rows * cellS)) / 2;
                    px = offsetX + (col * cellS) + cellS/2;
                    py = (h - offsetY) - (row * cellS) - cellS/2;
                } else if (layout === 'RING') {
                    const radius = Math.min(w, h) * 0.35;
                    ledRadius = Math.max(3, (Math.PI * 2 * radius / count) * 0.4);
                    const angle = (Math.PI / 2) - (i / count) * (Math.PI * 2); 
                    px = w/2 + Math.cos(angle) * radius;
                    py = h/2 + Math.sin(angle) * radius;
                } else {
                    const margin = 40;
                    const stepY = (h - margin) / count;
                    ledRadius = Math.max(2, stepY * 0.4);
                    px = w/2;
                    py = (h - margin/2) - (i * stepY);
                }

                // --- COLOR LOGIC ---
                let r = 20, g = 20, b = 30; // Off state
                const waterLevelNode = tideNorm * count;

                // 1. MOON PHASE RING
                if (mode === 'moonPhase') {
                    // Background stars
                    if (Math.random() > 0.99) { r=10; g=10; b=15; }
                    else { r=0; g=0; b=3; }
                    
                    // Use Moon Illumination % from Weather Data
                    // If simMode, we could use tide var as fake moon phase or just use actual weather data
                    const moonPct = data.weatherData.moonIllumination || 50;
                    
                    const litCount = Math.floor((moonPct / 100) * count);
                    const startIdx = Math.floor((count / 2) - (litCount / 2));
                    
                    // Ring Logic (Simple fill centered at bottom/top)
                    // We need to check if 'i' falls within the arc [startIdx, startIdx+litCount]
                    // Handling wrap-around logic for Ring
                    
                    // Re-normalize 'i' relative to startIdx to check membership
                    let relIndex = i - startIdx;
                    while(relIndex < 0) relIndex += count;
                    
                    if (relIndex < litCount) {
                         // It is lit
                         let dim = 1.0;
                         const centerDist = Math.abs(relIndex - (litCount/2));
                         if (centerDist > (litCount/2) * 0.7) {
                             dim = 1.0 - ((centerDist - (litCount/2)*0.7) / ((litCount/2)*0.3));
                             if(dim<0.2) dim=0.2;
                         }
                         r = Math.floor(255 * dim); 
                         g = Math.floor(245 * dim); 
                         b = Math.floor(220 * dim);
                    }
                }
                // 2. TIDE STRIP BASIC (Vertical Logic)
                else if (mode === 'tideStripBasic') {
                    const logicalY = (layout === 'MATRIX') ? my : i;
                    const logicalMax = (layout === 'MATRIX') ? rows : count;
                    const waterH = tideNorm * logicalMax;
                    
                    if (logicalY < waterH) {
                        const tSec = timeMs / 600.0;
                        const wave = Math.sin((logicalY * 0.25) + tSec * (trend >= 0 ? 1.0 : -1.0));
                        const bright = Math.max(50, Math.min(255, 150 + wave * 80));
                        const rgb = HSVtoRGB(160/360, 1.0, bright/255);
                        r = rgb.r; g = rgb.g; b = rgb.b;
                    } else {
                        r=0; g=0; b=0;
                    }
                    if (Math.floor(waterH) === logicalY) {
                         // Surface
                         const rgb = HSVtoRGB(180/360, 0.78, 1.0);
                         r=rgb.r; g=rgb.g; b=rgb.b;
                    }
                }
                // 3. MATRIX BEACH (Side View)
                else if (mode === 'matrixBeach') {
                     // Assume layout is MATRIX. If Strip, it will just show a slice.
                     // X = Distance from shore, Y = Depth
                     // Logic: Water fills from bottom (Y). Waves move in X.
                     // Corrected Logic per prompt: Y=0 is bottom (water deep), Y=Max is Sky
                     // Prompt: "Linha superior = céu, Meio = areia, Inferior = água"
                     // Assuming my=0 is bottom row on display.
                     
                     const waterRows = tideNorm * rows;
                     
                     if (my < waterRows) {
                         const wave = Math.sin((mx * 0.4) + timeMs/300.0);
                         const bright = Math.max(50, Math.min(255, 160 + wave * 60));
                         const rgb = HSVtoRGB(160/360, 1.0, bright/255);
                         r = rgb.r; g = rgb.g; b = rgb.b;
                     } else {
                         // Sand
                         const rgb = HSVtoRGB(40/360, 0.6, 0.8); // sandy
                         r = rgb.r; g = rgb.g; b = rgb.b;
                     }
                }
                // 4. MATRIX FLUID PREMIUM (Vertical Bar per Column)
                else if (mode === 'matrixFluid') {
                    // Logic: Each column is a vertical bar
                    // Surface has waves
                    const waveOffset = (timeMs / 400.0) * (trend >= 0 ? 1 : -1);
                    const localH = tideNorm * rows + Math.sin(mx * 0.5 + waveOffset) * (1.0 + 0.5); // reduced rate factor for sim
                    
                    if (my < localH) {
                         const rgb = HSVtoRGB(160/360, 1.0, 200/255);
                         r = rgb.r; g = rgb.g; b = rgb.b;
                    } else {
                         r=0; g=0; b=0;
                    }
                }
                // --- EXISTING MODES ---
                else if (mode === 'fluidPhysics' || mode === 'bio') {
                    // (Existing logic preserved mostly for strip compatibility)
                    const displacement = fluid.nodes[i] * 5.0;
                    if (i <= waterLevelNode + displacement) {
                        const depth = i / count;
                        const baseStr = getTidePaletteColor(tideNorm, depth);
                        const rgbMatch = baseStr.match(/\d+/g);
                        if (rgbMatch) {
                            r = parseInt(rgbMatch[0]); g = parseInt(rgbMatch[1]); b = parseInt(rgbMatch[2]);
                        }
                    }
                }
                else {
                     // Generic Fallback
                     if (i <= waterLevelNode) { r=14; g=165; b=233; }
                }

                ctx.beginPath();
                ctx.arc(px, py, ledRadius, 0, Math.PI*2);
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fill();
            }

            animId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animId);
    }, []);

    return (
        <div ref={containerRef} className="w-full h-full relative bg-slate-950">
            <canvas ref={canvasRef} className="block w-full h-full" />
            <div className="absolute top-2 right-2 text-[10px] font-mono text-slate-500">v2.7 Premium Renderer</div>
        </div>
    );
};
