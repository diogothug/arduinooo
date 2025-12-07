import React, { useState } from 'react';
import { ConnectionManager } from './ConnectionManager';
import { LedDebugPanel } from './led/LedDebugPanel';
import { Network, Terminal, Shield, PlugZap, Activity, Bug, HardDrive, RefreshCcw } from 'lucide-react';

export const Esp32Tools: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'CONNECT' | 'DEBUG' | 'LAB' | 'SYSTEM'>('CONNECT');
    const [mockLogs, setMockLogs] = useState<string[]>([
        "[INF] (1000) Log System Initialized",
        "[INF] (1050) Booting TideFlux v2.1",
        "[INF] (1200) NVS Mount Success",
        "[INF] (1300) WiFi Connecting to Morere_WiFi...",
        "[INF] (2500) WiFi Connected! IP: 192.168.1.105",
        "[INF] (2600) REST Server started on port 80",
        "[INF] (2700) BLE Stack Started",
        "[DBG] (3000) Task Network started on Core 0",
        "[DBG] (3000) Task Animation started on Core 1",
        "[INF] (3500) Boot Verified Stable."
    ]);

    const handleRefreshLogs = () => {
        const newLog = `[INF] (${Date.now() % 10000}) Heartbeat OK. FreeHeap: 184kb`;
        setMockLogs(prev => [...prev.slice(-15), newLog]);
    };

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Header Tabs */}
            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700 w-fit shrink-0 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('CONNECT')}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition whitespace-nowrap ${activeTab === 'CONNECT' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                >
                    <PlugZap size={14} /> Conexão
                </button>
                <button 
                    onClick={() => setActiveTab('SYSTEM')}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition whitespace-nowrap ${activeTab === 'SYSTEM' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                >
                    <HardDrive size={14} /> System & Logs
                </button>
                <button 
                    onClick={() => setActiveTab('DEBUG')}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition whitespace-nowrap ${activeTab === 'DEBUG' ? 'bg-green-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                >
                    <Bug size={14} /> Debug API
                </button>
                <button 
                    onClick={() => setActiveTab('LAB')}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition whitespace-nowrap ${activeTab === 'LAB' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
                >
                    <Terminal size={14} /> Serial Lab
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-slate-800 rounded-lg border border-slate-700 p-6 overflow-hidden min-h-[500px]">
                {activeTab === 'CONNECT' && (
                    <div className="h-full flex flex-col animate-in fade-in">
                        <div className="mb-4">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Shield className="text-cyan-400" /> Gerenciador de Dispositivo
                            </h2>
                            <p className="text-sm text-slate-400">Gerencie a conexão física (USB/BLE) ou remota (WiFi).</p>
                        </div>
                        <div className="flex-1 overflow-hidden">
                             <ConnectionManager isEmbed={true} />
                        </div>
                    </div>
                )}

                {activeTab === 'SYSTEM' && (
                    <div className="h-full flex flex-col animate-in fade-in">
                        <div className="mb-4 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <HardDrive className="text-indigo-400" /> Sistema & Logs Inteligentes
                                </h2>
                                <p className="text-sm text-slate-400">Logs remotos, Watchdog Status e Backup de Configuração.</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleRefreshLogs} className="bg-slate-700 p-2 rounded hover:bg-slate-600 transition"><RefreshCcw size={14}/></button>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="bg-slate-900 p-3 rounded border border-slate-700">
                                <div className="text-[10px] text-slate-500 font-bold uppercase">Watchdog Task 0</div>
                                <div className="text-green-400 font-mono text-sm">HEALTHY</div>
                            </div>
                            <div className="bg-slate-900 p-3 rounded border border-slate-700">
                                <div className="text-[10px] text-slate-500 font-bold uppercase">Watchdog Task 1</div>
                                <div className="text-green-400 font-mono text-sm">HEALTHY</div>
                            </div>
                            <div className="bg-slate-900 p-3 rounded border border-slate-700">
                                <div className="text-[10px] text-slate-500 font-bold uppercase">NVS Storage</div>
                                <div className="text-blue-400 font-mono text-sm">MOUNTED</div>
                            </div>
                        </div>

                        <div className="flex-1 bg-black rounded border border-slate-700 p-4 overflow-y-auto font-mono text-xs shadow-inner">
                            {mockLogs.map((log, i) => {
                                const isErr = log.includes("[ERR]");
                                const isWrn = log.includes("[WRN]");
                                const isDbg = log.includes("[DBG]");
                                return (
                                    <div key={i} className={`mb-1 ${isErr ? 'text-red-500' : isWrn ? 'text-amber-500' : isDbg ? 'text-slate-500' : 'text-slate-300'}`}>
                                        {log}
                                    </div>
                                )
                            })}
                            <div className="animate-pulse text-cyan-500 mt-2">_</div>
                        </div>
                    </div>
                )}

                {activeTab === 'DEBUG' && (
                    <div className="h-full flex flex-col animate-in fade-in">
                         <div className="mb-4">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Network className="text-green-400" /> Diagnóstico de API
                            </h2>
                            <p className="text-sm text-slate-400">Teste as rotas que o ESP32 usará para buscar dados de maré e clima.</p>
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
                                 Monitoramento serial bruto via WebSerial API.
                             </p>
                             <div className="bg-black p-4 rounded border border-slate-700 text-left font-mono text-[10px] text-green-500 h-40 opacity-75">
                                 [SYSTEM] Serial Port Opened<br/>
                                 [LAB] Waiting for data stream...<br/>
                                 {'>'} _
                             </div>
                         </div>
                     </div>
                )}
            </div>
        </div>
    );
};