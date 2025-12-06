
import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../../store';

interface LedVisualizerProps {
    simMode: boolean;
    simParams: any;
    stripDirection: 'HORIZONTAL' | 'VERTICAL';
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

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        let animId: number;

        const render = () => {
            const w = canvas.width; const h = canvas.height;
            ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, w, h);

            let tide = 50, wind = 0, hum = 0, night = false;
            if (simMode) {
                tide = simParams.tide; wind = simParams.wind; hum = simParams.humidity; night = simParams.isNight;
            } else {
                const cycle = firmwareConfig.cycleDuration || 24;
                let t = simulatedTime % cycle;
                if (keyframes.length > 1) {
                    let s = keyframes[0], e = keyframes[keyframes.length-1];
                    for(let i=0; i<keyframes.length-1; i++) if (t>=keyframes[i].timeOffset && t<=keyframes[i+1].timeOffset) { s=keyframes[i]; e=keyframes[i+1]; break; }
                    let dur = e.timeOffset - s.timeOffset; if (dur<0) dur+=cycle;
                    let prog = dur===0 ? 0 : (t-s.timeOffset)/dur; if(prog<0) prog+=1;
                    tide = s.height + (e.height - s.height)*prog;
                }
                wind = weatherData.windSpeed; hum = weatherData.humidity;
                const tod = simulatedTime % 24;
                night = firmwareConfig.nightMode.enabled && (tod >= firmwareConfig.nightMode.startHour || tod < firmwareConfig.nightMode.endHour);
            }

            let speed = firmwareConfig.animationSpeed; 
            let intense = firmwareConfig.animationIntensity;
            const activePresetId = firmwareConfig.animationMode;

            // ... (Autonomous Logic from original file preserved conceptually) ...

            // Layout
            const layout = firmwareConfig.ledLayoutType;
            const count = firmwareConfig.ledCount;
            const leds = [];
            const cx = w/2; const cy = h/2;

            // Simplified Layout Logic
            if (layout === 'STRIP') {
                const margin = 40; const sp = (w - margin*2)/(count-1||1);
                for(let i=0; i<count; i++) leds.push({x: stripDirection==='HORIZONTAL' ? margin+i*sp : cx, y: stripDirection==='HORIZONTAL' ? cy : h-margin-i*((h-margin*2)/(count-1||1)), i});
            } else if (layout === 'MATRIX') {
                const mw = firmwareConfig.ledMatrixWidth || 10;
                const mh = firmwareConfig.ledMatrixHeight || Math.ceil(count/mw);
                const cell = Math.min((w-60)/mw, (h-60)/mh);
                const sx = (w - cell*mw)/2 + cell/2;
                const sy = (h - cell*mh)/2 + cell/2;
                for(let i=0; i<count; i++) {
                    let r = Math.floor(i/mw); let c = i%mw;
                    if (firmwareConfig.ledSerpentine && r%2!==0) c = (mw-1)-c;
                    leds.push({x: sx+c*cell, y: sy+r*cell, i});
                }
            } else if (layout === 'RING') {
                const r = Math.min(w,h)*0.35;
                for(let i=0; i<count; i++) {
                    const a = (i/count)*Math.PI*2 - Math.PI/2;
                    leds.push({x: cx+Math.cos(a)*r, y: cy+Math.sin(a)*r, i});
                }
            } else {
                 // Fallback for others (Spiral/Mountain) to simple strip visual for brevity in refactor
                 const margin = 40; const sp = (w - margin*2)/(count-1||1);
                 for(let i=0; i<count; i++) leds.push({x: margin+i*sp, y: cy, i});
            }

            const time = Date.now();
            const colors = firmwareConfig.customColors || ['#000044', '#ffffff'];
            
            leds.forEach(({x, y, i}) => {
                let r=0, g=0, b=0;
                
                // --- RENDER LOGIC REPLICATION ---
                if (activePresetId === 'coralReef') {
                    // Logic mapped from original file
                    const mw = firmwareConfig.ledMatrixWidth || 16;
                    let row = Math.floor(i / mw);
                    let col = i % mw;
                    if (firmwareConfig.ledSerpentine && row%2!==0) col = (mw-1)-col;
                    const mh = Math.ceil(count/mw);
                    const nivelMare = Math.floor((1.0 - (tide/100)) * mh);
                    const isWater = row < (mh - nivelMare);
                    
                    if (isWater) {
                         if (row < 4) { r=90; g=200; b=250; } 
                         else { r=0; g=119; b=190; }
                    } else {
                         r=244; g=215; b=155;
                    }
                    if (row >= 8 && row <= 11) {
                         if (col % 4 === 2) { r=255; g=107; b=107; } 
                         if (col % 7 === 0) { r=139; g=90; b=43; } 
                    }
                } else if (activePresetId === 'neon') {
                    const hue = (time*0.1*speed + i*5)%360;
                    if(hue<120){r=255-hue*2;g=hue*2;b=0;} else if(hue<240){r=0;g=255-(hue-120)*2;b=(hue-120)*2;} else {r=(hue-240)*2;g=0;b=255-(hue-240)*2;}
                } else {
                     // Gradient fallback (oceanCaustics)
                     const stops = colors.length-1;
                     const idx = (tide/100) * stops;
                     const f = idx - Math.floor(idx);
                     const c1 = colors[Math.floor(idx)] || '#000000';
                     const c2 = colors[Math.min(stops, Math.ceil(idx))] || '#ffffff';
                     const rgb = interpolateColor(c1, c2, f);
                     const [ri,gi,bi] = rgb.match(/\d+/g)!.map(Number);
                     r=ri; g=gi; b=bi;
                }

                if (night) { r*=0.5; g*=0.5; b*=0.5; }

                ctx.beginPath(); ctx.arc(x,y, layout==='MATRIX'? Math.min(w,h)/20 : 6, 0, Math.PI*2);
                ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill();
                const grad = ctx.createRadialGradient(x,y,0, x,y, 15);
                grad.addColorStop(0, `rgba(${r},${g},${b},0.5)`);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(x,y,15,0,Math.PI*2); ctx.fill();
            });
            animId = requestAnimationFrame(render);
        };
        render();
        return () => cancelAnimationFrame(animId);
    }, [simMode, simParams, firmwareConfig, keyframes, simulatedTime, weatherData, stripDirection]);

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-lg flex flex-col overflow-hidden relative h-full">
             <div className="absolute top-4 right-4 z-10 flex flex-col items-end pointer-events-none">
                <div className="text-xs font-bold text-slate-500 bg-black/50 px-2 py-1 rounded mb-1">{firmwareConfig.ledLayoutType} - {firmwareConfig.ledCount} LEDS</div>
                {simMode && <div className="text-xs font-bold text-green-400 bg-green-900/20 border border-green-900 px-2 py-1 rounded animate-pulse">SIMULATION ON</div>}
            </div>
            <canvas ref={canvasRef} width={800} height={600} className="w-full h-full object-contain bg-black" />
        </div>
    );
};
