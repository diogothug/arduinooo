

import React, { useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '../../store';
import { WidgetType, DisplayTheme } from '../../types';
import { Plus, Circle, Wind, Mic, Droplets, Sun, Grid, Eye } from 'lucide-react';

// Helper for RGB565 Approximation
const toRGB565Color = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex;
    let r = parseInt(result[1], 16);
    let g = parseInt(result[2], 16);
    let b = parseInt(result[3], 16);
    // Mask lower bits to simulate 5-6-5 range
    r = r & 0xF8;
    g = g & 0xFC;
    b = b & 0xF8;
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
    
    // Theme Random Seeds
    const randomSeed = useRef(new Array(50).fill(0).map(() => Math.random()));

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Simulation Data Calculation
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
            // 1. CLEAR
            ctx.clearRect(0, 0, 240, 240);
            
            // 2. SAVE STATE BEFORE CLIPPING
            ctx.save();

            // 3. DEFINE CIRCULAR MASK & BACKGROUND
            ctx.beginPath();
            ctx.arc(120, 120, 120, 0, Math.PI * 2);
            
            // Draw Background Gradient (clipped automatically by arc shape if we fill)
            let bgGrad = ctx.createRadialGradient(120, 120, 0, 120, 120, 120);
            const time = Date.now() / 1000;

            switch(displayConfig.theme) {
                case DisplayTheme.SOL_MORERE:
                case DisplayTheme.SUNSET_BAHIA:
                    bgGrad.addColorStop(0, '#f97316');
                    bgGrad.addColorStop(0.5, '#c2410c');
                    bgGrad.addColorStop(1, '#451a03');
                    break;
                case DisplayTheme.AZUL_OCEANO:
                case DisplayTheme.OCEAN_TURQUOISE:
                    bgGrad.addColorStop(0, '#0e7490');
                    bgGrad.addColorStop(1, '#020617');
                    break;
                case DisplayTheme.NOITE_TROPICAL:
                case DisplayTheme.STARRY_NIGHT:
                    bgGrad.addColorStop(0, '#1e1b4b');
                    bgGrad.addColorStop(1, '#000000');
                    break;
                case DisplayTheme.TROPICAL_STORM:
                    bgGrad.addColorStop(0, '#475569');
                    bgGrad.addColorStop(1, '#0f172a');
                    break;
                case DisplayTheme.MORERE_MINIMAL:
                    bgGrad.addColorStop(0, '#000000');
                    bgGrad.addColorStop(1, '#000000');
                    break;
                case DisplayTheme.CYBER_GRID:
                    bgGrad.addColorStop(0, '#220022');
                    bgGrad.addColorStop(1, '#110011');
                    break;
                case DisplayTheme.VORTEX:
                    bgGrad.addColorStop(0, '#1a1a2e');
                    bgGrad.addColorStop(1, '#000000');
                    break;
                case DisplayTheme.JELLYFISH_JAM:
                     bgGrad.addColorStop(0, '#0f172a');
                     bgGrad.addColorStop(1, '#020617');
                     break;
                case DisplayTheme.DIGITAL_RAIN:
                     bgGrad.addColorStop(0, '#020e02');
                     bgGrad.addColorStop(1, '#000000');
                     break;
                case DisplayTheme.NEON_RIPPLES:
                     bgGrad.addColorStop(0, '#000000');
                     bgGrad.addColorStop(1, '#0a0a0a');
                     break;
                case DisplayTheme.RETRO_SUNSET:
                     bgGrad.addColorStop(0, '#2a0a2a');
                     bgGrad.addColorStop(1, '#1a051a');
                     break;
                case DisplayTheme.CORAL_REEF:
                     bgGrad.addColorStop(0, '#0077BE');
                     bgGrad.addColorStop(1, '#004488');
                     break;
                default:
                    bgGrad.addColorStop(0, '#1a1a1a');
                    bgGrad.addColorStop(1, '#000000');
            }
            ctx.fillStyle = bgGrad;
            ctx.fill();

            // Apply Clip for everything else
            ctx.clip();
            
            // --- ANIMATED BACKGROUNDS ---

            if (displayConfig.theme === DisplayTheme.STARRY_NIGHT) {
                ctx.fillStyle = '#ffffff';
                for(let i=0; i<40; i++) {
                    const x = (Math.sin(i * 132 + time * 0.05) + 1) * 120;
                    const y = (Math.cos(i * 45 + time * 0.05) + 1) * 120;
                    const size = (Math.sin(time * 2 + i) + 1.5) * 0.8;
                    ctx.beginPath(); ctx.arc(x,y, size, 0, Math.PI*2); ctx.fill();
                }
            }
            else if (displayConfig.theme === DisplayTheme.CORAL_REEF) {
                // Bubbles and Sand
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                for(let i=0; i<20; i++) {
                    const x = 120 + Math.sin(time + i) * (i*5);
                    const y = ((time * 50 + i * 40) % 260) - 20; // Upwards
                    ctx.beginPath(); ctx.arc(x, 240-y, 2 + (i%3), 0, Math.PI*2); ctx.fill();
                }
                // Sand dune
                ctx.fillStyle = '#F4D79B';
                ctx.beginPath();
                ctx.moveTo(0, 240);
                for(let x=0; x<=240; x+=10) {
                     ctx.lineTo(x, 210 + Math.sin(x*0.03)*10);
                }
                ctx.lineTo(240, 240);
                ctx.fill();
                // Coral
                ctx.fillStyle = '#FF6B6B';
                ctx.beginPath(); ctx.arc(180, 200, 15, 0, Math.PI, true); ctx.fill();
                ctx.fillStyle = '#8B5A2B';
                ctx.beginPath(); ctx.rect(40, 215, 30, 20); ctx.fill();
            }
            else if (displayConfig.theme === DisplayTheme.CYBER_GRID) {
                // Retro Grid
                ctx.strokeStyle = '#d946ef'; // Fuchsia
                ctx.lineWidth = 1;
                const perspective = (Date.now() % 1000) / 1000;
                
                // Horizon lines moving down
                for(let i=0; i<8; i++) {
                    const y = 120 + Math.pow((i + perspective)/8, 2) * 120;
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(240, y); 
                    ctx.globalAlpha = 0.2 + (i/10); ctx.stroke();
                }
                
                // Vertical perspective lines
                ctx.beginPath();
                for(let i=-6; i<=6; i++) {
                    ctx.moveTo(120, 120); 
                    ctx.lineTo(120 + i*60, 240);
                }
                ctx.stroke();
                
                // Sun
                ctx.fillStyle = '#f59e0b';
                ctx.globalAlpha = 1;
                ctx.beginPath(); ctx.arc(120, 100, 30, Math.PI, 0); ctx.fill();
            }
            else if (displayConfig.theme === DisplayTheme.VORTEX) {
                const spirals = 5;
                const rot = time;
                for(let i=0; i<spirals; i++) {
                    ctx.strokeStyle = i%2===0 ? '#3b82f6' : '#8b5cf6';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    for(let j=0; j<50; j++) {
                        const angle = (j * 0.5) + rot + (i * (Math.PI*2/spirals));
                        const radius = j * 3;
                        const x = 120 + Math.cos(angle) * radius;
                        const y = 120 + Math.sin(angle) * radius;
                        if(j===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
                    }
                    ctx.stroke();
                }
            }
            else if (displayConfig.theme === DisplayTheme.JELLYFISH_JAM) {
                 // Floating Particles
                 for(let i=0; i<15; i++) {
                     const y = ((time * 20 + i * 30) % 260) - 10;
                     const x = 120 + Math.sin(time + i) * 50;
                     ctx.fillStyle = `hsla(${time*10 + i*20}, 70%, 60%, 0.5)`;
                     ctx.beginPath(); ctx.arc(x, y, 4 + Math.sin(time*2 + i)*2, 0, Math.PI*2); ctx.fill();
                     // Tail
                     ctx.strokeStyle = ctx.fillStyle;
                     ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y+15); ctx.stroke();
                 }
            }
            else if (displayConfig.theme === DisplayTheme.DIGITAL_RAIN) {
                ctx.font = '10px monospace';
                const cols = 24;
                for(let i=0; i<cols; i++) {
                    const speed = 1 + randomSeed.current[i];
                    const y = ((time * 40 * speed) % 300) - 50;
                    const x = i * 10;
                    ctx.fillStyle = '#0f0';
                    ctx.globalAlpha = 0.8;
                    ctx.fillText(String.fromCharCode(0x30A0 + Math.floor(Math.random()*96)), x, y);
                    ctx.fillStyle = '#050';
                    ctx.globalAlpha = 0.4;
                    for(let j=1; j<5; j++) ctx.fillText(String.fromCharCode(0x30A0 + Math.floor(Math.random()*96)), x, y - j*12);
                }
            }
            else if (displayConfig.theme === DisplayTheme.NEON_RIPPLES) {
                const ripples = 6;
                ctx.lineWidth = 2;
                for(let i=0; i<ripples; i++) {
                    const r = ((time * 30) + i * (120/ripples)) % 140;
                    const alpha = 1 - (r/140);
                    ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
                    ctx.beginPath(); ctx.arc(120, 120, r, 0, Math.PI*2); ctx.stroke();
                }
            }
            else if (displayConfig.theme === DisplayTheme.RETRO_SUNSET) {
                // Sun
                const sunY = 160;
                const sunSize = 50;
                const grad = ctx.createLinearGradient(0, sunY-sunSize, 0, sunY+sunSize);
                grad.addColorStop(0, '#fcd34d');
                grad.addColorStop(1, '#dc2626');
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(120, sunY, sunSize, 0, Math.PI*2); ctx.fill();
                
                // Cuts in sun
                ctx.fillStyle = '#1a051a'; // Background color
                for(let i=0; i<8; i++) {
                    const h = 2 + i;
                    const y = sunY - 10 + i * 8;
                    ctx.fillRect(120 - sunSize, y, sunSize*2, h);
                }

                // Grid Floor
                ctx.strokeStyle = '#ec4899';
                ctx.lineWidth = 1;
                ctx.beginPath();
                // Verticals
                for(let i=-10; i<=10; i++) {
                    ctx.moveTo(120, 160);
                    ctx.lineTo(120 + i*40, 240);
                }
                // Horizontals
                const speed = (time * 0.5) % 1;
                for(let i=0; i<6; i++) {
                    const y = 160 + Math.pow((i+speed)/6, 2) * 80;
                    ctx.moveTo(0, y); ctx.lineTo(240, y);
                }
                ctx.stroke();
            }

            // 4. WIDGETS
            const sortedWidgets = [...displayWidgets].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

            sortedWidgets.forEach(widget => {
                if (!widget.visible) return;

                ctx.save();
                ctx.translate(widget.x, widget.y);
                ctx.scale(widget.scale, widget.scale);
                
                if (widget.rotation) {
                    ctx.rotate(widget.rotation * Math.PI / 180);
                }
                
                if (widget.opacity !== undefined) {
                    ctx.globalAlpha = widget.opacity;
                }

                // Apply RGB565 effect if enabled
                const color = displayConfig.simulateRGB565 ? toRGB565Color(widget.color) : widget.color;

                // --- WIDGET RENDER LOGIC ---
                if (widget.type === WidgetType.TIDE_GAUGE) {
                    const fillY = 120 - ((currentHeight / 100) * 240);
                    const grad = ctx.createLinearGradient(0, -120, 0, 120);
                    grad.addColorStop(0, color);
                    grad.addColorStop(1, '#000000');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    const waveAmp = 5; const waveFreq = 0.05; const phase = Date.now() * 0.005;
                    ctx.moveTo(-120, fillY);
                    for(let x = -120; x <= 120; x+=5) ctx.lineTo(x, fillY + Math.sin(x * waveFreq + phase) * waveAmp);
                    ctx.lineTo(120, 120); ctx.lineTo(-120, 120);
                    ctx.closePath(); ctx.fill();
                } 
                else if (widget.type === WidgetType.TIDE_FILL) {
                    ctx.beginPath();
                    ctx.arc(0, 0, 120, 0, Math.PI * 2);
                    // Don't clip here, we are already clipped by main display
                    const level = currentHeight / 100;
                    const waterHeight = 240 * level;
                    const yOffset = 120 - waterHeight;
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    const time = Date.now() * 0.003;
                    ctx.moveTo(-120, yOffset);
                    for (let x = -120; x <= 120; x+=5) {
                        const y = yOffset + Math.sin(x * 0.03 + time) * 10 * (1-level);
                        ctx.lineTo(x, y);
                    }
                    ctx.lineTo(120, 120);
                    ctx.lineTo(-120, 120);
                    ctx.fill();
                }
                else if (widget.type === WidgetType.TIDE_RING) {
                    const thickness = widget.thickness || 10;
                    const radius = 100;
                    const startAngle = -Math.PI / 2;
                    const endAngle = startAngle + (Math.PI * 2 * (currentHeight / 100));
                    ctx.beginPath();
                    ctx.arc(0, 0, radius, 0, Math.PI * 2);
                    ctx.strokeStyle = '#334155';
                    ctx.lineWidth = thickness;
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(0, 0, radius, startAngle, endAngle);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = thickness;
                    ctx.lineCap = 'round';
                    ctx.stroke();
                }
                else if (widget.type === WidgetType.WIND_VECTOR) {
                    const dir = weatherData.windDir; 
                    ctx.rotate(dir * Math.PI / 180);
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.moveTo(0, -40); ctx.lineTo(20, 20); ctx.lineTo(0, 10); ctx.lineTo(-20, 20);
                    ctx.closePath(); ctx.fill();
                }
                else if (widget.type === WidgetType.SOUND_PULSE) {
                    const beat = (Math.sin(Date.now() / 150) + 1) / 2;
                    ctx.strokeStyle = color; ctx.lineWidth = 2;
                    for(let i=1; i<=3; i++) {
                        ctx.beginPath(); ctx.arc(0,0, 30 * i * beat + 20, 0, Math.PI*2);
                        ctx.globalAlpha = (1 - beat) / i; ctx.stroke();
                    }
                }
                else if (widget.type === WidgetType.TIDE_RADAR) {
                    ctx.fillStyle = color;
                    const rising = keyframes.length > 0; // Simplified logic
                    if (rising) {
                       ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(15, 10); ctx.lineTo(-15, 10); ctx.fill();
                    }
                }
                else if (widget.type === WidgetType.MOON_PHASE) {
                    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.fillStyle = '#334155'; ctx.fill();
                    // Basic Moon Illumination visual
                    const illum = weatherData.moonIllumination || 50;
                    const phaseWidth = (illum / 100) * 40;
                    
                    ctx.beginPath(); 
                    ctx.arc(0, 0, 20, 0, Math.PI*2); 
                    ctx.fillStyle = color; 
                    
                    // Simple rect mask for phase approximation in canvas
                    ctx.save();
                    ctx.clip(); 
                    ctx.fillRect(-20, -20, phaseWidth, 40);
                    ctx.restore();
                }
                else if (widget.type === WidgetType.TEXT_LABEL) {
                    ctx.fillStyle = color;
                    ctx.font = `bold ${widget.scale * 20}px "Segoe UI", sans-serif`;
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    let text = widget.label || "TEXTO";
                    if (text.includes("%VAL%")) text = text.replace("%VAL%", `${Math.round(currentHeight)}%`);
                    if (text.includes("%TEMP%")) text = text.replace("%TEMP%", `${weatherData.temp}°C`);
                    ctx.fillText(text, 0, 0);
                }
                else if (widget.type === WidgetType.CLOCK_DIGITAL) {
                     const h = Math.floor(simulatedTime % 24);
                     const m = Math.floor((simulatedTime % 1) * 60);
                     const timeStr = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
                     ctx.fillStyle = color;
                     ctx.font = '700 36px "Courier New", monospace';
                     ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                     ctx.fillText(timeStr, 0, 0);
                }
                else if (widget.type === WidgetType.CLOCK_ANALOG) {
                    ctx.strokeStyle = color; ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.arc(0,0, 98, 0, Math.PI*2); ctx.stroke();
                    const h = simulatedTime % 12; const hAng = (h * Math.PI / 6) - Math.PI/2;
                    const m = (simulatedTime % 1) * 60; const mAng = (m * Math.PI / 30) - Math.PI/2;
                    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(hAng)*50, Math.sin(hAng)*50); ctx.stroke();
                    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(mAng)*75, Math.sin(mAng)*75); ctx.stroke();
                }
                else if (widget.type === WidgetType.MINI_CHART) {
                    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath();
                    const w = 100; const h = 40; const startX = -w/2;
                    for(let i=0; i<=w; i+=5) {
                        const y = Math.sin((i + Date.now()/50)/15) * (h/2);
                        if(i===0) ctx.moveTo(startX + i, y); else ctx.lineTo(startX + i, y);
                    }
                    ctx.stroke();
                }
                else if (widget.type === WidgetType.ICON_WEATHER) {
                    ctx.fillStyle = color;
                    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill();
                    ctx.strokeStyle = color; ctx.lineWidth = 2;
                    for(let i=0; i<8; i++) {
                        ctx.save(); ctx.rotate(i * Math.PI/4); ctx.beginPath(); ctx.moveTo(20,0); ctx.lineTo(25,0); ctx.stroke(); ctx.restore();
                    }
                }
                // --- NEW V2.2 STATUS WIDGETS ---
                else if (widget.type === WidgetType.STATUS_WIFI_ICON) {
                    // WiFi Arcs
                    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.arc(0, 10, 5, Math.PI, 0); ctx.stroke();
                    ctx.beginPath(); ctx.arc(0, 10, 12, Math.PI, 0); ctx.stroke();
                    ctx.beginPath(); ctx.arc(0, 10, 20, Math.PI, 0); ctx.stroke();
                    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 10, 2, 0, Math.PI*2); ctx.fill();
                }
                else if (widget.type === WidgetType.STATUS_WIFI_TEXT) {
                    ctx.fillStyle = color;
                    ctx.textAlign = 'center'; ctx.font = '10px monospace';
                    ctx.fillText(firmwareConfig.ssid.substring(0,10) + '...', 0, -6);
                    ctx.fillText('192.168.1.10', 0, 6);
                }
                else if (widget.type === WidgetType.STATUS_BLE_ICON) {
                    // Bluetooth Rune
                    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(-7, -12); ctx.lineTo(7, 0); ctx.lineTo(-7, 12); ctx.lineTo(-7, -12); ctx.lineTo(7, 12); ctx.lineTo(-7, 0);
                    ctx.stroke();
                }
                else if (widget.type === WidgetType.STATUS_BLE_TEXT) {
                    ctx.fillStyle = color;
                    ctx.textAlign = 'center'; ctx.font = 'bold 10px sans-serif';
                    ctx.fillText('BLE ACTIVE', 0, -5);
                    ctx.font = '8px monospace';
                    ctx.fillText(firmwareConfig.deviceName, 0, 8);
                }
                else if (widget.type === WidgetType.AI_IMAGE) {
                    if (widget.imageUrl) {
                        // Check cache
                        if (!imageCache.current[widget.imageUrl]) {
                            const img = new Image();
                            img.src = widget.imageUrl;
                            img.onload = () => { imageCache.current[widget.imageUrl!] = img; };
                            // Placeholder while loading
                            ctx.fillStyle = '#333'; ctx.fillRect(-50, -50, 100, 100);
                            ctx.fillStyle = '#fff'; ctx.fillText("LOADING...", 0, 0);
                        } else {
                            const img = imageCache.current[widget.imageUrl];
                            ctx.drawImage(img, -50, -50, 100, 100);
                        }
                    } else {
                        // Placeholder
                        ctx.strokeStyle = color; ctx.setLineDash([5,5]); ctx.strokeRect(-50,-50,100,100);
                        ctx.fillStyle = color; ctx.textAlign='center'; ctx.fillText("AI IMAGE", 0,0);
                    }
                }
                // --- NEW V2.3 GRANULAR WEATHER WIDGETS ---
                else if (widget.type === WidgetType.WEATHER_TEMP_TEXT) {
                    ctx.fillStyle = color;
                    ctx.font = `bold ${widget.scale * 20}px "Segoe UI", sans-serif`;
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(`${Math.round(weatherData.temp)}°C`, 0, 0);
                }
                else if (widget.type === WidgetType.WEATHER_HUMIDITY_TEXT) {
                    ctx.fillStyle = color;
                    ctx.font = `bold ${widget.scale * 20}px "Segoe UI", sans-serif`;
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(`${Math.round(weatherData.humidity)}%`, 0, 0);
                }
                else if (widget.type === WidgetType.WEATHER_WIND_TEXT) {
                    ctx.fillStyle = color;
                    ctx.font = `${widget.scale * 16}px "Segoe UI", sans-serif`;
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(`${Math.round(weatherData.windSpeed)} km/h`, 0, 0);
                }
                else if (widget.type === WidgetType.WEATHER_CONDITION_TEXT) {
                    ctx.fillStyle = color;
                    ctx.font = `${widget.scale * 14}px "Segoe UI", sans-serif`;
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(weatherData.conditionText || "", 0, 0);
                }

                // Selection Box
                if (selectedWidgetId === widget.id) {
                    ctx.strokeStyle = '#f59e0b';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([4, 3]);
                    ctx.strokeRect(-50 * widget.scale, -50 * widget.scale, 100 * widget.scale, 100 * widget.scale); 
                    ctx.setLineDash([]);
                    ctx.beginPath(); ctx.arc(0, -60 * widget.scale, 5, 0, Math.PI*2); ctx.fillStyle = '#f59e0b'; ctx.fill();
                }
                ctx.restore();
            });

            // 5. RESTORE STATE (Removing Clip)
            ctx.restore();

            // 6. POST-PROCESSING (Glare/Grid drawn ON TOP of everything, unaffected by circular clip unless desired)
            if (displayConfig.simulateSunlight) {
                ctx.save();
                ctx.beginPath(); ctx.arc(120, 120, 120, 0, Math.PI*2); ctx.clip();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.fill();
                const glare = ctx.createLinearGradient(0, 0, 240, 240);
                glare.addColorStop(0, 'rgba(255,255,255,0.4)');
                glare.addColorStop(0.5, 'rgba(255,255,255,0)');
                ctx.fillStyle = glare; ctx.fill();
                ctx.restore();
            }
            if (displayConfig.simulatePixelGrid) {
                ctx.save();
                ctx.beginPath(); ctx.arc(120, 120, 120, 0, Math.PI*2); ctx.clip();
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                for(let i=0; i<240; i+=2) ctx.fillRect(i, 0, 1, 240);
                for(let i=0; i<240; i+=2) ctx.fillRect(0, i, 240, 1);
                ctx.restore();
            }
            
            requestAnimationFrame(render);
        };
        const raf = requestAnimationFrame(render);
        return () => cancelAnimationFrame(raf);
    }, [displayWidgets, selectedWidgetId, simulatedTime, keyframes, displayConfig, weatherData, firmwareConfig]);

    const WidgetBtn = ({label, icon, onClick}: any) => (
        <button onClick={onClick} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-full text-[10px] font-bold transition uppercase border border-slate-600">
            {icon} {label}
        </button>
    );

    return (
        <div className="flex flex-col items-center justify-center bg-slate-900 rounded-lg border border-slate-700 p-8 relative overflow-hidden">
             <div className="absolute inset-0 opacity-10 pointer-events-none" style={{backgroundImage: 'radial-gradient(#4b5563 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>

             <div className="absolute top-4 left-4 flex gap-2 z-10">
                 <button onClick={() => setDisplayConfig({ simulateSunlight: !displayConfig.simulateSunlight })} className={`p-2 rounded ${displayConfig.simulateSunlight ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}><Sun size={16} /></button>
                 <button onClick={() => setDisplayConfig({ simulatePixelGrid: !displayConfig.simulatePixelGrid })} className={`p-2 rounded ${displayConfig.simulatePixelGrid ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}><Grid size={16} /></button>
                 <button onClick={() => setDisplayConfig({ simulateRGB565: !displayConfig.simulateRGB565 })} className={`p-2 rounded ${displayConfig.simulateRGB565 ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}><Eye size={16} /></button>
             </div>
             
             <div className="text-xs text-slate-500 font-mono mb-6 z-10 bg-slate-900/80 px-2 rounded">GC9A01 240x240 | {displayConfig.fps} FPS</div>
             
             <div className="relative rounded-full bg-slate-950 p-1 shadow-2xl border-[12px] border-slate-800 ring-1 ring-slate-700 cursor-pointer transition-transform hover:scale-[1.02]" onClick={() => setSelectedWidgetId(null)}>
                 <div className="w-[240px] h-[240px] rounded-full overflow-hidden bg-black relative shadow-inner">
                     <canvas ref={canvasRef} width={240} height={240} className="w-full h-full" />
                     <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 to-transparent pointer-events-none"></div>
                 </div>
             </div>
             
             <div className="mt-8 flex gap-2 flex-wrap justify-center max-w-[400px] z-10">
                 <WidgetBtn label="TEXTO" icon={<Plus size={14}/>} onClick={() => addDisplayWidget({ id: Math.random().toString(), type: WidgetType.TEXT_LABEL, x: 120, y: 120, scale: 1, color: '#fff', label: 'NOVO', visible: true, zIndex: 10 })} />
                 <WidgetBtn label="LÍQUIDO" icon={<Droplets size={14}/>} onClick={() => addDisplayWidget({ id: Math.random().toString(), type: WidgetType.TIDE_FILL, x: 120, y: 120, scale: 1, color: '#3b82f6', visible: true, zIndex: 1 })} />
                 <WidgetBtn label="ANEL" icon={<Circle size={14}/>} onClick={() => addDisplayWidget({ id: Math.random().toString(), type: WidgetType.TIDE_RING, x: 120, y: 120, scale: 1, color: '#2dd4bf', visible: true, zIndex: 2, thickness: 10 })} />
                 <WidgetBtn label="VENTO" icon={<Wind size={14}/>} onClick={() => addDisplayWidget({ id: Math.random().toString(), type: WidgetType.WIND_VECTOR, x: 120, y: 120, scale: 1, color: '#fff', visible: true, zIndex: 5 })} />
                 <WidgetBtn label="SOM" icon={<Mic size={14}/>} onClick={() => addDisplayWidget({ id: Math.random().toString(), type: WidgetType.SOUND_PULSE, x: 120, y: 120, scale: 1, color: '#ef4444', visible: true, zIndex: 1 })} />
                 <WidgetBtn label="LUA" icon={<Circle size={14}/>} onClick={() => addDisplayWidget({ id: Math.random().toString(), type: WidgetType.MOON_PHASE, x: 120, y: 120, scale: 1, color: '#e2e8f0', visible: true, zIndex: 5 })} />
             </div>
        </div>
    );
};