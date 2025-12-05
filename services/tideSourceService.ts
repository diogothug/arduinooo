
import { DataSourceConfig, Keyframe, TideSourceType, MockWaveType, EffectType, WeatherData } from "../types";
import { useAppStore } from '../store';

// Helper to generate a random ID
const uid = () => Math.random().toString(36).substr(2, 9);

// Helper to sanitize base URLs (remove trailing slashes, prevent double slashes in path)
const sanitizeBaseUrl = (url: string) => {
    if (!url) return '';
    // Remove trailing slash
    let clean = url.replace(/\/+$/, '');
    return clean;
};

export const tideSourceService = {
    /**
     * Main function to get tide data based on reliability levels.
     */
    getTideData: async (config: DataSourceConfig, cycleDuration: number): Promise<{ frames: Keyframe[], sourceUsed: TideSourceType }> => {
        let resultFrames: Keyframe[] = [];
        let sourceUsed = TideSourceType.MOCK;

        // --- LEVEL 1A: API (WeatherAPI) ---
        if (config.activeSource === TideSourceType.API) {
            try {
                // For API source, we use fetchLiveWeather but extraction is specific
                const { frames } = await tideSourceService.fetchLiveWeather(config);
                if (frames.length > 0) {
                     return { frames, sourceUsed: TideSourceType.API };
                } else {
                    throw new Error("API retornou sucesso mas sem dados de maré.");
                }
            } catch (error) {
                console.warn("API Failure, falling back...", error);
            }
        }

        // --- LEVEL 1B: TABUA MARE (Brazil Specific) ---
        if (config.activeSource === TideSourceType.TABUA_MARE) {
             try {
                 resultFrames = await fetchTabuaMareData(config, cycleDuration);
                 if (resultFrames.length > 0) {
                     return { frames: resultFrames, sourceUsed: TideSourceType.TABUA_MARE };
                 }
                 throw new Error("Tábua Maré vazia.");
             } catch (error: any) {
                 console.warn("Tábua Maré Failure:", error);
                 throw new Error(`Falha Tábua Maré: ${error.message}`); 
             }
        }

        // --- LEVEL 2: MOCK ---
        try {
            resultFrames = generateMockData(config, cycleDuration);
            sourceUsed = TideSourceType.MOCK;
        } catch (error) {
             console.error("Mock Generation Failed", error);
             if (config.lastValidData) {
                 resultFrames = calculateFallback(config.lastValidData, cycleDuration);
                 sourceUsed = TideSourceType.CALCULATED;
             } else {
                 throw new Error("Falha Crítica: Nenhuma fonte de dados disponível.");
             }
        }

        return { frames: resultFrames, sourceUsed };
    },

    /**
     * Fetch Live Weather, Astro, and Tide data for the Display Simulator
     */
    fetchLiveWeather: async (config: DataSourceConfig): Promise<{ weather: Partial<WeatherData>, frames: Keyframe[], warning?: string }> => {
        const { token, locationId } = config.api;
        
        // Log Raw Response
        useAppStore.getState().setApiDebugLog("Iniciando requisição...");

        try {
            let data: any;
            let weather: Partial<WeatherData> = {};

            // WeatherAPI Call for Sensors
            if (token && locationId) {
                const baseUrl = "https://api.weatherapi.com/v1/marine.json";
                const url = `${baseUrl}?key=${token}&q=${encodeURIComponent(locationId)}&days=1&tides=yes&lang=pt`;
                
                console.log(`Fetching Live Weather Data...`);
                const response = await fetch(url);
                const text = await response.text();
                
                useAppStore.getState().setApiDebugLog(text);

                if (!response.ok) {
                    throw new Error(`WeatherAPI Erro HTTP ${response.status}`);
                }

                try {
                    data = JSON.parse(text);
                } catch (jsonErr) {
                    throw new Error(`Erro: Resposta WeatherAPI não é JSON válido.`);
                }

                if (data.error) {
                     const errObj = data.error || {};
                     throw new Error(`WeatherAPI: ${errObj.message} (Code ${errObj.code})`);
                }
                
                if (!data.location) {
                    throw new Error("JSON incompleto: Objeto 'location' ausente.");
                }

                const forecastDay = data.forecast?.forecastday?.[0];
                const current = data.current || {};
                const astro = forecastDay?.astro || {};
                
                // Helper for boolean is_day
                let isDay = true;
                if (current.is_day !== undefined) isDay = current.is_day === 1;
                else if (astro.is_sun_up !== undefined) isDay = astro.is_sun_up === 1;

                weather = {
                    temp: current.temp_c ?? 0,
                    humidity: current.humidity ?? 0,
                    windSpeed: current.wind_kph ?? 0,
                    windDir: current.wind_degree ?? 0,
                    rain: current.precip_mm ?? 0,
                    moonPhase: astro.moon_phase ?? "Unknown",
                    moonIllumination: astro.moon_illumination ? parseInt(astro.moon_illumination) : 50,
                    isDay: isDay,
                    conditionText: current.condition?.text || "Desconhecido"
                };
            }

            let keyframes: Keyframe[] = [];
            let warning: string | undefined = undefined;

            // Extract Tides based on Active Source
            if (config.activeSource === TideSourceType.API) {
                // FIXED: Correct path for WeatherAPI Marine tides
                if (data) {
                    // Path 1: forecast.forecastday[0].tides[0].tide (Most common in Marine API)
                    let tideData = data.forecast?.forecastday?.[0]?.tides?.[0]?.tide;
                    
                    // Fallback Path: forecast.forecastday[0].day.tides[0].tide (Legacy/Alternative)
                    if (!tideData) {
                        tideData = data.forecast?.forecastday?.[0]?.day?.tides?.[0]?.tide;
                    }

                    if (tideData && Array.isArray(tideData) && tideData.length > 0) {
                         keyframes = parseWeatherApiTides(tideData);
                    } else {
                        warning = "Dados meteorológicos recebidos, mas sem tábua de maré (WeatherAPI). Verifique se 'tides=yes' está suportado no seu plano.";
                    }
                }
            } 
            else if (config.activeSource === TideSourceType.TABUA_MARE) {
                // Fetch independently
                try {
                    keyframes = await fetchTabuaMareData(config, 24); 
                } catch (e: any) {
                    warning = "Clima OK, mas falha na Tábua Maré: " + e.message;
                }
            }

            return { weather, frames: keyframes, warning };

        } catch (err: any) {
            console.error("API Fetch Error:", err);
            useAppStore.getState().setApiDebugLog("Erro fatal: " + err.message);
            throw new Error(err.message || "Falha desconhecida na conexão API");
        }
    },

    /**
     * Get harbor details by ID (Port 8)
     */
    getHarborById: async (config: DataSourceConfig): Promise<{ id: number, name: string, mean_level?: number }> => {
        const { baseUrl, harborId } = config.tabuaMare;
        if (!harborId) throw new Error("ID do porto não definido");

        // Allow double slashes if present in config, but ensure protocol is clean
        const apiBase = sanitizeBaseUrl(baseUrl || 'https://tabuamare.devtu.qzz.io/api/v1');
        const url = `${apiBase}/harbors/${harborId}`;

        console.log("Fetching Harbor Details:", url);
        useAppStore.getState().setApiDebugLog(`GET ${url}...`);

        try {
            const res = await fetch(url);
            const textRes = await res.text();
            
            // Append log
            useAppStore.getState().setApiDebugLog(textRes);

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const json = JSON.parse(textRes);
            
            // Expected response: { data: [ { id: 8, harbor_name: "..." } ] }
            if (json.data && Array.isArray(json.data) && json.data.length > 0) {
                const p = json.data[0];
                return {
                    id: p.id,
                    name: p.harbor_name,
                    mean_level: p.mean_level
                };
            }
            throw new Error("Porto não encontrado com este ID.");
        } catch (e: any) {
             throw new Error(e.message === 'Failed to fetch' ? 'Erro de Rede: Verifique URL' : e.message);
        }
    },

    /**
     * Finds the nearest harbor based on state and lat/lng
     * Returns structured object
     */
    findNearestHarbor: async (config: DataSourceConfig): Promise<{ id: number, name: string, distance: number }> => {
         const { baseUrl, uf, lat, lng } = config.tabuaMare;
         
         const apiBase = sanitizeBaseUrl(baseUrl || 'https://tabuamare.devtu.qzz.io/api/v1'); 
         const latLngParam = `[${lat},${lng}]`;
         
         // Using endpoint: GET /nearested-harbor/{state}/{[lat,lng]}
         const url = `${apiBase}/nearested-harbor/${uf.toLowerCase()}/${latLngParam}`;
         
         console.log("Checking Nearest Harbor:", url);
         useAppStore.getState().setApiDebugLog(`GET ${url}...`);

         try {
             const res = await fetch(url);
             const textRes = await res.text();
             
             // Capture Raw Response for Debug Log
             useAppStore.getState().setApiDebugLog(textRes);
             
             if (!res.ok) throw new Error(`HTTP ${res.status}`);
             
             let json;
             try {
                json = JSON.parse(textRes);
             } catch(e) {
                throw new Error("Resposta inválida (não-JSON).");
             }

             if (json.data && json.data.length > 0) {
                 const p = json.data[0];
                 return {
                     id: p.id,
                     name: p.name || p.harbor_name,
                     distance: parseFloat((p.distance || 0).toFixed(1))
                 };
             }
             throw new Error("Nenhum porto encontrado nesta região.");
         } catch(e: any) {
             throw new Error(e.message === 'Failed to fetch' ? 'Erro de Rede: Verifique a URL' : e.message);
         }
    }
};

// --- HELPER: Parse WeatherAPI Tides ---
function parseWeatherApiTides(tideData: any[]): Keyframe[] {
    let keyframes: Keyframe[] = [];
    let maxH = -Infinity;
    let minH = Infinity;
    
    tideData.forEach((t: any) => {
        const h = parseFloat(t.tide_height_mt);
        if (!isNaN(h)) {
            if (h > maxH) maxH = h;
            if (h < minH) minH = h;
        }
    });

    const range = maxH - minH;
    const effectiveRange = range < 0.1 ? 1.0 : range;
    
    // Safety: Ensure absMin is not negative to prevent drawing artifacts
    let absMin = minH - (effectiveRange * 0.1); 
    let absMax = maxH + (effectiveRange * 0.1);
    
    // Clamp min to 0 if data is relative to chart datum (usually positive)
    absMin = Math.max(absMin, 0);
    
    tideData.forEach((t: any) => {
        const h = parseFloat(t.tide_height_mt);
        if (isNaN(h)) return;

        const dateStr = t.tide_time; // "YYYY-MM-DD HH:MM"
        // Robust Time Parsing
        const [dPart, tPart] = dateStr.split(' ');
        const [hours, mins] = tPart.split(':').map(Number);
        
        const timeOffset = hours + (mins / 60);

        let heightPct = ((h - absMin) / (absMax - absMin)) * 100;
        if (heightPct > 100) heightPct = 100;
        if (heightPct < 0) heightPct = 0;

        const isHigh = t.tide_type === 'HIGH';
        
        keyframes.push({
            id: uid(),
            timeOffset: parseFloat(timeOffset.toFixed(2)),
            height: parseFloat(heightPct.toFixed(1)),
            color: isHigh ? '#00eebb' : '#004488', 
            intensity: isHigh ? 255 : 100,
            effect: isHigh ? EffectType.WAVE : EffectType.STATIC
        });
    });
    return keyframes.sort((a, b) => a.timeOffset - b.timeOffset);
}


// --- TABUA MARE GENERATOR (Level 1B) ---
async function fetchTabuaMareData(config: DataSourceConfig, cycleDuration: number): Promise<Keyframe[]> {
    const { baseUrl, uf, lat, lng, harborId } = config.tabuaMare;
    
    // Clean base URL using sanitizer
    const apiBase = sanitizeBaseUrl(baseUrl || 'https://tabuamare.devtu.qzz.io/api/v1');

    // 1. Calculate Date Parameters
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    
    // Calculate required days based on cycleDuration
    const daysRequired = Math.ceil(cycleDuration / 24) || 1;
    const daysArray: number[] = [];
    
    for(let i=0; i<daysRequired; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        if (d.getMonth() + 1 === month) {
            daysArray.push(d.getDate());
        }
    }

    if (daysArray.length === 0) daysArray.push(now.getDate());

    const daysParam = `[${daysArray.join(',')}]`;
    
    let url = "";

    // 2. Select Endpoint
    if (harborId) {
        // USE ID-BASED ENDPOINT if harborId is present (e.g. 8)
        // GET /api/v1/tabua-mare/{harborId}/{month}/{days}
        url = `${apiBase}/tabua-mare/${harborId}/${month}/${daysParam}`;
        console.log("Fetching Tabua Mare by ID...", url);
    } else {
        // USE GEO-LOCATED ENDPOINT
        const latLngParam = `[${lat},${lng}]`;
        const stateParam = uf.toLowerCase();
        // GET /geo-tabua-mare/{lat_lng}/{state}/{month}/{days}
        url = `${apiBase}/geo-tabua-mare/${latLngParam}/${stateParam}/${month}/${daysParam}`;
        console.log("Fetching Geo Tabua Mare...", url);
    }
    
    useAppStore.getState().setApiDebugLog(`GET ${url}...`);
    
    const res = await fetch(url);
    const textRes = await res.text();
    
    // Log for debug
    useAppStore.getState().setApiDebugLog(textRes);

    if (!res.ok) {
        throw new Error(`Erro HTTP ${res.status} na Tábua Maré`);
    }

    let json: any;
    try {
        json = JSON.parse(textRes);
    } catch(e) {
        throw new Error("Resposta inválida da API Tábua Maré (JSON Parse Error).");
    }
    
    if (json.error && json.error.msg) {
        throw new Error(`API Error: ${json.error.msg}`);
    }

    const rawData = json.data || [];
    if (!Array.isArray(rawData) || rawData.length === 0) {
        throw new Error("Nenhum dado de maré encontrado para esta região/data.");
    }

    // 3. Process Data
    const frames: Keyframe[] = [];
    
    // Determine Min/Max for normalization across all days
    let minH = Infinity;
    let maxH = -Infinity;

    rawData.forEach((dayObj: any) => {
        const tides = dayObj.tides || [];
        tides.forEach((t: any) => {
             const h = parseFloat(t.height);
             if(!isNaN(h)) {
                 if(h < minH) minH = h;
                 if(h > maxH) maxH = h;
             }
        });
    });

    if (minH === Infinity) { minH = 0.0; maxH = 2.0; }
    const range = maxH - minH;
    const safeRange = range < 0.1 ? 1.0 : range;
    
    // Add 10% buffer
    let absMin = minH - (safeRange * 0.1); 
    const absMax = maxH + (safeRange * 0.1);
    
    // Clamp bottom to 0 to prevent visual bugs
    absMin = Math.max(absMin, 0);

    rawData.forEach((dayObj: any) => {
         // Force BRT Timezone (-03:00) construction
         // dayObj.date is "YYYY-MM-DD"
         let objDate = new Date(`${dayObj.date}T00:00:00-03:00`);
         
         const nowUTC = new Date();
         const todayBRT = new Date(nowUTC.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
         todayBRT.setHours(0,0,0,0);
         
         const diffTime = objDate.getTime() - todayBRT.getTime();
         const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
         
         if (diffDays < 0) return; 

         const tides = dayObj.tides || [];
         tides.forEach((t: any) => {
             const [hh, mm] = t.time.split(':').map(Number);
             
             // Calculate decimal hour
             const timeOffset = (diffDays * 24) + hh + (mm / 60);
             
             // Ignore if beyond requested cycle
             if (timeOffset > cycleDuration) return;

             const h = parseFloat(t.height);
             if (isNaN(h)) return;

             let pct = ((h - absMin) / (absMax - absMin)) * 100;
             if (pct > 100) pct = 100;
             if (pct < 0) pct = 0;
             
             const typeStr = (t.type || "").toLowerCase();
             const isHigh = typeStr.includes('high') || typeStr.includes('cheia') || typeStr.includes('alta');
             
             frames.push({
                 id: uid(),
                 timeOffset: parseFloat(timeOffset.toFixed(2)),
                 height: parseFloat(pct.toFixed(1)),
                 color: isHigh ? '#00eebb' : '#004488',
                 intensity: isHigh ? 255 : 100,
                 effect: isHigh ? EffectType.WAVE : EffectType.STATIC
             });
         });
    });
    
    return frames.sort((a,b) => a.timeOffset - b.timeOffset);
}

// --- MOCK GENERATOR (Level 2) ---
function generateMockData(config: DataSourceConfig, cycleDuration: number): Keyframe[] {
    const { minHeight, maxHeight, periodHours, waveType } = config.mock;
    const frames: Keyframe[] = [];
    const steps = 12; // More steps for smoother default
    
    for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * cycleDuration;
        const phase = (t % periodHours) / periodHours;
        let val = 0;

        if (waveType === MockWaveType.SINE) {
            val = (Math.sin(phase * 2 * Math.PI) + 1) / 2; 
        } else if (waveType === MockWaveType.TRIANGLE) {
            val = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
        } else if (waveType === MockWaveType.STEP) {
            val = phase < 0.5 ? 1 : 0;
        }

        const height = minHeight + (val * (maxHeight - minHeight));
        const isHigh = height > (minHeight + maxHeight) / 2;

        frames.push({
            id: uid(),
            timeOffset: parseFloat(t.toFixed(1)),
            height: parseFloat(height.toFixed(1)),
            color: isHigh ? '#0ea5e9' : '#1e3a8a',
            intensity: Math.floor(height * 2.55),
            effect: EffectType.STATIC
        });
    }
    return frames;
}

// --- CALCULATION FALLBACK (Level 3) ---
function calculateFallback(lastFrame: Keyframe | null, cycleDuration: number): Keyframe[] {
    const frames: Keyframe[] = [];
    const period = 12.42;
    for(let i=0; i<=6; i++) {
        const t = (i/6) * cycleDuration;
        const val = (Math.sin((t / period) * 2 * Math.PI) + 1) / 2;
        const h = 20 + (val * 60); 
        frames.push({
            id: uid(),
            timeOffset: parseFloat(t.toFixed(1)),
            height: parseFloat(h.toFixed(1)),
            color: '#ffffff',
            intensity: 100,
            effect: EffectType.STATIC
        });
    }
    return frames;
}
