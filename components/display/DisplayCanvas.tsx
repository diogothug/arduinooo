
import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../../store';
import { WidgetType, DisplayType, DisplayTheme } from '../../types';
import { Monitor } from 'lucide-react';
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

        // Calc Tide Logic
        let currentHeight = 50;
        if (keyframes.length >= 2) {
             let start = keyframes[0];
             let end = keyframes[keyframes.length - 1];
             const cycle = firmwareConfig.cycleDuration || 24;
             // Handle wrapping for simulation loop
             const t = simulatedTime % cycle;
             
             for (let i = 0; i < keyframes.length - 1; i++) {
               if (t >= keyframes[i].timeOffset && t <= keyframes[i + 1].timeOffset) {
                 start = keyframes[i];
                 end = keyframes[i + 1];
                 break;
               }
             }
             
             let duration = end.timeOffset - start.timeOffset;
             if (duration < 0) duration += cycle;
             
             let elapsed = t - start.timeOffset;
             if (elapsed < 0) elapsed += cycle;
             
             const progress = duration === 0 ? 0 : elapsed / duration;
             currentHeight = start.height + (end.height - start.height) * progress;
        }

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // --- OLED MODE ---
            if (displayConfig.type === DisplayType.OLED_128) {
                 ctx.save();
                 ctx.scale(240/128, 240/128); 
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
            } else if (displayConfig.theme === DisplayTheme.SOL_MORERE) {
                 bgGrad.addColorStop(0, '#fff7ed'); bgGrad.addColorStop(1, '#ffedd5');
            } else if (displayConfig.theme === DisplayTheme.NOITE_TROPICAL) {
                 bgGrad.addColorStop(0, '#1e1b4b'); bgGrad.addColorStop(1, '#0f172a');
            } else if (displayConfig.theme === DisplayTheme.OCEAN_TURQUOISE) {
                 bgGrad.addColorStop(0, '#0891b2'); bgGrad.addColorStop(1, '#164e63');
            } else {
                 bgGrad.addColorStop(0, '#1a1a1a'); bgGrad.addColorStop(1, '#000000');
            }
            
            ctx.fillStyle = bgGrad; ctx.fill();
            
            // Sunlight Glare Simulation
            if (displayConfig.simulateSunlight) {
                const glare = ctx.createLinearGradient(0, 0, 240, 240);
                glare.addColorStop(0, 'rgba(255,255,255,0.1)');
                glare.addColorStop(0.5, 'rgba(255,255,255,0)');
                glare.addColorStop(1, 'rgba(255,255,255,0.05)');
                ctx.fillStyle = glare; ctx.fill();
            }

            ctx.clip();
            
            // Widgets Loop
            const sortedWidgets = [...displayWidgets].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
            sortedWidgets.forEach(widget => {
                if (!widget.visible) return;
                ctx.save();
                ctx.translate(widget.x, widget.y);
                ctx.scale(widget.scale, widget.scale);
                if (widget.rotation) ctx.rotate(widget.rotation * Math.PI / 180);
                if (widget.opacity !== undefined) ctx.globalAlpha = widget.opacity;
                
                const color = displayConfig.simulateRGB565 ? toRGB565Color(widget.color) : widget.color;
                ctx.fillStyle = color;
                ctx.strokeStyle = color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                switch (widget.type) {
                    case WidgetType.TIDE_GAUGE:
                        // Simple Bar Gauge
                        const fillY = 120 - ((currentHeight / 100) * 240);
                        ctx.fillStyle = color; 
                        ctx.fillRect(-120, fillY - 120, 240, 240); // Offset by translate
                        break;
                        
                    case WidgetType.TIDE_FILL:
                         // Wave Fill Effect
                         const waveH = (1 - (currentHeight/100)) * 240 - 120;
                         ctx.beginPath();
                         ctx.moveTo(-120, waveH);
                         for(let i=0; i<=240; i+=10) {
                             ctx.lineTo(-120 + i, waveH + Math.sin((i + Date.now()/20)*0.05) * 5);
                         }
                         ctx.lineTo(120, 120);
                         ctx.lineTo(-120, 120);
                         ctx.fill();
                         break;

                    case WidgetType.TEXT_LABEL:
                    case WidgetType.WEATHER_TEMP_TEXT:
                    case WidgetType.WEATHER_HUMIDITY_TEXT:
                    case WidgetType.WEATHER_WIND_TEXT:
                    case WidgetType.WEATHER_CONDITION_TEXT:
                    case WidgetType.STATUS_WIFI_TEXT:
                    case WidgetType.STATUS_BLE_TEXT:
                        let text = widget.label || "TXT";
                        if (widget.type === WidgetType.WEATHER_TEMP_TEXT) text = `${Math.round(weatherData.temp)}°C`;
                        if (widget.type === WidgetType.WEATHER_HUMIDITY_TEXT) text = `${weatherData.humidity}%`;
                        if (widget.type === WidgetType.WEATHER_WIND_TEXT) text = `${Math.round(weatherData.windSpeed)} km/h`;
                        if (widget.type === WidgetType.WEATHER_CONDITION_TEXT) text = weatherData.conditionText;
                        if (widget.type === WidgetType.STATUS_WIFI_TEXT) text = "WiFi OK";
                        if (widget.type === WidgetType.STATUS_BLE_TEXT) text = "BLE OK";
                        
                        // Replace placeholders
                        text = text.replace("%VAL%", Math.round(currentHeight).toString());
                        text = text.replace("%TEMP%", Math.round(weatherData.temp).toString());
                        
                        ctx.font = `bold 24px sans-serif`;
                        ctx.fillText(text, 0, 0);
                        break;

                    case WidgetType.CLOCK_DIGITAL:
                        const dh = Math.floor(simulatedTime % 24);
                        const dm = Math.floor((simulatedTime % 1) * 60);
                        const dStr = `${dh.toString().padStart(2,'0')}:${dm.toString().padStart(2,'0')}`;
                        ctx.font = `bold 40px monospace`;
                        ctx.fillText(dStr, 0, 0);
                        break;

                    case WidgetType.CLOCK_ANALOG:
                         const ah = (simulatedTime % 12);
                         const am = (simulatedTime % 1) * 60;
                         // Face
                         ctx.beginPath(); ctx.arc(0,0, 50, 0, Math.PI*2); 
                         ctx.lineWidth = 2; ctx.stroke();
                         // Hour Hand
                         ctx.save();
                         ctx.rotate((ah * Math.PI / 6) + (am * Math.PI / 360) - Math.PI/2);
                         ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(30,0); 
                         ctx.lineWidth=4; ctx.stroke();
                         ctx.restore();
                         // Minute Hand
                         ctx.save();
                         ctx.rotate((am * Math.PI / 30) - Math.PI/2);
                         ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(45,0); 
                         ctx.lineWidth=2; ctx.stroke();
                         ctx.restore();
                         break;

                    case WidgetType.TIDE_RADAR:
                         // Circle with arrow pointing to tide state
                         ctx.beginPath(); ctx.arc(0,0, 40, 0, Math.PI*2); ctx.stroke();
                         ctx.save();
                         // 0% = Bottom (Low), 50% = Right/Left?, 100% = Top (High)
                         // Let's map 0..100 to -PI/2 (Bottom) to PI/2 (Top) ?? 
                         // Standard gauge: 0=Bottom, 100=Top.
                         const angle = Math.PI - ((currentHeight/100) * Math.PI); // 0 -> PI (Bottom), 100 -> 0 (Top) -- Simple gauge 180
                         // Let's do Full Circle: 0(Low) -> 12(High)
                         // 0% -> PI/2 (Bottom), 100% -> -PI/2 (Top)
                         const radAngle = (Math.PI/2) - ((currentHeight/100) * Math.PI); 
                         ctx.rotate(radAngle);
                         ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(35, 0); 
                         ctx.lineWidth=3; ctx.stroke();
                         ctx.restore();
                         ctx.font='10px sans-serif';
                         ctx.fillText("H", 0, -50); ctx.fillText("L", 0, 50);
                         break;
                    
                    case WidgetType.MOON_PHASE:
                         ctx.beginPath(); ctx.arc(0,0, 30, 0, Math.PI*2); ctx.fill();
                         ctx.fillStyle = 'rgba(0,0,0,0.7)';
                         // Simple shadow simulation based on illumination
                         const phase = weatherData.moonIllumination / 100;
                         const offset = (phase - 0.5) * 60; 
                         ctx.beginPath(); ctx.ellipse(offset, 0, 30 * (1-phase), 30, 0, 0, Math.PI*2);
                         ctx.fill();
                         break;

                    case WidgetType.ICON_WEATHER:
                         if (weatherData.isDay) {
                             // Sun
                             ctx.beginPath(); ctx.arc(0,0, 20, 0, Math.PI*2); ctx.fill();
                             for(let i=0; i<8; i++) {
                                 ctx.save(); ctx.rotate(i*Math.PI/4);
                                 ctx.beginPath(); ctx.moveTo(25,0); ctx.lineTo(35,0); ctx.stroke();
                                 ctx.restore();
                             }
                         } else {
                             // Moon
                             ctx.beginPath(); ctx.arc(-5,0, 20, 0, Math.PI*2); ctx.fill();
                             ctx.globalCompositeOperation = 'destination-out';
                             ctx.beginPath(); ctx.arc(10, -5, 15, 0, Math.PI*2); ctx.fill();
                             ctx.globalCompositeOperation = 'source-over';
                         }
                         break;

                    case WidgetType.WIND_VECTOR:
                         ctx.save();
                         ctx.rotate((weatherData.windDir || 0) * Math.PI / 180);
                         ctx.beginPath(); 
                         ctx.moveTo(0, -20); ctx.lineTo(10, 10); ctx.lineTo(0, 5); ctx.lineTo(-10, 10); 
                         ctx.closePath(); ctx.fill();
                         ctx.restore();
                         ctx.font = '10px sans-serif';
                         ctx.fillText("N", 0, -30);
                         break;

                    case WidgetType.STATUS_WIFI_ICON:
                         ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fill();
                         ctx.beginPath(); ctx.arc(0, 0, 15, Math.PI, 0); ctx.stroke();
                         ctx.beginPath(); ctx.arc(0, 0, 25, Math.PI, 0); ctx.stroke();
                         break;

                    case WidgetType.STATUS_BLE_ICON:
                         ctx.beginPath(); 
                         ctx.moveTo(0,-15); ctx.lineTo(0,15); 
                         ctx.moveTo(0,-15); ctx.lineTo(10,-5); ctx.lineTo(-10,5); ctx.lineTo(10,15); ctx.lineTo(0,5);
                         ctx.stroke();
                         break;

                    case WidgetType.AI_IMAGE:
                         if (widget.imageUrl) {
                             if (!imageCache.current[widget.id]) {
                                 const img = new Image();
                                 img.src = widget.imageUrl;
                                 imageCache.current[widget.id] = img;
                             }
                             const img = imageCache.current[widget.id];
                             if (img && img.complete) {
                                 // Draw centered, roughly 100x100 base size
                                 try {
                                     ctx.drawImage(img, -50, -50, 100, 100);
                                 } catch(e) {
                                     ctx.fillText("ERR", 0, 0);
                                 }
                             } else {
                                 ctx.fillText("LOADING...", 0, 0);
                             }
                         }
                         break;
                }
                
                if (selectedWidgetId === widget.id) {
                    ctx.strokeStyle = '#f59e0b'; 
                    ctx.lineWidth = 2 / widget.scale; 
                    ctx.setLineDash([5, 3]);
                    ctx.strokeRect(-60, -60, 120, 120);
                    ctx.setLineDash([]);
                }
                ctx.restore();
            });

            ctx.restore();
            requestAnimationFrame(render);
        };
        const raf = requestAnimationFrame(render);
        return () => cancelAnimationFrame(raf);
    }, [displayWidgets, selectedWidgetId, simulatedTime, keyframes, displayConfig, weatherData, firmwareConfig]);

    return (
        <div className="flex flex-col items-center justify-center bg-slate-900 rounded-lg border border-slate-700 p-8 relative overflow-hidden h-full">
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
