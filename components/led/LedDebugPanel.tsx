
import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { Network, Code, AlertCircle } from 'lucide-react';

export const LedDebugPanel: React.FC = () => {
    const { firmwareConfig, dataSourceConfig } = useAppStore();
    const [debugUrl, setDebugUrl] = useState('');
    const [debugResult, setDebugResult] = useState<string | null>(null);
    const [debugLoading, setDebugLoading] = useState(false);
    const [cppSnippet, setCppSnippet] = useState('');

    const handleCheckApi = async (type: 'WEATHER' | 'TABUA_MARE') => {
        setDebugLoading(true); setDebugResult(null);
        let url = '';
        let snippet = '';

        if (type === 'WEATHER') {
            const k = firmwareConfig.weatherApi?.apiKey || 'KEY';
            const q = encodeURIComponent(firmwareConfig.weatherApi?.location || 'Moreré');
            url = `https://api.weatherapi.com/v1/current.json?key=${k}&q=${q}&lang=pt`;
            snippet = `// WeatherAPI Snippet\nString url = "${url}";\nHTTPClient http;\nhttp.begin(url);\nint code = http.GET();`;
        } else {
            const base = dataSourceConfig.tabuaMare.baseUrl;
            const pid = dataSourceConfig.tabuaMare.harborId || 7; // Default to 7
            const month = new Date().getMonth() + 1;
            const today = new Date().getDate();
            
            // FIX: Use plain brackets. encodeURIComponent (via proxy) or ESP32 library will handle it.
            // Do NOT use %5B manually if it triggers double encoding in some clients.
            const encodedBracket = `[${today},${today+1},${today+2}]`; 
            
            let cleanBase = base.replace(/\/+$/, "");
            
            // Ensure HTTPS in snippet
            if(!cleanBase.startsWith('http')) cleanBase = 'https://' + cleanBase;
            else if(cleanBase.startsWith('http://')) cleanBase = cleanBase.replace('http://', 'https://');

            url = `${cleanBase}/tabua-mare/${pid}/${month}/${encodedBracket}`;
            
            snippet = `#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

const char* ssid = "SEU_SSID";
const char* password = "SUA_SENHA";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  
  // Note: On ESP32, HTTPClient usually requires brackets to be encoded (%5B, %5D)
  // But if using a proxy logic here in JS, we use raw. 
  // For ESP32 direct connection:
  String daysParam = "%5B${today},${today+1},${today+2}%5D"; 
  String url = "${cleanBase}/tabua-mare/${pid}/${month}/" + daysParam;
  
  WiFiClientSecure client;
  client.setInsecure(); // Ignore SSL for testing
  
  HTTPClient http;
  http.setDebugOutput(true);
  
  if (http.begin(client, url)) {
    http.addHeader("User-Agent", "ESP32-Debug");
    int httpCode = http.GET();
    Serial.printf("HTTP Code: %d\\n", httpCode);
    
    if (httpCode == 200) {
        String payload = http.getString();
        Serial.println(payload);
        
        DynamicJsonDocument doc(8192);
        deserializeJson(doc, payload);
        // Parsing data[0].months[0]...
        JsonArray hours = doc["data"][0]["months"][0]["days"][0]["hours"];
        for(JsonObject h : hours) {
            const char* time = h["hour"];
            float level = h["level"];
            Serial.printf("Time: %s Level: %.2f\\n", time, level);
        }
    } else {
        Serial.println(http.getString());
    }
    http.end();
  }
}
void loop() {}`;
        }
        
        setDebugUrl(url);
        setCppSnippet(snippet);
        
        try {
            // Test connection using the same proxy logic as the main service
            const proxy = "https://api.allorigins.win/raw?url=" + encodeURIComponent(url);
            const res = await fetch(proxy);
            const txt = await res.text();
            setDebugResult(res.ok ? `HTTP ${res.status} OK\n\n${txt.substring(0,800)}...` : `HTTP ${res.status} ERROR\n${txt}`);
        } catch(e:any) { setDebugResult("EXCEPTION: " + e.message); } finally { setDebugLoading(false); }
    };

    return (
        <div className="space-y-6 animate-in fade-in h-full flex flex-col">
             <div className="flex-none">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><Network size={14}/> Teste de Conectividade</h3>
                <div className="space-y-2 mb-4">
                    <button onClick={()=>handleCheckApi('TABUA_MARE')} className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white text-left flex justify-between">
                        <span>Check Tábua Maré (Secure & Parsed)</span> <span>GET</span>
                    </button>
                    <button onClick={()=>handleCheckApi('WEATHER')} className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white text-left flex justify-between">
                        <span>Check WeatherAPI</span> <span>GET</span>
                    </button>
                </div>
            </div>

            {cppSnippet ? (
                 <div className="flex-1 overflow-auto bg-black p-4 rounded border border-slate-700 font-mono text-xs text-green-400 relative">
                     <div className="absolute top-2 right-2 text-[10px] bg-slate-800 px-2 rounded text-slate-400">C++ Code Generated</div>
                     <pre className="whitespace-pre-wrap">{cppSnippet}</pre>
                 </div>
            ) : (
                <div className="flex-1 bg-black rounded border border-slate-700 p-2 overflow-auto text-[9px] font-mono text-green-400">
                     {debugLoading ? 'Testing...' : (debugResult || '// Select a test to run')}
                </div>
            )}
        </div>
    );
};
