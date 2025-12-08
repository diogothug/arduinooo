

export enum EffectType {
  STATIC = 'STATIC',
  WAVE = 'WAVE',
  PULSE = 'PULSE',
  GLOW = 'GLOW',
}

export interface Keyframe {
  id: string;
  timeOffset: number;
  height: number;
  color: string;
  intensity: number;
  effect: EffectType;
}

export interface Device {
  id: string;
  name: string;
  ip: string;
  status: 'online' | 'offline';
  lastSeen: number;
}

export enum ConnectionType {
  NONE = 'NONE',
  WIFI = 'WIFI',
  USB = 'USB',
  BLE = 'BLE'
}

export enum TideSourceType {
  API = 'API',
  TABUA_MARE = 'TABUA_MARE',
  OPEN_METEO = 'OPEN_METEO',
  MOCK = 'MOCK',
  CALCULATED = 'CALCULATED'
}

export enum MockWaveType {
  SINE = 'SINE',
  TRIANGLE = 'TRIANGLE',
  STEP = 'STEP'
}

export interface CalculationParams {
  period: number;
  amplitude: number;
  offset: number;
  phase: number;
}

export interface SavedMock {
  id: string;
  name: string;
  frames: Keyframe[];
  description?: string;
}

export interface ApiConfig {
  url: string;
  token: string;
  intervalMinutes: number;
  locationId: string;
}

export interface TabuaMareConfig {
  baseUrl: string;
  uf: string;
  lat: number;
  lng: number;
  harborId?: number | null;
  lastFoundHarbor?: string | null;
}

export interface MockConfig {
  minHeight: number;
  maxHeight: number;
  periodHours: number;
  waveType: MockWaveType;
}

export interface DataSourceConfig {
  activeSource: TideSourceType;
  api: ApiConfig;
  tabuaMare: TabuaMareConfig;
  mock: MockConfig;
  calculation: CalculationParams; 
  lastValidData: Keyframe | null;
}

export enum DisplayDriver {
  TFT_ESPI = 'TFT_eSPI',
  ARDUINO_GFX = 'Arduino_GFX',
  U8G2_OLED = 'U8G2_OLED'
}

export enum DisplayType {
    GC9A01_240 = 'GC9A01_240',
    SSD1306_128x64 = 'SSD1306_128x64',
    SSD1306_128x32 = 'SSD1306_128x32',
    SH1106_128x64 = 'SH1106_128x64',
    ST7789_240x240 = 'ST7789_240x240'
}

export enum WidgetType {
  // Core Widgets
  ARC_GAUGE = 'ARC_GAUGE',          // Barra curva (TFT_eSPI drawArc)
  RADIAL_COMPASS = 'RADIAL_COMPASS', // Seta giratória
  GRAPH_LINE = 'GRAPH_LINE',        // Histórico simplificado
  DIGITAL_CLOCK = 'DIGITAL_CLOCK',  // Fonte mono/7-seg
  ANALOG_CLOCK = 'ANALOG_CLOCK',    // Ponteiros vetoriais
  SPARKLINE = 'SPARKLINE',          // Advanced Graph for OLED
  RAIN_CHART = 'RAIN_CHART',        // Hourly precipitation probability
  
  // Text Data
  TEXT_VALUE = 'TEXT_VALUE',        // Valor grande + Label pequeno
  TEXT_SIMPLE = 'TEXT_SIMPLE',      // Texto livre
  
  // Status Icons (Vector Shapes)
  ICON_WIFI = 'ICON_WIFI',
  ICON_BLE = 'ICON_BLE',
  ICON_WEATHER = 'ICON_WEATHER',
  ICON_STATUS = 'ICON_STATUS',      // Battery, etc
  
  // Decor
  RING_OUTER = 'RING_OUTER',        // Anel decorativo externo
  GRID_BACKGROUND = 'GRID_BACKGROUND', // Grid estilo radar
  
  // Legacy / Advanced
  AI_IMAGE = 'AI_IMAGE'
}

export enum DisplayTheme {
  DEFAULT = 'DEFAULT', // Preto básico
  CHRONO = 'CHRONO',   // Estilo relógio esportivo (Ticks, Alto contraste)
  TERMINAL = 'TERMINAL', // Retro verde/ambar fosforo
  MARINE = 'MARINE',   // Azul marinho, branco, laranja (náutico)
  NEON = 'NEON',       // Cyberpunk, linhas finas brilhantes
  PAPER = 'PAPER',     // Fundo claro, tinta preta (E-Ink style)
  MINIMAL_OLED = 'MINIMAL_OLED', // High contrast black/white
}

export enum RenderMode {
  PERFORMANCE = 'PERFORMANCE',
  QUALITY = 'QUALITY',
}

export interface SPIConfig {
  frequency: number;
  mode: 0 | 1 | 2 | 3;
  dataOrderMSB: boolean;
}

export interface BacklightConfig {
  pwmFrequency: number;
  smoothing: boolean;
}

export interface LedNightMode {
  enabled: boolean;
  startHour: number;
  endHour: number;
  brightnessFactor: number;
}

export interface DisplayWidget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w?: number; // Largura (para graficos)
  h?: number; // Altura
  scale: number;
  color: string;
  color2?: string; // Cor secundária/fundo
  label?: string;
  valueSource?: 'TIDE' | 'TEMP' | 'HUM' | 'WIND' | 'TIME' | 'NONE'; 
  imageUrl?: string;
  visible: boolean;
  zIndex: number;
  rotation?: number;
  thickness?: number; // Para arcos e linhas
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  inverted?: boolean;
}

export interface DisplayConfig {
  type: DisplayType; 
  driver: DisplayDriver;
  width: number;
  height: number;
  pinSCK: number;
  pinMOSI: number;
  pinCS: number;
  pinDC: number;
  pinRST: number;
  pinBLK: number;
  rotation: 0 | 1 | 2 | 3;
  brightness: number;
  fps: number;
  spi: SPIConfig;
  backlight: BacklightConfig;
  renderMode: RenderMode;
  theme: DisplayTheme;
  simulateSunlight: boolean;
  simulatePixelGrid: boolean;
  simulateRGB565: boolean;
  ditherEnabled: boolean;
  colorDepth: 1 | 16; // 1-bit or 16-bit
}

export interface LowPowerConfig {
  enabled: boolean;
  idleFps: number;
  dimBacklight: boolean;
  batteryThreshold: number;
}

export interface WeatherApiConfig {
    enabled: boolean;
    apiKey: string;
    location: string;
    intervalMinutes: number;
}

export interface AutonomousConfig {
    enabled: boolean;
    linkSpeedToTide: boolean;
    linkBrightnessToTide: boolean;
    linkPaletteToTime: boolean;
    linkWeatherToLeds: boolean;
}

export interface OtaConfig {
    enabled: boolean;
    password?: string;
}

export interface CompiledData {
    timestamp: number;
    frames: Keyframe[];
    defaultTemp: number;
    defaultWind: number;
    defaultHumidity: number;
    useFixedWeather: boolean;
}

export interface PhysicalSpecs {
    stripLengthMeters: number;
    ledDensity: 30 | 60 | 96 | 144; // LEDs per meter
    maxPowerAmps: number; // For brightness limiting
}

export interface ShaderConfig {
    enabled: boolean;
    code: string; // The math formula
    uniforms: {
        speed: number;
        scale: number;
        color1: string;
        color2: string;
    }
}

export interface FluidParams {
  tension: number; // 0.01 - 0.1 (Hooke's k)
  damping: number; // 0.01 - 0.1 (Friction)
  spread: number;  // 0.0 - 0.5 (Neighbor transfer)
}

export enum WifiMode {
    AP = 'AP',
    STA = 'STA',
    AP_STA = 'AP_STA'
}

export enum SleepMode {
    NONE = 'NONE',
    LIGHT = 'LIGHT',
    DEEP = 'DEEP'
}

export enum LogLevel {
    NONE = 'NONE',
    ERROR = 'ERROR',
    WARN = 'WARN',
    INFO = 'INFO',
    DEBUG = 'DEBUG',
    VERBOSE = 'VERBOSE'
}

export enum MeshRole {
    AUTO = 'AUTO',
    ROOT = 'ROOT',
    NODE = 'NODE'
}

export interface MeshConfig {
    enabled: boolean;
    meshId: string;
    password: string;
    channel: number;
    role: MeshRole;
    maxLayers: number;
}

// --- NATIVE PERIPHERALS CONFIG ---
export enum TouchAction {
    NONE = 'NONE',
    NEXT_MODE = 'NEXT_MODE',
    PREV_MODE = 'PREV_MODE',
    BRIGHTNESS_UP = 'BRIGHTNESS_UP',
    BRIGHTNESS_DOWN = 'BRIGHTNESS_DOWN',
    TOGGLE_POWER = 'TOGGLE_POWER',
    REBOOT = 'REBOOT'
}

export interface TouchPinConfig {
    gpio: number;
    threshold: number; // Sensitivity (Lower = less sensitive)
    action: TouchAction;
}

export interface TouchConfig {
    enabled: boolean;
    pins: TouchPinConfig[];
    calibrationSamples: number;
}

export interface FirmwareConfig {
  ssid: string;
  password: string;
  deviceName: string;
  enableBLE: boolean;
  enableSerial: boolean;
  ota: OtaConfig; 
  cycleDuration: number;
  nightMode: LedNightMode;
  lowPowerMode: LowPowerConfig;
  weatherApi: WeatherApiConfig;
  autonomous: AutonomousConfig;
  physicalSpecs: PhysicalSpecs; 
  fluidParams: FluidParams; 
  ledCount: number;
  ledPin: number;
  ledBrightness: number;
  ledColorOrder: 'GRB' | 'RGB';
  ledLayoutType: 'STRIP' | 'MATRIX' | 'RING' | 'SPIRAL' | 'MOUNTAIN' | 'CUSTOM';
  ledMatrixWidth?: number;
  ledMatrixHeight?: number;
  ledSerpentine?: boolean;
  ledSpiralTurns?: number;
  customColors?: string[];
  animationMode: string;
  animationSpeed: number;
  animationIntensity: number;
  animationPalette: number;
  compiledData?: CompiledData;
  shader: ShaderConfig; 
  mesh: MeshConfig; 
  touch: TouchConfig; 
  enableWebDashboard: boolean;
  enableSystemHealth: boolean;
  wifiMode: WifiMode;
  minRssi: number;
  wifiWatchdog: boolean;
  sleepMode: SleepMode;
  wakeupInterval: number;
  logLevel: LogLevel;
  remoteLog: boolean;
  logCircularBuffer: boolean;
}

export interface DailyForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  rainChance: number;
  condition: string;
  icon?: string;
}

export interface WaveData {
  height: number;
  direction: number;
  period: number;
}

export interface WeatherData {
  temp: number;
  humidity: number;
  windSpeed: number;
  windDir: number;
  feelsLike: number;
  uv: number;
  pressure: number;
  cloud: number;
  precip: number;
  moonPhase: string;
  moonIllumination: number;
  isDay: boolean;
  sunrise: string;
  sunset: string;
  battery: number;
  conditionText: string;
  forecast: DailyForecast[];
  hourlyRain: number[]; // Next 12-24 hours probability %
  wave?: WaveData;
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  EDITOR = 'EDITOR',
  DISPLAY = 'DISPLAY',
  LED_MASTER = 'LED_MASTER',
  FIRMWARE = 'FIRMWARE',
  ESP32 = 'ESP32'
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}