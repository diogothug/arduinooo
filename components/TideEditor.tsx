import React, { useState } from 'react';
import { useAppStore } from '../store';
import { EffectType, Keyframe, ConnectionType, TideSourceType, MockWaveType } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { Wand2, Play, Pause, Trash2, Plus, RefreshCw, UploadCloud, Usb, Bluetooth, Wifi, CalendarClock, Zap, Server, Activity, Calculator, Database, MapPin, Search, AlertCircle, CheckCircle, Terminal, Clipboard, CloudSun, Thermometer, Wind, Droplets, Battery, Moon, Sliders, Sun } from 'lucide-react';
import { generateTideCurveWithAI } from '../services/geminiService';
import { hardwareBridge } from '../services/hardwareBridge';
import { generateSevenDayForecast } from '../utils/tideLogic';
import { tideSourceService } from '../services/tideSourceService';

export const TideEditor: React.FC = () => {
  const { 
    keyframes, setKeyframes, addKeyframe, removeKeyframe, updateKeyframe, 
    simulatedTime, setSimulatedTime, activeDeviceId, devices, connectionType,
    firmwareConfig, updateFirmwareConfig, dataSourceConfig, updateDataSourceConfig,
    setNotification, apiDebugLog, setWeatherData, setApiStatus, weatherData
  } = useAppStore();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedKeyframe, setSelectedKeyframe] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [useSevenDayMode, setUseSevenDayMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'DRAW' | 'SOURCE'>('DRAW');
  const [isGeneratingSource, setIsGeneratingSource] = useState(false);
  const [isCheckingPort, setIsCheckingPort] = useState(false);

  const activeDevice = devices.find(d => d.id === activeDeviceId);
  const activeData = useSevenDayMode ? generateSevenDayForecast(keyframes) : keyframes;
  const cycleLimit = useSevenDayMode ? 168 : 24;

  React.useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setSimulatedTime((simulatedTime + 0.1) % cycleLimit);
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isPlaying, simulatedTime, setSimulatedTime, cycleLimit]);

  const handleAiGenerate = async () => {
    setIsAiLoading(true);
    try {
       const newFrames = await generateTideCurveWithAI(aiPrompt);
       if(newFrames.length > 0) {
         setKeyframes(newFrames);
         setSimulatedTime(0);
         setNotification('success', 'Curva gerada com IA com sucesso!');
       }
    } catch(e) {
      setNotification('error', "Falha na geração IA (Verifique a API Key)");
    } finally {
      setIsAiLoading(false);
    }
  };
  
  const handleSourceGenerate = async () => {
      setIsGeneratingSource(true);
      setApiStatus(true, null);
      try {
          const { frames, sourceUsed, weather } = await tideSourceService.getTideData(dataSourceConfig, cycleLimit);
          setKeyframes(frames);
          setSimulatedTime(0);
          
          if (weather) {
              setWeatherData(weather);
              setNotification('success', `Dados gerados: ${frames.length} pontos + Clima Atualizado`);
          } else {
              setNotification('success', `Dados de maré gerados via: ${sourceUsed}`);
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
        await hardwareBridge.sendData(
          useSevenDayMode ? activeData : keyframes, 
          connectionType, 
          activeDevice?.ip
        );
        setNotification('success', `Sincronizado: ${useSevenDayMode ? '7 Dias' : '24h'} via ${connectionType}`);
    } catch (error: any) {
        console.error(error);
        setNotification('error', `Falha no Sync: ${error.message}`);
    } finally {
        setIsSyncing(false);
    }
  };

  const copyLogToClipboard = () => {
    if (apiDebugLog) {
        navigator.clipboard.writeText(apiDebugLog);
        setNotification('success', "Log copiado para a área de transferência!");
    }
  };

  const activeKeyframe = keyframes.find(k => k.id === selectedKeyframe);

  return (
    <div className="flex flex-col h-full gap-6">
      
      {/* Top Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-800 p-4 rounded-lg border border-slate-700 gap-4">
        <div className="flex items-center gap-4">
           <button 
             onClick={() => setIsPlaying(!isPlaying)}
             className={`p-2 rounded-full ${isPlaying ? 'bg-amber-500/20 text-amber-500' : 'bg-green-500/20 text-green-500'} hover:opacity-80 transition`}
           >
             {isPlaying ? <Pause size={20} /> : <Play size={20} />}
           </button>
           
           <div className="flex flex-col">
               <span className="text-slate-300 font-medium text-sm">Conexão Ativa</span>
               <span className={`text-xs flex items-center gap-1 ${connectionType !== ConnectionType.NONE ? 'text-green-400' : 'text-slate-500'}`}>
                   {connectionType === ConnectionType.USB && <><Usb size={12}/> USB Serial</>}
                   {connectionType === ConnectionType.BLE && <><Bluetooth size={12}/> Bluetooth</>}
                   {connectionType === ConnectionType.WIFI && <><Wifi size={12}/> WiFi: {activeDevice?.name || activeDevice?.ip}</>}
                   {connectionType === ConnectionType.NONE && 'Desconectado'}
               </span>
           </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
                onClick={() => { setUseSevenDayMode(!useSevenDayMode); setSimulatedTime(0); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition border ${
                    useSevenDayMode 
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300' 
                    : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200'
                }`}
            >
                <CalendarClock size={14} />
                {useSevenDayMode ? 'Offline 7 Dias' : 'Ciclo 24h'}
            </button>

            <button 
                onClick={handleSyncToDevice}
                disabled={isSyncing || connectionType === ConnectionType.NONE}
                className={`flex items-center gap-2 px-4 py-1.5 rounded text-sm transition font-medium ${
                    connectionType !== ConnectionType.NONE
                    ? 'bg-cyan-600 hover:bg-cyan-700 text-white' 
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
            >
                {isSyncing ? <RefreshCw className="animate-spin" size={16} /> : <UploadCloud size={16} />}
                {isSyncing ? 'Enviando...' : 'Sincronizar'}
            </button>
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 bg-slate-800 rounded-lg border border-slate-700 p-4 min-h-[300px] relative flex flex-col">
        <div className="flex justify-between items-center mb-2 px-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {useSevenDayMode ? 'Previsão 7 Dias (Offline)' : 'Ciclo de Maré 24h'}
            </h4>
            <span className="text-xs font-mono text-cyan-400">
                T+{simulatedTime.toFixed(1)}h / {cycleLimit}h
            </span>
        </div>
        <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activeData}>
                <defs>
                <linearGradient id="colorHeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                    dataKey="timeOffset" 
                    type="number" 
                    domain={[0, cycleLimit]} 
                    stroke="#94a3b8" 
                    unit="h" 
                    ticks={useSevenDayMode ? [0, 24, 48, 72, 96, 120, 144, 168] : [0, 6, 12, 18, 24]}
                />
                <YAxis domain={[0, 100]} stroke="#94a3b8" unit="%" />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                    itemStyle={{ color: '#38bdf8' }}
                />
                <Area 
                    type="monotone" 
                    dataKey="height" 
                    stroke="#0ea5e9" 
                    fillOpacity={1} 
                    fill="url(#colorHeight)" 
                    strokeWidth={useSevenDayMode ? 1 : 3}
                    isAnimationActive={false}
                />
                <ReferenceDot x={simulatedTime} y={50} r={4} fill="#f59e0b" stroke="none" />
            </AreaChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* TABS */}
      <div className="flex border-b border-slate-700 px-4">
          <button onClick={() => setActiveTab('DRAW')} className={`pb-2 px-4 text-sm font-medium ${activeTab === 'DRAW' ? 'border-b-2 border-cyan-500 text-white' : 'text-slate-400'}`}>
              Editor Manual
          </button>
          <button onClick={() => setActiveTab('SOURCE')} className={`pb-2 px-4 text-sm font-medium ${activeTab === 'SOURCE' ? 'border-b-2 border-purple-500 text-white' : 'text-slate-400'}`}>
              Fonte de Dados & Clima
          </button>
      </div>

      {/* EDITOR TAB */}
      {activeTab === 'DRAW' && !useSevenDayMode && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 animate-in fade-in">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Pontos de Controle</h3>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="Gerar com IA..." 
                        className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white w-32"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                    />
                    <button onClick={handleAiGenerate} disabled={isAiLoading} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs">
                        <Wand2 size={12} />
                    </button>
                    <button 
                        onClick={() => addKeyframe({ id: Math.random().toString(), timeOffset: simulatedTime, height: 50, color: '#ffffff', intensity: 100, effect: EffectType.STATIC })}
                        className="flex items-center gap-1 text-xs bg-cyan-600 hover:bg-cyan-700 text-white px-2 py-1 rounded"
                    >
                        <Plus size={14} /> Novo
                    </button>
                </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2">
                {keyframes.map((kf, idx) => (
                    <div 
                        key={kf.id}
                        onClick={() => setSelectedKeyframe(kf.id)}
                        className={`min-w-[100px] p-2 rounded cursor-pointer border-2 transition ${selectedKeyframe === kf.id ? 'border-cyan-500 bg-slate-700' : 'border-slate-600 bg-slate-900'}`}
                    >
                        <div className="text-xs text-slate-400">Ponto {idx + 1}</div>
                        <div className="font-mono text-sm text-white">{kf.timeOffset.toFixed(1)}h</div>
                        <div className="h-1.5 w-full rounded-full mt-1" style={{ backgroundColor: kf.color }}></div>
                    </div>
                ))}
            </div>

            {activeKeyframe && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t border-slate-700">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Hora</label>
                        <input type="number" value={activeKeyframe.timeOffset} min={0} max={24} step={0.1} onChange={(e) => updateKeyframe(activeKeyframe.id, { timeOffset: parseFloat(e.target.value) })} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white" />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Altura (%)</label>
                        <input type="number" value={activeKeyframe.height} min={0} max={100} onChange={(e) => updateKeyframe(activeKeyframe.id, { height: parseFloat(e.target.value) })} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white" />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Cor</label>
                        <div className="flex gap-2">
                            <input type="color" value={activeKeyframe.color} onChange={(e) => updateKeyframe(activeKeyframe.id, { color: e.target.value })} className="h-8 w-8 rounded cursor-pointer bg-transparent" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">Efeito</label>
                        <select value={activeKeyframe.effect} onChange={(e) => updateKeyframe(activeKeyframe.id, { effect: e.target.value as EffectType })} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white">
                            {Object.values(EffectType).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button onClick={() => { removeKeyframe(activeKeyframe.id); setSelectedKeyframe(null); }} className="flex items-center justify-center gap-2 w-full bg-red-900/30 text-red-400 border border-red-900 hover:bg-red-900/50 px-3 py-1.5 rounded text-sm transition">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
      )}

      {/* SOURCE & SIMULATION TAB */}
      {activeTab === 'SOURCE' && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 animate-in fade-in">
           <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
               <Database size={20} className="text-purple-400" /> Configuração Central de Dados
           </h3>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               
               {/* 1. API Config */}
               <div className={`p-4 rounded-lg border transition-all ${dataSourceConfig.activeSource === TideSourceType.API ? 'border-cyan-500 bg-cyan-900/10' : 'border-slate-600 bg-slate-900/50'}`}>
                   <div className="flex items-center gap-2 mb-3">
                       <input 
                         type="radio" 
                         checked={dataSourceConfig.activeSource === TideSourceType.API}
                         onChange={() => updateDataSourceConfig({ activeSource: TideSourceType.API })}
                       />
                       <Server size={16} className="text-cyan-400"/>
                       <span className="font-bold text-sm">1. WeatherAPI (Global)</span>
                   </div>
                   <div className="space-y-3 opacity-90">
                       <div>
                           <label className="text-xs text-slate-500 block mb-1">URL da API</label>
                           <input type="text" value={dataSourceConfig.api.url} onChange={(e) => updateDataSourceConfig({ api: {...dataSourceConfig.api, url: e.target.value} })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-slate-300"/>
                       </div>
                       <div>
                           <label className="text-xs text-slate-500 block mb-1">Token / Key</label>
                           <input type="password" value={dataSourceConfig.api.token} onChange={(e) => updateDataSourceConfig({ api: {...dataSourceConfig.api, token: e.target.value} })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-slate-300"/>
                       </div>
                       <div>
                           <label className="text-xs text-slate-500 block mb-1">Localidade ID</label>
                           <input type="text" value={dataSourceConfig.api.locationId} onChange={(e) => updateDataSourceConfig({ api: {...dataSourceConfig.api, locationId: e.target.value} })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-slate-300"/>
                       </div>
                   </div>
               </div>

                {/* 2. Tabua Mare Config */}
               <div className={`p-4 rounded-lg border transition-all ${dataSourceConfig.activeSource === TideSourceType.TABUA_MARE ? 'border-yellow-500 bg-yellow-900/10' : 'border-slate-600 bg-slate-900/50'}`}>
                   <div className="flex items-center gap-2 mb-3">
                       <input 
                         type="radio" 
                         checked={dataSourceConfig.activeSource === TideSourceType.TABUA_MARE}
                         onChange={() => updateDataSourceConfig({ activeSource: TideSourceType.TABUA_MARE })}
                       />
                       <MapPin size={16} className="text-yellow-400"/>
                       <span className="font-bold text-sm">2. Tábua Maré (Brasil)</span>
                   </div>
                   <p className="text-[10px] text-slate-400 mb-3 leading-tight">
                       API direta via navegador (Client-side Fetch).
                   </p>
                   <div className="space-y-3 opacity-90">
                       <div className="flex gap-2">
                           <div className="flex-1">
                               <label className="text-xs text-slate-500 block mb-1">ID do Porto (Ex: 8)</label>
                               <input type="number" placeholder="Ex: 8" value={dataSourceConfig.tabuaMare.harborId || ''} onChange={(e) => updateDataSourceConfig({ tabuaMare: {...dataSourceConfig.tabuaMare, harborId: parseInt(e.target.value) || null} })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-slate-300"/>
                           </div>
                       </div>
                       <div className="flex gap-2 items-end">
                           <div className="flex-1">
                               <label className="text-xs text-slate-500 block mb-1">Estado (UF)</label>
                               <input type="text" value={dataSourceConfig.tabuaMare.uf} onChange={(e) => updateDataSourceConfig({ tabuaMare: {...dataSourceConfig.tabuaMare, uf: e.target.value} })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-slate-300 uppercase" maxLength={2}/>
                           </div>
                           <button 
                                onClick={handleCheckPort}
                                disabled={isCheckingPort}
                                className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded text-xs border border-slate-600 h-[26px] flex items-center gap-2"
                           >
                               {isCheckingPort ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Search size={12}/>}
                               Verificar
                           </button>
                       </div>
                       
                       {dataSourceConfig.tabuaMare.lastFoundHarbor && (
                           <div className={`text-[10px] p-2 rounded border flex items-start gap-2 ${dataSourceConfig.tabuaMare.lastFoundHarbor.startsWith("Erro") ? 'bg-red-900/20 border-red-900/30 text-red-300' : 'bg-green-900/20 border-green-900/30 text-green-400'}`}>
                               {dataSourceConfig.tabuaMare.lastFoundHarbor.startsWith("Erro") ? <AlertCircle size={14} className="shrink-0 mt-0.5"/> : <CheckCircle size={14} className="shrink-0 mt-0.5"/>}
                               <span>{dataSourceConfig.tabuaMare.lastFoundHarbor}</span>
                           </div>
                       )}

                       <div className="flex gap-2">
                           <div className="flex-1">
                               <label className="text-xs text-slate-500 block mb-1">Latitude</label>
                               <input type="number" value={dataSourceConfig.tabuaMare.lat} onChange={(e) => updateDataSourceConfig({ tabuaMare: {...dataSourceConfig.tabuaMare, lat: parseFloat(e.target.value)} })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-slate-300"/>
                           </div>
                           <div className="flex-1">
                               <label className="text-xs text-slate-500 block mb-1">Longitude</label>
                               <input type="number" value={dataSourceConfig.tabuaMare.lng} onChange={(e) => updateDataSourceConfig({ tabuaMare: {...dataSourceConfig.tabuaMare, lng: parseFloat(e.target.value)} })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-slate-300"/>
                           </div>
                       </div>
                   </div>
               </div>

               {/* 3. Mock Config */}
               <div className={`p-4 rounded-lg border transition-all ${dataSourceConfig.activeSource === TideSourceType.MOCK ? 'border-green-500 bg-green-900/10' : 'border-slate-600 bg-slate-900/50'}`}>
                   <div className="flex items-center gap-2 mb-3">
                       <input 
                         type="radio" 
                         checked={dataSourceConfig.activeSource === TideSourceType.MOCK}
                         onChange={() => updateDataSourceConfig({ activeSource: TideSourceType.MOCK })}
                       />
                       <Activity size={16} className="text-green-400"/>
                       <span className="font-bold text-sm">3. Mock (Simulação)</span>
                   </div>
                   <div className="space-y-3 opacity-90">
                       <div className="flex gap-2">
                           <div className="flex-1">
                               <label className="text-xs text-slate-500 block mb-1">Mín (%)</label>
                               <input type="number" value={dataSourceConfig.mock.minHeight} onChange={(e) => updateDataSourceConfig({ mock: {...dataSourceConfig.mock, minHeight: parseInt(e.target.value)} })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-slate-300"/>
                           </div>
                           <div className="flex-1">
                               <label className="text-xs text-slate-500 block mb-1">Máx (%)</label>
                               <input type="number" value={dataSourceConfig.mock.maxHeight} onChange={(e) => updateDataSourceConfig({ mock: {...dataSourceConfig.mock, maxHeight: parseInt(e.target.value)} })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-slate-300"/>
                           </div>
                       </div>
                       <div>
                           <label className="text-xs text-slate-500 block mb-1">Período (Horas)</label>
                           <input type="number" step="0.1" value={dataSourceConfig.mock.periodHours} onChange={(e) => updateDataSourceConfig({ mock: {...dataSourceConfig.mock, periodHours: parseFloat(e.target.value)} })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-slate-300"/>
                       </div>
                       <div>
                           <label className="text-xs text-slate-500 block mb-1">Tipo de Onda</label>
                           <select value={dataSourceConfig.mock.waveType} onChange={(e) => updateDataSourceConfig({ mock: {...dataSourceConfig.mock, waveType: e.target.value as MockWaveType} })} className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-slate-300">
                               <option value={MockWaveType.SINE}>Senoidal (Suave)</option>
                               <option value={MockWaveType.TRIANGLE}>Triangular (Linear)</option>
                               <option value={MockWaveType.STEP}>Degrau (Abrupto)</option>
                           </select>
                       </div>
                   </div>
               </div>

                {/* 4. Manual Weather Controls (Centralized) */}
               <div className={`p-4 rounded-lg border border-slate-600 bg-slate-900/50 md:col-span-2 lg:col-span-3`}>
                   <div className="flex items-center justify-between mb-3">
                       <div className="flex items-center gap-2">
                           <Sliders size={16} className="text-orange-400"/>
                           <span className="font-bold text-sm">Controles de Clima & Ambiente (Global)</span>
                       </div>
                       <span className="text-[9px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">Tempo Real</span>
                   </div>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-[10px] text-slate-500 block mb-1 flex items-center gap-1"><Thermometer size={10} className="text-orange-400"/> Temp ({weatherData.temp}°C)</label>
                            <input type="range" min="15" max="40" value={weatherData.temp} onChange={e => setWeatherData({temp: parseInt(e.target.value)})} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 block mb-1 flex items-center gap-1"><Droplets size={10} className="text-blue-400"/> Umidade ({weatherData.humidity}%)</label>
                            <input type="range" min="0" max="100" value={weatherData.humidity} onChange={e => setWeatherData({humidity: parseInt(e.target.value)})} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 block mb-1 flex items-center gap-1"><Wind size={10} className="text-slate-300"/> Vento ({weatherData.windSpeed} km/h)</label>
                            <input type="range" min="0" max="100" value={weatherData.windSpeed} onChange={e => setWeatherData({windSpeed: parseInt(e.target.value)})} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 block mb-1">Dir Vento ({weatherData.windDir}°)</label>
                            <input type="range" min="0" max="360" value={weatherData.windDir} onChange={e => setWeatherData({windDir: parseInt(e.target.value)})} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                        </div>
                         <div>
                            <label className="text-[10px] text-slate-500 block mb-1 flex items-center gap-1"><Battery size={10} className="text-green-400"/> Bateria ({weatherData.battery}%)</label>
                            <input type="range" min="0" max="100" value={weatherData.battery} onChange={e => setWeatherData({battery: parseInt(e.target.value)})} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 block mb-1 flex items-center gap-1"><Moon size={10} className="text-purple-400"/> Ilum. Lua ({weatherData.moonIllumination}%)</label>
                            <input type="range" min="0" max="100" value={weatherData.moonIllumination} onChange={e => setWeatherData({moonIllumination: parseInt(e.target.value)})} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 block mb-1 flex items-center gap-1"><Sun size={10} className="text-yellow-400"/> UV ({weatherData.uv})</label>
                            <input type="range" min="0" max="15" value={weatherData.uv} onChange={e => setWeatherData({uv: parseInt(e.target.value)})} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 block mb-1 flex items-center gap-1"><CloudSun size={10} className="text-slate-400"/> Nuvens ({weatherData.cloud}%)</label>
                            <input type="range" min="0" max="100" value={weatherData.cloud} onChange={e => setWeatherData({cloud: parseInt(e.target.value)})} className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                        </div>
                   </div>
               </div>

               {/* Action Area */}
               <div className="md:col-span-2 lg:col-span-3 mt-4">
                    <button 
                        onClick={handleSourceGenerate}
                        disabled={isGeneratingSource}
                        className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold flex flex-col items-center justify-center gap-1 transition shadow-lg shadow-purple-900/50"
                    >
                        {isGeneratingSource ? (
                            <RefreshCw className="animate-spin mb-1" size={24} />
                        ) : (
                            <Database size={24} className="mb-1" />
                        )}
                        <span>{isGeneratingSource ? 'Processando...' : 'Atualizar Dados (API/Maré)'}</span>
                        <span className="text-[10px] font-normal opacity-70">
                            Busca dados da fonte selecionada e atualiza todos os módulos
                        </span>
                    </button>
               </div>
               
               {/* Debug Log */}
               {apiDebugLog && (
                   <div className="md:col-span-2 lg:col-span-3 mt-6 border-t border-slate-700 pt-4">
                       <div className="flex justify-between items-center mb-2">
                            <h4 className="text-xs font-bold text-slate-400 flex items-center gap-2">
                                <Terminal size={14} /> Log de Resposta da API
                            </h4>
                            <button 
                                onClick={copyLogToClipboard}
                                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 transition"
                            >
                                <Clipboard size={10} /> Copiar
                            </button>
                       </div>
                       <div className="bg-slate-950 p-3 rounded border border-slate-700 max-h-48 overflow-auto custom-scrollbar shadow-inner">
                           <pre className="text-[10px] text-green-400 font-mono whitespace-pre-wrap break-all">
                               {apiDebugLog}
                           </pre>
                       </div>
                   </div>
               )}

           </div>
        </div>
      )}

      {useSevenDayMode && activeTab === 'DRAW' && (
          <div className="bg-slate-900/50 border border-dashed border-slate-700 rounded-lg p-6 flex flex-col items-center justify-center text-center">
              <Zap className="text-purple-400 mb-2" size={32} />
              <h3 className="text-lg font-bold text-white">Modo 7 Dias Ativo</h3>
              <p className="text-slate-400 max-w-md mt-2 text-sm">
                  Visualização somente leitura. Para editar, use o "Editor Manual" em 24h ou configure a "Fonte de Dados" para gerar uma semana completa.
              </p>
          </div>
      )}
    </div>
  );
};