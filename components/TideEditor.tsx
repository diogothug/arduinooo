
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { ConnectionType, ViewState } from '../types';
import { Play, Pause, RefreshCw, UploadCloud, Usb, Bluetooth, Wifi, CalendarClock } from 'lucide-react';
import { hardwareBridge } from '../services/hardwareBridge';
import { TideChart } from './tide/TideChart';
import { TideSourceConfig } from './tide/TideSourceConfig';
import { FirmwareCompiler } from './tide/FirmwareCompiler';

interface TideEditorProps {
    view?: ViewState;
}

export const TideEditor: React.FC<TideEditorProps> = ({ view = ViewState.DATA_TIDES }) => {
  const { 
    keyframes, simulatedTime, setSimulatedTime, activeDeviceId, devices, connectionType,
    updateFirmwareConfig, setNotification, dataSourceConfig
  } = useAppStore();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [useSevenDayMode, setUseSevenDayMode] = useState(false);
  const [isChartExpanded, setIsChartExpanded] = useState(false);
  
  const activeDevice = devices.find(d => d.id === activeDeviceId);
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

  const handleSyncToDevice = async () => {
    if (connectionType === ConnectionType.NONE) {
        setNotification('error', "Não conectado! Configure USB, BLE ou WiFi.");
        return;
    }
    setIsSyncing(true);
    try {
        updateFirmwareConfig({ cycleDuration: cycleLimit });
        const payload = {
            frames: keyframes, 
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

  const getSourceConfigMode = () => {
      if (view === ViewState.DATA_WEATHER) return 'CLIMA';
      if (view === ViewState.DATA_WAVES) return 'ONDAS';
      return 'MARE';
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. TOP TOOLBAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-800 p-3 rounded-lg border border-slate-700 gap-4 shadow-sm">
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

      {/* 2. CHART - Only show in Tides mode or if relevant */}
      {view === ViewState.DATA_TIDES && (
          <div className="w-full">
             <TideChart 
                 useSevenDayMode={useSevenDayMode} 
                 isExpanded={isChartExpanded} 
                 setIsExpanded={setIsChartExpanded} 
             />
          </div>
      )}

      {/* 3. GRID LAYOUT FOR CONFIG & COMPILER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
              <TideSourceConfig 
                  useSevenDayMode={useSevenDayMode}
                  setSimulatedTime={setSimulatedTime}
                  mode={getSourceConfigMode()}
              />
          </div>

          <div className="lg:col-span-1">
              <FirmwareCompiler />
          </div>
      </div>
    </div>
  );
};
