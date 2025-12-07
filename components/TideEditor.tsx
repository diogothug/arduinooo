

import React, { useState } from 'react';
import { useAppStore } from '../store';
import { ConnectionType, TideSourceType, MockWaveType, EffectType, Keyframe } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { Play, Pause, RefreshCw, UploadCloud, Usb, Bluetooth, Wifi, CalendarClock, Server, Activity, Database, MapPin, Search, AlertCircle, CheckCircle, Terminal, Clipboard, CloudSun, Thermometer, Wind, Droplets, Battery, Moon, Sliders, Sun, Globe, Calculator, Save, Trash2, FolderOpen, FunctionSquare, ArrowRight } from 'lucide-react';
import { hardwareBridge } from '../services/hardwareBridge';
import { generateSevenDayForecast } from '../utils/tideLogic';
import { tideSourceService } from '../services/tideSourceService';

const uid = () => Math.random().toString(36).substr(2, 9);

export const TideEditor: React.FC = () => {
  const { 
    keyframes, setKeyframes, 
    simulatedTime, setSimulatedTime, activeDeviceId, devices, connectionType,
    updateFirmwareConfig, dataSourceConfig, updateDataSourceConfig,
    setNotification, apiDebugLog, setWeatherData, setApiStatus, weatherData,
    savedMocks, saveMock, deleteMock
  } = useAppStore();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [useSevenDayMode, setUseSevenDayMode] = useState(false);
  const [isGeneratingSource, setIsGeneratingSource] = useState(false);
  const [isCheckingPort, setIsCheckingPort] = useState(false);
  const [newMockName, setNewMockName] = useState('');

  const activeDevice = devices.find(d => d.id === activeDeviceId);
  const activeData = useSevenDayMode ? generateSevenDayForecast(keyframes) : keyframes;
  const cycleLimit = useSevenDayMode ? 168 : 24;

  // React to parameter changes for CALCULATED mode immediately
  React.useEffect(() => {
      if (dataSourceConfig.activeSource === TideSourceType.CALCULATED) {
          const { period, amplitude, offset, phase } = dataSourceConfig.calculation;
          const frames: Keyframe[] = [];
          const step = 0.5;
          // Generate 24h worth of calc data for preview
          for (let t = 0; t <= 24; t += step) {
              const rad = ((t + phase) * 2 * Math.PI) / period;
              let val = offset + (amplitude * Math.sin(rad));
              val = Math.max(0, Math.min(100, val));
              
              frames.push({
                  id: `calc_${t}`,
                  timeOffset: t,
                  height: parseFloat(val.toFixed(1)),
                  color: val > 50 ? '#00eebb' : '#004488',
                  intensity: Math.floor(val * 2.5),
                  effect: val > 80 ? EffectType.WAVE : EffectType.STATIC
              });
          }
          setKeyframes(frames);
      }
  }, [dataSourceConfig.calculation, dataSourceConfig.activeSource, setKeyframes]);

  React.useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setSimulatedTime((simulatedTime + 0.1) % cycleLimit);
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isPlaying, simulatedTime, setSimulatedTime, cycleLimit]);

  
  const handleSourceGenerate = async () => {
      setIsGeneratingSource(true);
      setApiStatus(true, null);
      try {
          const durationToFetch = dataSourceConfig.activeSource === TideSourceType.TABUA_MARE ? 30 : cycleLimit;
          const { frames, sourceUsed, weather } = await tideSourceService.getTideData(dataSourceConfig, durationToFetch);
          
          setKeyframes(frames);
          setSimulatedTime(0);
          
          // Auto-switch to 7 day mode if data is extensive to prevent "truncation" look
          if (frames.length > 0 && frames[frames.length-1].timeOffset > 25) {
              setUseSevenDayMode(true);
              setNotification('info', 'Modo 7 Dias ativado para visualização completa.');
          }

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

  const handleSyncToDevice = async () => {
    if (connectionType === ConnectionType.NONE) {
        setNotification('error', "Não conectado! Configure USB, BLE ou WiFi.");
        return;
    }
    setIsSyncing(true);
    try {
        updateFirmwareConfig({ cycleDuration: cycleLimit });
        const payload = {
            frames: useSevenDayMode ? activeData : keyframes,
            cycleDuration: cycleLimit,
            harborId: dataSourceConfig.tabuaMare.harborId || 0
        };
        await hardwareBridge.sendData(payload, connectionType, activeDevice?.ip);
        setNotification('success', `Sincronizado: ${useSevenDayMode ? '7 Dias' : '24h'}`);
    } catch (error: any) {
        console.error(error);
        setNotification('error', `Falha no Sync: ${error.message}`);
    } finally {
        setIsSyncing(false);
    }
  };

  const handleSaveMock = () => {
      const name = newMockName || `Snapshot ${new Date().toLocaleTimeString()}`;
      saveMock(name, keyframes);
      setNewMockName('');
      setNotification('success', 'Mock salvo com sucesso!');
  };

  const copyLogToClipboard = () => {
    if (apiDebugLog) {
        navigator.clipboard.writeText(apiDebugLog);
        setNotification('success', "Log copiado!");
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      
      {/* 1. TOP TOOLBAR: STATUS & SYNC */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-800 p-4 rounded-lg border border-slate-700 gap-4 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
           <button 
             onClick={() => setIsPlaying(!isPlaying)}
             className={`p-3 rounded-full ${isPlaying ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30' : 'bg-green-500/20 text-green-500 hover:bg-green-500/30'} transition`}
             title={isPlaying ? "Pausar Simulação" : "Iniciar Simulação"}
           >
             {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
           </button>
           
           <div className="flex flex-col">
               <span className="text-slate-300 font-bold text-sm">Status da Conexão</span>
               <span className={`text-xs flex items-center gap-1 font-mono ${connectionType !== ConnectionType.NONE ? 'text-green-400' : 'text-slate-500'}`}>
                   {connectionType === ConnectionType.USB && <><Usb size={12}/> USB Serial</>}
                   {connectionType === ConnectionType.BLE && <><Bluetooth size={12}/> Bluetooth</>}
                   {connectionType === ConnectionType.WIFI && <><Wifi size={12}/> WiFi: {activeDevice?.name || activeDevice?.ip}</>}
                   {connectionType === ConnectionType.NONE && 'Desconectado'}
               </span>
           </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
                onClick={() => { setUseSevenDayMode(!useSevenDayMode); setSimulatedTime(0); }}
                className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition border ${
                    useSevenDayMode 
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300' 
                    : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200'
                }`}
            >
                <CalendarClock size={16} />
                {useSevenDayMode ? 'Modo 7 Dias' : 'Modo 24 Horas'}
            </button>

            <button 
                onClick={handleSyncToDevice}
                disabled={isSyncing || connectionType === ConnectionType.NONE}
                className={`flex items-center gap-2 px-6 py-2 rounded text-sm transition font-bold shadow-lg ${
                    connectionType !== ConnectionType.NONE
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-900/20' 
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
            >
                {isSyncing ? <RefreshCw className="animate-spin" size={18} /> : <UploadCloud size={18} />}
                {isSyncing ? 'Enviando...' : 'Enviar'}
            </button>
        </div>
      </div>

      {/* 2. VISUALIZATION CHART */}
      <div className="flex-[2] bg-slate-800 rounded-lg border border-slate-700 p-1 min-h-[200px] relative flex flex-col shadow-inner overflow-hidden shrink-0">
        <div className="absolute top-3 left-4 z-10 bg-slate-900/80 px-3 py-1 rounded border border-slate-700 backdrop-blur-sm">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <Activity size={12} className="text-cyan-400"/>
                {useSevenDayMode ? 'Previsão Semanal' : 'Ciclo Diário'}
            </h4>
        </div>
        <div className="absolute top-3 right-4 z-10 flex gap-4 bg-slate-900/80 px-3 py-1 rounded border border-slate-700 backdrop-blur-sm">
             <div className="text-xs font-mono text-cyan-400">
                T+{simulatedTime.toFixed(1)}h
            </div>
        </div>

        <div className="flex-1 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activeData} margin={{top: 20, right: 20, left: -20, bottom: 0}}>
                <defs>
                <linearGradient id="colorHeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis 
                    dataKey="timeOffset" 
                    type="number" 
                    domain={[0, cycleLimit]} 
                    allowDataOverflow={true} // Clips data outside domain
                    stroke="#64748b" 
                    fontSize={10}
                    tickFormatter={(val) => `${val}h`}
                    // Adjust ticks to avoid crowding in 7 day mode
                    ticks={useSevenDayMode ? [0, 24, 48, 72, 96, 120, 144, 168] : [0, 6, 12, 18, 24]}
                />
                <YAxis domain={[0, 100]} stroke="#64748b" fontSize={10} unit="%" />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: '#38bdf8' }}
                    labelFormatter={(label) => `Hora: ${parseFloat(label).toFixed(1)}h`}
                />
                <Area 
                    type="monotone" 
                    dataKey="height" 
                    stroke="#0ea5e9" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorHeight)" 
                    isAnimationActive={false} 
                />
                <ReferenceDot x={simulatedTime} y={50} r={4} fill="#f59e0b" stroke="#fff" strokeWidth={1} />
            </AreaChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* 3. DATA COMMAND CENTER */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
          
          {/* LEFT: SOURCE CONFIGURATION (8 cols) */}
          <div className="lg:col-span-8 bg-slate-800 rounded-lg border border-slate-700 p-4 flex flex-col overflow-hidden">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-700 pb-2 shrink-0">
                   <Database size={16} className="text-purple-400"/> Fonte de Dados
              </h3>
              
              <div className="flex gap-2 mb-4 bg-slate-900/50 p-1 rounded-lg w-fit overflow-x-auto shrink-0">
                   <button 
                      onClick={() => updateDataSourceConfig({ activeSource: TideSourceType.TABUA_MARE })}
                      className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition ${dataSourceConfig.activeSource === TideSourceType.TABUA_MARE ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'text-slate-400 hover:text-slate-200'}`}
                   >
                       <MapPin size={14}/> Tábua Maré (BR)
                   </button>
                   <button 
                      onClick={() => updateDataSourceConfig({ activeSource: TideSourceType.API })}
                      className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition ${dataSourceConfig.activeSource === TideSourceType.API ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'}`}
                   >
                       <Globe size={14}/> WeatherAPI
                   </button>
                   <button 
                      onClick={() => updateDataSourceConfig({ activeSource: TideSourceType.CALCULATED })}
                      className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition ${dataSourceConfig.activeSource === TideSourceType.CALCULATED ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : 'text-slate-400 hover:text-slate-200'}`}
                   >
                       <Calculator size={14}/> Calculados
                   </button>
                   <button 
                      onClick={() => updateDataSourceConfig({ activeSource: TideSourceType.MOCK })}
                      className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition ${dataSourceConfig.activeSource === TideSourceType.MOCK ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'text-slate-400 hover:text-slate-200'}`}
                   >
                       <Activity size={14}/> Mockados
                   </button>
              </div>

              {/* CONFIG PANEL - DYNAMIC */}
              <div className="flex-1 bg-slate-900 rounded-lg border border-slate-700 p-4 overflow-y-auto custom-scrollbar">
                  
                  {dataSourceConfig.activeSource === TideSourceType.TABUA_MARE && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                          <div className="space-y-3">
                              <div>
                                  <label className="text-[10px] text-slate-500 uppercase font-bold">ID do Porto (Recomendado)</label>
                                  <div className="flex gap-2 mt-1">
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
                                        className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded text-xs border border-slate-600 flex items-center gap-2 transition"
                                    >
                                        {isCheckingPort ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Search size={12}/>}
                                        Verificar
                                    </button>
                                  </div>
                                  {dataSourceConfig.tabuaMare.lastFoundHarbor && (
                                    <div className={`mt-2 text-[10px] p-2 rounded border flex items-center gap-2 ${dataSourceConfig.tabuaMare.lastFoundHarbor.startsWith("Erro") ? 'bg-red-900/20 border-red-900/30 text-red-300' : 'bg-green-900/20 border-green-900/30 text-green-400'}`}>
                                        {dataSourceConfig.tabuaMare.lastFoundHarbor.startsWith("Erro") ? <AlertCircle size={12}/> : <CheckCircle size={12}/>}
                                        {dataSourceConfig.tabuaMare.lastFoundHarbor}
                                    </div>
                                  )}
                              </div>
                              <p className="text-[10px] text-slate-500">Se ID nulo, busca por coordenadas.</p>
                          </div>
                          <div className="space-y-3">
                              <div className="flex gap-2">
                                  <div className="flex-1">
                                      <label className="text-[10px] text-slate-500 uppercase font-bold">Latitude</label>
                                      <input type="number" value={dataSourceConfig.tabuaMare.lat} onChange={(e) => updateDataSourceConfig({ tabuaMare: {...dataSourceConfig.tabuaMare, lat: parseFloat(e.target.value)} })} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white"/>
                                  </div>
                                  <div className="flex-1">
                                      <label className="text-[10px] text-slate-500 uppercase font-bold">Longitude</label>
                                      <input type="number" value={dataSourceConfig.tabuaMare.lng} onChange={(e) => updateDataSourceConfig({ tabuaMare: {...dataSourceConfig.tabuaMare, lng: parseFloat(e.target.value)} })} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white"/>
                                  </div>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                    onClick={handleSourceGenerate}
                                    disabled={isGeneratingSource}
                                    className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 rounded flex items-center justify-center gap-2 transition shadow-lg"
                                >
                                    {isGeneratingSource ? <RefreshCw className="animate-spin" size={14} /> : <Server size={14} />} Buscar Dados
                                </button>
                                <button 
                                    onClick={handleSaveMock}
                                    className="px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded border border-slate-600 flex items-center justify-center transition"
                                    title="Salvar resultado como Mock"
                                >
                                    <Save size={16}/>
                                </button>
                              </div>
                          </div>
                      </div>
                  )}

                  {dataSourceConfig.activeSource === TideSourceType.API && (
                      <div className="space-y-3 animate-in fade-in">
                           <div>
                               <label className="text-[10px] text-slate-500 uppercase font-bold">Local ID (Lat,Long ou Nome)</label>
                               <input type="text" value={dataSourceConfig.api.locationId} onChange={(e) => updateDataSourceConfig({ api: {...dataSourceConfig.api, locationId: e.target.value} })} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white"/>
                           </div>
                           <div className="flex gap-2">
                                <button 
                                        onClick={handleSourceGenerate}
                                        disabled={isGeneratingSource}
                                        className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 rounded flex items-center justify-center gap-2 transition shadow-lg"
                                    >
                                        {isGeneratingSource ? <RefreshCw className="animate-spin" size={14} /> : <Server size={14} />} Buscar Dados
                                </button>
                                <button 
                                    onClick={handleSaveMock}
                                    className="px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded border border-slate-600 flex items-center justify-center transition"
                                    title="Salvar resultado como Mock"
                                >
                                    <Save size={16}/>
                                </button>
                            </div>
                      </div>
                  )}

                  {dataSourceConfig.activeSource === TideSourceType.CALCULATED && (
                      <div className="animate-in fade-in h-full flex flex-col">
                          {/* VISUAL FORMULA */}
                          <div className="bg-black/50 p-4 rounded-lg border border-slate-700 mb-4 font-mono text-center flex flex-col items-center justify-center gap-2">
                              <div className="text-[10px] text-slate-500 uppercase tracking-widest">Matemática de Cálculo</div>
                              <div className="text-sm md:text-base text-pink-400">
                                  y(t) = <span className="text-white">{dataSourceConfig.calculation.offset}</span> + <span className="text-white">{dataSourceConfig.calculation.amplitude}</span> · sin(
                                  <span className="text-cyan-400">2π</span> · (t + <span className="text-white">{dataSourceConfig.calculation.phase}</span>) / <span className="text-white">{dataSourceConfig.calculation.period}</span>)
                              </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Período (Horas)</label>
                                  <div className="flex items-center gap-2">
                                      <input type="range" min="6" max="24" step="0.1" value={dataSourceConfig.calculation.period} onChange={e => updateDataSourceConfig({ calculation: {...dataSourceConfig.calculation, period: parseFloat(e.target.value)} })} className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500" />
                                      <span className="text-xs font-mono text-white w-10 text-right">{dataSourceConfig.calculation.period}h</span>
                                  </div>
                              </div>
                              <div>
                                  <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Amplitude (%)</label>
                                  <div className="flex items-center gap-2">
                                      <input type="range" min="0" max="50" step="1" value={dataSourceConfig.calculation.amplitude} onChange={e => updateDataSourceConfig({ calculation: {...dataSourceConfig.calculation, amplitude: parseFloat(e.target.value)} })} className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500" />
                                      <span className="text-xs font-mono text-white w-10 text-right">±{dataSourceConfig.calculation.amplitude}</span>
                                  </div>
                              </div>
                              <div>
                                  <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Fase (Offset Hora)</label>
                                  <div className="flex items-center gap-2">
                                      <input type="range" min="0" max="24" step="0.5" value={dataSourceConfig.calculation.phase} onChange={e => updateDataSourceConfig({ calculation: {...dataSourceConfig.calculation, phase: parseFloat(e.target.value)} })} className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500" />
                                      <span className="text-xs font-mono text-white w-10 text-right">+{dataSourceConfig.calculation.phase}h</span>
                                  </div>
                              </div>
                              <div>
                                  <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Nível Médio (%)</label>
                                  <div className="flex items-center gap-2">
                                      <input type="range" min="10" max="90" step="5" value={dataSourceConfig.calculation.offset} onChange={e => updateDataSourceConfig({ calculation: {...dataSourceConfig.calculation, offset: parseFloat(e.target.value)} })} className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500" />
                                      <span className="text-xs font-mono text-white w-10 text-right">{dataSourceConfig.calculation.offset}%</span>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}

                  {dataSourceConfig.activeSource === TideSourceType.MOCK && (
                      <div className="animate-in fade-in flex flex-col h-full">
                           <div className="bg-slate-900/50 p-2 rounded mb-3 border border-slate-700">
                               <label className="text-[10px] text-slate-500 uppercase font-bold block mb-2">Criar Novo Mock</label>
                               <div className="flex gap-2">
                                   <input type="text" value={newMockName} onChange={e=>setNewMockName(e.target.value)} placeholder="Nome do snapshot" className="flex-1 bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white"/>
                                   <button onClick={handleSaveMock} className="bg-green-600 hover:bg-green-500 text-white px-3 rounded text-xs font-bold flex items-center gap-2">
                                       <Save size={14}/> Salvar Estado Atual
                                   </button>
                               </div>
                           </div>
                           
                           <label className="text-[10px] text-slate-500 uppercase font-bold block mb-2">Mocks Salvos</label>
                           <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                               {savedMocks.map(mock => (
                                   <div key={mock.id} className="bg-slate-800 p-3 rounded border border-slate-700 flex justify-between items-center group hover:border-green-500/50 transition">
                                       <div onClick={() => { setKeyframes(mock.frames); setNotification('success', `Mock "${mock.name}" carregado!`); }} className="cursor-pointer flex-1">
                                           <div className="text-sm font-bold text-slate-200 group-hover:text-green-400 transition">{mock.name}</div>
                                           <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                               <span className="bg-slate-700 px-1 rounded">{mock.frames.length} pts</span>
                                               <span>{mock.description || 'Sem descrição'}</span>
                                            </div>
                                       </div>
                                       <div className="flex gap-2">
                                           <button onClick={() => { setKeyframes(mock.frames); setNotification('success', `Mock "${mock.name}" carregado!`); }} className="text-slate-400 hover:text-green-400 p-2 rounded hover:bg-slate-700 transition" title="Carregar">
                                               <FolderOpen size={16}/>
                                           </button>
                                           <button onClick={() => deleteMock(mock.id)} className="text-slate-400 hover:text-red-400 p-2 rounded hover:bg-slate-700 transition" title="Excluir">
                                               <Trash2 size={16}/>
                                           </button>
                                       </div>
                                   </div>
                               ))}
                               {savedMocks.length === 0 && (
                                   <div className="text-center py-8 text-slate-500 text-xs italic">Nenhum mock salvo.</div>
                               )}
                           </div>
                      </div>
                  )}
              </div>
          </div>

          {/* RIGHT: ENVIRONMENT CONTROLS (4 cols) */}
          <div className="lg:col-span-4 bg-slate-800 rounded-lg border border-slate-700 p-4 flex flex-col overflow-hidden">
               <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-700 pb-2 shrink-0">
                   <Sliders size={16} className="text-orange-400"/> Ambiente (Override)
              </h3>
              
              <div className="flex-1 overflow-y-auto space-y-5 px-1 custom-scrollbar">
                    <div>
                        <div className="flex justify-between mb-1">
                             <label className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1"><Thermometer size={12} className="text-orange-400"/> Temperatura</label>
                             <span className="text-xs font-mono text-white">{weatherData.temp}°C</span>
                        </div>
                        <input type="range" min="15" max="40" value={weatherData.temp} onChange={e => setWeatherData({temp: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500" />
                    </div>
                    <div>
                        <div className="flex justify-between mb-1">
                             <label className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1"><Droplets size={12} className="text-blue-400"/> Umidade</label>
                             <span className="text-xs font-mono text-white">{weatherData.humidity}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={weatherData.humidity} onChange={e => setWeatherData({humidity: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                    </div>
                    <div>
                        <div className="flex justify-between mb-1">
                             <label className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1"><Wind size={12} className="text-slate-300"/> Vento</label>
                             <span className="text-xs font-mono text-white">{weatherData.windSpeed} km/h</span>
                        </div>
                        <input type="range" min="0" max="100" value={weatherData.windSpeed} onChange={e => setWeatherData({windSpeed: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-400" />
                    </div>
                    <div>
                        <div className="flex justify-between mb-1">
                             <label className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1"><Sun size={12} className="text-yellow-400"/> UV Index</label>
                             <span className="text-xs font-mono text-white">{weatherData.uv}</span>
                        </div>
                        <input type="range" min="0" max="15" value={weatherData.uv} onChange={e => setWeatherData({uv: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-400" />
                    </div>
                    <div>
                        <div className="flex justify-between mb-1">
                             <label className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1"><Moon size={12} className="text-purple-400"/> Lua (%)</label>
                             <span className="text-xs font-mono text-white">{weatherData.moonIllumination}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={weatherData.moonIllumination} onChange={e => setWeatherData({moonIllumination: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                    </div>
              </div>

              {/* Debug Log Toggler */}
              {apiDebugLog && (
                 <div className="mt-4 pt-2 border-t border-slate-700 shrink-0">
                      <button 
                         onClick={copyLogToClipboard}
                         className="w-full text-[10px] text-slate-500 hover:text-white flex items-center justify-center gap-2 py-1 rounded hover:bg-slate-700 transition"
                      >
                          <Terminal size={12}/> Copiar Log API
                      </button>
                 </div>
              )}
          </div>
      </div>
    </div>
  );
};