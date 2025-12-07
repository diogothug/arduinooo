




import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../../store';

interface LedVisualizerProps {
    simMode: boolean;
    simParams: any;
    stripDirection: 'HORIZONTAL' | 'VERTICAL';
}

// 1D Fluid Engine Class (JS Port)
class FluidEngineJS {
    nodes: number[];
    vels: number[];
    tension: number;
    damping: number;
    spread: number;

    constructor(size: number) {
        this.nodes = new Array(size).fill(0);
        this.vels = new Array(size).fill(0);
        this.tension = 0.025;
        this.damping = 0.02;
        this.spread = 0.1;
    }

    resize(size: number) {
        if(this.nodes.length !== size) {
            this.nodes = new Array(size).fill(0);
            this.vels = new Array(size).fill(0);
        }
    }

    update(targetLevel: number) { // targetLevel 0..1
        const size = this.nodes.length;
        const targetIdx = Math.floor(targetLevel * size);
        
        // 1. Spring Physics
        for(let i=0; i<size; i++) {
            // Target Height Force (Mass movement)
            const target = i < targetIdx ? 1.0 : 0.0;
            const displacement = target - this.nodes[i];
            
            // Spring Force (Hooke's)
            let force = 0;
            const left = i > 0 ? this.nodes[i-1] : this.nodes[i];
            const right = i < size-1 ? this.nodes[i+1] : this.nodes[i];
            
            const springF = this.tension * (left + right - 2 * this.nodes[i]);
            
            // External Force (Tide Push) - Slow fill
            const pushF = displacement * 0.005; // Gentle push

            this.vels[i] += springF + pushF;
            this.vels[i] *= (1 - this.damping);
            this.nodes[i] += this.vels[i];
        }

        // 2. Spread (Smoothing) Pass
        if (this.spread > 0) {
            for(let pass=0; pass<2; pass++) {
                // To avoid bias, ideally we'd use a buffer, but for visuals in-place is okay
                for(let i=0; i<size; i++) {
                    const left = i > 0 ? this.nodes[i-1] : this.nodes[i];
                    const right = i < size-1 ? this.nodes[i+1] : this.nodes[i];
                    this.nodes[i] += this.spread * ((left + right)/2.0 - this.nodes[i]);
                }
            }
        }
    }

    disturb(idx: number, amount: number) {
        if(idx>=0 && idx<this.nodes.length) this.vels[idx] += amount;
    }
}

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

export const LedVisualizer: React.FC<LedVisualizerProps> = ({ simMode, simParams, stripDirection }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { firmwareConfig, keyframes, simulatedTime, weatherData } = useAppStore();

    // Persistent Physics Engine in Ref
    const fluidRef = useRef<FluidEngineJS | null>(null);

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
        let startTime = Date.now();

        const render = () => {
            const now = Date.now();
            const timeSec = (now - startTime) / 1000;

            const cfg = configRef.current;
            const data = dataRef.current;
            const w = canvas.width; 
            const h = canvas.height;
            const cx = w / 2;
            const cy = h / 2;
            const count = cfg.ledCount;

            // Init Fluid Engine if needed
            if (!fluidRef.current) fluidRef.current = new FluidEngineJS(count);
            const fluid = fluidRef.current;
            fluid.resize(count);
            // Update Fluid Params live
            fluid.tension = cfg.fluidParams?.tension || 0.025;
            fluid.damping = cfg.fluidParams?.damping || 0.02;
            fluid.spread = cfg.fluidParams?.spread || 0.1;

            // 1. Determine Environment Variables
            let tide = 50, wind = 0, intensity = cfg.animationIntensity;
            let isRising = true;

            if (data.simMode) {
                tide = data.simParams.tide; 
                wind = data.simParams.wind; 
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
                    
                    const futureT = (t + 0.1) % cycle;
                    let nextProg = prog + (0.1 / dur);
                    if(nextProg > 1) nextProg = 1; 
                    nextH = s.height + (e.height - s.height) * nextProg;
                    isRising = nextH > currentH;
                    tide = currentH;
                }
                wind = data.weatherData.windSpeed; 
            }

            // 2. Physics Update Step
            if (cfg.animationMode === 'fluidPhysics' || cfg.animationMode === 'bio') {
                fluid.update(tide / 100.0);
                // Random Disturbance (Wind)
                if (Math.random() < (wind * 0.005) + 0.01) {
                    const rIdx = Math.floor(Math.random() * count);
                    fluid.disturb(rIdx, (Math.random()-0.5) * 0.2);
                }
            }

            // 3. Generate LED Coordinates
            const layout = cfg.ledLayoutType;
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
            } else {
                 // Simple fallback for matrix/ring visualization in 1D physics context
                 const margin = 40; const sp = (w - margin * 2) / (count - 1 || 1);
                 for(let i=0; i<count; i++) {
                     const x = margin + i * sp;
                     const y = cy + Math.sin(i * 0.5) * 50;
                     leds.push({x, y, i});
                 }
            }

            // 4. Render Logic
            ctx.fillStyle = '#0f172a'; // Slate-900
            ctx.fillRect(0, 0, w, h);

            leds.forEach((led) => {
                let r=0, g=0, b=0;
                
                if (cfg.animationMode === 'fluidPhysics') {
                    // --- FLUID RENDER (MATCHES C++) ---
                    // Fluid node value is 0..1 (approx)
                    // We map physical position i/count vs fluid height
                    
                    // Simple viz: Node value determines brightness/color
                    const val = Math.max(0, Math.min(1, fluid.nodes[led.i]));
                    // Fake PBR: velocity
                    const vel = Math.abs(fluid.vels[led.i]);
                    
                    if (val > 0.1) {
                        // Water
                        r = 0; g = val * 100; b = val * 200;
                        // Specular
                        if (vel > 0.02) {
                            r+=vel*1000; g+=vel*1000; b+=vel*1000;
                        }
                    } else {
                        // Air
                        r=0; g=0; b=0;
                    }
                } 
                else if (cfg.animationMode === 'bio') {
                     // Dark water with flashes
                     const val = Math.max(0, Math.min(1, fluid.nodes[led.i]));
                     const vel = Math.abs(fluid.vels[led.i]);
                     
                     if (val > 0.1) {
                         r=0; g=10; b=20;
                         if (vel > 0.05) {
                             // Flash
                             g+=150; b+=200;
                         }
                     }
                }
                else if (cfg.animationMode === 'thermal') {
                    // Heat map
                    // Simulating temp noise
                    const noise = (Math.sin(led.i * 0.5 + timeSec) + 1) / 2;
                    r = noise * 255; g = noise * 100; b = 0;
                }
                else {
                    // Fallback to Standard
                     const colors = (cfg.customColors && cfg.customColors.length > 0) ? cfg.customColors : ['#000044', '#ffffff'];
                     const stops = colors.length - 1;
                     const phase = (led.i / count) + (now * 0.0001 * cfg.animationSpeed);
                     const pos = (phase % 1) * stops;
                     const idx = Math.floor(pos);
                     const rgb = interpolateColor(colors[idx % colors.length], colors[(idx + 1) % colors.length], pos - idx);
                     const parsed = rgb.match(/\d+/g)?.map(Number) || [0,0,0];
                     r=parsed[0]; g=parsed[1]; b=parsed[2];
                }

                // Global Intensity
                r *= intensity; g *= intensity; b *= intensity;
                r = Math.min(255, Math.max(0, r)); g = Math.min(255, Math.max(0, g)); b = Math.min(255, Math.max(0, b));

                // Draw
                ctx.beginPath();
                const radius = 6;
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
                     {firmwareConfig.animationMode.toUpperCase()}
                 </div>
            </div>
            
            <canvas ref={canvasRef} width={800} height={600} className="w-full h-full object-contain relative z-1" />
        </div>
    );
};