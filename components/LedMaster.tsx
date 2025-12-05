
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { Zap, Settings, AlertTriangle, Lightbulb, BoxSelect, CloudRain, Wind, Thermometer, Moon, Activity, Waves, Info, AlignLeft } from 'lucide-react';

// Animation Presets Definition
const PRESETS = [
    { id: 'TIDE_FILL', label: 'Nível Maré (Fill)', icon: <Waves size={16}/>, desc: 'Enchimento vertical baseado na maré atual.' },
    { id: 'TIDE_GRAPH', label: 'Gráfico Maré', icon: <Activity size={16}/>, desc: 'Curva de maré ao longo do tempo (Matriz).', matrixOnly: true },
    { id: 'OCEAN_WAVES', label: 'Ondas Dinâmicas', icon: <Waves size={16}/>, desc: 'Simulação fluída de ondas com vento.', matrixOnly: true },
    { id: 'SCROLL_INFO', label: 'Info Ticker', icon: <AlignLeft size={16}/>, desc: 'Rolagem de dados: Temp, Vento, Maré.', matrixOnly: true },
    { id: 'MOON_PHASE', label: 'Fase da Lua', icon: <Moon size={16}/>, desc: 'Visualização da iluminação lunar.', matrixOnly: true },
    { id: 'WEATHER_ICON', label: 'Condição Clima', icon: <CloudRain size={16}/>, desc: 'Ícone pixel-art do clima atual.', matrixOnly: true },
    { id: 'WIND_COMPASS', label: 'Bússola Vento', icon: <Wind size={16}/>, desc: 'Direção e intensidade do vento.', matrixOnly: false },
    { id: 'TEMP_HEATMAP', label: 'Termômetro', icon: <Thermometer size={16}/>, desc: 'Gradiente de cor baseado na temperatura.' },
    { id: 'RAINBOW', label: 'Demo Arco-íris', icon: <Lightbulb size={16}/>, desc: 'Ciclo de cores para teste de hardware.' },
];

export const LedMaster: React.FC = () => {
    const { firmwareConfig, updateFirmwareConfig, keyframes, simulatedTime, weatherData } = useAppStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const [activeAnimation, setActiveAnimation] = useState<string>('TIDE_FILL');

    // Power Calculation
    const maxCurrent = (firmwareConfig.ledCount * 60) / 1000; // 60mA per LED max white
    const typicalCurrent = (firmwareConfig.ledCount * 60 * (firmwareConfig.ledBrightness / 255)) / 1000;
    
    // Suggest PSU
    let psuSuggestion = "5V 1A";
    if (typicalCurrent > 1 && typicalCurrent <= 2.5) psuSuggestion = "5V 3A";
    if (typicalCurrent > 2.5 && typicalCurrent <= 5) psuSuggestion = "5V 6A";
    if (typicalCurrent > 5) psuSuggestion = "5V 10A+ (Injeção de Energia)";

    // Helper: Interpolate Tide Height for a specific time
    const getTideHeightAt = (time: number) => {
        if (keyframes.length < 2) return 50;
        // Normalize time to cycle
        const cycle = firmwareConfig.cycleDuration || 24;
        let t = time % cycle;
        if (t < 0) t += cycle;

        let start = keyframes[0];
        let end = keyframes[keyframes.length - 1];
        
        // Find segment
        for (let i = 0; i < keyframes.length - 1; i++) {
            if (t >= keyframes[i].timeOffset && t <= keyframes[i+1].timeOffset) {
                start = keyframes[i];
                end = keyframes[i+1];
                break;
            }
        }
        
        // Handle wrap-around logic roughly
        if (t > keyframes[keyframes.length-1].timeOffset) {
             start = keyframes[keyframes.length-1];
             end = keyframes[0];
        }

        let duration = end.timeOffset - start.timeOffset;
        if (duration < 0) duration += cycle;
        if (duration === 0) return start.height;

        let offset = t - start.timeOffset;
        if (offset < 0) offset += cycle;

        const progress = offset / duration;
        return start.height + (end.height - start.height) * progress;
    };

    // Initialize Text Canvas
    useEffect(() => {
        if (!textCanvasRef.current) {
            textCanvasRef.current = document.createElement('canvas');
        }
    }, []);

    // Animation Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        const width = canvas.width;
        const height = canvas.height;

        const render = () => {
            // Background
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, width, height);

            const count = firmwareConfig.ledCount;
            const layout = firmwareConfig.ledLayoutType;
            const matrixW = firmwareConfig.ledMatrixWidth || 10;
            const matrixH = Math.ceil(count / matrixW);
            const brightness = firmwareConfig.ledBrightness / 255;
            const time = Date.now();

            // Prepare Data
            const tideLevel = getTideHeightAt(simulatedTime); // 0-100
            
            // Text Buffer Logic for SCROLL_INFO
            let textPixels: Uint8ClampedArray | null = null;
            if (activeAnimation === 'SCROLL_INFO' && layout === 'MATRIX' && textCanvasRef.current) {
                const tx = textCanvasRef.current;
                tx.width = matrixW;
                tx.height = matrixH;
                const txCtx = tx.getContext('2d', { willReadFrequently: true });
                if (txCtx) {
                    txCtx.fillStyle = '#000';
                    txCtx.fillRect(0, 0, matrixW, matrixH);
                    
                    const infoText = `Maré: ${tideLevel.toFixed(0)}%  Temp: ${Math.round(weatherData.temp)}C  Vento: ${Math.round(weatherData.windSpeed)}km/h  `;
                    txCtx.font = 'bold 8px monospace';
                    txCtx.textBaseline = 'middle';
                    txCtx.fillStyle = '#fff';
                    
                    const textWidth = txCtx.measureText(infoText).width;
                    const speed = 0.005; // pixels per ms
                    const scrollPos = matrixW - ((time * speed) % (textWidth + matrixW));
                    
                    txCtx.fillText(infoText, scrollPos, matrixH / 2 + 1);
                    textPixels = txCtx.getImageData(0, 0, matrixW, matrixH).data;
                }
            }

            for (let i = 0; i < count; i++) {
                let x = 0, y = 0, size = 10;
                let col = 0, row = 0; // Matrix coords
                
                // --- POSITION LOGIC ---
                if (layout === 'STRIP') {
                    const margin = 20;
                    const usableWidth = width - (margin * 2);
                    const spacing = usableWidth / (count - 1 || 1);
                    x = margin + (i * spacing);
                    y = height / 2;
                    size = Math.min(spacing * 0.8, 15);
                    col = i; row = 0;
                } 
                else if (layout === 'MATRIX') {
                    const cellW = width / matrixW;
                    const cellH = height / matrixH;
                    row = Math.floor(i / matrixW);
                    col = i % matrixW;
                    
                    // Serpentine Check
                    if (row % 2 !== 0) col = (matrixW - 1) - col;

                    x = (col * cellW) + (cellW / 2);
                    y = (row * cellH) + (cellH / 2);
                    size = Math.min(cellW, cellH) * 0.7;
                }
                else if (layout === 'RING') {
                    const cx = width / 2;
                    const cy = height / 2;
                    const radius = Math.min(width, height) * 0.35;
                    const angle = (i / count) * Math.PI * 2 - Math.PI/2;
                    x = cx + Math.cos(angle) * radius;
                    y = cy + Math.sin(angle) * radius;
                    size = 8;
                    col = i; row = 0;
                }

                // --- COLOR / PRESET LOGIC ---
                let r = 0, g = 0, b = 0;

                switch (activeAnimation) {
                    case 'TIDE_FILL':
                        // Simple level fill
                        const limit = Math.floor(count * (tideLevel / 100));
                        if (layout === 'MATRIX') {
                             // Fill from bottom up
                             const effectiveRow = matrixH - 1 - row;
                             const waterLevel = (tideLevel / 100) * matrixH;
                             if (effectiveRow < waterLevel) {
                                 r = 0; g = 100; b = 255;
                                 if (effectiveRow > waterLevel - 1) { // Top layer foam
                                     r=100; g=200; b=255; 
                                 }
                             }
                        } else {
                            if (i < limit) {
                                r = 0; g = map(i,0,count, 50, 150); b = 255;
                            }
                        }
                        break;
                    
                    case 'OCEAN_WAVES':
                         if (layout === 'MATRIX') {
                             const effectiveRow = matrixH - 1 - row;
                             const baseLevel = (tideLevel / 100) * matrixH;
                             
                             // Wave mechanics
                             const waveSpeed = 0.005 + (weatherData.windSpeed * 0.0001);
                             const waveAmp = 0.5 + (weatherData.windSpeed * 0.02);
                             const waveFreq = 0.5;
                             
                             const wave1 = Math.sin((col * waveFreq) + (time * waveSpeed)) * waveAmp;
                             const wave2 = Math.cos((col * 0.3) - (time * waveSpeed * 1.5)) * (waveAmp * 0.5);
                             
                             const surfaceY = baseLevel + wave1 + wave2;
                             
                             if (effectiveRow < surfaceY) {
                                 // Gradient depth
                                 const depth = surfaceY - effectiveRow;
                                 if (depth < 1.5) { // Foam
                                    r=150; g=230; b=255;
                                 } else { // Deep water
                                    r=0; g=50 + (100/depth); b=150 + (100/depth);
                                 }
                             }
                         } else {
                             // Strip wave
                             const wavePos = (Math.sin(i * 0.5 + time * 0.005) + 1) * 0.5; // 0-1
                             r=0; g=Math.floor(wavePos*100); b=200;
                         }
                        break;

                    case 'SCROLL_INFO':
                        if (layout === 'MATRIX' && textPixels) {
                            // Map i (linear index) to x,y in the canvas buffer
                            // i maps to row, col calculated above
                            // But textPixels is row-major 1D array of RGBA
                            const pxIndex = (row * matrixW + col) * 4;
                            const val = textPixels[pxIndex]; // R channel (since we drew white on black)
                            if (val > 50) {
                                // Color based on variable mapping logic or just Cyan
                                r=0; g=200; b=255; 
                            }
                        } else {
                             // Fallback for strip - just a scanner
                             const pos = Math.floor((time / 50) % count);
                             if (Math.abs(i-pos) < 3) { r=255; g=255; b=255; }
                        }
                        break;

                    case 'TIDE_GRAPH':
                        // Only really works on Matrix
                        if (layout === 'MATRIX') {
                            // Map column to time: Center col is current time.
                            // +/- 6 hours window
                            const centerCol = Math.floor(matrixW / 2);
                            const hoursPerCol = 12 / matrixW; 
                            const colTimeOffset = (col - centerCol) * hoursPerCol;
                            const tAtCol = simulatedTime + colTimeOffset;
                            const hAtCol = getTideHeightAt(tAtCol); // 0-100
                            
                            const rowHeight = (hAtCol / 100) * matrixH;
                            const effectiveRow = matrixH - 1 - row;
                            
                            if (Math.abs(effectiveRow - rowHeight) < 0.8) {
                                r=0; g=255; b=200; // The line
                            } else if (effectiveRow < rowHeight) {
                                r=0; g=20; b=80; // Fill below
                            }
                            
                            // Center marker
                            if (col === centerCol && effectiveRow === 0) { r=255; g=0; b=0; }
                        } else {
                             // Fallback for strip
                             const val = getTideHeightAt(simulatedTime + (i/count)*12);
                             r=0; g=Math.floor(val*2); b=255;
                        }
                        break;

                    case 'MOON_PHASE':
                        if (layout === 'MATRIX') {
                             // Draw circle
                             const cx = matrixW/2 - 0.5;
                             const cy = matrixH/2 - 0.5;
                             const d = Math.sqrt((col-cx)**2 + (row-cy)**2);
                             const rad = Math.min(matrixW, matrixH) * 0.4;
                             
                             if (d < rad) {
                                 // Base Moon
                                 r=200; g=200; b=200;
                                 
                                 // Phase Logic
                                 const illum = weatherData.moonIllumination; // 0-100
                                 const phaseVal = illum / 100;
                                 
                                 // Simple waxing/waning simulation by sliding a shadow
                                 // Assuming waxing for simplicity of vis
                                 const shadowEdge = (col - (cx - rad)) / (rad * 2);
                                 
                                 // Check moon phase name to decide shadow side?
                                 // Using simple gradient for now
                                 if (shadowEdge > phaseVal) {
                                     r=10; g=10; b=20; 
                                 }
                             }
                        } else {
                            // Strip: Progress bar of moon illum
                            if (i < (weatherData.moonIllumination/100)*count) { r=200; g=200; b=200; }
                        }
                        break;
                    
                    case 'WEATHER_ICON':
                        if (layout === 'MATRIX') {
                            const cond = (weatherData.conditionText || "").toLowerCase();
                            const isDay = weatherData.isDay;
                            
                            const cx = Math.floor(matrixW/2);
                            const cy = Math.floor(matrixH/2);
                            
                            if (cond.includes('chuva') || cond.includes('rain') || cond.includes('drizzle')) {
                                // Rain animation: drops falling
                                const dropSpeed = 100;
                                const dropOffset = Math.floor(time / dropSpeed);
                                if ((col + row + dropOffset) % 4 === 0) { r=0; g=0; b=255; }
                                // Dark background cloud top
                                if (row < 2) { r=50; g=50; b=50; }
                            } 
                            else if (cond.includes('nuve') || cond.includes('cloud') || cond.includes('overcast')) {
                                // Moving clouds
                                const cloudMove = Math.floor(time / 500);
                                if (row > matrixH/4 && row < matrixH*0.7) {
                                    // Perlin-ish noise
                                    if ((col + cloudMove + row*3) % 5 !== 0) {
                                        r=150; g=150; b=150; 
                                    }
                                }
                            } 
                            else if (isDay) {
                                // Rotating Sun
                                const d = Math.sqrt((col-cx)**2 + (row-cy)**2);
                                if (d < matrixH/3) { r=255; g=200; b=0; } // Core
                                // Rays
                                const angle = Math.atan2(row-cy, col-cx);
                                const rot = time * 0.002;
                                if (d >= matrixH/3 && Math.sin(angle*5 + rot) > 0.5) {
                                    r=200; g=150; b=0;
                                }
                            } 
                            else {
                                // Clear Night (Twinkling Stars)
                                // Use prime numbers for randomness simulation based on index and time
                                const seed = (i * 12345 + Math.floor(time / 200)) % 100;
                                if (seed > 95) { r=255; g=255; b=255; }
                            }
                        } else {
                             // Strip: Color code
                             const cond = (weatherData.conditionText || "").toLowerCase();
                             if (cond.includes('rain')) { r=0;g=0;b=255; }
                             else if (cond.includes('cloud')) { r=100;g=100;b=100; }
                             else if (weatherData.isDay) { r=255;g=150;b=0; }
                             else { r=10;g=0;b=50; }
                        }
                        break;

                    case 'WIND_COMPASS':
                        // Wind Direction arrow
                        const angle = (weatherData.windDir - 90) * (Math.PI / 180);
                        const speedInt = Math.min(weatherData.windSpeed * 5, 255);
                        
                        if (layout === 'MATRIX') {
                            const cx = matrixW/2 - 0.5;
                            const cy = matrixH/2 - 0.5;
                            // Vector from center to pixel
                            const dx = col - cx;
                            const dy = row - cy;
                            const dist = Math.sqrt(dx*dx + dy*dy);
                            const pAngle = Math.atan2(dy, dx);
                            
                            // Check angular difference
                            let diff = pAngle - angle;
                            while(diff < -Math.PI) diff += Math.PI*2;
                            while(diff > Math.PI) diff -= Math.PI*2;
                            
                            if (Math.abs(diff) < 0.6 && dist < matrixH/2) {
                                r = 255 - Math.floor(Math.abs(diff)*200);
                                g = Math.floor(speedInt);
                                b = Math.floor(speedInt);
                            }
                        } else if (layout === 'RING') {
                            const ledAngle = (i / count) * Math.PI * 2;
                             let diff = ledAngle - (weatherData.windDir * Math.PI / 180);
                             while(diff < -Math.PI) diff += Math.PI*2;
                             while(diff > Math.PI) diff -= Math.PI*2;
                             
                             if (Math.abs(diff) < 0.5) {
                                 r = 255; g = Math.floor(speedInt); b = 0;
                             }
                        } else {
                            // Strip
                            r = Math.floor(speedInt); g = Math.floor(speedInt); b = 255;
                        }
                        break;
                    
                    case 'TEMP_HEATMAP':
                        const temp = weatherData.temp; // 0-40 typically
                        // Blue (15) -> Green (25) -> Red (35)
                        if (temp < 20) {
                            r = 0; g = map(temp, 10, 20, 0, 255); b = 255;
                        } else if (temp < 30) {
                            r = map(temp, 20, 30, 0, 255); g = 255; b = map(temp, 20, 30, 255, 0);
                        } else {
                            r = 255; g = map(temp, 30, 40, 255, 0); b = 0;
                        }
                        
                        // Add some noise/texture
                        if (Math.random() > 0.9) { r+=20; g+=20; b+=20; }
                        break;

                    case 'RAINBOW':
                    default:
                        const hue = (i * 10 + (time * 0.1)) % 360;
                        if (hue < 120) { r=255; g=Math.floor(hue*2); b=0; }
                        else if (hue < 240) { r=0; g=255; b=Math.floor((hue-120)*2); }
                        else { r=Math.floor((hue-240)*2); g=0; b=255; }
                        break;
                }

                // Apply Brightness & Clamp
                r = Math.min(255, Math.max(0, r * brightness));
                g = Math.min(255, Math.max(0, g * brightness));
                b = Math.min(255, Math.max(0, b * brightness));

                // Draw LED
                ctx.beginPath();
                ctx.arc(x, y, size/2, 0, Math.PI*2);
                ctx.fillStyle = `rgb(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)})`;
                ctx.fill();
                
                // Glow
                if (r+g+b > 50) {
                    const glow = ctx.createRadialGradient(x, y, size/2, x, y, size*1.5);
                    glow.addColorStop(0, `rgba(${r},${g},${b},0.4)`);
                    glow.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = glow;
                    ctx.beginPath(); ctx.arc(x,y,size*1.5, 0, Math.PI*2); ctx.fill();
                }
            }

            animationFrameId = requestAnimationFrame(render);
        };
        render();
        return () => cancelAnimationFrame(animationFrameId);
    }, [activeAnimation, firmwareConfig, simulatedTime, weatherData, keyframes]);

    const map = (x: number, in_min: number, in_max: number, out_min: number, out_max: number) => {
        return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full p-2">
            
            {/* Left Col: Config & Wiring */}
            <div className="flex flex-col gap-6">
                
                {/* 1. Config Card */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Settings size={20} className="text-cyan-400" /> Configuração Hardware
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-slate-500 font-bold uppercase block mb-1">Pino GPIO</label>
                            <select 
                                value={firmwareConfig.ledPin}
                                onChange={(e) => updateFirmwareConfig({ledPin: parseInt(e.target.value)})}
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm"
                            >
                                {[2,4,5,12,13,14,15,16,17,18,19,21,22,23,25,26,27,32,33].map(p => (
                                    <option key={p} value={p}>GPIO {p}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 font-bold uppercase block mb-1">Qtd. LEDs</label>
                            <input 
                                type="number" 
                                value={firmwareConfig.ledCount}
                                onChange={(e) => updateFirmwareConfig({ledCount: parseInt(e.target.value)})}
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 font-bold uppercase block mb-1">Layout</label>
                            <select 
                                value={firmwareConfig.ledLayoutType}
                                onChange={(e) => updateFirmwareConfig({ledLayoutType: e.target.value as any})}
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm"
                            >
                                <option value="STRIP">Fita Linear</option>
                                <option value="MATRIX">Matriz 2D</option>
                                <option value="RING">Anel</option>
                            </select>
                        </div>
                        {firmwareConfig.ledLayoutType === 'MATRIX' && (
                            <div>
                                <label className="text-xs text-slate-500 font-bold uppercase block mb-1">Largura Matriz</label>
                                <input 
                                    type="number" 
                                    value={firmwareConfig.ledMatrixWidth || 10}
                                    onChange={(e) => updateFirmwareConfig({ledMatrixWidth: parseInt(e.target.value)})}
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm"
                                />
                            </div>
                        )}
                        <div className="col-span-2">
                             <label className="text-xs text-slate-500 font-bold uppercase block mb-1 flex justify-between">
                                 <span>Brilho Global</span>
                                 <span>{Math.round((firmwareConfig.ledBrightness/255)*100)}%</span>
                             </label>
                             <input 
                                type="range" min="0" max="255" 
                                value={firmwareConfig.ledBrightness}
                                onChange={(e) => updateFirmwareConfig({ledBrightness: parseInt(e.target.value)})}
                                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Power Calculator */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Zap size={16} className="text-yellow-400" /> Energia & Fonte
                    </h3>
                    <div className="flex items-center justify-between bg-slate-900 p-3 rounded border border-slate-700 mb-3">
                        <div className="text-xs text-slate-500">Estimativa Corrente</div>
                        <div className="text-lg font-mono text-green-400 font-bold">{typicalCurrent.toFixed(2)} A</div>
                    </div>
                    <div className="text-[10px] text-yellow-200 bg-yellow-900/20 p-2 rounded border border-yellow-900/50 flex items-start gap-2">
                        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                        <span>Sugestão: Fonte <strong>{psuSuggestion}</strong>. Se > 1A, use alimentação externa.</span>
                    </div>
                </div>

            </div>

            {/* Right Col: Layout & Preview */}
            <div className="flex flex-col gap-6">
                
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 flex-1 flex flex-col">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <BoxSelect size={20} className="text-blue-400" /> Simulador Visual
                        </h3>
                        <div className="text-[10px] bg-slate-900 px-2 py-1 rounded text-slate-400 font-mono">
                             {firmwareConfig.ledLayoutType} {firmwareConfig.ledLayoutType === 'MATRIX' ? `${firmwareConfig.ledMatrixWidth}x${Math.ceil(firmwareConfig.ledCount/(firmwareConfig.ledMatrixWidth||1))}` : `${firmwareConfig.ledCount} LEDs`}
                        </div>
                     </div>

                     <div className="flex-1 bg-black rounded-lg border-2 border-slate-700 relative overflow-hidden flex items-center justify-center p-4 shadow-inner">
                         <canvas ref={canvasRef} width={400} height={300} className="max-w-full max-h-full object-contain" />
                         
                         {/* Environment Overlay info */}
                         <div className="absolute top-2 left-2 flex flex-col gap-1 pointer-events-none">
                              {activeAnimation === 'WIND_COMPASS' && (
                                  <span className="text-[10px] text-blue-300 bg-blue-900/50 px-1 rounded">Vento: {weatherData.windDir}° {weatherData.windSpeed}km/h</span>
                              )}
                              {activeAnimation === 'TEMP_HEATMAP' && (
                                  <span className="text-[10px] text-red-300 bg-red-900/50 px-1 rounded">Temp: {weatherData.temp}°C</span>
                              )}
                              {(activeAnimation === 'TIDE_FILL' || activeAnimation === 'TIDE_GRAPH' || activeAnimation === 'OCEAN_WAVES') && (
                                  <span className="text-[10px] text-cyan-300 bg-cyan-900/50 px-1 rounded">Maré: {getTideHeightAt(simulatedTime).toFixed(1)}%</span>
                              )}
                         </div>
                     </div>

                     <div className="mt-4">
                         <p className="text-xs text-slate-400 font-bold uppercase mb-2">Galeria de Presets</p>
                         <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                             {PRESETS.map(preset => {
                                 const isDisabled = preset.matrixOnly && firmwareConfig.ledLayoutType !== 'MATRIX';
                                 return (
                                    <button 
                                        key={preset.id}
                                        onClick={() => setActiveAnimation(preset.id)}
                                        disabled={isDisabled}
                                        className={`flex flex-col items-start p-2 rounded border text-left transition relative overflow-hidden group ${
                                            activeAnimation === preset.id 
                                            ? 'bg-cyan-900/30 border-cyan-500 text-white' 
                                            : isDisabled 
                                                ? 'bg-slate-900 border-slate-800 text-slate-600 opacity-50 cursor-not-allowed'
                                                : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500 hover:bg-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1 text-xs font-bold">
                                            {preset.icon}
                                            {preset.label}
                                        </div>
                                        <div className="text-[9px] opacity-70 leading-tight">
                                            {isDisabled ? "Requer Matriz" : preset.desc}
                                        </div>
                                        {activeAnimation === preset.id && (
                                            <div className="absolute right-0 top-0 p-1">
                                                <div className="w-2 h-2 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50 animate-pulse"></div>
                                            </div>
                                        )}
                                    </button>
                                 );
                             })}
                         </div>
                     </div>
                </div>

            </div>
        </div>
    );
};
