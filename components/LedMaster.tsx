import React, { useState } from 'react';
import { BrainCircuit, Grid, Play, Pause } from 'lucide-react';
import { LedConfigPanel } from './led/LedConfigPanel';
import { LedVisualizer } from './led/LedVisualizer';
import { PixelArtStudio } from './led/PixelArtStudio';

type TabMode = 'CONTROLLER' | 'PIXEL_ART';

export const LedMaster: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabMode>('CONTROLLER');
    
    // Lifted state for simulation controls
    const [simMode, setSimMode] = useState(false);
    const [simParams, setSimParams] = useState({ 
        wind: 20, 
        humidity: 60, 
        tide: 50, 
        isNight: false,
        tideDirection: 'RISING',
        dayMax: 100,
        dayMin: 0,
        allowNegative: false
    });

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] min-h-[600px] w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
            {/* LEFT SIDEBAR: CONFIGURATION */}
            <div className="w-full lg:w-[360px] shrink-0 border-r border-slate-800 bg-slate-900 flex flex-col z-10">
                
                {/* Header / Tab Switcher */}
                <div className="p-4 border-b border-slate-800 bg-slate-900 shrink-0">
                    <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                        <button 
                            onClick={()=>setActiveTab('CONTROLLER')} 
                            className={`flex-1 py-2 px-3 rounded text-xs font-bold flex items-center justify-center gap-2 transition-all ${activeTab==='CONTROLLER'?'bg-cyan-600 text-white shadow':'text-slate-400 hover:text-white'}`}
                        >
                            <BrainCircuit size={14}/> Controlador
                        </button>
                        <button 
                            onClick={()=>setActiveTab('PIXEL_ART')} 
                            className={`flex-1 py-2 px-3 rounded text-xs font-bold flex items-center justify-center gap-2 transition-all ${activeTab==='PIXEL_ART'?'bg-pink-600 text-white shadow':'text-slate-400 hover:text-white'}`}
                        >
                            <Grid size={14}/> Pixel Art
                        </button>
                    </div>
                </div>

                {/* Scrollable Config Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-slate-900/50">
                   {activeTab === 'CONTROLLER' ? (
                       <LedConfigPanel 
                           simMode={simMode} 
                           setSimMode={setSimMode} 
                           simParams={simParams} 
                           setSimParams={setSimParams} 
                       />
                   ) : (
                       <PixelArtStudio />
                   )}
                </div>
            </div>

            {/* CENTER: CANVAS VISUALIZER */}
            <div className="flex-1 flex flex-col bg-black relative overflow-hidden group">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900/50 via-black to-black pointer-events-none"></div>
                
                {/* Toolbar Overlay */}
                <div className="absolute top-4 left-4 z-10 flex gap-4 pointer-events-none">
                     <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-full px-4 py-1.5 text-xs text-slate-300 font-mono shadow-xl flex items-center gap-2">
                         <div className={`w-2 h-2 rounded-full ${simMode ? 'bg-green-500 animate-pulse' : 'bg-cyan-500'}`}></div>
                         {simMode ? 'Simulação Manual' : 'Sincronizado com Maré'}
                     </div>
                </div>

                {/* Controls Overlay */}
                <div className="absolute bottom-4 right-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={() => setSimMode(!simMode)} 
                        className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-lg border border-slate-600 transition"
                        title={simMode ? "Voltar ao Automático" : "Controle Manual"}
                    >
                        {simMode ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                </div>

                {/* The Canvas */}
                <div className="flex-1 w-full h-full relative">
                    <LedVisualizer 
                        simMode={simMode} 
                        simParams={simParams} 
                    />
                </div>
            </div>
        </div>
    );
};