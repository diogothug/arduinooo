
import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../../store';

interface LedVisualizerProps {
    simMode: boolean;
    simParams: any;
    stripDirection: 'HORIZONTAL' | 'VERTICAL';
}

// 1D Fluid Engine Class (JS Port) - Reused
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
            const left = i > 0 ? this.nodes[i-1] : this.nodes[i];
            const right = i < size-1 ? this.nodes[i+1] : this.nodes[i];
            const springF = this.tension * (left + right - 2 * this.nodes[i]);
            const pushF = displacement * 0.005; 
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
    const { firmwareConfig, keyframes, simulatedTime, weatherData } = useAppStore();

    const fluidRef = useRef<FluidEngineJS | null>(null);
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
            
            // Resize Canvas to parent for sharpness
            const parent = canvas.parentElement;
            if (parent && (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight)) {
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
            }

            const w = canvas.width; 
            const h = canvas.height;
            const cx = w / 2;
            const cy = h / 2;
            const count = cfg.ledCount || 60;

            if (!fluidRef.current) fluidRef.current = new FluidEngineJS(count);
            const fluid = fluidRef.current;
            fluid.resize(count);
            fluid.tension = cfg.fluidParams?.tension || 0.025;
            fluid.damping = cfg.fluidParams?.damping || 0.02;
            fluid.spread = cfg.fluidParams?.spread || 0.1;

            // 1. Determine Env Params
            let tide = 50, wind = 0, intensity = cfg.animationIntensity;
            
            if (data.simMode) {
                tide = data.simParams.tide; 
                wind = data.simParams.wind; 
            } else {
                // Calculate from keyframes logic... (Shortened for brevity as logic is same as before)
                const cycle = cfg.cycleDuration || 24;
                let t = data.simulatedTime % cycle;
                if (data.keyframes.length > 0) {
                     // Basic interpolation
                     let s = data.keyframes[0], e = data.keyframes[data.keyframes.length-1];
                     for(let i=0; i<data.keyframes.length-1; i++) {
                        if (t >= data.keyframes[i].timeOffset && t <= data.keyframes[i+1].timeOffset) { s = data.keyframes[i]; e = data.keyframes[i+1]; break; }
                     }
                     let dur = e.timeOffset - s.timeOffset; if (dur < 0) dur += cycle;
                     const prog = dur === 0 ? 0 : (t - s.timeOffset) / dur;
                     tide = s.height + (e.height - s.height) * (prog < 0 ? prog + 1 : prog);
                }
                wind = data.weatherData.windSpeed; 
            }

            // 2. Physics Update
            if (cfg.animationMode === 'fluidPhysics' || cfg.animationMode === 'bio') {
                fluid.update(tide / 100.0);
                if (Math.random() < (wind * 0.005) + 0.01) {
                    fluid.disturb(Math.floor(Math.random() * count), (Math.random()-0.5) * 0.2);
                }
            }

            // 3. Topology Mapping
            const layout = cfg.ledLayoutType || 'STRIP';
            const leds = [];
            
            if (layout === 'STRIP') {
                // Linear Vertical Strip (Bottom to Top)
                const padding = 50;
                const availableH = h - (padding * 2);
                const step = availableH / (count - 1 || 1);
                
                for(let i=0; i<count; i++) {
                    leds.push({
                        x: cx, 
                        y: h - padding - (i * step), 
                        i
                    });
                }
            } else if (layout === 'MATRIX') {
                // Grid Layout
                const cols = cfg.ledMatrixWidth || 8;
                const rows = Math.ceil(count / cols);
                const cellSize = Math.min((w - 40) / cols, (h - 40) / rows);
                const startX = cx - (cols * cellSize) / 2 + cellSize / 2;
                const startY = cy - (rows * cellSize) / 2 + cellSize / 2;

                for(let i=0; i<count; i++) {
                    let col = i % cols;
                    let row = Math.floor(i / cols);
                    
                    // Serpentine ZigZag Logic
                    if (cfg.ledSerpentine && row % 2 !== 0) {
                        col = cols - 1 - col;
                    }
                    
                    // Standard Matrix Logic: Bottom-Left origin usually for tide maps
                    // But usually matrices are Top-Left index 0. 
                    // Let's assume standard index 0 = top-left visually for now.
                    leds.push({
                        x: startX + col * cellSize,
                        y: startY + row * cellSize,
                        i
                    });
                }
            } else if (layout === 'RING') {
                // Circular Layout
                const radius = Math.min(w, h) / 2 - 40;
                const stepAngle = (Math.PI * 2) / count;
                // Start from Top (-PI/2) and go clockwise
                const startAngle = -Math.PI / 2;

                for(let i=0; i<count; i++) {
                    const angle = startAngle + (i * stepAngle);
                    leds.push({
                        x: cx + Math.cos(angle) * radius,
                        y: cy + Math.sin(angle) * radius,
                        i
                    });
                }
            }

            // 4. Render
            ctx.fillStyle = '#020617'; // Deep black/slate
            ctx.fillRect(0, 0, w, h);

            // Draw "Cable" line for strip/ring
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 4;
            if (layout === 'STRIP' || layout === 'RING') {
                ctx.beginPath();
                if (leds.length > 0) ctx.moveTo(leds[0].x, leds[0].y);
                for(let i=1; i<leds.length; i++) ctx.lineTo(leds[i].x, leds[i].y);
                if (layout === 'RING') ctx.closePath();
                ctx.stroke();
            }

            leds.forEach((led) => {
                let r=0, g=0, b=0;
                
                // --- COLOR RESOLUTION LOGIC ---
                if (cfg.animationMode === 'fluidPhysics') {
                    // 1D Physics Mapping
                    // For Matrix/Ring, we map index 'i' to fluid node 'i' linearly
                    // Ideally matrix would map Y-row to fluid node, but 1D mapping works for serpentine
                    const val = Math.max(0, Math.min(1, fluid.nodes[led.i]));
                    if (val > 0.05) {
                        r = 0; g = val * 120; b = val * 220; // Deep Blue
                    }
                } 
                else if (cfg.animationMode === 'bio') {
                     const val = Math.max(0, Math.min(1, fluid.nodes[led.i]));
                     const vel = Math.abs(fluid.vels[led.i]);
                     if (val > 0.05) {
                         r=0; g=20; b=40;
                         if (vel > 0.05) { g+=180; b+=200; } // Flash
                     }
                }
                else if (cfg.animationMode === 'thermal') {
                    const noise = (Math.sin(led.i * 0.3 + timeSec * 2) + 1) / 2;
                    r = noise * 255; g = noise * 80; b = 0;
                }
                else {
                    // Standard Gradient
                     const colors = (cfg.customColors && cfg.customColors.length > 0) ? cfg.customColors : ['#000044', '#00ffff'];
                     const phase = (led.i / count) + (now * 0.0002 * cfg.animationSpeed);
                     const stops = colors.length - 1;
                     const pos = (phase % 1) * stops;
                     const idx = Math.floor(pos);
                     const rgb = interpolateColor(colors[idx % colors.length], colors[(idx + 1) % colors.length], pos - idx);
                     const parsed = rgb.match(/\d+/g)?.map(Number) || [0,0,0];
                     r=parsed[0]; g=parsed[1]; b=parsed[2];
                }

                // Global Brightness
                r *= intensity; g *= intensity; b *= intensity;
                
                // Draw Glow
                const rad = layout === 'MATRIX' ? 8 : 6;
                const glow = ctx.createRadialGradient(led.x, led.y, rad/2, led.x, led.y, rad * 3);
                glow.addColorStop(0, `rgba(${r},${g},${b}, 0.8)`);
                glow.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = glow;
                ctx.beginPath(); ctx.arc(led.x, led.y, rad * 3, 0, Math.PI*2); ctx.fill();

                // Draw Core
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.beginPath(); ctx.arc(led.x, led.y, rad, 0, Math.PI * 2); ctx.fill();
            });

            animId = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(animId);
    }, []);

    return <canvas ref={canvasRef} className="w-full h-full object-contain" />;
};
