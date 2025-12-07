
import React, { useState } from 'react';
import { BrainCircuit, LayoutTemplate, Grid } from 'lucide-react';
import { LedConfigPanel } from './led/LedConfigPanel';
import { LedVisualizer } from './led/LedVisualizer';
import { PixelArtStudio } from './led/PixelArtStudio';

type TabMode = 'DESIGN' | 'AUTONOMOUS' | 'PIXEL_ART';

export const LedMaster: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabMode>('AUTONOMOUS');
    
    // Lifted state for simulation to ensure synchronization between panel and visualizer
    const [simMode, setSimMode] = useState(false);
    const [simParams, setSimParams] = useState({ 
        wind: 15, 
        humidity: 60, 
        tide: 50, 
        isNight: false,
        // New Parameters
        tideDirection: 'RISING', // RISING or FALLING
        dayMax: 100,
        dayMin: 0,
        allowNegative: false
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-y-auto lg:overflow-hidden pr-2 custom-scrollbar">
            {/* LEFT SIDEBAR: CONFIG */}
            <div className="lg:col-span-3 flex flex-col gap-4 h-auto lg:h-full lg:overflow-y-auto lg:pr-2 custom-scrollbar">
                 <div className="bg-slate-800 rounded-lg border border-slate-700 p-2 grid grid-cols-3 gap-2 shrink-0">
                     <button onClick={()=>setActiveTab('AUTONOMOUS')} className={`p-2 rounded text-xs font-bold flex flex-col items-center gap-1 transition-all ${activeTab==='AUTONOMOUS'?'bg-cyan-600 text-white shadow-lg shadow-cyan-900/50':'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
                         <BrainCircuit size={16}/> Lógica
                     </button>
                     <button onClick={()=>setActiveTab('DESIGN')} className={`p-2 rounded text-xs font-bold flex flex-col items-center gap-1 transition-all ${activeTab==='DESIGN'?'bg-purple-600 text-white shadow-lg shadow-purple-900/50':'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
                         <LayoutTemplate size={16}/> Design
                     </button>
                     <button onClick={()=>setActiveTab('PIXEL_ART')} className={`p-2 rounded text-xs font-bold flex flex-col items-center gap-1 transition-all ${activeTab==='PIXEL_ART'?'bg-pink-600 text-white shadow-lg shadow-pink-900/50':'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
                         <Grid size={16}/> Pixel
                     </button>
                 </div>

                 <div className="bg-slate-800 rounded-lg border border-slate-700 p-5 flex-1 lg:overflow-y-auto custom-scrollbar">
                    {(activeTab === 'DESIGN' || activeTab === 'AUTONOMOUS') && (
                        <LedConfigPanel simMode={simMode} setSimMode={setSimMode} simParams={simParams} setSimParams={setSimParams} />
                    )}
                    {activeTab === 'PIXEL_ART' && <PixelArtStudio />}
                 </div>
            </div>

            {/* CENTER: CANVAS VISUALIZER */}
            <div className="lg:col-span-9 h-[500px] lg:h-full">
                <LedVisualizer simMode={simMode} simParams={simParams} stripDirection='HORIZONTAL' />
            </div>
        </div>
    );
};
