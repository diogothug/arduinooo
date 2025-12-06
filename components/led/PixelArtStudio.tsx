
import React, { useState } from 'react';
import { Grid, Upload, Send, RefreshCw } from 'lucide-react';

export const PixelArtStudio: React.FC = () => {
    const [gridWidth, setGridWidth] = useState(16);
    const [gridHeight, setGridHeight] = useState(16);
    const [isSending, setIsSending] = useState(false);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Placeholder for the complex logic in previous LedMaster
        // Kept simple for file size, can be expanded if needed
        alert("Upload functionality to be reimplemented in modular file.");
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2"><Grid size={14}/> Pixel Studio</h3>
            <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-pink-500 hover:bg-slate-900 transition">
                <div className="text-center"><Upload size={20} className="mx-auto text-slate-400 mb-1"/><span className="text-xs text-slate-400">Importar GIF/IMG</span></div>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </label>
            
            <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[9px] text-slate-500 block">W</label><input type="number" value={gridWidth} onChange={e=>setGridWidth(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white text-xs"/></div>
                <div><label className="text-[9px] text-slate-500 block">H</label><input type="number" value={gridHeight} onChange={e=>setGridHeight(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-white text-xs"/></div>
            </div>

            <button disabled={isSending} className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold py-2 rounded text-xs flex items-center justify-center gap-2">
                {isSending ? <RefreshCw className="animate-spin" size={14}/> : <Send size={14}/>} Enviar
            </button>
        </div>
    );
};
