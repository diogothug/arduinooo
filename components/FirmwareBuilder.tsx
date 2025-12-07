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
    generateNVSManagerH, generateNVSManagerCpp
} from '../services/firmwareTemplates';
import { Download, Cpu, Code, Wifi, Package, FileCode, Bluetooth, Usb, Sun, Moon, CloudSun, FolderTree, Database, Check, BrainCircuit, Activity, Zap, Wind, Lock, Terminal, Radio } from 'lucide-react';
import JSZip from 'jszip';

export const FirmwareBuilder: React.FC = () => {
  const { firmwareConfig, updateFirmwareConfig, keyframes, displayConfig, displayWidgets, dataSourceConfig } = useAppStore();
  const [activeTab, setActiveTab] = useState<string>('main.cpp');

  // Build Virtual File System
  const files: Record<string, string> = {
      'platformio.ini': generatePlatformIO(firmwareConfig, displayConfig),
      'src/main.cpp': generateMainCpp(displayConfig),
      'src/config.h': generateConfigH(firmwareConfig, keyframes),
      'src/LogManager.h': generateLogManagerH(),
      'src/LogManager.cpp': generateLogManagerCpp(),
      'src/NVSManager.h': generateNVSManagerH(),
      'src/NVSManager.cpp': generateNVSManagerCpp(),
      'src/WifiManager.h': generateWifiManagerH(),
      'src/WifiManager.cpp': generateWifiManagerCpp(),
      'src/OTAManager.h': generateOTAManagerH(),
      'src/OTAManager.cpp': generateOTAManagerCpp(),
      'src/MareEngine.h': generateMareEngineH(),
      'src/MareEngine.cpp': generateMareEngineCpp(keyframes), 
      'src/RestServer.h': generateRestServerH(),
      'src/RestServer.cpp': generateRestServerCpp(),
      'src/DisplayManager.h': generateDisplayManagerH(),
      'src/DisplayManager.cpp': generateDisplayManagerCpp(displayWidgets, displayConfig),
      'src/SerialManager.h': generateSerialManagerH(),
      'src/SerialManager.cpp': generateSerialManagerCpp(),
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
      files['src/WeatherManager.cpp'] = generateWeatherManagerCpp(firmwareConfig, dataSourceConfig);
  }

  const handleDownloadZip = async () => {
      const zip = new JSZip();
      Object.entries(files).forEach(([path, content]) => {
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 bg-slate-800 rounded-lg border border-slate-700 p-6 h-auto shrink-0">
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

                {/* Device Options */}
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
                    </div>
                 </div>

                <div className="pt-4 border-t border-slate-700">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                        <Wifi size={16} /> Rede & OTA
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
                    
                    <div className="mt-3 bg-slate-900 p-3 rounded border border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                             <div className="flex items-center gap-2">
                                 <Radio size={14} className={firmwareConfig.ota?.enabled ? "text-amber-400" : "text-slate-500"} />
                                 <span className="text-xs font-bold text-slate-300">OTA Update</span>
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

                <button 
                    onClick={handleDownloadZip}
                    className="w-full mt-6 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition shadow-lg shadow-cyan-900/50"
                >
                    <Package size={20} /> Baixar Firmware Modular
                </button>
            </div>
        </div>

        {/* Code Preview */}
        <div className="lg:col-span-2 bg-slate-900 rounded-lg border border-slate-700 flex flex-col overflow-hidden min-h-[500px]">
            <div className="flex border-b border-slate-700 bg-slate-800 overflow-x-auto custom-scrollbar shrink-0">
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
            
            <div className="flex-1 overflow-auto p-4 bg-[#0d1117]">
                <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">
                    <code>{files[activeTab]}</code>
                </pre>
            </div>
        </div>
    </div>
  );
};