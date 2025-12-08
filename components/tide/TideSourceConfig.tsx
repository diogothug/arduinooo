
import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { TideSourceType, MockWaveType } from '../../types';
import { tideSourceService } from '../../services/tideSourceService';
import { Database, MapPin, Globe, Calculator, Activity, Search, AlertCircle, CheckCircle, Info, RefreshCw, Server, Save, FolderOpen, Trash2, CloudSun, CloudRain, Waves, Anchor, Settings } from 'lucide-react';

interface TideSourceConfigProps {
    useSevenDayMode: boolean;
    setSimulatedTime: (t: number) => void;
    mode?: 'MARE' | 'CLIMA' | 'ONDAS'; // Explicit mode prop
}

export const TideSourceConfig: React.FC<TideSourceConfigProps> = ({ useSevenDayMode, setSimulatedTime, mode = 'MARE' }) => {
  const { 
    dataSourceConfig, updateDataSourceConfig, weatherData, setWeatherData,
    setKeyframes, setNotification, setApiStatus, savedMocks, saveMock, deleteMock, systemTime
  } = useAppStore();

  const [isGeneratingSource, setIsGeneratingSource] = useState(false);
  const [isCheckingPort, setIsCheckingPort] = useState(false);
  const [newMockName, setNewMockName] = useState('');

  const cycleLimit = useSevenDayMode ? 168 : 24;

  const handleSourceGenerate = async () => {
      setIsGeneratingSource(true);
      setApiStatus(true, null);
      try {
          const durationToFetch = dataSourceConfig.activeSource === TideSourceType.TABUA_MARE ? (useSevenDayMode ? 7 : 3) : cycleLimit;
          const { frames, sourceUsed, weather } = await tideSourceService.getTideData(dataSourceConfig, durationToFetch);
          
          setKeyframes(frames);
          setSimulatedTime(0);
          
          if (weather) {
              setWeatherData(weather);
              setNotification('success', `Dados Atualizados: ${frames.length} pts + Clima/Ondas`);
          } else {
              setNotification('success', `Dados gerados via: ${sourceUsed}`);
          }
          setApiStatus(false, null);

      } catch (e: any) {
          setNotification('error', `Erro: ${e.message}`);
          setApiStatus(false, e.message);
      } finally {
          setIsGeneratingSource(false);
      }
  };

  const handleCheckPort = async () => {
      setIsCheckingPort(true);
      updateDataSourceConfig({ tabuaMare: {...dataSourceConfig.tabuaMare, lastFoundHarbor: null} });
      try {
          let resultName = "";
          let resultDist = "";
          if (dataSourceConfig.tabuaMare.harborId) {
             const result = await tideSourceService.getHarborById(dataSourceConfig);
             resultName = `${result.name} (ID: ${result.id})`;
             resultDist = "Selecionado por ID";
          } else {
             const result = await tideSourceService.findNearestHarbor(dataSourceConfig);
             resultName = `${result.name} (ID: ${result.id})`;
             resultDist = `${result.distance}km`;
          }
          const formatted = `Porto: ${resultName} - ${resultDist}`;
          updateDataSourceConfig({ tabuaMare: {...dataSourceConfig.tabuaMare, lastFoundHarbor: formatted} });
          setNotification('success', 'Porto confirmado!');
      } catch(e: any) {
          updateDataSourceConfig({ tabuaMare: {...dataSourceConfig.tabuaMare, lastFoundHarbor: "Erro: " + e.message} });
          setNotification('error', 'Falha ao buscar porto.');
      } finally {
          setIsCheckingPort(false);
      }
  };

  const handleSaveMock = () => {
      const name = newMockName || `Snapshot ${new Date(systemTime).toLocaleTimeString()}`;
      saveMock(name, useAppStore.getState().keyframes);
      setNewMockName('');
      setNotification('success', 'Mock salvo com sucesso!');
  };

  return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 flex flex-col h-auto">
          {/* Header */}
          <div className="border-b border-slate-700 p-4">
               <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    {mode === 'MARE' && <Anchor size={16} className="text-cyan-400"/>}
                    {mode === 'CLIMA' && <CloudSun size={16} className="text-green-400"/>}
                    {mode === 'ONDAS' && <Waves size={16} className="text-blue-400"/>}
                    
                    {mode === 'MARE' && 'Configuração de Maré'}
                    {mode === 'CLIMA' && 'Clima & Meteorologia'}
                    {mode === 'ONDAS' && 'Ondas & Surf'}
               </h3>
          </div>

          <div className="p-4 bg-slate-900/50 min-h-[300px]">
              
              {/* --- SECTION: MARE (TIDE) --- */}
              {mode === 'MARE' && (
                  <div className="space-y-6 animate-in fade-in">
                      {/* Source Selection */}
                      <div className="space-y-2">
                          <label className="text-[9px] text-slate-500 uppercase font-bold">Fonte Principal de Nível</label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                               {[
                                   { type: TideSourceType.TABUA_MARE, label: "Tábua BR", icon: <MapPin size={12}/> },
                                   { type: TideSourceType.CALCULATED, label: "Calculada", icon: <Calculator size={12}/> },
                                   { type: TideSourceType.MOCK, label: "Mocks", icon: <Activity size={12}/> },
                                   { type: TideSourceType.API, label: "Global API", icon: <Globe size={12}/> },
                               ].map(opt => (
                                   <button 
                                      key={opt.type}
                                      onClick={() => updateDataSourceConfig({ activeSource: opt.type })}
                                      className={`px-2 py-2 rounded text-[10px] font-bold flex flex-col items-center gap-1 transition border ${dataSourceConfig.activeSource === opt.type ? 'bg-cyan-900/30 text-cyan-400 border-cyan-500/50' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'}`}
                                   >
                                       {opt.icon} {opt.label}
                                   </button>
                               ))}
                          </div>
                      </div>

                      {/* Tabua Config */}
                      {dataSourceConfig.activeSource === TideSourceType.TABUA_MARE && (
                          <div className="space-y-3 bg-slate-800 p-3 rounded border border-slate-700">
                              <div>
                                  <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">ID do Porto (Brasil)</label>
                                  <div className="flex gap-2">
                                    <input 
                                        type="number" 
                                        placeholder="Ex: 7 (Salvador)" 
                                        value={dataSourceConfig.tabuaMare.harborId || ''} 
                                        onChange={(e) => updateDataSourceConfig({ tabuaMare: {...dataSourceConfig.tabuaMare, harborId: parseInt(e.target.value) || null} })} 
                                        className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 text-xs text-white focus:border-cyan-500 outline-none"
                                    />
                                     <button 
                                        onClick={handleCheckPort}
                                        disabled={isCheckingPort}
                                        className="bg-slate-700 hover:bg-slate-600 text-white px-3 rounded text-xs border border-slate-600 flex items-center gap-2 transition"
                                    >
                                        {isCheckingPort ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Search size={12}/>}
                                    </button>
                                  </div>
                                  {dataSourceConfig.tabuaMare.lastFoundHarbor && (
                                    <div className={`mt-2 text-[10px] p-2 rounded border flex items-center gap-2 ${dataSourceConfig.tabuaMare.lastFoundHarbor.startsWith("Erro") ? 'bg-red-900/20 border-red-900/30 text-red-300' : 'bg-green-900/20 border-green-900/30 text-green-400'}`}>
                                        {dataSourceConfig.tabuaMare.lastFoundHarbor.startsWith("Erro") ? <AlertCircle size={12}/> : <CheckCircle size={12}/>}
                                        <span className="truncate">{dataSourceConfig.tabuaMare.lastFoundHarbor}</span>
                                    </div>
                                  )}
                              </div>
                          </div>
                      )}

                      {/* Calculated Config */}
                      {dataSourceConfig.activeSource === TideSourceType.CALCULATED && (
                          <div className="space-y-3 bg-slate-800 p-3 rounded border border-slate-700">
                              <div className="text-[10px] text-slate-400 mb-2">Parâmetros Senoidais</div>
                              <div className="grid grid-cols-2 gap-2">
                                  <div><label className="text-[9px]">Período (h)</label><input type="number" value={dataSourceConfig.calculation.period} onChange={e=>updateDataSourceConfig({calculation:{...dataSourceConfig.calculation, period:parseFloat(e.target.value)}})} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-xs text-white"/></div>
                                  <div><label className="text-[9px]">Amplitude</label><input type="number" value={dataSourceConfig.calculation.amplitude} onChange={e=>updateDataSourceConfig({calculation:{...dataSourceConfig.calculation, amplitude:parseFloat(e.target.value)}})} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-xs text-white"/></div>
                              </div>
                          </div>
                      )}

                      {/* Mock Config */}
                      {dataSourceConfig.activeSource === TideSourceType.MOCK && (
                          <div className="space-y-3 bg-slate-800 p-3 rounded border border-slate-700">
                               <div className="flex gap-2">
                                   <input type="text" value={newMockName} onChange={e=>setNewMockName(e.target.value)} placeholder="Nome do snapshot..." className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 text-xs text-white"/>
                                   <button onClick={handleSaveMock} className="bg-green-600 hover:bg-green-500 text-white px-3 rounded text-xs"><Save size={14}/></button>
                               </div>
                               <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                                   {savedMocks.map(m => (
                                       <div key={m.id} onClick={()=>{setKeyframes(m.frames); setNotification('success', 'Mock carregado');}} className="p-2 bg-slate-900 rounded border border-slate-700 cursor-pointer hover:border-cyan-500 flex justify-between">
                                           <span className="text-xs text-slate-300">{m.name}</span>
                                           <span className="text-[10px] text-slate-500">{m.frames.length}pts</span>
                                       </div>
                                   ))}
                               </div>
                          </div>
                      )}

                      {/* Action */}
                      <button 
                            onClick={handleSourceGenerate}
                            disabled={isGeneratingSource}
                            className="w-full font-bold py-3 rounded-lg text-xs flex items-center justify-center gap-2 transition shadow-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/20"
                        >
                            {isGeneratingSource ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />} 
                            {isGeneratingSource ? 'Buscando Dados...' : 'Atualizar Dados de Maré'}
                      </button>
                  </div>
              )}

              {/* --- SECTION: CLIMA (WEATHER) --- */}
              {mode === 'CLIMA' && (
                  <div className="space-y-6 animate-in fade-in">
                      <div className="space-y-2">
                          <label className="text-[9px] text-slate-500 uppercase font-bold">Provedor de Clima</label>
                          <div className="flex gap-2">
                               <button onClick={()=>updateDataSourceConfig({activeSource: TideSourceType.OPEN_METEO})} className={`flex-1 p-3 rounded border text-xs font-bold transition ${dataSourceConfig.activeSource===TideSourceType.OPEN_METEO ? 'bg-orange-900/30 border-orange-500 text-orange-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                                   Open-Meteo (Grátis)
                               </button>
                               <button onClick={()=>updateDataSourceConfig({activeSource: TideSourceType.API})} className={`flex-1 p-3 rounded border text-xs font-bold transition ${dataSourceConfig.activeSource===TideSourceType.API ? 'bg-cyan-900/30 border-cyan-500 text-cyan-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                                   WeatherAPI (Key)
                               </button>
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-[9px] text-slate-500 uppercase font-bold">Latitude</label>
                              <input type="number" value={dataSourceConfig.tabuaMare.lat} onChange={(e) => updateDataSourceConfig({ tabuaMare: {...dataSourceConfig.tabuaMare, lat: parseFloat(e.target.value)} })} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white"/>
                          </div>
                          <div>
                              <label className="text-[9px] text-slate-500 uppercase font-bold">Longitude</label>
                              <input type="number" value={dataSourceConfig.tabuaMare.lng} onChange={(e) => updateDataSourceConfig({ tabuaMare: {...dataSourceConfig.tabuaMare, lng: parseFloat(e.target.value)} })} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white"/>
                          </div>
                      </div>

                      {dataSourceConfig.activeSource === TideSourceType.API && (
                           <div>
                               <label className="text-[9px] text-slate-500 uppercase font-bold">API Key (WeatherAPI)</label>
                               <input type="password" value={dataSourceConfig.api.token} onChange={(e) => updateDataSourceConfig({ api: {...dataSourceConfig.api, token: e.target.value} })} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white"/>
                           </div>
                      )}

                      <div className="bg-slate-800 p-3 rounded border border-slate-700">
                          <h4 className="text-[10px] text-green-400 font-bold mb-2 flex items-center gap-1"><CloudRain size={12}/> Recursos Ativos</h4>
                          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                              <div className="flex items-center gap-2"><CheckCircle size={10} className="text-green-500"/> Temp & Umidade</div>
                              <div className="flex items-center gap-2"><CheckCircle size={10} className="text-green-500"/> Velocidade Vento</div>
                              <div className="flex items-center gap-2"><CheckCircle size={10} className="text-green-500"/> Prob. Chuva (12h)</div>
                              <div className="flex items-center gap-2"><CheckCircle size={10} className="text-green-500"/> Fase Lunar</div>
                          </div>
                      </div>
                      
                      <button 
                            onClick={handleSourceGenerate}
                            disabled={isGeneratingSource}
                            className="w-full font-bold py-3 rounded-lg text-xs flex items-center justify-center gap-2 transition shadow-lg bg-green-600 hover:bg-green-500 text-white shadow-green-900/20"
                        >
                            {isGeneratingSource ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />} 
                            {isGeneratingSource ? 'Buscando Dados...' : 'Atualizar Clima'}
                      </button>
                  </div>
              )}

              {/* --- SECTION: ONDAS (WAVES) --- */}
              {mode === 'ONDAS' && (
                  <div className="space-y-6 animate-in fade-in">
                      <div className="bg-blue-900/20 p-4 rounded border border-blue-900/30">
                          <div className="flex justify-between items-start mb-4">
                              <div>
                                  <h3 className="text-sm font-bold text-blue-300">Dados Marítimos</h3>
                                  <p className="text-[10px] text-blue-200/70 mt-1">Extraído via Open-Meteo Marine API</p>
                              </div>
                              <Waves size={24} className="text-blue-400 opacity-50"/>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-3 text-center">
                              <div className="bg-slate-900/50 p-2 rounded border border-blue-900/20">
                                  <div className="text-[9px] text-slate-400 uppercase">Altura</div>
                                  <div className="text-lg font-mono text-white">{weatherData.wave?.height || 0}m</div>
                              </div>
                              <div className="bg-slate-900/50 p-2 rounded border border-blue-900/20">
                                  <div className="text-[9px] text-slate-400 uppercase">Direção</div>
                                  <div className="text-lg font-mono text-white">{weatherData.wave?.direction || 0}°</div>
                              </div>
                              <div className="bg-slate-900/50 p-2 rounded border border-blue-900/20">
                                  <div className="text-[9px] text-slate-400 uppercase">Período</div>
                                  <div className="text-lg font-mono text-white">{weatherData.wave?.period || 0}s</div>
                              </div>
                          </div>
                      </div>

                      {/* NEW BUTTON FOR WAVES FETCH */}
                      <button 
                            onClick={handleSourceGenerate}
                            disabled={isGeneratingSource}
                            className="w-full font-bold py-3 rounded-lg text-xs flex items-center justify-center gap-2 transition shadow-lg bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20"
                        >
                            {isGeneratingSource ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />} 
                            {isGeneratingSource ? 'Buscando Previsão de Ondas...' : 'Atualizar Previsão (Open-Meteo)'}
                      </button>

                      <div className="bg-slate-800 p-4 rounded border border-slate-700">
                          <h4 className="text-[10px] text-slate-400 font-bold mb-3 uppercase flex items-center gap-2"><Settings size={12}/> Configuração Manual</h4>
                          <div className="space-y-3">
                              <div>
                                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                      <span>Altura (Simulação)</span>
                                      <span className="text-white">{weatherData.wave?.height}m</span>
                                  </div>
                                  <input type="range" min="0" max="5" step="0.1" value={weatherData.wave?.height || 0} onChange={e=>setWeatherData({wave:{...(weatherData.wave || {height:0,direction:0,period:0}), height:parseFloat(e.target.value)}})} className="w-full h-1.5 bg-slate-900 rounded appearance-none cursor-pointer accent-blue-500"/>
                              </div>
                              <div>
                                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                      <span>Direção (Simulação)</span>
                                      <span className="text-white">{weatherData.wave?.direction}°</span>
                                  </div>
                                  <input type="range" min="0" max="360" step="1" value={weatherData.wave?.direction || 0} onChange={e=>setWeatherData({wave:{...(weatherData.wave || {height:0,direction:0,period:0}), direction:parseInt(e.target.value)}})} className="w-full h-1.5 bg-slate-900 rounded appearance-none cursor-pointer accent-blue-500"/>
                              </div>
                          </div>
                      </div>
                  </div>
              )}

          </div>
      </div>
  );
};
