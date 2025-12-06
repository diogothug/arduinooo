


import { DataSourceConfig, Keyframe, TideSourceType, MockWaveType, EffectType, WeatherData } from "../types";
import { useAppStore } from '../store';

console.log("🟦 [TideService] Module Loading...");

// Helper to generate a random ID
const uid = () => Math.random().toString(36).substr(2, 9);

// PROXY CONFIGURATION
// We use a public proxy to act as the "Backend" for these requests, solving the CORS issue.
const CORS_PROXY = "https://api.allorigins.win/raw?url=";

// --- HARDCODED MOCK DATA (New Moreré Data 2025) ---
const HARDCODED_TIDE_DATA = {
  "location": "morere",
  "timezone": "America/Bahia",
  "period": "até 2025-12-29",
  "tides": [
    {
      "date": "2025-12-01",
      "low": ["02:11", "14:27"],
      "high": ["08:39", "20:51"]
    },
    {
      "date": "2025-12-02",
      "low": ["02:59", "15:18"],
      "high": ["09:28", "21:41"]
    },
    {
      "date": "2025-12-03",
      "low": ["03:46", "16:05"],
      "high": ["10:15", "22:28"]
    }
  ]
};

// Robust Base URL Builder
const buildApiBase = (customBase?: string): string => {
    const defaultBase = "https://tabuamare.devtu.qzz.io/api/v1";

    if (!customBase || customBase.trim() === "") return defaultBase;

    let url = customBase.trim();

    // 1. Remove internal duplicate slashes (e.g. domain//api) keeping protocol intact
    // Captures (anything that is not a colon followed by a slash) then multiple slashes
    url = url.replace(/([^:]\/)\/+/g, "$1");

    // 2. Ensure Protocol is https://
    // Remove existing protocol if present (http or https) then prepend https://
    if (!url.startsWith("https://")) {
        url = "https://" + url.replace(/^https?:\/\//, "");
    }

    // 3. Remove trailing slashes
    url = url.replace(/\/+$/, "");

    // 4. Heuristic: If path doesn't look like it has /api, append /api/v1
    // This handles "tabuamare.devtu.qzz.io" -> "https://tabuamare.devtu.qzz.io/api/v1"
    if (!url.includes("/api")) {
        url += "/api/v1";
    }

    return url;
};

// Safe logger helper
const safeLog = (msg: string) => {
    console.log(msg);
    try {
        const store = useAppStore.getState();
        if (store && store.setApiDebugLog) {
            const current = store.apiDebugLog || "";
            store.setApiDebugLog(current + "\n" + msg);
        }
    } catch (e) {
        // Ignore
    }
};

export const tideSourceService = {
    getTideData: async (config: DataSourceConfig, cycleDuration: number): Promise<{ frames: Keyframe[], sourceUsed: TideSourceType, weather?: Partial<WeatherData> }> => {
        let resultFrames: Keyframe[] = [];
        let sourceUsed = TideSourceType.MOCK;
        let weatherResult: Partial<WeatherData> | undefined = undefined;

        safeLog(`\n--- [TideSource] New Request: ${config.activeSource} ---`);

        // 1. WeatherAPI (Global)
        if (config.activeSource === TideSourceType.API) {
            try {
                const { frames, weather } = await tideSourceService.fetchLiveWeather(config);
                weatherResult = weather;
                
                if (frames.length > 0) {
                     return { frames, sourceUsed: TideSourceType.API, weather: weatherResult };
                } else {
                    console.warn("[TideSource] WeatherAPI returned success but no tide data.");
                }
            } catch (error) {
                console.warn("[TideSource] WeatherAPI Failure, trying fallback...", error);
            }
        }

        // 2. Tábua Maré (Brasil)
        if (config.activeSource === TideSourceType.TABUA_MARE) {
             try {
                 // Note: We ignore cycleDuration here and enforce 30 days within the fetcher
                 resultFrames = await fetchTabuaMareData(config, cycleDuration);
                 // Note: Tábua Maré API currently only provides tide data, not weather.
                 // We return frames, weather remains undefined (controlled manually)
                 if (resultFrames.length > 0) {
                     return { frames: resultFrames, sourceUsed: TideSourceType.TABUA_MARE, weather: undefined };
                 }
                 throw new Error("Tábua Maré vazia.");
             } catch (error: any) {
                 console.error("[TideSource] Tábua Maré Failure:", error);
                 throw new Error(`Falha Tábua Maré: ${error.message}`); 
             }
        }

        // 3. Mock / Calculation
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

        return { frames: resultFrames, sourceUsed, weather: weatherResult };
    },

    fetchLiveWeather: async (config: DataSourceConfig): Promise<{ weather: Partial<WeatherData>, frames: Keyframe[], warning?: string }> => {
        const { token, locationId } = config.api;
        safeLog("Iniciando requisição de Clima...");

        try {
            let data: any;
            let weather: Partial<WeatherData> = {};

            if (token && locationId && config.activeSource === TideSourceType.API) {
                // Client-side fetch
                const baseUrl = "https://api.weatherapi.com/v1/marine.json";
                const url = `${baseUrl}?key=${token}&q=${encodeURIComponent(locationId)}&days=3&tides=yes&lang=pt`;
                
                safeLog(`[API] GET ${url}`);
                const response = await fetch(url, { referrerPolicy: 'no-referrer' });
                safeLog(`[API] Status: ${response.status} ${response.statusText}`);
                
                if (!response.ok) throw new Error(`WeatherAPI Erro HTTP ${response.status}`);
                
                data = await response.json();
                
                const current = data.current || {};
                const forecastDays = data.forecast?.forecastday || [];
                const astro = forecastDays[0]?.astro || {};
                
                weather = {
                    temp: current.temp_c ?? 0,
                    humidity: current.humidity ?? 0,
                    windSpeed: current.wind_kph ?? 0,
                    windDir: current.wind_degree ?? 0,
                    conditionText: current.condition?.text || "Desconhecido",
                    feelsLike: current.feelslike_c ?? current.temp_c,
                    uv: current.uv ?? 0,
                    pressure: current.pressure_mb ?? 1013,
                    cloud: current.cloud ?? 0,
                    precip: current.precip_mm ?? 0,
                    isDay: current.is_day === 1,
                    sunrise: astro.sunrise ?? "06:00 AM",
                    sunset: astro.sunset ?? "06:00 PM",
                    moonPhase: astro.moon_phase ?? "Unknown",
                    moonIllumination: astro.moon_illumination ?? 50,
                    forecast: forecastDays.map((d: any) => ({
                        date: d.date,
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

            if (config.activeSource === TideSourceType.API && data && data.forecast?.forecastday) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data.forecast.forecastday.forEach((day: any) => {
                        if (day.day?.tides) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            day.day.tides.forEach((tideSet: any) => {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                tideSet.tide.forEach((t: any) => {
                                    const timeStr = t.tide_time;
                                    const dt = new Date(timeStr);
                                    const today = new Date();
                                    today.setHours(0,0,0,0);
                                    const diffMs = dt.getTime() - today.getTime();
                                    const timeOffset = diffMs / (1000 * 60 * 60);
                                    
                                    const h = parseFloat(t.tide_height_mt);
                                    if (!isNaN(h)) {
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
                keyframes.sort((a,b) => a.timeOffset - b.timeOffset);
                if (keyframes.length === 0) warning = "API retornou Clima, mas SEM dados de maré.";
            }

            return { weather, frames: keyframes, warning };

        } catch (err: any) {
            console.error("[TideSource] API Error:", err);
            throw new Error(err.message || "Falha desconhecida na conexão API");
        }
    },

    getHarborById: async (config: DataSourceConfig): Promise<{ id: number, name: string }> => {
        const { baseUrl, harborId } = config.tabuaMare;
        if (!harborId) throw new Error("ID do porto não definido");
        
        const apiBase = buildApiBase(baseUrl);
        
        // Correct endpoint: /harbors/{id}
        const targetUrl = `${apiBase}/harbors/${harborId}`;
        safeLog(`[API] Target URL: ${targetUrl}`);
        
        // PROXY IMPLEMENTATION
        const proxyUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;
        safeLog(`[API] Proxy URL: ${proxyUrl}`);
        
        const res = await fetch(proxyUrl, { 
            headers: { 'Accept': 'application/json' },
            referrerPolicy: 'no-referrer' 
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const text = await res.text();
        if (text.trim().startsWith("<")) {
            throw new Error("Proxy devolveu HTML (provável erro no endpoint/URL)");
        }

        const json = JSON.parse(text);
        
        if (json.data && json.data.length > 0) return { id: json.data[0].id, name: json.data[0].harbor_name };
        
        throw new Error("Porto não encontrado (Dados vazios).");
    },

    findNearestHarbor: async (config: DataSourceConfig): Promise<{ id: number, name: string, distance: number }> => {
         const { baseUrl, uf, lat, lng } = config.tabuaMare;
         const apiBase = buildApiBase(baseUrl);
         
         // Use plain encoding for brackets to avoid double encoding by encodeURIComponent
         const latLngParam = `[${lat},${lng}]`;
         
         const targetUrl = `${apiBase}/nearested-harbor/${uf.toLowerCase()}/${latLngParam}`;
         safeLog(`[API] Target URL: ${targetUrl}`);

         // PROXY IMPLEMENTATION
         const proxyUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;
         safeLog(`[API] Proxy URL: ${proxyUrl}`);
         
         const res = await fetch(proxyUrl, { 
             headers: { 'Accept': 'application/json' },
             referrerPolicy: 'no-referrer'
         });
         
         if (!res.ok) throw new Error(`HTTP ${res.status}`);

         const text = await res.text();
         if (text.trim().startsWith("<")) {
             throw new Error("Proxy devolveu HTML (provável erro no endpoint/URL)");
         }

         const json = JSON.parse(text);
         
         // Handle both single object return (seen in logs) and data array (standard)
         let p = null;
         if (json.data && Array.isArray(json.data) && json.data.length > 0) {
             p = json.data[0];
         } else if (json.id) {
             p = json;
         }

         if (p) {
             return { id: p.id, name: p.name || p.harbor_name, distance: parseFloat((p.distance || 0).toFixed(1)) };
         }
         
         throw new Error("Nenhum porto encontrado.");
    },
};

// --- UPDATED FETCH LOGIC: RETRY 30 DAYS -> 2 DAYS ---
async function fetchTabuaMareData(config: DataSourceConfig, cycleDuration: number): Promise<Keyframe[]> {
    // Attempt 1: 30 Days (Standard)
    try {
        return await fetchTabuaMareDataDuration(config, 30);
    } catch (e: any) {
        console.warn(`[TideSource] Falha ao buscar 30 dias: ${e.message}. Tentando fallback para 2 dias...`);
        safeLog(`[API] Aviso: Falha em 30 dias (${e.message}). Tentando buscar apenas 2 dias...`);
        
        // Attempt 2: 2 Days (Fallback)
        try {
            return await fetchTabuaMareDataDuration(config, 2);
        } catch (e2: any) {
            // Throw original error or new error if both fail
            throw new Error(`Falha na API Maré (30d e 2d): ${e2.message}`);
        }
    }
}

async function fetchTabuaMareDataDuration(config: DataSourceConfig, totalDays: number): Promise<Keyframe[]> {
    const { baseUrl, uf, lat, lng, harborId } = config.tabuaMare;
    const apiBase = buildApiBase(baseUrl);

    const now = new Date();
    const allFrames: Keyframe[] = [];

    // 1. Organize days into Month buckets (to handle Month rollover)
    // Example: Map { "2023-10": [28,29,30,31], "2023-11": [1,2,3...] }
    const monthsMap = new Map<string, number[]>();

    for (let i = 0; i < totalDays; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (!monthsMap.has(key)) monthsMap.set(key, []);
        monthsMap.get(key)!.push(d.getDate());
    }

    safeLog(`[API] Preparing ${totalDays}-day fetch across ${monthsMap.size} month(s).`);

    // 2. Fetch function for a single batch
    const fetchBatch = async (year: number, month: number, days: number[]) => {
         // IMPORTANT: Use plain brackets: [ ... ]
         // encodeURIComponent will perform the single encoding to %5B...%5D
         // If we manually put %5B here, encodeURIComponent turns it into %255B (double encoding)
         const daysParam = `[${days.join(',')}]`;
         
         let targetUrl = "";

         if (harborId) {
            targetUrl = `${apiBase}/tabua-mare/${harborId}/${month}/${daysParam}`;
        } else {
            const latLngParam = `[${lat},${lng}]`;
            targetUrl = `${apiBase}/geo-tabua-mare/${latLngParam}/${uf.toLowerCase()}/${month}/${daysParam}`;
        }

        const proxyUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;
        safeLog(`[API] Batch ${month}/${year} (${days.length} days): ${targetUrl}`);

        const res = await fetch(proxyUrl, { headers: { 'Accept': 'application/json' }, referrerPolicy: 'no-referrer' });
        
        if (!res.ok) {
            safeLog(`[API] HTTP Error ${res.status}`);
            throw new Error(`HTTP ${res.status} on month ${month}/${year}`);
        }

        const text = await res.text();
        // Log raw text for debugging
        safeLog(`[API] Raw Response (${text.length} chars): ${text.substring(0, 200)}...`);

        if (text.trim().startsWith("<")) throw new Error(`Proxy returned HTML error for month ${month}/${year}`);

        const json = JSON.parse(text);
        
        // Handle API Level Errors
        if (json.error) {
            const msg = typeof json.error === 'string' ? json.error : (json.error.message || json.error.msg || "Unknown API Error");
            throw new Error(msg);
        }

        const rawData = json.data || [];

        // Updated Parsing Logic for New API Structure
        // Expected: item -> months -> days -> hours -> { hour: "HH:MM:SS", level: "2.1" }
        rawData.forEach((item: any) => {
             const monthsList = item.months || [];
             
             monthsList.forEach((m: any) => {
                 const daysList = m.days || [];
                 
                 daysList.forEach((d: any) => {
                     const dateStr = d.date; // "YYYY-MM-DD"
                     const hoursList = d.hours || [];

                     // Sort hours first to properly determine structure/extrema
                     // And map to numeric time for simpler logic
                     const parsedHours = hoursList.map((hObj: any) => {
                         const parts = (hObj.hour || "").split(':');
                         const hh = parseInt(parts[0], 10) || 0;
                         const mm = parseInt(parts[1], 10) || 0;
                         const t = hh + (mm / 60);
                         const val = parseFloat(hObj.level);
                         return { ...hObj, hh, mm, t, val };
                     }).sort((a: any, b: any) => a.t - b.t);

                     if (parsedHours.length === 0) return;

                     // Determine Day Mean Level to infer High/Low
                     // (Since 'type' field is missing in new API)
                     const levels = parsedHours.map((x: any) => x.val).filter((v: number) => !isNaN(v));
                     const minL = Math.min(...levels);
                     const maxL = Math.max(...levels);
                     const midL = (minL + maxL) / 2;
                     
                     parsedHours.forEach((hObj: any) => {
                         const { hh, mm, val } = hObj;
                         
                         if (!isNaN(hh) && !isNaN(mm) && !isNaN(val)) {
                            // Date math (Local vs UTC handling)
                            // We treat "YYYY-MM-DD" + Hour as relative time from "now"
                            const today = new Date(now.toISOString().split('T')[0]); 
                            const tideDate = new Date(dateStr); 

                            const diffMs = tideDate.getTime() - today.getTime();
                            const diffDays = Math.round(diffMs / 86400000);
                            
                            const timeOffset = (diffDays * 24) + hh + (mm / 60);

                            // Filter valid window
                            if (timeOffset >= -2 && timeOffset <= (totalDays * 24) + 24) {
                                // Normalize (Approx: -0.2 to 2.9m -> 0 to 100%)
                                let pct = ((val + 0.2) / 2.9) * 100;
                                pct = Math.max(0, Math.min(100, pct));
                                
                                // Infer High/Low since 'type' is missing
                                // Using day's median threshold
                                const isHigh = val > midL;
                                
                                allFrames.push({
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
    };

    // 3. Execute Batches sequentially
    for (const [key, days] of monthsMap) {
        const [y, m] = key.split('-').map(Number);
        try {
            await fetchBatch(y, m, days);
        } catch(e: any) {
            console.warn(`Batch failed for ${key}: ${e.message}`);
            safeLog(`[API] Warn: Batch ${key} failed (${e.message}), skipping.`);
            // We continue to next batch to get partial data rather than crashing entire flow
        }
    }

    if (allFrames.length === 0) throw new Error(`Nenhum dado retornado para os próximos ${totalDays} dias (Verifique conexão ou ID do porto).`);

    return allFrames.sort((a,b) => a.timeOffset - b.timeOffset);
}

// Replaced generic math generation with Hardcoded Data Parsing (Updated with better data)
function generateMockData(config: DataSourceConfig, cycleDuration: number): Keyframe[] {
    safeLog("[TideSource] Usando dados estáticos (Moreré 2025 Melhorados)...");
    
    const frames: Keyframe[] = [];
    const tides = HARDCODED_TIDE_DATA.tides;
    
    // Iterate over the days provided
    tides.forEach((dayData, dayIndex) => {
        // Parse High Tides
        dayData.high.forEach((timeStr) => {
             const [hh, mm] = timeStr.split(':').map(Number);
             const timeOffset = (dayIndex * 24) + hh + (mm / 60);
             
             // High Tide = ~95%
             frames.push({
                 id: uid(),
                 timeOffset: parseFloat(timeOffset.toFixed(2)),
                 height: 95,
                 color: '#00eebb', // Cyan/Green for High
                 intensity: 200,
                 effect: EffectType.WAVE
             });
        });

        // Parse Low Tides
        dayData.low.forEach((timeStr) => {
             const [hh, mm] = timeStr.split(':').map(Number);
             const timeOffset = (dayIndex * 24) + hh + (mm / 60);
             
             // Low Tide = ~15%
             frames.push({
                 id: uid(),
                 timeOffset: parseFloat(timeOffset.toFixed(2)),
                 height: 15,
                 color: '#004488', // Dark Blue for Low
                 intensity: 50,
                 effect: EffectType.STATIC
             });
        });
    });
    
    // Sort frames by time
    return frames.sort((a,b) => a.timeOffset - b.timeOffset);
}

function calculateFallback(lastFrame: Keyframe | null, cycleDuration: number): Keyframe[] {
    // Basic math fallback if even the hardcoded data fails
    const frames: Keyframe[] = [];
    const limit = Math.ceil(cycleDuration / 12) * 12 + 12;
    for (let i = 0; i <= limit; i++) {
        const t = i;
        const val = (Math.sin(t * 2 * Math.PI / 12.42) + 1) / 2;
        const h = 20 + (val * 60);
        if(t <= cycleDuration) {
             frames.push({
                id: uid(),
                timeOffset: parseFloat(t.toFixed(1)),
                height: parseFloat(h.toFixed(1)),
                color: '#0ea5e9',
                intensity: 150,
                effect: EffectType.STATIC
            });
        }
    }
    return frames;
}