
import React, { useState } from 'react';
import { Grid, Upload, Send, RefreshCw, Info } from 'lucide-react';
import { useAppStore } from '../../store';

export const PixelArtStudio: React.FC = () => {
    const { setNotification } = useAppStore();
    const [gridWidth, setGridWidth] = useState(16);
    const [gridHeight, setGridHeight] = useState(16);
    const [isSending, setIsSending] = useState(false);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNotification('info', "Use a aba 'Assets Converter' (ESP32 Tools) para converter imagens para firmware.");
    };

    const handleSend = () => {
        setIsSending(true);
        setTimeout(() => {
            setIsSending(false);
            setNotification('success', "Matriz atualizada (Simulado)");
        }, 800);
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><Grid size={14}/> Pixel Studio</h3>
            
            <div className="bg-blue-900/20 p-3 rounded border border-blue-900/30 mb-4">
                 <div className="flex gap-2">
                     <Info size={14} className="text-blue-400 shrink-0 mt-0.5" />
                     <p className="text-[10px] text-blue-200">
                        Para converter ícones (XBM/RGB565) para o display OLED/TFT, utilize a nova ferramenta <strong>Assets Converter</strong> no menu ESP32 & Ferramentas.
                     </p>
                 </div>
            </div>

            <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-pink-500 hover:bg-slate-900 transition">
                <div className="text-center"><Upload size={20} className="mx-auto text-slate-400 mb-1"/><span className="text-xs text-slate-400">Importar GIF/IMG</span></div>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </label>
            
            <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] text-slate-500 block">W</label><input type="number" value={gridWidth} onChange={e=>setGridWidth(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white text-xs"/></div>
                <div><label className="text-[9px] text-slate-500 block">H</label><input type="number" value={gridHeight} onChange={e=>setGridHeight(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white text-xs"/></div>
            </div>

            <button onClick={handleSend} disabled={isSending} className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold py-2 rounded text-xs flex items-center justify-center gap-2">
                {isSending ? <RefreshCw className="animate-spin" size={14}/> : <Send size={14}/>} Enviar para Matriz
            </button>
        </div>
    );
};
