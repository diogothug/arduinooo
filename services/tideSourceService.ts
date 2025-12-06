

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
    // FIXED: Ensure no trailing space
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

        // 0. Calculated/Fallback Logic explicitly requested
        if (config.activeSource === TideSourceType.CALCULATED) {
             safeLog("[TideSource] Mode: CALCULATED (Algorithm Fallback)");
             if (config.lastValidData) {
                 resultFrames = calculateFallback(config.lastValidData, cycleDuration);
                 return { frames: resultFrames, sourceUsed: TideSourceType.CALCULATED, weather: undefined };
             }
             // If no last data, fall through to mock
             safeLog("[TideSource] No last valid data for Calculation. Falling to Mock.");
        }

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
                 safeLog(`[TideSource] ERRO FATAL API: ${error.message}`);
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
                                        let pct = ((h + 2.0) / 4.5) * 100; // Adjusted for global variance
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
        safeLog(`[API] Harbor Lookup: ${targetUrl}`);
        
        // PROXY IMPLEMENTATION
        const proxyUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;
        
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
        if (json.id) return { id: json.id, name: json.harbor_name || json.name }; // Alternative format
        
        throw new Error("Porto não encontrado (Dados vazios).");
    },

    findNearestHarbor: async (config: DataSourceConfig): Promise<{ id: number, name: string, distance: number }> => {
         const { baseUrl, uf, lat, lng } = config.tabuaMare;
         const apiBase = buildApiBase(baseUrl);
         
         // RAW BRACKETS FOR NEAREST SEARCH
         const latLngParam = `[${lat},${lng}]`;
         
         const targetUrl = `${apiBase}/nearested-harbor/${uf.toLowerCase()}/${latLngParam}`;
         safeLog(`[API] Nearest URL: ${targetUrl}`);

         // PROXY IMPLEMENTATION
         const proxyUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;
         
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

// --- UPDATED FETCH LOGIC ---
async function fetchTabuaMareData(config: DataSourceConfig, cycleDuration: number): Promise<Keyframe[]> {
    // START WITH 3 DAYS AS REQUESTED FOR STABILITY
    const INITIAL_FETCH_DAYS = 3;

    try {
        safeLog(`[API] Tentando buscar ${INITIAL_FETCH_DAYS} dias...`);
        return await fetchTabuaMareDataDuration(config, INITIAL_FETCH_DAYS);
    } catch (e: any) {
        console.warn(`[TideSource] Falha em ${INITIAL_FETCH_DAYS} dias: ${e.message}`);
        safeLog(`[API] ERRO: Falha na busca (${e.message}).`);
        throw new Error(`Falha na API Maré: ${e.message}`);
    }
}

async function fetchTabuaMareDataDuration(config: DataSourceConfig, totalDays: number): Promise<Keyframe[]> {
    const { baseUrl, uf, lat, lng, harborId } = config.tabuaMare;
    const apiBase = buildApiBase(baseUrl);

    const now = new Date();
    const allFrames: Keyframe[] = [];

    // 1. Organize days into Month buckets
    const monthsMap = new Map<string, number[]>();

    for (let i = 0; i < totalDays; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (!monthsMap.has(key)) monthsMap.set(key, []);
        monthsMap.get(key)!.push(d.getDate());
    }

    safeLog(`[API] Plan: ${totalDays} dias em ${monthsMap.size} lotes.`);

    // 2. Fetch function for a single batch
    const fetchBatch = async (year: number, month: number, days: number[]) => {
         // IMPORTANT: Use plain brackets: [ ... ] NO SPACES
         // encodeURIComponent will perform the single encoding to %5B...%5D
         const daysParam = `[${days.join(',')}]`;
         
         let targetUrl = "";

         if (harborId) {
            targetUrl = `${apiBase}/tabua-mare/${harborId}/${month}/${daysParam}`;
        } else {
            const latLngParam = `[${lat},${lng}]`;
            targetUrl = `${apiBase}/geo-tabua-mare/${latLngParam}/${uf.toLowerCase()}/${month}/${daysParam}`;
        }

        safeLog(`[API] TARGET (RAW): ${targetUrl}`);

        // ENCODE ONCE FOR PROXY
        const proxyUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;
        safeLog(`[API] PROXY REQ: ${proxyUrl}`);

        const res = await fetch(proxyUrl, { headers: { 'Accept': 'application/json' }, referrerPolicy: 'no-referrer' });
        
        if (!res.ok) {
            safeLog(`[API] HTTP Error ${res.status}`);
            throw new Error(`HTTP ${res.status} on month ${month}/${year}`);
        }

        const text = await res.text();
        // Log raw text for debugging
        safeLog(`[API] RAW RESP (${text.length} chars): ${text.substring(0, 150)}...`);

        if (text.trim().startsWith("<")) {
            safeLog("[API] HTML ERROR DETECTED IN RESPONSE");
            throw new Error(`Proxy returned HTML error for month ${month}/${year}`);
        }

        const json = JSON.parse(text);
        
        // Handle API Level Errors
        if (json.error) {
            const msg = typeof json.error === 'string' ? json.error : (json.error.message || json.error.msg || "Unknown API Error");
            throw new Error(msg);
        }

        // Updated Parsing Logic for 2025 API Structure
        const records = Array.isArray(json.data) ? json.data : [json.data].filter(Boolean);

        for (const record of records) {
            const months = record.months || [];
            for (const m of months) {
                const daysList = m.days || [];
                for (const day of daysList) {
                    // Normalize date format YYYY-MM-DD
                    const dateStr = day.date || `${year}-${month.toString().padStart(2,'0')}-${(day.day||1).toString().padStart(2,'0')}`;
                    
                    // Handle field name variation (hours vs tides)
                    const hoursList = day.hours || day.tides || [];

                    hoursList.forEach((h: any) => {
                         const hourStr = (h.hour || h.time || "").trim();
                         if (!hourStr) return;

                         const [hh, mm] = hourStr.split(':').map((s: string) => parseInt(s, 10) || 0);
                         const val = parseFloat(h.level || h.height || h.value);

                         if (isNaN(val) || isNaN(hh)) return;

                         const tideDate = new Date(dateStr); 
                         // To calculate offset relative to TODAY "now"
                         const d1 = new Date(tideDate.toISOString().split('T')[0]);
                         const d2 = new Date(now.toISOString().split('T')[0]);
                         const diffMs = d1.getTime() - d2.getTime();
                         const diffDays = Math.round(diffMs / 86400000);
                         
                         const timeOffset = (diffDays * 24) + hh + (mm / 60);

                         // Filter data within our cycle window (+buffer)
                         if (timeOffset >= -2 && timeOffset <= (totalDays * 24) + 24) {
                             // Normalize height (approx -0.2m to 2.8m range for BR coast)
                             let pct = ((val + 0.2) / 3.0) * 100;
                             pct = Math.max(0, Math.min(100, pct));
                             
                             // Detect High/Low
                             const isHigh = val > 1.3; 
                             
                             allFrames.push({
                                 id: uid(),
                                 timeOffset: parseFloat(timeOffset.toFixed(2)),
                                 height: parseFloat(pct.toFixed(1)),
                                 color: isHigh ? '#00eebb' : '#004488',
                                 intensity: 100,
                                 effect: isHigh ? EffectType.WAVE : EffectType.STATIC
                             });
                         }
                    });
                }
            }
        }
    };

    // 3. Execute Batches sequentially
    for (const [key, days] of monthsMap) {
        const [y, m] = key.split('-').map(Number);
        try {
            await fetchBatch(y, m, days);
        } catch(e: any) {
            console.warn(`Batch failed for ${key}: ${e.message}`);
            safeLog(`[API] Warn: Batch ${key} failed (${e.message}), skipping.`);
        }
    }

    if (allFrames.length === 0) throw new Error(`Nenhum dado retornado para os próximos ${totalDays} dias.`);

    return allFrames.sort((a,b) => a.timeOffset - b.timeOffset);
}

function generateMockData(config: DataSourceConfig, cycleDuration: number): Keyframe[] {
    safeLog("[TideSource] Usando dados estáticos (Moreré 2025 Melhorados)...");
    
    const frames: Keyframe[] = [];
    const tides = HARDCODED_TIDE_DATA.tides;
    
    tides.forEach((dayData, dayIndex) => {
        dayData.high.forEach((timeStr) => {
             const [hh, mm] = timeStr.split(':').map(Number);
             const timeOffset = (dayIndex * 24) + hh + (mm / 60);
             frames.push({
                 id: uid(),
                 timeOffset: parseFloat(timeOffset.toFixed(2)),
                 height: 95,
                 color: '#00eebb',
                 intensity: 200,
                 effect: EffectType.WAVE
             });
        });
        dayData.low.forEach((timeStr) => {
             const [hh, mm] = timeStr.split(':').map(Number);
             const timeOffset = (dayIndex * 24) + hh + (mm / 60);
             frames.push({
                 id: uid(),
                 timeOffset: parseFloat(timeOffset.toFixed(2)),
                 height: 15,
                 color: '#004488',
                 intensity: 50,
                 effect: EffectType.STATIC
             });
        });
    });
    
    return frames.sort((a,b) => a.timeOffset - b.timeOffset);
}

function calculateFallback(lastFrame: Keyframe | null, cycleDuration: number): Keyframe[] {
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