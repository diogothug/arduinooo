








import { DataSourceConfig, Keyframe, TideSourceType, MockWaveType, EffectType, WeatherData } from "../types";
import { useAppStore } from '../store';

console.log("🟦 [TideService] Module Loading...");

// Helper to generate a random ID
const uid = () => Math.random().toString(36).substr(2, 9);

// PROXY CONFIGURATION
// We use a public proxy to act as the "Backend" for these requests, solving the CORS issue.
const CORS_PROXY = "https://api.allorigins.win/raw?url=";

// --- DYNAMIC MOCK DATA GENERATOR ---
const generateCurrentMockData = () => {
    const today = new Date();
    const data = {
        "location": "morere",
        "timezone": "America/Bahia",
        "tides": [] as any[]
    };

    // Generate 3 days of data starting today
    for (let i = 0; i < 3; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Shift times slightly each day to simulate lunar cycle (~50min shift)
        const shiftMinutes = i * 50; 
        const h1 = Math.floor((2 * 60 + 11 + shiftMinutes) / 60) % 24;
        const m1 = (2 * 60 + 11 + shiftMinutes) % 60;
        
        const h2 = Math.floor((14 * 60 + 27 + shiftMinutes) / 60) % 24;
        const m2 = (14 * 60 + 27 + shiftMinutes) % 60;

        const h3 = Math.floor((8 * 60 + 39 + shiftMinutes) / 60) % 24;
        const m3 = (8 * 60 + 39 + shiftMinutes) % 60;

        const h4 = Math.floor((20 * 60 + 51 + shiftMinutes) / 60) % 24;
        const m4 = (20 * 60 + 51 + shiftMinutes) % 60;

        data.tides.push({
            "date": dateStr,
            "low": [
                `${String(h1).padStart(2,'0')}:${String(m1).padStart(2,'0')}`, 
                `${String(h2).padStart(2,'0')}:${String(m2).padStart(2,'0')}`
            ],
            "high": [
                `${String(h3).padStart(2,'0')}:${String(m3).padStart(2,'0')}`, 
                `${String(h4).padStart(2,'0')}:${String(m4).padStart(2,'0')}`
            ]
        });
    }
    return data;
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
             safeLog("[TideSource] Mode: CALCULATED (Mathematical)");
             resultFrames = generateCalculatedTides(config, cycleDuration);
             return { frames: resultFrames, sourceUsed: TideSourceType.CALCULATED, weather: undefined };
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

        // 2. Open-Meteo (Fallback Weather + Calc Tides)
        if (config.activeSource === TideSourceType.OPEN_METEO) {
             try {
                 safeLog("[TideSource] Mode: OPEN_METEO Fallback (Marine & Weather)");
                 const { weather } = await fetchOpenMeteoData(config);
                 weatherResult = weather;
                 
                 // Generate Calculated Tides as fallback because Open-Meteo URL provided is only weather
                 resultFrames = generateCalculatedTides(config, cycleDuration);
                 
                 return { frames: resultFrames, sourceUsed: TideSourceType.OPEN_METEO, weather: weatherResult };
             } catch (error: any) {
                 safeLog(`[TideSource] OPEN_METEO Failure: ${error.message}`);
                 // Fallthrough to mock
             }
        }

        // 3. Tábua Maré (Brasil)
        if (config.activeSource === TideSourceType.TABUA_MARE) {
             try {
                 // Fetch duration is passed from TideSourceConfig logic (e.g. 7 days or 3 days)
                 const daysToFetch = cycleDuration > 30 ? 3 : cycleDuration; // Sanity check if accidentally passed hours (168)
                 
                 resultFrames = await fetchTabuaMareData(config, daysToFetch);
                 
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

        // 4. Mock / Calculation
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
                    })),
                    // Mock hourly for WeatherAPI as it's complex to extract cleanly in this snippet
                    hourlyRain: [0,0,0,0,0,0,0,0] 
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
        const targetUrl = `${apiBase}/harbors/${harborId}`;
        safeLog(`[API] Harbor Lookup: ${targetUrl}`);
        
        const proxyUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;
        
        const res = await fetch(proxyUrl, { 
            headers: { 'Accept': 'application/json' },
            referrerPolicy: 'no-referrer' 
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const text = await res.text();
        if (text.trim().startsWith("<")) throw new Error("Proxy devolveu HTML");

        const json = JSON.parse(text);
        
        if (json.data && json.data.length > 0) return { id: json.data[0].id, name: json.data[0].harbor_name };
        if (json.id) return { id: json.id, name: json.harbor_name || json.name };
        
        throw new Error("Porto não encontrado (Dados vazios).");
    },

    findNearestHarbor: async (config: DataSourceConfig): Promise<{ id: number, name: string, distance: number }> => {
         const { baseUrl, uf, lat, lng } = config.tabuaMare;
         const apiBase = buildApiBase(baseUrl);
         const latLngParam = `[${lat},${lng}]`;
         const targetUrl = `${apiBase}/nearested-harbor/${uf.toLowerCase()}/${latLngParam}`;
         safeLog(`[API] Nearest URL: ${targetUrl}`);

         const proxyUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;
         const res = await fetch(proxyUrl, { 
             headers: { 'Accept': 'application/json' },
             referrerPolicy: 'no-referrer'
         });
         
         if (!res.ok) throw new Error(`HTTP ${res.status}`);

         const text = await res.text();
         if (text.trim().startsWith("<")) throw new Error("Proxy devolveu HTML");

         const json = JSON.parse(text);
         let p = null;
         if (json.data && Array.isArray(json.data) && json.data.length > 0) p = json.data[0];
         else if (json.id) p = json;

         if (p) return { id: p.id, name: p.name || p.harbor_name, distance: parseFloat((p.distance || 0).toFixed(1)) };
         
         throw new Error("Nenhum porto encontrado.");
    },
};

// --- HELPER FUNCTIONS ---

async function fetchOpenMeteoData(config: DataSourceConfig) {
    const { lat, lng } = config.tabuaMare; 
    
    // 1. Weather + Hourly Rain
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=precipitation_probability`;
    // 2. Marine (Waves)
    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&hourly=wave_height,wave_direction,wave_period&timezone=auto`;
    
    safeLog(`[OpenMeteo] GET Weather: ${weatherUrl}`);
    safeLog(`[OpenMeteo] GET Marine: ${marineUrl}`);
    
    const [resWeather, resMarine] = await Promise.all([
        fetch(weatherUrl),
        fetch(marineUrl)
    ]);
    
    if (!resWeather.ok) throw new Error("OpenMeteo Weather HTTP " + resWeather.status);
    
    let marineJson = null;
    if (resMarine.ok) {
        marineJson = await resMarine.json();
    } else {
        safeLog(`[OpenMeteo] Marine fetch failed or inland (HTTP ${resMarine.status})`);
    }
    
    const jsonWeather = await resWeather.json();
    const curr = jsonWeather.current_weather;
    
    let waveData = { height: 0, direction: 0, period: 0 };
    let hourlyRain: number[] = [];

    // Process Hourly Rain (Next 8-12 hours)
    if (jsonWeather.hourly && jsonWeather.hourly.precipitation_probability) {
        // Find current index based on time
        const nowStr = new Date().toISOString().substring(0, 13); // "2023-10-27T10"
        const times = jsonWeather.hourly.time as string[];
        const probs = jsonWeather.hourly.precipitation_probability as number[];
        
        let startIdx = 0;
        for(let i=0; i<times.length; i++) {
            if(times[i].startsWith(nowStr)) { startIdx = i; break; }
        }
        
        // Grab next 8 hours
        hourlyRain = probs.slice(startIdx, startIdx + 8);
        safeLog(`[OpenMeteo] Rain Prob (Next 8h): ${hourlyRain.join(', ')}%`);
    }

    if (marineJson && marineJson.hourly) {
        // Find current hour index.
        const now = new Date();
        const times = marineJson.hourly.time as string[];
        
        let minDiff = Infinity;
        let idx = 0;
        
        // Simple closest match
        for (let i = 0; i < times.length; i++) {
            const tDate = new Date(times[i]);
            const diff = Math.abs(now.getTime() - tDate.getTime());
            if (diff < minDiff) {
                minDiff = diff;
                idx = i;
            } else if (diff > minDiff) {
                // Since times are sorted, once diff increases, we passed the optimal point
                break;
            }
        }

        waveData = {
            height: marineJson.hourly.wave_height[idx] || 0,
            direction: marineJson.hourly.wave_direction[idx] || 0,
            period: marineJson.hourly.wave_period[idx] || 0
        };
        safeLog(`[OpenMeteo] Wave Data: ${waveData.height}m, ${waveData.direction}deg, ${waveData.period}s`);
    }
    
    // Map to WeatherData
    const weather: Partial<WeatherData> = {
        temp: curr.temperature,
        windSpeed: curr.windspeed,
        windDir: curr.winddirection,
        isDay: curr.is_day === 1,
        conditionText: "Code: " + curr.weathercode,
        // Defaults for missing data in this specific endpoint
        humidity: 60,
        pressure: 1013,
        uv: 0,
        precip: 0,
        wave: waveData,
        hourlyRain: hourlyRain
    };
    
    return { weather };
}

function generateCalculatedTides(config: DataSourceConfig, duration: number): Keyframe[] {
    const { period, amplitude, offset, phase } = config.calculation;
    const frames: Keyframe[] = [];
    const step = 1.0; 
    
    for(let t = 0; t <= duration; t += step) {
        // y = offset + amp * sin(2pi * (t + phase) / period)
        const rads = 2 * Math.PI * (t + phase) / period;
        let y = offset + amplitude * Math.sin(rads);
        y = Math.max(0, Math.min(100, y));
        
        frames.push({
            id: uid(),
            timeOffset: parseFloat(t.toFixed(1)),
            height: parseFloat(y.toFixed(1)),
            color: '#0ea5e9',
            intensity: 150,
            effect: EffectType.STATIC
        });
    }
    return frames.sort((a,b) => a.timeOffset - b.timeOffset);
}

// Deprecated in favor of generateCalculatedTides but kept for legacy fallback
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

async function fetchTabuaMareData(config: DataSourceConfig, daysToFetch: number): Promise<Keyframe[]> {
    const safeDays = (daysToFetch > 30) ? 3 : (daysToFetch < 1 ? 1 : daysToFetch);

    try {
        safeLog(`[API] Tentando buscar ${safeDays} dias...`);
        return await fetchTabuaMareDataDuration(config, safeDays);
    } catch (e: any) {
        console.warn(`[TideSource] Falha em ${safeDays} dias: ${e.message}`);
        safeLog(`[API] ERRO: Falha na busca (${e.message}).`);
        throw new Error(`Falha na API Maré: ${e.message}`);
    }
}

async function fetchTabuaMareDataDuration(config: DataSourceConfig, totalDays: number): Promise<Keyframe[]> {
    const { baseUrl, uf, lat, lng, harborId } = config.tabuaMare;
    const apiBase = buildApiBase(baseUrl);

    const now = new Date();
    const allFrames: Keyframe[] = [];

    const monthsMap = new Map<string, number[]>();

    for (let i = 0; i < totalDays; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (!monthsMap.has(key)) monthsMap.set(key, []);
        monthsMap.get(key)!.push(d.getDate());
    }

    safeLog(`[API] Plan: ${totalDays} dias em ${monthsMap.size} lotes.`);

    const fetchBatch = async (year: number, month: number, days: number[]) => {
         const daysParam = `[${days.join(',')}]`;
         
         let targetUrl = "";

         if (harborId) {
            targetUrl = `${apiBase}/tabua-mare/${harborId}/${month}/${daysParam}`;
        } else {
            const latLngParam = `[${lat},${lng}]`;
            targetUrl = `${apiBase}/geo-tabua-mare/${latLngParam}/${uf.toLowerCase()}/${month}/${daysParam}`;
        }

        safeLog(`[API] TARGET (RAW): ${targetUrl}`);
        const proxyUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;
        safeLog(`[API] PROXY REQ: ${proxyUrl}`);

        const res = await fetch(proxyUrl, { headers: { 'Accept': 'application/json' }, referrerPolicy: 'no-referrer' });
        
        if (!res.ok) {
            safeLog(`[API] HTTP Error ${res.status}`);
            throw new Error(`HTTP ${res.status} on month ${month}/${year}`);
        }

        const text = await res.text();
        safeLog(`[API] RAW RESP (${text.length} chars): ${text.substring(0, 150)}...`);

        if (text.trim().startsWith("<")) {
            safeLog("[API] HTML ERROR DETECTED IN RESPONSE");
            throw new Error(`Proxy returned HTML error for month ${month}/${year}`);
        }

        const json = JSON.parse(text);
        if (json.error) {
            const msg = typeof json.error === 'string' ? json.error : (json.error.message || json.error.msg || "Unknown API Error");
            throw new Error(msg);
        }

        const records = Array.isArray(json.data) ? json.data : [json.data].filter(Boolean);

        for (const record of records) {
            const months = record.months || [];
            for (const m of months) {
                const daysList = m.days || [];
                for (const day of daysList) {
                    const dateStr = day.date || `${year}-${month.toString().padStart(2,'0')}-${(day.day||1).toString().padStart(2,'0')}`;
                    const hoursList = day.hours || day.tides || [];

                    hoursList.forEach((h: any) => {
                         const hourStr = (h.hour || h.time || "").trim();
                         if (!hourStr) return;

                         const [hh, mm] = hourStr.split(':').map((s: string) => parseInt(s, 10) || 0);
                         const val = parseFloat(h.level || h.height || h.value);

                         if (isNaN(val) || isNaN(hh)) return;

                         const tideDate = new Date(dateStr); 
                         const d1 = new Date(tideDate.toISOString().split('T')[0]);
                         const d2 = new Date(now.toISOString().split('T')[0]);
                         const diffMs = d1.getTime() - d2.getTime();
                         const diffDays = Math.round(diffMs / 86400000);
                         
                         const timeOffset = (diffDays * 24) + hh + (mm / 60);

                         if (timeOffset >= -2 && timeOffset <= (totalDays * 24) + 24) {
                             let pct = ((val + 0.2) / 3.0) * 100;
                             pct = Math.max(0, Math.min(100, pct));
                             
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
    safeLog("[TideSource] Gerando dados dinâmicos baseados na data de hoje...");
    const dynamicData = generateCurrentMockData();
    const frames: Keyframe[] = [];
    const tides = dynamicData.tides;
    
    tides.forEach((dayData, dayIndex) => {
        dayData.high.forEach((timeStr: string) => {
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
        dayData.low.forEach((timeStr: string) => {
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