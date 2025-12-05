
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { ConnectionType } from '../types';
import { hardwareBridge } from '../services/hardwareBridge';
import { Wifi, Usb, Bluetooth, CheckCircle, XCircle, AlertCircle, Shield } from 'lucide-react';

interface ConnectionManagerProps {
  onClose: () => void;
}

export const ConnectionManager: React.FC<ConnectionManagerProps> = ({ onClose }) => {
  const { connectionType, setConnectionType, activeDeviceId, devices, setActiveDevice } = useAppStore();
  const [activeTab, setActiveTab] = useState<ConnectionType>(ConnectionType.USB);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const handleUsbConnect = async () => {
    setErrorMsg('');
    setStatusMsg('Aguardando autorização do usuário...');
    setIsAuthorizing(true);
    
    // Slight delay to allow UI update before browser freezes thread for prompt
    setTimeout(async () => {
        try {
            const success = await hardwareBridge.connectUSB();
            if (success) {
              setConnectionType(ConnectionType.USB);
              setStatusMsg('Conectado via USB Serial');
              setDeviceName('Dispositivo USB');
            } else {
              setErrorMsg('Conexão cancelada ou falhou.');
              setStatusMsg('');
            }
        } catch (e: any) {
            setErrorMsg(e.message || 'Erro de Conexão USB');
        } finally {
            setIsAuthorizing(false);
        }
    }, 100);
  };

  const handleBleConnect = async () => {
    setErrorMsg('');
    setStatusMsg('Escaneando dispositivos MareLED...');
    setIsAuthorizing(true);
    
    setTimeout(async () => {
        try {
            const name = await hardwareBridge.connectBLE();
            if (name) {
              setConnectionType(ConnectionType.BLE);
              setStatusMsg(`Conectado a ${name}`);
              setDeviceName(name);
            } else {
              setErrorMsg('Nenhum dispositivo selecionado ou Bluetooth desativado.');
              setStatusMsg('');
            }
        } catch(e: any) {
             setErrorMsg('Erro Bluetooth: ' + e.message);
        } finally {
            setIsAuthorizing(false);
        }
    }, 100);
  };

  const handleDisconnect = async () => {
    if (connectionType === ConnectionType.USB) {
      await hardwareBridge.disconnectUSB();
    } else if (connectionType === ConnectionType.BLE) {
      hardwareBridge.disconnectBLE();
    }
    setConnectionType(ConnectionType.NONE);
    setStatusMsg('Desconectado');
    setDeviceName('');
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-800">
           <h3 className="text-xl font-bold text-white flex items-center gap-2">
               <Shield size={20} className="text-cyan-400" />
               Conectar Dispositivo
           </h3>
           <button onClick={onClose} className="text-slate-400 hover:text-white transition">Fechar</button>
        </div>

        {/* Connection Status Banner */}
        <div className={`p-4 flex items-center justify-between transition-colors ${connectionType !== ConnectionType.NONE ? 'bg-green-900/30 border-b border-green-900' : 'bg-slate-900/50'}`}>
            <div className="flex items-center gap-3">
                {connectionType === ConnectionType.USB && <Usb className="text-green-400" />}
                {connectionType === ConnectionType.BLE && <Bluetooth className="text-blue-400" />}
                {connectionType === ConnectionType.WIFI && <Wifi className="text-cyan-400" />}
                {connectionType === ConnectionType.NONE && <XCircle className="text-slate-500" />}
                
                <div>
                   <p className="text-sm font-bold text-white">
                      {connectionType !== ConnectionType.NONE ? 'Conectado' : 'Não Conectado'}
                   </p>
                   <p className="text-xs text-slate-400 font-mono">
                      {deviceName || 'Selecione um método abaixo'}
                   </p>
                </div>
            </div>
            
            {connectionType !== ConnectionType.NONE && (
               <button onClick={handleDisconnect} className="text-xs text-red-300 hover:text-red-200 underline">
                  Desconectar
               </button>
            )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
           <button 
             onClick={() => setActiveTab(ConnectionType.USB)}
             className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition ${activeTab === ConnectionType.USB ? 'text-white border-b-2 border-cyan-500 bg-slate-700/50' : 'text-slate-400 hover:bg-slate-700/30'}`}
           >
             <Usb size={16} /> USB Serial
           </button>
           <button 
             onClick={() => setActiveTab(ConnectionType.BLE)}
             className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition ${activeTab === ConnectionType.BLE ? 'text-white border-b-2 border-blue-500 bg-slate-700/50' : 'text-slate-400 hover:bg-slate-700/30'}`}
           >
             <Bluetooth size={16} /> Bluetooth
           </button>
           <button 
             onClick={() => setActiveTab(ConnectionType.WIFI)}
             className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition ${activeTab === ConnectionType.WIFI ? 'text-white border-b-2 border-purple-500 bg-slate-700/50' : 'text-slate-400 hover:bg-slate-700/30'}`}
           >
             <Wifi size={16} /> Wi-Fi
           </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 min-h-[240px]">
           {activeTab === ConnectionType.USB && (
             <div className="space-y-4 text-center">
                 <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 mb-4">
                     <p className="text-sm text-slate-300 mb-2">
                        <span className="font-bold text-white">Permissão do Navegador Necessária</span>
                     </p>
                     <p className="text-xs text-slate-500">
                        Ao clicar em conectar, seu navegador abrirá um pop-up pedindo para selecionar o dispositivo ESP32.
                     </p>
                 </div>
                 
                 <button 
                    onClick={handleUsbConnect}
                    disabled={connectionType === ConnectionType.USB || isAuthorizing}
                    className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                        connectionType === ConnectionType.USB 
                        ? 'bg-green-600/20 text-green-400 cursor-default' 
                        : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/50'
                    }`}
                 >
                    {isAuthorizing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Usb size={20} />}
                    {connectionType === ConnectionType.USB ? 'USB Conectado' : 'Autorizar & Conectar USB'}
                 </button>
                 
                 {statusMsg && <p className="text-xs text-cyan-400 mt-2 font-mono animate-pulse">{statusMsg}</p>}
                 {errorMsg && <p className="text-xs text-red-400 mt-2 flex items-center justify-center gap-1"><AlertCircle size={12}/> {errorMsg}</p>}
             </div>
           )}

           {activeTab === ConnectionType.BLE && (
             <div className="space-y-4 text-center">
                 <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 mb-4">
                     <p className="text-sm text-slate-300 mb-2">
                        <span className="font-bold text-white">Pareamento Bluetooth</span>
                     </p>
                     <p className="text-xs text-slate-500">
                        Seu navegador irá escanear por dispositivos com nome <strong>"MareLED..."</strong>. Verifique se o ESP32 está ligado.
                     </p>
                 </div>

                 <button 
                    onClick={handleBleConnect}
                    disabled={connectionType === ConnectionType.BLE || isAuthorizing}
                    className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                        connectionType === ConnectionType.BLE
                        ? 'bg-green-600/20 text-green-400 cursor-default'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50'
                    }`}
                 >
                    {isAuthorizing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Bluetooth size={20} />}
                    {connectionType === ConnectionType.BLE ? 'Bluetooth Conectado' : 'Iniciar Scan BLE'}
                 </button>
                 
                 {statusMsg && <p className="text-xs text-blue-400 mt-2 font-mono animate-pulse">{statusMsg}</p>}
                 {errorMsg && <p className="text-xs text-red-400 mt-2 flex items-center justify-center gap-1"><AlertCircle size={12}/> {errorMsg}</p>}
             </div>
           )}

           {activeTab === ConnectionType.WIFI && (
             <div className="space-y-4">
                 <p className="text-sm text-slate-300 mb-4">Selecione um dispositivo descoberto anteriormente na rede.</p>
                 <div className="space-y-2 max-h-[150px] overflow-y-auto">
                    {devices.map(dev => (
                      <div 
                        key={dev.id}
                        onClick={() => { setActiveDevice(dev.id); setConnectionType(ConnectionType.WIFI); setDeviceName(dev.name); }}
                        className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center ${activeDeviceId === dev.id ? 'border-purple-500 bg-purple-500/10' : 'border-slate-600 hover:border-slate-500'}`}
                      >
                         <span className="text-sm font-bold text-white">{dev.name}</span>
                         <span className="text-xs font-mono text-slate-400">{dev.ip}</span>
                      </div>
                    ))}
                 </div>
                 <div className="mt-4 pt-4 border-t border-slate-700">
                     <p className="text-xs text-center text-slate-500">
                        Use USB/BLE para configurar WiFi se o dispositivo não aparecer aqui.
                     </p>
                 </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
