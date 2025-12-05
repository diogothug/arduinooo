

import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { Zap, Settings, AlertTriangle, Lightbulb, BoxSelect, CloudRain, Wind, Thermometer, Moon, Activity, Waves, AlignLeft, Sun, Sliders } from 'lucide-react';

// PREMIUM PRESETS DEFINITION
const PRESETS = [
    { id: 'tideFill2', label: 'Maré Alta Viva', icon: <Waves size={16} className="text-cyan-400"/>, desc: 'Gradiente dinâmico com ondas na superfície.', matrixOnly: false, palette: 0 },
    { id: 'oceanCaustics', label: 'Moreré Lagoon', icon: <Sun size={16} className="text-yellow-400"/>, desc: 'Reflexos de luz no fundo do mar (Simplex Noise).', matrixOnly: true, palette: 0 },
    { id: 'storm', label: 'Tempestade Forte', icon: <CloudRain size={16} className="text-slate-400"/>, desc: 'Turbulência, raios e mar agitado.', matrixOnly: false, palette: 3 }, // Cloud palette
    { id: 'aurora', label: 'Ambiente Aurora', icon: <Wind size={16} className="text-green-400"/>, desc: 'Ondas suaves estilo Boreal para relaxamento.', matrixOnly: true, palette: 1 }, // Forest
    { id: 'deepSea', label: 'Profundezas', icon: <Moon size={16} className="text-indigo-400"/>, desc: 'Partículas flutuantes e plâncton brilhante.', matrixOnly: false, palette: 0 },
    { id: 'neon', label: 'Neon Moreré', icon: <Zap size={16} className="text-purple-400"/>, desc: 'Ciclo de cores Cyberpunk.', matrixOnly: false, palette: 4 }, // Party
];

export const LedMaster: React.FC = () => {
    const { firmwareConfig, updateFirmwareConfig, keyframes, simulatedTime } = useAppStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // Bind local state to Store Config
    const animSpeed = firmwareConfig.animationSpeed;
    const animIntensity = firmwareConfig.animationIntensity;
    const activePresetId = firmwareConfig.animationMode;
    
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

    // Helper: Interpolate Tide Height
    const getTideHeightAt = (time: number) => {
        if (keyframes.length < 2) return 50;
        const cycle = firmwareConfig.cycleDuration || 24;
        let t = time % cycle;
        let start = keyframes[0];
        let end = keyframes[keyframes.length - 1];
        
        for (let i = 0; i < keyframes.length - 1; i++) {
            if (t >= keyframes[i].timeOffset && t <= keyframes[i+1].timeOffset) {
                start = keyframes[i];
                end = keyframes[i+1];
                break;
            }
        }
        
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

    // VISUAL SIMULATOR LOOP
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        const width = canvas.width;
        const height = canvas.height;

        const render = () => {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, width, height);

            const count = firmwareConfig.ledCount;
            const layout = firmwareConfig.ledLayoutType;
            const matrixW = firmwareConfig.ledMatrixWidth || 10;
            const matrixH = Math.ceil(count / matrixW);
            const time = Date.now();
            const tideLevel = getTideHeightAt(simulatedTime); 

            // Render LEDs
            for (let i = 0; i < count; i++) {
                let x = 0, y = 0, size = 10;
                let col = 0, row = 0;
                
                if (layout === 'STRIP') {
                    const margin = 20;
                    const usableWidth = width - (margin * 2);
                    const spacing = usableWidth / (count - 1 || 1);
                    x = margin + (i * spacing);
                    y = height / 2;
                    size = Math.min(spacing * 0.8, 15);
                    col = i; row = 0;
                } else if (layout === 'MATRIX') {
                    const cellW = width / matrixW;
                    const cellH = height / matrixH;
                    row = Math.floor(i / matrixW);
                    col = i % matrixW;
                    if (row % 2 !== 0) col = (matrixW - 1) - col; // Serpentine visual
                    x = (col * cellW) + (cellW / 2);
                    y = (row * cellH) + (cellH / 2);
                    size = Math.min(cellW, cellH) * 0.7;
                }

                // --- GENERATIVE ART SIMULATION (Approximating C++ logic) ---
                let r = 0, g = 0, b = 0;
                const effRow = matrixH - 1 - row; // Bottom up

                if (activePresetId === 'tideFill2') {
                    const fillH = (tideLevel / 100) * matrixH;
                    if (effRow < fillH) {
                        // Gradient Blue to Cyan
                        r = 0; g = 50 + (effRow * 20); b = 150 + (effRow * 10);
                        // Ripple
                        if (Math.sin(col*0.5 + time*0.005) > 0.5) g += 30;
                        if (effRow > fillH - 1) { r=150; g=200; b=255; } // Foam
                    }
                } 
                else if (activePresetId === 'oceanCaustics') {
                    // Simplex noise approximation
                    const scale = 0.2;
                    const val = Math.sin(col*scale + time*0.001*animSpeed) + Math.cos(row*scale + time*0.002*animSpeed);
                    const bright = Math.max(0, val * 100 * animIntensity + 50);
                    r=0; g=bright; b=bright+50;
                }
                else if (activePresetId === 'storm') {
                    const noise = Math.random();
                    if (noise > 0.98 * (1/animIntensity)) { r=255; g=255; b=255; } // Lightning
                    else { r=20; g=20; b=40; } // Dark clouds
                }
                else if (activePresetId === 'aurora') {
                    const wave = Math.sin(col*0.3 + time*0.002*animSpeed) * 100;
                    r=50; g=100 + wave; b=100 - wave;
                }
                else if (activePresetId === 'neon') {
                    const hue = (time * 0.1 * animSpeed + col * 10) % 360;
                    // HSL to RGB rough
                    r = hue < 120 ? 255 : 0; g = hue > 60 && hue < 180 ? 255 : 0; b = hue > 180 ? 255 : 0;
                }
                else {
                    // Deep Sea
                    r=0; g=10; b=40;
                    if (Math.random() > 0.99) { r=100; g=200; b=255; } // Particle
                }

                // Global Brightness
                const br = firmwareConfig.ledBrightness / 255;
                r*=br; g*=br; b*=br;

                // Draw
                ctx.beginPath();
                ctx.arc(x, y, size/2, 0, Math.PI*2);
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fill();
            }

            animationFrameId = requestAnimationFrame(render);
        };
        render();
        return () => cancelAnimationFrame(animationFrameId);
    }, [activePresetId, firmwareConfig, simulatedTime, animSpeed, animIntensity]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full p-2">
            
            {/* Left Col: Params */}
            <div className="flex flex-col gap-6 lg:col-span-1">
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Sliders size={20} className="text-cyan-400" /> Parâmetros de Animação
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
                                <span>Intensidade / Caos</span>
                                <span className="text-white">{(animIntensity*100).toFixed(0)}%</span>
                            </label>
                            <input type="range" min="0" max="1.0" step="0.05" value={animIntensity} onChange={e=>setAnimIntensity(parseFloat(e.target.value))} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"/>
                        </div>
                        
                        <div className="p-3 bg-slate-900 rounded border border-slate-700 text-xs text-slate-400">
                            <p className="mb-1"><strong className="text-white">Dica:</strong> A velocidade afeta a frequência das ondas e do ruído Simplex. A intensidade controla brilho dos picos ou quantidade de partículas.</p>
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

            {/* Right Col: Preview & Presets */}
            <div className="lg:col-span-2 flex flex-col gap-6">
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 flex-1 flex flex-col">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <BoxSelect size={20} className="text-blue-400" /> Live Preview
                        </h3>
                        <div className="flex gap-2">
                            <div className="text-[10px] bg-slate-900 px-2 py-1 rounded text-green-400 font-mono flex items-center gap-1"><Zap size={10}/> {typicalCurrent.toFixed(1)}A</div>
                            <div className="text-[10px] bg-slate-900 px-2 py-1 rounded text-slate-400 font-mono">
                                {firmwareConfig.ledLayoutType}
                            </div>
                        </div>
                     </div>

                     <div className="bg-black rounded-lg border-2 border-slate-700 relative overflow-hidden flex items-center justify-center p-4 shadow-inner min-h-[300px]">
                         <canvas ref={canvasRef} width={600} height={300} className="w-full h-full object-contain" />
                         <div className="absolute top-4 left-4 text-xs font-mono text-cyan-500 opacity-50">
                             MODE: {activePresetId.toUpperCase()}<br/>
                             FPS: 60
                         </div>
                     </div>

                     <div className="mt-6">
                         <p className="text-xs text-slate-400 font-bold uppercase mb-3 flex items-center gap-2"><Lightbulb size={12}/> Selecionar Preset (Engine)</p>
                         <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                             {PRESETS.map(preset => {
                                 const isMatch = activePresetId === preset.id;
                                 return (
                                    <button 
                                        key={preset.id}
                                        onClick={() => setActivePresetId(preset.id, preset.palette)}
                                        className={`flex flex-col items-start p-3 rounded-lg border text-left transition relative overflow-hidden group ${
                                            isMatch
                                            ? 'bg-cyan-900/30 border-cyan-500 text-white shadow-lg shadow-cyan-900/20' 
                                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:bg-slate-800'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1 text-xs font-bold">
                                            {preset.icon}
                                            {preset.label}
                                        </div>
                                        <div className="text-[10px] opacity-70 leading-tight">
                                            {preset.desc}
                                        </div>
                                        {isMatch && <div className="absolute top-2 right-2 w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>}
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