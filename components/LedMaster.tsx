
import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { Zap, Settings, AlertTriangle, Lightbulb, BoxSelect, CloudRain, Wind, Thermometer, Moon, Activity, Waves, AlignLeft, Sun, Sliders, Grid, Upload, Code, Image as ImageIcon, Download, Check, ArrowRightLeft } from 'lucide-react';
import { hardwareBridge } from '../services/hardwareBridge';

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

export const LedMaster: React.FC = () => {
    const { firmwareConfig, updateFirmwareConfig, keyframes, simulatedTime, activeDeviceId, connectionType } = useAppStore();
    const [activeTab, setActiveTab] = useState<TabMode>('GENERATIVE');

    // --- GEN STATE ---
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animSpeed = firmwareConfig.animationSpeed;
    const animIntensity = firmwareConfig.animationIntensity;
    const activePresetId = firmwareConfig.animationMode;
    
    // --- PIXEL ART STATE ---
    const [pixelImage, setPixelImage] = useState<HTMLImageElement | null>(null);
    const [pixelData, setPixelData] = useState<Uint8ClampedArray | null>(null); // RGBA data
    const pixelCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isSerpentine, setIsSerpentine] = useState(true); // Hardware mapping
    const [generatedCode, setGeneratedCode] = useState('');
    const [isSending, setIsSending] = useState(false);

    // BINDINGS
    const setAnimSpeed = (v: number) => updateFirmwareConfig({ animationSpeed: v });
    const setAnimIntensity = (v: number) => updateFirmwareConfig({ animationIntensity: v });
    const setActivePresetId = (id: string, palette: number) => updateFirmwareConfig({ animationMode: id, animationPalette: palette });

    // Power Calculation
    const maxCurrent = (firmwareConfig.ledCount * 60) / 1000;
    const typicalCurrent = (firmwareConfig.ledCount * 60 * (firmwareConfig.ledBrightness / 255)) / 1000;
    let psuSuggestion = "5V 1A";
    if (typicalCurrent > 1 && typicalCurrent <= 2.5) psuSuggestion = "5V 3A";
    if (typicalCurrent > 2.5 && typicalCurrent <= 5) psuSuggestion = "5V 6A";
    if (typicalCurrent > 5) psuSuggestion = "5V 10A+ (Injeção de Energia)";

    // --- PIXEL ART LOGIC ---
    
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                setPixelImage(img);
                processPixelImage(img);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const processPixelImage = (img: HTMLImageElement) => {
        // Create an offscreen canvas to resize to 16x16
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 16;
        offCanvas.height = 16;
        const offCtx = offCanvas.getContext('2d');
        if (!offCtx) return;

        // Draw with smoothing disabled for Pixel Art look (Nearest Neighbor)
        offCtx.imageSmoothingEnabled = false;
        offCtx.drawImage(img, 0, 0, 16, 16);
        
        const imageData = offCtx.getImageData(0, 0, 16, 16);
        setPixelData(imageData.data);
        generateCode(imageData.data, isSerpentine);
    };

    const generateCode = (data: Uint8ClampedArray, serpentine: boolean) => {
        let code = `// 16x16 Pixel Art - ${serpentine ? 'Serpentine' : 'Linear'} Layout\n`;
        code += `const uint8_t image_data[] PROGMEM = {\n`;
        
        const width = 16;
        const height = 16;
        
        // Loop through pixels
        for (let i = 0; i < width * height; i++) {
            // Determine physical coordinates based on index i
            // But we iterate spatially (y, x) to fetch from RGBA buffer
            // Then we map to physical index for commenting or ordering?
            // Actually, for a C array, we usually want it ordered by PHYSICAL index so the firmware just iterates [i].
            
            // Standard loop is by Physical LED Index
            // We need to find which X,Y corresponds to physical index 'i'
            // OR we iterate X,Y and map to physical index position in array?
            // PROGMEM usually stores bytes in order 0..NUM_LEDS.
            
            // Let's iterate linearly 0..255 (Physical LEDs) and find which Image Pixel (x,y) corresponds to it.
            let x, y;
            
            // Assuming the loop 'i' is the physical LED address
            if (!serpentine) {
                // Linear: Row by row
                y = Math.floor(i / width);
                x = i % width;
            } else {
                // Serpentine: Even rows L->R, Odd rows R->L
                y = Math.floor(i / width);
                if (y % 2 === 0) {
                    x = i % width;
                } else {
                    x = (width - 1) - (i % width);
                }
            }

            // Get color from Image Data (linear row-major RGBA)
            const pixelIndex = (y * width + x) * 4;
            const r = data[pixelIndex];
            const g = data[pixelIndex + 1];
            const b = data[pixelIndex + 2];
            
            // GRB Order for WS2812B
            code += `  0x${g.toString(16).padStart(2,'0').toUpperCase()}, 0x${r.toString(16).padStart(2,'0').toUpperCase()}, 0x${b.toString(16).padStart(2,'0').toUpperCase()}`;
            
            if (i < (width * height) - 1) code += ',';
            if ((i + 1) % width === 0) code += ` // Row ${y}\n`;
        }
        
        code += `};\n`;
        setGeneratedCode(code);
    };

    useEffect(() => {
        if (pixelData) generateCode(pixelData, isSerpentine);
    }, [isSerpentine]);

    const handleSendPixelData = async () => {
        if (!pixelData) return;
        setIsSending(true);
        try {
            // Convert RGBA to simple RGB array
            const rgbArray = [];
            for (let i = 0; i < 256; i++) {
                // Map physical address i to image coords x,y
                let x, y;
                if (!isSerpentine) {
                    y = Math.floor(i / 16);
                    x = i % 16;
                } else {
                    y = Math.floor(i / 16);
                    x = (y % 2 === 0) ? (i % 16) : (15 - (i % 16));
                }
                const idx = (y * 16 + x) * 4;
                rgbArray.push(pixelData[idx], pixelData[idx+1], pixelData[idx+2]);
            }
            
            await hardwareBridge.sendData({
                command: 'setPixels',
                pixels: rgbArray
            }, connectionType, '192.168.1.10');
            
            alert("Enviado com sucesso!");
        } catch(e: any) {
            alert("Erro ao enviar: " + e.message);
        } finally {
            setIsSending(false);
        }
    };

    // --- RENDER LOOPS ---

    // 1. GENERATIVE LOOP
    useEffect(() => {
        if (activeTab !== 'GENERATIVE') return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        
        // Helper: Interpolate Tide
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

            // Grid metrics
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
                    const margin = 20;
                    const spacing = (width - margin*2) / (count - 1 || 1);
                    x = margin + (i * spacing); y = height / 2; size = Math.min(spacing * 0.8, 15);
                    col = i; row = 0;
                } else if (layout === 'MATRIX') {
                    row = Math.floor(i / matrixW);
                    col = i % matrixW;
                    if (row % 2 !== 0) col = (matrixW - 1) - col; // Visual Serpentine
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

                // Generative Logic (Same as before)
                let r = 0, g = 0, b = 0;
                const effRow = matrixH - 1 - row; 
                if (activePresetId === 'tideFill2') {
                    const fillH = (tideLevel / 100) * matrixH;
                    if (effRow < fillH) {
                        r = 0; g = 50 + (effRow * 20); b = 150 + (effRow * 10);
                        if (Math.sin(col*0.5 + time*0.005) > 0.5) g += 30;
                        if (effRow > fillH - 1) { r=150; g=200; b=255; }
                    }
                } else if (activePresetId === 'oceanCaustics') {
                    const scale = 0.2;
                    const val = Math.sin(col*scale + time*0.001*animSpeed) + Math.cos(row*scale + time*0.002*animSpeed);
                    const bright = Math.max(0, val * 100 * animIntensity + 50);
                    r=0; g=bright; b=bright+50;
                } else if (activePresetId === 'storm') {
                    const noise = Math.random();
                    if (noise > 0.98 * (1/animIntensity)) { r=255; g=255; b=255; } else { r=20; g=20; b=40; }
                } else if (activePresetId === 'aurora') {
                    const wave = Math.sin(col*0.3 + time*0.002*animSpeed) * 100;
                    r=50; g=100 + wave; b=100 - wave;
                } else if (activePresetId === 'neon') {
                    const hue = (time * 0.1 * animSpeed + col * 10) % 360;
                    r = hue < 120 ? 255 : 0; g = hue > 60 && hue < 180 ? 255 : 0; b = hue > 180 ? 255 : 0;
                } else {
                    r=0; g=10; b=40; if (Math.random() > 0.99) { r=100; g=200; b=255; }
                }

                const br = firmwareConfig.ledBrightness / 255;
                r*=br; g*=br; b*=br;
                ctx.beginPath(); ctx.arc(x, y, size/2, 0, Math.PI*2); ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill();
            }
            animationFrameId = requestAnimationFrame(render);
        };
        render();
        return () => cancelAnimationFrame(animationFrameId);
    }, [activePresetId, firmwareConfig, simulatedTime, animSpeed, animIntensity, activeTab]);

    // 2. PIXEL ART PREVIEW LOOP
    useEffect(() => {
        if (activeTab !== 'PIXEL_ART') return;
        const canvas = pixelCanvasRef.current;
        if (!canvas || !pixelData) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Draw 16x16 pixel data scaled up
        // We do this by drawing rects to visualize the physical mapping if needed, or just the image.
        // Let's visualize the PHYSICAL LEDs to show order
        const width = canvas.width;
        const height = canvas.height;
        ctx.fillStyle = '#111';
        ctx.fillRect(0,0,width,height);
        
        const cellSize = width / 16;
        
        for(let i=0; i<256; i++) {
            // Find x,y in the pixel data (Linear Image Source)
            const imgX = i % 16;
            const imgY = Math.floor(i / 16);
            const idx = (imgY * 16 + imgX) * 4;
            const r = pixelData[idx];
            const g = pixelData[idx+1];
            const b = pixelData[idx+2];
            
            // Map to physical location for visualization
            // This loop visualizes the IMAGE as is (Linear grid)
            // But we can overlay the index number
            
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(imgX * cellSize, imgY * cellSize, cellSize, cellSize);
            
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1;
            ctx.strokeRect(imgX * cellSize, imgY * cellSize, cellSize, cellSize);
            
            // Debug: Show hardware index if serpentine
            let hwIndex;
            if (!isSerpentine) {
                hwIndex = i;
            } else {
                // If this is image pos (x,y), what is the hw index?
                // y * width + (y even ? x : width-1-x)
                if (imgY % 2 === 0) hwIndex = imgY * 16 + imgX;
                else hwIndex = imgY * 16 + (15 - imgX);
            }
            
            if (cellSize > 15) {
                ctx.fillStyle = (r+g+b)/3 > 128 ? '#000' : '#fff';
                ctx.font = '8px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(hwIndex.toString(), imgX * cellSize + cellSize/2, imgY * cellSize + cellSize/2);
            }
        }

    }, [pixelData, isSerpentine, activeTab]);

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
                            <div className="space-y-6">
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
                                <div className="absolute top-4 left-4 text-xs font-mono text-cyan-500 opacity-50">
                                    MODE: {activePresetId.toUpperCase()}<br/>
                                    FPS: 60
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
                         {/* 1. UPLOAD */}
                         <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Upload size={20} className="text-purple-400" /> Carregar Imagem
                            </h3>
                            <div className="bg-slate-900 border-2 border-dashed border-slate-700 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:border-purple-500 transition cursor-pointer relative">
                                <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                <ImageIcon size={32} className="text-slate-500 mb-2" />
                                <p className="text-sm text-slate-300 font-bold">Clique ou arraste aqui</p>
                                <p className="text-xs text-slate-500 mt-1">PNG, JPG (Auto-resize 16x16)</p>
                            </div>
                            
                            <div className="mt-4 flex items-center justify-between bg-slate-900 p-3 rounded border border-slate-700">
                                <span className="text-xs text-slate-400 font-bold uppercase">Mapeamento Físico</span>
                                <button 
                                    onClick={() => setIsSerpentine(!isSerpentine)}
                                    className={`text-xs px-2 py-1 rounded border flex items-center gap-1 ${isSerpentine ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                                >
                                    <ArrowRightLeft size={12} />
                                    {isSerpentine ? 'Serpentina (ZigZag)' : 'Linear (Progressivo)'}
                                </button>
                            </div>
                         </div>

                         {/* 3. SEND */}
                         <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                             <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Zap size={20} className="text-green-400" /> Upload
                            </h3>
                            <button 
                                onClick={handleSendPixelData}
                                disabled={!pixelData || isSending}
                                className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition ${!pixelData ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                            >
                                {isSending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Upload size={18} />}
                                {isSending ? 'Enviando...' : 'Enviar para Dispositivo'}
                            </button>
                         </div>
                    </div>

                    <div className="lg:col-span-2 flex flex-col gap-6">
                         {/* 2. PREVIEW */}
                         <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 flex flex-col items-center h-[400px]">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 self-start">Preview 16x16 (Com Índices)</h3>
                            <div className="h-full aspect-square bg-black border border-slate-600 shadow-2xl relative">
                                {!pixelData && (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs">
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
