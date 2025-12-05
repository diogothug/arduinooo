import { DataSourceConfig, Keyframe, TideSourceType, MockWaveType, EffectType, WeatherData } from "../types";
import { useAppStore } from '../store';

// Helper to generate a random ID
const uid = () => Math.random().toString(36).substr(2, 9);

// Helper to sanitize base URLs and ensure valid structure
const sanitizeBaseUrl = (url: string) => {
    if (!url) return '';
    // Remove trailing slashes
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

        console.log(`[TideSource] Requesting data via ${config.activeSource}`);

        // --- LEVEL 1A: API (WeatherAPI) ---
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

        // --- LEVEL 1B: TABUA MARE (Brazil Specific) ---
        if (config.activeSource === TideSourceType.TABUA_MARE) {
             try {
                 resultFrames = await fetchTabuaMareData(config, cycleDuration);
                 if (resultFrames.length > 0) {
                     return { frames: resultFrames, sourceUsed: TideSourceType.TABUA_MARE };
                 }
                 throw new Error("Tábua Maré vazia.");
             } catch (error: any) {
                 console.error("[TideSource] Tábua Maré Failure:", error);
                 // We throw here to notify the UI specifically about the API failure if it was the selected source
                 throw new Error(`Falha Tábua Maré: ${error.message}`); 
             }
        }

        // --- LEVEL 2: MOCK ---
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

    /**
     * Fetch Live Weather, Astro, and Tide data for the Display Simulator
     */
    fetchLiveWeather: async (config: DataSourceConfig): Promise<{ weather: Partial<WeatherData>, frames: Keyframe[], warning?: string }> => {
        const { token, locationId } = config.api;
        
        useAppStore.getState().setApiDebugLog("Iniciando requisição...");

        try {
            let data: any;
            let weather: Partial<WeatherData> = {};

            // WeatherAPI Call for Sensors
            if (token && locationId && config.activeSource === TideSourceType.API) {
                const baseUrl = "https://api.weatherapi.com/v1/marine.json";
                const url = `${baseUrl}?key=${token}&q=${encodeURIComponent(locationId)}&days=1&tides=yes&lang=pt`;
                
                console.log(`[TideSource] GET ${url}`);
                const response = await fetch(url);
                const text = await response.text();
                
                useAppStore.getState().setApiDebugLog(text.substring(0, 1000) + "..."); // Truncate log

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
                
                const forecastDay = data.forecast?.forecastday?.[0];
                const current = data.current || {};
                const astro = forecastDay?.astro || {};
                
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

            if (config.activeSource === TideSourceType.API) {
                if (data) {
                    let tideData = data.forecast?.forecastday?.[0]?.tides?.[0]?.tide;
                    if (!tideData) {
                        tideData = data.forecast?.forecastday?.[0]?.day?.tides?.[0]?.tide;
                    }

                    if (tideData && Array.isArray(tideData) && tideData.length > 0) {
                         keyframes = parseWeatherApiTides(tideData);
                    } else {
                        warning = "Dados meteorológicos recebidos, mas sem tábua de maré (WeatherAPI).";
                    }
                }
            } 
            else if (config.activeSource === TideSourceType.TABUA_MARE) {
                try {
                    keyframes = await fetchTabuaMareData(config, 24); 
                } catch (e: any) {
                    warning = "Clima OK, mas falha na Tábua Maré: " + e.message;
                    console.error("[TideSource] Tabua Mare Independent Fetch Error:", e);
                    useAppStore.getState().setApiDebugLog("Erro Tabua Mare: " + e.message);
                }
            }

            return { weather, frames: keyframes, warning };

        } catch (err: any) {
            console.error("[TideSource] API Error:", err);
            useAppStore.getState().setApiDebugLog("Erro fatal: " + err.message);
            throw new Error(err.message || "Falha desconhecida na conexão API");
        }
    },

    getHarborById: async (config: DataSourceConfig): Promise<{ id: number, name: string, mean_level?: number }> => {
        const { baseUrl, harborId } = config.tabuaMare;
        if (!harborId) throw new Error("ID do porto não definido");

        const apiBase = sanitizeBaseUrl(baseUrl || 'https://tabuamare.devtu.qzz.io/api/v1');
        const url = `${apiBase}/harbors/${harborId}`;

        console.log("[TideSource] Fetching Harbor:", url);
        useAppStore.getState().setApiDebugLog(`GET ${url}...`);

        try {
            const res = await fetch(url);
            const textRes = await res.text();
            
            useAppStore.getState().setApiDebugLog(textRes);

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const json = JSON.parse(textRes);
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

    findNearestHarbor: async (config: DataSourceConfig): Promise<{ id: number, name: string, distance: number }> => {
         const { baseUrl, uf, lat, lng } = config.tabuaMare;
         
         const apiBase = sanitizeBaseUrl(baseUrl || 'https://tabuamare.devtu.qzz.io/api/v1'); 
         const latLngParam = `[${lat},${lng}]`;
         const url = `${apiBase}/nearested-harbor/${uf.toLowerCase()}/${latLngParam}`;
         
         console.log("[TideSource] Finding Nearest:", url);
         useAppStore.getState().setApiDebugLog(`GET ${url}...`);

         try {
             const res = await fetch(url);
             const textRes = await res.text();
             useAppStore.getState().setApiDebugLog(textRes);
             
             if (!res.ok) throw new Error(`HTTP ${res.status}`);
             
             const json = JSON.parse(textRes);
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
    
    let absMin = minH - (effectiveRange * 0.1); 
    let absMax = maxH + (effectiveRange * 0.1);
    absMin = Math.max(absMin, 0);
    
    tideData.forEach((t: any) => {
        const h = parseFloat(t.tide_height_mt);
        if (isNaN(h)) return;

        const dateStr = t.tide_time; 
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
    
    // Valid URL: https://tabuamare.devtu.qzz.io/api/v1
    const apiBase = sanitizeBaseUrl(baseUrl || 'https://tabuamare.devtu.qzz.io/api/v1');

    const now = new Date();
    const month = now.getMonth() + 1; 
    
    // We request current day + next days based on duration
    const daysRequired = Math.ceil(cycleDuration / 24) || 1;
    const daysArray: number[] = [];
    
    for(let i=0; i<daysRequired; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        // Warning: API requires month matching. If span crosses month, this simple logic breaks.
        // For strict reliability, we stick to current month query or would need multi-fetch.
        // We will only query days belonging to current month for safety in this version.
        if (d.getMonth() + 1 === month) {
            daysArray.push(d.getDate());
        }
    }

    if (daysArray.length === 0) daysArray.push(now.getDate());

    const daysParam = `[${daysArray.join(',')}]`;
    
    let url = "";

    // 2. Select Endpoint
    if (harborId) {
        // GET /tabua-mare/{harbor}/{month}/{days}
        url = `${apiBase}/tabua-mare/${harborId}/${month}/${daysParam}`;
        console.log(`[TideSource] Fetching Tabua Mare by ID ${harborId}...`);
    } else {
        // GET /geo-tabua-mare/{lat_lng}/{state}/{month}/{days}
        const latLngParam = `[${lat},${lng}]`;
        const stateParam = uf.toLowerCase();
        url = `${apiBase}/geo-tabua-mare/${latLngParam}/${stateParam}/${month}/${daysParam}`;
        console.log(`[TideSource] Fetching Geo Tabua Mare ${lat},${lng}...`);
    }
    
    useAppStore.getState().setApiDebugLog(`GET ${url}...`);
    
    const res = await fetch(url);
    const textRes = await res.text();
    
    useAppStore.getState().setApiDebugLog(textRes.substring(0, 500) + "..."); // Truncate

    if (!res.ok) {
        throw new Error(`Erro HTTP ${res.status}: ${textRes}`);
    }

    let json: any;
    try {
        json = JSON.parse(textRes);
    } catch(e) {
        throw new Error("Resposta inválida da API (JSON Parse Error).");
    }
    
    if (json.error && json.error.msg) {
        throw new Error(`API Error: ${json.error.msg}`);
    }

    const rawData = json.data || [];
    if (!Array.isArray(rawData) || rawData.length === 0) {
        throw new Error("Nenhum dado de maré encontrado na resposta (campo data vazio).");
    }

    const frames: Keyframe[] = [];
    const allTides: { height: number, time: string, type: string, date: string }[] = [];
    
    // Parse nested structure: Data -> Months -> Days -> Tides
    // Doc Page 8: "data": [ { "months": [ { "days": [ { "tides": [...] } ] } ] } ]
    
    rawData.forEach((harborItem: any) => {
        const months = harborItem.months || [];
        
        months.forEach((monthItem: any) => {
             const days = monthItem.days || [];
             
             days.forEach((dayItem: any) => {
                 const dateStr = dayItem.date; // "YYYY-MM-DD"
                 const tides = dayItem.tides || [];
                 
                 tides.forEach((t: any) => {
                     allTides.push({
                         height: parseFloat(t.height),
                         time: t.time,
                         type: t.type,
                         date: dateStr
                     });
                 });
             });
        });

        // Fallback for flat structure (if API structure varies from docs)
        if (allTides.length === 0 && harborItem.tides) {
            console.log("[TideSource] Using fallback flat structure parsing");
            harborItem.tides.forEach((t: any) => {
                 allTides.push({...t, height: parseFloat(t.height), date: harborItem.date});
            });
        }
    });

    console.log(`[TideSource] Parsed ${allTides.length} raw tide points.`);

    if (allTides.length === 0) {
        throw new Error("Estrutura do JSON desconhecida ou sem marés.");
    }

    // Determine Min/Max for normalization
    let minH = Infinity;
    let maxH = -Infinity;

    allTides.forEach(t => {
        if(!isNaN(t.height)) {
            if(t.height < minH) minH = t.height;
            if(t.height > maxH) maxH = t.height;
        }
    });

    if (minH === Infinity) { minH = 0.0; maxH = 2.0; }
    const range = maxH - minH;
    const safeRange = range < 0.1 ? 1.0 : range;
    
    let absMin = minH - (safeRange * 0.1); 
    const absMax = maxH + (safeRange * 0.1);
    absMin = Math.max(absMin, 0);

    // Reference Time for calculation
    const nowUTC = new Date();
    // Use simple date comparison to avoid timezone complexity in browser
    const todayStr = nowUTC.toISOString().split('T')[0];
    const todayDate = new Date(todayStr);

    allTides.forEach(t => {
         let tideDate;
         if (t.date) {
             tideDate = new Date(t.date);
         } else {
             tideDate = new Date(todayDate);
         }
         
         const diffTime = tideDate.getTime() - todayDate.getTime();
         const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
         
         // Only process if within valid range (allow slight past for interpolation)
         if (diffDays < -1) return; 

         const [hh, mm] = t.time.split(':').map(Number);
         
         // Calculate decimal hour from start of TODAY
         const timeOffset = (diffDays * 24) + hh + (mm / 60);
         
         // Ignore if too far in future
         if (timeOffset > cycleDuration + 24) return; 

         if (isNaN(t.height)) return;

         let pct = ((t.height - absMin) / (absMax - absMin)) * 100;
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
    
    return frames.sort((a,b) => a.timeOffset - b.timeOffset);
}

function generateMockData(config: DataSourceConfig, cycleDuration: number): Keyframe[] {
    const { minHeight, maxHeight, periodHours, waveType } = config.mock;
    const frames: Keyframe[] = [];
    const steps = 12; 
    
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
