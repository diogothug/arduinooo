
import React, { useState } from 'react';
import { ConnectionManager } from './ConnectionManager';
import { LedDebugPanel } from './led/LedDebugPanel';
import { AssetConverter } from './tools/AssetConverter';
import { SystemLogViewer } from './tools/SystemLogViewer';
import { Network, Terminal, Shield, PlugZap, Activity, Bug, HardDrive, Image as ImageIcon } from 'lucide-react';

export const Esp32Tools: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'CONNECT' | 'DEBUG' | 'LAB' | 'SYSTEM' | 'ASSETS'>('CONNECT');

    return (
        <div className="h-full flex flex-col gap-4">
            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700 w-fit shrink-0 overflow-x-auto">
                <button onClick={() => setActiveTab('CONNECT')} className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition whitespace-nowrap ${activeTab === 'CONNECT' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>
                    <PlugZap size={14} /> Conexão
                </button>
                <button onClick={() => setActiveTab('SYSTEM')} className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition whitespace-nowrap ${activeTab === 'SYSTEM' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>
                    <HardDrive size={14} /> System & Logs
                </button>
                <button onClick={() => setActiveTab('DEBUG')} className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition whitespace-nowrap ${activeTab === 'DEBUG' ? 'bg-green-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>
                    <Bug size={14} /> Debug API
                </button>
                <button onClick={() => setActiveTab('ASSETS')} className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition whitespace-nowrap ${activeTab === 'ASSETS' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>
                    <ImageIcon size={14} /> Assets Converter
                </button>
                <button onClick={() => setActiveTab('LAB')} className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition whitespace-nowrap ${activeTab === 'LAB' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>
                    <Terminal size={14} /> Serial Lab
                </button>
            </div>

            <div className="flex-1 bg-slate-800 rounded-lg border border-slate-700 p-6 overflow-hidden min-h-[500px]">
                {activeTab === 'CONNECT' && (
                    <div className="h-full flex flex-col animate-in fade-in">
                        <div className="mb-4">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Shield className="text-cyan-400" /> Gerenciador de Dispositivo
                            </h2>
                            <p className="text-sm text-slate-400">Gerencie a conexão física (USB/BLE) ou remota (WiFi).</p>
                        </div>
                        <div className="flex-1 overflow-hidden"><ConnectionManager isEmbed={true} /></div>
                    </div>
                )}
                {activeTab === 'SYSTEM' && <SystemLogViewer />}
                {activeTab === 'DEBUG' && (
                    <div className="h-full flex flex-col animate-in fade-in">
                         <div className="mb-4">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2"><Network className="text-green-400" /> Diagnóstico de API</h2>
                            <p className="text-sm text-slate-400">Teste as rotas que o ESP32 usará para buscar dados de maré e clima.</p>
                        </div>
                        <div className="flex-1 overflow-hidden"><LedDebugPanel /></div>
                    </div>
                )}
                {activeTab === 'ASSETS' && <AssetConverter />}
                {activeTab === 'LAB' && (
                     <div className="h-full flex flex-col items-center justify-center text-slate-500 animate-in fade-in">
                         <Activity size={48} className="mb-4 opacity-50 text-amber-500"/>
                         <h3 className="text-lg font-bold text-slate-300">Lab Experimental & Serial</h3>
                         <div className="max-w-md text-center mt-2 space-y-2">
                             <p className="text-xs">Monitoramento serial bruto via WebSerial API.</p>
                             <div className="bg-black p-4 rounded border border-slate-700 text-left font-mono text-[10px] text-green-500 h-40 opacity-75">
                                 [SYSTEM] Serial Port Opened<br/>[LAB] Waiting for data stream...<br/>{'>'} _
                             </div>
                         </div>
                     </div>
                )}
            </div>
        </div>
    );
};
