
import React from 'react';
import { useAppStore } from '../../store';
import { LayoutTemplate, AlignVerticalJustifyCenter, Grid, Circle, RotateCw, Mountain, Spline, Palette, Cpu, Waves, Sun, Anchor, Zap, Wind, Moon, Activity } from 'lucide-react';

const PRESETS = [
    { id: 'tideFill2', label: 'Maré Alta Viva', icon: <Waves size={16} className="text-cyan-400"/>, desc: 'Gradiente dinâmico com ondas.' },
    { id: 'oceanCaustics', label: 'Moreré Lagoon', icon: <Sun size={16} className="text-yellow-400"/>, desc: 'Reflexos de luz no fundo do mar.' },
    { id: 'coralReef', label: 'Coral Reef & Beach', icon: <Anchor size={16} className="text-red-400"/>, desc: 'Areia, corais e rochas.' },
    { id: 'storm', label: 'Tempestade Forte', icon: <Zap size={16} className="text-slate-400"/>, desc: 'Turbulência, raios e mar agitado.' }, 
    { id: 'aurora', label: 'Ambiente Aurora', icon: <Wind size={16} className="text-green-400"/>, desc: 'Ondas suaves estilo Boreal.' },
    { id: 'deepSea', label: 'Profundezas', icon: <Moon size={16} className="text-indigo-400"/>, desc: 'Partículas flutuantes.' },
    { id: 'neon', label: 'Neon Moreré', icon: <Activity size={16} className="text-purple-400"/>, desc: 'Ciclo de cores Cyberpunk.' },
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

    return (
        <div className="space-y-6 animate-in fade-in">
             {/* LAYOUT SECTION */}
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
            </div>

            {/* COLOR PALETTE */}
            <div className="pt-4 border-t border-slate-700">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><Palette size={14}/> Paleta Mestre</h3>
                <div className="space-y-2">
                    {(firmwareConfig.customColors || ['#000000','#ffffff']).map((c, i) => (
                        <div key={i} className="flex gap-2 items-center">
                            <input type="color" value={c} onChange={e=>handleColorChange(i, e.target.value)} className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"/>
                            <input type="text" value={c} onChange={e=>handleColorChange(i, e.target.value)} className="flex-1 bg-slate-900 border border-slate-600 rounded p-1.5 text-xs text-white font-mono uppercase"/>
                        </div>
                    ))}
                </div>
            </div>

            {/* PRESETS */}
             <div className="pt-4 border-t border-slate-700">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Preset de Animação</h4>
                <div className="grid grid-cols-1 gap-2">
                    {PRESETS.map(p => (
                        <button key={p.id} onClick={()=>updateFirmwareConfig({ animationMode: p.id })} className={`flex items-center gap-3 p-2 rounded border text-left transition ${firmwareConfig.animationMode===p.id ? 'bg-cyan-900/30 border-cyan-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                            {p.icon}
                            <div><div className="text-xs font-bold">{p.label}</div><div className="text-[9px] opacity-60">{p.desc}</div></div>
                        </button>
                    ))}
                </div>
            </div>

             {/* SIMULATOR CONTROLS */}
             <div className="pt-4 border-t border-slate-700">
                <div className="flex justify-between items-center mb-3">
                     <h4 className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Cpu size={12}/> Ambiente (Simulação)</h4>
                     <button onClick={()=>setSimMode(!simMode)} className={`text-[9px] px-2 py-0.5 rounded border ${simMode?'bg-green-900 text-green-400 border-green-700':'bg-slate-800 text-slate-500 border-slate-600'}`}>
                         {simMode ? 'ATIVO' : 'AUTO'}
                     </button>
                </div>
                {simMode && (
                    <div className="space-y-4 bg-slate-900/50 p-3 rounded">
                        <div><div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>Maré</span><span className="text-white">{simParams.tide}%</span></div><input type="range" value={simParams.tide} onChange={e=>setSimParams({...simParams, tide: parseInt(e.target.value)})} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"/></div>
                        <div><div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>Vento</span><span className="text-white">{simParams.wind}km/h</span></div><input type="range" value={simParams.wind} onChange={e=>setSimParams({...simParams, wind: parseInt(e.target.value)})} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-400"/></div>
                    </div>
                )}
            </div>
        </div>
    );
};
