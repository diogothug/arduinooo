




import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store';
import { LayoutTemplate, AlignVerticalJustifyCenter, Grid, Circle, RotateCw, Mountain, Spline, Palette, Cpu, Waves, Sun, Anchor, Zap, Wind, Moon, Activity, Plus, Trash2, ArrowUp, ArrowDown, BarChart3, AlertOctagon, ArrowUpCircle, Ruler, BatteryCharging, Code2, Save, Sparkles, Flame, TestTube, Beaker, CloudRain } from 'lucide-react';

const PRESETS = [
    { id: 'fluidPhysics', label: 'Simulação Física 1D (Premium)', icon: <Waves size={16} className="text-cyan-400"/>, desc: 'Solver real de ondas, inércia e espuma.' },
    { id: 'bio', label: 'Bioluminescência', icon: <Sparkles size={16} className="text-emerald-400"/>, desc: 'Plâncton reativo ao impacto.' },
    { id: 'thermal', label: 'Thermal Drift', icon: <Flame size={16} className="text-orange-400"/>, desc: 'Visualização de calor e entropia.' },
    { id: 'tideWaveVertical', label: 'Onda Vertical (Standard)', icon: <ArrowUpCircle size={16} className="text-blue-400"/>, desc: 'Animação linear simples.' },
    { id: 'oceanCaustics', label: 'Moreré Lagoon', icon: <Sun size={16} className="text-yellow-400"/>, desc: 'Luz solar refratada na água.' },
    { id: 'coralReef', label: 'Coral Reef', icon: <Anchor size={16} className="text-red-400"/>, desc: 'Cores de recife com fundo arenoso.' },
    { id: 'storm', label: 'Tempestade', icon: <Zap size={16} className="text-slate-400"/>, desc: 'Nuvens escuras e raios.' }, 
    { id: 'neon', label: 'Neon Cyber', icon: <Activity size={16} className="text-purple-400"/>, desc: 'Ciclo RGB intenso.' },
];

interface LedConfigPanelProps {
    simMode: boolean;
    setSimMode: (v: boolean) => void;
    simParams: any;
    setSimParams: (v: any) => void;
}

export const LedConfigPanel: React.FC<LedConfigPanelProps> = ({ simMode, setSimMode, simParams, setSimParams }) => {
    const { firmwareConfig, updateFirmwareConfig } = useAppStore();
    const [editorMode, setEditorMode] = useState<'PRESETS' | 'SHADER' | 'PHYSICS'>('PRESETS');

    // Shader State
    const [shaderCode, setShaderCode] = useState(firmwareConfig.shader?.code || 'sin(t + i * 0.2) * 255');

    // Sync shader code to store debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            updateFirmwareConfig({ 
                shader: { 
                    ...firmwareConfig.shader, 
                    code: shaderCode,
                    enabled: editorMode === 'SHADER'
                } 
            });
        }, 500);
        return () => clearTimeout(timer);
    }, [shaderCode, editorMode]);

    const handleColorChange = (idx: number, val: string) => {
        const c = [...(firmwareConfig.customColors || [])];
        c[idx] = val;
        updateFirmwareConfig({ customColors: c });
    };

    const addColor = () => {
        const c = [...(firmwareConfig.customColors || []), '#ffffff'];
        updateFirmwareConfig({ customColors: c });
    };

    const removeColor = (idx: number) => {
        const c = [...(firmwareConfig.customColors || [])];
        if (c.length > 1) {
            c.splice(idx, 1);
            updateFirmwareConfig({ customColors: c });
        }
    };

    const applyPhysicalCalculation = () => {
        const { stripLengthMeters, ledDensity } = firmwareConfig.physicalSpecs;
        const total = Math.round(stripLengthMeters * ledDensity);
        updateFirmwareConfig({ ledCount: total });
    };

    const powerStats = (() => {
        const totalLeds = firmwareConfig.ledCount;
        const maxAmps = totalLeds * 0.06;
        const typicalAmps = maxAmps * 0.35; 
        return { max: maxAmps.toFixed(1), typical: typicalAmps.toFixed(1) };
    })();

    const updateFluid = (k: string, v: number) => {
        updateFirmwareConfig({ fluidParams: { ...firmwareConfig.fluidParams, [k]: v } });
    };

    const applyFluidPreset = (name: 'CALM' | 'BREEZE' | 'WINDY' | 'STORM') => {
        switch(name) {
            case 'CALM': updateFirmwareConfig({ fluidParams: { tension: 0.01, damping: 0.05, spread: 0.05 } }); break;
            case 'BREEZE': updateFirmwareConfig({ fluidParams: { tension: 0.025, damping: 0.02, spread: 0.1 } }); break;
            case 'WINDY': updateFirmwareConfig({ fluidParams: { tension: 0.05, damping: 0.01, spread: 0.15 } }); break;
            case 'STORM': updateFirmwareConfig({ fluidParams: { tension: 0.08, damping: 0.005, spread: 0.25 } }); break;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-10">
             
             {/* MODE SWITCHER */}
             <div className="bg-slate-900 p-1 rounded-lg border border-slate-700 flex">
                 <button 
                    onClick={() => setEditorMode('PRESETS')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded transition ${editorMode === 'PRESETS' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                 >
                     MODOS
                 </button>
                 <button 
                    onClick={() => setEditorMode('PHYSICS')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded transition flex items-center justify-center gap-2 ${editorMode === 'PHYSICS' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                 >
                     <Beaker size={12}/> FÍSICA
                 </button>
                 <button 
                    onClick={() => setEditorMode('SHADER')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded transition flex items-center justify-center gap-2 ${editorMode === 'SHADER' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                 >
                     <Code2 size={12}/> SHADER
                 </button>
             </div>

             {editorMode === 'SHADER' && (
                 <div className="bg-slate-900 border border-indigo-500/50 p-4 rounded-lg relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-2 opacity-5 text-indigo-500">
                         <Code2 size={100}/>
                     </div>
                     <div className="relative z-10">
                         <h3 className="text-xs font-bold text-indigo-400 mb-2 uppercase flex items-center gap-2">
                             <Cpu size={14}/> Script de Animação (GLSL Lite)
                         </h3>
                         <textarea 
                             value={shaderCode}
                             onChange={(e) => setShaderCode(e.target.value)}
                             className="w-full h-32 bg-black border border-slate-700 rounded p-3 text-xs font-mono text-green-400 focus:border-indigo-500 outline-none resize-none"
                             spellCheck={false}
                         />
                     </div>
                 </div>
             )}

            {editorMode === 'PHYSICS' && (
                <div className="bg-slate-900 border border-cyan-500/50 p-4 rounded-lg relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-2 opacity-5 text-cyan-500">
                         <Waves size={100}/>
                     </div>
                     <div className="relative z-10 space-y-4">
                         <h3 className="text-xs font-bold text-cyan-400 mb-2 uppercase flex items-center gap-2">
                             <TestTube size={14}/> Engine 1D Water Solver
                         </h3>
                         <p className="text-[10px] text-slate-400">
                            Configure o comportamento do fluido simulado na fita LED.
                         </p>
                         
                         <div className="grid grid-cols-2 gap-2 mb-4">
                            <button onClick={() => applyFluidPreset('CALM')} className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500 rounded text-[10px] font-bold text-cyan-200 flex flex-col items-center gap-1 transition">
                                <Sun size={12}/> Calm
                            </button>
                            <button onClick={() => applyFluidPreset('BREEZE')} className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500 rounded text-[10px] font-bold text-cyan-200 flex flex-col items-center gap-1 transition">
                                <Wind size={12}/> Breeze
                            </button>
                            <button onClick={() => applyFluidPreset('WINDY')} className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500 rounded text-[10px] font-bold text-cyan-200 flex flex-col items-center gap-1 transition">
                                <CloudRain size={12}/> Windy
                            </button>
                            <button onClick={() => applyFluidPreset('STORM')} className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500 rounded text-[10px] font-bold text-cyan-200 flex flex-col items-center gap-1 transition">
                                <Zap size={12}/> Storm
                            </button>
                         </div>

                         <div>
                             <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                 <span>Tensão (Stiffness)</span>
                                 <span className="font-mono text-white">{firmwareConfig.fluidParams.tension}</span>
                             </div>
                             <input type="range" min="0.001" max="0.1" step="0.001" value={firmwareConfig.fluidParams.tension} onChange={e=>updateFluid('tension', parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"/>
                         </div>
                         
                         <div>
                             <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                 <span>Damping (Friction)</span>
                                 <span className="font-mono text-white">{firmwareConfig.fluidParams.damping}</span>
                             </div>
                             <input type="range" min="0.001" max="0.1" step="0.001" value={firmwareConfig.fluidParams.damping} onChange={e=>updateFluid('damping', parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"/>
                         </div>

                         <div>
                             <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                 <span>Spread (Propagation)</span>
                                 <span className="font-mono text-white">{firmwareConfig.fluidParams.spread}</span>
                             </div>
                             <input type="range" min="0.0" max="0.5" step="0.01" value={firmwareConfig.fluidParams.spread} onChange={e=>updateFluid('spread', parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"/>
                         </div>
                     </div>
                </div>
            )}

             {editorMode === 'PRESETS' && (
                <>
                {/* PRESETS */}
                <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Preset de Animação</h4>
                    <div className="grid grid-cols-1 gap-2">
                        {PRESETS.map(p => (
                            <button key={p.id} onClick={()=>updateFirmwareConfig({ animationMode: p.id })} className={`flex items-center gap-3 p-3 rounded-lg border text-left transition hover:border-slate-500 ${firmwareConfig.animationMode===p.id ? 'bg-gradient-to-r from-cyan-900/40 to-slate-900 border-cyan-500 shadow-lg shadow-cyan-900/20' : 'bg-slate-900 border-slate-700 opacity-70 hover:opacity-100'}`}>
                                <div className={`p-2 rounded-full ${firmwareConfig.animationMode===p.id ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-500'}`}>
                                    {p.icon}
                                </div>
                                <div>
                                    <div className={`text-xs font-bold ${firmwareConfig.animationMode===p.id ? 'text-white' : 'text-slate-400'}`}>{p.label}</div>
                                    <div className="text-[10px] opacity-60 text-slate-400">{p.desc}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* PHYSICAL SPECS & POWER */}
                <div className="bg-slate-900 p-4 rounded border border-slate-700 space-y-4 relative overflow-hidden mt-4">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <Ruler size={64} />
                    </div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2 relative z-10">
                        <Ruler size={14}/> Física & Energia (Adaptativo)
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4 relative z-10">
                        <div>
                            <label className="text-[9px] block text-slate-500 font-bold uppercase mb-1">Comprimento (m)</label>
                            <input 
                                type="number" 
                                step="0.1"
                                value={firmwareConfig.physicalSpecs?.stripLengthMeters || 1.0} 
                                onChange={e=>updateFirmwareConfig({ physicalSpecs: {...firmwareConfig.physicalSpecs, stripLengthMeters: parseFloat(e.target.value)} })} 
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-xs focus:border-cyan-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] block text-slate-500 font-bold uppercase mb-1">Densidade (LEDs/m)</label>
                            <select 
                                value={firmwareConfig.physicalSpecs?.ledDensity || 60} 
                                onChange={e=>updateFirmwareConfig({ physicalSpecs: {...firmwareConfig.physicalSpecs, ledDensity: parseInt(e.target.value) as any} })}
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-xs focus:border-cyan-500 outline-none"
                            >
                                <option value={30}>30 LEDs/m</option>
                                <option value={60}>60 LEDs/m</option>
                                <option value={96}>96 LEDs/m</option>
                                <option value={144}>144 LEDs/m</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center justify-between bg-slate-800/50 p-2 rounded border border-slate-700/50 relative z-10">
                        <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 uppercase">Total Calculado</span>
                            <span className="text-sm font-mono text-cyan-400 font-bold">
                                {Math.round((firmwareConfig.physicalSpecs?.stripLengthMeters || 1) * (firmwareConfig.physicalSpecs?.ledDensity || 60))} LEDs
                            </span>
                        </div>
                        <button 
                            onClick={applyPhysicalCalculation}
                            className="text-[10px] bg-cyan-900/30 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-800/50 px-3 py-1.5 rounded transition font-bold"
                        >
                            Atualizar Total
                        </button>
                    </div>
                </div>
                </>
             )}

             {/* SIMULATOR CONTROLS */}
             <div className="pt-4 border-t border-slate-700">
                <div className="flex justify-between items-center mb-3">
                     <h4 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Cpu size={12}/> Simulador de Variáveis</h4>
                     <button onClick={()=>setSimMode(!simMode)} className={`text-[9px] px-2 py-0.5 rounded border transition ${simMode?'bg-green-600 text-white border-green-500 shadow-green-900/50 shadow-md':'bg-slate-800 text-slate-500 border-slate-600'}`}>
                         {simMode ? 'ATIVO' : 'AUTO (STORE)'}
                     </button>
                </div>
                
                <div className={`space-y-4 p-3 rounded border transition-all ${simMode ? 'bg-slate-900 border-green-900/30' : 'bg-slate-900/30 border-slate-800 opacity-50 grayscale'}`}>
                    
                    {/* Direction Toggle */}
                    <div className="grid grid-cols-2 gap-2">
                        <button disabled={!simMode} onClick={()=>setSimParams({...simParams, tideDirection: 'RISING'})} className={`p-2 rounded border text-[10px] font-bold flex items-center justify-center gap-1 ${simParams.tideDirection === 'RISING' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                            <ArrowUp size={12}/> ENCHENTE
                        </button>
                        <button disabled={!simMode} onClick={()=>setSimParams({...simParams, tideDirection: 'FALLING'})} className={`p-2 rounded border text-[10px] font-bold flex items-center justify-center gap-1 ${simParams.tideDirection === 'FALLING' ? 'bg-amber-600 text-white border-amber-500' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                            <ArrowDown size={12}/> VAZANTE
                        </button>
                    </div>

                    {/* Main Tide Slider */}
                    <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span className="font-bold flex items-center gap-1"><Waves size={10}/> Nível Maré</span>
                            <span className={`font-mono ${simParams.tide < 0 ? 'text-amber-500' : 'text-white'}`}>{simParams.tide}%</span>
                        </div>
                        <input 
                            type="range" 
                            disabled={!simMode} 
                            min={simParams.allowNegative ? "-20" : "0"} 
                            max="120" 
                            value={simParams.tide} 
                            onChange={e=>setSimParams({...simParams, tide: parseInt(e.target.value)})} 
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};