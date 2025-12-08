

import { create } from 'zustand';
import { Keyframe, Device, ViewState, EffectType, FirmwareConfig, DisplayConfig, DisplayWidget, WidgetType, DisplayDriver, ConnectionType, DisplayTheme, RenderMode, DataSourceConfig, TideSourceType, MockWaveType, WeatherData, Notification, DisplayType, SavedMock, WifiMode, SleepMode, LogLevel, MeshRole, TouchAction } from './types';

console.log("🟦 [Store] Loading store.ts module...");

interface AppState {
  currentView: ViewState;
  devices: Device[];
  activeDeviceId: string | null;
  connectionType: ConnectionType;
  keyframes: Keyframe[];
  savedMocks: SavedMock[]; 
  simulatedTime: number; 
  systemTime: number; // Real-world clock
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
  
  saveMock: (name: string, frames: Keyframe[]) => void;
  deleteMock: (id: string) => void;

  setSimulatedTime: (time: number) => void;
  setSystemTime: (time: number) => void;
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
  savedMocks: [
      { 
          id: 'mock_default', 
          name: 'Moreré Padrão 2025', 
          frames: [
            { id: 'm1', timeOffset: 2.18, height: 15, color: '#004488', intensity: 50, effect: EffectType.STATIC },
            { id: 'm2', timeOffset: 8.65, height: 95, color: '#00eebb', intensity: 200, effect: EffectType.WAVE },
            { id: 'm3', timeOffset: 14.45, height: 20, color: '#004488', intensity: 50, effect: EffectType.STATIC },
            { id: 'm4', timeOffset: 20.85, height: 90, color: '#00eebb', intensity: 200, effect: EffectType.WAVE }
          ],
          description: "Dados estáticos baseados na tábua de dez/2025"
      }
  ],
  simulatedTime: 12,
  systemTime: Date.now(),
  firmwareConfig: {
    ssid: 'Moreré_WiFi',
    password: '',
    ledCount: 60,
    ledPin: 18,
    ledBrightness: 160,
    ledColorOrder: 'GRB',
    ledLayoutType: 'STRIP',
    ledMatrixWidth: 8,
    ledMatrixHeight: 8,
    ledSerpentine: true,
    ledSpiralTurns: 3,
    customColors: ['#000044', '#004488', '#0099cc', '#00ffcc', '#ffffff'],
    deviceName: 'MareFlux_ESP32',
    enableBLE: true,
    enableSerial: true,
    ota: { enabled: true, password: '' },
    cycleDuration: 24,
    nightMode: { enabled: true, startHour: 22.0, endHour: 4.75, brightnessFactor: 0.5 },
    lowPowerMode: { enabled: true, idleFps: 5, dimBacklight: true, batteryThreshold: 20 },
    weatherApi: { enabled: true, apiKey: 'KEY', location: '-13.613295,-38.908930', intervalMinutes: 60 },
    autonomous: { enabled: true, linkSpeedToTide: true, linkBrightnessToTide: false, linkPaletteToTime: false, linkWeatherToLeds: true },
    physicalSpecs: { stripLengthMeters: 1.0, ledDensity: 60, maxPowerAmps: 2.0 },
    fluidParams: { tension: 0.025, damping: 0.02, spread: 0.1 },
    animationMode: 'fluidPhysics',
    animationSpeed: 1.0,
    animationIntensity: 0.5,
    animationPalette: 0,
    compiledData: undefined,
    shader: {
        enabled: false,
        code: 'sin(t + i * 0.2)', // Basic default
        uniforms: { speed: 1.0, scale: 1.0, color1: '#0000FF', color2: '#00FFFF' }
    },
    mesh: {
        enabled: false,
        meshId: 'TideMesh_01',
        password: 'mesh_secure_pass',
        channel: 6,
        role: MeshRole.AUTO,
        maxLayers: 6
    },
    touch: {
        enabled: true,
        calibrationSamples: 20,
        pins: [
            { gpio: 4, threshold: 40, action: TouchAction.NEXT_MODE },
            { gpio: 15, threshold: 40, action: TouchAction.TOGGLE_POWER }
        ]
    },
    enableWebDashboard: true,
    enableSystemHealth: true,
    
    wifiMode: WifiMode.STA,
    minRssi: -85,
    wifiWatchdog: true,
    sleepMode: SleepMode.NONE,
    wakeupInterval: 60,
    logLevel: LogLevel.INFO,
    remoteLog: true,
    logCircularBuffer: true
  },
  dataSourceConfig: {
    activeSource: TideSourceType.TABUA_MARE,
    api: { url: '', token: '', intervalMinutes: 60, locationId: '' },
    tabuaMare: { baseUrl: 'https://tabuamare.devtu.qzz.io/api/v1', uf: 'ba', lat: -12.97, lng: -38.50, harborId: 7 },
    mock: { minHeight: 10, maxHeight: 90, periodHours: 12.42, waveType: MockWaveType.SINE },
    calculation: { period: 12.42, amplitude: 45, offset: 50, phase: 0 },
    lastValidData: null
  },
  displayConfig: {
    type: DisplayType.SSD1306_128x64, 
    driver: DisplayDriver.U8G2_OLED,
    width: 128,
    height: 64,
    pinSCK: 18, pinMOSI: 23, pinCS: 5, pinDC: 2, pinRST: 4, pinBLK: 22, 
    rotation: 0, brightness: 200, fps: 30,
    spi: { frequency: 40000000, mode: 0, dataOrderMSB: true },
    backlight: { pwmFrequency: 5000, smoothing: true },
    renderMode: RenderMode.QUALITY,
    theme: DisplayTheme.MINIMAL_OLED,
    simulateSunlight: false, 
    simulatePixelGrid: true, 
    simulateRGB565: false,
    ditherEnabled: true,
    colorDepth: 1
  },
  displayWidgets: [
    { id: '1', type: WidgetType.SPARKLINE, x: 64, y: 32, scale: 1, color: '#ffffff', visible: true, zIndex: 0, valueSource: 'TIDE', w: 128, h: 40 },
    { id: '2', type: WidgetType.TEXT_VALUE, x: 64, y: 15, scale: 1, color: '#ffffff', label: 'TIDE', visible: true, zIndex: 1, valueSource: 'TIDE', fontSize: 18 },
  ],
  weatherData: {
      temp: 28.5, humidity: 78, windSpeed: 22, windDir: 45, feelsLike: 31, uv: 8, pressure: 1012, cloud: 20, precip: 0,
      sunrise: "05:30", sunset: "17:45", isDay: true, battery: 100, moonPhase: "Waxing Crescent", moonIllumination: 25, conditionText: "Ensolarado", forecast: [],
      hourlyRain: [0,0,10,30,60,40,10,0],
      wave: { height: 0.5, direction: 90, period: 5.0 }
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
  
  saveMock: (name, frames) => set((state) => ({ 
      savedMocks: [...state.savedMocks, { 
          id: Math.random().toString(36).substr(2,9), 
          name, 
          frames, 
          description: `Snapshot ${new Date().toLocaleTimeString()} • ${frames.length} pts` 
      }] 
  })),
  deleteMock: (id) => set((state) => ({ savedMocks: state.savedMocks.filter(m => m.id !== id) })),

  setSimulatedTime: (time) => set({ simulatedTime: time }),
  setSystemTime: (time) => set({ systemTime: time }),
  updateFirmwareConfig: (config) => set((state) => {
    const newConfig = { ...state.firmwareConfig, ...config };
    if (config.ota) newConfig.ota = { ...state.firmwareConfig.ota, ...config.ota };
    if (config.mesh) newConfig.mesh = { ...state.firmwareConfig.mesh, ...config.mesh };
    if (config.shader) newConfig.shader = { ...state.firmwareConfig.shader, ...config.shader };
    if (config.physicalSpecs) newConfig.physicalSpecs = { ...state.firmwareConfig.physicalSpecs, ...config.physicalSpecs };
    if (config.fluidParams) newConfig.fluidParams = { ...state.firmwareConfig.fluidParams, ...config.fluidParams };
    if (config.nightMode) newConfig.nightMode = { ...state.firmwareConfig.nightMode, ...config.nightMode };
    if (config.lowPowerMode) newConfig.lowPowerMode = { ...state.firmwareConfig.lowPowerMode, ...config.lowPowerMode };
    if (config.touch) newConfig.touch = { ...state.firmwareConfig.touch, ...config.touch };
    return { firmwareConfig: newConfig };
  }),
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