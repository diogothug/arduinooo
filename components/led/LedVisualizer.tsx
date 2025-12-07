import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../../store';

interface LedVisualizerProps {
    simMode: boolean;
    simParams: any;
}

// 1D Fluid Engine Class (JS Port of C++ Firmware)
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

    update(targetLevel: number) { 
        const size = this.nodes.length;
        const targetIdx = Math.floor(targetLevel * size);
        for(let i=0; i<size; i++) {
            const target = i < targetIdx ? 1.0 : 0.0;
            const displacement = target - this.nodes[i];
            let force = 0;
            // Neighbors
            const left = i > 0 ? this.nodes[i-1] : this.nodes[i];
            const right = i < size-1 ? this.nodes[i+1] : this.nodes[i];
            
            const springF = this.tension * (left + right - 2 * this.nodes[i]);
            const pushF = displacement * 0.005; // Base driving force
            
            this.vels[i] += springF + pushF;
            this.vels[i] *= (1 - this.damping);
            this.nodes[i] += this.vels[i];
        }
        if (this.spread > 0) {
            for(let pass=0; pass<2; pass++) {
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
    return `rgb(${Math.round(r1 + factor * (r2 - r1))},${Math.round(g1 + factor * (g2 - g1))},${Math.round(b1 + factor * (b2 - b1))})`;
};

export const LedVisualizer: React.FC<LedVisualizerProps> = ({ simMode, simParams }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { firmwareConfig, keyframes, simulatedTime, weatherData } = useAppStore();

    // Persistent simulation state
    const fluidRef = useRef<FluidEngineJS | null>(null);
    
    // Config and Data Refs for the loop
    const configRef = useRef(firmwareConfig);
    const dataRef = useRef({ keyframes, simulatedTime, weatherData, simMode, simParams });

    // Sync refs
    useEffect(() => { configRef.current = firmwareConfig; }, [firmwareConfig]);
    useEffect(() => { dataRef.current = { keyframes, simulatedTime, weatherData, simMode, simParams }; }, [keyframes, simulatedTime, weatherData, simMode, simParams]);

    // Handle Resize
    useEffect(() => {
        if (!containerRef.current || !canvasRef.current) return;
        const resizeObserver = new ResizeObserver(entries => {
             for (const entry of entries) {
                 if (entry.target === containerRef.current && canvasRef.current) {
                     // Set actual canvas pixels to match display size
                     canvasRef.current.width = entry.contentRect.width;
                     canvasRef.current.height = entry.contentRect.height;
                 }
             }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    // Main Render Loop
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
            const count = cfg.ledCount || 60;

            // Init Fluid Engine
            if (!fluidRef.current) fluidRef.current = new FluidEngineJS(count);
            const fluid = fluidRef.current;
            fluid.resize(count);
            // Hot-reload params
            fluid.tension = cfg.fluidParams?.tension || 0.025;
            fluid.damping = cfg.fluidParams?.damping || 0.02;
            fluid.spread = cfg.fluidParams?.spread || 0.1;

            // 1. Determine Environment Params (Tide Level, Wind, etc)
            let tide = 50, wind = 0, intensity = cfg.animationIntensity;
            
            if (data.simMode) {
                tide = data.simParams.tide; 
                wind = data.simParams.wind; 
            } else {
                // Calculate Tide from Keyframes if not manual
                const cycle = cfg.cycleDuration || 24;
                let t = data.simulatedTime % cycle;
                if (data.keyframes.length > 0) {
                     let s = data.keyframes[0], e = data.keyframes[data.keyframes.length-1];
                     // Find segment
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
                     tide = s.height + (e.height - s.height) * Math.max(0, Math.min(1, prog));
                }
                // Use live weather wind if available
                wind = data.weatherData.windSpeed || 0; 
            }

            // 2. Physics Update
            const useFluid = (cfg.animationMode === 'fluidPhysics' || cfg.animationMode === 'bio');
            if (useFluid) {
                fluid.update(tide / 100.0);
                // Inject random noise based on wind speed
                if (Math.random() < (wind * 0.005) + 0.005) {
                    fluid.disturb(Math.floor(Math.random() * count), (Math.random()-0.5) * 0.3);
                }
            }

            // 3. Topology Mapping (Layout Calculation)
            const layout = cfg.ledLayoutType || 'STRIP';
            const leds: {x: number, y: number, i: number}[] = [];
            
            if (layout === 'STRIP') {
                // Vertical Strip centered
                const padding = 60;
                const availableH = h - (padding * 2);
                const step = availableH / Math.max(1, count - 1);
                
                for(let i=0; i<count; i++) {
                    leds.push({
                        x: cx, 
                        y: h - padding - (i * step), 
                        i
                    });
                }
            } else if (layout === 'MATRIX') {
                // Grid Layout
                const cols = cfg.ledMatrixWidth || 16;
                const rows = Math.ceil(count / cols);
                
                // Calculate Cell Size to fit in canvas
                const margin = 40;
                const availableW = w - margin * 2;
                const availableH = h - margin * 2;
                const cellSize = Math.min(availableW / cols, availableH / rows);
                
                const gridW = cols * cellSize;
                const gridH = rows * cellSize;
                const startX = cx - gridW / 2 + cellSize / 2;
                const startY = cy + gridH / 2 - cellSize / 2; // Bottom-up usually for tides

                for(let i=0; i<count; i++) {
                    let col = i % cols;
                    let row = Math.floor(i / cols);
                    
                    // Serpentine ZigZag Logic
                    if (cfg.ledSerpentine && row % 2 !== 0) {
                        col = cols - 1 - col;
                    }
                    
                    // Visual mapping: Row 0 is bottom
                    leds.push({
                        x: startX + col * cellSize,
                        y: startY - row * cellSize, 
                        i
                    });
                }
            } else if (layout === 'RING') {
                // Circular Layout
                const radius = Math.min(w, h) / 2 - 50;
                const stepAngle = (Math.PI * 2) / count;
                const startAngle = -Math.PI / 2; // Top

                for(let i=0; i<count; i++) {
                    const angle = startAngle + (i * stepAngle);
                    leds.push({
                        x: cx + Math.cos(angle) * radius,
                        y: cy + Math.sin(angle) * radius,
                        i
                    });
                }
            }

            // 4. Render Frame
            ctx.fillStyle = '#020617'; // Deep black/slate
            ctx.fillRect(0, 0, w, h);

            // Draw "Cable" line for strip/ring
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = layout === 'MATRIX' ? 1 : 4;
            if (leds.length > 0) {
                 if (layout === 'MATRIX') {
                     // Draw grid lines for matrix maybe?
                 } else {
                    ctx.beginPath();
                    ctx.moveTo(leds[0].x, leds[0].y);
                    for(let i=1; i<leds.length; i++) ctx.lineTo(leds[i].x, leds[i].y);
                    if (layout === 'RING') ctx.closePath();
                    ctx.stroke();
                 }
            }

            // Render LEDs
            leds.forEach((led) => {
                let r=0, g=0, b=0;
                
                // --- COLOR RESOLUTION ---
                if (useFluid) {
                    const val = Math.max(0, Math.min(1, fluid.nodes[led.i]));
                    if (val > 0.02) {
                        // Deep Ocean Blue Gradient
                        r = 0; g = Math.floor(val * 100); b = Math.floor(val * 240); 
                        if (cfg.animationMode === 'bio') {
                             // Bio Flash Logic
                             const vel = Math.abs(fluid.vels[led.i]);
                             if (vel > 0.1) { g = 255; b = 255; }
                        }
                    }
                } 
                else if (cfg.animationMode === 'thermal') {
                    const noise = (Math.sin(led.i * 0.3 + timeSec * 3) + 1) / 2;
                    r = Math.floor(noise * 255); g = Math.floor(noise * 80); b = 0;
                }
                else {
                    // Standard / Legacy modes
                     const colors = (cfg.customColors && cfg.customColors.length > 0) ? cfg.customColors : ['#000044', '#00ffff'];
                     // Simple fill based on tide %
                     const ledPct = (led.i / count) * 100;
                     if (ledPct <= tide) {
                         // Active
                         r=0; g=100; b=200;
                         if (ledPct > tide - 5) { r=100; g=200; b=255; } // Top highlight
                     } else {
                         // Inactive
                         r=10; g=10; b=20;
                     }
                }

                // Global Brightness Scaling
                const br = (cfg.ledBrightness / 255) * intensity;
                r *= br; g *= br; b *= br;
                
                // Draw Glow
                const rad = layout === 'MATRIX' ? (w/cfg.ledMatrixWidth! * 0.3) : 6;
                const glow = ctx.createRadialGradient(led.x, led.y, rad/2, led.x, led.y, rad * 2.5);
                glow.addColorStop(0, `rgba(${r},${g},${b}, 0.6)`);
                glow.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = glow;
                ctx.beginPath(); ctx.arc(led.x, led.y, rad * 2.5, 0, Math.PI*2); ctx.fill();

                // Draw Core
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.beginPath(); ctx.arc(led.x, led.y, rad, 0, Math.PI * 2); ctx.fill();
            });

            animId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animId);
    }, []);

    return (
        <div ref={containerRef} className="w-full h-full relative">
            <canvas ref={canvasRef} className="block w-full h-full" />
            <div className="absolute top-4 right-4 pointer-events-none text-[10px] text-slate-500 font-mono">
                {firmwareConfig.ledCount} LEDs • {firmwareConfig.ledLayoutType}
            </div>
        </div>
    );
};