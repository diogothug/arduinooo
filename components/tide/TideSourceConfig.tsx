
import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { TideSourceType, MockWaveType } from '../../types';
import { tideSourceService } from '../../services/tideSourceService';
import { Database, MapPin, Globe, Calculator, Activity, Search, AlertCircle, CheckCircle, Info, RefreshCw, Server, Save, FolderOpen, Trash2 } from 'lucide-react';

interface TideSourceConfigProps {
    useSevenDayMode: boolean;
    setSimulatedTime: (t: number) => void;
}

export const TideSourceConfig: React.FC<TideSourceConfigProps> = ({ useSevenDayMode, setSimulatedTime }) => {
  const { 
    dataSourceConfig, updateDataSourceConfig, weatherData, setWeatherData,
    setKeyframes, setNotification, setApiStatus, savedMocks, saveMock, deleteMock
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
              setNotification('success', `Dados Atualizados: ${frames.length} pts + Clima`);
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
      const name = newMockName || `Snapshot ${new Date().toLocaleTimeString()}`;
      saveMock(name, useAppStore.getState().keyframes);
      setNewMockName('');
      setNotification('success', 'Mock salvo com sucesso!');
  };

  return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 flex flex-col min-h-[500px] xl:min-h-0 xl:h-full">
          <div className="p-4 border-b border-slate-700 shrink-0">
               <h3 className="text-xs font-bold text-white flex items-center gap-2 mb-3">
                    <Database size={14} className="text-purple-400"/> Configuração da Fonte
               </h3>
               <div className="flex flex-wrap gap-2">
                   {[
                       { type: TideSourceType.TABUA_MARE, label: "Tábua Maré (BR)", icon: <MapPin size={12}/>, color: "text-yellow-400", bg: "bg-yellow-500/20", border: "border-yellow-500/30" },
                       { type: TideSourceType.API, label: "WeatherAPI", icon: <Globe size={12}/>, color: "text-cyan-400", bg: "bg-cyan-500/20", border: "border-cyan-500/30" },
                       { type: TideSourceType.CALCULATED, label: "Calculados", icon: <Calculator size={12}/>, color: "text-pink-400", bg: "bg-pink-500/20", border: "border-pink-500/30" },
                       { type: TideSourceType.MOCK, label: "Mocks", icon: <Activity size={12}/>, color: "text-green-400", bg: "bg-green-500/20", border: "border-green-500/30" },
                   ].map(opt => (
                       <button 
                          key={opt.type}
                          onClick={() => updateDataSourceConfig({ activeSource: opt.type })}
                          className={`px-3 py-1.5 rounded text-[10px] font-bold flex items-center gap-2 transition border ${dataSourceConfig.activeSource === opt.type ? `${opt.bg} ${opt.color} ${opt.border}` : 'text-slate-400 border-transparent hover:bg-slate-700'}`}
                       >
                           {opt.icon} {opt.label}
                       </button>
                   ))}
               </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-slate-900/50">
              
              {dataSourceConfig.activeSource === TideSourceType.TABUA_MARE && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                      <div className="space-y-4">
                          <div>
                              <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">ID do Porto</label>
                              <div className="flex gap-2">
                                <input 
                                    type="number" 
                                    placeholder="Ex: 8 (Ilhéus)" 
                                    value={dataSourceConfig.tabuaMare.harborId || ''} 
                                    onChange={(e) => updateDataSourceConfig({ tabuaMare: {...dataSourceConfig.tabuaMare, harborId: parseInt(e.target.value) || null} })} 
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white focus:border-yellow-500 outline-none"
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
                          
                          <div className="bg-blue-900/20 border border-blue-900/30 p-3 rounded">
                              <h5 className="text-[10px] font-bold text-blue-300 mb-1 flex items-center gap-1"><Info size={10}/> Modo 7 Dias</h5>
                              <p className="text-[10px] text-blue-200/70 leading-relaxed">
                                  A Tábua de Marés do Brasil fornece dados precisos. Ative o modo "7 Dias" no topo para previsão semanal.
                              </p>
                          </div>
                      </div>

                      <div className="space-y-4">
                          <div className="flex gap-2">
                              <div className="flex-1">
                                  <label className="text-[9px] text-slate-500 uppercase font-bold">Latitude</label>
                                  <input type="number" value={dataSourceConfig.tabuaMare.lat} onChange={(e) => updateDataSourceConfig({ tabuaMare: {...dataSourceConfig.tabuaMare, lat: parseFloat(e.target.value)} })} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white"/>
                              </div>
                              <div className="flex-1">
                                  <label className="text-[9px] text-slate-500 uppercase font-bold">Longitude</label>
                                  <input type="number" value={dataSourceConfig.tabuaMare.lng} onChange={(e) => updateDataSourceConfig({ tabuaMare: {...dataSourceConfig.tabuaMare, lng: parseFloat(e.target.value)} })} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white"/>
                              </div>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button 
                                onClick={handleSourceGenerate}
                                disabled={isGeneratingSource}
                                className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2.5 rounded text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-yellow-900/20"
                            >
                                {isGeneratingSource ? <RefreshCw className="animate-spin" size={12} /> : <Server size={14} />} 
                                {isGeneratingSource ? 'Buscando...' : 'Buscar Dados'}
                            </button>
                            <button onClick={handleSaveMock} className="px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded border border-slate-600 flex items-center justify-center transition" title="Salvar como Mock">
                                <Save size={16}/>
                            </button>
                          </div>
                      </div>
                  </div>
              )}

              {dataSourceConfig.activeSource === TideSourceType.API && (
                  <div className="space-y-4 animate-in fade-in max-w-lg">
                       <div>
                           <label className="text-[9px] text-slate-500 uppercase font-bold">Local ID</label>
                           <input type="text" value={dataSourceConfig.api.locationId} onChange={(e) => updateDataSourceConfig({ api: {...dataSourceConfig.api, locationId: e.target.value} })} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded p-2.5 text-xs text-white focus:border-cyan-500 outline-none"/>
                           <p className="text-[10px] text-slate-500 mt-1">Ex: -13.613295,-38.908930 (Moreré)</p>
                       </div>
                       
                       <div className="bg-slate-800 p-3 rounded border border-slate-700 flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${weatherData.forecast.length > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                           <span className="text-xs font-bold text-slate-300">Status API: {weatherData.forecast.length > 0 ? 'OK' : 'Sem Dados'}</span>
                       </div>

                       <div className="flex gap-2 pt-2">
                            <button 
                                    onClick={handleSourceGenerate}
                                    disabled={isGeneratingSource}
                                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 rounded text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-cyan-900/20"
                                >
                                    {isGeneratingSource ? <RefreshCw className="animate-spin" size={12} /> : <Server size={14} />} 
                                    {isGeneratingSource ? 'Conectando...' : 'Buscar Dados'}
                            </button>
                            <button onClick={handleSaveMock} className="px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded border border-slate-600 flex items-center justify-center transition" title="Salvar">
                                <Save size={16}/>
                            </button>
                        </div>
                  </div>
              )}

              {dataSourceConfig.activeSource === TideSourceType.CALCULATED && (
                  <div className="animate-in fade-in flex flex-col gap-6">
                      <div className="bg-black/50 p-4 rounded-lg border border-slate-700 font-mono text-center flex flex-col items-center justify-center gap-2">
                          <div className="text-[9px] text-slate-500 uppercase tracking-widest">Matemática de Cálculo</div>
                          <div className="text-sm md:text-base text-pink-400 break-words w-full px-2 leading-loose">
                              y(t) = <span className="text-white font-bold">{dataSourceConfig.calculation.offset}</span> + <span className="text-white font-bold">{dataSourceConfig.calculation.amplitude}</span>·sin(
                              <span className="text-cyan-400">2π</span>·(t + <span className="text-white font-bold">{dataSourceConfig.calculation.phase}</span>)/<span className="text-white font-bold">{dataSourceConfig.calculation.period}</span>)
                          </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {[
                            { label: 'Período (h)', min: 6, max: 24, step: 0.1, val: dataSourceConfig.calculation.period, key: 'period' },
                            { label: 'Amplitude (%)', min: 0, max: 50, step: 1, val: dataSourceConfig.calculation.amplitude, key: 'amplitude' },
                            { label: 'Fase (h)', min: 0, max: 24, step: 0.5, val: dataSourceConfig.calculation.phase, key: 'phase' },
                            { label: 'Offset (%)', min: 10, max: 90, step: 5, val: dataSourceConfig.calculation.offset, key: 'offset' }
                          ].map((item) => (
                              <div key={item.key} className="bg-slate-800 p-3 rounded border border-slate-700">
                                  <label className="text-[9px] text-slate-500 uppercase font-bold block mb-2">{item.label}</label>
                                  <div className="flex items-center gap-3">
                                      <input type="range" min={item.min} max={item.max} step={item.step} value={item.val} onChange={e => updateDataSourceConfig({ calculation: {...dataSourceConfig.calculation, [item.key]: parseFloat(e.target.value)} })} className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500" />
                                      <span className="text-xs font-mono text-white w-12 text-right bg-slate-900 px-1 py-0.5 rounded">{item.val}</span>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {dataSourceConfig.activeSource === TideSourceType.MOCK && (
                  <div className="animate-in fade-in flex flex-col gap-4">
                       <div className="bg-slate-900 p-4 rounded border border-slate-700 flex gap-2">
                           <input type="text" value={newMockName} onChange={e=>setNewMockName(e.target.value)} placeholder="Nome do snapshot..." className="flex-1 bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white focus:border-green-500 outline-none"/>
                           <button onClick={handleSaveMock} className="bg-green-600 hover:bg-green-500 text-white px-4 rounded text-xs font-bold flex items-center gap-2"><Save size={14}/> Salvar</button>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                           {savedMocks.map(mock => (
                               <div key={mock.id} className="bg-slate-800 p-3 rounded border border-slate-700 flex justify-between items-center group hover:border-green-500/50 transition">
                                   <div onClick={() => { setKeyframes(mock.frames); setNotification('success', `Mock "${mock.name}" carregado!`); }} className="cursor-pointer flex-1 min-w-0 pr-2">
                                       <div className="text-sm font-bold text-slate-200 group-hover:text-green-400 transition truncate">{mock.name}</div>
                                       <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-1">
                                           <span className="bg-slate-700 px-1.5 py-0.5 rounded whitespace-nowrap">{mock.frames.length} pts</span>
                                        </div>
                                   </div>
                                   <div className="flex gap-1 shrink-0">
                                       <button onClick={() => { setKeyframes(mock.frames); setNotification('success', `Carregado!`); }} className="text-slate-400 hover:text-green-400 p-2 rounded hover:bg-slate-700 transition"><FolderOpen size={16}/></button>
                                       <button onClick={() => deleteMock(mock.id)} className="text-slate-400 hover:text-red-400 p-2 rounded hover:bg-slate-700 transition"><Trash2 size={16}/></button>
                                   </div>
                               </div>
                           ))}
                       </div>
                  </div>
              )}
          </div>
      </div>
  );
};
