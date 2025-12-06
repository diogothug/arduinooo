

import React, { useState } from 'react';
import { useAppStore } from '../store';
import { 
    generateMainCpp, generateConfigH, generateMareEngineCpp, generateMareEngineH,
    generateWifiManagerCpp, generateWifiManagerH, 
    generateRestServerCpp, generateRestServerH, generateDisplayManagerCpp, generateDisplayManagerH,
    generatePlatformIO, generateSerialManagerCpp, generateSerialManagerH, generateBleManagerCpp, generateBleManagerH,
    generateWeatherManagerCpp, generateWeatherManagerH,
    generateWs2812bConfigH, generateWs2812bConfigCpp,
    generateWs2812bControllerH, generateWs2812bControllerCpp,
    generateWs2812bAnimationsH, generateWs2812bAnimationsCpp
} from '../services/firmwareTemplates';
import { Download, Cpu, Code, Wifi, Package, FileCode, Bluetooth, Usb, Sun, Moon, CloudSun, FolderTree, Database, Check, BrainCircuit, Activity, Zap } from 'lucide-react';
import JSZip from 'jszip';

export const FirmwareBuilder: React.FC = () => {
  const { firmwareConfig, updateFirmwareConfig, keyframes, displayConfig, displayWidgets, dataSourceConfig } = useAppStore();
  const [activeTab, setActiveTab] = useState<string>('main.cpp');

  // Build Virtual File System
  const files: Record<string, string> = {
      'platformio.ini': generatePlatformIO(firmwareConfig, displayConfig),
      'src/main.cpp': generateMainCpp(displayConfig),
      'src/config.h': generateConfigH(firmwareConfig),
      
      // Core Managers
      'src/WifiManager.h': generateWifiManagerH(),
      'src/WifiManager.cpp': generateWifiManagerCpp(),
      'src/MareEngine.h': generateMareEngineH(),
      'src/MareEngine.cpp': generateMareEngineCpp(keyframes), // Baked-in calculation mode data
      'src/RestServer.h': generateRestServerH(),
      'src/RestServer.cpp': generateRestServerCpp(),
      'src/DisplayManager.h': generateDisplayManagerH(),
      'src/DisplayManager.cpp': generateDisplayManagerCpp(displayWidgets, displayConfig),
      'src/SerialManager.h': generateSerialManagerH(),
      'src/SerialManager.cpp': generateSerialManagerCpp(),

      // NEW: Modular LED Structure
      'src/modules/led_ws2812b/ws2812b_config.h': generateWs2812bConfigH(),
      'src/modules/led_ws2812b/ws2812b_config.cpp': generateWs2812bConfigCpp(firmwareConfig),
      'src/modules/led_ws2812b/ws2812b_controller.h': generateWs2812bControllerH(),
      'src/modules/led_ws2812b/ws2812b_controller.cpp': generateWs2812bControllerCpp(),
      'src/modules/led_ws2812b/ws2812b_animations.h': generateWs2812bAnimationsH(),
      'src/modules/led_ws2812b/ws2812b_animations.cpp': generateWs2812bAnimationsCpp(),
  };

  if (firmwareConfig.enableBLE) {
      files['src/BleManager.h'] = generateBleManagerH();
      files['src/BleManager.cpp'] = generateBleManagerCpp();
  }
  
  if (firmwareConfig.weatherApi?.enabled) {
      files['src/WeatherManager.h'] = generateWeatherManagerH();
      // Inject Data Source Config for Tabua Mare usage in C++
      files['src/WeatherManager.cpp'] = generateWeatherManagerCpp(firmwareConfig, dataSourceConfig);
  }

  const handleDownloadZip = async () => {
      const zip = new JSZip();
      
      Object.entries(files).forEach(([path, content]) => {
         // Create folders automatically based on path
         zip.file(path, content);
      });

      const blob = await zip.generateAsync({type: "blob"});
      const element = document.createElement("a");
      element.href = URL.createObjectURL(blob);
      element.download = "TideFlux_Firmware_Modular.zip";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 bg-slate-800 rounded-lg border border-slate-700 p-6 h-fit overflow-y-auto max-h-full">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
                <Cpu className="text-cyan-400" /> Configuração do Firmware
            </h2>
            
            <div className="space-y-4">
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
                
                {/* Autonomous Logic Section */}
                <div className="pt-4 border-t border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                           <BrainCircuit size={14} className="text-pink-400" /> Lógica Autônoma (Chip)
                        </h3>
                        <input 
                            type="checkbox" 
                            checked={firmwareConfig.autonomous.enabled} 
                            onChange={e => updateFirmwareConfig({ autonomous: {...firmwareConfig.autonomous, enabled: e.target.checked} })} 
                        />
                     </div>
                     
                     {firmwareConfig.autonomous.enabled && (
                         <div className="bg-slate-900 p-3 rounded space-y-3">
                             <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2">
                                     <Activity size={12} className="text-cyan-400"/>
                                     <label className="text-[10px] text-slate-400">Maré Alta = Mais Rápido</label>
                                 </div>
                                 <input type="checkbox" checked={firmwareConfig.autonomous.linkSpeedToTide} onChange={e => updateFirmwareConfig({ autonomous: {...firmwareConfig.autonomous, linkSpeedToTide: e.target.checked} })} />
                             </div>
                             <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2">
                                     <Zap size={12} className="text-yellow-400"/>
                                     <label className="text-[10px] text-slate-400">Maré Baixa = Menor Brilho</label>
                                 </div>
                                 <input type="checkbox" checked={firmwareConfig.autonomous.linkBrightnessToTide} onChange={e => updateFirmwareConfig({ autonomous: {...firmwareConfig.autonomous, linkBrightnessToTide: e.target.checked} })} />
                             </div>
                             <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2">
                                     <Sun size={12} className="text-orange-400"/>
                                     <label className="text-[10px] text-slate-400">Paleta Dia/Noite (Horário)</label>
                                 </div>
                                 <input type="checkbox" checked={firmwareConfig.autonomous.linkPaletteToTime} onChange={e => updateFirmwareConfig({ autonomous: {...firmwareConfig.autonomous, linkPaletteToTime: e.target.checked} })} />
                             </div>
                         </div>
                     )}
                </div>

                {/* Night Mode Config */}
                <div className="pt-4 border-t border-slate-700">
                     <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                           <Moon size={14} className="text-indigo-400" /> Modo Noturno
                        </h3>
                        <input type="checkbox" checked={firmwareConfig.nightMode.enabled} onChange={e => updateFirmwareConfig({ nightMode: {...firmwareConfig.nightMode, enabled: e.target.checked} })} />
                     </div>
                     
                     {firmwareConfig.nightMode.enabled && (
                         <div className="grid grid-cols-2 gap-2 bg-slate-900 p-3 rounded">
                             <div>
                                <label className="text-[10px] text-slate-500">Início (Hora)</label>
                                <input type="number" step="0.5" value={firmwareConfig.nightMode.startHour} onChange={e => updateFirmwareConfig({ nightMode: {...firmwareConfig.nightMode, startHour: parseFloat(e.target.value)} })} className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white"/>
                             </div>
                             <div>
                                <label className="text-[10px] text-slate-500">Fim (Hora)</label>
                                <input type="number" step="0.5" value={firmwareConfig.nightMode.endHour} onChange={e => updateFirmwareConfig({ nightMode: {...firmwareConfig.nightMode, endHour: parseFloat(e.target.value)} })} className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-xs text-white"/>
                             </div>
                             <div className="col-span-2">
                                <label className="text-[10px] text-slate-500">Brilho ({Math.round(firmwareConfig.nightMode.brightnessFactor * 100)}%)</label>
                                <input type="range" min="0" max="1" step="0.1" value={firmwareConfig.nightMode.brightnessFactor} onChange={e => updateFirmwareConfig({ nightMode: {...firmwareConfig.nightMode, brightnessFactor: parseFloat(e.target.value)} })} className="w-full"/>
                             </div>
                         </div>
                     )}
                </div>

                {/* Summary of Data Source Injection */}
                <div className="pt-4 border-t border-slate-700">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                        <Database size={16} className="text-purple-400" /> Dados Embutidos
                    </h3>
                    <div className="bg-slate-900/50 p-3 rounded border border-slate-700 text-xs text-slate-400 space-y-2">
                         <div className="flex items-center gap-2">
                             <Check size={12} className="text-green-500"/> 
                             <span>Maré Offline: {keyframes.length} pontos (Calculado/Backup)</span>
                         </div>
                         <div className="flex items-center gap-2">
                             <Check size={12} className="text-green-500"/>
                             <span>Config. Tábua Maré: {dataSourceConfig.tabuaMare.harborId ? `Porto ID ${dataSourceConfig.tabuaMare.harborId}` : `Lat ${dataSourceConfig.tabuaMare.lat}, Lng ${dataSourceConfig.tabuaMare.lng}`}</span>
                         </div>
                         {firmwareConfig.weatherApi.enabled && (
                             <div className="flex items-center gap-2">
                                 <Check size={12} className="text-green-500"/>
                                 <span>WeatherAPI Habilitada (Online)</span>
                             </div>
                         )}
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-700">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                        <Wifi size={16} /> Credenciais WiFi
                    </h3>
                    <div className="space-y-3">
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
                    </div>
                </div>

                <button 
                    onClick={handleDownloadZip}
                    className="w-full mt-6 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition shadow-lg shadow-cyan-900/50"
                >
                    <Package size={20} /> Baixar Firmware Modular
                </button>
            </div>
        </div>

        {/* Code Preview */}
        <div className="lg:col-span-2 bg-slate-900 rounded-lg border border-slate-700 flex flex-col overflow-hidden">
            <div className="flex border-b border-slate-700 bg-slate-800 overflow-x-auto custom-scrollbar">
                {Object.keys(files).filter(f => !f.includes("modules/")).map(fileName => (
                     <button 
                        key={fileName}
                        onClick={() => setActiveTab(fileName)}
                        className={`px-4 py-3 text-sm font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === fileName ? 'text-cyan-400 bg-slate-900 border-t-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <FileCode size={14} /> {fileName.replace('src/', '')}
                    </button>
                ))}
            </div>
            {/* Sub-bar for modules */}
            <div className="flex border-b border-slate-700 bg-slate-950/50 overflow-x-auto custom-scrollbar">
                <div className="px-3 py-2 text-xs text-slate-500 flex items-center gap-1">
                    <FolderTree size={12}/> modules/led_ws2812b/
                </div>
                {Object.keys(files).filter(f => f.includes("modules/")).map(fileName => (
                     <button 
                        key={fileName}
                        onClick={() => setActiveTab(fileName)}
                        className={`px-3 py-2 text-xs font-medium flex items-center gap-2 whitespace-nowrap ${activeTab === fileName ? 'text-amber-400 bg-slate-900' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        {fileName.split('/').pop()}
                    </button>
                ))}
            </div>
            
            <div className="flex-1 overflow-auto p-4 bg-[#0d1117]">
                <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">
                    <code>{files[activeTab]}</code>
                </pre>
            </div>
        </div>
    </div>
  );
};