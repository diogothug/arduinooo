import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { DisplayTheme, WidgetType, ViewState } from '../../types';
import { Zap, Palette, CloudSun, Sparkles, Image as ImageIcon, CheckCircle, Moon, Sun, Thermometer, Wind, Droplets, Gauge, Wifi, Bluetooth, ExternalLink, Settings } from 'lucide-react';
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
          alert("Erro Nano Banana: " + e.message);
      } finally {
          setAiGenerating(false);
      }
  };

  const addImageWidget = () => {
      if(lastGeneratedImage) {
          addDisplayWidget({
              id: Math.random().toString(),
              type: WidgetType.AI_IMAGE,
              x: 120, y: 120, scale: 2.4, // fill screen roughly
              color: '#fff',
              visible: true,
              zIndex: 0,
              imageUrl: lastGeneratedImage
          });
      }
  };

  const applyPreset = (name: string) => {
    const baseConfig = { theme: DisplayTheme.DEFAULT, simulateSunlight: false };

    switch (name) {
      case 'Maré Circular Real':
        setDisplayWidgets([
          { id: 'p1_1', type: WidgetType.TIDE_GAUGE, x: 120, y: 120, scale: 1, color: '#0ea5e9', visible: true, zIndex: 0 },
          { id: 'p1_2', type: WidgetType.TEXT_LABEL, x: 120, y: 160, scale: 1.2, color: '#ffffff', label: 'MARÉ', visible: true, zIndex: 1 },
          { id: 'p1_3', type: WidgetType.ICON_WEATHER, x: 120, y: 80, scale: 1, color: '#fbbf24', visible: true, zIndex: 2 },
        ]);
        setDisplayConfig({ ...baseConfig, theme: DisplayTheme.AZUL_OCEANO });
        break;
      case 'Relógio Mareal V2':
        setDisplayWidgets([
          { id: 'p2_1', type: WidgetType.CLOCK_ANALOG, x: 120, y: 120, scale: 0.95, color: '#f8fafc', visible: true, zIndex: 0 },
          { id: 'p2_2', type: WidgetType.TIDE_RADAR, x: 120, y: 180, scale: 1, color: '#38bdf8', visible: true, zIndex: 1 },
          { id: 'p2_3', type: WidgetType.MOON_PHASE, x: 120, y: 60, scale: 0.8, color: '#e2e8f0', visible: true, zIndex: 1 },
        ]);
        setDisplayConfig({ ...baseConfig, theme: DisplayTheme.NOITE_TROPICAL });
        break;
      case 'Sol de Moreré':
         setDisplayWidgets([
           { id: 'p3_1', type: WidgetType.CLOCK_DIGITAL, x: 120, y: 120, scale: 1, color: '#fff7ed', visible: true, zIndex: 2},
           { id: 'p3_2', type: WidgetType.TIDE_FILL, x: 120, y: 120, scale: 1, color: '#f59e0b', visible: true, zIndex: 0, opacity: 0.8},
         ]);
         setDisplayConfig({ ...baseConfig, theme: DisplayTheme.SOL_MORERE, simulateSunlight: true });
         break;
      case 'Painel Técnico WiFi':
        setDisplayWidgets([
            { id: 'p6_1', type: WidgetType.STATUS_WIFI_ICON, x: 120, y: 80, scale: 1.5, color: '#22d3ee', visible: true, zIndex: 1 },
            { id: 'p6_2', type: WidgetType.STATUS_WIFI_TEXT, x: 120, y: 140, scale: 1.2, color: '#fff', visible: true, zIndex: 1 },
            { id: 'p6_3', type: WidgetType.STATUS_BLE_ICON, x: 200, y: 40, scale: 1, color: '#60a5fa', visible: true, zIndex: 1 },
        ]);
        setDisplayConfig({ ...baseConfig, theme: DisplayTheme.DEFAULT });
        break;
      case 'Futuro Cyberpunk (AI)':
          setDisplayWidgets([
              { id: 'p7_1', type: WidgetType.CLOCK_DIGITAL, x: 120, y: 120, scale: 1.2, color: '#00ffcc', visible: true, zIndex: 10 },
              { id: 'p7_2', type: WidgetType.TEXT_LABEL, x: 120, y: 160, scale: 0.8, color: '#ff00ff', label: 'NEURAL SYNC', visible: true, zIndex: 10 },
          ]);
          setDisplayConfig({ ...baseConfig, theme: DisplayTheme.STARRY_NIGHT });
          break;
    }
  };

  return (
    <div className="flex flex-col gap-6 max-h-full overflow-y-auto pr-2 pb-20 custom-scrollbar">
        
        {/* Data Monitor Card (Read Only) */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <CloudSun size={14} className="text-cyan-400" /> Monitor de Dados
                </h3>
                <button 
                    onClick={() => setView(ViewState.EDITOR)}
                    className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition"
                    title="Configurar Fontes de Dados"
                >
                    <Settings size={14} />
                </button>
            </div>
            
            <div className="text-[10px] text-slate-500 mb-3 bg-slate-900/50 p-2 rounded">
                <div className="flex justify-between">
                    <span>Fonte Ativa:</span>
                    <span className="text-slate-300 font-bold">{dataSourceConfig.activeSource}</span>
                </div>
                {dataSourceConfig.activeSource === 'API' && (
                    <div className="flex justify-between mt-1">
                         <span>Loc:</span> <span className="text-slate-300 truncate max-w-[100px]">{dataSourceConfig.api.locationId}</span>
                    </div>
                )}
            </div>

            {weatherData ? (
                <div className="mt-2 flex flex-col gap-4 animate-in fade-in">
                    {/* Basic Status */}
                    <div className="text-[10px] text-green-400 flex flex-col gap-1 p-2 bg-green-900/10 rounded border border-green-900/30">
                        <div className="flex items-center gap-1 font-bold">
                            <CheckCircle size={12} /> Estado do Sistema
                        </div>
                        {weatherData.conditionText && (
                            <div className="flex items-center gap-1 text-slate-300">
                                 {weatherData.isDay ? <Sun size={10} className="text-amber-400"/> : <Moon size={10} className="text-indigo-400"/>}
                                 {weatherData.conditionText} ({Math.round(weatherData.temp)}°C)
                            </div>
                        )}
                    </div>

                    {/* Environmental Grid */}
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Gauge size={12}/> Métricas Atuais</h4>
                        <div className="grid grid-cols-2 gap-2">
                             <div className="bg-slate-900 p-2 rounded flex flex-col items-center justify-center border border-slate-700">
                                 <span className="text-[9px] text-slate-500 uppercase">Sensação</span>
                                 <span className="text-sm font-bold text-orange-400">{weatherData.feelsLike}°C</span>
                             </div>
                             <div className="bg-slate-900 p-2 rounded flex flex-col items-center justify-center border border-slate-700">
                                 <span className="text-[9px] text-slate-500 uppercase flex items-center gap-1"><Sun size={8}/> UV Index</span>
                                 <span className={`text-sm font-bold ${weatherData.uv > 5 ? 'text-purple-400' : 'text-green-400'}`}>{weatherData.uv}</span>
                             </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-xs text-slate-500 text-center py-4 italic">
                    Nenhum dado carregado.
                </div>
            )}
            
            <button 
                onClick={() => setView(ViewState.EDITOR)}
                className="w-full mt-4 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white transition border border-slate-600"
            >
                <ExternalLink size={12} /> Gerenciar Fontes de Dados
            </button>
        </div>

        {/* AI Image Generator */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <Sparkles size={14} className="text-pink-400" /> Gerador AI (Nano Banana)
            </h3>
            <p className="text-[10px] text-slate-400 mb-2">Crie fundos ou ícones exclusivos para o display circular.</p>
            
            <textarea 
                value={aiPrompt} 
                onChange={e => setAiPrompt(e.target.value)} 
                placeholder="Ex: Cyberpunk ocean waves, neon colors, pixel art style..." 
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
                        Usar no Display
                    </button>
                </div>
            )}
        </div>

        {/* Status Widgets Adder */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Wifi size={14} className="text-green-400" /> Widgets de Status
            </h3>
            <div className="grid grid-cols-2 gap-2">
                <button onClick={() => addDisplayWidget({id: Math.random().toString(), type: WidgetType.STATUS_WIFI_ICON, x:120, y:120, scale:1, color:'#fff', visible:true, zIndex:5})} className="p-2 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-white flex flex-col items-center gap-1">
                    <Wifi size={16} /> WiFi Ícone
                </button>
                <button onClick={() => addDisplayWidget({id: Math.random().toString(), type: WidgetType.STATUS_WIFI_TEXT, x:120, y:140, scale:1, color:'#fff', visible:true, zIndex:5})} className="p-2 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-white flex flex-col items-center gap-1">
                    <span className="font-mono">TXT</span> WiFi Info
                </button>
                <button onClick={() => addDisplayWidget({id: Math.random().toString(), type: WidgetType.STATUS_BLE_ICON, x:120, y:120, scale:1, color:'#60a5fa', visible:true, zIndex:5})} className="p-2 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-white flex flex-col items-center gap-1">
                    <Bluetooth size={16} /> BLE Ícone
                </button>
                <button onClick={() => addDisplayWidget({id: Math.random().toString(), type: WidgetType.STATUS_BLE_TEXT, x:120, y:140, scale:1, color:'#60a5fa', visible:true, zIndex:5})} className="p-2 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-white flex flex-col items-center gap-1">
                     <span className="font-mono">TXT</span> BLE Info
                </button>
            </div>
        </div>

        {/* Simulators & Weather Widgets */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Zap size={14} className="text-yellow-400" /> Widgets de Clima
            </h3>

            {/* Weather Widget Buttons */}
            <div className="grid grid-cols-2 gap-2 mb-4">
                <button onClick={() => addDisplayWidget({id: Math.random().toString(), type: WidgetType.WEATHER_TEMP_TEXT, x:120, y:120, scale:1, color:'#fff', visible:true, zIndex:5})} className="p-2 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-white flex flex-col items-center gap-1">
                    <Thermometer size={16} className="text-orange-400" /> Temp ({weatherData.temp}°C)
                </button>
                <button onClick={() => addDisplayWidget({id: Math.random().toString(), type: WidgetType.WEATHER_HUMIDITY_TEXT, x:120, y:140, scale:1, color:'#60a5fa', visible:true, zIndex:5})} className="p-2 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-white flex flex-col items-center gap-1">
                    <Droplets size={16} className="text-blue-400" /> Umidade ({weatherData.humidity}%)
                </button>
                <button onClick={() => addDisplayWidget({id: Math.random().toString(), type: WidgetType.WEATHER_WIND_TEXT, x:120, y:160, scale:1, color:'#fff', visible:true, zIndex:5})} className="p-2 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-white flex flex-col items-center gap-1">
                    <Wind size={16} className="text-slate-300" /> Vento ({weatherData.windSpeed} km/h)
                </button>
                <button onClick={() => addDisplayWidget({id: Math.random().toString(), type: WidgetType.WEATHER_CONDITION_TEXT, x:120, y:180, scale:0.8, color:'#fbbf24', visible:true, zIndex:5})} className="p-2 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-white flex flex-col items-center gap-1">
                    <CloudSun size={16} className="text-yellow-400" /> Condição (Txt)
                </button>
            </div>
            {/* Note: Manual sliders removed. Use Tide Editor > Source to simulate weather. */}
        </div>

        {/* Themes */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Palette size={16} className="text-purple-400" /> Temas & Presets
            </h3>
            <div className="grid grid-cols-1 gap-2">
                    <select 
                    value={displayConfig.theme}
                    onChange={(e) => setDisplayConfig({ theme: e.target.value as DisplayTheme })}
                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white text-sm mb-2"
                >
                    <option value={DisplayTheme.DEFAULT}>Padrão (Preto)</option>
                    <option value={DisplayTheme.AZUL_OCEANO}>Azul Oceano</option>
                    <option value={DisplayTheme.SOL_MORERE}>Sol de Moreré</option>
                    <option value={DisplayTheme.NOITE_TROPICAL}>Noite Tropical</option>
                    <option value={DisplayTheme.OCEAN_TURQUOISE}>Oceano Turquesa (V2)</option>
                    <option value={DisplayTheme.SUNSET_BAHIA}>Pôr do Sol da Bahia (V2)</option>
                    <option value={DisplayTheme.STARRY_NIGHT}>Noite Estrelada (Animado)</option>
                    <option value={DisplayTheme.TROPICAL_STORM}>Tempestade Tropical</option>
                </select>

                <p className="text-[10px] text-slate-500 uppercase font-bold mt-2">Presets Rápidos</p>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => applyPreset('Maré Circular Real')} className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-[10px] text-white transition">Maré Circular</button>
                    <button onClick={() => applyPreset('Relógio Mareal V2')} className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-[10px] text-white transition">Relógio V2</button>
                    <button onClick={() => applyPreset('Sol de Moreré')} className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-[10px] text-white transition">Sol de Moreré</button>
                    <button onClick={() => applyPreset('Radar de Vento')} className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-[10px] text-white transition">Radar Vento</button>
                    <button onClick={() => applyPreset('Oceano Turquesa (V2.1)')} className="p-2 bg-teal-900/50 hover:bg-teal-900/70 border border-teal-700 text-teal-200 rounded text-[10px] transition col-span-2">🌊 Oceano Turquesa</button>
                    <button onClick={() => applyPreset('Painel Técnico WiFi')} className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-400 rounded text-[10px] transition">📡 WiFi / BLE</button>
                    <button onClick={() => applyPreset('Futuro Cyberpunk (AI)')} className="p-2 bg-purple-900/40 hover:bg-purple-900/60 border border-purple-700 text-purple-300 rounded text-[10px] transition">🤖 Cyberpunk AI</button>
                </div>
            </div>
        </div>
    </div>
  );
};