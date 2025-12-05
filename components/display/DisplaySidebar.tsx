
import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { DisplayTheme, WidgetType } from '../../types';
import { Zap, Palette, CloudSun, AlertCircle, Loader2, Wifi, Bluetooth, Sparkles, Image as ImageIcon, Clipboard, Terminal, CheckCircle, Moon, Sun, CloudRain, Thermometer, Wind, Droplets, Umbrella, Gauge, Eye, Sunrise, Sunset, CalendarDays } from 'lucide-react';
import { tideSourceService } from '../../services/tideSourceService';
import { generateDisplayImage } from '../../services/geminiService';

export const DisplaySidebar: React.FC = () => {
  const { 
      weatherData, setWeatherData, displayConfig, setDisplayConfig, setDisplayWidgets, addDisplayWidget,
      dataSourceConfig, setKeyframes, setApiStatus, apiLoading, apiError, apiDebugLog
  } = useAppStore();

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [lastGeneratedImage, setLastGeneratedImage] = useState<string | null>(null);

  const handleFetchLiveData = async () => {
      setApiStatus(true, null);
      try {
          const { weather, frames, warning } = await tideSourceService.fetchLiveWeather(dataSourceConfig);
          
          setWeatherData(weather);
          
          if (frames.length > 0) {
              setKeyframes(frames);
              setApiStatus(false, warning || null); // Pass warning if it exists (e.g. no tides)
          } else {
              if (warning) {
                  // Valid weather but no tides is a "partial error" state for us
                  setApiStatus(false, "Atenção: " + warning);
              } else {
                   setApiStatus(false, null);
              }
          }
      } catch (error: any) {
          setApiStatus(false, error.message);
      }
  };

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

  const copyLogToClipboard = () => {
      if (apiDebugLog) {
          navigator.clipboard.writeText(apiDebugLog);
          alert("Log JSON copiado para a área de transferência!");
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
        
        {/* API Real Time Control */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <CloudSun size={14} className="text-cyan-400" /> Dados Reais (WeatherAPI)
            </h3>
            
            <div className="text-[10px] text-slate-500 mb-3 bg-slate-900/50 p-2 rounded">
                API Key: <span className="text-slate-300 font-mono">...{dataSourceConfig.api.token.slice(-6)}</span><br/>
                Local: <span className="text-slate-300">{dataSourceConfig.api.locationId}</span>
            </div>

            <button 
                onClick={handleFetchLiveData}
                disabled={apiLoading}
                className={`w-full py-2 rounded text-xs font-bold flex items-center justify-center gap-2 transition ${apiLoading ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-700 text-white'}`}
            >
                {apiLoading ? <Loader2 className="animate-spin" size={14} /> : <CloudSun size={14} />}
                {apiLoading ? 'Buscando Dados Completos...' : 'Atualizar Dados (Free Tier)'}
            </button>

            {apiError && (
                <div className={`mt-3 p-3 rounded flex items-start gap-2 ${apiError.includes("Atenção") ? 'bg-amber-900/20 border border-amber-800 text-amber-300' : 'bg-red-900/20 border border-red-800 text-red-300'}`}>
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <div className="text-[10px] leading-relaxed">
                        <strong className="block mb-1">{apiError.includes("Atenção") ? "Aviso:" : "Falha na API:"}</strong>
                        {apiError}
                    </div>
                </div>
            )}
            
            {!apiLoading && !apiError && weatherData && (
                <div className="mt-4 flex flex-col gap-4 animate-in fade-in">
                    
                    {/* Basic Status */}
                    <div className="text-[10px] text-green-400 flex flex-col gap-1 p-2 bg-green-900/10 rounded border border-green-900/30">
                        <div className="flex items-center gap-1 font-bold">
                            <CheckCircle size={12} /> Dados Atualizados
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
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Gauge size={12}/> Detalhes Ambientais</h4>
                        <div className="grid grid-cols-2 gap-2">
                             <div className="bg-slate-900 p-2 rounded flex flex-col items-center justify-center border border-slate-700">
                                 <span className="text-[9px] text-slate-500 uppercase">Sensação</span>
                                 <span className="text-sm font-bold text-orange-400">{weatherData.feelsLike}°C</span>
                             </div>
                             <div className="bg-slate-900 p-2 rounded flex flex-col items-center justify-center border border-slate-700">
                                 <span className="text-[9px] text-slate-500 uppercase flex items-center gap-1"><Sun size={8}/> UV Index</span>
                                 <span className={`text-sm font-bold ${weatherData.uv > 5 ? 'text-purple-400' : 'text-green-400'}`}>{weatherData.uv}</span>
                             </div>
                             <div className="bg-slate-900 p-2 rounded flex flex-col items-center justify-center border border-slate-700">
                                 <span className="text-[9px] text-slate-500 uppercase flex items-center gap-1"><Umbrella size={8}/> Precip</span>
                                 <span className="text-sm font-bold text-blue-400">{weatherData.precip}mm</span>
                             </div>
                             <div className="bg-slate-900 p-2 rounded flex flex-col items-center justify-center border border-slate-700">
                                 <span className="text-[9px] text-slate-500 uppercase">Pressão</span>
                                 <span className="text-sm font-bold text-slate-300">{weatherData.pressure}mb</span>
                             </div>
                        </div>
                    </div>

                    {/* Astronomy */}
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><Moon size={12}/> Astronomia</h4>
                        <div className="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-700 text-xs">
                             <div className="flex items-center gap-2 text-amber-400">
                                 <Sunrise size={14} /> {weatherData.sunrise}
                             </div>
                             <div className="h-4 w-px bg-slate-700"></div>
                             <div className="flex items-center gap-2 text-indigo-400">
                                 <Sunset size={14} /> {weatherData.sunset}
                             </div>
                        </div>
                    </div>

                     {/* Forecast */}
                    {weatherData.forecast && weatherData.forecast.length > 0 && (
                        <div>
                             <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1"><CalendarDays size={12}/> Previsão 3 Dias</h4>
                             <div className="space-y-1">
                                 {weatherData.forecast.map((d, i) => (
                                     <div key={i} className="flex justify-between items-center bg-slate-900/50 p-1.5 rounded text-[10px] text-slate-300">
                                          <span className="w-16 opacity-70">{d.date.split('-').slice(1).join('/')}</span>
                                          <span className="flex-1 truncate px-2">{d.condition}</span>
                                          <span className="font-mono text-cyan-400">{Math.round(d.minTemp)}° / {Math.round(d.maxTemp)}°</span>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    )}
                </div>
            )}
            
            {/* DEBUG LOG SECTION */}
            {apiDebugLog && (
                <div className="mt-4 border-t border-slate-700 pt-2">
                    <div className="flex justify-between items-center mb-2">
                         <h4 className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                             <Terminal size={12}/> Debug Log (Raw JSON)
                         </h4>
                         <button onClick={copyLogToClipboard} className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 border border-cyan-900 px-2 py-0.5 rounded bg-cyan-900/20">
                             <Clipboard size={10} /> Copiar
                         </button>
                    </div>
                    <div className="bg-slate-950 p-2 rounded border border-slate-800 h-32 overflow-auto custom-scrollbar">
                         <pre className="text-[9px] text-slate-400 font-mono whitespace-pre-wrap break-all">
                             {apiDebugLog}
                         </pre>
                    </div>
                </div>
            )}
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
                {aiGenerating ? <Loader2 className="animate-spin" size={14}/> : <ImageIcon size={14}/>}
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
                <Zap size={14} className="text-yellow-400" /> Clima (Simulação/Widgets)
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

            <div className="grid grid-cols-2 gap-3 border-t border-slate-700 pt-3">
                <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Vento (Dir {weatherData.windDir}°)</label>
                    <input type="range" min="0" max="360" value={weatherData.windDir} onChange={e => setWeatherData({windDir: parseInt(e.target.value)})} className="w-full" />
                </div>
                <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Velocidade ({weatherData.windSpeed} km/h)</label>
                    <input type="range" min="0" max="100" value={weatherData.windSpeed} onChange={e => setWeatherData({windSpeed: parseInt(e.target.value)})} className="w-full" />
                </div>
                <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Temp ({weatherData.temp}°C)</label>
                    <input type="range" min="15" max="40" value={weatherData.temp} onChange={e => setWeatherData({temp: parseInt(e.target.value)})} className="w-full" />
                </div>
                <div>
                    <label className="text-[10px] text-slate-500 block mb-1">Bateria ({weatherData.battery}%)</label>
                    <input type="range" min="0" max="100" value={weatherData.battery} onChange={e => setWeatherData({battery: parseInt(e.target.value)})} className="w-full accent-green-500" />
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-700 mt-2">
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] text-slate-500 block">Fase Lua: <span className="text-white">{weatherData.moonPhase}</span></label>
                        <span className="text-[10px] text-purple-400">{weatherData.moonIllumination}% Ilum.</span>
                    </div>
                    <input type="range" min="0" max="100" value={weatherData.moonIllumination} onChange={e => setWeatherData({moonIllumination: parseInt(e.target.value)})} className="w-full accent-purple-500" />
                </div>
            </div>
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
