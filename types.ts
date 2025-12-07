

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
    OLED_128 = 'OLED_128'
}

export enum WidgetType {
  TIDE_GAUGE = 'TIDE_GAUGE', 
  CLOCK_DIGITAL = 'CLOCK_DIGITAL',
  CLOCK_ANALOG = 'CLOCK_ANALOG',
  TEXT_LABEL = 'TEXT_LABEL',
  ICON_WEATHER = 'ICON_WEATHER',
  MINI_CHART = 'MINI_CHART',
  TIDE_RADAR = 'TIDE_RADAR',
  MOON_PHASE = 'MOON_PHASE',
  TIDE_RING = 'TIDE_RING',
  TIDE_FILL = 'TIDE_FILL',
  WIND_VECTOR = 'WIND_VECTOR',
  TEMP_GAUGE = 'TEMP_GAUGE',
  HUMIDITY_DOTS = 'HUMIDITY_DOTS',
  RAIN_METER = 'RAIN_METER',
  SOUND_PULSE = 'SOUND_PULSE',
  HORIZON_BAR = 'HORIZON_BAR',
  STATUS_WIFI_ICON = 'STATUS_WIFI_ICON',
  STATUS_WIFI_TEXT = 'STATUS_WIFI_TEXT',
  STATUS_BLE_ICON = 'STATUS_BLE_ICON',
  STATUS_BLE_TEXT = 'STATUS_BLE_TEXT',
  AI_IMAGE = 'AI_IMAGE',
  WEATHER_TEMP_TEXT = 'WEATHER_TEMP_TEXT',
  WEATHER_HUMIDITY_TEXT = 'WEATHER_HUMIDITY_TEXT',
  WEATHER_WIND_TEXT = 'WEATHER_WIND_TEXT',
  WEATHER_CONDITION_TEXT = 'WEATHER_CONDITION_TEXT',
  
  OLED_MODERN_RING = 'OLED_MODERN_RING',
  OLED_STATUS_BAR = 'OLED_STATUS_BAR',
  OLED_MINI_GRAPH = 'OLED_MINI_GRAPH'
}

export enum DisplayTheme {
  DEFAULT = 'DEFAULT',
  AZUL_OCEANO = 'AZUL_OCEANO',
  SOL_MORERE = 'SOL_MORERE',
  NOITE_TROPICAL = 'NOITE_TROPICAL',
  OCEAN_TURQUOISE = 'OCEAN_TURQUOISE',
  SUNSET_BAHIA = 'SUNSET_BAHIA',
  STARRY_NIGHT = 'STARRY_NIGHT',
  TROPICAL_STORM = 'TROPICAL_STORM',
  MORERE_MINIMAL = 'MORERE_MINIMAL',
  CYBER_GRID = 'CYBER_GRID',
  VORTEX = 'VORTEX',
  JELLYFISH_JAM = 'JELLYFISH_JAM',
  DIGITAL_RAIN = 'DIGITAL_RAIN',
  NEON_RIPPLES = 'NEON_RIPPLES',
  RETRO_SUNSET = 'RETRO_SUNSET',
  CORAL_REEF = 'CORAL_REEF',
  OLED_MODERN = 'OLED_MODERN'
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
  scale: number;
  color: string;
  color2?: string;
  label?: string;
  imageUrl?: string;
  visible: boolean;
  zIndex: number;
  rotation?: number;
  opacity?: number;
  thickness?: number;
  fontFamily?: string;
}

export interface DisplayConfig {
  type: DisplayType; 
  driver: DisplayDriver;
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

export interface CompiledFirmwareData {
    timestamp: number;
    frames: Keyframe[];
    defaultTemp: number;
    defaultWind: number;
    defaultHumidity: number;
    useFixedWeather: boolean;
}

export interface FirmwareConfig {
  ssid: string;
  password: string;
  deviceName: string;
  enableBLE: boolean;
  enableSerial: boolean;
  cycleDuration: number;
  nightMode: LedNightMode;
  lowPowerMode: LowPowerConfig;
  weatherApi: WeatherApiConfig;
  autonomous: AutonomousConfig;
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
  compiledData?: CompiledFirmwareData; // New field for compiled data
}

export interface DailyForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  rainChance: number;
  condition: string;
  icon?: string;
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