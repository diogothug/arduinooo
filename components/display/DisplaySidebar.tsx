
import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { DisplayTheme, WidgetType, ViewState } from '../../types';
import { Zap, Palette, CloudSun, Sparkles, Image as ImageIcon, Wifi, Bluetooth, Settings, Sun, Moon, Droplets, Thermometer, Wind, Waves, Gauge, Clock, Layout } from 'lucide-react';
import { generateDisplayImage } from '../../services/geminiService';

export const DisplaySidebar: React.FC = () => {
  const { 
      weatherData, displayConfig, setDisplayConfig, setDisplayWidgets, addDisplayWidget,
      dataSourceConfig, setView
  } = useAppStore();

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [lastGeneratedImage, setLastGeneratedImage] = useState<string | null>(null);

  const handleGenerateImage = async () => {
      if(!aiPrompt) return;
      setAiGenerating(true);
      try {
          const base64 = await generateDisplayImage(aiPrompt);
          setLastGeneratedImage(base64);
      } catch(e: any) {
          alert("Erro Gemini: " + e.message);
      } finally {
          setAiGenerating(false);
      }
  };

  const addImageWidget = () => {
      if(lastGeneratedImage) {
          addDisplayWidget({
              id: Math.random().toString(),
              type: WidgetType.AI_IMAGE,
              x: 120, y: 120, scale: 2.4,
              color: '#fff',
              visible: true,
              zIndex: 0,
              imageUrl: lastGeneratedImage
          });
      }
  };

  const applyPreset = (name: string) => {
    switch (name) {
      case 'Mariner':
        setDisplayConfig({ ...displayConfig, theme: DisplayTheme.MARINE });
        setDisplayWidgets([
          { id: '1', type: WidgetType.RING_OUTER, x: 120, y: 120, scale: 1, color: '#1e293b', visible: true, zIndex: 0, thickness: 10 },
          { id: '2', type: WidgetType.ARC_GAUGE, x: 120, y: 120, scale: 1, color: '#f97316', visible: true, zIndex: 1, valueSource: 'TIDE', label: 'TIDE' },
          { id: '3', type: WidgetType.RADIAL_COMPASS, x: 120, y: 120, scale: 1, color: '#e2e8f0', visible: true, zIndex: 2, valueSource: 'WIND' },
          { id: '4', type: WidgetType.TEXT_VALUE, x: 120, y: 180, scale: 0.8, color: '#fff', visible: true, zIndex: 3, valueSource: 'TIME' },
        ]);
        break;
        
      case 'Chrono Sport':
        setDisplayConfig({ ...displayConfig, theme: DisplayTheme.CHRONO });
        setDisplayWidgets([
          { id: 'c1', type: WidgetType.ANALOG_CLOCK, x: 120, y: 120, scale: 1, color: '#fff', visible: true, zIndex: 5, color2: '#ef4444' },
          { id: 'c2', type: WidgetType.ARC_GAUGE, x: 60, y: 120, scale: 0.6, color: '#3b82f6', visible: true, zIndex: 2, valueSource: 'TIDE', thickness: 6 },
          { id: 'c3', type: WidgetType.ARC_GAUGE, x: 180, y: 120, scale: 0.6, color: '#ef4444', visible: true, zIndex: 2, valueSource: 'TEMP', thickness: 6 },
        ]);
        break;

      case 'Digital Terminal':
        setDisplayConfig({ ...displayConfig, theme: DisplayTheme.TERMINAL });
        setDisplayWidgets([
          { id: 'd1', type: WidgetType.GRID_BACKGROUND, x: 0, y: 0, scale: 1, color: '#00ff00', visible: true, zIndex: 0 },
          { id: 'd2', type: WidgetType.DIGITAL_CLOCK, x: 120, y: 100, scale: 1, color: '#00ff00', visible: true, zIndex: 5, fontFamily: 'monospace' },
          { id: 'd3', type: WidgetType.GRAPH_LINE, x: 120, y: 160, scale: 1, color: '#00ff00', visible: true, zIndex: 2, w: 100, h: 40 },
          { id: 'd4', type: WidgetType.TEXT_SIMPLE, x: 120, y: 200, scale: 1, color: '#008800', visible: true, zIndex: 2, label: 'SYSTEM READY' },
        ]);
        break;

      case 'Minimalist':
         setDisplayConfig({ ...displayConfig, theme: DisplayTheme.PAPER });
         setDisplayWidgets([
             { id: 'm1', type: WidgetType.TEXT_VALUE, x: 120, y: 100, scale: 1.5, color: '#000', visible: true, zIndex: 1, valueSource: 'TIDE', label: 'HEIGHT' },
             { id: 'm2', type: WidgetType.ICON_WEATHER, x: 120, y: 170, scale: 1.2, color: '#000', visible: true, zIndex: 1 },
         ]);
         break;
    }
  };

  return (
    <div className="flex flex-col gap-6 max-h-full overflow-y-auto pr-2 pb-20 custom-scrollbar">
        
        {/* Compact Status Bar */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs">
                <div className="flex flex-col items-center">
                    <Waves size={16} className="text-cyan-400 mb-0.5" />
                    <span className="text-slate-300 font-mono">DATA</span>
                </div>
                <div className="w-px h-8 bg-slate-700"></div>
                <div className="flex flex-col items-center">
                     <span className="text-slate-300 font-mono">{Math.round(weatherData.temp)}°C</span>
                </div>
            </div>
            
            <button 
                onClick={() => setView(ViewState.EDITOR)}
                className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition"
                title="Configurar Fontes"
            >
                <Settings size={18} />
            </button>
        </div>

        {/* Quick Presets */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <Layout size={14} className="text-cyan-400" /> Presets Inteligentes
            </h3>
            <div className="grid grid-cols-2 gap-2">
                <button onClick={() => applyPreset('Mariner')} className="p-3 bg-slate-700 hover:bg-slate-600 rounded flex flex-col items-center gap-2 transition group">
                    <div className="w-8 h-8 rounded-full border-2 border-orange-500 group-hover:bg-orange-500/20"></div>
                    <span className="text-[10px] text-white font-bold">Mariner</span>
                </button>
                <button onClick={() => applyPreset('Chrono Sport')} className="p-3 bg-slate-700 hover:bg-slate-600 rounded flex flex-col items-center gap-2 transition group">
                    <Clock size={20} className="text-red-500" />
                    <span className="text-[10px] text-white font-bold">Chrono</span>
                </button>
                <button onClick={() => applyPreset('Digital Terminal')} className="p-3 bg-slate-700 hover:bg-slate-600 rounded flex flex-col items-center gap-2 transition group">
                     <div className="font-mono text-green-500 text-xs">_CMD</div>
                    <span className="text-[10px] text-white font-bold">Terminal</span>
                </button>
                <button onClick={() => applyPreset('Minimalist')} className="p-3 bg-slate-100 hover:bg-white rounded flex flex-col items-center gap-2 transition group">
                    <div className="text-black font-serif text-lg">Aa</div>
                    <span className="text-[10px] text-black font-bold">Paper</span>
                </button>
            </div>
        </div>

        {/* Widgets Adder */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Gauge size={14} className="text-green-400" /> Adicionar Widgets
            </h3>
            <div className="grid grid-cols-2 gap-2">
                {[
                    { type: WidgetType.ARC_GAUGE, label: 'Medidor Arco', icon: <Gauge size={16}/> },
                    { type: WidgetType.RADIAL_COMPASS, label: 'Bússola/Vento', icon: <Wind size={16}/> },
                    { type: WidgetType.DIGITAL_CLOCK, label: 'Relógio Digital', icon: <Clock size={16}/> },
                    { type: WidgetType.ANALOG_CLOCK, label: 'Relógio Analógico', icon: <Clock size={16}/> },
                    { type: WidgetType.GRAPH_LINE, label: 'Mini Gráfico', icon: <Waves size={16}/> },
                    { type: WidgetType.TEXT_VALUE, label: 'Valor + Label', icon: <Layout size={16}/> },
                ].map(w => (
                    <button 
                        key={w.type}
                        onClick={() => addDisplayWidget({
                            id: Math.random().toString(), 
                            type: w.type, 
                            x:120, y:120, scale:1, color:'#fff', visible:true, zIndex:5,
                            valueSource: 'TIDE' // Default
                        })} 
                        className="p-2 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-white flex flex-col items-center gap-1 transition"
                    >
                        {w.icon}
                        {w.label}
                    </button>
                ))}
            </div>
        </div>

        {/* AI Image Generator */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <Sparkles size={14} className="text-pink-400" /> AI Backgrounds
            </h3>
            
            <textarea 
                value={aiPrompt} 
                onChange={e => setAiPrompt(e.target.value)} 
                placeholder="Ex: Radar sonar screen, green glowing grid..." 
                className="w-full h-16 bg-slate-900 border border-slate-600 rounded p-2 text-xs text-white mb-2"
            />
            
            <button 
                onClick={handleGenerateImage}
                disabled={aiGenerating || !aiPrompt}
                className={`w-full py-2 rounded text-xs font-bold flex items-center justify-center gap-2 mb-3 transition ${aiGenerating ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}
            >
                {aiGenerating ? <ImageIcon className="animate-spin" size={14}/> : <ImageIcon size={14}/>}
                {aiGenerating ? 'Gerando...' : 'Gerar Imagem'}
            </button>

            {lastGeneratedImage && (
                <div className="bg-slate-900 p-2 rounded border border-slate-700 flex gap-2 items-center">
                    <img src={lastGeneratedImage} className="w-10 h-10 rounded-full object-cover border border-slate-600" alt="Generated" />
                    <button onClick={addImageWidget} className="flex-1 bg-slate-800 hover:bg-slate-700 text-xs py-1.5 rounded text-white border border-slate-600">
                        Usar
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};
