
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store';
import { 
    Cpu, Waves, Sun, Anchor, Zap, Activity, Flame, Sparkles, 
    Settings, Ruler, Grid, Circle, AlignJustify, ChevronDown, ChevronRight,
    Play, Beaker, Code2, Palette, ArrowUp, ArrowDown, Wind, Box
} from 'lucide-react';

const PRESETS = [
    { id: 'fluidPhysics', label: 'Simulação Física 1D (Premium)', icon: <Waves size={16} className="text-cyan-400"/>, desc: 'Solver real de ondas e inércia.' },
    { id: 'bio', label: 'Bioluminescência', icon: <Sparkles size={16} className="text-emerald-400"/>, desc: 'Plâncton reativo ao impacto.' },
    { id: 'thermal', label: 'Thermal Drift', icon: <Flame size={16} className="text-orange-400"/>, desc: 'Visualização de calor.' },
    { id: 'tideWaveVertical', label: 'Onda Vertical', icon: <ArrowUp size={16} className="text-blue-400"/>, desc: 'Animação linear simples.' },
    { id: 'oceanCaustics', label: 'Moreré Lagoon', icon: <Sun size={16} className="text-yellow-400"/>, desc: 'Refração de luz na água.' },
    { id: 'storm', label: 'Tempestade', icon: <Zap size={16} className="text-slate-400"/>, desc: 'Nuvens e raios.' }, 
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
    const [expandedSection, setExpandedSection] = useState<string | null>('ANIMATION');

    const toggleSection = (id: string) => setExpandedSection(expandedSection === id ? null : id);

    const updatePhys = (key: string, val: any) => {
        updateFirmwareConfig({ physicalSpecs: { ...firmwareConfig.physicalSpecs, [key]: val } });
    };

    const updateFluid = (key: string, val: any) => {
        updateFirmwareConfig({ fluidParams: { ...firmwareConfig.fluidParams, [key]: val } });
    };

    return (
        <div className="space-y-4 pb-20">
            
            {/* --- SECTION 1: HARDWARE & TOPOLOGY --- */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <button onClick={() => toggleSection('HARDWARE')} className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-750 transition">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                        <Cpu size={14} className="text-amber-400"/> Hardware & Topologia
                    </span>
                    {expandedSection === 'HARDWARE' ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                </button>
                
                {expandedSection === 'HARDWARE' && (
                    <div className="p-4 bg-slate-900/50 border-t border-slate-700 space-y-4">
                        {/* Layout Selector */}
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'STRIP', label: 'Fita', icon: <AlignJustify size={14}/> },
                                { id: 'MATRIX', label: 'Matriz', icon: <Grid size={14}/> },
                                { id: 'RING', label: 'Anel', icon: <Circle size={14}/> },
                            ].map(l => (
                                <button 
                                    key={l.id}
                                    onClick={() => updateFirmwareConfig({ ledLayoutType: l.id as any })}
                                    className={`p-2 rounded border flex flex-col items-center gap-1 transition ${firmwareConfig.ledLayoutType === l.id ? 'bg-amber-900/30 border-amber-500 text-amber-300' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
                                >
                                    {l.icon}
                                    <span className="text-[10px] font-bold">{l.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Dimensions Input */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Total LEDs</label>
                                <input 
                                    type="number" 
                                    value={firmwareConfig.ledCount} 
                                    onChange={e => updateFirmwareConfig({ ledCount: parseInt(e.target.value) })}
                                    className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-white text-xs font-mono"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">GPIO Pin</label>
                                <input 
                                    type="number" 
                                    value={firmwareConfig.ledPin} 
                                    onChange={e => updateFirmwareConfig({ ledPin: parseInt(e.target.value) })}
                                    className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-white text-xs font-mono"
                                />
                            </div>
                        </div>

                        {/* Conditional Matrix Inputs */}
                        {firmwareConfig.ledLayoutType === 'MATRIX' && (
                            <div className="bg-slate-800 p-2 rounded border border-slate-700 grid grid-cols-2 gap-3 animate-in fade-in">
                                <div>
                                    <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Largura (Cols)</label>
                                    <input 
                                        type="number" 
                                        value={firmwareConfig.ledMatrixWidth || 16} 
                                        onChange={e => updateFirmwareConfig({ ledMatrixWidth: parseInt(e.target.value) })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-white text-xs font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Serpentina?</label>
                                    <button 
                                        onClick={() => updateFirmwareConfig({ ledSerpentine: !firmwareConfig.ledSerpentine })}
                                        className={`w-full p-1.5 rounded text-xs font-bold border ${firmwareConfig.ledSerpentine ? 'bg-green-900/30 border-green-600 text-green-400' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                                    >
                                        {firmwareConfig.ledSerpentine ? 'SIM (ZigZag)' : 'NÃO (Linear)'}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="pt-2 border-t border-slate-700/50">
                            <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1 flex items-center gap-1">
                                <Box size={10} /> Densidade Física
                            </label>
                            <div className="flex gap-2">
                                <input 
                                    type="number" placeholder="Comp (m)" step="0.1"
                                    value={firmwareConfig.physicalSpecs?.stripLengthMeters || 1}
                                    onChange={e => updatePhys('stripLengthMeters', parseFloat(e.target.value))}
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded p-1.5 text-white text-xs"
                                />
                                <select 
                                    value={firmwareConfig.physicalSpecs?.ledDensity || 60}
                                    onChange={e => updatePhys('ledDensity', parseInt(e.target.value))}
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded p-1.5 text-white text-xs"
                                >
                                    <option value={30}>30 LEDs/m</option>
                                    <option value={60}>60 LEDs/m</option>
                                    <option value={144}>144 LEDs/m</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- SECTION 2: ANIMATION & PRESETS --- */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <button onClick={() => toggleSection('ANIMATION')} className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-750 transition">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                        <Play size={14} className="text-cyan-400"/> Animação & Efeitos
                    </span>
                    {expandedSection === 'ANIMATION' ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                </button>
                
                {expandedSection === 'ANIMATION' && (
                    <div className="p-4 bg-slate-900/50 border-t border-slate-700 space-y-4">
                        <div className="space-y-2">
                            {PRESETS.map(p => (
                                <button 
                                    key={p.id} 
                                    onClick={() => updateFirmwareConfig({ animationMode: p.id })} 
                                    className={`w-full flex items-center gap-3 p-2 rounded border text-left transition ${firmwareConfig.animationMode === p.id ? 'bg-cyan-900/30 border-cyan-500 shadow-sm' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
                                >
                                    <div className={`p-1.5 rounded-full ${firmwareConfig.animationMode === p.id ? 'bg-cyan-500 text-slate-900' : 'bg-slate-700 text-slate-400'}`}>
                                        {p.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-xs font-bold ${firmwareConfig.animationMode === p.id ? 'text-cyan-100' : 'text-slate-300'}`}>{p.label}</div>
                                        <div className="text-[10px] text-slate-500 truncate">{p.desc}</div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-700/50">
                            <div>
                                <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Velocidade</label>
                                <input 
                                    type="range" min="0.1" max="5.0" step="0.1"
                                    value={firmwareConfig.animationSpeed}
                                    onChange={e => updateFirmwareConfig({ animationSpeed: parseFloat(e.target.value) })}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Intensidade</label>
                                <input 
                                    type="range" min="0" max="1" step="0.1"
                                    value={firmwareConfig.animationIntensity}
                                    onChange={e => updateFirmwareConfig({ animationIntensity: parseFloat(e.target.value) })}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                            </div>
                        </div>
                        
                        <div>
                             <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Brilho Global ({firmwareConfig.ledBrightness})</label>
                             <input 
                                type="range" min="0" max="255"
                                value={firmwareConfig.ledBrightness}
                                onChange={e => updateFirmwareConfig({ ledBrightness: parseInt(e.target.value) })}
                                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-white"
                             />
                        </div>
                    </div>
                )}
            </div>

            {/* --- SECTION 3: PHYSICS ENGINE --- */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <button onClick={() => toggleSection('PHYSICS')} className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-750 transition">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                        <Beaker size={14} className="text-purple-400"/> Física de Fluidos (Solver)
                    </span>
                    {expandedSection === 'PHYSICS' ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                </button>
                
                {expandedSection === 'PHYSICS' && (
                    <div className="p-4 bg-slate-900/50 border-t border-slate-700 space-y-4">
                         <div className="bg-purple-900/20 p-2 rounded border border-purple-500/30 text-[10px] text-purple-200 mb-2">
                             Ajuste fino do comportamento da água virtual.
                         </div>
                         
                         <div>
                             <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                 <span>Tensão (Rigidez)</span>
                                 <span className="font-mono text-white">{firmwareConfig.fluidParams?.tension}</span>
                             </div>
                             <input type="range" min="0.001" max="0.1" step="0.001" value={firmwareConfig.fluidParams?.tension} onChange={e=>updateFluid('tension', parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"/>
                         </div>
                         
                         <div>
                             <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                 <span>Amortecimento (Viscosidade)</span>
                                 <span className="font-mono text-white">{firmwareConfig.fluidParams?.damping}</span>
                             </div>
                             <input type="range" min="0.001" max="0.1" step="0.001" value={firmwareConfig.fluidParams?.damping} onChange={e=>updateFluid('damping', parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"/>
                         </div>

                         <div>
                             <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                 <span>Propagação (Spread)</span>
                                 <span className="font-mono text-white">{firmwareConfig.fluidParams?.spread}</span>
                             </div>
                             <input type="range" min="0.0" max="0.5" step="0.01" value={firmwareConfig.fluidParams?.spread} onChange={e=>updateFluid('spread', parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"/>
                         </div>
                    </div>
                )}
            </div>

            {/* --- SECTION 4: SIMULATION CONTROLS --- */}
            <div className="border-t border-slate-700 pt-4 mt-4">
                <div className="flex justify-between items-center mb-3">
                     <h4 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Settings size={12}/> Simulador de Variáveis</h4>
                     <button onClick={()=>setSimMode(!simMode)} className={`text-[9px] px-2 py-0.5 rounded border transition ${simMode?'bg-green-600 text-white border-green-500 shadow-green-900/50 shadow-md':'bg-slate-800 text-slate-500 border-slate-600'}`}>
                         {simMode ? 'ATIVO (OVERRIDE)' : 'DESATIVADO (AUTO)'}
                     </button>
                </div>
                
                <div className={`space-y-4 p-3 rounded border transition-all ${simMode ? 'bg-slate-900 border-green-900/30' : 'bg-slate-900/30 border-slate-800 opacity-50 grayscale pointer-events-none'}`}>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={()=>setSimParams({...simParams, tideDirection: 'RISING'})} className={`p-2 rounded border text-[10px] font-bold flex items-center justify-center gap-1 ${simParams.tideDirection === 'RISING' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                            <ArrowUp size={12}/> ENCHENTE
                        </button>
                        <button onClick={()=>setSimParams({...simParams, tideDirection: 'FALLING'})} className={`p-2 rounded border text-[10px] font-bold flex items-center justify-center gap-1 ${simParams.tideDirection === 'FALLING' ? 'bg-amber-600 text-white border-amber-500' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                            <ArrowDown size={12}/> VAZANTE
                        </button>
                    </div>

                    <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span className="font-bold flex items-center gap-1"><Waves size={10}/> Nível Maré</span>
                            <span className={`font-mono ${simParams.tide < 0 ? 'text-amber-500' : 'text-white'}`}>{simParams.tide}%</span>
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
