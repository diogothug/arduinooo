
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { 
    generateMainCpp, generateConfigH, generateMareEngineCpp, generateMareEngineH,
    generateWifiManagerCpp, generateWifiManagerH, generateOTAManagerCpp, generateOTAManagerH,
    generateRestServerCpp, generateRestServerH, generateDisplayManagerCpp, generateDisplayManagerH,
    generatePlatformIO, generateSerialManagerCpp, generateSerialManagerH, generateBleManagerCpp, generateBleManagerH,
    generateWeatherManagerCpp, generateWeatherManagerH,
    generateWs2812bConfigH, generateWs2812bConfigCpp,
    generateWs2812bControllerH, generateWs2812bControllerCpp,
    generateWs2812bAnimationsH, generateWs2812bAnimationsCpp,
    generateLogManagerH, generateLogManagerCpp,
    generateNVSManagerH, generateNVSManagerCpp,
    generateShaderEngineH, generateShaderEngineCpp,
    generateSystemHealthH, generateSystemHealthCpp,
    generateWebDashboardH,
    generateTelemetryManagerH, generateTelemetryManagerCpp,
    generatePerformanceManagerH, generatePerformanceManagerCpp,
    generateFluidEngineH, generateFluidEngineCpp,
    generateMeshManagerH, generateMeshManagerCpp,
    generateTouchManagerH, generateTouchManagerCpp,
    // ESP-IDF Generators
    generateIdfCMakeListsProject, generateIdfCMakeListsMain, generateIdfComponentYml,
    generateIdfMainCpp, generateIdfWifiManagerH, generateIdfWifiManagerCpp,
    generateIdfLedControllerH, generateIdfLedControllerCpp,
    generateIdfMareEngineH, generateIdfMareEngineCpp,
    generateIdfWeatherManagerH, generateIdfWeatherManagerCpp
} from '../services/firmwareTemplates';
import { PREMIUM_SNIPPETS } from '../services/templates/premiumSnippets';
import { Cpu, Code, Wifi, Package, FileCode, Bluetooth, Usb, Activity, Radio, Settings, Zap, HardDrive, Layout, Share2, Layers, Fingerprint, MousePointer } from 'lucide-react';
import { WifiMode, SleepMode, LogLevel, MeshRole, TouchAction } from '../types';
import JSZip from 'jszip';

type FrameworkType = 'ARDUINO' | 'ESP_IDF';

export const FirmwareBuilder: React.FC = () => {
  const { firmwareConfig, updateFirmwareConfig, keyframes, displayConfig, displayWidgets, dataSourceConfig, setNotification } = useAppStore();
  const [activeTab, setActiveTab] = useState<string>('platformio.ini');
  const [configSection, setConfigSection] = useState<'GENERAL' | 'NETWORK' | 'POWER' | 'LOGS' | 'MESH' | 'HARDWARE'>('GENERAL');
  const [framework, setFramework] = useState<FrameworkType>('ARDUINO');

  // Helper to standardise code for Arduino IDE Flat Structure
  const flattenIncludes = (content: string) => {
      let flat = content;
      flat = flat.replace(/modules\/led_ws2812b\//g, "");
      flat = flat.replace(/\.\.\/\.\.\//g, "");
      flat = flat.replace(/\.\.\//g, "");
      return flat;
  };

  // --- GENERATE FILES BASED ON FRAMEWORK ---
  const files: Record<string, string> = {};

  if (framework === 'ARDUINO') {
      const mainCppContent = generateMainCpp(displayConfig, firmwareConfig); // Pass config for Touch
      
      files['platformio.ini'] = generatePlatformIO(firmwareConfig, displayConfig);
      files['src/main.cpp'] = mainCppContent;
      files['src/config.h'] = generateConfigH(firmwareConfig, keyframes);
      files['src/LogManager.h'] = generateLogManagerH();
      files['src/LogManager.cpp'] = generateLogManagerCpp();
      files['src/NVSManager.h'] = generateNVSManagerH();
      files['src/NVSManager.cpp'] = generateNVSManagerCpp();
      files['src/WifiManager.h'] = generateWifiManagerH();
      files['src/WifiManager.cpp'] = generateWifiManagerCpp();
      files['src/OTAManager.h'] = generateOTAManagerH();
      files['src/OTAManager.cpp'] = generateOTAManagerCpp();
      files['src/MareEngine.h'] = generateMareEngineH();
      files['src/MareEngine.cpp'] = generateMareEngineCpp(keyframes); 
      files['src/RestServer.h'] = generateRestServerH();
      files['src/RestServer.cpp'] = generateRestServerCpp();
      files['src/DisplayManager.h'] = generateDisplayManagerH();
      files['src/DisplayManager.cpp'] = generateDisplayManagerCpp(displayWidgets, displayConfig);
      files['src/SerialManager.h'] = generateSerialManagerH();
      files['src/SerialManager.cpp'] = generateSerialManagerCpp();
      files['src/FluidEngine.h'] = generateFluidEngineH();
      files['src/FluidEngine.cpp'] = generateFluidEngineCpp();
      files['src/SystemHealth.h'] = generateSystemHealthH();
      files['src/SystemHealth.cpp'] = generateSystemHealthCpp();
      files['src/TelemetryManager.h'] = generateTelemetryManagerH();
      files['src/TelemetryManager.cpp'] = generateTelemetryManagerCpp();
      files['src/PerformanceManager.h'] = generatePerformanceManagerH();
      files['src/PerformanceManager.cpp'] = generatePerformanceManagerCpp();
      files['src/WebDashboard.h'] = generateWebDashboardH();
      files['src/ShaderEngine.h'] = generateShaderEngineH();
      files['src/ShaderEngine.cpp'] = generateShaderEngineCpp();
      files['src/modules/led_ws2812b/ws2812b_config.h'] = generateWs2812bConfigH();
      files['src/modules/led_ws2812b/ws2812b_config.cpp'] = generateWs2812bConfigCpp(firmwareConfig);
      files['src/modules/led_ws2812b/ws2812b_controller.h'] = generateWs2812bControllerH();
      files['src/modules/led_ws2812b/ws2812b_controller.cpp'] = generateWs2812bControllerCpp();
      files['src/modules/led_ws2812b/ws2812b_animations.h'] = generateWs2812bAnimationsH();
      files['src/modules/led_ws2812b/ws2812b_animations.cpp'] = generateWs2812bAnimationsCpp();
      files['src/MeshManager.h'] = generateMeshManagerH();
      files['src/MeshManager.cpp'] = generateMeshManagerCpp();
      
      if (firmwareConfig.touch?.enabled) {
          files['src/TouchManager.h'] = generateTouchManagerH();
          files['src/TouchManager.cpp'] = generateTouchManagerCpp();
      }

      // Arduino IDE Legacy
      files['TideFlux.ino'] = flattenIncludes(mainCppContent);

      if (firmwareConfig.enableBLE) {
          files['src/BleManager.h'] = generateBleManagerH();
          files['src/BleManager.cpp'] = generateBleManagerCpp();
      }
      
      if (firmwareConfig.weatherApi?.enabled) {
          files['src/WeatherManager.h'] = generateWeatherManagerH();
          files['src/WeatherManager.cpp'] = generateWeatherManagerCpp(firmwareConfig, dataSourceConfig);
      }
  } else {
      // --- ESP-IDF FILES ---
      files['CMakeLists.txt'] = generateIdfCMakeListsProject();
      files['main/CMakeLists.txt'] = generateIdfCMakeListsMain();
      files['main/idf_component.yml'] = generateIdfComponentYml();
      files['main/main.cpp'] = generateIdfMainCpp(firmwareConfig);
      files['main/WifiManager.h'] = generateIdfWifiManagerH();
      files['main/WifiManager.cpp'] = generateIdfWifiManagerCpp(firmwareConfig);
      files['main/LedController.h'] = generateIdfLedControllerH();
      files['main/LedController.cpp'] = generateIdfLedControllerCpp(firmwareConfig);
      files['main/MareEngine.h'] = generateIdfMareEngineH();
      files['main/MareEngine.cpp'] = generateIdfMareEngineCpp(keyframes);
      
      if (firmwareConfig.weatherApi?.enabled) {
          files['main/WeatherManager.h'] = generateIdfWeatherManagerH();
          files['main/WeatherManager.cpp'] = generateIdfWeatherManagerCpp(firmwareConfig, dataSourceConfig);
      }
  }
  
  const fileKeys = Object.keys(files);
  const currentTabValid = fileKeys.includes(activeTab);
  const defaultTab = framework === 'ARDUINO' ? 'platformio.ini' : 'main/main.cpp';
  const displayTab = currentTabValid ? activeTab : defaultTab;

  const handleDownloadZip = async () => {
      const zip = new JSZip();
      
      if (framework === 'ARDUINO') {
          const pio = zip.folder("TideFlux_PlatformIO");
          Object.entries(files).forEach(([path, content]) => {
             if (path.endsWith('.ino')) return;
             pio?.file(path, content);
          });

          const arduino = zip.folder("TideFlux_Arduino")?.folder("TideFlux");
          arduino?.file("TideFlux.ino", files['TideFlux.ino']);

          Object.entries(files).forEach(([path, content]) => {
             if (path === 'platformio.ini') return;
             if (path === 'src/main.cpp') return; 
             if (path.endsWith('.ino')) return;

             if (path.startsWith('src/')) {
                 const parts = path.split('/');
                 const filename = parts[parts.length - 1];
                 const flatContent = flattenIncludes(content);
                 arduino?.file(filename, flatContent);
             }
          });
      } else {
          // ESP-IDF Structure
          const idf = zip.folder("TideFlux_ESP-IDF");
          Object.entries(files).forEach(([path, content]) => {
              idf?.file(path, content);
          });
      }
      
      const snippetsFolder = zip.folder("Premium_Snippets_Reference");
      PREMIUM_SNIPPETS.forEach(s => {
          snippetsFolder?.file(s.filename, s.code);
      });

      const blob = await zip.generateAsync({type: "blob"});
      const element = document.createElement("a");
      element.href = URL.createObjectURL(blob);
      element.download = `TideFlux_Firmware_${framework}.zip`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      setNotification('success', `Download iniciado (${framework})!`);
  };

  const TabButton = ({ id, label, icon }: { id: string, label: string, icon: React.ReactNode }) => (
      <button 
          onClick={() => setConfigSection(id as any)}
          className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1 border-b-2 transition ${configSection === id ? 'border-cyan-500 text-white bg-slate-700/50' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
      >
          {icon} {label}
      </button>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 bg-slate-800 rounded-lg border border-slate-700 h-auto shrink-0 flex flex-col">
            <div className="p-4 border-b border-slate-700 bg-slate-850">
                <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                    <Cpu className="text-cyan-400" /> Configuração Firmware
                </h2>

                {/* Framework Selector */}
                <div className="bg-slate-900 p-1 rounded-lg flex mb-1 border border-slate-700">
                    <button 
                        onClick={() => { setFramework('ARDUINO'); setActiveTab('platformio.ini'); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-xs font-bold transition ${framework === 'ARDUINO' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Zap size={14} /> Arduino / PIO
                    </button>
                    <button 
                        onClick={() => { setFramework('ESP_IDF'); setActiveTab('main/main.cpp'); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-xs font-bold transition ${framework === 'ESP_IDF' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Layers size={14} /> ESP-IDF Native
                    </button>
                </div>
            </div>
            
            {/* Tabs */}
            <div className="flex bg-slate-900 border-b border-slate-700 overflow-x-auto">
                <TabButton id="GENERAL" label="Geral" icon={<Layout size={14}/>} />
                <TabButton id="HARDWARE" label="Periféricos" icon={<Fingerprint size={14}/>} />
                <TabButton id="NETWORK" label="Rede" icon={<Wifi size={14}/>} />
                <TabButton id="POWER" label="Energia" icon={<Zap size={14}/>} />
            </div>

            <div className="p-6 space-y-4 flex-1">
                {/* --- GENERAL TAB --- */}
                {configSection === 'GENERAL' && (
                    <div className="space-y-4 animate-in fade-in">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Nome do Dispositivo</label>
                            <input 
                                type="text" 
                                value={firmwareConfig.deviceName}
                                onChange={(e) => updateFirmwareConfig({ deviceName: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white focus:border-cyan-500 outline-none transition"
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Pino LED (GPIO)</label>
                                <input 
                                    type="number" 
                                    value={firmwareConfig.ledPin}
                                    onChange={(e) => updateFirmwareConfig({ ledPin: parseInt(e.target.value) })}
                                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Qtd. LEDs</label>
                                <input 
                                    type="number" 
                                    value={firmwareConfig.ledCount}
                                    onChange={(e) => updateFirmwareConfig({ ledCount: parseInt(e.target.value) })}
                                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
                                />
                            </div>
                        </div>

                         <div className="pt-4 border-t border-slate-700">
                            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                               <Usb size={14} className="text-white" /> Interfaces & Opções
                            </h3>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between bg-slate-900 p-3 rounded border border-slate-700">
                                     <div className="flex items-center gap-2">
                                         <Bluetooth size={16} className={firmwareConfig.enableBLE ? "text-blue-400" : "text-slate-500"} />
                                         <span className="text-xs font-bold text-slate-300">Bluetooth (BLE)</span>
                                     </div>
                                     <input 
                                        type="checkbox" 
                                        checked={firmwareConfig.enableBLE}
                                        onChange={e => updateFirmwareConfig({ enableBLE: e.target.checked })}
                                        className="w-4 h-4 cursor-pointer"
                                     />
                                </div>
                                <div className="flex items-center justify-between bg-slate-900 p-3 rounded border border-slate-700">
                                     <div className="flex items-center gap-2">
                                         <Activity size={16} className={firmwareConfig.enableSystemHealth ? "text-green-400" : "text-slate-500"} />
                                         <span className="text-xs font-bold text-slate-300">Self-Diagnóstico</span>
                                     </div>
                                     <input 
                                        type="checkbox" 
                                        checked={firmwareConfig.enableSystemHealth}
                                        onChange={e => updateFirmwareConfig({ enableSystemHealth: e.target.checked })}
                                        className="w-4 h-4 cursor-pointer"
                                     />
                                </div>
                            </div>
                         </div>
                    </div>
                )}

                {/* --- HARDWARE / PERIPHERALS TAB --- */}
                {configSection === 'HARDWARE' && (
                    <div className="space-y-4 animate-in fade-in">
                        <div className="bg-slate-900 p-4 rounded border border-slate-700 space-y-4">
                             <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                 <div className="flex items-center gap-2">
                                     <Fingerprint size={18} className={firmwareConfig.touch.enabled ? "text-pink-400" : "text-slate-500"} />
                                     <div>
                                         <div className="text-xs font-bold text-white">Botões Touch Capacitivos</div>
                                         <div className="text-[9px] text-slate-500">Botões invisíveis na madeira</div>
                                     </div>
                                 </div>
                                 <input 
                                    type="checkbox" 
                                    checked={firmwareConfig.touch.enabled}
                                    onChange={e => updateFirmwareConfig({ touch: { ...firmwareConfig.touch, enabled: e.target.checked } })}
                                    className="w-4 h-4 cursor-pointer accent-pink-500"
                                 />
                             </div>

                             {firmwareConfig.touch.enabled && (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                                        <span>Sensibilidade (Threshold)</span>
                                        <span>Quanto menor, menos sensível</span>
                                    </div>
                                    
                                    {firmwareConfig.touch.pins.map((pin, index) => (
                                        <div key={index} className="bg-slate-800 p-2 rounded border border-slate-700 flex items-center gap-2">
                                            <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center text-xs font-mono border border-slate-600 text-pink-400">
                                                T{pin.gpio === 4 ? '0' : pin.gpio === 2 ? '2' : 'X'}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex gap-2 mb-1">
                                                    <input 
                                                        type="number" placeholder="GPIO" 
                                                        value={pin.gpio}
                                                        onChange={(e) => {
                                                            const newPins = [...firmwareConfig.touch.pins];
                                                            newPins[index].gpio = parseInt(e.target.value);
                                                            updateFirmwareConfig({ touch: { ...firmwareConfig.touch, pins: newPins } });
                                                        }}
                                                        className="w-12 bg-slate-900 border border-slate-600 rounded px-1 text-xs text-white"
                                                    />
                                                    <select 
                                                        value={pin.action}
                                                        onChange={(e) => {
                                                            const newPins = [...firmwareConfig.touch.pins];
                                                            newPins[index].action = e.target.value as TouchAction;
                                                            updateFirmwareConfig({ touch: { ...firmwareConfig.touch, pins: newPins } });
                                                        }}
                                                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-1 text-xs text-white"
                                                    >
                                                        <option value={TouchAction.NEXT_MODE}>Próx. Modo</option>
                                                        <option value={TouchAction.PREV_MODE}>Ant. Modo</option>
                                                        <option value={TouchAction.TOGGLE_POWER}>Ligar/Desligar</option>
                                                        <option value={TouchAction.BRIGHTNESS_UP}>Brilho +</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <p className="text-[9px] text-slate-500 italic">
                                        Use GPIO 4 (T0), 2 (T2), 15 (T3), 13 (T4), 12 (T5), 14 (T6), 27 (T7), 33 (T8), 32 (T9).
                                    </p>
                                </div>
                             )}
                        </div>

                        <div className="bg-slate-900 p-4 rounded border border-slate-700">
                             <div className="flex items-center gap-2 mb-2">
                                 <MousePointer size={16} className="text-cyan-400"/>
                                 <span className="text-xs font-bold text-white">Driver de Display</span>
                             </div>
                             <div className="text-[10px] text-slate-400 mb-2">
                                 O firmware utiliza <strong>LEDC (PWM Hardware)</strong> para controle de brilho do backlight, garantindo 0 flickering.
                             </div>
                             <div className="flex items-center gap-2">
                                 <div className="w-full bg-slate-800 h-2 rounded overflow-hidden">
                                     <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 w-3/4"></div>
                                 </div>
                                 <span className="text-xs font-mono text-cyan-400">12-bit</span>
                             </div>
                        </div>
                    </div>
                )}

                {/* --- NETWORK TAB --- */}
                {configSection === 'NETWORK' && (
                    <div className="space-y-4 animate-in fade-in">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">SSID (Rede)</label>
                            <input 
                                type="text" 
                                value={firmwareConfig.ssid}
                                onChange={(e) => updateFirmwareConfig({ ssid: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Senha</label>
                            <input 
                                type="password" 
                                value={firmwareConfig.password}
                                onChange={(e) => updateFirmwareConfig({ password: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Modo WiFi</label>
                                <select 
                                    value={firmwareConfig.wifiMode}
                                    onChange={e => updateFirmwareConfig({ wifiMode: e.target.value as WifiMode })}
                                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white text-xs"
                                >
                                    <option value={WifiMode.STA}>Station (Cliente)</option>
                                    <option value={WifiMode.AP}>Access Point</option>
                                    <option value={WifiMode.AP_STA}>Híbrido (AP+STA)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Min. RSSI (dBm)</label>
                                <input 
                                    type="number" 
                                    value={firmwareConfig.minRssi}
                                    onChange={e => updateFirmwareConfig({ minRssi: parseInt(e.target.value) })}
                                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white text-xs"
                                />
                            </div>
                        </div>

                         <div className="bg-slate-900 p-3 rounded border border-slate-700 space-y-2">
                             <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2">
                                     <Radio size={14} className={firmwareConfig.ota?.enabled ? "text-amber-400" : "text-slate-500"} />
                                     <span className="text-xs font-bold text-slate-300">OTA Update (Remoto)</span>
                                 </div>
                                 <input 
                                    type="checkbox" 
                                    checked={firmwareConfig.ota?.enabled}
                                    onChange={e => updateFirmwareConfig({ ota: { ...firmwareConfig.ota, enabled: e.target.checked } })}
                                    className="w-4 h-4 cursor-pointer"
                                 />
                             </div>
                         </div>
                    </div>
                )}
                
                {/* --- POWER TAB --- */}
                {configSection === 'POWER' && (
                    <div className="space-y-4 animate-in fade-in">
                         <div>
                            <label className="block text-xs text-slate-500 mb-1">Modo de Sono (Sleep)</label>
                            <select 
                                value={firmwareConfig.sleepMode}
                                onChange={e => updateFirmwareConfig({ sleepMode: e.target.value as SleepMode })}
                                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm"
                            >
                                <option value={SleepMode.NONE}>Nenhum (Always On)</option>
                                <option value={SleepMode.LIGHT}>Light Sleep (Economia)</option>
                                <option value={SleepMode.DEEP}>Deep Sleep (Bateria)</option>
                            </select>
                        </div>
                        
                        {firmwareConfig.sleepMode !== SleepMode.NONE && (
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Wake Up Interval (seg)</label>
                                <input 
                                    type="number" 
                                    value={firmwareConfig.wakeupInterval}
                                    onChange={e => updateFirmwareConfig({ wakeupInterval: parseInt(e.target.value) })}
                                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
                                />
                            </div>
                        )}

                        <div className="pt-2 border-t border-slate-700">
                            <h3 className="text-xs font-bold text-slate-400 mb-3">Agendamento de Brilho (Noturno)</h3>
                            <div className="bg-slate-900 p-3 rounded border border-slate-700 space-y-3">
                                 <div className="flex items-center justify-between">
                                     <span className="text-xs font-bold text-slate-300">Ativar Modo Noturno</span>
                                     <input 
                                        type="checkbox" 
                                        checked={firmwareConfig.nightMode.enabled}
                                        onChange={e => updateFirmwareConfig({ nightMode: {...firmwareConfig.nightMode, enabled: e.target.checked} })}
                                        className="w-4 h-4 cursor-pointer"
                                     />
                                 </div>
                                 <div className="grid grid-cols-2 gap-2">
                                     <div>
                                         <label className="text-[10px] text-slate-500">Início (Hora)</label>
                                         <input type="number" step="0.5" value={firmwareConfig.nightMode.startHour} onChange={e=>updateFirmwareConfig({nightMode:{...firmwareConfig.nightMode, startHour: parseFloat(e.target.value)}})} className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white"/>
                                     </div>
                                     <div>
                                         <label className="text-[10px] text-slate-500">Fim (Hora)</label>
                                         <input type="number" step="0.5" value={firmwareConfig.nightMode.endHour} onChange={e=>updateFirmwareConfig({nightMode:{...firmwareConfig.nightMode, endHour: parseFloat(e.target.value)}})} className="w-full bg-slate-800 border border-slate-600 rounded p-1 text-xs text-white"/>
                                     </div>
                                 </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-auto pt-6 border-t border-slate-700">
                    <button 
                        onClick={handleDownloadZip}
                        className={`w-full font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition shadow-lg ${framework === 'ARDUINO' ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-cyan-900/50' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/50'}`}
                    >
                        <Package size={20} /> 
                        Baixar ZIP ({framework === 'ARDUINO' ? 'PlatformIO' : 'ESP-IDF'})
                    </button>
                    <p className="text-[10px] text-slate-500 text-center mt-2">
                        Premium Snippets são incluídos automaticamente no ZIP.
                    </p>
                </div>
            </div>
        </div>

        {/* Code Preview (Project Files Only) */}
        <div className="lg:col-span-2 bg-slate-900 rounded-lg border border-slate-700 flex flex-col overflow-hidden min-h-[600px]">
            {/* Top Toolbar: Tabs */}
            <div className="flex border-b border-slate-700 bg-slate-800 overflow-x-auto custom-scrollbar shrink-0">
                {Object.keys(files).filter(f => !f.includes("modules/") && !f.endsWith(".ino")).map(fileName => (
                    <button 
                        key={fileName}
                        onClick={() => setActiveTab(fileName)}
                        className={`px-4 py-3 text-sm font-medium flex items-center gap-2 whitespace-nowrap ${displayTab === fileName ? 'text-cyan-400 bg-slate-900 border-t-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        {fileName.endsWith('.h') || fileName.endsWith('.cpp') ? <Code size={14}/> : <Settings size={14}/>} {fileName.replace('src/', '')}
                    </button>
                ))}
            </div>
            
            <div className="flex-1 overflow-auto p-4 bg-[#0d1117]">
                <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">
                    <code>{files[displayTab] || "Select a file to preview"}</code>
                </pre>
            </div>
        </div>
    </div>
  );
};
