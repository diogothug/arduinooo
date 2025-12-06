
import React from 'react';
import { useAppStore } from '../../store';
import { LayoutTemplate, AlignVerticalJustifyCenter, Grid, Circle, RotateCw, Mountain, Spline, Palette, Cpu, Waves, Sun, Anchor, Zap, Wind, Moon, Activity, Plus, Trash2 } from 'lucide-react';

const PRESETS = [
    { id: 'tideFill2', label: 'Maré Alta Viva', icon: <Waves size={16} className="text-cyan-400"/>, desc: 'Gradiente vertical baseado na maré.' },
    { id: 'oceanCaustics', label: 'Moreré Lagoon', icon: <Sun size={16} className="text-yellow-400"/>, desc: 'Luz solar refratada na água.' },
    { id: 'coralReef', label: 'Coral Reef', icon: <Anchor size={16} className="text-red-400"/>, desc: 'Cores de recife com fundo arenoso.' },
    { id: 'storm', label: 'Tempestade', icon: <Zap size={16} className="text-slate-400"/>, desc: 'Nuvens escuras e raios.' }, 
    { id: 'aurora', label: 'Aurora', icon: <Wind size={16} className="text-green-400"/>, desc: 'Ondas suaves de cor no céu.' },
    { id: 'deepSea', label: 'Profundezas', icon: <Moon size={16} className="text-indigo-400"/>, desc: 'Partículas em azul profundo.' },
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

    return (
        <div className="space-y-6 animate-in fade-in pb-10">
             {/* LAYOUT SECTION */}
             <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><LayoutTemplate size={14}/> Layout Físico</h3>
                <div className="grid grid-cols-3 gap-2 mb-4">
                        {[
                            {id:'STRIP', l:'Fita', i:<AlignVerticalJustifyCenter className="rotate-90" size={14}/>}, 
                            {id:'MATRIX', l:'Matriz', i:<Grid size={14}/>}, 
                            {id:'RING', l:'Anel', i:<Circle size={14}/>}, 
                            {id:'SPIRAL', l:'Espiral', i:<RotateCw size={14}/>},
                            {id:'MOUNTAIN', l:'Montanha', i:<Mountain size={14}/>},
                            {id:'CUSTOM', l:'Vetor', i:<Spline size={14}/>}
                        ].map(type => (
                            <button 
                                key={type.id} 
                                onClick={() => updateFirmwareConfig({ ledLayoutType: type.id as any })} 
                                className={`flex flex-col items-center justify-center p-3 rounded border transition hover:bg-slate-800 ${firmwareConfig.ledLayoutType === type.id ? 'bg-cyan-900/40 border-cyan-500 text-cyan-400' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                            >
                                {type.i} <span className="text-[10px] mt-1 font-bold">{type.l}</span>
                            </button>
                        ))}
                </div>
                
                <div className="bg-slate-900 p-4 rounded border border-slate-700 space-y-4">
                    <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-bold uppercase">
                            <span>Total LEDs</span>
                            <span className="text-white">{firmwareConfig.ledCount}</span>
                        </div>
                        <input type="range" min="1" max="1024" value={firmwareConfig.ledCount} onChange={e=>updateFirmwareConfig({ledCount: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"/>
                    </div>
                
                    {firmwareConfig.ledLayoutType === 'MATRIX' && (
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800 animate-in fade-in">
                            <div>
                                <label className="text-[9px] block text-slate-500 font-bold uppercase mb-1">Largura</label>
                                <input type="number" value={firmwareConfig.ledMatrixWidth} onChange={e=>updateFirmwareConfig({ledMatrixWidth: parseInt(e.target.value)})} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-xs"/>
                            </div>
                            <div>
                                <label className="text-[9px] block text-slate-500 font-bold uppercase mb-1">Altura (Calc)</label>
                                <input type="number" disabled value={Math.ceil(firmwareConfig.ledCount / (firmwareConfig.ledMatrixWidth || 1))} className="w-full bg-slate-800/50 border border-slate-700 rounded p-2 text-slate-400 text-xs"/>
                            </div>
                            <div className="col-span-2 flex items-center gap-2 bg-slate-800 p-2 rounded">
                                <input type="checkbox" checked={firmwareConfig.ledSerpentine} onChange={e=>updateFirmwareConfig({ledSerpentine: e.target.checked})} className="w-4 h-4 cursor-pointer" />
                                <label className="text-[10px] text-slate-300 font-bold">Serpentina (ZigZag wiring)</label>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* COLOR PALETTE */}
            <div className="pt-4 border-t border-slate-700">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2"><Palette size={14}/> Paleta Personalizada</h3>
                    <button onClick={addColor} className="text-[10px] flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-cyan-400 transition">
                        <Plus size={12} /> Adicionar
                    </button>
                </div>
                
                <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar p-1">
                    {(firmwareConfig.customColors || ['#000000','#ffffff']).map((c, i) => (
                        <div key={i} className="flex gap-2 items-center group">
                            <input type="color" value={c} onChange={e=>handleColorChange(i, e.target.value)} className="w-8 h-8 rounded border-none cursor-pointer bg-transparent shadow-sm"/>
                            <input type="text" value={c} onChange={e=>handleColorChange(i, e.target.value)} className="flex-1 bg-slate-900 border border-slate-600 rounded p-1.5 text-xs text-white font-mono uppercase focus:border-cyan-500 outline-none"/>
                            <button onClick={() => removeColor(i)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 transition">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                    {(!firmwareConfig.customColors || firmwareConfig.customColors.length === 0) && (
                         <div className="text-[10px] text-slate-600 italic text-center py-2">Nenhuma cor definida. Adicione uma.</div>
                    )}
                </div>
            </div>

            {/* PRESETS */}
             <div className="pt-4 border-t border-slate-700">
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

             {/* SIMULATOR CONTROLS */}
             <div className="pt-4 border-t border-slate-700">
                <div className="flex justify-between items-center mb-3">
                     <h4 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Cpu size={12}/> Simulador de Variáveis</h4>
                     <button onClick={()=>setSimMode(!simMode)} className={`text-[9px] px-2 py-0.5 rounded border transition ${simMode?'bg-green-600 text-white border-green-500 shadow-green-900/50 shadow-md':'bg-slate-800 text-slate-500 border-slate-600'}`}>
                         {simMode ? 'ATIVO' : 'AUTO (STORE)'}
                     </button>
                </div>
                
                <div className={`space-y-4 p-3 rounded border transition-all ${simMode ? 'bg-slate-900 border-green-900/30' : 'bg-slate-900/30 border-slate-800 opacity-50 grayscale'}`}>
                    <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span className="font-bold flex items-center gap-1"><Waves size={10}/> Nível Maré</span>
                            <span className="text-white font-mono">{simParams.tide}%</span>
                        </div>
                        <input type="range" disabled={!simMode} value={simParams.tide} onChange={e=>setSimParams({...simParams, tide: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"/>
                    </div>
                    <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span className="font-bold flex items-center gap-1"><Wind size={10}/> Vento</span>
                            <span className="text-white font-mono">{simParams.wind}km/h</span>
                        </div>
                        <input type="range" disabled={!simMode} value={simParams.wind} onChange={e=>setSimParams({...simParams, wind: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-400"/>
                    </div>
                    <div>
                         <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1"><Moon size={10}/> Forçar Noite</span>
                            <input type="checkbox" disabled={!simMode} checked={simParams.isNight} onChange={e=>setSimParams({...simParams, isNight: e.target.checked})} className="cursor-pointer accent-purple-500"/>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
