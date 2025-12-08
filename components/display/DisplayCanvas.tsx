
import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../../store';
import { WidgetType, DisplayType, DisplayTheme } from '../../types';
import { Monitor } from 'lucide-react';

// --- HELPERS (Simulating embedded graphics primitives) ---

const toRGB565 = (hex: string) => {
    // Just a visual simulation of color banding if needed, simplified for web
    return hex; 
};

const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number, style: DisplayTheme) => {
    ctx.strokeStyle = style === DisplayTheme.NEON ? 'rgba(0, 255, 255, 0.1)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    
    // Radial Grid
    for(let r=20; r<w/2; r+=30) {
        ctx.beginPath(); ctx.arc(w/2, h/2, r, 0, Math.PI*2); ctx.stroke();
    }
    // Crosshair
    ctx.beginPath(); ctx.moveTo(w/2, 0); ctx.lineTo(w/2, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, h/2); ctx.lineTo(w, h/2); ctx.stroke();
};

const drawTicks = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, count: number, length: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for(let i=0; i<count; i++) {
        const ang = (i / count) * Math.PI * 2;
        const x1 = cx + Math.cos(ang) * r;
        const y1 = cy + Math.sin(ang) * r;
        const x2 = cx + Math.cos(ang) * (r - length);
        const y2 = cy + Math.sin(ang) * (r - length);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
};

interface DisplayCanvasProps {
    selectedWidgetId: string | null;
    setSelectedWidgetId: (id: string | null) => void;
}

export const DisplayCanvas: React.FC<DisplayCanvasProps> = ({ selectedWidgetId, setSelectedWidgetId }) => {
    const { 
        displayConfig, setDisplayConfig, displayWidgets, 
        simulatedTime, keyframes, weatherData, firmwareConfig
    } = useAppStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageCache = useRef<Record<string, HTMLImageElement>>({});

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // --- 1. DATA CALCULATION ---
        let tidePct = 50;
        let trend = 0; // -1, 0, 1
        
        if (keyframes.length >= 2) {
             let start = keyframes[0];
             let end = keyframes[keyframes.length - 1];
             const cycle = firmwareConfig.cycleDuration || 24;
             const t = simulatedTime % cycle;
             
             for (let i = 0; i < keyframes.length - 1; i++) {
               if (t >= keyframes[i].timeOffset && t <= keyframes[i + 1].timeOffset) {
                 start = keyframes[i]; end = keyframes[i + 1]; break;
               }
             }
             
             let duration = end.timeOffset - start.timeOffset;
             if (duration < 0) duration += cycle;
             let elapsed = t - start.timeOffset;
             if (elapsed < 0) elapsed += cycle;
             const progress = duration === 0 ? 0 : elapsed / duration;
             
             const prevH = start.height;
             const nextH = end.height;
             tidePct = prevH + (nextH - prevH) * progress;
             trend = nextH > prevH ? 1 : -1;
        }

        const render = () => {
            const W = canvas.width;
            const H = canvas.height;
            const CX = W/2;
            const CY = H/2;
            
            // --- 2. THEME BACKGROUNDS ---
            ctx.clearRect(0, 0, W, H);
            
            // Mask Circle for GC9A01 Simulation
            ctx.save();
            ctx.beginPath(); ctx.arc(CX, CY, CX, 0, Math.PI * 2); ctx.clip();

            let bgColor = '#000';
            let fgColor = '#fff';
            
            switch(displayConfig.theme) {
                case DisplayTheme.MARINE:
                    bgColor = '#0f172a'; // Slate 900
                    fgColor = '#e2e8f0';
                    break;
                case DisplayTheme.TERMINAL:
                    bgColor = '#001a00'; // Dark Green
                    fgColor = '#00ff00';
                    break;
                case DisplayTheme.PAPER:
                    bgColor = '#f8fafc'; // Slate 50
                    fgColor = '#1e293b'; // Slate 800
                    break;
                case DisplayTheme.NEON:
                    bgColor = '#09090b';
                    fgColor = '#06b6d4'; // Cyan
                    break;
                case DisplayTheme.CHRONO:
                    bgColor = '#171717';
                    fgColor = '#fff';
                    break;
                default:
                    bgColor = '#000000';
                    fgColor = '#ffffff';
            }

            // Fill Background
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, W, H);

            // Theme Specific Decor
            if (displayConfig.theme === DisplayTheme.CHRONO) {
                drawTicks(ctx, CX, CY, CX-2, 60, 5, '#404040'); // Minutes
                drawTicks(ctx, CX, CY, CX-2, 12, 15, '#e5e5e5'); // Hours
            }
            if (displayConfig.theme === DisplayTheme.MARINE) {
                // Compass Rose Ring
                ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(CX, CY, CX-15, 0, Math.PI*2); ctx.stroke();
                drawTicks(ctx, CX, CY, CX-15, 4, 10, '#f97316'); // NSEW
            }

            // --- 3. WIDGET RENDERING ---
            // Sort by Z-Index
            const widgets = [...displayWidgets].sort((a,b) => (a.zIndex||0) - (b.zIndex||0));

            widgets.forEach(w => {
                if (!w.visible) return;
                ctx.save();
                ctx.translate(w.x, w.y);
                ctx.rotate((w.rotation || 0) * Math.PI / 180);
                ctx.scale(w.scale, w.scale);
                
                // Opacity
                ctx.globalAlpha = w.opacity !== undefined ? w.opacity : 1.0;

                // Color Resolve
                let c = w.color;
                if (!c || c === '#ffffff') c = fgColor; 

                // Value Source Resolution
                let valText = w.label || "";
                let valNum = 0;
                
                switch(w.valueSource) {
                    case 'TIDE': valNum = tidePct; valText = `${Math.round(tidePct)}%`; break;
                    case 'TEMP': valNum = weatherData.temp; valText = `${Math.round(valNum)}°`; break;
                    case 'HUM': valNum = weatherData.humidity; valText = `${Math.round(valNum)}%`; break;
                    case 'WIND': valNum = weatherData.windSpeed; valText = `${Math.round(valNum)}`; break;
                    case 'TIME': 
                        const h = Math.floor(simulatedTime % 24);
                        const m = Math.floor((simulatedTime % 1) * 60);
                        valText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`; 
                        break;
                }
                
                // Override label if user typed explicit text (and not using placeholder)
                if (w.label && !w.valueSource) valText = w.label;

                // --- WIDGET TYPES ---
                switch(w.type) {
                    case WidgetType.ARC_GAUGE: {
                        // Embedded-style arc (drawArc)
                        const radius = 40;
                        const start = Math.PI * 0.75; // 135 deg
                        const range = Math.PI * 1.5;  // 270 deg span
                        
                        // Background Track
                        ctx.beginPath();
                        ctx.arc(0, 0, radius, start, start + range);
                        ctx.strokeStyle = w.color2 || '#333';
                        ctx.lineWidth = w.thickness || 8;
                        ctx.lineCap = 'round';
                        ctx.stroke();

                        // Active Value
                        const pct = Math.max(0, Math.min(100, valNum)) / 100;
                        if (pct > 0) {
                            ctx.beginPath();
                            ctx.arc(0, 0, radius, start, start + (range * pct));
                            ctx.strokeStyle = c;
                            ctx.lineWidth = w.thickness || 8;
                            ctx.lineCap = 'round';
                            ctx.stroke();
                        }
                        
                        // Center Value
                        ctx.fillStyle = c;
                        ctx.font = "bold 16px sans-serif";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(Math.round(valNum).toString(), 0, 5);
                        break;
                    }

                    case WidgetType.RADIAL_COMPASS: {
                        // Wind Direction or Tide Trend
                        const angle = w.valueSource === 'WIND' 
                             ? (weatherData.windDir * Math.PI / 180) 
                             : (trend === 1 ? -Math.PI/2 : Math.PI/2); // Up/Down for Tide
                        
                        ctx.rotate(angle);
                        
                        // Draw Arrow
                        ctx.fillStyle = c;
                        ctx.beginPath();
                        ctx.moveTo(0, -20);
                        ctx.lineTo(8, 8);
                        ctx.lineTo(0, 4);
                        ctx.lineTo(-8, 8);
                        ctx.fill();
                        
                        // Label N
                        ctx.rotate(-angle); // Reset for text
                        ctx.fillStyle = w.color2 || '#666';
                        ctx.font = "10px sans-serif";
                        ctx.textAlign = "center";
                        ctx.fillText("N", 0, -30);
                        break;
                    }

                    case WidgetType.GRAPH_LINE: {
                        // Mini history graph
                        const W = 60; const H = 30;
                        ctx.fillStyle = w.color2 || 'rgba(255,255,255,0.1)';
                        ctx.fillRect(-W/2, -H/2, W, H);
                        
                        ctx.strokeStyle = c;
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        for(let x=0; x<=W; x+=5) {
                            // Fake Sine Data based on time
                            const y = Math.sin((x + simulatedTime*10)*0.1) * (H/2 - 2);
                            if(x===0) ctx.moveTo(-W/2 + x, y);
                            else ctx.lineTo(-W/2 + x, y);
                        }
                        ctx.stroke();
                        break;
                    }

                    case WidgetType.DIGITAL_CLOCK: {
                        ctx.font = `${w.fontFamily || 'monospace'} 42px bold`;
                        ctx.fillStyle = c;
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(valText, 0, 0);
                        break;
                    }
                    
                    case WidgetType.ANALOG_CLOCK: {
                        const h = simulatedTime % 12;
                        const m = (simulatedTime % 1) * 60;
                        const s = (simulatedTime * 60) % 60; // Simulation speed fast
                        
                        // Hour
                        ctx.save();
                        ctx.rotate((h * Math.PI/6) + (m * Math.PI/360) - Math.PI/2);
                        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(25,0); 
                        ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
                        ctx.restore();
                        
                        // Minute
                        ctx.save();
                        ctx.rotate((m * Math.PI/30) - Math.PI/2);
                        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(40,0); 
                        ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
                        ctx.restore();
                        
                        // Second (Accent)
                        ctx.save();
                        ctx.rotate((s * Math.PI/30) - Math.PI/2);
                        ctx.beginPath(); ctx.moveTo(-5,0); ctx.lineTo(45,0); 
                        ctx.strokeStyle = w.color2 || '#ef4444'; ctx.lineWidth = 1; ctx.stroke();
                        ctx.beginPath(); ctx.arc(0,0,2,0,Math.PI*2); ctx.fillStyle=w.color2||'#ef4444'; ctx.fill();
                        ctx.restore();
                        break;
                    }

                    case WidgetType.TEXT_VALUE: {
                        // Big Value
                        ctx.fillStyle = c;
                        ctx.font = "bold 28px sans-serif";
                        ctx.textAlign = "center";
                        ctx.fillText(valText, 0, 0);
                        
                        // Label
                        if (w.label) {
                            ctx.fillStyle = w.color2 || '#888';
                            ctx.font = "10px sans-serif";
                            ctx.fillText(w.label.toUpperCase(), 0, 18);
                        }
                        break;
                    }

                    case WidgetType.TEXT_SIMPLE: {
                        ctx.fillStyle = c;
                        ctx.font = "14px sans-serif";
                        ctx.textAlign = "center";
                        ctx.fillText(w.label || "TEXT", 0, 0);
                        break;
                    }

                    case WidgetType.ICON_WEATHER: {
                        // Simple vector icons
                        ctx.fillStyle = c;
                        ctx.beginPath();
                        if (weatherData.isDay) {
                            ctx.arc(0,0,12,0,Math.PI*2); ctx.fill(); // Sun
                            ctx.strokeStyle = c; ctx.lineWidth = 2;
                            for(let i=0; i<8; i++) {
                                ctx.save(); ctx.rotate(i*Math.PI/4);
                                ctx.moveTo(16,0); ctx.lineTo(20,0); ctx.stroke();
                                ctx.restore();
                            }
                        } else {
                            ctx.arc(0,0,12,0,Math.PI*2); ctx.fill(); 
                            ctx.globalCompositeOperation = 'destination-out';
                            ctx.beginPath(); ctx.arc(6,-6,10,0,Math.PI*2); ctx.fill();
                            ctx.globalCompositeOperation = 'source-over';
                        }
                        break;
                    }
                    
                    case WidgetType.ICON_WIFI: {
                        ctx.fillStyle = c;
                        ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill();
                        ctx.strokeStyle = c; ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.arc(0,0,10,Math.PI, 0); ctx.stroke();
                        ctx.beginPath(); ctx.arc(0,0,16,Math.PI, 0); ctx.stroke();
                        break;
                    }

                    case WidgetType.GRID_BACKGROUND: {
                        drawGrid(ctx, 240, 240, displayConfig.theme);
                        break;
                    }

                    case WidgetType.RING_OUTER: {
                         ctx.beginPath();
                         ctx.arc(0, 0, 115, 0, Math.PI*2);
                         ctx.strokeStyle = c;
                         ctx.lineWidth = w.thickness || 2;
                         ctx.stroke();
                         break;
                    }
                    
                    case WidgetType.AI_IMAGE: {
                         if (w.imageUrl) {
                             if (!imageCache.current[w.id]) {
                                 const img = new Image();
                                 img.src = w.imageUrl;
                                 imageCache.current[w.id] = img;
                             }
                             const img = imageCache.current[w.id];
                             if (img && img.complete) {
                                 const width = w.w || img.width;
                                 const height = w.h || img.height;
                                 ctx.drawImage(img, -width/2, -height/2, width, height);
                             }
                         }
                         break;
                    }
                }

                // Selection Highlight
                if (selectedWidgetId === w.id) {
                    ctx.strokeStyle = '#f59e0b'; // Amber
                    ctx.lineWidth = 2 / w.scale;
                    ctx.setLineDash([4, 2]);
                    ctx.strokeRect(-20, -20, 40, 40); // Approx bounding box
                    ctx.setLineDash([]);
                }

                ctx.restore();
            });

            // Restore Clip
            ctx.restore(); 

            // Simulate Glass Glare
            if (displayConfig.simulateSunlight) {
                const glare = ctx.createLinearGradient(0, 0, 240, 240);
                glare.addColorStop(0, 'rgba(255,255,255,0.15)');
                glare.addColorStop(0.4, 'rgba(255,255,255,0)');
                glare.addColorStop(1, 'rgba(255,255,255,0.05)');
                ctx.fillStyle = glare;
                ctx.beginPath(); ctx.arc(CX, CY, CX, 0, Math.PI*2); ctx.fill();
            }

            requestAnimationFrame(render);
        };
        const raf = requestAnimationFrame(render);
        return () => cancelAnimationFrame(raf);
    }, [displayWidgets, selectedWidgetId, simulatedTime, keyframes, displayConfig, weatherData, firmwareConfig]);

    return (
        <div className="flex flex-col items-center bg-slate-900 rounded-lg border border-slate-700 p-6 relative overflow-hidden">
             
             <div className="relative rounded-full bg-slate-950 p-1 shadow-2xl border-[12px] border-slate-800 ring-1 ring-slate-700 cursor-pointer" onClick={() => setSelectedWidgetId(null)}>
                 <div className="w-[240px] h-[240px] rounded-full overflow-hidden bg-black relative shadow-inner">
                     <canvas ref={canvasRef} width={240} height={240} className="w-full h-full" />
                 </div>
             </div>
             
             <div className="mt-4 text-[10px] text-slate-500 font-mono text-center">
                 RENDERIZAÇÃO SIMULADA: {displayConfig.driver}
             </div>
        </div>
    );
};
