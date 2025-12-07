
import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { Cpu, Activity, Package, CheckCircle, Sliders, Thermometer, Droplets, Wind, Sun, Moon, Terminal } from 'lucide-react';

export const FirmwareCompiler: React.FC = () => {
  const { firmwareConfig, updateFirmwareConfig, weatherData, setWeatherData, apiDebugLog, setNotification, keyframes } = useAppStore();
  
  const [compilerTemp, setCompilerTemp] = useState(25);
  const [compilerWind, setCompilerWind] = useState(10);
  const [useFixedWeather, setUseFixedWeather] = useState(false);

  const handleCompileFirmwareData = () => {
      const compiled = {
          timestamp: Date.now(),
          frames: keyframes, // Uses current chart data
          defaultTemp: compilerTemp,
          defaultWind: compilerWind,
          defaultHumidity: 60,
          useFixedWeather: useFixedWeather
      };
      
      updateFirmwareConfig({ compiledData: compiled });
      setNotification('success', 'Dados compilados para o Firmware!');
  };

  const copyLogToClipboard = () => {
    if (apiDebugLog) {
        navigator.clipboard.writeText(apiDebugLog);
        setNotification('success', "Log copiado!");
    }
  };

  return (
      <div className="flex flex-col gap-4 min-h-[400px] xl:min-h-0 xl:h-full">
          {/* Firmware Compiler Block */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 flex flex-col shrink-0">
               <div className="p-4 border-b border-slate-700 shrink-0">
                  <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <Cpu size={14} className="text-emerald-400"/> Compilador de Dados (Firmware)
                  </h3>
               </div>
               <div className="p-4 space-y-4">
                   <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                       <div className="flex justify-between items-center mb-2">
                           <span className="text-[10px] font-bold text-slate-400">FONTE DE CLIMA</span>
                           <button onClick={()=>setUseFixedWeather(!useFixedWeather)} className={`text-[9px] px-2 py-0.5 rounded ${useFixedWeather ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                               {useFixedWeather ? 'FIXO / MOCK' : 'ZERO / API'}
                           </button>
                       </div>
                       
                       <div className={`space-y-2 transition-opacity ${useFixedWeather ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                           <div>
                               <label className="text-[9px] text-slate-500 block mb-1">Temp Padrão (°C)</label>
                               <input type="number" value={compilerTemp} onChange={e=>setCompilerTemp(parseInt(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white"/>
                           </div>
                           <div>
                               <label className="text-[9px] text-slate-500 block mb-1">Vento Padrão (km/h)</label>
                               <input type="number" value={compilerWind} onChange={e=>setCompilerWind(parseInt(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white"/>
                           </div>
                       </div>
                   </div>
                   
                   <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50 flex items-center gap-2">
                       <Activity size={12} className="text-cyan-400"/>
                       <div className="flex-1">
                           <div className="text-[10px] font-bold text-white">Curva de Maré</div>
                           <div className="text-[9px] text-slate-500">Usará o gráfico atual ({keyframes.length} pts)</div>
                       </div>
                   </div>

                   <button 
                       onClick={handleCompileFirmwareData}
                       className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-2 rounded text-xs flex items-center justify-center gap-2 transition"
                   >
                       <Package size={14}/> Compilar Dados Estáticos
                   </button>
                   
                   {firmwareConfig.compiledData && (
                       <div className="text-[9px] text-emerald-400 text-center flex items-center justify-center gap-1">
                           <CheckCircle size={10}/> Dados prontos para Firmware Builder
                       </div>
                   )}
               </div>
          </div>

          {/* Environment Sliders */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 flex flex-col flex-1 min-h-[300px] xl:min-h-0">
             <div className="p-4 border-b border-slate-700 shrink-0">
                  <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <Sliders size={14} className="text-orange-400"/> Ajustes Visuais (Preview)
                  </h3>
             </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                  <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                      <div className="flex justify-between mb-2">
                           <label className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1"><Thermometer size={12} className="text-orange-400"/> Temperatura</label>
                           <span className="text-xs font-mono text-white bg-slate-800 px-1.5 rounded">{weatherData.temp}°C</span>
                      </div>
                      <input type="range" min="15" max="40" value={weatherData.temp} onChange={e => setWeatherData({temp: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500" />
                  </div>

                  <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                      <div className="flex justify-between mb-2">
                           <label className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1"><Droplets size={12} className="text-blue-400"/> Umidade</label>
                           <span className="text-xs font-mono text-white bg-slate-800 px-1.5 rounded">{weatherData.humidity}%</span>
                      </div>
                      <input type="range" min="0" max="100" value={weatherData.humidity} onChange={e => setWeatherData({humidity: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                  </div>

                  <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                      <div className="flex justify-between mb-2">
                           <label className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1"><Wind size={12} className="text-slate-300"/> Vento</label>
                           <span className="text-xs font-mono text-white bg-slate-800 px-1.5 rounded">{weatherData.windSpeed} km/h</span>
                      </div>
                      <input type="range" min="0" max="100" value={weatherData.windSpeed} onChange={e => setWeatherData({windSpeed: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-400" />
                  </div>

                  <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                      <div className="flex justify-between mb-2">
                           <label className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1"><Sun size={12} className="text-yellow-400"/> UV Index</label>
                           <span className="text-xs font-mono text-white bg-slate-800 px-1.5 rounded">{weatherData.uv}</span>
                      </div>
                      <input type="range" min="0" max="15" value={weatherData.uv} onChange={e => setWeatherData({uv: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-400" />
                  </div>

                  <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50">
                      <div className="flex justify-between mb-2">
                           <label className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1"><Moon size={12} className="text-purple-400"/> Lua (%)</label>
                           <span className="text-xs font-mono text-white bg-slate-800 px-1.5 rounded">{weatherData.moonIllumination}%</span>
                      </div>
                      <input type="range" min="0" max="100" value={weatherData.moonIllumination} onChange={e => setWeatherData({moonIllumination: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                  </div>
            </div>

            {/* Debug Log Toggler */}
            {apiDebugLog && (
               <div className="p-3 border-t border-slate-700 shrink-0">
                    <button 
                       onClick={copyLogToClipboard}
                       className="w-full text-[9px] text-slate-500 hover:text-white flex items-center justify-center gap-2 py-2 rounded hover:bg-slate-700 transition border border-slate-700"
                    >
                        <Terminal size={10}/> Copiar Log de Debug API
                    </button>
               </div>
            )}
        </div>
      </div>
  );
};
