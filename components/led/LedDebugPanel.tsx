
import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { Network, Play, FileCode, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export const LedDebugPanel: React.FC = () => {
    const { firmwareConfig, dataSourceConfig, systemTime } = useAppStore();
    const [debugResult, setDebugResult] = useState<string | null>(null);
    const [debugLoading, setDebugLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'CODE' | 'TERMINAL'>('CODE');
    const [generatedCode, setGeneratedCode] = useState('');
    const [simulateMode, setSimulateMode] = useState<'WEATHER' | 'TABUA_MARE' | null>(null);

    // This function mimics the C++ behavior in JS
    const handleRunSimulation = async (type: 'WEATHER' | 'TABUA_MARE') => {
        setSimulateMode(type);
        setDebugLoading(true);
        setDebugResult(null);
        setActiveTab('TERMINAL');

        // 1. GENERATE C++ SNIPPET
        let snippet = '';
        let url = '';
        const now = new Date(systemTime);
        const day = now.getDate();
        const month = now.getMonth() + 1;
        
        if (type === 'WEATHER') {
            const k = firmwareConfig.weatherApi?.apiKey || 'KEY';
            const q = encodeURIComponent(firmwareConfig.weatherApi?.location || 'Moreré');
            url = `https://api.weatherapi.com/v1/current.json?key=${k}&q=${q}&lang=pt`;
            
            snippet = `// --- ESP32 FIRMWARE LOGIC ---\n// WeatherAPI Request\n\n#include <WiFi.h>\n#include <HTTPClient.h>\n\nconst char* url = "${url}";\n\nvoid setup() {\n  Serial.begin(115200);\n  HTTPClient http;\n  http.begin(url);\n  int code = http.GET();\n  if(code == 200) {\n     String payload = http.getString();\n     // Parse JSON...\n  }\n}`;
        } else {
            const base = dataSourceConfig.tabuaMare.baseUrl.replace(/\/+$/, "");
            const pid = dataSourceConfig.tabuaMare.harborId || 7;
            
            // Logic must match C++ template exactly
            // C++: String daysParam = "%5B" + day + "," + (day+1) + ...
            const daysParam = `%5B${day},${day+1},${day+2}%5D`; 
            url = `${base}/tabua-mare/${pid}/${month}/${daysParam}`;
            
            // Ensure HTTPS logic matches C++
            let safeUrl = url;
            if(!safeUrl.startsWith('http')) safeUrl = 'https://' + safeUrl;

            snippet = `// --- ESP32 FIRMWARE LOGIC ---\n// Tábua Maré Request\n\n#include <WiFi.h>\n#include <HTTPClient.h>\n#include <ArduinoJson.h>\n\nvoid fetchTabua() {\n  int harborId = ${pid};\n  int month = ${month};\n  // Array encoding for ESP32\n  String daysParam = "%5B${day},${day+1},${day+2}%5D"; \n  \n  String url = "${base}/tabua-mare/" + String(harborId) + "/" + String(month) + "/" + daysParam;\n  \n  HTTPClient http;\n  http.begin(url);\n  int httpCode = http.GET();\n  \n  if (httpCode > 0) {\n      String payload = http.getString();\n      DynamicJsonDocument doc(16384);\n      deserializeJson(doc, payload);\n      // Navigate path: data[0].months[0].days[0].hours\n  }\n}`;
        }
        
        setGeneratedCode(snippet);

        // 2. SIMULATE EXECUTION (Use Proxy to bypass CORS like the real device bypasses nothing)
        const logLines: string[] = [];
        const log = (msg: string) => {
            logLines.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
            setDebugResult(logLines.join('\n'));
        };

        log(`[System] Starting Firmware Simulation...`);
        log(`[System] Time: ${now.toLocaleTimeString()}`);
        log(`[WiFi] Connected to Virtual-AP (IP: 192.168.1.10)`);
        
        try {
            log(`[HTTP] Begin Request...`);
            log(`[HTTP] URL: ${url}`);
            
            // Use CORS Proxy for browser environment
            const proxy = "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);
            
            const startT = performance.now();
            const res = await fetch(proxy);
            const dur = (performance.now() - startT).toFixed(0);
            
            log(`[HTTP] Response Code: ${res.status}`);
            log(`[HTTP] Duration: ${dur}ms`);
            
            if (!res.ok) {
                log(`[HTTP] Error: ${res.statusText}`);
                throw new Error(`HTTP ${res.status}`);
            }

            const text = await res.text();
            log(`[HTTP] Payload Size: ${text.length} bytes`);
            
            if (text.trim().startsWith("<")) {
                log(`[Parsing] ERROR: Received HTML instead of JSON!`);
                log(`[Parsing] Check URL or Proxy.`);
            } else {
                log(`[Parsing] Deserializing JSON...`);
                const json = JSON.parse(text);
                
                if (type === 'TABUA_MARE') {
                    // Simulate C++ path navigation
                    // data[0]["months"]...
                    const data = Array.isArray(json.data) ? json.data : [json.data];
                    if (data.length > 0 && data[0].months) {
                         const m = data[0].months[0]; // First month in resp
                         if(m && m.days) {
                             const d = m.days[0];
                             log(`[Logic] Found data for Date: ${d.date}`);
                             const hours = d.hours || d.tides || [];
                             log(`[Logic] Found ${hours.length} tide points.`);
                             hours.forEach((h: any, i: number) => {
                                 if(i < 3) log(`   > ${h.hour || h.time} = ${h.level || h.height}m`);
                             });
                             if(hours.length > 3) log(`   > ... (${hours.length - 3} more)`);
                         } else {
                             log(`[Logic] JSON structure mismatch (no days).`);
                         }
                    } else {
                         log(`[Logic] Empty data array.`);
                    }
                } else {
                    // Weather
                    if(json.current) {
                        log(`[Logic] Temp: ${json.current.temp_c}C`);
                        log(`[Logic] Wind: ${json.current.wind_kph}km/h`);
                    }
                }
                log(`[System] Success. Memory Free: 140kb`);
            }

        } catch (e: any) {
            log(`[Exception] ${e.message}`);
        } finally {
            setDebugLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 rounded-lg overflow-hidden">
            {/* Toolbar */}
            <div className="bg-slate-800 p-2 flex items-center justify-between border-b border-slate-700">
                <div className="flex gap-2">
                     <button 
                        onClick={() => handleRunSimulation('TABUA_MARE')}
                        disabled={debugLoading}
                        className="flex items-center gap-2 px-3 py-1.5 bg-cyan-900/40 hover:bg-cyan-900/60 border border-cyan-700 text-cyan-200 text-xs rounded transition"
                     >
                        {debugLoading && simulateMode === 'TABUA_MARE' ? <RefreshCw className="animate-spin" size={12}/> : <Play size={12}/>}
                        Testar Tábua Maré
                     </button>
                     <button 
                        onClick={() => handleRunSimulation('WEATHER')}
                        disabled={debugLoading}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-900/40 hover:bg-blue-900/60 border border-blue-700 text-blue-200 text-xs rounded transition"
                     >
                        {debugLoading && simulateMode === 'WEATHER' ? <RefreshCw className="animate-spin" size={12}/> : <Play size={12}/>}
                        Testar WeatherAPI
                     </button>
                </div>
                
                <div className="flex bg-slate-900 rounded p-0.5">
                    <button onClick={()=>setActiveTab('CODE')} className={`px-3 py-1 text-[10px] font-bold rounded ${activeTab==='CODE' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>CODE</button>
                    <button onClick={()=>setActiveTab('TERMINAL')} className={`px-3 py-1 text-[10px] font-bold rounded ${activeTab==='TERMINAL' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>SERIAL</button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto bg-[#0d1117] relative">
                {activeTab === 'CODE' && (
                    <div className="p-4">
                        <div className="text-xs font-mono text-slate-400 mb-2 flex items-center gap-2">
                            <FileCode size={14}/> C++ Firmware Logic Preview
                        </div>
                        {generatedCode ? (
                            <pre className="text-[10px] font-mono text-green-400 whitespace-pre-wrap">{generatedCode}</pre>
                        ) : (
                            <div className="text-slate-600 text-xs italic mt-10 text-center">Execute um teste para ver o código gerado.</div>
                        )}
                    </div>
                )}

                {activeTab === 'TERMINAL' && (
                    <div className="p-4 font-mono text-xs">
                        {debugResult ? (
                            <div className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                                {debugResult.split('\n').map((line, i) => (
                                    <div key={i} className={`${line.includes('[Exception]') || line.includes('Error') ? 'text-red-400' : line.includes('[System]') ? 'text-cyan-500' : 'text-slate-300'}`}>
                                        {line}
                                    </div>
                                ))}
                                {debugLoading && <div className="animate-pulse text-cyan-500 mt-2">_</div>}
                            </div>
                        ) : (
                            <div className="text-slate-600 italic mt-10 text-center">Terminal aguardando execução...</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
