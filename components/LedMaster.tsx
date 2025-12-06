

import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { ConnectionType } from '../types';
import { Zap, Lightbulb, Grid, Upload, Code, Image as ImageIcon, Check, Wind, Moon, Activity, Waves, Sun, BrainCircuit, Thermometer, Shield, Terminal, Network, Search, PlayCircle, AlertCircle, RefreshCw, Send, LayoutTemplate, RotateCw, AlignVerticalJustifyCenter, Circle, Spline, Mountain, Palette, Shuffle, Link2, Eye, GitBranch, Cpu, Radio } from 'lucide-react';
import { hardwareBridge } from '../services/hardwareBridge';
import omggif from 'omggif';

// PREMIUM PRESETS DEFINITION
const PRESETS = [
    { id: 'tideFill2', label: 'Maré Alta Viva', icon: <Waves size={16} className="text-cyan-400"/>, desc: 'Gradiente dinâmico com ondas na superfície.', matrixOnly: false },
    { id: 'oceanCaustics', label: 'Moreré Lagoon', icon: <Sun size={16} className="text-yellow-400"/>, desc: 'Reflexos de luz no fundo do mar (Simplex Noise).', matrixOnly: true },
    { id: 'storm', label: 'Tempestade Forte', icon: <Zap size={16} className="text-slate-400"/>, desc: 'Turbulência, raios e mar agitado.', matrixOnly: false }, 
    { id: 'aurora', label: 'Ambiente Aurora', icon: <Wind size={16} className="text-green-400"/>, desc: 'Ondas suaves estilo Boreal para relaxamento.', matrixOnly: true },
    { id: 'deepSea', label: 'Profundezas', icon: <Moon size={16} className="text-indigo-400"/>, desc: 'Partículas flutuantes e plâncton brilhante.', matrixOnly: false },
    { id: 'neon', label: 'Neon Moreré', icon: <Activity size={16} className="text-purple-400"/>, desc: 'Ciclo de cores Cyberpunk.', matrixOnly: false },
];

type TabMode = 'DESIGN' | 'AUTONOMOUS' | 'PIXEL_ART' | 'LAB';
type StripDirection = 'HORIZONTAL' | 'VERTICAL';

// Color Interpolation Helper
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
    const [activeTab, setActiveTab] = useState<TabMode>('AUTONOMOUS');

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
    const [pixelFrames, setPixelFrames] = useState<Uint8ClampedArray[]>([]); 
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
    const [cppSnippet, setCppSnippet] = useState('');

    // BINDINGS
    const setAnimSpeed = (v: number) => updateFirmwareConfig({ animationSpeed: v });
    const setAnimIntensity = (v: number) => updateFirmwareConfig({ animationIntensity: v });
    const setActivePresetId = (id: string) => updateFirmwareConfig({ animationMode: id });

    // --- PIXEL ART LOGIC ---
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
            frameCanvas.width = width; frameCanvas.height = height;
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
            alert("Erro ao processar GIF: " + e.message);
        }
    };

    const extractFrameData = (source: CanvasImageSource): Uint8ClampedArray | null => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = gridWidth; offCanvas.height = gridHeight;
        const offCtx = offCanvas.getContext('2d');
        if (!offCtx) return null;
        offCtx.imageSmoothingEnabled = false;
        offCtx.drawImage(source, 0, 0, gridWidth, gridHeight);
        return offCtx.getImageData(0, 0, gridWidth, gridHeight).data;
    };

    const generateCode = (frames: Uint8ClampedArray[], serpentine: boolean) => {
        const width = gridWidth; const height = gridHeight; const numLeds = width * height;
        const varName = frames.length > 1 ? 'anim_frames' : 'img_data';
        let code = `const uint8_t ${varName}[][${numLeds * 3}] PROGMEM = {\n`;
        frames.forEach((data, fIdx) => {
            code += `  { // Frame ${fIdx}\n    `;
            for (let i = 0; i < numLeds; i++) {
                let x, y;
                if (!serpentine) { y = Math.floor(i / width); x = i % width; } 
                else { y = Math.floor(i / width); x = (y % 2 === 0) ? (i % width) : ((width - 1) - (i % width)); }
                const idx = (y * width + x) * 4;
                code += `0x${data[idx].toString(16).padStart(2,'0')},0x${data[idx+1].toString(16).padStart(2,'0')},0x${data[idx+2].toString(16).padStart(2,'0')}`;
                if (i < numLeds - 1) code += ',';
            }
            code += `\n  }${fIdx < frames.length - 1 ? ',' : ''}\n`;
        });
        code += `};\n`;
        setGeneratedCode(code);
    };

    const handleSendPixelData = async () => {
        if (pixelFrames.length === 0 || connectionType === ConnectionType.NONE) { alert("Conecte via USB/BLE/WiFi."); return; }
        setIsSending(true);
        try {
            const currentData = pixelFrames[currentFrameIdx];
            const rgbArray = [];
            const totalPixels = gridWidth * gridHeight;
            const isSerp = firmwareConfig.ledSerpentine || false;
            for (let i = 0; i < totalPixels; i++) {
                let x, y;
                if (!isSerp) { y = Math.floor(i / gridWidth); x = i % gridWidth; } 
                else { y = Math.floor(i / gridWidth); x = (y % 2 === 0) ? (i % gridWidth) : ((gridWidth - 1) - (i % gridWidth)); }
                const idx = (y * gridWidth + x) * 4;
                rgbArray.push(currentData[idx], currentData[idx+1], currentData[idx+2]);
            }
            await hardwareBridge.sendData({ command: 'setPixels', pixels: rgbArray }, connectionType as any, activeDeviceId || '');
        } catch(e: any) { alert("Erro: " + e.message); } finally { setIsSending(false); }
    };

    // --- VISUALIZATION RENDER LOOP ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        let animId: number;

        const render = () => {
            const w = canvas.width; const h = canvas.height;
            ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, w, h);

            // 1. Determine Environment Variables
            let tide = 50, wind = 0, hum = 0, night = false;
            if (simMode) {
                tide = simParams.tide; wind = simParams.wind; hum = simParams.humidity; night = simParams.isNight;
            } else {
                // Derived from real state
                const cycle = firmwareConfig.cycleDuration || 24;
                let t = simulatedTime % cycle;
                // Simple interpolation for tide visualization
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

            // 2. Autonomous Logic (Chip Simulation)
            let speed = animSpeed; let intense = animIntensity;
            if (firmwareConfig.autonomous.enabled) {
                if (firmwareConfig.autonomous.linkSpeedToTide) speed *= (0.2 + (tide/100)*1.8);
                if (firmwareConfig.autonomous.linkBrightnessToTide) intense *= (0.4 + (tide/100)*0.6);
                if (firmwareConfig.autonomous.linkWeatherToLeds) {
                    speed = Math.max(0.1, Math.min(5.0, wind/10.0));
                    intense = Math.max(0.2, hum/100.0);
                }
            }

            // 3. Layout Generation
            const layout = firmwareConfig.ledLayoutType;
            const count = firmwareConfig.ledCount;
            const leds = [];
            const cx = w/2; const cy = h/2;

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
            } else if (layout === 'SPIRAL') {
                const turns = firmwareConfig.ledSpiralTurns || 3;
                const maxR = Math.min(w,h)*0.4;
                for(let i=0; i<count; i++) {
                    const p = i/count;
                    const a = p * Math.PI * 2 * turns;
                    const r = p * maxR;
                    leds.push({x: cx+Math.cos(a)*r, y: cy+Math.sin(a)*r, i});
                }
            } else if (layout === 'MOUNTAIN') {
                const padding = 40; const chartW = w - padding*2;
                for(let i=0; i<count; i++) {
                    const x = padding + (i/(count-1))*chartW;
                    const curve = Math.sin(i*0.1)*50 + Math.sin(i*0.3)*20 + Math.sin(i*0.05)*80;
                    leds.push({x, y: cy + 100 - Math.abs(curve), i});
                }
            } else if (layout === 'CUSTOM') {
                // Vector / S-Curve
                for(let i=0; i<count; i++) {
                    const t = i/count;
                    const x = cx + Math.sin(t*Math.PI*2)*150;
                    const y = cy + Math.cos(t*Math.PI*4)*100;
                    leds.push({x, y, i});
                }
            }

            // 4. Rendering
            const time = Date.now();
            const colors = firmwareConfig.customColors || ['#000044', '#ffffff'];
            
            leds.forEach(({x, y, i}) => {
                let r=0, g=0, b=0;
                
                // Color Logic
                if (activePresetId === 'oceanCaustics' || activePresetId === 'tideFill2') {
                     // Interpolate based on Tide Level
                     const stops = colors.length-1;
                     const idx = (tide/100) * stops;
                     const f = idx - Math.floor(idx);
                     const c1 = colors[Math.floor(idx)];
                     const c2 = colors[Math.min(stops, Math.ceil(idx))];
                     const rgb = interpolateColor(c1, c2, f);
                     const [ri,gi,bi] = rgb.match(/\d+/g)!.map(Number);
                     r=ri; g=gi; b=bi;
                     
                     // Noise
                     if (activePresetId === 'oceanCaustics') {
                         const n = (Math.sin(x*0.05 + time*0.002*speed) + 1)/2;
                         r*=n; g*=n; b*=n;
                     }
                } else if (activePresetId === 'neon') {
                    const hue = (time*0.1*speed + i*5)%360;
                    if(hue<120){r=255-hue*2;g=hue*2;b=0;} else if(hue<240){r=0;g=255-(hue-120)*2;b=(hue-120)*2;} else {r=(hue-240)*2;g=0;b=255-(hue-240)*2;}
                } else {
                    // Simple
                    r=0; g=100; b=200;
                }

                // Global Intensity & Night
                let br = intense;
                if (night) br *= firmwareConfig.nightMode.brightnessFactor;
                r*=br; g*=br; b*=br;

                ctx.beginPath(); ctx.arc(x,y, layout==='MATRIX'? Math.min(w,h)/20 : 6, 0, Math.PI*2);
                ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill();
                // Glow
                const grad = ctx.createRadialGradient(x,y,0, x,y, 15);
                grad.addColorStop(0, `rgba(${r},${g},${b},0.5)`);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(x,y,15,0,Math.PI*2); ctx.fill();
            });
            animId = requestAnimationFrame(render);
        };
        render();
        return () => cancelAnimationFrame(animId);
    }, [activeTab, simMode, simParams, firmwareConfig, keyframes, simulatedTime, weatherData, stripDirection]);

    // --- API LAB LOGIC ---
    const handleCheckApi = async (type: 'WEATHER' | 'TABUA_MARE') => {
        setDebugLoading(true); setDebugResult(null);
        let url = '';
        let snippet = '';

        if (type === 'WEATHER') {
            const k = firmwareConfig.weatherApi?.apiKey || 'KEY';
            const q = encodeURIComponent(firmwareConfig.weatherApi?.location || 'Moreré');
            url = `https://api.weatherapi.com/v1/current.json?key=${k}&q=${q}&lang=pt`;
            
            snippet = `// C++ Snippet for WeatherAPI\nString url = "${url}";\n\nWiFiClientSecure client;\nclient.setInsecure(); // Bypass SSL verification\nHTTPClient http;\nhttp.begin(client, url);\nhttp.setTimeout(10000);\n\nint code = http.GET();\nif(code > 0) {\n    String payload = http.getString();\n    Serial.println(payload);\n}`;
        } else {
            const base = dataSourceConfig.tabuaMare.baseUrl;
            const pid = dataSourceConfig.tabuaMare.harborId || 8;
            const day = new Date().getDate();
            const month = new Date().getMonth() + 1;
            
            // Generate clean URL without brackets (HTTP)
            url = `${base.replace('https','http')}/tabua-mare/${pid}/${month}/${day}`;
            
            snippet = `// C++ Snippet for Tábua Maré (Robust)\n// Use WiFiClient (HTTP) for speed and no brackets in URL\nString url = "${url}";\n\nWiFiClient client;\nHTTPClient http;\n\nhttp.begin(client, url);\nhttp.setConnectTimeout(10000);\nhttp.setTimeout(10000);\n\nSerial.print("[HTTP] GET "); Serial.println(url);\nint code = http.GET();\n\nif(code > 0) {\n    String payload = http.getString();\n    if(code == 200) {\n        // Parse JSON\n        Serial.println(payload);\n    } else {\n        Serial.printf("Error %d: %s\\n", code, payload.c_str());\n    }\n} else {\n    Serial.printf("Failed: %s\\n", http.errorToString(code).c_str());\n}\nhttp.end();`;
        }
        
        setDebugUrl(url);
        setCppSnippet(snippet);
        
        try {
            // Browser uses proxy to bypass CORS
            const proxy = "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);
            const t0 = performance.now();
            const res = await fetch(proxy);
            const t1 = performance.now();
            const txt = await res.text();
            
            if (res.ok) {
                setDebugResult(`HTTP ${res.status} OK (${(t1-t0).toFixed(0)}ms)\n\n--- PAYLOAD PREVIEW ---\n${txt.substring(0,600)}...`);
            } else {
                setDebugResult(`HTTP ${res.status} ERROR\n${txt}`);
            }
        } catch(e:any) { 
            setDebugResult("FETCH EXCEPTION (BROWSER/PROXY): " + e.message); 
        } finally { 
            setDebugLoading(false); 
        }
    };

    const handleColorChange = (idx: number, val: string) => {
        const c = [...(firmwareConfig.customColors || [])];
        c[idx] = val;
        updateFirmwareConfig({ customColors: c });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-hidden">
            {/* LEFT SIDEBAR: CONFIG */}
            <div className="lg:col-span-3 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
                 
                 {/* NAVIGATION */}
                 <div className="bg-slate-800 rounded-lg border border-slate-700 p-2 grid grid-cols-2 gap-2">
                     <button onClick={()=>setActiveTab('AUTONOMOUS')} className={`p-2 rounded text-xs font-bold flex flex-col items-center gap-1 ${activeTab==='AUTONOMOUS'?'bg-cyan-600 text-white':'bg-slate-900 text-slate-400'}`}>
                         <BrainCircuit size={16}/> Lógica Auto
                     </button>
                     <button onClick={()=>setActiveTab('DESIGN')} className={`p-2 rounded text-xs font-bold flex flex-col items-center gap-1 ${activeTab==='DESIGN'?'bg-purple-600 text-white':'bg-slate-900 text-slate-400'}`}>
                         <LayoutTemplate size={16}/> Design/Cor
                     </button>
                     <button onClick={()=>setActiveTab('LAB')} className={`p-2 rounded text-xs font-bold flex flex-col items-center gap-1 ${activeTab==='LAB'?'bg-orange-600 text-white':'bg-slate-900 text-slate-400'}`}>
                         <Terminal size={16}/> Lab/Debug
                     </button>
                     <button onClick={()=>setActiveTab('PIXEL_ART')} className={`p-2 rounded text-xs font-bold flex flex-col items-center gap-1 ${activeTab==='PIXEL_ART'?'bg-pink-600 text-white':'bg-slate-900 text-slate-400'}`}>
                         <Grid size={16}/> Pixel Art
                     </button>
                 </div>

                 {/* CONTEXTUAL SIDEBAR CONTENT */}
                 <div className="bg-slate-800 rounded-lg border border-slate-700 p-5 flex-1 overflow-y-auto">
                    {activeTab === 'DESIGN' && (
                        <div className="space-y-6 animate-in fade-in">
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><LayoutTemplate size={14}/> Layout Físico</h3>
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                     {[
                                         {id:'STRIP', l:'Fita', i:<AlignVerticalJustifyCenter className="rotate-90" size={12}/>}, 
                                         {id:'MATRIX', l:'Matriz', i:<Grid size={12}/>}, 
                                         {id:'RING', l:'Anel', i:<Circle size={12}/>}, 
                                         {id:'SPIRAL', l:'Espiral', i:<RotateCw size={12}/>},
                                         {id:'MOUNTAIN', l:'Montanha', i:<Mountain size={12}/>},
                                         {id:'CUSTOM', l:'Vetor', i:<Spline size={12}/>}
                                     ].map(type => (
                                         <button key={type.id} onClick={() => updateFirmwareConfig({ ledLayoutType: type.id as any })} className={`flex flex-col items-center justify-center p-2 rounded border transition ${firmwareConfig.ledLayoutType === type.id ? 'bg-cyan-900/50 border-cyan-500 text-cyan-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}>
                                            {type.i} <span className="text-[9px] mt-1">{type.l}</span>
                                         </button>
                                     ))}
                                </div>
                                
                                <label className="text-[10px] text-slate-500 font-bold block mb-1">Total LEDs ({firmwareConfig.ledCount})</label>
                                <input type="number" value={firmwareConfig.ledCount} onChange={e=>updateFirmwareConfig({ledCount: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-xs mb-3"/>
                                
                                {firmwareConfig.ledLayoutType === 'MATRIX' && (
                                    <div className="bg-slate-900 p-3 rounded border border-slate-700 space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div><label className="text-[9px] block text-slate-500">Largura</label><input type="number" value={firmwareConfig.ledMatrixWidth} onChange={e=>updateFirmwareConfig({ledMatrixWidth: parseInt(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-white text-xs"/></div>
                                            <div><label className="text-[9px] block text-slate-500">Altura</label><input type="number" value={firmwareConfig.ledMatrixHeight||1} onChange={e=>updateFirmwareConfig({ledMatrixHeight: parseInt(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-white text-xs"/></div>
                                        </div>
                                        <div className="flex items-center gap-2"><input type="checkbox" checked={firmwareConfig.ledSerpentine} onChange={e=>updateFirmwareConfig({ledSerpentine: e.target.checked})} /><label className="text-[10px] text-slate-400">Serpentina (ZigZag)</label></div>
                                    </div>
                                )}
                                {firmwareConfig.ledLayoutType === 'SPIRAL' && (
                                    <div className="bg-slate-900 p-3 rounded border border-slate-700">
                                        <label className="text-[9px] block text-slate-500 mb-1">Voltas: {firmwareConfig.ledSpiralTurns}</label>
                                        <input type="range" min="1" max="10" step="0.5" value={firmwareConfig.ledSpiralTurns||3} onChange={e=>updateFirmwareConfig({ledSpiralTurns: parseFloat(e.target.value)})} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"/>
                                    </div>
                                )}
                            </div>
                            
                            <div className="pt-4 border-t border-slate-700">
                                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><Palette size={14}/> Paleta Mestre</h3>
                                <p className="text-[10px] text-slate-500 mb-3">Defina as cores para interpolação da lógica autônoma (0% a 100% da maré).</p>
                                <div className="space-y-2">
                                    {(firmwareConfig.customColors || ['#000000','#ffffff']).map((c, i) => (
                                        <div key={i} className="flex gap-2 items-center">
                                            <input type="color" value={c} onChange={e=>handleColorChange(i, e.target.value)} className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"/>
                                            <input type="text" value={c} onChange={e=>handleColorChange(i, e.target.value)} className="flex-1 bg-slate-900 border border-slate-600 rounded p-1.5 text-xs text-white font-mono uppercase"/>
                                            <span className="text-[10px] text-slate-500 font-mono">{(i/((firmwareConfig.customColors?.length||1)-1)*100).toFixed(0)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'AUTONOMOUS' && (
                        <div className="space-y-6 animate-in fade-in">
                            <div className="flex items-center justify-between mb-4 bg-slate-900 p-3 rounded border border-slate-700">
                                <span className="text-xs font-bold text-slate-300">Chip Autônomo</span>
                                <button onClick={() => updateFirmwareConfig({autonomous: {...firmwareConfig.autonomous, enabled: !firmwareConfig.autonomous.enabled}})} className={`w-8 h-4 rounded-full transition-colors relative ${firmwareConfig.autonomous.enabled ? 'bg-cyan-600' : 'bg-slate-600'}`}>
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${firmwareConfig.autonomous.enabled ? 'left-4.5' : 'left-0.5'}`}></div>
                                </button>
                            </div>

                            <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Cpu size={12}/> Simulador de Ambiente</h4>
                                    <button onClick={()=>setSimMode(!simMode)} className={`text-[9px] px-2 py-0.5 rounded border ${simMode?'bg-green-900 text-green-400 border-green-700':'bg-slate-800 text-slate-500 border-slate-600'}`}>
                                        {simMode ? 'ATIVO' : 'DESLIGADO'}
                                    </button>
                                </div>
                                
                                {simMode ? (
                                    <div className="space-y-4">
                                        <div><div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>Maré</span><span className="text-white">{simParams.tide}%</span></div><input type="range" value={simParams.tide} onChange={e=>setSimParams({...simParams, tide: parseInt(e.target.value)})} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"/></div>
                                        <div><div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>Vento</span><span className="text-white">{simParams.wind}km/h</span></div><input type="range" value={simParams.wind} onChange={e=>setSimParams({...simParams, wind: parseInt(e.target.value)})} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-400"/></div>
                                        <div><div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>Umidade</span><span className="text-white">{simParams.humidity}%</span></div><input type="range" value={simParams.humidity} onChange={e=>setSimParams({...simParams, humidity: parseInt(e.target.value)})} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"/></div>
                                        <div className="flex items-center gap-2 mt-2"><input type="checkbox" checked={simParams.isNight} onChange={e=>setSimParams({...simParams, isNight: e.target.checked})}/><label className="text-[10px] text-slate-400">Noite</label></div>
                                    </div>
                                ) : (
                                    <div className="text-[10px] text-slate-500 italic text-center py-2">Usando dados reais do Dashboard. Ative o simulador para testar condições extremas.</div>
                                )}
                            </div>

                            <div>
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Preset de Animação</h4>
                                <div className="grid grid-cols-1 gap-2">
                                    {PRESETS.map(p => (
                                        <button key={p.id} onClick={()=>setActivePresetId(p.id)} className={`flex items-center gap-3 p-2 rounded border text-left transition ${activePresetId===p.id ? 'bg-cyan-900/30 border-cyan-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                            {p.icon}
                                            <div><div className="text-xs font-bold">{p.label}</div><div className="text-[9px] opacity-60">{p.desc}</div></div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'LAB' && (
                        <div className="space-y-6 animate-in fade-in">
                            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><Network size={14}/> Teste de Conectividade</h3>
                            <div className="space-y-2">
                                <button onClick={()=>handleCheckApi('WEATHER')} className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white text-left flex justify-between">Check WeatherAPI <span>GET</span></button>
                                <button onClick={()=>handleCheckApi('TABUA_MARE')} className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white text-left flex justify-between">Check Tábua Maré <span>GET</span></button>
                            </div>
                            
                            <div className="bg-slate-900 rounded border border-slate-700 p-2">
                                <label className="text-[9px] text-slate-500 font-bold block mb-1">URL Gerada (Simulação Firmware)</label>
                                <div className="text-[10px] font-mono text-slate-300 break-all bg-black/50 p-1 rounded">{debugUrl || '// Selecione um teste'}</div>
                            </div>
                            
                            <div className="bg-black rounded border border-slate-700 p-2 h-32 overflow-auto text-[9px] font-mono text-green-400">
                                {debugLoading ? 'Testing...' : (debugResult || '// Response log')}
                            </div>
                        </div>
                    )}

                    {activeTab === 'PIXEL_ART' && (
                        <div className="space-y-6 animate-in fade-in">
                            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><Grid size={14}/> Pixel Studio</h3>
                            <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-pink-500 hover:bg-slate-900 transition">
                                <div className="text-center"><Upload size={20} className="mx-auto text-slate-400 mb-1"/><span className="text-xs text-slate-400">Importar GIF/IMG</span></div>
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                            </label>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className="text-[9px] text-slate-500 block">W</label><input type="number" value={gridWidth} onChange={e=>setGridWidth(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white text-xs"/></div>
                                <div><label className="text-[9px] text-slate-500 block">H</label><input type="number" value={gridHeight} onChange={e=>setGridHeight(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white text-xs"/></div>
                            </div>

                            <button onClick={handleSendPixelData} disabled={isSending} className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold py-2 rounded text-xs flex items-center justify-center gap-2">
                                {isSending ? <RefreshCw className="animate-spin" size={14}/> : <Send size={14}/>} Enviar
                            </button>
                        </div>
                    )}
                 </div>
            </div>

            {/* CENTER: CANVAS VISUALIZER */}
            <div className="lg:col-span-9 bg-slate-900 border border-slate-800 rounded-lg flex flex-col overflow-hidden relative">
                {activeTab === 'LAB' && cppSnippet ? (
                    <div className="p-6 h-full font-mono text-xs text-slate-300 overflow-auto">
                        <h3 className="text-sm font-bold text-white mb-4 border-b border-slate-700 pb-2 flex items-center gap-2"><Code size={16}/> C++ HTTPClient Code Preview</h3>
                        <pre className="bg-black p-4 rounded border border-slate-700 text-green-400 whitespace-pre-wrap leading-relaxed">{cppSnippet}</pre>
                        <p className="mt-4 text-slate-500">Este é o código exato que será gerado no <code>WeatherManager.cpp</code> para esta requisição.</p>
                    </div>
                ) : (
                    <>
                        <div className="absolute top-4 right-4 z-10 flex flex-col items-end pointer-events-none">
                            <div className="text-xs font-bold text-slate-500 bg-black/50 px-2 py-1 rounded mb-1">{firmwareConfig.ledLayoutType} - {firmwareConfig.ledCount} LEDS</div>
                            {simMode && <div className="text-xs font-bold text-green-400 bg-green-900/20 border border-green-900 px-2 py-1 rounded animate-pulse">SIMULATION ON</div>}
                        </div>
                        <canvas ref={activeTab === 'PIXEL_ART' ? pixelCanvasRef : canvasRef} width={800} height={600} className="w-full h-full object-contain bg-black" style={{imageRendering: activeTab==='PIXEL_ART' ? 'pixelated' : 'auto'}} />
                    </>
                )}
            </div>
        </div>
    );
};