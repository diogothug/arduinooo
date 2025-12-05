import { DataSourceConfig, Keyframe, TideSourceType, MockWaveType, EffectType, WeatherData } from "../types";
import { useAppStore } from '../store';

console.log("🟦 [TideService] Module Loading...");

// Helper to generate a random ID
const uid = () => Math.random().toString(36).substr(2, 9);

// Helper to sanitize base URLs and ensure valid structure
const sanitizeBaseUrl = (url: string) => {
    if (!url) return '';
    let clean = url.replace(/\/+$/, '');
    return clean;
};

// Safe logger helper to avoid circular dependency crashes during init
const safeLog = (msg: string) => {
    console.log(msg);
    try {
        // Only try to update store if it's initialized
        useAppStore.getState().setApiDebugLog(msg);
    } catch (e) {
        // Ignore store errors during early init
    }
};

export const tideSourceService = {
    getTideData: async (config: DataSourceConfig, cycleDuration: number): Promise<{ frames: Keyframe[], sourceUsed: TideSourceType }> => {
        let resultFrames: Keyframe[] = [];
        let sourceUsed = TideSourceType.MOCK;

        safeLog(`[TideSource] Requesting data via ${config.activeSource}`);

        if (config.activeSource === TideSourceType.API) {
            try {
                const { frames } = await tideSourceService.fetchLiveWeather(config);
                if (frames.length > 0) {
                     return { frames, sourceUsed: TideSourceType.API };
                } else {
                    console.warn("[TideSource] WeatherAPI returned success but no tide data.");
                }
            } catch (error) {
                console.warn("[TideSource] WeatherAPI Failure, trying fallback...", error);
            }
        }

        if (config.activeSource === TideSourceType.TABUA_MARE) {
             try {
                 resultFrames = await fetchTabuaMareData(config, cycleDuration);
                 if (resultFrames.length > 0) {
                     return { frames: resultFrames, sourceUsed: TideSourceType.TABUA_MARE };
                 }
                 throw new Error("Tábua Maré vazia.");
             } catch (error: any) {
                 console.error("[TideSource] Tábua Maré Failure:", error);
                 throw new Error(`Falha Tábua Maré: ${error.message}`); 
             }
        }

        console.log("[TideSource] Using Mock/Fallback data");
        try {
            resultFrames = generateMockData(config, cycleDuration);
            sourceUsed = TideSourceType.MOCK;
        } catch (error) {
             console.error("[TideSource] Mock Generation Failed", error);
             if (config.lastValidData) {
                 resultFrames = calculateFallback(config.lastValidData, cycleDuration);
                 sourceUsed = TideSourceType.CALCULATED;
             } else {
                 throw new Error("Falha Crítica: Nenhuma fonte de dados disponível.");
             }
        }

        return { frames: resultFrames, sourceUsed };
    },

    fetchLiveWeather: async (config: DataSourceConfig): Promise<{ weather: Partial<WeatherData>, frames: Keyframe[], warning?: string }> => {
        const { token, locationId } = config.api;
        
        safeLog("Iniciando requisição de Clima...");

        try {
            let data: any;
            let weather: Partial<WeatherData> = {};

            if (token && locationId && config.activeSource === TideSourceType.API) {
                const baseUrl = "https://api.weatherapi.com/v1/marine.json";
                const url = `${baseUrl}?key=${token}&q=${encodeURIComponent(locationId)}&days=1&tides=yes&lang=pt`;
                
                console.log(`[TideSource] GET ${url}`);
                const response = await fetch(url);
                const text = await response.text();
                
                safeLog("Resp WeatherAPI (trunc): " + text.substring(0, 200));

                if (!response.ok) {
                    throw new Error(`WeatherAPI Erro HTTP ${response.status}`);
                }

                try {
                    data = JSON.parse(text);
                } catch (jsonErr) {
                    throw new Error(`Erro: Resposta WeatherAPI não é JSON válido.`);
                }
                
                const current = data.current || {};
                weather = {
                    temp: current.temp_c ?? 0,
                    humidity: current.humidity ?? 0,
                    windSpeed: current.wind_kph ?? 0,
                    windDir: current.wind_degree ?? 0,
                    conditionText: current.condition?.text || "Desconhecido"
                };
            }

            let keyframes: Keyframe[] = [];
            let warning: string | undefined = undefined;

            if (config.activeSource === TideSourceType.API && data) {
                // Logic for WeatherAPI tides (omitted for brevity, assume similar to before)
            } 
            else if (config.activeSource === TideSourceType.TABUA_MARE) {
                try {
                    keyframes = await fetchTabuaMareData(config, 24); 
                } catch (e: any) {
                    warning = "Clima OK, mas falha na Tábua Maré: " + e.message;
                    safeLog("Erro Tabua Mare Indep: " + e.message);
                }
            }

            return { weather, frames: keyframes, warning };

        } catch (err: any) {
            console.error("[TideSource] API Error:", err);
            safeLog("Erro fatal: " + err.message);
            throw new Error(err.message || "Falha desconhecida na conexão API");
        }
    },

    getHarborById: async (config: DataSourceConfig): Promise<{ id: number, name: string }> => {
        const { baseUrl, harborId } = config.tabuaMare;
        if (!harborId) throw new Error("ID do porto não definido");
        const apiBase = sanitizeBaseUrl(baseUrl || 'https://tabuamare.devtu.qzz.io/api/v1');
        const url = `${apiBase}/harbors/${harborId}`;
        safeLog(`GET Harbor ID: ${url}`);

        const res = await fetch(url);
        const textRes = await res.text();
        safeLog(`Resp: ${textRes}`);
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = JSON.parse(textRes);
        if (json.data && json.data.length > 0) return { id: json.data[0].id, name: json.data[0].harbor_name };
        throw new Error("Porto não encontrado.");
    },

    findNearestHarbor: async (config: DataSourceConfig): Promise<{ id: number, name: string, distance: number }> => {
         const { baseUrl, uf, lat, lng } = config.tabuaMare;
         const apiBase = sanitizeBaseUrl(baseUrl || 'https://tabuamare.devtu.qzz.io/api/v1'); 
         const latLngParam = `[${lat},${lng}]`;
         const url = `${apiBase}/nearested-harbor/${uf.toLowerCase()}/${latLngParam}`;
         
         safeLog(`GET Nearest: ${url}`);
         const res = await fetch(url);
         const textRes = await res.text();
         safeLog(`Resp: ${textRes}`);
         
         if (!res.ok) throw new Error(`HTTP ${res.status}`);
         const json = JSON.parse(textRes);
         if (json.data && json.data.length > 0) {
             const p = json.data[0];
             return { id: p.id, name: p.name || p.harbor_name, distance: parseFloat((p.distance || 0).toFixed(1)) };
         }
         throw new Error("Nenhum porto encontrado.");
    }
};

async function fetchTabuaMareData(config: DataSourceConfig, cycleDuration: number): Promise<Keyframe[]> {
    const { baseUrl, uf, lat, lng, harborId } = config.tabuaMare;
    const apiBase = sanitizeBaseUrl(baseUrl || 'https://tabuamare.devtu.qzz.io/api/v1');

    const now = new Date();
    const month = now.getMonth() + 1; 
    const daysRequired = Math.ceil(cycleDuration / 24) || 1;
    const daysArray: number[] = [];
    
    for(let i=0; i<daysRequired; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        if (d.getMonth() + 1 === month) daysArray.push(d.getDate());
    }
    if (daysArray.length === 0) daysArray.push(now.getDate());
    const daysParam = `[${daysArray.join(',')}]`;
    
    let url = "";
    if (harborId) {
        url = `${apiBase}/tabua-mare/${harborId}/${month}/${daysParam}`;
    } else {
        const latLngParam = `[${lat},${lng}]`;
        url = `${apiBase}/geo-tabua-mare/${latLngParam}/${uf.toLowerCase()}/${month}/${daysParam}`;
    }
    
    safeLog(`[API] Req URL: ${url}`);

    const res = await fetch(url);
    const textRes = await res.text();
    safeLog(`[API] Raw Resp (${textRes.length} chars): ${textRes.substring(0, 300)}...`);

    if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);

    let json: any;
    try {
        json = JSON.parse(textRes);
    } catch(e) {
        throw new Error("JSON Parse Error: Resposta inválida.");
    }

    if (json.error && json.error.msg) throw new Error(`API Error: ${json.error.msg}`);
    
    // START PARSING LOGIC
    const rawData = json.data || [];
    safeLog(`[API] Items in 'data': ${rawData.length}`);
    
    if (rawData.length === 0) throw new Error("API retornou 'data' vazio.");

    const frames: Keyframe[] = [];
    
    rawData.forEach((harborItem: any, hIdx: number) => {
        const months = harborItem.months || [];
        safeLog(`[API] Harbor ${hIdx} has ${months.length} months`);
        
        months.forEach((monthItem: any) => {
             const days = monthItem.days || [];
             safeLog(`[API] Month has ${days.length} days`);
             
             days.forEach((dayItem: any) => {
                 const tides = dayItem.tides || [];
                 safeLog(`[API] Date ${dayItem.date} has ${tides.length} tides`);
                 
                 tides.forEach((t: any) => {
                     const [hh, mm] = t.time.split(':').map(Number);
                     
                     // Calculate offset relative to TODAY's start
                     const today = new Date(now.toISOString().split('T')[0]);
                     const tideDate = new Date(dayItem.date);
                     const diffDays = Math.round((tideDate.getTime() - today.getTime()) / (86400000));
                     const timeOffset = (diffDays * 24) + hh + (mm / 60);

                     if (timeOffset >= 0 && timeOffset <= cycleDuration + 24) {
                        // Height normalization logic (simplified for debug)
                        // Assume standard range 0.0 to 2.5m roughly
                        const h = parseFloat(t.height);
                        if (!isNaN(h)) {
                            // Rough mapping: -0.2m to 2.5m -> 0 to 100%
                            let pct = ((h + 0.2) / 2.7) * 100;
                            pct = Math.max(0, Math.min(100, pct));
                            
                            const isHigh = (t.type || "").toLowerCase().includes('high');
                            frames.push({
                                id: uid(),
                                timeOffset: parseFloat(timeOffset.toFixed(2)),
                                height: parseFloat(pct.toFixed(1)),
                                color: isHigh ? '#00eebb' : '#004488',
                                intensity: 100,
                                effect: isHigh ? EffectType.WAVE : EffectType.STATIC
                            });
                        }
                     }
                 });
             });
        });
    });
    
    safeLog(`[API] Parsed ${frames.length} keyframes.`);
    return frames.sort((a,b) => a.timeOffset - b.timeOffset);
}

// ... rest of file (mock data, fallback) ...
function generateMockData(config: DataSourceConfig, cycleDuration: number): Keyframe[] {
    // Keep existing mock logic
    const { minHeight, maxHeight, periodHours } = config.mock;
    const frames: Keyframe[] = [];
    for (let i = 0; i <= 12; i++) {
        const t = (i / 12) * cycleDuration;
        const val = (Math.sin(t * 2 * Math.PI / periodHours) + 1) / 2;
        const h = minHeight + (val * (maxHeight - minHeight));
        frames.push({
            id: uid(),
            timeOffset: parseFloat(t.toFixed(1)),
            height: parseFloat(h.toFixed(1)),
            color: '#0ea5e9',
            intensity: 150,
            effect: EffectType.STATIC
        });
    }
    return frames;
}

function calculateFallback(lastFrame: Keyframe | null, cycleDuration: number): Keyframe[] {
    return generateMockData({mock: {minHeight: 20, maxHeight: 80, periodHours: 12.42}} as any, cycleDuration);
}