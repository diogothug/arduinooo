
import React, { useState, useEffect } from 'react';
import { useAppStore } from './store';
import { ViewState, ConnectionType, TideSourceType } from './types';
import { TideEditor } from './components/TideEditor';
import { LedSimulator } from './components/LedSimulator';
import { FirmwareBuilder } from './components/FirmwareBuilder';
import { DisplayEditor } from './components/DisplayEditor';
import { LedMaster } from './components/LedMaster';
import { ConnectionManager } from './components/ConnectionManager';
import { Esp32Tools } from './components/Esp32Tools';
import { LayoutDashboard, Waves, Cpu, Settings, Activity, Monitor, Link2, Wifi, Usb, Bluetooth, AlertCircle, CheckCircle, Info, X, Lightbulb, Database, Shield, ChevronDown, ChevronRight, Calculator, Globe, MapPin, Thermometer, Clock, Anchor, CloudSun } from 'lucide-react';

const NotificationToast = () => {
    const { notification, clearNotification } = useAppStore();
    
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(clearNotification, 5000);
            return () => clearTimeout(timer);
        }
    }, [notification, clearNotification]);

    if (!notification) return null;

    const bgColor = notification.type === 'success' ? 'bg-green-600' : notification.type === 'error' ? 'bg-red-600' : 'bg-cyan-600';
    const Icon = notification.type === 'success' ? CheckCircle : notification.type === 'error' ? AlertCircle : Info;

    return (
        <div className={`fixed bottom-6 right-6 z-50 ${bgColor} text-white px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4`}>
             <Icon size={20} />
             <span className="text-sm font-medium">{notification.message}</span>
             <button onClick={clearNotification} className="ml-2 hover:bg-white/20 rounded-full p-1"><X size={14}/></button>
        </div>
    );
};

const App: React.FC = () => {
  const { currentView, setView, devices, setActiveDevice, activeDeviceId, connectionType, updateDataSourceConfig, systemTime, setSystemTime } = useAppStore();
  const [showConnectionManager, setShowConnectionManager] = useState(false);
  const [expandedData, setExpandedData] = useState(true);

  // --- Real Time System Clock ---
  useEffect(() => {
      // Initialize with current time
      setSystemTime(Date.now());
      // Update every second
      const timer = setInterval(() => {
          setSystemTime(Date.now());
      }, 1000);
      return () => clearInterval(timer);
  }, [setSystemTime]);

  const handleEditDevice = (id: string) => {
      setActiveDevice(id);
      setView(ViewState.DATA_TIDES);
  };

  const handleDataSourceSelect = (type: TideSourceType, targetView: ViewState) => {
      updateDataSourceConfig({ activeSource: type });
      setView(targetView);
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 overflow-hidden font-sans">
      
      {showConnectionManager && <ConnectionManager onClose={() => setShowConnectionManager(false)} />}
      <NotificationToast />

      {/* Sidebar Navigation */}
      <nav className="w-20 lg:w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between overflow-y-auto shrink-0 z-20">
         <div>
            <div className="p-6 flex items-center gap-3">
                <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/30">
                    <Waves className="text-white" size={20} />
                </div>
                <h1 className="text-xl font-bold tracking-tight hidden lg:block text-white">TideFlux</h1>
            </div>

            <div className="mt-8 px-4 space-y-2">
                <NavButton 
                    active={currentView === ViewState.DASHBOARD} 
                    onClick={() => setView(ViewState.DASHBOARD)} 
                    icon={<LayoutDashboard size={20}/>} 
                    label="Painel" 
                />
                
                {/* DADOS GROUP */}
                <div className="pt-2">
                    <button 
                        onClick={() => setExpandedData(!expandedData)}
                        className={`w-full flex items-center justify-between px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition`}
                    >
                        <div className="flex items-center gap-3">
                            <Database size={20} />
                            <span className="hidden lg:block">Dados & Fontes</span>
                        </div>
                        <div className="hidden lg:block">
                            {expandedData ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                        </div>
                    </button>
                    
                    {expandedData && (
                        <div className="mt-1 ml-4 border-l border-slate-700 pl-2 space-y-1">
                             <SubNavButton 
                                onClick={() => handleDataSourceSelect(TideSourceType.TABUA_MARE, ViewState.DATA_TIDES)}
                                label="Maré (Tábua & Mocks)"
                                icon={<Anchor size={14}/>}
                                active={currentView === ViewState.DATA_TIDES}
                             />
                             <SubNavButton 
                                onClick={() => handleDataSourceSelect(TideSourceType.API, ViewState.DATA_WEATHER)}
                                label="Clima & Meteorologia"
                                icon={<CloudSun size={14}/>}
                                active={currentView === ViewState.DATA_WEATHER}
                             />
                             <SubNavButton 
                                onClick={() => handleDataSourceSelect(TideSourceType.OPEN_METEO, ViewState.DATA_WAVES)}
                                label="Ondas & Surf"
                                icon={<Waves size={14}/>}
                                active={currentView === ViewState.DATA_WAVES}
                             />
                        </div>
                    )}
                </div>

                <NavButton 
                    active={currentView === ViewState.LED_MASTER} 
                    onClick={() => setView(ViewState.LED_MASTER)} 
                    icon={<Lightbulb size={20}/>} 
                    label="Leds" 
                />
                <NavButton 
                    active={currentView === ViewState.DISPLAY} 
                    onClick={() => setView(ViewState.DISPLAY)} 
                    icon={<Monitor size={20}/>} 
                    label="Displays" 
                />

                <div className="w-full h-px bg-slate-800 my-2"></div>

                <NavButton 
                    active={currentView === ViewState.ESP32} 
                    onClick={() => setView(ViewState.ESP32)} 
                    icon={<Shield size={20}/>} 
                    label="ESP32 & Debug" 
                />
                <NavButton 
                    active={currentView === ViewState.FIRMWARE} 
                    onClick={() => setView(ViewState.FIRMWARE)} 
                    icon={<Cpu size={20}/>} 
                    label="Firmware" 
                />
            </div>
         </div>
         
         <div className="p-4 border-t border-slate-800">
             <div className="flex items-center gap-3 px-2 py-2 text-slate-500 hover:text-slate-300 cursor-pointer transition">
                <Settings size={20} />
                <span className="hidden lg:block text-sm font-medium">Configurações</span>
             </div>
         </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
         {/* Top Header - Mobile friendly */}
         <header className="h-16 bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 flex items-center justify-between px-6 lg:px-8 shrink-0 z-10">
            <h2 className="text-lg font-semibold text-white truncate flex items-center gap-4">
                <span>
                    {currentView === ViewState.DASHBOARD && 'Visão Geral'}
                    {currentView === ViewState.DATA_TIDES && 'Editor de Maré'}
                    {currentView === ViewState.DATA_WEATHER && 'Editor de Clima'}
                    {currentView === ViewState.DATA_WAVES && 'Editor de Ondas'}
                    {currentView === ViewState.EDITOR && 'Editor de Dados'}
                    {currentView === ViewState.DISPLAY && 'Designer do Display'}
                    {currentView === ViewState.LED_MASTER && 'LED Master WS2812B'}
                    {currentView === ViewState.FIRMWARE && 'Gerador de Firmware'}
                    {currentView === ViewState.ESP32 && 'ESP32 & Ferramentas'}
                </span>
                
                {/* System Clock Widget */}
                <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                    <Clock size={12} className="text-cyan-500" />
                    {new Date(systemTime).toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
            </h2>
            <div className="flex items-center gap-4 shrink-0">
                 
                 <button 
                    onClick={() => setShowConnectionManager(true)}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-full text-xs font-medium border border-slate-600 transition"
                 >
                     {connectionType === ConnectionType.NONE ? (
                        <>
                           <Link2 size={14} /> Conectar
                        </>
                     ) : (
                        <>
                           {connectionType === ConnectionType.USB && <Usb size={14} className="text-green-400" />}
                           {connectionType === ConnectionType.BLE && <Bluetooth size={14} className="text-blue-400" />}
                           {connectionType === ConnectionType.WIFI && <Wifi size={14} className="text-cyan-400" />}
                           <span className="text-green-400">Conectado</span>
                        </>
                     )}
                 </button>

                 <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 border border-slate-700 shadow-md"></div>
            </div>
         </header>

         {/* Scrollable View Content - Changed to allow vertical scrolling (overflow-y-auto) */}
         <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-slate-950 relative custom-scrollbar">
             
             {currentView === ViewState.DASHBOARD && (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                    {/* Device Cards */}
                    {devices.map(device => (
                        <div key={device.id} className="bg-slate-800 border border-slate-700 rounded-xl p-6 relative overflow-hidden group hover:border-cyan-500/50 transition-all shadow-lg hover:shadow-cyan-900/20">
                            <div className={`absolute top-0 right-0 p-4`}>
                                <div className={`w-3 h-3 rounded-full ${device.status === 'online' ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-red-500'}`}></div>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-1">{device.name}</h3>
                            <p className="text-sm text-slate-400 font-mono mb-6 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full"></span>
                                {device.ip}
                            </p>
                            
                            <div className="flex gap-2">
                                <button className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-sm py-2 rounded transition font-medium">
                                    Ping
                                </button>
                                <button 
                                  onClick={() => handleEditDevice(device.id)}
                                  className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white text-sm py-2 rounded transition font-medium"
                                >
                                    Editar
                                </button>
                            </div>
                        </div>
                    ))}
                    
                    {/* Quick Stats or Add Device */}
                    <div 
                        onClick={() => setShowConnectionManager(true)}
                        className="border-2 border-dashed border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 hover:border-slate-500 hover:text-slate-300 transition cursor-pointer hover:bg-slate-800/50 min-h-[180px]"
                    >
                        <div className="p-3 bg-slate-800 rounded-full mb-3">
                             <Waves size={24} />
                        </div>
                        <span className="text-sm font-medium">Conectar Novo Controlador</span>
                    </div>
                 </div>
             )}

             {/* Handles DATA_TIDES, DATA_WEATHER, DATA_WAVES, EDITOR */}
             {(currentView === ViewState.DATA_TIDES || currentView === ViewState.DATA_WEATHER || currentView === ViewState.DATA_WAVES || currentView === ViewState.EDITOR) && (
                 <div className="flex flex-col xl:flex-row gap-6">
                     <div className="flex-1 min-w-0">
                         <TideEditor view={currentView} />
                     </div>
                     <div className="xl:w-[350px] shrink-0">
                         <div className="xl:sticky xl:top-0">
                             <LedSimulator />
                         </div>
                     </div>
                 </div>
             )}

             {currentView === ViewState.DISPLAY && (
                 <DisplayEditor />
             )}

             {currentView === ViewState.LED_MASTER && (
                 <LedMaster />
             )}

             {currentView === ViewState.FIRMWARE && (
                 <FirmwareBuilder />
             )}

             {currentView === ViewState.ESP32 && (
                 <Esp32Tools />
             )}

         </div>
      </main>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${active ? 'bg-cyan-500/10 text-cyan-400 font-medium border-r-2 border-cyan-500' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
    >
        {icon}
        <span className="hidden lg:block">{label}</span>
    </button>
);

const SubNavButton = ({ onClick, icon, label, active }: { onClick: () => void, icon: React.ReactNode, label: string, active?: boolean }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200 text-xs font-medium ${active ? 'text-cyan-400 bg-slate-800 font-bold' : 'text-slate-500 hover:text-cyan-400 hover:bg-slate-800/50'}`}
    >
        {icon}
        <span className="hidden lg:block">{label}</span>
    </button>
);

export default App;
