
import React, { useState } from 'react';
import { BrainCircuit, LayoutTemplate, Grid, ChevronLeft } from 'lucide-react';
import { LedConfigPanel } from './led/LedConfigPanel';
import { LedVisualizer } from './led/LedVisualizer';
import { PixelArtStudio } from './led/PixelArtStudio';

type TabMode = 'CONTROLLER' | 'PIXEL_ART';

export const LedMaster: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabMode>('CONTROLLER');
    
    // Lifted state for simulation to ensure synchronization
    const [simMode, setSimMode] = useState(false);
    const [simParams, setSimParams] = useState({ 
        wind: 15, 
        humidity: 60, 
        tide: 50, 
        isNight: false,
        tideDirection: 'RISING',
        dayMax: 100,
        dayMin: 0,
        allowNegative: false
    });

    return (
        <div className="flex h-full w-full gap-0 overflow-hidden bg-slate-950">
            {/* LEFT SIDEBAR: CONFIGURATION */}
            <div className="w-[380px] shrink-0 border-r border-slate-800 bg-slate-900 flex flex-col h-full z-10 shadow-xl">
                
                {/* Header / Tab Switcher */}
                <div className="p-4 border-b border-slate-800 bg-slate-900">
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

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
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
            <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black pointer-events-none"></div>
                
                {/* Toolbar Overlay */}
                <div className="absolute top-4 left-6 z-10 flex gap-4">
                     <div className="bg-slate-900/80 backdrop-blur border border-slate-700 rounded-full px-4 py-1.5 text-xs text-slate-300 font-mono">
                         Visualização em Tempo Real
                     </div>
                </div>

                <div className="flex-1 p-6 flex items-center justify-center">
                    <LedVisualizer 
                        simMode={simMode} 
                        simParams={simParams} 
                        stripDirection='HORIZONTAL' 
                    />
                </div>
            </div>
        </div>
    );
};
