
import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { ConnectionType } from '../types';
import { Zap, Settings, Lightbulb, BoxSelect, CloudRain, Wind, Moon, Activity, Waves, Sun, Sliders, Grid, Upload, Code, Image as ImageIcon, Check, ArrowRightLeft, Eye, EyeOff, PlayCircle, ArrowDown, ArrowRight, MousePointer2, Maximize } from 'lucide-react';
import { hardwareBridge } from '../services/hardwareBridge';
import omggif from 'omggif';

// PREMIUM PRESETS DEFINITION
const PRESETS = [
    { id: 'tideFill2', label: 'Maré Alta Viva', icon: <Waves size={16} className="text-cyan-400"/>, desc: 'Gradiente dinâmico com ondas na superfície.', matrixOnly: false, palette: 0 },
    { id: 'oceanCaustics', label: 'Moreré Lagoon', icon: <Sun size={16} className="text-yellow-400"/>, desc: 'Reflexos de luz no fundo do mar (Simplex Noise).', matrixOnly: true, palette: 0 },
    { id: 'storm', label: 'Tempestade Forte', icon: <CloudRain size={16} className="text-slate-400"/>, desc: 'Turbulência, raios e mar agitado.', matrixOnly: false, palette: 3 }, // Cloud palette
    { id: 'aurora', label: 'Ambiente Aurora', icon: <Wind size={16} className="text-green-400"/>, desc: 'Ondas suaves estilo Boreal para relaxamento.', matrixOnly: true, palette: 1 }, // Forest
    { id: 'deepSea', label: 'Profundezas', icon: <Moon size={16} className="text-indigo-400"/>, desc: 'Partículas flutuantes e plâncton brilhante.', matrixOnly: false, palette: 0 },
    { id: 'neon', label: 'Neon Moreré', icon: <Zap size={16} className="text-purple-400"/>, desc: 'Ciclo de cores Cyberpunk.', matrixOnly: false, palette: 4 }, // Party
];

type TabMode = 'GENERATIVE' | 'PIXEL_ART';
type StripDirection = 'HORIZONTAL' | 'VERTICAL' | 'CUSTOM';

export const LedMaster: React.FC = () => {
    const { firmwareConfig, updateFirmwareConfig, keyframes, simulatedTime, activeDeviceId, connectionType, weatherData } = useAppStore();
    const [activeTab, setActiveTab] = useState<TabMode>('GENERATIVE');

    // --- GEN STATE ---
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animSpeed = firmwareConfig.animationSpeed;
    const animIntensity = firmwareConfig.animationIntensity;
    const activePresetId = firmwareConfig.animationMode;
    
    // Preview Options
    const [stripDirection, setStripDirection] = useState<StripDirection>('HORIZONTAL');
    const [autoSyncWeather, setAutoSyncWeather] = useState(false);
    
    // --- PIXEL ART STATE ---
    const [gridWidth, setGridWidth] = useState(16);
    const [gridHeight, setGridHeight] = useState(16);
    const [pixelFrames, setPixelFrames] = useState<Uint8ClampedArray[]>([]); // Array of RGBA frames
    const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
    const [isGif, setIsGif] = useState(false);
    const [showIndices, setShowIndices] = useState(false);
    
    const pixelCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isSerpentine, setIsSerpentine] = useState(true); 
    const [generatedCode, setGeneratedCode] = useState('');
    const [isSending, setIsSending] = useState(false);

    // BINDINGS
    const setAnimSpeed = (v: number) => updateFirmwareConfig({ animationSpeed: v });
    const setAnimIntensity = (v: number) => updateFirmwareConfig({ animationIntensity: v });
    const setActivePresetId = (id: string, palette: number) => updateFirmwareConfig({ animationMode: id, animationPalette: palette });

    // Power Calculation
    const maxCurrent = (firmwareConfig.ledCount * 60) / 1000;
    const typicalCurrent = (firmwareConfig.ledCount * 60 * (firmwareConfig.ledBrightness / 255)) / 1000;

    // --- PIXEL ART / GIF LOGIC ---
    
    const handleGridSizeChange = (w: number, h: number) => {
        setGridWidth(w);
        setGridHeight(h);
        setPixelFrames([]); // Reset images to avoid mismatch
        setGeneratedCode('');
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type === 'image/gif') {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result instanceof ArrayBuffer) {
                    processGif(new Uint8Array(event.target.result));
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => processStaticImage(img);
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    const processStaticImage = (img: HTMLImageElement) => {
        setIsGif(false);
        const data = extractFrameData(img);
        if (data) {
            setPixelFrames([data]);
            setCurrentFrameIdx(0);
            generateCode([data], isSerpentine);
        }
    };

    const processGif = (gifData: Uint8Array) => {
        try {
            // Fix: Use default export or direct instantiation depending on bundle
            // With esm.sh/omggif, it often exports the object directly or as default
            const reader = new omggif.GifReader(gifData);
            
            const numFrames = reader.numFrames();
            const width = reader.width;
            const height = reader.height;
            
            const frames: Uint8ClampedArray[] = [];
            
            // Helper canvas to decode and resize
            const frameCanvas = document.createElement('canvas');
            frameCanvas.width = width;
            frameCanvas.height = height;
            const frameCtx = frameCanvas.getContext('2d');
            const frameData = frameCtx?.createImageData(width, height);

            if (!frameCtx || !frameData) return;

            for (let i = 0; i < numFrames; i++) {
                // Decode GIF frame to raw pixels
                reader.decodeAndBlitFrameRGBA(i, frameData.data);
                frameCtx.putImageData(frameData, 0, 0);

                // Resize to Grid Size (e.g. 16x16)
                const resized = extractFrameData(frameCanvas);
                if (resized) frames.push(resized);
            }
            
            setIsGif(true);
            setPixelFrames(frames);
            setCurrentFrameIdx(0);
            generateCode(frames, isSerpentine);

        } catch (e: any) {
            console.error(e);
            alert("Erro ao processar GIF. Verifique se o arquivo é válido. " + e.message);
        }
    };

    const extractFrameData = (source: CanvasImageSource): Uint8ClampedArray | null => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = gridWidth;
        offCanvas.height = gridHeight;
        const offCtx = offCanvas.getContext('2d');
        if (!offCtx) return null;

        // Draw with smoothing disabled for Pixel Art look
        offCtx.imageSmoothingEnabled = false;
        offCtx.drawImage(source, 0, 0, gridWidth, gridHeight);
        return offCtx.getImageData(0, 0, gridWidth, gridHeight).data;
    };

    const generateCode = (frames: Uint8ClampedArray[], serpentine: boolean) => {
        const width = gridWidth;
        const height = gridHeight;
        const numLeds = width * height;
        const varName = frames.length > 1 ? 'animation_frames' : 'image_data';

        let code = `// ${width}x${height} ${frames.length > 1 ? 'Animation' : 'Static'} - ${serpentine ? 'Serpentine' : 'Linear'}\n`;
        code += `const uint8_t ${varName}[][${numLeds * 3}] PROGMEM = {\n`;
        
        frames.forEach((data, fIdx) => {
            code += `  { // Frame ${fIdx}\n    `;
            for (let i = 0; i < numLeds; i++) {
                let x, y;
                if (!serpentine) {
                    y = Math.floor(i / width);
                    x = i % width;
                } else {
                    y = Math.floor(i / width);
                    x = (y % 2 === 0) ? (i % width) : ((width - 1) - (i % width));
                }

                const pixelIndex = (y * width + x) * 4;
                const r = data[pixelIndex];
                const g = data[pixelIndex + 1];
                const b = data[pixelIndex + 2];
                
                // GRB Order (Typical WS2812B)
                code += `0x${g.toString(16).padStart(2,'0').toUpperCase()},0x${r.toString(16).padStart(2,'0').toUpperCase()},0x${b.toString(16).padStart(2,'0').toUpperCase()}`;
                if (i < numLeds - 1) code += ',';
            }
            code += `\n  }${fIdx < frames.length - 1 ? ',' : ''}\n`;
        });
        
        code += `};\n`;
        setGeneratedCode(code);
    };

    useEffect(() => {
        if (pixelFrames.length > 0) generateCode(pixelFrames, isSerpentine);
    }, [isSerpentine]);

    const handleSendPixelData = async () => {
        if (pixelFrames.length === 0) return;
        
        if (connectionType === ConnectionType.NONE) {
             alert("Não conectado. Selecione USB, BLE ou WiFi.");
             return;
        }

        setIsSending(true);
        try {
            // Flatten current frame (or handle animation upload logic)
            // For now, sends the current visible frame
            const currentData = pixelFrames[currentFrameIdx];
            const rgbArray = [];
            const totalPixels = gridWidth * gridHeight;
            
            for (let i = 0; i < totalPixels; i++) {
                let x, y;
                if (!isSerpentine) {
                    y = Math.floor(i / gridWidth);
                    x = i % gridWidth;
                } else {
                    y = Math.floor(i / gridWidth);
                    x = (y % 2 === 0) ? (i % gridWidth) : ((gridWidth - 1) - (i % gridWidth));
                }
                const idx = (y * gridWidth + x) * 4;
                rgbArray.push(currentData[idx], currentData[idx+1], currentData[idx+2]);
            }
            
            await hardwareBridge.sendData({
                command: 'setPixels',
                pixels: rgbArray
            }, connectionType as "USB" | "BLE" | "WIFI", '192.168.1.10');
            
            alert("Frame enviado!");
        } catch(e: any) {
            alert("Erro ao enviar: " + e.message);
        } finally {
            setIsSending(false);
        }
    };

    // --- ANIMATION LOOP FOR PREVIEW ---
    useEffect(() => {
        if (activeTab === 'PIXEL_ART' && isGif && pixelFrames.length > 1) {
            const interval = setInterval(() => {
                setCurrentFrameIdx(prev => (prev + 1) % pixelFrames.length);
            }, 100); // 10 FPS default for preview
            return () => clearInterval(interval);
        }
    }, [activeTab, isGif, pixelFrames.length]);

    // --- RENDER LOOPS ---

    // 1. GENERATIVE LOOP
    useEffect(() => {
        if (activeTab !== 'GENERATIVE') return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        
        const getTideHeightAt = (time: number) => {
            if (keyframes.length < 2) return 50;
            const cycle = firmwareConfig.cycleDuration || 24;
            let t = time % cycle;
            let start = keyframes[0];
            let end = keyframes[keyframes.length - 1];
            for (let i = 0; i < keyframes.length - 1; i++) {
                if (t >= keyframes[i].timeOffset && t <= keyframes[i+1].timeOffset) {
                    start = keyframes[i]; end = keyframes[i+1]; break;
                }
            }
            if (t > keyframes[keyframes.length-1].timeOffset) { start = keyframes[keyframes.length-1]; end = keyframes[0]; }
            let duration = end.timeOffset - start.timeOffset; if (duration < 0) duration += cycle;
            let offset = t - start.timeOffset; if (offset < 0) offset += cycle;
            return start.height + (end.height - start.height) * (duration===0?0:offset/duration);
        };

        const render = () => {
            const width = canvas.width;
            const height = canvas.height;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, width, height);

            const count = firmwareConfig.ledCount;
            const layout = firmwareConfig.ledLayoutType;
            const matrixW = firmwareConfig.ledMatrixWidth || 10;
            const matrixH = Math.ceil(count / matrixW);
            const time = Date.now();
            const tideLevel = getTideHeightAt(simulatedTime); 

            // Environment overrides
            let effectiveSpeed = animSpeed;
            let effectiveIntensity = animIntensity;
            
            if (autoSyncWeather) {
                 // Map wind 0-50km/h to 0.1-5.0 speed
                 effectiveSpeed = Math.max(0.1, Math.min(5.0, weatherData.windSpeed / 10));
                 // Map humidity/rain to intensity
                 effectiveIntensity = Math.max(0.2, Math.min(1.0, weatherData.humidity / 100));
            }

            let cellSize = 10;
            let startX = 0;
            let startY = 0;

            if (layout === 'MATRIX') {
                const padding = 20;
                cellSize = Math.min((width - padding*2) / matrixW, (height - padding*2) / matrixH);
                startX = (width - cellSize * matrixW) / 2;
                startY = (height - cellSize * matrixH) / 2;
            }

            for (let i = 0; i < count; i++) {
                let x = 0, y = 0, size = 10;
                let col = 0, row = 0;
                
                if (layout === 'STRIP') {
                    const margin = 30;
                    
                    if (stripDirection === 'HORIZONTAL') {
                        const spacing = (width - margin*2) / (count - 1 || 1);
                        x = margin + (i * spacing);
                        y = height / 2;
                        size = Math.min(spacing * 0.8, 15);
                    } else if (stripDirection === 'VERTICAL') {
                        const spacing = (height - margin*2) / (count - 1 || 1);
                        x = width / 2;
                        // Bottom to top like a gauge
                        y = height - margin - (i * spacing); 
                        size = Math.min(spacing * 0.8, 20);
                    } else if (stripDirection === 'CUSTOM') {
                        // S-Curve / Snake Path simulation
                        const t = i / (count - 1);
                        const angle = t * Math.PI * 4; // 2 loops
                        const radius = 50;
                        x = (width/2 - 150) + (t * 300);
                        y = (height/2) + Math.sin(angle) * radius;
                        size = 8;
                    }

                    col = i; 
                    row = 0;
                } else if (layout === 'MATRIX') {
                    row = Math.floor(i / matrixW);
                    col = i % matrixW;
                    if (row % 2 !== 0) col = (matrixW - 1) - col; 
                    x = startX + (col * cellSize) + (cellSize / 2);
                    y = startY + (row * cellSize) + (cellSize / 2);
                    size = cellSize * 0.8;
                } else if (layout === 'RING') {
                    const radius = Math.min(width, height) * 0.35;
                    const angle = (i / count) * Math.PI * 2 - (Math.PI / 2);
                    x = (width / 2) + Math.cos(angle) * radius;
                    y = (height / 2) + Math.sin(angle) * radius;
                    size = (Math.PI * 2 * radius / count) * 0.8;
                }

                let r = 0, g = 0, b = 0;
                const effRow = (layout === 'STRIP') ? Math.floor((i / count) * 10) : (matrixH - 1 - row);
                const effCol = col;

                // --- ANIMATION GENERATORS ---
                if (activePresetId === 'tideFill2') {
                    // Vertical Fill logic
                    let fillThreshold = 0;
                    if (layout === 'STRIP') {
                        fillThreshold = tideLevel / 100 * count;
                        if (i < fillThreshold) {
                             r = 0; g = 50; b = 150;
                             // Surface ripple
                             if (i > fillThreshold - 2) { r=100; g=200; b=255; }
                        }
                    } else {
                        // Matrix Logic
                        const fillH = (tideLevel / 100) * matrixH;
                        if (effRow < fillH) {
                            r = 0; g = 50 + (effRow * 10); b = 150 + (effRow * 5);
                            if (Math.sin(effCol*0.5 + time*0.005*effectiveSpeed) > 0.5) g += 30;
                            if (effRow > fillH - 1) { r=150; g=200; b=255; }
                        }
                    }
                } else if (activePresetId === 'oceanCaustics') {
                    const scale = 0.2;
                    const val = Math.sin(effCol*scale + time*0.001*effectiveSpeed) + Math.cos(row*scale + time*0.002*effectiveSpeed);
                    const bright = Math.max(0, val * 100 * effectiveIntensity + 50);
                    r=0; g=bright; b=bright+50;
                } else if (activePresetId === 'storm') {
                    const noise = Math.random();
                    if (noise > 0.98 * (1/effectiveIntensity)) { r=255; g=255; b=255; } else { r=20; g=20; b=40; }
                } else if (activePresetId === 'aurora') {
                    const wave = Math.sin(effCol*0.3 + time*0.002*effectiveSpeed) * 100;
                    r=50; g=100 + wave; b=100 - wave;
                } else if (activePresetId === 'neon') {
                    const hue = (time * 0.1 * effectiveSpeed + effCol * 10) % 360;
                    r = hue < 120 ? 255 : 0; g = hue > 60 && hue < 180 ? 255 : 0; b = hue > 180 ? 255 : 0;
                } else {
                    r=0; g=10; b=40; if (Math.random() > 0.99) { r=100; g=200; b=255; }
                }

                const br = firmwareConfig.ledBrightness / 255;
                r*=br; g*=br; b*=br;
                ctx.beginPath(); ctx.arc(x, y, size/2, 0, Math.PI*2); ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill();
            }
            
            // --- DATA OVERLAY (Integration) ---
            ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
            ctx.fillRect(10, 10, 180, 70);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1;
            ctx.strokeRect(10, 10, 180, 70);
            
            ctx.fillStyle = '#fff';
            ctx.font = '10px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(`⚡ MARÉ: ${(tideLevel).toFixed(0)}%`, 20, 20);
            ctx.fillText(`💨 VENTO: ${weatherData.windSpeed} km/h`, 20, 35);
            ctx.fillText(`🌡️ TEMP:  ${weatherData.temp}°C`, 20, 50);
            
            if (autoSyncWeather) {
                 ctx.fillStyle = '#4ade80';
                 ctx.fillText("● SYNC ON", 130, 20);
            }

            animationFrameId = requestAnimationFrame(render);
        };
        render();
        return () => cancelAnimationFrame(animationFrameId);
    }, [activePresetId, firmwareConfig, simulatedTime, animSpeed, animIntensity, activeTab, stripDirection, autoSyncWeather, weatherData]);

    // 2. PIXEL ART PREVIEW LOOP
    useEffect(() => {
        if (activeTab !== 'PIXEL_ART') return;
        const canvas = pixelCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const width = canvas.width;
        const height = canvas.height;
        ctx.fillStyle = '#111';
        ctx.fillRect(0,0,width,height);
        
        // Dynamic scaling
        const scaleX = width / gridWidth;
        const scaleY = height / gridHeight;
        const cellSize = Math.min(scaleX, scaleY);
        const startX = (width - (gridWidth * cellSize)) / 2;
        const startY = (height - (gridHeight * cellSize)) / 2;
        
        if (pixelFrames.length > 0) {
            const currentData = pixelFrames[currentFrameIdx];
            const totalPixels = gridWidth * gridHeight;

            for(let i=0; i<totalPixels; i++) {
                const imgX = i % gridWidth;
                const imgY = Math.floor(i / gridWidth);
                const idx = (imgY * gridWidth + imgX) * 4;
                
                // Safety check for data array bounds
                if (idx + 3 >= currentData.length) continue;

                const r = currentData[idx];
                const g = currentData[idx+1];
                const b = currentData[idx+2];
                const a = currentData[idx+3];
                
                const pxX = startX + imgX * cellSize;
                const pxY = startY + imgY * cellSize;

                // Only draw if opacity > 0
                if (a > 0) {
                    ctx.fillStyle = `rgb(${r},${g},${b})`;
                    ctx.fillRect(pxX, pxY, cellSize, cellSize);
                } else {
                    // Checkboard pattern for transparent
                    ctx.fillStyle = ((imgX+imgY)%2===0) ? '#222' : '#333';
                    ctx.fillRect(pxX, pxY, cellSize, cellSize);
                }
                
                ctx.strokeStyle = '#222';
                ctx.lineWidth = 1;
                ctx.strokeRect(pxX, pxY, cellSize, cellSize);
                
                // Show Index Logic
                if (showIndices && cellSize > 15) {
                    let hwIndex;
                    if (!isSerpentine) {
                        hwIndex = i;
                    } else {
                        if (imgY % 2 === 0) hwIndex = imgY * gridWidth + imgX;
                        else hwIndex = imgY * gridWidth + ((gridWidth - 1) - imgX);
                    }
                    
                    ctx.fillStyle = (r+g+b)/3 > 128 ? '#000' : '#fff';
                    ctx.font = `${Math.max(8, cellSize/3)}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(hwIndex.toString(), pxX + cellSize/2, pxY + cellSize/2);
                }
            }
        } else {
             ctx.fillStyle = '#333';
             ctx.textAlign = 'center';
             ctx.font = '12px sans-serif';
             ctx.fillText("Nenhuma imagem carregada", width/2, height/2);
        }

    }, [pixelFrames, currentFrameIdx, isSerpentine, activeTab, showIndices, gridWidth, gridHeight]);

    return (
        <div className="flex flex-col h-full gap-4">
            {/* TABS */}
            <div className="flex bg-slate-800 p-1 rounded-lg w-fit border border-slate-700">
                <button 
                    onClick={() => setActiveTab('GENERATIVE')}
                    className={`px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition ${activeTab === 'GENERATIVE' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    <Activity size={16} /> Engine Generativo
                </button>
                <button 
                    onClick={() => setActiveTab('PIXEL_ART')}
                    className={`px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition ${activeTab === 'PIXEL_ART' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                    <Grid size={16} /> Pixel Art Studio
                </button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-hidden">
                
                {/* --- GENERATIVE MODE UI --- */}
                {activeTab === 'GENERATIVE' && (
                <>
                    {/* Left Col: Params */}
                    <div className="flex flex-col gap-6 lg:col-span-1 overflow-y-auto pr-2 custom-scrollbar">
                        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Sliders size={20} className="text-cyan-400" /> Parâmetros
                            </h3>
                            
                            <div className="bg-slate-900/50 p-3 rounded mb-4 border border-slate-700">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-white font-bold flex items-center gap-2"><Wind size={12}/> Auto-Sync Clima</span>
                                    <button 
                                        onClick={() => setAutoSyncWeather(!autoSyncWeather)}
                                        className={`w-8 h-4 rounded-full transition-colors relative ${autoSyncWeather ? 'bg-green-500' : 'bg-slate-600'}`}
                                    >
                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${autoSyncWeather ? 'left-4.5' : 'left-0.5'}`}></div>
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-400">
                                    Se ativo, a velocidade e intensidade reagirão ao vento ({weatherData.windSpeed}km/h) e humidade ({weatherData.humidity}%) em tempo real.
                                </p>
                            </div>

                            <div className={`space-y-6 transition-opacity ${autoSyncWeather ? 'opacity-50 pointer-events-none' : ''}`}>
                                <div>
                                    <label className="text-xs text-slate-500 font-bold uppercase block mb-1 flex justify-between">
                                        <span>Velocidade</span>
                                        <span className="text-white">{animSpeed.toFixed(1)}x</span>
                                    </label>
                                    <input type="range" min="0.1" max="5.0" step="0.1" value={animSpeed} onChange={e=>setAnimSpeed(parseFloat(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"/>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 font-bold uppercase block mb-1 flex justify-between">
                                        <span>Intensidade</span>
                                        <span className="text-white">{(animIntensity*100).toFixed(0)}%</span>
                                    </label>
                                    <input type="range" min="0" max="1.0" step="0.05" value={animIntensity} onChange={e=>setAnimIntensity(parseFloat(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"/>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                <Settings size={16} className="text-yellow-400" /> Hardware
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="block text-slate-500 uppercase font-bold">GPIO</span>
                                    <input type="number" value={firmwareConfig.ledPin} onChange={e=>updateFirmwareConfig({ledPin: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white"/>
                                </div>
                                <div>
                                    <span className="block text-slate-500 uppercase font-bold">Total LEDs</span>
                                    <input type="number" value={firmwareConfig.ledCount} onChange={e=>updateFirmwareConfig({ledCount: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white"/>
                                </div>
                                <div className="col-span-2">
                                    <span className="block text-slate-500 uppercase font-bold mb-1">Layout</span>
                                    <div className="flex bg-slate-900 rounded p-1">
                                        {['STRIP', 'MATRIX', 'RING'].map(l => (
                                            <button key={l} onClick={()=>updateFirmwareConfig({ledLayoutType: l as any})} className={`flex-1 py-1 rounded text-[10px] ${firmwareConfig.ledLayoutType === l ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}>{l}</button>
                                        ))}
                                    </div>
                                </div>
                                
                                {firmwareConfig.ledLayoutType === 'STRIP' && (
                                    <div className="col-span-2">
                                        <span className="block text-slate-500 uppercase font-bold mb-1">Orientação Preview</span>
                                        <div className="flex bg-slate-900 rounded p-1 gap-1">
                                            <button onClick={() => setStripDirection('HORIZONTAL')} className={`flex-1 py-1 rounded text-[10px] flex justify-center ${stripDirection === 'HORIZONTAL' ? 'bg-slate-700 text-white' : 'text-slate-500'}`} title="Horizontal"><ArrowRight size={14}/></button>
                                            <button onClick={() => setStripDirection('VERTICAL')} className={`flex-1 py-1 rounded text-[10px] flex justify-center ${stripDirection === 'VERTICAL' ? 'bg-slate-700 text-white' : 'text-slate-500'}`} title="Vertical"><ArrowDown size={14}/></button>
                                            <button onClick={() => setStripDirection('CUSTOM')} className={`flex-1 py-1 rounded text-[10px] flex justify-center ${stripDirection === 'CUSTOM' ? 'bg-slate-700 text-white' : 'text-slate-500'}`} title="Custom Path"><MousePointer2 size={14}/></button>
                                        </div>
                                    </div>
                                )}

                                {firmwareConfig.ledLayoutType === 'MATRIX' && (
                                    <div className="col-span-2">
                                        <span className="block text-slate-500 uppercase font-bold mb-1">Largura da Matriz</span>
                                        <input type="number" value={firmwareConfig.ledMatrixWidth || 10} onChange={e=>updateFirmwareConfig({ledMatrixWidth: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white"/>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Col: Preview */}
                    <div className="lg:col-span-2 flex flex-col gap-6 overflow-hidden">
                        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 flex-1 flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <BoxSelect size={20} className="text-blue-400" /> Live Preview
                                </h3>
                                <div className="flex gap-2">
                                    <div className="text-[10px] bg-slate-900 px-2 py-1 rounded text-green-400 font-mono flex items-center gap-1"><Zap size={10}/> {typicalCurrent.toFixed(1)}A</div>
                                </div>
                            </div>

                            <div className="bg-black rounded-lg border-2 border-slate-700 relative overflow-hidden flex items-center justify-center p-4 shadow-inner min-h-[300px] flex-1">
                                <canvas ref={canvasRef} width={600} height={300} className="w-full h-full object-contain" />
                                <div className="absolute top-4 right-4 text-xs font-mono text-cyan-500 opacity-50 text-right">
                                    MODE: {activePresetId.toUpperCase()}<br/>
                                    FPS: 60<br/>
                                    LAYOUT: {firmwareConfig.ledLayoutType}
                                </div>
                            </div>

                            <div className="mt-6">
                                <p className="text-xs text-slate-400 font-bold uppercase mb-3 flex items-center gap-2"><Lightbulb size={12}/> Presets (Engine)</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {PRESETS.map(preset => {
                                        const isMatch = activePresetId === preset.id;
                                        return (
                                            <button 
                                                key={preset.id}
                                                onClick={() => setActivePresetId(preset.id, preset.palette)}
                                                className={`flex flex-col items-start p-3 rounded-lg border text-left transition relative overflow-hidden group ${isMatch ? 'bg-cyan-900/30 border-cyan-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                            >
                                                <div className="flex items-center gap-2 mb-1 text-xs font-bold">{preset.icon} {preset.label}</div>
                                                <div className="text-[10px] opacity-70 leading-tight">{preset.desc}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
                )}

                {/* --- PIXEL ART MODE UI --- */}
                {activeTab === 'PIXEL_ART' && (
                <>
                    <div className="lg:col-span-1 flex flex-col gap-6">
                         
                         {/* 1. UPLOAD & CONFIG */}
                         <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Upload size={20} className="text-purple-400" /> Config & Mídia
                            </h3>
                            
                            {/* NEW: GRID CONFIG */}
                            <div className="flex gap-2 mb-4 bg-slate-900 p-3 rounded border border-slate-700">
                                <div className="flex-1">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Colunas (X)</label>
                                    <input 
                                        type="number" 
                                        min="1" max="256"
                                        value={gridWidth} 
                                        onChange={(e) => handleGridSizeChange(parseInt(e.target.value), gridHeight)} 
                                        className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-white text-xs font-mono" 
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Linhas (Y)</label>
                                    <input 
                                        type="number" 
                                        min="1" max="256"
                                        value={gridHeight} 
                                        onChange={(e) => handleGridSizeChange(gridWidth, parseInt(e.target.value))} 
                                        className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-white text-xs font-mono" 
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-900 border-2 border-dashed border-slate-700 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:border-purple-500 transition cursor-pointer relative">
                                <input type="file" accept="image/png, image/jpeg, image/gif" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                <ImageIcon size={32} className="text-slate-500 mb-2" />
                                <p className="text-sm text-slate-300 font-bold">Clique ou arraste</p>
                                <p className="text-xs text-slate-500 mt-1">PNG, JPG ou GIF (Animado)</p>
                            </div>
                            
                            <div className="mt-4 space-y-2">
                                <div className="flex items-center justify-between bg-slate-900 p-3 rounded border border-slate-700">
                                    <span className="text-xs text-slate-400 font-bold uppercase">Mapeamento</span>
                                    <button 
                                        onClick={() => setIsSerpentine(!isSerpentine)}
                                        className={`text-xs px-2 py-1 rounded border flex items-center gap-1 ${isSerpentine ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                                    >
                                        <ArrowRightLeft size={12} />
                                        {isSerpentine ? 'Serpentina' : 'Linear'}
                                    </button>
                                </div>
                            </div>
                         </div>

                         {/* 3. SEND */}
                         <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                             <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Zap size={20} className="text-green-400" /> Upload
                            </h3>
                            <button 
                                onClick={handleSendPixelData}
                                disabled={pixelFrames.length === 0 || isSending}
                                className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition ${pixelFrames.length === 0 ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                            >
                                {isSending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Upload size={18} />}
                                {isSending ? 'Enviando...' : 'Enviar para Dispositivo'}
                            </button>
                         </div>
                    </div>

                    <div className="lg:col-span-2 flex flex-col gap-6">
                         {/* 2. PREVIEW */}
                         <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 flex flex-col items-center h-[400px] relative">
                            <div className="w-full flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider self-start flex items-center gap-2">
                                    Preview {gridWidth}x{gridHeight}
                                    {isGif && <span className="text-purple-400 bg-purple-900/30 px-2 rounded text-[10px]">GIF {currentFrameIdx + 1}/{pixelFrames.length}</span>}
                                </h3>
                                <button 
                                    onClick={() => setShowIndices(!showIndices)}
                                    className={`text-[10px] flex items-center gap-2 px-2 py-1 rounded border transition ${showIndices ? 'bg-cyan-900/50 text-cyan-400 border-cyan-800' : 'bg-slate-900 text-slate-500 border-slate-700'}`}
                                >
                                    {showIndices ? <Eye size={12}/> : <EyeOff size={12}/>} Índices
                                </button>
                            </div>
                            
                            <div className="h-full aspect-square bg-black border border-slate-600 shadow-2xl relative">
                                {pixelFrames.length === 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs flex-col gap-2">
                                        <Maximize size={32} opacity={0.5}/>
                                        Nenhuma imagem carregada
                                    </div>
                                )}
                                <canvas ref={pixelCanvasRef} width={320} height={320} className="w-full h-full object-contain image-pixelated" style={{imageRendering: 'pixelated'}} />
                            </div>
                         </div>

                         {/* 4. CODE EXPORT */}
                         <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 flex-1 flex flex-col">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Code size={16} /> C++ Array (FastLED/WS2812B)
                            </h3>
                            <div className="flex-1 bg-slate-950 p-4 rounded border border-slate-700 overflow-auto max-h-[200px] relative group">
                                <pre className="text-[10px] font-mono text-green-400 whitespace-pre-wrap break-all">
                                    {generatedCode || '// Carregue uma imagem para gerar o código...'}
                                </pre>
                                {generatedCode && (
                                    <button 
                                        onClick={() => navigator.clipboard.writeText(generatedCode)}
                                        className="absolute top-2 right-2 p-2 bg-slate-800 text-white rounded opacity-0 group-hover:opacity-100 transition hover:bg-slate-700"
                                        title="Copiar"
                                    >
                                        <Check size={14} />
                                    </button>
                                )}
                            </div>
                         </div>
                    </div>
                </>
                )}
            </div>
        </div>
    );
};
