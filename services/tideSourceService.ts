import { DataSourceConfig, Keyframe, TideSourceType, MockWaveType, EffectType, WeatherData } from "../types";
import { useAppStore } from '../store';

console.log("🟦 [TideService] Module Loading...");

// Helper to generate a random ID
const uid = () => Math.random().toString(36).substr(2, 9);

// Helper to sanitize base URLs and ensure valid structure
const sanitizeBaseUrl = (url: string) => {
    if (!url) return '';
    // Fix common double slash issues if present in middle of path
    let clean = url.replace(/([^:]\/)\/+/g, "$1"); 
    // Remove trailing slash
    clean = clean.replace(/\/+$/, '');
    return clean;
};

// Safe logger helper to avoid circular dependency crashes during init
const safeLog = (msg: string) => {
    console.log(msg);
    try {
        // Only try to update store if it's initialized
        const store = useAppStore.getState();
        if (store && store.setApiDebugLog) {
            // Append log instead of overwrite for better history
            const current = store.apiDebugLog || "";
            store.setApiDebugLog(current + "\n" + msg);
        }
    } catch (e) {
        // Ignore store errors during early init
    }
};

export const tideSourceService = {
    getTideData: async (config: DataSourceConfig, cycleDuration: number): Promise<{ frames: Keyframe[], sourceUsed: TideSourceType }> => {
        let resultFrames: Keyframe[] = [];
        let sourceUsed = TideSourceType.MOCK;

        safeLog(`\n--- [TideSource] New Request: ${config.activeSource} ---`);

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
                // Add days=3 for forecast and astronomy
                const url = `${baseUrl}?key=${token}&q=${encodeURIComponent(locationId)}&days=3&tides=yes&lang=pt`;
                
                safeLog(`[API] GET ${url}`);
                const response = await fetch(url);
                safeLog(`[API] Status: ${response.status} ${response.statusText}`);
                
                const text = await response.text();
                // Limit log size
                safeLog("Resp Payload: " + text.substring(0, 150) + "...");

                if (!response.ok) {
                    throw new Error(`WeatherAPI Erro HTTP ${response.status}`);
                }

                try {
                    data = JSON.parse(text);
                } catch (jsonErr) {
                    throw new Error(`Erro: Resposta WeatherAPI não é JSON válido.`);
                }
                
                const current = data.current || {};
                const forecastDays = data.forecast?.forecastday || [];
                const astro = forecastDays[0]?.astro || {};
                
                weather = {
                    temp: current.temp_c ?? 0,
                    humidity: current.humidity ?? 0,
                    windSpeed: current.wind_kph ?? 0,
                    windDir: current.wind_degree ?? 0,
                    conditionText: current.condition?.text || "Desconhecido",
                    
                    // Expanded Metrics
                    feelsLike: current.feelslike_c ?? current.temp_c,
                    uv: current.uv ?? 0,
                    pressure: current.pressure_mb ?? 1013,
                    cloud: current.cloud ?? 0,
                    precip: current.precip_mm ?? 0,
                    isDay: current.is_day === 1,
                    
                    // Astronomy (From Forecast Day 0)
                    sunrise: astro.sunrise ?? "06:00 AM",
                    sunset: astro.sunset ?? "06:00 PM",
                    moonPhase: astro.moon_phase ?? "Unknown",
                    moonIllumination: astro.moon_illumination ?? 50,
                    
                    // 3-Day Forecast
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    forecast: forecastDays.map((d: any) => ({
                        date: d.date, // "2023-10-25"
                        maxTemp: d.day.maxtemp_c,
                        minTemp: d.day.mintemp_c,
                        rainChance: d.day.daily_chance_of_rain,
                        condition: d.day.condition.text,
                        icon: d.day.condition.icon
                    }))
                };
            }

            let keyframes: Keyframe[] = [];
            let warning: string | undefined = undefined;

            if (config.activeSource === TideSourceType.API && data) {
                // Logic for WeatherAPI tides (if available in marine.json)
                 if (data.forecast?.forecastday) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    data.forecast.forecastday.forEach((day: any) => {
                         if (day.day?.tides) {
                             // eslint-disable-next-line @typescript-eslint/no-explicit-any
                             day.day.tides.forEach((tideSet: any) => {
                                 // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                 tideSet.tide.forEach((t: any) => {
                                     const timeStr = t.tide_time; // "2023-10-25 04:30"
                                     const dt = new Date(timeStr);
                                     const today = new Date();
                                     today.setHours(0,0,0,0);
                                     
                                     // Calculate 0-24h (or more) offset
                                     const diffMs = dt.getTime() - today.getTime();
                                     const timeOffset = diffMs / (1000 * 60 * 60);

                                     // Assuming 0-24h cycle for main view
                                     // Filter logic can be improved for multi-day
                                     
                                     const h = parseFloat(t.tide_height_mt);
                                     if (!isNaN(h)) {
                                         // Rough normalize: -0.2 to 2.5m -> 0 to 100%
                                         let pct = ((h + 0.2) / 2.7) * 100;
                                         pct = Math.max(0, Math.min(100, pct));
                                         
                                         const isHigh = t.tide_type === "HIGH";
                                         keyframes.push({
                                            id: uid(),
                                            timeOffset: parseFloat(timeOffset.toFixed(2)),
                                            height: parseFloat(pct.toFixed(1)),
                                            color: isHigh ? '#00eebb' : '#004488',
                                            intensity: 100,
                                            effect: isHigh ? EffectType.WAVE : EffectType.STATIC
                                         });
                                     }
                                 });
                             });
                         }
                    });
                    
                    // Sort
                    keyframes.sort((a,b) => a.timeOffset - b.timeOffset);
                    
                    if (keyframes.length === 0) warning = "API retornou Clima/Astro, mas SEM dados de maré.";
                 }
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
        
        safeLog(`[API] GET Harbor ID: ${url}`);

        const res = await fetch(url);
        
        // --- DIAGNOSTIC LOG START ---
        safeLog(`[API] Status: ${res.status} ${res.statusText}`);
        const headersList: string[] = [];
        res.headers.forEach((val, key) => headersList.push(`${key}: ${val}`));
        safeLog(`[API] Headers: ${JSON.stringify(headersList)}`);
        // --- DIAGNOSTIC LOG END ---

        const textRes = await res.text();
        safeLog(`[API] Resp Body: ${textRes.substring(0, 100)}...`);
        
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
         
         safeLog(`[API] GET Nearest: ${url}`);
         
         const res = await fetch(url);
         
         // --- DIAGNOSTIC LOG START ---
         safeLog(`[API] Status: ${res.status} ${res.statusText}`);
         const headersList: string[] = [];
         res.headers.forEach((val, key) => headersList.push(`${key}: ${val}`));
         safeLog(`[API] Headers: ${JSON.stringify(headersList)}`);
         // --- DIAGNOSTIC LOG END ---
         
         const textRes = await res.text();
         safeLog(`[API] Resp Body: ${textRes.substring(0, 100)}...`);
         
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
    
    // --- DIAGNOSTIC LOG START ---
    safeLog(`[API] Status: ${res.status} ${res.statusText}`);
    const headersList: string[] = [];
    res.headers.forEach((val, key) => headersList.push(`${key}: ${val}`));
    safeLog(`[API] Headers: ${JSON.stringify(headersList)}`);
    // --- DIAGNOSTIC LOG END ---

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
    
    // Logic to handle both Nested (by harbor/month) or Flat responses depending on endpoint variant
    // The previous debug showed complex nesting. Let's be robust.
    
    // Helper to process tide list
    const processTides = (tides: any[], dateStr: string) => {
         tides.forEach((t: any) => {
             const [hh, mm] = t.time.split(':').map(Number);
             
             // Calculate offset relative to TODAY's start
             const today = new Date(now.toISOString().split('T')[0]);
             const tideDate = new Date(dateStr);
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
                    
                    const isHigh = (t.type || "").toLowerCase().includes('high') || (t.type || "").toLowerCase().includes('alta');
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
    };

    rawData.forEach((item: any) => {
        // Case 1: Structure with "months" -> "days" -> "tides"
        if (item.months) {
             item.months.forEach((m: any) => {
                 if (m.days) {
                     m.days.forEach((d: any) => {
                         if (d.tides) processTides(d.tides, d.date);
                     });
                 }
             });
        } 
        // Case 2: Direct "tides" array (some endpoints might return flat)
        else if (item.tides) {
             // If date is missing on item, assume today or passed param
             processTides(item.tides, item.date || now.toISOString());
        }
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