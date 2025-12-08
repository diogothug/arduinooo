
import React, { useState, useRef, useEffect } from 'react';
import { ConnectionManager } from './ConnectionManager';
import { LedDebugPanel } from './led/LedDebugPanel';
import { Network, Terminal, Shield, PlugZap, Activity, Bug, HardDrive, RefreshCcw, Image as ImageIcon, FileCode, Upload, Copy, Library, Monitor, Battery, Signal, Fan, Bell, MapPin, Zap } from 'lucide-react';
import { useAppStore } from '../store';
import { ViewState, WidgetType } from '../types';

// --- PRESET ICON LIBRARY (SVG PATHS) ---
const ICON_LIBRARY = [
    { 
        id: 'wifi_full', 
        name: 'Wi-Fi Full', 
        path: '<path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line>' 
    },
    {
        id: 'wifi_off',
        name: 'Wi-Fi Off',
        path: '<line x1="1" y1="1" x2="23" y2="23"></line><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path><path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line>'
    },
    { 
        id: 'bluetooth', 
        name: 'Bluetooth', 
        path: '<polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"></polyline>' 
    },
    {
        id: 'battery_100',
        name: 'Battery Full',
        path: '<rect x="1" y="6" width="18" height="12" rx="2" ry="2"></rect><line x1="23" y1="13" x2="23" y2="11"></line><line x1="5" y1="10" x2="5" y2="14"></line><line x1="9" y1="10" x2="9" y2="14"></line><line x1="13" y1="10" x2="13" y2="14"></line><line x1="17" y1="10" x2="17" y2="14"></line>'
    },
    {
        id: 'signal_bars',
        name: 'Signal Strength',
        path: '<line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line>'
    },
    { 
        id: 'sun', 
        name: 'Weather: Sun', 
        path: '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>' 
    },
    { 
        id: 'cloud', 
        name: 'Weather: Cloud', 
        path: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>' 
    },
    { 
        id: 'rain', 
        name: 'Weather: Rain', 
        path: '<line x1="16" y1="13" x2="16" y2="21"></line><line x1="8" y1="13" x2="8" y2="21"></line><line x1="12" y1="15" x2="12" y2="23"></line><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path>' 
    },
    { 
        id: 'thermometer', 
        name: 'Thermometer', 
        path: '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path>' 
    },
    { 
        id: 'droplet', 
        name: 'Humidity', 
        path: '<path d="M12 2.69l5.74 5.88a6 6 0 0 1-8.49 8.49c-2.35-2.34-2.35-6.14 0-8.49L12 2.69z"></path>' 
    },
    { 
        id: 'zap', 
        name: 'Power / Energy', 
        path: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>' 
    },
    { 
        id: 'fan', 
        name: 'Fan / Motor', 
        path: '<path d="M10.827 16.379a6.082 6.082 0 0 1-8.618-7.002l5.412 1.45a6.082 6.082 0 0 1 7.002-8.618l-1.45 5.412a6.082 6.082 0 0 1 8.618 7.002l-5.412-1.45a6.082 6.082 0 0 1-7.002 8.618l1.45-5.412Z"></path><path d="M12 12v.01"></path>' 
    },
    { 
        id: 'settings', 
        name: 'Settings Gear', 
        path: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>' 
    },
    { 
        id: 'home', 
        name: 'Home', 
        path: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>' 
    },
    {
        id: 'lock',
        name: 'Lock',
        path: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>'
    },
    {
        id: 'bell',
        name: 'Notification',
        path: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>'
    },
    {
        id: 'map_pin',
        name: 'Location Pin',
        path: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>'
    },
    {
        id: 'triangle_alert',
        name: 'Warning',
        path: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>'
    }
];

export const Esp32Tools: React.FC = () => {
    const { setNotification, addDisplayWidget, setView } = useAppStore();
    const [activeTab, setActiveTab] = useState<'CONNECT' | 'DEBUG' | 'LAB' | 'SYSTEM' | 'ASSETS'>('CONNECT');
    const [mockLogs, setMockLogs] = useState<string[]>([
        "[INF] (1000) Log System Initialized",
        "[INF] (1050) Booting TideFlux v2.1",
        "[INF] (1200) NVS Mount Success",
        "[INF] (1300) WiFi Connecting to Morere_WiFi...",
        "[INF] (2500) WiFi Connected! IP: 192.168.1.105",
        "[INF] (2600) REST Server started on port 80",
        "[INF] (2700) BLE Stack Started",
        "[DBG] (3000) Task Network started on Core 0",
        "[DBG] (3000) Task Animation started on Core 1",
        "[INF] (3500) Boot Verified Stable."
    ]);

    // --- ASSET CONVERTER STATE ---
    const [assetSource, setAssetSource] = useState<'UPLOAD' | 'LIBRARY'>('LIBRARY');
    const [assetFile, setAssetFile] = useState<File | null>(null);
    const [assetPreviewUrl, setAssetPreviewUrl] = useState<string | null>(null);
    const [assetFormat, setAssetFormat] = useState<'XBM' | 'RGB565'>('XBM');
    const [assetSize, setAssetSize] = useState<number>(32);
    const [assetThreshold, setAssetThreshold] = useState<number>(128);
    const [conversionResult, setConversionResult] = useState<string>('');
    const [assetName, setAssetName] = useState('icon_custom');
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleRefreshLogs = () => {
        const newLog = `[INF] (${Date.now() % 10000}) Heartbeat OK. FreeHeap: 184kb`;
        setMockLogs(prev => [...prev.slice(-15), newLog]);
    };

    // --- ASSET PROCESSING LOGIC ---
    const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAssetFile(file);
            const url = URL.createObjectURL(file);
            setAssetPreviewUrl(url);
            setAssetName(file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_').toLowerCase());
            setConversionResult(''); 
            
            // Auto process after slight delay to allow image load
            setTimeout(() => processImageSource(url), 100);
        }
    };

    const handlePresetSelect = (preset: typeof ICON_LIBRARY[0]) => {
        setAssetSource('LIBRARY');
        setAssetName(preset.id);
        
        // Create SVG Data URL from preset path
        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${preset.path}</svg>`;
        const blob = new Blob([svgString], {type: 'image/svg+xml'});
        const url = URL.createObjectURL(blob);
        setAssetPreviewUrl(url);
        
        // Auto process
        setTimeout(() => processImageSource(url), 100);
    };

    const processImageSource = (url: string) => {
        if (!canvasRef.current) return;
        const img = new Image();
        img.onload = () => {
            const canvas = canvasRef.current!;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Resize
            canvas.width = assetSize;
            canvas.height = assetSize;
            
            // Fill Background (White for clean conversion)
            ctx.fillStyle = '#FFFFFF'; 
            ctx.fillRect(0, 0, assetSize, assetSize);
            
            // Draw Image
            // For SVG presets, we might want to center/scale nicely if it's not square
            ctx.drawImage(img, 0, 0, assetSize, assetSize);
            
            generateCode(ctx);
        };
        img.src = url;
    };

    // Re-run generation if params change
    useEffect(() => {
        if (assetPreviewUrl) {
            processImageSource(assetPreviewUrl);
        }
    }, [assetSize, assetThreshold, assetFormat]);

    const generateCode = (ctx: CanvasRenderingContext2D) => {
        const imageData = ctx.getImageData(0, 0, assetSize, assetSize);
        const data = imageData.data;
        const varName = `icon_${assetName}_${assetSize}`;

        let output = '';

        if (assetFormat === 'XBM') {
            // XBM (1-bit Monochrome, LSB First)
            let bytes: string[] = [];
            for (let y = 0; y < assetSize; y++) {
                for (let x = 0; x < assetSize; x += 8) {
                    let byte = 0;
                    for (let b = 0; b < 8; b++) {
                        if (x + b < assetSize) {
                            const idx = (y * assetSize + (x + b)) * 4;
                            // Grayscale avg
                            const avg = (data[idx] + data[idx+1] + data[idx+2]) / 3;
                            // Threshold: Darker than threshold = 1 (Black/Foreground), Lighter = 0
                            if (avg < assetThreshold) {
                                byte |= (1 << b);
                            }
                        }
                    }
                    bytes.push('0x' + byte.toString(16).padStart(2, '0'));
                }
            }
            
            output = `// XBM Icon: ${assetSize}x${assetSize} (${assetName})\n`;
            output += `#define ${varName}_width ${assetSize}\n`;
            output += `#define ${varName}_height ${assetSize}\n`;
            output += `static unsigned char ${varName}_bits[] = {\n`;
            output += formatBytes(bytes);
            output += `\n};`;

        } else {
            // RGB565 (16-bit Color)
            let hexes: string[] = [];
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i+1];
                const b = data[i+2];
                // RGB565: R(5) G(6) B(5)
                const rgb = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
                hexes.push('0x' + rgb.toString(16).padStart(4, '0'));
            }

            output = `// RGB565 Icon: ${assetSize}x${assetSize} (${assetName})\n`;
            output += `const uint16_t ${varName}[${assetSize}*${assetSize}] = {\n`;
            output += formatBytes(hexes);
            output += `\n};`;
        }

        setConversionResult(output);
    };

    const formatBytes = (arr: string[]) => {
        let res = '  ';
        arr.forEach((val, i) => {
            res += val + ', ';
            if ((i + 1) % 12 === 0) res += '\n  ';
        });
        return res;
    };

    const copyCode = () => {
        navigator.clipboard.writeText(conversionResult);
        setNotification('success', 'Código copiado para a área de transferência');
    };

    const handleAddToDisplay = () => {
        if (!canvasRef.current) return;
        const dataUrl = canvasRef.current.toDataURL('image/png');
        
        addDisplayWidget({
            id: Math.random().toString(36).substr(2, 9),
            type: WidgetType.AI_IMAGE,
            x: 120, 
            y: 120, 
            scale: 1, 
            color: '#ffffff', 
            visible: true, 
            zIndex: 10,
            imageUrl: dataUrl,
            label: assetName,
            w: assetSize,
            h: assetSize
        });
        
        setNotification('success', `Ícone ${assetName} adicionado ao Display!`);
        setView(ViewState.DISPLAY);
    };

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Header Tabs */}
            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700 w-fit shrink-0 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('CONNECT')}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition whitespace-nowrap ${activeTab === 'CONNECT' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                >
                    <PlugZap size={14} /> Conexão
                </button>
                <button 
                    onClick={() => setActiveTab('SYSTEM')}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition whitespace-nowrap ${activeTab === 'SYSTEM' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                >
                    <HardDrive size={14} /> System & Logs
                </button>
                <button 
                    onClick={() => setActiveTab('DEBUG')}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition whitespace-nowrap ${activeTab === 'DEBUG' ? 'bg-green-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                >
                    <Bug size={14} /> Debug API
                </button>
                <button 
                    onClick={() => setActiveTab('ASSETS')}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition whitespace-nowrap ${activeTab === 'ASSETS' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                >
                    <ImageIcon size={14} /> Assets Converter
                </button>
                <button 
                    onClick={() => setActiveTab('LAB')}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition whitespace-nowrap ${activeTab === 'LAB' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                >
                    <Terminal size={14} /> Serial Lab
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-slate-800 rounded-lg border border-slate-700 p-6 overflow-hidden min-h-[500px]">
                {activeTab === 'CONNECT' && (
                    <div className="h-full flex flex-col animate-in fade-in">
                        <div className="mb-4">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Shield className="text-cyan-400" /> Gerenciador de Dispositivo
                            </h2>
                            <p className="text-sm text-slate-400">Gerencie a conexão física (USB/BLE) ou remota (WiFi).</p>
                        </div>
                        <div className="flex-1 overflow-hidden">
                             <ConnectionManager isEmbed={true} />
                        </div>
                    </div>
                )}

                {activeTab === 'SYSTEM' && (
                    <div className="h-full flex flex-col animate-in fade-in">
                        <div className="mb-4 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <HardDrive className="text-indigo-400" /> Sistema & Logs Inteligentes
                                </h2>
                                <p className="text-sm text-slate-400">Logs remotos, Watchdog Status e Backup de Configuração.</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleRefreshLogs} className="bg-slate-700 p-2 rounded hover:bg-slate-600 transition"><RefreshCcw size={14}/></button>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="bg-slate-900 p-3 rounded border border-slate-700">
                                <div className="text-[10px] text-slate-500 font-bold uppercase">Watchdog Task 0</div>
                                <div className="text-green-400 font-mono text-sm">HEALTHY</div>
                            </div>
                            <div className="bg-slate-900 p-3 rounded border border-slate-700">
                                <div className="text-[10px] text-slate-500 font-bold uppercase">Watchdog Task 1</div>
                                <div className="text-green-400 font-mono text-sm">HEALTHY</div>
                            </div>
                            <div className="bg-slate-900 p-3 rounded border border-slate-700">
                                <div className="text-[10px] text-slate-500 font-bold uppercase">NVS Storage</div>
                                <div className="text-blue-400 font-mono text-sm">MOUNTED</div>
                            </div>
                        </div>

                        <div className="flex-1 bg-black rounded border border-slate-700 p-4 overflow-y-auto font-mono text-xs shadow-inner">
                            {mockLogs.map((log, i) => {
                                const isErr = log.includes("[ERR]");
                                const isWrn = log.includes("[WRN]");
                                const isDbg = log.includes("[DBG]");
                                return (
                                    <div key={i} className={`mb-1 ${isErr ? 'text-red-500' : isWrn ? 'text-amber-500' : isDbg ? 'text-slate-500' : 'text-slate-300'}`}>
                                        {log}
                                    </div>
                                )
                            })}
                            <div className="animate-pulse text-cyan-500 mt-2">_</div>
                        </div>
                    </div>
                )}

                {activeTab === 'DEBUG' && (
                    <div className="h-full flex flex-col animate-in fade-in">
                         <div className="mb-4">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Network className="text-green-400" /> Diagnóstico de API
                            </h2>
                            <p className="text-sm text-slate-400">Teste as rotas que o ESP32 usará para buscar dados de maré e clima.</p>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <LedDebugPanel />
                        </div>
                    </div>
                )}

                {activeTab === 'ASSETS' && (
                    <div className="h-full flex flex-col animate-in fade-in">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <ImageIcon className="text-pink-400" /> Conversor de Assets (Ícones)
                            </h2>
                            <p className="text-sm text-slate-400">
                                Converta ícones públicos ou arquivos próprios para C Arrays otimizados (XBM/RGB565).
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0">
                            {/* Settings Column */}
                            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 flex flex-col gap-4">
                                
                                {/* Source Selector */}
                                <div className="flex bg-slate-800 rounded p-1 border border-slate-700 mb-2">
                                    <button onClick={()=>setAssetSource('LIBRARY')} className={`flex-1 text-xs font-bold py-1.5 rounded flex items-center justify-center gap-2 ${assetSource==='LIBRARY'?'bg-slate-600 text-white':'text-slate-400 hover:text-white'}`}>
                                        <Library size={12}/> Biblioteca Pública
                                    </button>
                                    <button onClick={()=>setAssetSource('UPLOAD')} className={`flex-1 text-xs font-bold py-1.5 rounded flex items-center justify-center gap-2 ${assetSource==='UPLOAD'?'bg-slate-600 text-white':'text-slate-400 hover:text-white'}`}>
                                        <Upload size={12}/> Upload Arquivo
                                    </button>
                                </div>

                                {assetSource === 'LIBRARY' ? (
                                    <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                                        {ICON_LIBRARY.map(icon => (
                                            <button 
                                                key={icon.id}
                                                onClick={() => handlePresetSelect(icon)}
                                                className={`aspect-square bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded flex flex-col items-center justify-center p-2 group transition ${assetName === icon.id ? 'border-pink-500 ring-1 ring-pink-500' : ''}`}
                                                title={icon.name}
                                            >
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-white mb-1">
                                                    <g dangerouslySetInnerHTML={{__html: icon.path}} />
                                                </svg>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div>
                                        <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-pink-500 hover:bg-slate-800 transition">
                                            <div className="text-center">
                                                <Upload size={24} className="mx-auto text-slate-500 mb-2"/>
                                                <span className="text-xs text-slate-400">PNG/SVG</span>
                                            </div>
                                            <input type="file" className="hidden" accept="image/*" onChange={handleAssetUpload} />
                                        </label>
                                    </div>
                                )}
                                
                                {/* Preview & Params */}
                                <div className="bg-slate-800 p-2 rounded border border-slate-700 flex gap-3 items-center">
                                    <div className="w-12 h-12 bg-white rounded border border-slate-500 overflow-hidden flex items-center justify-center">
                                        {assetPreviewUrl ? (
                                             <img src={assetPreviewUrl} className="w-full h-full object-contain p-1" alt="Preview"/>
                                        ) : (
                                             <div className="text-[9px] text-slate-400">Preview</div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-[10px] text-slate-500 font-bold uppercase">Nome Variável</div>
                                        <div className="text-xs font-mono text-white truncate">icon_{assetName}_{assetSize}</div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold block mb-2">Formato de Saída</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button 
                                            onClick={() => setAssetFormat('XBM')}
                                            className={`p-2 rounded text-xs font-bold border ${assetFormat === 'XBM' ? 'bg-pink-600 border-pink-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                                        >
                                            XBM (Mono)
                                        </button>
                                        <button 
                                            onClick={() => setAssetFormat('RGB565')}
                                            className={`p-2 rounded text-xs font-bold border ${assetFormat === 'RGB565' ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                                        >
                                            RGB565 (Color)
                                        </button>
                                    </div>
                                    <p className="text-[9px] text-slate-500 mt-1">
                                        {assetFormat === 'XBM' ? 'Ideal para OLED, U8G2 (1-bit).' : 'Ideal para TFT_eSPI, LCDs Coloridos (16-bit).'}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Tamanho (px)</label>
                                        <select 
                                            value={assetSize}
                                            onChange={e => setAssetSize(parseInt(e.target.value))}
                                            className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white"
                                        >
                                            <option value={16}>16x16</option>
                                            <option value={24}>24x24</option>
                                            <option value={32}>32x32</option>
                                            <option value={48}>48x48</option>
                                            <option value={64}>64x64</option>
                                        </select>
                                    </div>
                                    <div>
                                         {assetFormat === 'XBM' && (
                                            <>
                                                <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Threshold ({assetThreshold})</label>
                                                <input 
                                                    type="range" min="0" max="255" 
                                                    value={assetThreshold} 
                                                    onChange={e => setAssetThreshold(parseInt(e.target.value))}
                                                    className="w-full h-1.5 bg-slate-700 rounded appearance-none accent-pink-500 mt-2"
                                                />
                                            </>
                                         )}
                                    </div>
                                </div>
                                
                                {/* Hidden Canvas for Processing */}
                                <canvas ref={canvasRef} className="hidden" />
                            </div>

                            {/* Code Output Column */}
                            <div className="col-span-1 lg:col-span-2 bg-[#0d1117] rounded-lg border border-slate-700 p-0 flex flex-col overflow-hidden relative">
                                <div className="bg-slate-800 p-2 border-b border-slate-700 flex justify-between items-center">
                                    <span className="text-xs font-mono text-slate-400 flex items-center gap-2"><FileCode size={12}/> icon_{assetName}_{assetSize}.h</span>
                                    <div className="flex gap-2">
                                        <button onClick={handleAddToDisplay} className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-2 py-1 rounded flex items-center gap-1 transition shadow-sm border border-purple-500">
                                            <Monitor size={12} /> Add to Display
                                        </button>
                                        <button onClick={copyCode} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded flex items-center gap-1 transition border border-slate-600">
                                            <Copy size={12} /> Copiar Código
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                                    {conversionResult ? (
                                        <pre className="text-[10px] font-mono text-green-400 leading-relaxed whitespace-pre-wrap">
                                            {conversionResult}
                                        </pre>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                                            <ImageIcon size={32} className="mb-2"/>
                                            <p className="text-xs">Selecione um ícone para gerar código...</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'LAB' && (
                     <div className="h-full flex flex-col items-center justify-center text-slate-500 animate-in fade-in">
                         <Activity size={48} className="mb-4 opacity-50 text-amber-500"/>
                         <h3 className="text-lg font-bold text-slate-300">Lab Experimental & Serial</h3>
                         <div className="max-w-md text-center mt-2 space-y-2">
                             <p className="text-xs">
                                 Monitoramento serial bruto via WebSerial API.
                             </p>
                             <div className="bg-black p-4 rounded border border-slate-700 text-left font-mono text-[10px] text-green-500 h-40 opacity-75">
                                 [SYSTEM] Serial Port Opened<br/>
                                 [LAB] Waiting for data stream...<br/>
                                 {'>'} _
                             </div>
                         </div>
                     </div>
                )}
            </div>
        </div>
    );
};
