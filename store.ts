import { create } from 'zustand';
import { Keyframe, Device, ViewState, EffectType, FirmwareConfig, DisplayConfig, DisplayWidget, WidgetType, DisplayDriver, ConnectionType, DisplayTheme, RenderMode, DataSourceConfig, TideSourceType, MockWaveType, WeatherData, Notification } from './types';

console.log("🟦 [Store] Loading store.ts module...");

interface AppState {
  currentView: ViewState;
  devices: Device[];
  activeDeviceId: string | null;
  connectionType: ConnectionType;
  keyframes: Keyframe[];
  simulatedTime: number; // 0-24 or 0-168
  firmwareConfig: FirmwareConfig;
  
  // Data Source State
  dataSourceConfig: DataSourceConfig;

  // Display State
  displayConfig: DisplayConfig;
  displayWidgets: DisplayWidget[];
  weatherData: WeatherData; // Simulated sensor data
  
  // API Status
  apiLoading: boolean;
  apiError: string | null;
  apiDebugLog: string | null;
  
  // Global Notification
  notification: Notification | null;

  // Actions
  setView: (view: ViewState) => void;
  setActiveDevice: (id: string | null) => void;
  setConnectionType: (type: ConnectionType) => void;
  addDevice: (device: Device) => void;
  updateDeviceStatus: (id: string, status: 'online' | 'offline') => void;
  setKeyframes: (keyframes: Keyframe[]) => void;
  addKeyframe: (keyframe: Keyframe) => void;
  updateKeyframe: (id: string, updates: Partial<Keyframe>) => void;
  removeKeyframe: (id: string) => void;
  setSimulatedTime: (time: number) => void;
  updateFirmwareConfig: (config: Partial<FirmwareConfig>) => void;
  
  // Data Source Actions
  updateDataSourceConfig: (config: Partial<DataSourceConfig>) => void;

  // Display Actions
  setDisplayConfig: (config: Partial<DisplayConfig>) => void;
  setDisplayWidgets: (widgets: DisplayWidget[]) => void;
  addDisplayWidget: (widget: DisplayWidget) => void;
  updateDisplayWidget: (id: string, updates: Partial<DisplayWidget>) => void;
  removeDisplayWidget: (id: string) => void;
  setWeatherData: (data: Partial<WeatherData>) => void;
  
  setApiStatus: (loading: boolean, error: string | null) => void;
  setApiDebugLog: (log: string | null) => void;
  
  setNotification: (type: 'success' | 'error' | 'info', message: string) => void;
  clearNotification: () => void;
}

console.log("🟦 [Store] Creating Zustand store...");

export const useAppStore = create<AppState>((set) => ({
  currentView: ViewState.DASHBOARD,
  activeDeviceId: null,
  connectionType: ConnectionType.NONE,
  devices: [
    { id: '1', name: 'Maré Sala (Moreré)', ip: '192.168.1.105', status: 'online', lastSeen: Date.now() },
    { id: '2', name: 'Mapa Escritório', ip: '192.168.1.110', status: 'offline', lastSeen: Date.now() - 3600000 },
  ],
  keyframes: [
    { id: '1', timeOffset: 0, height: 20, color: '#0066cc', intensity: 100, effect: EffectType.GLOW },
    { id: '2', timeOffset: 6, height: 80, color: '#00ccff', intensity: 200, effect: EffectType.WAVE },
    { id: '3', timeOffset: 12, height: 10, color: '#003366', intensity: 80, effect: EffectType.STATIC },
    { id: '4', timeOffset: 18, height: 90, color: '#44aaff', intensity: 255, effect: EffectType.PULSE },
    { id: '5', timeOffset: 24, height: 20, color: '#0066cc', intensity: 100, effect: EffectType.GLOW },
  ],
  simulatedTime: 12,
  firmwareConfig: {
    ssid: 'Moreré_WiFi',
    password: '',
    ledCount: 60,
    ledPin: 18,
    ledBrightness: 160,
    ledColorOrder: 'GRB',
    ledLayoutType: 'STRIP',
    deviceName: 'MareFlux_ESP32',
    enableBLE: true,
    enableSerial: true,
    cycleDuration: 24,
    nightMode: {
      enabled: true,
      startHour: 22.0,
      endHour: 4.75, // 4:45
      brightnessFactor: 0.5
    },
    lowPowerMode: {
      enabled: true,
      idleFps: 5,
      dimBacklight: true,
      batteryThreshold: 20
    },
    weatherApi: {
        enabled: true,
        apiKey: '9afcd90f4bc04d6d96e115416251409',
        location: '-13.5985,-38.8976',
        intervalMinutes: 60
    }
  },

  // Default Data Source Config
  dataSourceConfig: {
    activeSource: TideSourceType.TABUA_MARE, // Default to Tabua Mare as requested
    api: {
      url: 'https://api.weatherapi.com/v1/marine.json',
      token: '9afcd90f4bc04d6d96e115416251409',
      intervalMinutes: 60,
      locationId: '-13.5655,-38.9227', // Moreré Coordinates (Precise)
    },
    tabuaMare: {
      // NOTE: Using double slash in path if needed by server, but usually normalized
      baseUrl: 'https://tabuamare.devtu.qzz.io/api/v1',
      uf: 'ba',
      lat: -14.78, // Official Lat for Porto 8
      lng: -39.0167, // Official Lng for Porto 8
      harborId: 8, // PORTO DE ILHÉUS MALHADO (ALWAYS 8)
      lastFoundHarbor: 'Porto ID: 8 (Ilhéus) - Selecionado'
    },
    mock: {
      minHeight: 10,
      maxHeight: 90,
      periodHours: 12.42, // Accurate tidal cycle (12h 25m)
      waveType: MockWaveType.SINE
    },
    lastValidData: null
  },

  // Default GC9A01 Config (Common ESP32 Pinout)
  displayConfig: {
    driver: DisplayDriver.TFT_ESPI,
    pinSCK: 18,
    pinMOSI: 23,
    pinCS: 5,
    pinDC: 2,
    pinRST: 4,
    pinBLK: 22, 
    rotation: 0,
    brightness: 200,
    fps: 30,
    spi: {
      frequency: 40000000,
      mode: 0,
      dataOrderMSB: true
    },
    backlight: {
      pwmFrequency: 5000,
      smoothing: true
    },
    renderMode: RenderMode.QUALITY,
    theme: DisplayTheme.DEFAULT,
    simulateSunlight: false,
    simulatePixelGrid: false,
    simulateRGB565: true
  },
  displayWidgets: [
    { id: '1', type: WidgetType.TIDE_GAUGE, x: 120, y: 120, scale: 1, color: '#0ea5e9', visible: true, zIndex: 0 },
    { id: '2', type: WidgetType.TEXT_LABEL, x: 120, y: 160, scale: 1, color: '#ffffff', label: 'NÍVEL MARÉ', visible: true, zIndex: 1 },
    { id: '3', type: WidgetType.CLOCK_DIGITAL, x: 120, y: 80, scale: 0.8, color: '#cbd5e1', visible: true, zIndex: 2 },
  ],
  
  weatherData: {
      temp: 28.5,
      humidity: 78,
      windSpeed: 22, // km/h
      windDir: 45, // NE
      rain: 0,
      battery: 100,
      moonPhase: "Waxing Crescent",
      moonIllumination: 25,
      isDay: true,
      conditionText: "Ensolarado"
  },
  
  apiLoading: false,
  apiError: null,
  apiDebugLog: null,
  
  notification: null,

  setView: (view) => set({ currentView: view }),
  setActiveDevice: (id) => set({ activeDeviceId: id }),
  setConnectionType: (type) => set({ connectionType: type }),
  addDevice: (device) => set((state) => ({ devices: [...state.devices, device] })),
  updateDeviceStatus: (id, status) => set((state) => ({
    devices: state.devices.map((d) => (d.id === id ? { ...d, status } : d))
  })),
  setKeyframes: (keyframes) => set({ keyframes }),
  addKeyframe: (keyframe) => set((state) => ({ keyframes: [...state.keyframes, keyframe].sort((a, b) => a.timeOffset - b.timeOffset) })),
  updateKeyframe: (id, updates) => set((state) => ({
    keyframes: state.keyframes.map((k) => (k.id === id ? { ...k, ...updates } : k)).sort((a, b) => a.timeOffset - b.timeOffset)
  })),
  removeKeyframe: (id) => set((state) => ({ keyframes: state.keyframes.filter((k) => k.id !== id) })),
  setSimulatedTime: (time) => set({ simulatedTime: time }),
  updateFirmwareConfig: (config) => set((state) => ({ firmwareConfig: { ...state.firmwareConfig, ...config } })),
  
  updateDataSourceConfig: (config) => set((state) => ({ dataSourceConfig: { ...state.dataSourceConfig, ...config } })),

  setDisplayConfig: (config) => set((state) => ({ displayConfig: { ...state.displayConfig, ...config } })),
  setDisplayWidgets: (widgets) => set({ displayWidgets: widgets }),
  addDisplayWidget: (widget) => set((state) => ({ displayWidgets: [...state.displayWidgets, widget] })),
  updateDisplayWidget: (id, updates) => set((state) => ({ 
    displayWidgets: state.displayWidgets.map(w => w.id === id ? { ...w, ...updates } : w) 
  })),
  removeDisplayWidget: (id) => set((state) => ({ displayWidgets: state.displayWidgets.filter(w => w.id !== id) })),
  
  setWeatherData: (data) => set((state) => ({ weatherData: { ...state.weatherData, ...data } })),
  
  setApiStatus: (loading, error) => set({ apiLoading: loading, apiError: error }),
  setApiDebugLog: (log) => set({ apiDebugLog: log }),
  
  setNotification: (type, message) => set({ notification: { id: Math.random().toString(), type, message } }),
  clearNotification: () => set({ notification: null }),
}));

console.log("🟦 [Store] Store initialized successfully.");