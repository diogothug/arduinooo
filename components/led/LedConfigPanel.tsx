
import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { 
    Cpu, Waves, Sun, Zap, Activity, Flame, Sparkles, 
    Settings, Grid, Circle, AlignJustify, ChevronDown, ChevronRight,
    Play, Beaker, ArrowUp, ArrowDown, Wind, Box, Palette, Moon, CloudRain, BarChart3,
    ArrowUpFromLine, Columns, LayoutTemplate
} from 'lucide-react';

const PRESETS = [
    { id: 'tideStripBasic', label: 'Tira LED: Fluxo Vertical', icon: <ArrowUpFromLine size={16} className="text-emerald-400"/>, desc: 'Ondas sobem na enchente e descem na vazante.' },
    { id: 'matrixBeach', label: 'Matriz: Praia Lateral', icon: <LayoutTemplate size={16} className="text-yellow-400"/>, desc: 'Areia e mar com ondas horizontais (Vista lateral).' },
    { id: 'matrixFluid', label: 'Matriz: Barra Premium', icon: <Columns size={16} className="text-cyan-400"/>, desc: 'Barra vertical com física de fluido e superfície.' },
    { id: 'moonPhase', label: 'Anel: Fase Lunar', icon: <Moon size={16} className="text-indigo-200"/>, desc: 'Anel mostra a iluminação atual da lua.' },
    { id: 'fluidPhysics', label: 'Tide Gauge Classic', icon: <BarChart3 size={16} className="text-slate-400"/>, desc: 'Simulação física original de nível.' },
    { id: 'oceanCaustics', label: 'Sunlight Refraction', icon: <Sun size={16} className="text-yellow-400"/>, desc: 'Simula luz solar no fundo do mar.' },
    { id: 'deepBreath', label: 'Tide Breathing', icon: <Waves size={16} className="text-indigo-300"/>, desc: 'Pulso suave. Rápido na cheia, lento na vazante.' },
    { id: 'aurora', label: 'Aurora Horizon', icon: <Activity size={16} className="text-emerald-400"/>, desc: 'Ondas magnéticas no horizonte da maré.' },
    { id: 'bio', label: 'Bioluminescência', icon: <Sparkles size={16} className="text-purple-400"/>, desc: 'Água escura que brilha na superfície.' },
    { id: 'storm', label: 'Alert Storm Mode', icon: <Zap size={16} className="text-amber-400"/>, desc: 'Alerta visual para marés extremas.' }, 
    { id: 'thermal', label: 'Thermal Depth', icon: <Flame size={16} className="text-orange-400"/>, desc: 'Gradiente de temperatura por profundidade.' },
];

interface LedConfigPanelProps {
    simMode: boolean;
    setSimMode: (v: boolean) => void;
    simParams: any;
    setSimParams: (v: any) => void;
}

export const LedConfigPanel: React.FC<LedConfigPanelProps> = ({ simMode, setSimMode, simParams, setSimParams }) => {
    const { firmwareConfig, updateFirmwareConfig } = useAppStore();
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        'HARDWARE': false,
        'ANIMATION': true,
        'PHYSICS': false
    });

    const toggleSection = (id: string) => {
        setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const updatePhys = (key: string, val: any) => {
        updateFirmwareConfig({ physicalSpecs: { ...firmwareConfig.physicalSpecs, [key]: val } });
    };

    const updateFluid = (key: string, val: any) => {
        updateFirmwareConfig({ fluidParams: { ...firmwareConfig.fluidParams, [key]: val } });
    };

    const updateAuto = (key: string, val: boolean) => {
        updateFirmwareConfig({ autonomous: { ...firmwareConfig.autonomous, [key]: val } });
    };

    return (
        <div className="space-y-4 pb-10">
            
            {/* --- SECTION 1: HARDWARE & TOPOLOGY --- */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden shadow-sm">
                <button onClick={() => toggleSection('HARDWARE')} className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-750 transition">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <Cpu size={14} className="text-amber-400"/> Hardware & Topologia
                    </span>
                    {expandedSections['HARDWARE'] ? <ChevronDown size={14} className="text-slate-500"/> : <ChevronRight size={14} className="text-slate-500"/>}
                </button>
                
                {expandedSections['HARDWARE'] && (
                    <div className="p-4 bg-slate-900/50 border-t border-slate-700 space-y-4">
                        {/* Layout Selector */}
                        <div>
                            <label className="text-[9px] text-slate-500 font-bold uppercase block mb-2">Tipo de Layout</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'STRIP', label: 'Fita LED', icon: <AlignJustify size={16}/> },
                                    { id: 'MATRIX', label: 'Matriz', icon: <Grid size={16}/> },
                                    { id: 'RING', label: 'Anel', icon: <Circle size={16}/> },
                                ].map(l => (
                                    <button 
                                        key={l.id}
                                        onClick={() => updateFirmwareConfig({ ledLayoutType: l.id as any })}
                                        className={`p-3 rounded border flex flex-col items-center gap-2 transition ${firmwareConfig.ledLayoutType === l.id ? 'bg-amber-500/10 border-amber-500 text-amber-400' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
                                    >
                                        {l.icon}
                                        <span className="text-[10px] font-bold">{l.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Dimensions Input */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Total LEDs</label>
                                <input 
                                    type="number" 
                                    value={firmwareConfig.ledCount} 
                                    onChange={e => updateFirmwareConfig({ ledCount: parseInt(e.target.value) })}
                                    className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-xs font-mono focus:border-amber-500 outline-none transition"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">GPIO Pin (ESP32)</label>
                                <input 
                                    type="number" 
                                    value={firmwareConfig.ledPin} 
                                    onChange={e => updateFirmwareConfig({ ledPin: parseInt(e.target.value) })}
                                    className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-xs font-mono focus:border-amber-500 outline-none transition"
                                />
                            </div>
                        </div>

                        {/* Conditional Matrix Inputs */}
                        {firmwareConfig.ledLayoutType === 'MATRIX' && (
                            <div className="bg-slate-800/80 p-3 rounded border border-slate-700 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                                <div className="col-span-2 text-[10px] text-cyan-400 font-bold border-b border-slate-700 pb-1 mb-1 flex items-center gap-1">
                                    <Grid size={10} /> Configuração Matriz
                                </div>
                                <div>
                                    <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Largura (Cols)</label>
                                    <input 
                                        type="number" 
                                        value={firmwareConfig.ledMatrixWidth || 16} 
                                        onChange={e => updateFirmwareConfig({ ledMatrixWidth: parseInt(e.target.value) })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-xs font-mono focus:border-cyan-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Topologia</label>
                                    <button 
                                        onClick={() => updateFirmwareConfig({ ledSerpentine: !firmwareConfig.ledSerpentine })}
                                        className={`w-full p-2 rounded text-[10px] font-bold border transition ${firmwareConfig.ledSerpentine ? 'bg-cyan-900/30 border-cyan-600 text-cyan-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                                    >
                                        {firmwareConfig.ledSerpentine ? 'SERPENTINA (ZigZag)' : 'LINEAR (Raster)'}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="pt-2 border-t border-slate-700/50">
                            <label className="text-[9px] text-slate-500 font-bold uppercase block mb-2 flex items-center gap-1">
                                <Box size={10} /> Densidade Física
                            </label>
                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <input 
                                        type="number" placeholder="Comp (m)" step="0.1"
                                        value={firmwareConfig.physicalSpecs?.stripLengthMeters || 1}
                                        onChange={e => updatePhys('stripLengthMeters', parseFloat(e.target.value))}
                                        className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-xs focus:border-amber-500 outline-none"
                                    />
                                    <span className="absolute right-2 top-2 text-[10px] text-slate-500">metros</span>
                                </div>
                                <select 
                                    value={firmwareConfig.physicalSpecs?.ledDensity || 60}
                                    onChange={e => updatePhys('ledDensity', parseInt(e.target.value))}
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded p-2 text-white text-xs focus:border-amber-500 outline-none"
                                >
                                    <option value={30}>30 LEDs/m</option>
                                    <option value={60}>60 LEDs/m</option>
                                    <option value={96}>96 LEDs/m</option>
                                    <option value={144}>144 LEDs/m</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- SECTION 2: ANIMATION & PRESETS --- */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden shadow-sm">
                <button onClick={() => toggleSection('ANIMATION')} className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-750 transition">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <Play size={14} className="text-cyan-400"/> Animação & Efeitos
                    </span>
                    {expandedSections['ANIMATION'] ? <ChevronDown size={14} className="text-slate-500"/> : <ChevronRight size={14} className="text-slate-500"/>}
                </button>
                
                {expandedSections['ANIMATION'] && (
                    <div className="p-4 bg-slate-900/50 border-t border-slate-700 space-y-4">
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                            {PRESETS.map(p => (
                                <button 
                                    key={p.id} 
                                    onClick={() => updateFirmwareConfig({ animationMode: p.id })} 
                                    className={`w-full flex items-center gap-3 p-2 rounded border text-left transition group ${firmwareConfig.animationMode === p.id ? 'bg-cyan-900/20 border-cyan-500/50 shadow-sm' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                                >
                                    <div className={`p-2 rounded-lg ${firmwareConfig.animationMode === p.id ? 'bg-cyan-500 text-slate-900' : 'bg-slate-700 text-slate-400 group-hover:text-slate-200'}`}>
                                        {p.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-xs font-bold ${firmwareConfig.animationMode === p.id ? 'text-cyan-100' : 'text-slate-300'}`}>{p.label}</div>
                                        <div className="text-[10px] text-slate-500 truncate">{p.desc}</div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Dynamics / Autonomy */}
                        <div className="bg-slate-900 p-3 rounded border border-slate-700 space-y-3">
                             <h4 className="text-[10px] text-slate-500 font-bold uppercase mb-2">Dinâmica Ambiental</h4>
                             
                             <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2">
                                     <CloudRain size={14} className="text-blue-400"/>
                                     <span className="text-xs text-slate-300">Vincular Clima (Vento)</span>
                                 </div>
                                 <input 
                                     type="checkbox" 
                                     checked={firmwareConfig.autonomous.linkWeatherToLeds}
                                     onChange={e => updateAuto('linkWeatherToLeds', e.target.checked)}
                                     className="accent-blue-500"
                                 />
                             </div>

                             <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2">
                                     <Moon size={14} className="text-indigo-400"/>
                                     <span className="text-xs text-slate-300">Vincular Astronomia (Lua)</span>
                                 </div>
                                 <input 
                                     type="checkbox" 
                                     checked={firmwareConfig.autonomous.linkPaletteToTime}
                                     onChange={e => updateAuto('linkPaletteToTime', e.target.checked)}
                                     className="accent-indigo-500"
                                 />
                             </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div>
                                <label className="text-[9px] text-slate-500 font-bold uppercase block mb-2">Velocidade Base</label>
                                <input 
                                    type="range" min="0.1" max="5.0" step="0.1"
                                    value={firmwareConfig.animationSpeed}
                                    onChange={e => updateFirmwareConfig({ animationSpeed: parseFloat(e.target.value) })}
                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] text-slate-500 font-bold uppercase block mb-2">Intensidade Base</label>
                                <input 
                                    type="range" min="0" max="1" step="0.1"
                                    value={firmwareConfig.animationIntensity}
                                    onChange={e => updateFirmwareConfig({ animationIntensity: parseFloat(e.target.value) })}
                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                            </div>
                        </div>
                        
                        <div className="bg-slate-900 p-3 rounded border border-slate-700 flex items-center gap-3">
                             <Palette size={16} className="text-slate-400"/>
                             <div className="flex-1">
                                 <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Brilho Global ({Math.round(firmwareConfig.ledBrightness/2.55)}%)</label>
                                 <input 
                                    type="range" min="0" max="255"
                                    value={firmwareConfig.ledBrightness}
                                    onChange={e => updateFirmwareConfig({ ledBrightness: parseInt(e.target.value) })}
                                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-white"
                                 />
                             </div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- SECTION 3: PHYSICS ENGINE --- */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden shadow-sm">
                <button onClick={() => toggleSection('PHYSICS')} className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-750 transition">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                        <Beaker size={14} className="text-purple-400"/> Física de Fluidos (Solver)
                    </span>
                    {expandedSections['PHYSICS'] ? <ChevronDown size={14} className="text-slate-500"/> : <ChevronRight size={14} className="text-slate-500"/>}
                </button>
                
                {expandedSections['PHYSICS'] && (
                    <div className="p-4 bg-slate-900/50 border-t border-slate-700 space-y-4">
                         <div className="bg-purple-900/10 p-3 rounded border border-purple-500/20 text-[10px] text-purple-200 mb-2 leading-relaxed">
                             Ajustes finos para o comportamento da "água" nos LEDs.
                         </div>
                         
                         <div>
                             <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                 <span>Tensão (Rigidez da Superfície)</span>
                                 <span className="font-mono text-white">{firmwareConfig.fluidParams?.tension}</span>
                             </div>
                             <input type="range" min="0.001" max="0.1" step="0.001" value={firmwareConfig.fluidParams?.tension} onChange={e=>updateFluid('tension', parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"/>
                         </div>
                         
                         <div>
                             <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                 <span>Amortecimento (Viscosidade)</span>
                                 <span className="font-mono text-white">{firmwareConfig.fluidParams?.damping}</span>
                             </div>
                             <input type="range" min="0.001" max="0.1" step="0.001" value={firmwareConfig.fluidParams?.damping} onChange={e=>updateFluid('damping', parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"/>
                         </div>
                    </div>
                )}
            </div>

            {/* --- SECTION 4: SIMULATION CONTROLS --- */}
            <div className="border-t border-slate-700 pt-6 mt-4">
                <div className="flex justify-between items-center mb-3">
                     <h4 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2"><Settings size={12}/> Simulador (Override)</h4>
                     <button onClick={()=>setSimMode(!simMode)} className={`text-[9px] px-3 py-1 rounded-full border transition font-bold ${simMode?'bg-green-600 text-white border-green-500 shadow-lg shadow-green-900/50':'bg-slate-800 text-slate-500 border-slate-600 hover:bg-slate-700'}`}>
                         {simMode ? 'ATIVO' : 'AUTO'}
                     </button>
                </div>
                
                <div className={`space-y-4 p-4 rounded-lg border transition-all ${simMode ? 'bg-slate-800 border-green-900/50 opacity-100' : 'bg-slate-900/30 border-slate-800 opacity-50 grayscale pointer-events-none'}`}>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={()=>setSimParams({...simParams, tideDirection: 'RISING'})} className={`p-2 rounded border text-[10px] font-bold flex items-center justify-center gap-1 ${simParams.tideDirection === 'RISING' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                            <ArrowUp size={12}/> ENCHENTE
                        </button>
                        <button onClick={()=>setSimParams({...simParams, tideDirection: 'FALLING'})} className={`p-2 rounded border text-[10px] font-bold flex items-center justify-center gap-1 ${simParams.tideDirection === 'FALLING' ? 'bg-amber-600 text-white border-amber-500' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                            <ArrowDown size={12}/> VAZANTE
                        </button>
                    </div>

                    <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span className="font-bold flex items-center gap-1"><Waves size={10}/> Nível Maré</span>
                            <span className={`font-mono font-bold ${simParams.tide < 0 ? 'text-amber-500' : 'text-cyan-400'}`}>{simParams.tide}%</span>
                        </div>
                        <input 
                            type="range" min="-10" max="110" 
                            value={simParams.tide} 
                            onChange={e=>setSimParams({...simParams, tide: parseInt(e.target.value)})} 
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>

                    <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span className="font-bold flex items-center gap-1"><Wind size={10}/> Vento (Turbulência)</span>
                            <span className="font-mono text-white">{simParams.wind}km/h</span>
                        </div>
                        <input 
                            type="range" min="0" max="100" 
                            value={simParams.wind} 
                            onChange={e=>setSimParams({...simParams, wind: parseInt(e.target.value)})} 
                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-400"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
