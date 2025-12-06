


import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { ConnectionType } from '../types';
import { Zap, Lightbulb, Grid, Upload, Code, Image as ImageIcon, Check, Wind, Moon, Activity, Waves, Sun, BrainCircuit, Thermometer, Shield, Terminal, Network, Search, PlayCircle, AlertCircle, RefreshCw, Send, LayoutTemplate, RotateCw, AlignVerticalJustifyCenter, Circle, Spline, Mountain, Palette, Shuffle, Link2 } from 'lucide-react';
import { hardwareBridge } from '../services/hardwareBridge';
import { tideSourceService } from '../services/tideSourceService';
import omggif from 'omggif';

// PREMIUM PRESETS DEFINITION
const PRESETS = [
    { id: 'tideFill2', label: 'Maré Alta Viva', icon: <Waves size={16} className="text-cyan-400"/>, desc: 'Gradiente dinâmico com ondas na superfície.', matrixOnly: false, palette: 0 },
    { id: 'oceanCaustics', label: 'Moreré Lagoon', icon: <Sun size={16} className="text-yellow-400"/>, desc: 'Reflexos de luz no fundo do mar (Simplex Noise).', matrixOnly: true, palette: 0 },
    { id: 'storm', label: 'Tempestade Forte', icon: <Zap size={16} className="text-slate-400"/>, desc: 'Turbulência, raios e mar agitado.', matrixOnly: false, palette: 3 }, // Cloud palette
    { id: 'aurora', label: 'Ambiente Aurora', icon: <Wind size={16} className="text-green-400"/>, desc: 'Ondas suaves estilo Boreal para relaxamento.', matrixOnly: true, palette: 1 }, // Forest
    { id: 'deepSea', label: 'Profundezas', icon: <Moon size={16} className="text-indigo-400"/>, desc: 'Partículas flutuantes e plâncton brilhante.', matrixOnly: false, palette: 0 },
    { id: 'neon', label: 'Neon Moreré', icon: <Activity size={16} className="text-purple-400"/>, desc: 'Ciclo de cores Cyberpunk.', matrixOnly: false, palette: 4 }, // Party
];

type TabMode = 'GENERATIVE' | 'PIXEL_ART' | 'DEBUG' | 'COLORS';
type StripDirection = 'HORIZONTAL' | 'VERTICAL' | 'CUSTOM';

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

export const LedMaster: React.FC = () => {
    const { firmwareConfig, updateFirmwareConfig, keyframes, simulatedTime, activeDeviceId, connectionType, weatherData, dataSourceConfig } = useAppStore();
    const [activeTab, setActiveTab] = useState<TabMode>('GENERATIVE');

    // --- GEN STATE ---
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animSpeed = firmwareConfig.animationSpeed;
    const animIntensity = firmwareConfig.animationIntensity;
    const activePresetId = firmwareConfig.animationMode;
    
    // Simulation Mode State
    const [simMode, setSimMode] = useState(false);
    const [simParams, setSimParams] = useState({ 
        wind: 15, 
        humidity: 60, 
        tide: 50, // %
        isNight: false 
    });
    
    // Preview Options
    const [stripDirection, setStripDirection] = useState<StripDirection>('HORIZONTAL');
    
    // --- PIXEL ART STATE ---
    const [gridWidth, setGridWidth] = useState(16);
    const [gridHeight, setGridHeight] = useState(16);
    const [pixelFrames, setPixelFrames] = useState<Uint8ClampedArray[]>([]); // Array of RGBA frames
    const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
    const [isGif, setIsGif] = useState(false);
    const [showIndices, setShowIndices] = useState(false);
    
    const pixelCanvasRef = useRef<HTMLCanvasElement>(null);
    const [generatedCode, setGeneratedCode] = useState('');
    const [isSending, setIsSending] = useState(false);

    // --- DEBUG STATE ---
    const [debugUrl, setDebugUrl] = useState('');
    const [debugResult, setDebugResult] = useState<string | null>(null);
    const [debugLoading, setDebugLoading] = useState(false);
    const [terminalCmd, setTerminalCmd] = useState('');
    const [terminalLog, setTerminalLog] = useState<string[]>([]);

    // BINDINGS
    const setAnimSpeed = (v: number) => updateFirmwareConfig({ animationSpeed: v });
    const setAnimIntensity = (v: number) => updateFirmwareConfig({ animationIntensity: v });
    const setActivePresetId = (id: string, palette: number) => updateFirmwareConfig({ animationMode: id, animationPalette: palette });

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
            generateCode([data], firmwareConfig.ledSerpentine || false);
        }
    };

    const processGif = (gifData: Uint8Array) => {
        try {
            const reader = new omggif.GifReader(gifData);
            const numFrames = reader.numFrames();
            const width = reader.width;
            const height = reader.height;
            const frames: Uint8ClampedArray[] = [];
            
            const frameCanvas = document.createElement('canvas');
            frameCanvas.width = width;
            frameCanvas.height = height;
            const frameCtx = frameCanvas.getContext('2d');
            const frameData = frameCtx?.createImageData(width, height);

            if (!frameCtx || !frameData) return;

            for (let i = 0; i < numFrames; i++) {
                reader.decodeAndBlitFrameRGBA(i, frameData.data);
                frameCtx.putImageData(frameData, 0, 0);
                const resized = extractFrameData(frameCanvas);
                if (resized) frames.push(resized);
            }
            
            setIsGif(true);
            setPixelFrames(frames);
            setCurrentFrameIdx(0);
            generateCode(frames, firmwareConfig.ledSerpentine || false);

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
                code += `0x${g.toString(16).padStart(2,'0').toUpperCase()},0x${r.toString(16).padStart(2,'0').toUpperCase()},0x${b.toString(16).padStart(2,'0').toUpperCase()}`;
                if (i < numLeds - 1) code += ',';
            }
            code += `\n  }${fIdx < frames.length - 1 ? ',' : ''}\n`;
        });
        
        code += `};\n`;
        setGeneratedCode(code);
    };

    useEffect(() => {
        if (pixelFrames.length > 0) generateCode(pixelFrames, firmwareConfig.ledSerpentine || false);
    }, [firmwareConfig.ledSerpentine]);

    const handleSendPixelData = async () => {
        if (pixelFrames.length === 0) return;
        if (connectionType === ConnectionType.NONE) {
             alert("Não conectado. Selecione USB, BLE ou WiFi.");
             return;
        }
        setIsSending(true);
        try {
            const currentData = pixelFrames[currentFrameIdx];
            const rgbArray = [];
            const totalPixels = gridWidth * gridHeight;
            const isSerp = firmwareConfig.ledSerpentine || false;
            for (let i = 0; i < totalPixels; i++) {
                let x, y;
                if (!isSerp) {
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

    // --- ANIMATION LOOPS ---

    useEffect(() => {
        if (activeTab === 'PIXEL_ART' && isGif && pixelFrames.length > 1) {
            const interval = setInterval(() => {
                setCurrentFrameIdx(prev => (prev + 1) % pixelFrames.length);
            }, 100); 
            return () => clearInterval(interval);
        }
    }, [activeTab, isGif, pixelFrames.length]);

    // MAIN RENDER LOOP for Generative & Config
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
            const matrixH = firmwareConfig.ledMatrixHeight || Math.ceil(count / matrixW);
            
            const time = Date.now();
            
            // --- SIMULATION LOGIC ---
            let tideLevel = 50;
            let currentWind = 0;
            let currentHum = 0;
            let isNight = false;

            if (simMode) {
                tideLevel = simParams.tide;
                currentWind = simParams.wind;
                currentHum = simParams.humidity;
                isNight = simParams.isNight;
            } else {
                tideLevel = getTideHeightAt(simulatedTime);
                currentWind = weatherData.windSpeed;
                currentHum = weatherData.humidity;
                const t = simulatedTime % 24;
                const { startHour, endHour } = firmwareConfig.nightMode;
                isNight = startHour > endHour ? (t >= startHour || t < endHour) : (t >= startHour && t < endHour);
            }

            // AUTONOMOUS LOGIC SIMULATION
            let effectiveSpeed = animSpeed;
            let effectiveIntensity = animIntensity;
            
            // 1. Tide Link
            if (firmwareConfig.autonomous.enabled) {
                if (firmwareConfig.autonomous.linkSpeedToTide) {
                     effectiveSpeed = animSpeed * (0.2 + ((tideLevel/100) * 1.8));
                }
                if (firmwareConfig.autonomous.linkBrightnessToTide) {
                     effectiveIntensity = animIntensity * (0.4 + ((tideLevel/100) * 0.6));
                }
                
                if (firmwareConfig.autonomous.linkWeatherToLeds) {
                     // Wind (0-50km/h) scales Speed
                     const safeWind = Math.min(50, currentWind);
                     let windMult = safeWind / 10.0;
                     if (windMult < 0.1) windMult = 0.1;
                     effectiveSpeed = windMult;

                     // Humidity scales Intensity
                     effectiveIntensity = Math.max(0.2, currentHum / 100);
                }
            }

            // --- LAYOUT ENGINE: Map Index -> X,Y ---
            let ledPositions: {x: number, y: number, size: number, row: number, col: number}[] = [];
            const centerX = width / 2;
            const centerY = height / 2;

            if (layout === 'STRIP') {
                const margin = 30;
                for (let i = 0; i < count; i++) {
                    let lx, ly;
                    if (stripDirection === 'HORIZONTAL') {
                        const spacing = (width - margin*2) / (count - 1 || 1);
                        lx = margin + (i * spacing);
                        ly = centerY;
                    } else { // VERTICAL
                        const spacing = (height - margin*2) / (count - 1 || 1);
                        lx = centerX;
                        ly = height - margin - (i * spacing);
                    }
                    ledPositions.push({x: lx, y: ly, size: 8, row: 0, col: i});
                }
            } else if (layout === 'MATRIX') {
                const padding = 40;
                const cellW = (width - padding*2) / matrixW;
                const cellH = (height - padding*2) / matrixH;
                const size = Math.min(cellW, cellH) * 0.8;
                const startX = (width - cellW * matrixW) / 2 + cellW/2;
                const startY = (height - cellH * matrixH) / 2 + cellH/2;

                for(let i=0; i < count; i++) {
                    // Physical mapping logic based on Serpentine setting
                    let row = Math.floor(i / matrixW);
                    let col = i % matrixW;
                    
                    if (firmwareConfig.ledSerpentine && (row % 2 !== 0)) {
                         col = (matrixW - 1) - col;
                    }
                    
                    let lx = startX + (col * cellW);
                    let ly = startY + (row * cellH);
                    
                    ledPositions.push({x: lx, y: ly, size, row, col});
                }
            } else if (layout === 'RING') {
                const radius = Math.min(width, height) * 0.35;
                for(let i=0; i<count; i++) {
                    const angle = (i / count) * Math.PI * 2 - (Math.PI / 2);
                    const lx = centerX + Math.cos(angle) * radius;
                    const ly = centerY + Math.sin(angle) * radius;
                    ledPositions.push({x: lx, y: ly, size: 10, row: 0, col: i});
                }
            } else if (layout === 'SPIRAL') {
                const maxRadius = Math.min(width, height) * 0.4;
                const turns = firmwareConfig.ledSpiralTurns || 3;
                for(let i=0; i<count; i++) {
                    const progress = i / count;
                    const angle = progress * Math.PI * 2 * turns;
                    const radius = progress * maxRadius;
                    const lx = centerX + Math.cos(angle) * radius;
                    const ly = centerY + Math.sin(angle) * radius;
                    ledPositions.push({x: lx, y: ly, size: 5 + (progress * 8), row: 0, col: i});
                }
            } else if (layout === 'MOUNTAIN') {
                const padding = 20;
                const chartW = width - (padding * 2);
                const step = chartW / (count - 1 || 1);
                
                for(let i=0; i < count; i++) {
                    const lx = padding + (i * step);
                    // Generate a "Mountainous" curve shape
                    const freq1 = 0.1;
                    const freq2 = 0.35;
                    const amp = height * 0.3;
                    const yOffset = height * 0.6;
                    
                    const curve = (Math.sin(i * freq1) * amp) + (Math.sin(i * freq2) * (amp * 0.5));
                    const ly = yOffset - Math.abs(curve);
                    ledPositions.push({x: lx, y: ly, size: 8, row: 0, col: i});
                }
            } else if (layout === 'CUSTOM') {
                // Visualize as a simple line for now, or imagine importing SVG points
                const radius = Math.min(width, height) * 0.4;
                for(let i=0; i<count; i++) {
                    // Create an S-Curve (SVG path approximation)
                    const t = i / count; // 0 to 1
                    const lx = centerX + (Math.cos(t * Math.PI * 2) * radius * 0.8) * Math.sin(t * Math.PI);
                    const ly = centerY + (Math.sin(t * Math.PI * 2) * radius) - (t * 50);
                    ledPositions.push({x: lx, y: ly, size: 6, row: 0, col: i});
                }
            }

            // --- RENDER LOOP ---
            ledPositions.forEach((pos, i) => {
                let r = 0, g = 0, b = 0;
                const { x, y, size, row, col } = pos;

                // --- CUSTOM PALETTE LOGIC ---
                // If using autonomous colors, we interpolate based on Tide Level
                const customColors = firmwareConfig.customColors || ['#0000FF', '#00FF00'];
                
                if (activePresetId === 'tideFill2' || activePresetId === 'oceanCaustics') {
                    // Interpolate between the 5 colors based on tide level
                    // 0% -> Color 0, 100% -> Color 4
                    const steps = customColors.length - 1;
                    const normalizedTide = tideLevel / 100; // 0.0 to 1.0
                    const exactIndex = normalizedTide * steps;
                    const lowerIndex = Math.floor(exactIndex);
                    const upperIndex = Math.min(steps, Math.ceil(exactIndex));
                    const factor = exactIndex - lowerIndex;
                    
                    const c1 = customColors[lowerIndex];
                    const c2 = customColors[upperIndex];
                    
                    const rgbStr = interpolateColor(c1, c2, factor);
                    const [ri, gi, bi] = rgbStr.replace(/[^\d,]/g, '').split(',').map(Number);
                    r = ri; g = gi; b = bi;

                    // Add dynamic noise based on simulation
                    if (activePresetId === 'oceanCaustics') {
                         const noise = (Math.sin(x*0.1 + time*0.002*effectiveSpeed) + 1) / 2;
                         r *= noise; g *= noise; b *= noise;
                    }
                } 
                else if (activePresetId === 'storm') {
                    const noise = Math.random();
                    if (noise > 0.98 * (1/effectiveIntensity)) { r=255; g=255; b=255; } 
                    else { 
                        // Base storm color from palette index 0
                        const hex = customColors[0] || "#202040";
                        const baseR = parseInt(hex.slice(1,3),16);
                        const baseG = parseInt(hex.slice(3,5),16);
                        const baseB = parseInt(hex.slice(5,7),16);
                        r=baseR; g=baseG; b=baseB;
                    }
                } else if (activePresetId === 'aurora') {
                    const wave = Math.sin(x*0.02 + time*0.002*effectiveSpeed) * 100;
                    r=50; g=100 + wave; b=100 - wave;
                } else if (activePresetId === 'neon') {
                    // Radial or linear hue based on index
                    const hue = (time * 0.1 * effectiveSpeed + i * 5) % 360;
                    // Simple HSV to RGB approx
                    if(hue<120) { r=255-hue*2; g=hue*2; b=0; }
                    else if(hue<240) { r=0; g=255-(hue-120)*2; b=(hue-120)*2; }
                    else { r=(hue-240)*2; g=0; b=255-(hue-240)*2; }
                    // Intensity scaling
                    r*=effectiveIntensity; g*=effectiveIntensity; b*=effectiveIntensity;
                } else {
                    // Default
                    r=0; g=10; b=40; if (Math.random() > 0.99) { r=100; g=200; b=255; }
                }

                // Global Brightness & Night Mode Calc
                let br = firmwareConfig.ledBrightness / 255;
                if (firmwareConfig.nightMode.enabled && isNight) {
                    br *= firmwareConfig.nightMode.brightnessFactor;
                }
                
                // Clamp
                r = Math.min(255, Math.max(0, r*br));
                g = Math.min(255, Math.max(0, g*br));
                b = Math.min(255, Math.max(0, b*br));

                ctx.beginPath(); 
                ctx.arc(x, y, size/2, 0, Math.PI*2); 
                ctx.fillStyle = `rgb(${r},${g},${b})`; 
                ctx.fill();
                
                // Glow
                const grad = ctx.createRadialGradient(x,y,0, x,y, size*1.5);
                grad.addColorStop(0, `rgba(${r},${g},${b},0.4)`);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(x,y,size*1.5,0,Math.PI*2); ctx.fill();
            });
            
            animationFrameId = requestAnimationFrame(render);
        };
        render();
        return () => cancelAnimationFrame(animationFrameId);
    }, [activePresetId, firmwareConfig, simulatedTime, animSpeed, animIntensity, activeTab, stripDirection, weatherData, simMode, simParams]);

    // --- DEBUG FUNCTIONS ---
    
    const handleCheckApi = async (type: 'WEATHER' | 'TABUA_MARE_GEO' | 'TABUA_MARE_PORT') => {
        setDebugLoading(true);
        setDebugResult(null);
        try {
            // Replicate firmware logic roughly
            let url = '';
            if (type === 'WEATHER') {
                url = `https://api.weatherapi.com/v1/current.json?key=${firmwareConfig.weatherApi?.apiKey}&q=${encodeURIComponent(firmwareConfig.weatherApi?.location)}&lang=pt`;
            } else if (type === 'TABUA_MARE_GEO') {
                const ll = `[${dataSourceConfig.tabuaMare.lat},${dataSourceConfig.tabuaMare.lng}]`;
                const d = new Date();
                url = `${dataSourceConfig.tabuaMare.baseUrl}/geo-tabua-mare/${encodeURIComponent(ll)}/${dataSourceConfig.tabuaMare.uf}/${d.getMonth()+1}/[${d.getDate()}]`;
            } else {
                const pid = dataSourceConfig.tabuaMare.harborId || 8;
                const d = new Date();
                url = `${dataSourceConfig.tabuaMare.baseUrl}/tabua-mare/${pid}/${d.getMonth()+1}/[${d.getDate()}]`;
            }
            
            // Proxy logic
            const proxy = "https://api.allorigins.win/raw?url=";
            const fullUrl = proxy + encodeURIComponent(url);
            
            setDebugUrl(url); // Show the real URL not the proxy

            const start = Date.now();
            const res = await fetch(fullUrl);
            const dur = Date.now() - start;
            
            const txt = await res.text();
            
            if (res.ok) {
                 setDebugResult(`STATUS: ${res.status} OK\nTIME: ${dur}ms\n\n${txt.substring(0, 500)}...`);
            } else {
                 setDebugResult(`ERROR: ${res.status}\n${txt}`);
            }

        } catch (e: any) {
            setDebugResult("EXCEPTION: " + e.message);
        } finally {
            setDebugLoading(false);
        }
    };

    const handleSendTerminal = async () => {
        if (!terminalCmd) return;
        setTerminalLog(prev => [...prev, `> ${terminalCmd}`]);
        try {
            const cmdObj = JSON.parse(terminalCmd);
            await hardwareBridge.sendData(cmdObj, connectionType === ConnectionType.NONE ? 'USB' : connectionType as any, activeDeviceId || '');
            setTerminalLog(prev => [...prev, `OK`]);
            setTerminalCmd('');
        } catch(e: any) {
             setTerminalLog(prev => [...prev, `ERR: ${e.message}`]);
        }
    };

    const handleColorChange = (index: number, val: string) => {
        const newColors = [...(firmwareConfig.customColors || [])];
        newColors[index] = val;
        updateFirmwareConfig({ customColors: newColors });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-hidden">
            
            {/* LEFT COLUMN: DEVICE & LAYOUT SETTINGS */}
            <div className="lg:col-span-3 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
                 <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
                     <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
                         <LayoutTemplate size={16} className="text-cyan-400" /> Layout & Leds
                     </h3>
                     
                     <div className="space-y-4">
                        <div>
                             <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Tipo de Arranjo</label>
                             <div className="grid grid-cols-3 gap-2">
                                 {[
                                     {id:'STRIP', l:'Linha', i:<AlignVerticalJustifyCenter className="rotate-90" size={10}/>}, 
                                     {id:'MATRIX', l:'Matriz', i:<Grid size={10}/>}, 
                                     {id:'RING', l:'Círculo', i:<Circle size={10}/>}, 
                                     {id:'SPIRAL', l:'Espiral', i:<RotateCw size={10}/>},
                                     {id:'MOUNTAIN', l:'Montanha', i:<Mountain size={10}/>},
                                     {id:'CUSTOM', l:'Vetores', i:<Spline size={10}/>}
                                 ].map(type => (
                                     <button
                                        key={type.id}
                                        onClick={() => updateFirmwareConfig({ ledLayoutType: type.id as any })}
                                        className={`flex flex-col items-center justify-center gap-1 p-2 rounded border transition ${firmwareConfig.ledLayoutType === type.id ? 'bg-cyan-900/50 border-cyan-500 text-cyan-400' : 'bg-slate-900 border-slate-600 text-slate-400 hover:text-slate-200'}`}
                                     >
                                        {type.i}
                                        <span className="text-[9px] font-bold">{type.l}</span>
                                     </button>
                                 ))}
                             </div>
                        </div>

                        <div>
                            <label className="text-[10px] text-slate-500 uppercase font-bold flex justify-between">
                                Total LEDs <span>{firmwareConfig.ledCount}</span>
                            </label>
                            <input type="number" value={firmwareConfig.ledCount} onChange={e=>updateFirmwareConfig({ledCount: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-white text-xs mt-1 font-mono" />
                        </div>

                        {/* DYNAMIC CONFIGURATION FIELDS */}
                        {firmwareConfig.ledLayoutType === 'MATRIX' && (
                             <div className="grid grid-cols-2 gap-2 bg-slate-900 p-2 rounded border border-slate-700 animate-in fade-in">
                                 <div>
                                     <label className="text-[9px] text-slate-500 block">Largura</label>
                                     <input type="number" value={firmwareConfig.ledMatrixWidth} onChange={e=>updateFirmwareConfig({ledMatrixWidth: parseInt(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white"/>
                                 </div>
                                 <div>
                                     <label className="text-[9px] text-slate-500 block">Altura</label>
                                     <input type="number" value={firmwareConfig.ledMatrixHeight || 1} onChange={e=>updateFirmwareConfig({ledMatrixHeight: parseInt(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white"/>
                                 </div>
                                 <div className="col-span-2 flex items-center gap-2 mt-1">
                                      <input type="checkbox" checked={firmwareConfig.ledSerpentine} onChange={e=>updateFirmwareConfig({ledSerpentine: e.target.checked})} id="serp" />
                                      <label htmlFor="serp" className="text-[10px] text-slate-400 cursor-pointer">Serpentina (ZigZag)</label>
                                 </div>
                             </div>
                        )}

                        {firmwareConfig.ledLayoutType === 'STRIP' && (
                            <div className="bg-slate-900 p-2 rounded border border-slate-700 animate-in fade-in">
                                 <label className="text-[9px] text-slate-500 block mb-1">Direção Visual</label>
                                 <div className="flex gap-1">
                                     <button onClick={()=>setStripDirection('HORIZONTAL')} className={`flex-1 text-[9px] py-1 rounded ${stripDirection==='HORIZONTAL'?'bg-cyan-700 text-white':'bg-slate-800 text-slate-500'}`}><AlignVerticalJustifyCenter className="rotate-90 mx-auto" size={12}/></button>
                                     <button onClick={()=>setStripDirection('VERTICAL')} className={`flex-1 text-[9px] py-1 rounded ${stripDirection==='VERTICAL'?'bg-cyan-700 text-white':'bg-slate-800 text-slate-500'}`}><AlignVerticalJustifyCenter className="mx-auto" size={12}/></button>
                                 </div>
                            </div>
                        )}

                        {firmwareConfig.ledLayoutType === 'SPIRAL' && (
                             <div className="bg-slate-900 p-2 rounded border border-slate-700 animate-in fade-in">
                                 <label className="text-[9px] text-slate-500 block mb-1">Voltas (Turns)</label>
                                 <input type="range" min="1" max="10" step="0.5" value={firmwareConfig.ledSpiralTurns || 3} onChange={e=>updateFirmwareConfig({ledSpiralTurns: parseFloat(e.target.value)})} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer mb-1"/>
                                 <div className="text-right text-[9px] text-slate-300">{firmwareConfig.ledSpiralTurns}x</div>
                             </div>
                        )}
                        
                        <div className="pt-2 border-t border-slate-700 mt-2">
                            <label className="text-[10px] text-slate-500 uppercase font-bold flex justify-between">
                                Brilho Global <span>{Math.round(firmwareConfig.ledBrightness/2.55)}%</span>
                            </label>
                            <input type="range" min="0" max="255" value={firmwareConfig.ledBrightness} onChange={e=>updateFirmwareConfig({ledBrightness: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer mt-1" />
                        </div>
                     </div>
                 </div>

                 {/* TAB SELECTOR */}
                 <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                    <div className="flex flex-col gap-2">
                        <button 
                            onClick={() => setActiveTab('GENERATIVE')}
                            className={`px-4 py-3 rounded text-sm font-bold flex items-center justify-between transition ${activeTab === 'GENERATIVE' ? 'bg-cyan-600 text-white shadow-lg' : 'bg-slate-900 text-slate-400 border border-slate-700 hover:text-white'}`}
                        >
                            <span className="flex items-center gap-2"><Activity size={16} /> Chip Logic</span>
                            {activeTab === 'GENERATIVE' && <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>}
                        </button>
                        <button 
                            onClick={() => setActiveTab('COLORS')}
                            className={`px-4 py-3 rounded text-sm font-bold flex items-center justify-between transition ${activeTab === 'COLORS' ? 'bg-pink-600 text-white shadow-lg' : 'bg-slate-900 text-slate-400 border border-slate-700 hover:text-white'}`}
                        >
                            <span className="flex items-center gap-2"><Palette size={16} /> Master Colors</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('PIXEL_ART')}
                            className={`px-4 py-3 rounded text-sm font-bold flex items-center justify-between transition ${activeTab === 'PIXEL_ART' ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-900 text-slate-400 border border-slate-700 hover:text-white'}`}
                        >
                            <span className="flex items-center gap-2"><Grid size={16} /> Pixel Studio</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('DEBUG')}
                            className={`px-4 py-3 rounded text-sm font-bold flex items-center justify-between transition ${activeTab === 'DEBUG' ? 'bg-orange-600 text-white shadow-lg' : 'bg-slate-900 text-slate-400 border border-slate-700 hover:text-white'}`}
                        >
                            <span className="flex items-center gap-2"><Terminal size={16} /> Lab / Debug</span>
                        </button>
                    </div>
                 </div>
            </div>

            {/* CENTER COLUMN: CANVAS & TOOLS */}
            <div className="lg:col-span-6 flex flex-col gap-4 overflow-hidden">
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-1 flex-1 flex flex-col min-h-[500px]">
                    {activeTab === 'GENERATIVE' && (
                        <>
                             {/* GENERATIVE CANVAS */}
                             <div className="bg-black rounded border-2 border-slate-700 relative overflow-hidden flex items-center justify-center shadow-inner flex-1 m-4">
                                <canvas ref={canvasRef} width={600} height={600} className="w-full h-full object-contain" />
                                <div className="absolute top-4 right-4 text-xs font-mono text-cyan-500 opacity-50 text-right pointer-events-none">
                                    LAYOUT: {firmwareConfig.ledLayoutType}<br/>
                                    LEDS: {firmwareConfig.ledCount}<br/>
                                    LOGIC: {firmwareConfig.autonomous.enabled ? 'AUTO' : 'MANUAL'}<br/>
                                    {simMode && "SIMULATION ACTIVE"}
                                </div>
                            </div>

                             {/* PRESET SELECTOR */}
                            <div className="px-4 pb-4">
                                <p className="text-xs text-slate-400 font-bold uppercase mb-3 flex items-center gap-2"><Lightbulb size={12}/> Modos de Animação</p>
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
                        </>
                    )}

                    {activeTab === 'COLORS' && (
                        <div className="p-6 h-full flex flex-col">
                            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                <Palette size={16} className="text-pink-400" /> Editor de Paleta Mestre
                            </h3>
                            <p className="text-xs text-slate-400 mb-6">
                                Defina as cores que o Chip Lógico Autônomo usará para interpolar estados (Ex: Maré Baixa vs Alta).
                            </p>
                            
                            <div className="flex-1 flex flex-col justify-center items-center gap-6">
                                <div className="flex gap-4 items-end">
                                    {(firmwareConfig.customColors || ['#000000', '#000000', '#000000', '#000000', '#000000']).map((color, idx) => (
                                        <div key={idx} className="flex flex-col items-center gap-2">
                                            <div className="text-[10px] text-slate-500 font-bold">Stop {idx}</div>
                                            <input 
                                                type="color" 
                                                value={color}
                                                onChange={(e) => handleColorChange(idx, e.target.value)}
                                                className="w-12 h-20 bg-transparent cursor-pointer rounded border-none" 
                                            />
                                            <input 
                                                type="text" 
                                                value={color}
                                                onChange={(e) => handleColorChange(idx, e.target.value)}
                                                className="w-16 bg-slate-900 border border-slate-700 text-[10px] text-center text-slate-300 rounded p-1 uppercase font-mono"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="w-full max-w-md h-8 rounded-full bg-gradient-to-r from-transparent via-white/10 to-transparent relative mt-4 border border-slate-700 overflow-hidden">
                                     <div 
                                        className="absolute inset-0" 
                                        style={{background: `linear-gradient(to right, ${firmwareConfig.customColors?.join(', ')})`}}
                                     ></div>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-2">
                                    Este gradiente representa a transição de 0% a 100% (Maré/Intensidade).
                                </p>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'PIXEL_ART' && (
                        <>
                             {/* PIXEL ART CANVAS */}
                             <div className="flex justify-between items-center p-4 border-b border-slate-700">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Editor {gridWidth}x{gridHeight}</h3>
                                <div className="flex gap-2">
                                    <button onClick={() => setShowIndices(!showIndices)} className={`text-[10px] px-2 py-1 rounded border ${showIndices ? 'bg-cyan-900 text-cyan-400' : 'bg-slate-900 text-slate-500'}`}>Índices</button>
                                    <button onClick={() => updateFirmwareConfig({ ledSerpentine: !firmwareConfig.ledSerpentine })} className={`text-[10px] px-2 py-1 rounded border ${firmwareConfig.ledSerpentine ? 'bg-indigo-900 text-indigo-400' : 'bg-slate-900 text-slate-500'}`}>{firmwareConfig.ledSerpentine ? 'Serpentina' : 'Linear'}</button>
                                </div>
                             </div>
                             <div className="flex-1 bg-black m-4 border border-slate-600 shadow-2xl relative overflow-hidden flex justify-center items-center">
                                {pixelFrames.length === 0 && <div className="text-slate-600 text-xs flex flex-col items-center gap-2"><ImageIcon size={32} opacity={0.5}/>Carregue uma imagem</div>}
                                <canvas ref={pixelCanvasRef} width={320} height={320} className="w-full h-full object-contain" style={{imageRendering: 'pixelated'}} />
                             </div>
                        </>
                    )}

                    {activeTab === 'DEBUG' && (
                        <div className="p-6 flex flex-col h-full overflow-hidden">
                             <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                                <Network size={16} className="text-orange-400" /> API Connectivity Test
                             </h3>
                             
                             <div className="space-y-4 flex-1 overflow-y-auto">
                                 {/* URL GENERATOR & TEST */}
                                 <div className="bg-slate-900 p-4 rounded border border-slate-700">
                                      <div className="flex gap-2 mb-3">
                                          <button onClick={() => handleCheckApi('WEATHER')} className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1 rounded border border-slate-600 text-white">Check WeatherAPI</button>
                                          <button onClick={() => handleCheckApi('TABUA_MARE_GEO')} className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1 rounded border border-slate-600 text-white">Check Maré (Geo)</button>
                                          <button onClick={() => handleCheckApi('TABUA_MARE_PORT')} className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1 rounded border border-slate-600 text-white">Check Maré (ID)</button>
                                      </div>
                                      
                                      <div className="bg-black/50 p-2 rounded text-[10px] font-mono text-slate-400 break-all mb-2">
                                          {debugUrl || '// Select an endpoint above to generate URL'}
                                      </div>

                                      <div className={`w-full h-32 bg-black border rounded p-2 text-xs font-mono overflow-auto ${debugResult?.startsWith("ERROR") ? 'border-red-900 text-red-400' : 'border-slate-700 text-green-400'}`}>
                                           {debugLoading ? 'Loading...' : (debugResult || '// Response will appear here')}
                                      </div>
                                 </div>

                                 {/* TERMINAL */}
                                 <div className="flex-1 flex flex-col mt-4">
                                     <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                        <Terminal size={16} className="text-slate-400" /> Direct Command Terminal
                                     </h3>
                                     <div className="flex-1 bg-black border border-slate-700 rounded p-2 text-xs font-mono text-slate-300 overflow-y-auto mb-2 min-h-[100px]">
                                         {terminalLog.map((l, i) => <div key={i}>{l}</div>)}
                                         {terminalLog.length === 0 && <span className="opacity-30 text-slate-500">Ready for commands...</span>}
                                     </div>
                                     <div className="flex gap-2">
                                         <input 
                                            type="text" 
                                            value={terminalCmd} 
                                            onChange={e => setTerminalCmd(e.target.value)} 
                                            placeholder='{"brightness": 100} or {"harborId": 5}'
                                            className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 text-xs text-white font-mono"
                                            onKeyDown={e => e.key === 'Enter' && handleSendTerminal()}
                                         />
                                         <button onClick={handleSendTerminal} className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 rounded text-xs font-bold">
                                             SEND
                                         </button>
                                     </div>
                                     <p className="text-[10px] text-slate-500 mt-2">Sends raw JSON via active connection ({connectionType}).</p>
                                 </div>
                             </div>
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT COLUMN: AUTONOMOUS LOGIC or TOOLS */}
            <div className="lg:col-span-3 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
                
                {activeTab === 'GENERATIVE' || activeTab === 'COLORS' ? (
                     <div className="bg-slate-800 rounded-lg border border-slate-700 p-5 h-full flex flex-col">
                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
                            <BrainCircuit size={16} className="text-pink-400" /> Lógica Autônoma
                        </h3>
                        
                        <div className="flex items-center justify-between mb-4 bg-slate-900 p-3 rounded border border-slate-700">
                            <span className="text-xs font-bold text-slate-300">Ativar IA Embarcada</span>
                            <button 
                                onClick={() => updateFirmwareConfig({autonomous: {...firmwareConfig.autonomous, enabled: !firmwareConfig.autonomous.enabled}})}
                                className={`w-8 h-4 rounded-full transition-colors relative ${firmwareConfig.autonomous.enabled ? 'bg-pink-600' : 'bg-slate-600'}`}
                            >
                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${firmwareConfig.autonomous.enabled ? 'left-4.5' : 'left-0.5'}`}></div>
                            </button>
                        </div>

                        {/* SIMULATION CONTROLS */}
                        {firmwareConfig.autonomous.enabled && (
                            <div className="mb-6 animate-in fade-in">
                                <div className="flex items-center justify-between mb-2">
                                     <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                                        <PlayCircle size={10} className={simMode ? "text-green-400" : "text-slate-600"}/> 
                                        Modo Simulação
                                     </span>
                                     <button 
                                        onClick={() => setSimMode(!simMode)}
                                        className={`text-[9px] px-2 py-0.5 rounded border ${simMode ? 'bg-green-900 text-green-300 border-green-700' : 'bg-slate-700 text-slate-400 border-slate-600'}`}
                                    >
                                        {simMode ? 'ATIVO' : 'DESATIVADO'}
                                    </button>
                                </div>
                                
                                {simMode && (
                                    <div className="bg-slate-900/80 p-3 rounded border border-green-900/30 space-y-3">
                                         <div>
                                             <label className="flex justify-between text-[9px] text-slate-400 mb-1">
                                                 <span className="flex items-center gap-1"><Waves size={10}/> Maré (%)</span>
                                                 <span className="text-white">{simParams.tide}%</span>
                                             </label>
                                             <input type="range" min="0" max="100" value={simParams.tide} onChange={e=>setSimParams({...simParams, tide: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-cyan-500" />
                                         </div>
                                         <div>
                                             <label className="flex justify-between text-[9px] text-slate-400 mb-1">
                                                 <span className="flex items-center gap-1"><Wind size={10}/> Vento (Speed)</span>
                                                 <span className="text-white">{simParams.wind}km/h</span>
                                             </label>
                                             <input type="range" min="0" max="100" value={simParams.wind} onChange={e=>setSimParams({...simParams, wind: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-green-500" />
                                         </div>
                                         <div>
                                             <label className="flex justify-between text-[9px] text-slate-400 mb-1">
                                                 <span className="flex items-center gap-1"><Thermometer size={10}/> Umidade (Intens)</span>
                                                 <span className="text-white">{simParams.humidity}%</span>
                                             </label>
                                             <input type="range" min="0" max="100" value={simParams.humidity} onChange={e=>setSimParams({...simParams, humidity: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-orange-500" />
                                         </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex-1 space-y-4">
                             <div className="space-y-2">
                                <label className="text-[10px] text-slate-500 uppercase font-bold flex justify-between">
                                    Velocidade Base <span>{animSpeed.toFixed(1)}x</span>
                                </label>
                                <input type="range" min="0.1" max="5.0" step="0.1" value={animSpeed} onChange={e=>setAnimSpeed(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                             </div>
                             
                             <div className="space-y-2">
                                <label className="text-[10px] text-slate-500 uppercase font-bold flex justify-between">
                                    Intensidade Base <span>{Math.round(animIntensity*100)}%</span>
                                </label>
                                <input type="range" min="0" max="1.0" step="0.1" value={animIntensity} onChange={e=>setAnimIntensity(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                             </div>
                        </div>

                     </div>
                ) : (
                    // PIXEL ART TOOLS
                    <div className="bg-slate-800 rounded-lg border border-slate-700 p-5 h-full flex flex-col">
                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
                            <Code size={16} className="text-purple-400" /> Ferramentas
                        </h3>

                        <label className="text-[10px] text-slate-500 uppercase font-bold block mb-2">Importar Imagem/GIF</label>
                        <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-purple-500 hover:bg-slate-900 transition mb-4">
                            <div className="text-center">
                                <Upload size={20} className="mx-auto text-slate-400 mb-1" />
                                <span className="text-xs text-slate-400">Clique para Upload</span>
                            </div>
                            <input type="file" className="hidden" accept="image/png, image/jpeg, image/gif" onChange={handleImageUpload} />
                        </label>

                        {activeTab === 'PIXEL_ART' && (
                            <button 
                                onClick={handleSendPixelData}
                                disabled={isSending || pixelFrames.length === 0}
                                className={`w-full py-3 rounded text-sm font-bold flex items-center justify-center gap-2 mb-4 transition ${isSending ? 'bg-purple-900 text-purple-400' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}
                            >
                                {isSending ? <RefreshCw className="animate-spin" size={16}/> : <Send size={16}/>}
                                {isSending ? 'Enviando...' : 'Enviar para Matriz'}
                            </button>
                        )}
                        
                        <div className="flex-1 overflow-hidden flex flex-col">
                             <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">C++ Gerado</label>
                             <div className="flex-1 bg-black border border-slate-700 rounded p-2 overflow-auto text-[9px] font-mono text-green-400 custom-scrollbar">
                                 <pre>{generatedCode || '// Code will appear here'}</pre>
                             </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};