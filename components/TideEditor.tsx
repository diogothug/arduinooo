import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { ConnectionType, TideSourceType, MockWaveType, EffectType, Keyframe } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { Play, Pause, RefreshCw, UploadCloud, Usb, Bluetooth, Wifi, CalendarClock, Server, Activity, Database, MapPin, Search, AlertCircle, CheckCircle, Terminal, Clipboard, CloudSun, Thermometer, Wind, Droplets, Battery, Moon, Sliders, Sun, Globe, Calculator, Save, Trash2, FolderOpen, FunctionSquare, ArrowRight, Maximize2, Info } from 'lucide-react';
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
  const [isChartExpanded, setIsChartExpanded] = useState(false);

  const activeDevice = devices.find(d => d.id === activeDeviceId);
  const cycleLimit = useSevenDayMode ? 168 : 24;

  // Filter Data for Chart
  const chartData = useMemo(() => {
      let data = useSevenDayMode ? generateSevenDayForecast(keyframes) : keyframes;
      // CRITICAL: Slice data to prevent chart from breaking/flatlining if data exceeds domain
      if (useSevenDayMode) {
          data = data.filter(k => k.timeOffset <= 168);
      } else {
          data = data.filter(k => k.timeOffset <= 24);
      }
      return data;
  }, [keyframes, useSevenDayMode]);

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
          // If we are in 7 day mode, we request more data
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

  const handleSyncToDevice = async () => {
    if (connectionType === ConnectionType.NONE) {
        setNotification('error', "Não conectado! Configure USB, BLE ou WiFi.");
        return;
    }
    setIsSyncing(true);
    try {
        updateFirmwareConfig({ cycleDuration: cycleLimit });
        const payload = {
            frames: chartData, // Send filtered data
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
      
      {/* 1. TOP TOOLBAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-800 p-3 rounded-lg border border-slate-700 gap-4 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
           <button 
             onClick={() => setIsPlaying(!isPlaying)}
             className={`p-2 rounded-full ${isPlaying ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30' : 'bg-green-500/20 text-green-500 hover:bg-green-500/30'} transition`}
             title={isPlaying ? "Pausar Simulação" : "Iniciar Simulação"}
           >
             {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
           </button>
           
           <div className="flex flex-col">
               <span className="text-slate-300 font-bold text-xs">Status da Conexão</span>
               <span className={`text-[10px] flex items-center gap-1 font-mono ${connectionType !== ConnectionType.NONE ? 'text-green-400' : 'text-slate-500'}`}>
                   {connectionType === ConnectionType.USB && <><Usb size={10}/> USB Serial</>}
                   {connectionType === ConnectionType.BLE && <><Bluetooth size={10}/> Bluetooth</>}
                   {connectionType === ConnectionType.WIFI && <><Wifi size={10}/> WiFi: {activeDevice?.name || activeDevice?.ip}</>}
                   {connectionType === ConnectionType.NONE && 'Desconectado'}
               </span>
           </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <button
                onClick={() => { setUseSevenDayMode(!useSevenDayMode); setSimulatedTime(0); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition border ${
                    useSevenDayMode 
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300' 
                    : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200'
                }`}
            >
                <CalendarClock size={14} />
                {useSevenDayMode ? '7 Dias' : '24 Horas'}
            </button>

            <button 
                onClick={handleSyncToDevice}
                disabled={isSyncing || connectionType === ConnectionType.NONE}
                className={`flex items-center gap-2 px-4 py-1.5 rounded text-xs transition font-bold shadow-lg ${
                    connectionType !== ConnectionType.NONE
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-900/20' 
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
            >
                {isSyncing ? <RefreshCw className="animate-spin" size={14} /> : <UploadCloud size={14} />}
                {isSyncing ? 'Enviando...' : 'Enviar'}
            </button>
        </div>
      </div>

      {/* 2. CHART VISUALIZATION */}
      <div className={`shrink-0 ${isChartExpanded ? 'fixed inset-4 z-50 bg-slate-900 border-slate-600' : 'h-72 bg-slate-800'} rounded-lg border border-slate-700 p-1 relative flex flex-col shadow-inner transition-all duration-300`}>
        <div className="absolute top-2 left-4 z-10 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700 backdrop-blur-sm flex gap-2">
            <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <Activity size={10} className="text-cyan-400"/>
                {useSevenDayMode ? 'Previsão Semanal' : 'Ciclo Diário'}
            </h4>
        </div>
        <div className="absolute top-2 right-4 z-10 flex gap-2">
             <div className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700 backdrop-blur-sm text-[10px] font-mono text-cyan-400">
                T+{simulatedTime.toFixed(1)}h
            </div>
            <button onClick={()=>setIsChartExpanded(!isChartExpanded)} className="bg-slate-900/80 p-1 rounded border border-slate-700 hover:text-white text-slate-400 transition">
                <Maximize2 size={12}/>
            </button>
        </div>

        <div className="flex-1 w-full mt-6">
            <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{top: 10, right: 10, left: -25, bottom: 0}}>
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
                    allowDataOverflow={true} 
                    stroke="#64748b" 
                    fontSize={9}
                    tickFormatter={(val) => `${val}h`}
                    ticks={useSevenDayMode ? [0, 24, 48, 72, 96, 120, 144, 168] : [0, 6, 12, 18, 24]}
                />
                <YAxis domain={[0, 100]} stroke="#64748b" fontSize={9} unit="%" />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px', fontSize: '11px' }}
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
                <ReferenceDot x={simulatedTime} y={chartData.length > 0 ? (chartData.find(k=>Math.abs(k.timeOffset - simulatedTime) < 1)?.height || 50) : 50} r={4} fill="#f59e0b" stroke="#fff" strokeWidth={1} />
            </AreaChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* 3. MAIN EDITOR GRID */}
      {/* flex-1 min-h-0 ensures this container fills remaining height but allows children to scroll internally */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-3 gap-4">
          
          {/* LEFT: SOURCE CONFIGURATION (2 cols on large) */}
          <div className="xl:col-span-2 bg-slate-800 rounded-lg border border-slate-700 flex flex-col min-h-0">
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

              {/* CONFIG PANEL - SCROLLABLE CONTENT */}
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
                                      A Tábua de Marés do Brasil fornece dados precisos. Ao ativar o modo "7 Dias" no topo, o sistema buscará automaticamente a previsão completa da semana.
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
                                    {isGeneratingSource ? 'Buscando...' : 'Buscar Dados Tábua'}
                                </button>
                                <button 
                                    onClick={handleSaveMock}
                                    className="px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded border border-slate-600 flex items-center justify-center transition"
                                    title="Salvar resultado como Mock"
                                >
                                    <Save size={16}/>
                                </button>
                              </div>
                          </div>
                      </div>
                  )}

                  {dataSourceConfig.activeSource === TideSourceType.API && (
                      <div className="space-y-4 animate-in fade-in max-w-lg">
                           <div>
                               <label className="text-[9px] text-slate-500 uppercase font-bold">Local ID (Lat,Long ou Nome)</label>
                               <input type="text" value={dataSourceConfig.api.locationId} onChange={(e) => updateDataSourceConfig({ api: {...dataSourceConfig.api, locationId: e.target.value} })} className="w-full mt-1 bg-slate-800 border border-slate-600 rounded p-2.5 text-xs text-white focus:border-cyan-500 outline-none"/>
                               <p className="text-[10px] text-slate-500 mt-1">Ex: -13.613295,-38.908930 (Moreré)</p>
                           </div>
                           
                           <div className="bg-slate-800 p-3 rounded border border-slate-700">
                               <div className="flex items-center gap-2 mb-2">
                                   <div className={`w-2 h-2 rounded-full ${weatherData.forecast.length > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                   <span className="text-xs font-bold text-slate-300">Status WeatherAPI</span>
                               </div>
                               <div className="text-[10px] text-slate-400 font-mono">
                                   {weatherData.forecast.length > 0 ? 'Dados de Clima OK' : 'Sem dados recentes'}
                               </div>
                           </div>

                           <div className="flex gap-2 pt-2">
                                <button 
                                        onClick={handleSourceGenerate}
                                        disabled={isGeneratingSource}
                                        className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 rounded text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-cyan-900/20"
                                    >
                                        {isGeneratingSource ? <RefreshCw className="animate-spin" size={12} /> : <Server size={14} />} 
                                        {isGeneratingSource ? 'Conectando...' : 'Buscar Dados API'}
                                </button>
                                <button 
                                    onClick={handleSaveMock}
                                    className="px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded border border-slate-600 flex items-center justify-center transition"
                                    title="Salvar resultado como Mock"
                                >
                                    <Save size={16}/>
                                </button>
                            </div>
                      </div>
                  )}

                  {dataSourceConfig.activeSource === TideSourceType.CALCULATED && (
                      <div className="animate-in fade-in flex flex-col gap-6">
                          {/* VISUAL FORMULA */}
                          <div className="bg-black/50 p-4 rounded-lg border border-slate-700 font-mono text-center flex flex-col items-center justify-center gap-2">
                              <div className="text-[9px] text-slate-500 uppercase tracking-widest">Matemática de Cálculo</div>
                              <div className="text-sm md:text-base text-pink-400 break-words w-full px-2 leading-loose">
                                  y(t) = <span className="text-white font-bold">{dataSourceConfig.calculation.offset}</span> + <span className="text-white font-bold">{dataSourceConfig.calculation.amplitude}</span>·sin(
                                  <span className="text-cyan-400">2π</span>·(t + <span className="text-white font-bold">{dataSourceConfig.calculation.phase}</span>)/<span className="text-white font-bold">{dataSourceConfig.calculation.period}</span>)
                              </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="bg-slate-800 p-3 rounded border border-slate-700">
                                  <label className="text-[9px] text-slate-500 uppercase font-bold block mb-2">Período (Horas)</label>
                                  <div className="flex items-center gap-3">
                                      <input type="range" min="6" max="24" step="0.1" value={dataSourceConfig.calculation.period} onChange={e => updateDataSourceConfig({ calculation: {...dataSourceConfig.calculation, period: parseFloat(e.target.value)} })} className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500" />
                                      <span className="text-xs font-mono text-white w-12 text-right bg-slate-900 px-1 py-0.5 rounded">{dataSourceConfig.calculation.period}h</span>
                                  </div>
                              </div>
                              <div className="bg-slate-800 p-3 rounded border border-slate-700">
                                  <label className="text-[9px] text-slate-500 uppercase font-bold block mb-2">Amplitude (%)</label>
                                  <div className="flex items-center gap-3">
                                      <input type="range" min="0" max="50" step="1" value={dataSourceConfig.calculation.amplitude} onChange={e => updateDataSourceConfig({ calculation: {...dataSourceConfig.calculation, amplitude: parseFloat(e.target.value)} })} className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500" />
                                      <span className="text-xs font-mono text-white w-12 text-right bg-slate-900 px-1 py-0.5 rounded">±{dataSourceConfig.calculation.amplitude}</span>
                                  </div>
                              </div>
                              <div className="bg-slate-800 p-3 rounded border border-slate-700">
                                  <label className="text-[9px] text-slate-500 uppercase font-bold block mb-2">Fase (Offset Hora)</label>
                                  <div className="flex items-center gap-3">
                                      <input type="range" min="0" max="24" step="0.5" value={dataSourceConfig.calculation.phase} onChange={e => updateDataSourceConfig({ calculation: {...dataSourceConfig.calculation, phase: parseFloat(e.target.value)} })} className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500" />
                                      <span className="text-xs font-mono text-white w-12 text-right bg-slate-900 px-1 py-0.5 rounded">+{dataSourceConfig.calculation.phase}h</span>
                                  </div>
                              </div>
                              <div className="bg-slate-800 p-3 rounded border border-slate-700">
                                  <label className="text-[9px] text-slate-500 uppercase font-bold block mb-2">Nível Médio (%)</label>
                                  <div className="flex items-center gap-3">
                                      <input type="range" min="10" max="90" step="5" value={dataSourceConfig.calculation.offset} onChange={e => updateDataSourceConfig({ calculation: {...dataSourceConfig.calculation, offset: parseFloat(e.target.value)} })} className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500" />
                                      <span className="text-xs font-mono text-white w-12 text-right bg-slate-900 px-1 py-0.5 rounded">{dataSourceConfig.calculation.offset}%</span>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}

                  {dataSourceConfig.activeSource === TideSourceType.MOCK && (
                      <div className="animate-in fade-in flex flex-col gap-4">
                           <div className="bg-slate-900 p-4 rounded border border-slate-700">
                               <label className="text-[9px] text-slate-500 uppercase font-bold block mb-2">Criar Novo Snapshot</label>
                               <div className="flex gap-2">
                                   <input type="text" value={newMockName} onChange={e=>setNewMockName(e.target.value)} placeholder="Nome do snapshot..." className="flex-1 bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white focus:border-green-500 outline-none"/>
                                   <button onClick={handleSaveMock} className="bg-green-600 hover:bg-green-500 text-white px-4 rounded text-xs font-bold flex items-center gap-2">
                                       <Save size={14}/> Salvar Atual
                                   </button>
                               </div>
                           </div>
                           
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                               {savedMocks.map(mock => (
                                   <div key={mock.id} className="bg-slate-800 p-3 rounded border border-slate-700 flex justify-between items-center group hover:border-green-500/50 transition">
                                       <div onClick={() => { setKeyframes(mock.frames); setNotification('success', `Mock "${mock.name}" carregado!`); }} className="cursor-pointer flex-1 min-w-0 pr-2">
                                           <div className="text-sm font-bold text-slate-200 group-hover:text-green-400 transition truncate">{mock.name}</div>
                                           <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-1">
                                               <span className="bg-slate-700 px-1.5 py-0.5 rounded whitespace-nowrap">{mock.frames.length} pts</span>
                                               <span className="truncate opacity-70">{mock.description || 'Sem descrição'}</span>
                                            </div>
                                       </div>
                                       <div className="flex gap-1 shrink-0">
                                           <button onClick={() => { setKeyframes(mock.frames); setNotification('success', `Mock "${mock.name}" carregado!`); }} className="text-slate-400 hover:text-green-400 p-2 rounded hover:bg-slate-700 transition" title="Carregar">
                                               <FolderOpen size={16}/>
                                           </button>
                                           <button onClick={() => deleteMock(mock.id)} className="text-slate-400 hover:text-red-400 p-2 rounded hover:bg-slate-700 transition" title="Excluir">
                                               <Trash2 size={16}/>
                                           </button>
                                       </div>
                                   </div>
                               ))}
                           </div>
                      </div>
                  )}
              </div>
          </div>

          {/* RIGHT: ENVIRONMENT CONTROLS (1 col on large) */}
          <div className="xl:col-span-1 bg-slate-800 rounded-lg border border-slate-700 flex flex-col min-h-0">
               <div className="p-4 border-b border-slate-700 shrink-0">
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                        <Sliders size={14} className="text-orange-400"/> Sensores & Ambiente
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
    </div>
  );
};