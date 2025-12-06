
import { create } from 'zustand';
import { Keyframe, Device, ViewState, EffectType, FirmwareConfig, DisplayConfig, DisplayWidget, WidgetType, DisplayDriver, ConnectionType, DisplayTheme, RenderMode, DataSourceConfig, TideSourceType, MockWaveType, WeatherData, Notification, DisplayType } from './types';

console.log("🟦 [Store] Loading store.ts module...");

interface AppState {
  currentView: ViewState;
  devices: Device[];
  activeDeviceId: string | null;
  connectionType: ConnectionType;
  keyframes: Keyframe[];
  simulatedTime: number; 
  firmwareConfig: FirmwareConfig;
  dataSourceConfig: DataSourceConfig;
  displayConfig: DisplayConfig;
  displayWidgets: DisplayWidget[];
  weatherData: WeatherData; 
  apiLoading: boolean;
  apiError: string | null;
  apiDebugLog: string | null;
  notification: Notification | null;

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
  updateDataSourceConfig: (config: Partial<DataSourceConfig>) => void;
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

export const useAppStore = create<AppState>((set) => ({
  currentView: ViewState.DASHBOARD,
  activeDeviceId: null,
  connectionType: ConnectionType.NONE,
  devices: [
    { id: '1', name: 'Maré Sala (Moreré)', ip: '192.168.1.105', status: 'online', lastSeen: Date.now() },
  ],
  keyframes: [
    { id: '1', timeOffset: 0, height: 20, color: '#0066cc', intensity: 100, effect: EffectType.GLOW },
    { id: '2', timeOffset: 6, height: 80, color: '#00ccff', intensity: 200, effect: EffectType.WAVE },
  ],
  simulatedTime: 12,
  firmwareConfig: {
    ssid: 'Moreré_WiFi',
    password: '',
    ledCount: 64,
    ledPin: 18,
    ledBrightness: 160,
    ledColorOrder: 'GRB',
    ledLayoutType: 'MATRIX',
    ledMatrixWidth: 8,
    ledMatrixHeight: 8,
    ledSerpentine: true,
    ledSpiralTurns: 3,
    customColors: ['#000044', '#004488', '#0099cc', '#00ffcc', '#ffffff'],
    deviceName: 'MareFlux_ESP32',
    enableBLE: true,
    enableSerial: true,
    cycleDuration: 24,
    nightMode: { enabled: true, startHour: 22.0, endHour: 4.75, brightnessFactor: 0.5 },
    lowPowerMode: { enabled: true, idleFps: 5, dimBacklight: true, batteryThreshold: 20 },
    weatherApi: { enabled: true, apiKey: 'KEY', location: 'Moreré', intervalMinutes: 60 },
    autonomous: { enabled: true, linkSpeedToTide: true, linkBrightnessToTide: false, linkPaletteToTime: false, linkWeatherToLeds: true },
    animationMode: 'oceanCaustics',
    animationSpeed: 1.0,
    animationIntensity: 0.5,
    animationPalette: 0
  },
  dataSourceConfig: {
    activeSource: TideSourceType.TABUA_MARE,
    api: { url: '', token: '', intervalMinutes: 60, locationId: '' },
    // Defaulting to Harbor ID 7 (Salvador) instead of 8 (Ilheus) as per correction
    tabuaMare: { baseUrl: 'https://tabuamare.devtu.qzz.io/api/v1', uf: 'ba', lat: -12.97, lng: -38.50, harborId: 7 },
    mock: { minHeight: 10, maxHeight: 90, periodHours: 12.42, waveType: MockWaveType.SINE },
    lastValidData: null
  },
  displayConfig: {
    type: DisplayType.GC9A01_240, // Default to standard
    driver: DisplayDriver.TFT_ESPI,
    pinSCK: 18, pinMOSI: 23, pinCS: 5, pinDC: 2, pinRST: 4, pinBLK: 22, 
    rotation: 0, brightness: 200, fps: 30,
    spi: { frequency: 40000000, mode: 0, dataOrderMSB: true },
    backlight: { pwmFrequency: 5000, smoothing: true },
    renderMode: RenderMode.QUALITY,
    theme: DisplayTheme.DEFAULT,
    simulateSunlight: false, simulatePixelGrid: false, simulateRGB565: true
  },
  displayWidgets: [
    { id: '1', type: WidgetType.TIDE_GAUGE, x: 120, y: 120, scale: 1, color: '#0ea5e9', visible: true, zIndex: 0 },
    { id: '2', type: WidgetType.TEXT_LABEL, x: 120, y: 160, scale: 1, color: '#ffffff', label: 'NÍVEL MARÉ', visible: true, zIndex: 1 },
  ],
  weatherData: {
      temp: 28.5, humidity: 78, windSpeed: 22, windDir: 45, feelsLike: 31, uv: 8, pressure: 1012, cloud: 20, precip: 0,
      sunrise: "05:30", sunset: "17:45", isDay: true, battery: 100, moonPhase: "Waxing Crescent", moonIllumination: 25, conditionText: "Ensolarado", forecast: []
  },
  apiLoading: false, apiError: null, apiDebugLog: null, notification: null,

  setView: (view) => set({ currentView: view }),
  setActiveDevice: (id) => set({ activeDeviceId: id }),
  setConnectionType: (type) => set({ connectionType: type }),
  addDevice: (device) => set((state) => ({ devices: [...state.devices, device] })),
  updateDeviceStatus: (id, status) => set((state) => ({ devices: state.devices.map((d) => (d.id === id ? { ...d, status } : d)) })),
  setKeyframes: (keyframes) => set({ keyframes }),
  addKeyframe: (keyframe) => set((state) => ({ keyframes: [...state.keyframes, keyframe].sort((a, b) => a.timeOffset - b.timeOffset) })),
  updateKeyframe: (id, updates) => set((state) => ({ keyframes: state.keyframes.map((k) => (k.id === id ? { ...k, ...updates } : k)).sort((a, b) => a.timeOffset - b.timeOffset) })),
  removeKeyframe: (id) => set((state) => ({ keyframes: state.keyframes.filter((k) => k.id !== id) })),
  setSimulatedTime: (time) => set({ simulatedTime: time }),
  updateFirmwareConfig: (config) => set((state) => ({ firmwareConfig: { ...state.firmwareConfig, ...config } })),
  updateDataSourceConfig: (config) => set((state) => ({ dataSourceConfig: { ...state.dataSourceConfig, ...config } })),
  setDisplayConfig: (config) => set((state) => ({ displayConfig: { ...state.displayConfig, ...config } })),
  setDisplayWidgets: (widgets) => set({ displayWidgets: widgets }),
  addDisplayWidget: (widget) => set((state) => ({ displayWidgets: [...state.displayWidgets, widget] })),
  updateDisplayWidget: (id, updates) => set((state) => ({ displayWidgets: state.displayWidgets.map(w => w.id === id ? { ...w, ...updates } : w) })),
  removeDisplayWidget: (id) => set((state) => ({ displayWidgets: state.displayWidgets.filter(w => w.id !== id) })),
  setWeatherData: (data) => set((state) => ({ weatherData: { ...state.weatherData, ...data } })),
  setApiStatus: (loading, error) => set({ apiLoading: loading, apiError: error }),
  setApiDebugLog: (log) => set({ apiDebugLog: log }),
  setNotification: (type, message) => set({ notification: { id: Math.random().toString(), type, message } }),
  clearNotification: () => set({ notification: null }),
}));