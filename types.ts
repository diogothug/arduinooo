

export enum EffectType {
  STATIC = 'STATIC',
  WAVE = 'WAVE',
  PULSE = 'PULSE',
  GLOW = 'GLOW',
}

export interface Keyframe {
  id: string;
  timeOffset: number; // 0 to 24 (hours), or 0 to 168 for weekly
  height: number; // 0 to 100 (%)
  color: string; // Hex color
  intensity: number; // 0 to 255
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

// --- DATA SOURCE TYPES ---

export enum TideSourceType {
  API = 'API',
  TABUA_MARE = 'TABUA_MARE', // New Brazil API
  MOCK = 'MOCK',
  CALCULATED = 'CALCULATED'
}

export enum MockWaveType {
  SINE = 'SINE',
  TRIANGLE = 'TRIANGLE',
  STEP = 'STEP'
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
  harborId?: number | null; // ID specific port override
  lastFoundHarbor?: string | null;
}

export interface MockConfig {
  minHeight: number; // 0-100
  maxHeight: number; // 0-100
  periodHours: number; // e.g. 12.4 (12h25m approx)
  waveType: MockWaveType;
}

export interface DataSourceConfig {
  activeSource: TideSourceType;
  api: ApiConfig;
  tabuaMare: TabuaMareConfig;
  mock: MockConfig;
  lastValidData: Keyframe | null; // For calculation fallback
}

// --- HARDWARE & DISPLAY TYPES ---

export enum DisplayDriver {
  TFT_ESPI = 'TFT_eSPI',
  ARDUINO_GFX = 'Arduino_GFX',
}

export enum WidgetType {
  // V1 Widgets
  TIDE_GAUGE = 'TIDE_GAUGE', 
  CLOCK_DIGITAL = 'CLOCK_DIGITAL',
  CLOCK_ANALOG = 'CLOCK_ANALOG',
  TEXT_LABEL = 'TEXT_LABEL',
  ICON_WEATHER = 'ICON_WEATHER',
  MINI_CHART = 'MINI_CHART',
  TIDE_RADAR = 'TIDE_RADAR',
  MOON_PHASE = 'MOON_PHASE',
  
  // V2.1 New Widgets
  TIDE_RING = 'TIDE_RING',
  TIDE_FILL = 'TIDE_FILL', // Physics liquid fill
  WIND_VECTOR = 'WIND_VECTOR', // Animated arrow
  TEMP_GAUGE = 'TEMP_GAUGE',
  HUMIDITY_DOTS = 'HUMIDITY_DOTS',
  RAIN_METER = 'RAIN_METER',
  SOUND_PULSE = 'SOUND_PULSE',
  HORIZON_BAR = 'HORIZON_BAR',

  // V2.2 Status & AI
  STATUS_WIFI_ICON = 'STATUS_WIFI_ICON',
  STATUS_WIFI_TEXT = 'STATUS_WIFI_TEXT',
  STATUS_BLE_ICON = 'STATUS_BLE_ICON',
  STATUS_BLE_TEXT = 'STATUS_BLE_TEXT',
  AI_IMAGE = 'AI_IMAGE',

  // V2.3 Granular Weather (New)
  WEATHER_TEMP_TEXT = 'WEATHER_TEMP_TEXT',
  WEATHER_HUMIDITY_TEXT = 'WEATHER_HUMIDITY_TEXT',
  WEATHER_WIND_TEXT = 'WEATHER_WIND_TEXT',
  WEATHER_CONDITION_TEXT = 'WEATHER_CONDITION_TEXT',
}

export enum DisplayTheme {
  // V1 Themes
  DEFAULT = 'DEFAULT',
  AZUL_OCEANO = 'AZUL_OCEANO',
  SOL_MORERE = 'SOL_MORERE',
  NOITE_TROPICAL = 'NOITE_TROPICAL',
  
  // V2.1 Themes
  OCEAN_TURQUOISE = 'OCEAN_TURQUOISE',
  SUNSET_BAHIA = 'SUNSET_BAHIA',
  STARRY_NIGHT = 'STARRY_NIGHT',
  TROPICAL_STORM = 'TROPICAL_STORM',
  MORERE_MINIMAL = 'MORERE_MINIMAL',

  // V2.4 New Animated Themes
  CYBER_GRID = 'CYBER_GRID',
  VORTEX = 'VORTEX',
  JELLYFISH_JAM = 'JELLYFISH_JAM',

  // V2.5 Extra Animated Themes
  DIGITAL_RAIN = 'DIGITAL_RAIN',
  NEON_RIPPLES = 'NEON_RIPPLES',
  RETRO_SUNSET = 'RETRO_SUNSET',
  CORAL_REEF = 'CORAL_REEF'
}

export enum RenderMode {
  PERFORMANCE = 'PERFORMANCE', // 60fps, no AA
  QUALITY = 'QUALITY', // 30fps, AA, Dithering
}

export interface SPIConfig {
  frequency: number; // 20, 40, 60, 80 MHz
  mode: 0 | 1 | 2 | 3;
  dataOrderMSB: boolean;
}

export interface BacklightConfig {
  pwmFrequency: number; // e.g., 5000Hz
  smoothing: boolean;
}

export interface LedNightMode {
  enabled: boolean;
  startHour: number; // e.g. 22
  endHour: number; // e.g. 4.75 (4:45)
  brightnessFactor: number; // 0.0 to 1.0 (0.5 = 50%)
}

export interface DisplayWidget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  scale: number; // 0.5 to 2.0
  color: string;
  color2?: string; // Secondary color for gradients/accents
  label?: string; // For text widgets
  imageUrl?: string; // Base64 or URL for AI_IMAGE
  visible: boolean;
  zIndex: number; // Layer order
  
  // V2.1 Properties
  rotation?: number; // 0-360 degrees
  opacity?: number; // 0.0-1.0
  thickness?: number; // For rings/lines
  fontFamily?: string;
}

export interface DisplayConfig {
  driver: DisplayDriver;
  pinSCK: number;
  pinMOSI: number;
  pinCS: number;
  pinDC: number;
  pinRST: number;
  pinBLK: number;
  rotation: 0 | 1 | 2 | 3; // 0, 90, 180, 270
  brightness: number; // 0-255
  fps: number;
  
  // Advanced V2.0
  spi: SPIConfig;
  backlight: BacklightConfig;
  renderMode: RenderMode;
  theme: DisplayTheme;
  simulateSunlight: boolean; // Visual only
  simulatePixelGrid: boolean; // Visual only
  simulateRGB565: boolean; // Visual only
}

export interface LowPowerConfig {
  enabled: boolean;
  idleFps: number; // e.g., 5
  dimBacklight: boolean;
  batteryThreshold: number; // e.g., 20%
}

export interface WeatherApiConfig {
    enabled: boolean;
    apiKey: string;
    location: string;
    intervalMinutes: number;
}

export interface AutonomousConfig {
    enabled: boolean;
    linkSpeedToTide: boolean; // High Tide = Faster Animation
    linkBrightnessToTide: boolean; // Low Tide = Dimmer
    linkPaletteToTime: boolean; // Day/Night palette shift
    linkWeatherToLeds: boolean; // New: Link Wind/Humidity to animation params
}

export interface FirmwareConfig {
  ssid: string;
  password: string;
  deviceName: string;
  enableBLE: boolean;
  enableSerial: boolean;
  cycleDuration: number; // 24 for daily, 168 for weekly
  nightMode: LedNightMode;
  lowPowerMode: LowPowerConfig; // Island Mode
  weatherApi: WeatherApiConfig;
  autonomous: AutonomousConfig; // Logic on Chip

  // LED Master Config
  ledCount: number;
  ledPin: number;
  ledBrightness: number; // 0-255
  ledColorOrder: 'GRB' | 'RGB';
  ledLayoutType: 'STRIP' | 'MATRIX' | 'RING' | 'SPIRAL' | 'MOUNTAIN' | 'CUSTOM'; // Expanded
  ledMatrixWidth?: number; // Only for matrix
  ledMatrixHeight?: number; // New: Explicit height
  ledSerpentine?: boolean; // New: ZigZag wiring
  ledSpiralTurns?: number; // New: For spiral layout
  customColors?: string[]; // New: User defined palette (Up to 5 hex codes)
  
  // Animation Engine 2.0
  animationMode: string;
  animationSpeed: number;
  animationIntensity: number;
  animationPalette: number;
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
  // Core
  temp: number;
  humidity: number;
  windSpeed: number; // km/h
  windDir: number; // degrees
  
  // Environment (New)
  feelsLike: number;
  uv: number;
  pressure: number; // mb
  cloud: number; // %
  precip: number; // mm
  
  // Astronomy
  moonPhase: string;
  moonIllumination: number; // 0-100
  isDay: boolean;
  sunrise: string;
  sunset: string;

  // Status & Forecast
  battery: number; // %
  conditionText: string;
  forecast: DailyForecast[];
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  EDITOR = 'EDITOR',
  DISPLAY = 'DISPLAY',
  LED_MASTER = 'LED_MASTER',
  FIRMWARE = 'FIRMWARE',
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}