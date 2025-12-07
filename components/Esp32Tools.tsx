

import React, { useState } from 'react';
import { ConnectionManager } from './ConnectionManager';
import { LedDebugPanel } from './led/LedDebugPanel';
import { Network, Terminal, Shield, PlugZap, Activity, Bug } from 'lucide-react';

export const Esp32Tools: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'CONNECT' | 'DEBUG' | 'LAB'>('CONNECT');

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Header Tabs */}
            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700 w-fit">
                <button 
                    onClick={() => setActiveTab('CONNECT')}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition ${activeTab === 'CONNECT' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                >
                    <PlugZap size={14} /> Conexão & Status
                </button>
                <button 
                    onClick={() => setActiveTab('DEBUG')}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition ${activeTab === 'DEBUG' ? 'bg-green-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                >
                    <Bug size={14} /> Debug (API)
                </button>
                <button 
                    onClick={() => setActiveTab('LAB')}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition ${activeTab === 'LAB' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                >
                    <Terminal size={14} /> Lab / Serial
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-slate-800 rounded-lg border border-slate-700 p-6 overflow-hidden">
                {activeTab === 'CONNECT' && (
                    <div className="h-full flex flex-col animate-in fade-in">
                        <div className="mb-4">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Shield className="text-cyan-400" /> Gerenciador de Dispositivo
                            </h2>
                            <p className="text-sm text-slate-400">Gerencie a conexão física (USB/BLE) ou remota (WiFi) com o controlador TideFlux.</p>
                        </div>
                        <div className="flex-1 overflow-hidden">
                             <ConnectionManager isEmbed={true} />
                        </div>
                    </div>
                )}

                {activeTab === 'DEBUG' && (
                    <div className="h-full flex flex-col animate-in fade-in">
                         <div className="mb-4">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Network className="text-green-400" /> Diagnóstico de API
                            </h2>
                            <p className="text-sm text-slate-400">Teste as rotas que o ESP32 usará para buscar dados de maré e clima. Simule requisições reais.</p>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <LedDebugPanel />
                        </div>
                    </div>
                )}

                {activeTab === 'LAB' && (
                     <div className="h-full flex flex-col items-center justify-center text-slate-500 animate-in fade-in">
                         <Activity size={48} className="mb-4 opacity-50 text-amber-500"/>
                         <h3 className="text-lg font-bold text-slate-300">Lab Experimental & Serial</h3>
                         <div className="max-w-md text-center mt-2 space-y-2">
                             <p className="text-xs">
                                 Este painel permite monitorar a saída serial do ESP32 em tempo real e enviar comandos brutos.
                             </p>
                             <div className="bg-black p-4 rounded border border-slate-700 text-left font-mono text-[10px] text-green-500 h-40 opacity-75">
                                 [SYSTEM] Serial Port Opened<br/>
                                 [LAB] Waiting for data stream...<br/>
                                 {'>'} _
                             </div>
                             <p className="text-[10px] italic opacity-60">(Funcionalidade em desenvolvimento na v2.1)</p>
                         </div>
                     </div>
                )}
            </div>
        </div>
    );
};