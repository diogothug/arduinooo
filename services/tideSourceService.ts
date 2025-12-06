import { DataSourceConfig, Keyframe, TideSourceType, MockWaveType, EffectType, WeatherData } from "../types";
import { useAppStore } from '../store';

console.log("🟦 [TideService] Module Loading...");

// Helper to generate a random ID
const uid = () => Math.random().toString(36).substr(2, 9);

// PROXY CONFIGURATION
// We use a public proxy to act as the "Backend" for these requests, solving the CORS issue.
const CORS_PROXY = "https://api.allorigins.win/raw?url=";

// Helper to sanitize base URLs
const sanitizeBaseUrl = (url: string) => {
    if (!url) return '';
    // Simply remove trailing slashes. Do NOT enforce double slash '//api' as it breaks some proxies/backends.
    return url.replace(/\/+$/, '');
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
        
        const apiBase = sanitizeBaseUrl(baseUrl || 'https://tabuamare.devtu.qzz.io/api/v1');
        
        // Correct endpoint: /harbor/{id} (Singular)
        const targetUrl = `${apiBase}/harbor/${harborId}`;
        
        // PROXY IMPLEMENTATION
        const proxyUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;
        
        safeLog(`[API] Harbor ID (Proxy): ${proxyUrl}`);
        
        const res = await fetch(proxyUrl, { 
            headers: { 'Accept': 'application/json' },
            referrerPolicy: 'no-referrer' 
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        
        if (json.data && json.data.length > 0) return { id: json.data[0].id, name: json.data[0].harbor_name };
        
        throw new Error("Porto não encontrado (Dados vazios).");
    },

    findNearestHarbor: async (config: DataSourceConfig): Promise<{ id: number, name: string, distance: number }> => {
         const { baseUrl, uf, lat, lng } = config.tabuaMare;
         const apiBase = sanitizeBaseUrl(baseUrl || 'https://tabuamare.devtu.qzz.io/api/v1'); 
         
         // Fix: Encode parameters for AllOrigins proxy (Double Encode logic)
         // We must manually encode brackets here so they survive the second encodeURIComponent later
         // [lat,lng] -> %5Blat%2Clng%5D
         const latLngParam = encodeURIComponent(`[${lat},${lng}]`);
         
         const targetUrl = `${apiBase}/nearested-harbor/${uf.toLowerCase()}/${latLngParam}`;

         // PROXY IMPLEMENTATION
         // The proxy expects the target URL to be fully encoded as a parameter
         const proxyUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;
         
         safeLog(`[API] Nearest (Proxy): ${proxyUrl}`);
         
         const res = await fetch(proxyUrl, { 
             headers: { 'Accept': 'application/json' },
             referrerPolicy: 'no-referrer'
         });
         
         if (!res.ok) throw new Error(`HTTP ${res.status}`);
         const json = await res.json();
         
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
    
    // Fix: Double Encode Logic for AllOrigins
    // First, encode the array string: [1,2,3] -> %5B1%2C2%2C3%5D
    // This is required because this string becomes part of the target URL path.
    // This results in the final URL sent to AllOrigins having %255B (double encoded bracket)
    const daysParam = encodeURIComponent(`[${daysArray.join(',')}]`);
    
    let targetUrl = "";
    if (harborId) {
        targetUrl = `${apiBase}/tabua-mare/${harborId}/${month}/${daysParam}`;
    } else {
        // Also encode lat/lng params if falling back to geo search
        const latLngParam = encodeURIComponent(`[${lat},${lng}]`);
        targetUrl = `${apiBase}/geo-tabua-mare/${latLngParam}/${uf.toLowerCase()}/${month}/${daysParam}`;
    }
    
    // PROXY IMPLEMENTATION
    // Finally, encode the ENTIRE target URL to pass it as the 'url' query param to AllOrigins
    const proxyUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;

    safeLog(`[API] Req Proxy URL: ${proxyUrl}`);
    
    const res = await fetch(proxyUrl, {
        headers: { 'Accept': 'application/json' },
        referrerPolicy: 'no-referrer'
    });
    
    if (!res.ok) throw new Error(`Erro HTTP ${res.status} - ${res.statusText}`);
    
    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch (e) {
        // If parsing fails, it's likely HTML error page due to malformed URL
        console.error("Failed to parse JSON:", text.substring(0, 100));
        throw new Error("API retornou resposta inválida (Provável erro no formato da URL).");
    }
    
    safeLog(`[API] Resp JSON OK`);

    if (json.error && json.error.msg) throw new Error(`API Error: ${json.error.msg}`);
    
    const rawData = json.data || [];
    if (rawData.length === 0) throw new Error("API retornou 'data' vazio.");

    const frames: Keyframe[] = [];
    
    const processTides = (tides: any[], dateStr: string) => {
         tides.forEach((t: any) => {
             const [hh, mm] = (t.hour || t.time || "00:00").split(':').map(Number);
             const today = new Date(now.toISOString().split('T')[0]);
             const tideDate = new Date(dateStr);
             const diffDays = Math.round((tideDate.getTime() - today.getTime()) / (86400000));
             const timeOffset = (diffDays * 24) + hh + (mm / 60);

             if (timeOffset >= 0 && timeOffset <= cycleDuration + 24) {
                const h = parseFloat(t.level || t.height);
                if (!isNaN(h)) {
                    // Normalize (Approx: -0.2 to 2.9m -> 0 to 100%)
                    let pct = ((h + 0.2) / 2.9) * 100;
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
        if (item.months) {
             item.months.forEach((m: any) => {
                 if (m.days) {
                     m.days.forEach((d: any) => {
                         // API can return hours (new format) or tides (old format)
                         if (d.hours) processTides(d.hours, d.date || now.toISOString().split('T')[0]);
                         else if (d.tides) processTides(d.tides, d.date || now.toISOString().split('T')[0]);
                     });
                 }
             });
        } 
        else if (item.tides) {
             processTides(item.tides, item.date || now.toISOString().split('T')[0]);
        }
    });
    
    return frames.sort((a,b) => a.timeOffset - b.timeOffset);
}

function generateMockData(config: DataSourceConfig, cycleDuration: number): Keyframe[] {
    const { minHeight, maxHeight, periodHours } = config.mock;
    const frames: Keyframe[] = [];
    const limit = Math.ceil(cycleDuration / 12) * 12 + 12;
    for (let i = 0; i <= limit; i++) {
        const t = i;
        const val = (Math.sin(t * 2 * Math.PI / periodHours) + 1) / 2;
        const h = minHeight + (val * (maxHeight - minHeight));
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

function calculateFallback(lastFrame: Keyframe | null, cycleDuration: number): Keyframe[] {
    return generateMockData({mock: {minHeight: 20, maxHeight: 80, periodHours: 12.42}} as any, cycleDuration);
}