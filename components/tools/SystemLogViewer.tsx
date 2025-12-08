
import React, { useState } from 'react';
import { HardDrive, RefreshCcw } from 'lucide-react';

export const SystemLogViewer: React.FC = () => {
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
    );
};
