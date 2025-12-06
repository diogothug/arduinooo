
import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../../store';
import { WidgetType, DisplayTheme, DisplayType } from '../../types';
import { Plus, Circle, Wind, Mic, Droplets, Sun, Grid, Eye, Monitor } from 'lucide-react';
import { renderOledModern } from './OledRenderer';

const toRGB565Color = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex;
    let r = parseInt(result[1], 16) & 0xF8;
    let g = parseInt(result[2], 16) & 0xFC;
    let b = parseInt(result[3], 16) & 0xF8;
    return `rgb(${r},${g},${b})`;
};

interface DisplayCanvasProps {
    selectedWidgetId: string | null;
    setSelectedWidgetId: (id: string | null) => void;
}

export const DisplayCanvas: React.FC<DisplayCanvasProps> = ({ selectedWidgetId, setSelectedWidgetId }) => {
    const { 
        displayConfig, setDisplayConfig, displayWidgets, addDisplayWidget,
        simulatedTime, keyframes, weatherData, firmwareConfig
    } = useAppStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageCache = useRef<Record<string, HTMLImageElement>>({});

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Calc Tide Logic
        let currentHeight = 50;
        if (keyframes.length >= 2) {
             let start = keyframes[0];
             let end = keyframes[keyframes.length - 1];
             for (let i = 0; i < keyframes.length - 1; i++) {
               if (simulatedTime >= keyframes[i].timeOffset && simulatedTime <= keyframes[i + 1].timeOffset) {
                 start = keyframes[i];
                 end = keyframes[i + 1];
                 break;
               }
             }
             const duration = end.timeOffset - start.timeOffset;
             const progress = duration === 0 ? 0 : (simulatedTime - start.timeOffset) / duration;
             currentHeight = start.height + (end.height - start.height) * progress;
        }

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // --- OLED MODE ---
            if (displayConfig.type === DisplayType.OLED_128) {
                 // Force scale context for 128x128 inside the 240x240 canvas for preview
                 ctx.save();
                 ctx.scale(240/128, 240/128); // Upscale for preview visibility
                 renderOledModern({
                     ctx,
                     tidePercent: currentHeight,
                     weatherData,
                     time: simulatedTime
                 });
                 ctx.restore();
                 requestAnimationFrame(render);
                 return; 
            }

            // --- STANDARD GC9A01 MODE (240x240) ---
            ctx.save();
            ctx.beginPath(); ctx.arc(120, 120, 120, 0, Math.PI * 2);
            
            // Background
            let bgGrad = ctx.createRadialGradient(120, 120, 0, 120, 120, 120);
            if (displayConfig.theme === DisplayTheme.CORAL_REEF) {
                 bgGrad.addColorStop(0, '#0077BE'); bgGrad.addColorStop(1, '#004488');
            } else {
                 bgGrad.addColorStop(0, '#1a1a1a'); bgGrad.addColorStop(1, '#000000');
            }
            ctx.fillStyle = bgGrad; ctx.fill();
            ctx.clip();
            
            // Widgets Loop
            const sortedWidgets = [...displayWidgets].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
            sortedWidgets.forEach(widget => {
                if (!widget.visible) return;
                ctx.save();
                ctx.translate(widget.x, widget.y);
                ctx.scale(widget.scale, widget.scale);
                if (widget.rotation) ctx.rotate(widget.rotation * Math.PI / 180);
                
                const color = displayConfig.simulateRGB565 ? toRGB565Color(widget.color) : widget.color;
                
                if (widget.type === WidgetType.TIDE_GAUGE) {
                    const fillY = 120 - ((currentHeight / 100) * 240);
                    ctx.fillStyle = color; ctx.fillRect(-120, fillY, 240, 240);
                } else if (widget.type === WidgetType.TEXT_LABEL) {
                    ctx.fillStyle = color; ctx.textAlign='center'; ctx.fillText(widget.label || "TXT", 0, 0);
                }
                
                if (selectedWidgetId === widget.id) {
                    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.strokeRect(-50, -50, 100, 100);
                }
                ctx.restore();
            });

            ctx.restore();
            requestAnimationFrame(render);
        };
        const raf = requestAnimationFrame(render);
        return () => cancelAnimationFrame(raf);
    }, [displayWidgets, selectedWidgetId, simulatedTime, keyframes, displayConfig, weatherData]);

    return (
        <div className="flex flex-col items-center justify-center bg-slate-900 rounded-lg border border-slate-700 p-8 relative overflow-hidden">
             <div className="absolute top-4 left-4 flex gap-2 z-10">
                 <button onClick={() => setDisplayConfig({ type: displayConfig.type === DisplayType.GC9A01_240 ? DisplayType.OLED_128 : DisplayType.GC9A01_240 })} 
                         className={`p-2 rounded flex gap-2 items-center text-xs font-bold ${displayConfig.type === DisplayType.OLED_128 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                     <Monitor size={16} /> {displayConfig.type === DisplayType.OLED_128 ? 'OLED 128px' : 'GC9A01 240px'}
                 </button>
             </div>
             
             <div className="relative rounded-full bg-slate-950 p-1 shadow-2xl border-[12px] border-slate-800 ring-1 ring-slate-700 cursor-pointer" onClick={() => setSelectedWidgetId(null)}>
                 <div className="w-[240px] h-[240px] rounded-full overflow-hidden bg-black relative shadow-inner">
                     <canvas ref={canvasRef} width={240} height={240} className="w-full h-full" />
                 </div>
             </div>
        </div>
    );
};
