


import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { DisplayTheme, WidgetType, ViewState, DisplayType } from '../../types';
import { oledPixelEngine } from '../../services/oledPixelEngine';
import { Zap, Palette, CloudSun, Sparkles, Image as ImageIcon, Wifi, Bluetooth, Settings, Sun, Moon, Droplets, Thermometer, Wind, Waves, Gauge, Clock, Layout, Download, FileCode, Monitor, CloudRain } from 'lucide-react';

export const DisplaySidebar: React.FC = () => {
  const { 
      weatherData, displayConfig, setDisplayConfig, setDisplayWidgets, addDisplayWidget,
      dataSourceConfig, setView, displayWidgets
  } = useAppStore();

  const handleExportHeader = () => {
      // 1. Render current state to a temp canvas
      const targetW = displayConfig.width;
      const targetH = displayConfig.height;
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Render scene at 1x scale for export
      oledPixelEngine.renderScene(ctx, targetW, targetH, displayWidgets, {
          tide: 50, weather: weatherData, time: 12, keyframes: []
      });
      
      // Dither
      const buffer = oledPixelEngine.ditherImage(ctx, targetW, targetH);
      
      // Generate C
      const code = oledPixelEngine.generateCHeader(buffer, targetW, targetH, "oled_layout_preset");
      navigator.clipboard.writeText(code);
      alert("C Header copied to clipboard!");
  };

  const applyPreset = (name: string) => {
    // Clear existing
    let newWidgets = [];
    
    switch (name) {
      case 'Minimalist OLED':
        setDisplayConfig({ ...displayConfig, theme: DisplayTheme.MINIMAL_OLED, width: 128, height: 64, type: DisplayType.SSD1306_128x64 });
        newWidgets = [
          { id: 'm1', type: WidgetType.TEXT_VALUE, x: 64, y: 32, scale: 1, color: '#ffffff', visible: true, zIndex: 1, valueSource: 'TIDE', label: 'TIDE', fontSize: 32 },
          { id: 'm2', type: WidgetType.ICON_WEATHER, x: 110, y: 15, scale: 0.8, color: '#ffffff', visible: true, zIndex: 1 },
          { id: 'm3', type: WidgetType.TEXT_VALUE, x: 110, y: 32, scale: 1, color: '#ffffff', visible: true, zIndex: 1, valueSource: 'TEMP', fontSize: 10, label: '' },
        ];
        break;
        
      case 'Sophisticated':
        setDisplayConfig({ ...displayConfig, theme: DisplayTheme.MINIMAL_OLED, width: 128, height: 64 });
        newWidgets = [
          { id: 's1', type: WidgetType.SPARKLINE, x: 64, y: 40, scale: 1, color: '#ffffff', visible: true, zIndex: 0, w: 128, h: 48 },
          { id: 's2', type: WidgetType.DIGITAL_CLOCK, x: 64, y: 12, scale: 1, color: '#000000', visible: true, zIndex: 2, fontSize: 16, fontFamily: 'monospace', color2: '#ffffff' }, // Inverse effect
          { id: 's3', type: WidgetType.TEXT_VALUE, x: 20, y: 55, scale: 1, color: '#ffffff', visible: true, zIndex: 2, valueSource: 'TIDE', label: 'M', fontSize: 12 },
        ];
        break;
        
      case 'Compact 128x32':
         setDisplayConfig({ ...displayConfig, theme: DisplayTheme.MINIMAL_OLED, width: 128, height: 32, type: DisplayType.SSD1306_128x32 });
         newWidgets = [
             { id: 'c1', type: WidgetType.TEXT_VALUE, x: 30, y: 16, scale: 1, color: '#fff', visible: true, zIndex: 1, valueSource: 'TIDE', fontSize: 24, label: '' },
             { id: 'c2', type: WidgetType.TEXT_SIMPLE, x: 80, y: 10, scale: 1, color: '#fff', visible: true, zIndex: 1, fontSize: 10, label: 'MORERE' },
             { id: 'c3', type: WidgetType.TEXT_VALUE, x: 80, y: 22, scale: 1, color: '#fff', visible: true, zIndex: 1, valueSource: 'TEMP', fontSize: 12, label: '' }
         ];
         break;
    }
    setDisplayWidgets(newWidgets);
  };

  return (
    <div className="flex flex-col gap-6 max-h-full overflow-y-auto pr-2 pb-20 custom-scrollbar">
        
        {/* Model Selector */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-3">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Monitor size={12}/> Display Model
            </h3>
            <select 
                value={displayConfig.type} 
                onChange={(e) => {
                    const t = e.target.value as DisplayType;
                    const dims = t.includes('128x32') ? {w:128,h:32} : t.includes('240') ? {w:240,h:240} : {w:128,h:64};
                    setDisplayConfig({ type: t, width: dims.w, height: dims.h });
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-xs text-white"
            >
                <option value={DisplayType.SSD1306_128x64}>OLED SSD1306 (128x64)</option>
                <option value={DisplayType.SH1106_128x64}>OLED SH1106 (128x64)</option>
                <option value={DisplayType.SSD1306_128x32}>OLED Slim (128x32)</option>
                <option value={DisplayType.GC9A01_240}>LCD Round (240x240)</option>
            </select>
            
            <div className="flex gap-2 mt-2">
                <button onClick={()=>setDisplayConfig({ditherEnabled: !displayConfig.ditherEnabled})} className={`flex-1 text-[10px] py-1 rounded border ${displayConfig.ditherEnabled ? 'bg-green-900/30 border-green-600 text-green-400' : 'bg-slate-700 border-transparent'}`}>
                    Dithering: {displayConfig.ditherEnabled ? 'ON' : 'OFF'}
                </button>
            </div>
        </div>

        {/* Quick Presets */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <Layout size={14} className="text-cyan-400" /> Layout Presets
            </h3>
            <div className="grid grid-cols-2 gap-2">
                <button onClick={() => applyPreset('Minimalist OLED')} className="p-3 bg-slate-700 hover:bg-slate-600 rounded flex flex-col items-center gap-2 transition group">
                    <div className="w-10 h-6 border-2 border-white rounded bg-black"></div>
                    <span className="text-[10px] text-white font-bold">Minimal Mono</span>
                </button>
                <button onClick={() => applyPreset('Sophisticated')} className="p-3 bg-slate-700 hover:bg-slate-600 rounded flex flex-col items-center gap-2 transition group">
                    <div className="w-10 h-6 border border-slate-400 rounded bg-slate-900 flex items-end"><div className="w-full h-2 bg-white/20"></div></div>
                    <span className="text-[10px] text-white font-bold">Sparkline Pro</span>
                </button>
                <button onClick={() => applyPreset('Compact 128x32')} className="p-3 bg-slate-700 hover:bg-slate-600 rounded flex flex-col items-center gap-2 transition group">
                    <div className="w-10 h-3 border border-slate-400 rounded bg-black"></div>
                    <span className="text-[10px] text-white font-bold">Slim 32px</span>
                </button>
            </div>
        </div>

        {/* Widgets Adder */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Gauge size={14} className="text-green-400" /> Widgets
            </h3>
            <div className="grid grid-cols-2 gap-2">
                {[
                    { type: WidgetType.TEXT_VALUE, label: 'Valor Grande', icon: <Layout size={16}/> },
                    { type: WidgetType.SPARKLINE, label: 'Gráfico Curva', icon: <Waves size={16}/> },
                    { type: WidgetType.RAIN_CHART, label: 'Gráfico Chuva', icon: <CloudRain size={16}/> },
                    { type: WidgetType.ICON_WEATHER, label: 'Ícone Clima', icon: <CloudSun size={16}/> },
                    { type: WidgetType.DIGITAL_CLOCK, label: 'Relógio', icon: <Clock size={16}/> },
                    { type: WidgetType.ICON_STATUS, label: 'Status Bar', icon: <Wifi size={16}/> },
                ].map(w => (
                    <button 
                        key={w.type}
                        onClick={() => addDisplayWidget({
                            id: Math.random().toString(), 
                            type: w.type, 
                            x: displayConfig.width/2, y: displayConfig.height/2, 
                            scale:1, color:'#fff', visible:true, zIndex:5,
                            valueSource: 'TIDE', fontSize: 12, w: 64, h: 32
                        })} 
                        className="p-2 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded text-[10px] text-white flex flex-col items-center gap-1 transition"
                    >
                        {w.icon}
                        {w.label}
                    </button>
                ))}
            </div>
        </div>

        {/* Export Actions */}
        <div className="mt-auto">
            <button 
                onClick={handleExportHeader}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/50 transition"
            >
                <FileCode size={16}/> Copiar C Header (PROGMEM)
            </button>
            <p className="text-[9px] text-slate-500 text-center mt-2">
                Gera array de bytes otimizado para a tela selecionada.
            </p>
        </div>
    </div>
  );
};