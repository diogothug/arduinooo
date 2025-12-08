
import React from 'react';
import { useAppStore } from '../../store';
import { WidgetType } from '../../types';
import { Settings, Layers, SendToBack, ArrowDown, ArrowUp, BringToFront, Trash2, Smartphone, Eye, ArrowLeft, Database } from 'lucide-react';

interface WidgetPanelProps {
    selectedWidgetId: string | null;
    setSelectedWidgetId: (id: string | null) => void;
}

export const WidgetPanel: React.FC<WidgetPanelProps> = ({ selectedWidgetId, setSelectedWidgetId }) => {
    const { displayWidgets, updateDisplayWidget, removeDisplayWidget } = useAppStore();
    const selectedWidget = displayWidgets.find(w => w.id === selectedWidgetId);

    const handleLayerChange = (id: string, action: 'up' | 'down' | 'front' | 'back') => {
        const widget = displayWidgets.find(w => w.id === id);
        if (!widget) return;
        const currentZ = widget.zIndex || 0;
        let newZ = currentZ;
        const maxZ = Math.max(...displayWidgets.map(w => w.zIndex || 0));
        const minZ = Math.min(...displayWidgets.map(w => w.zIndex || 0));
        switch(action) {
            case 'up': newZ = currentZ + 1; break;
            case 'down': newZ = currentZ - 1; break;
            case 'front': newZ = maxZ + 1; break;
            case 'back': newZ = minZ - 1; break;
        }
        updateDisplayWidget(id, { zIndex: newZ });
    };

    const LayerBtn = ({onClick, icon, title}: any) => (
        <button onClick={onClick} title={title} className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 border border-slate-700 transition">
            {icon}
        </button>
    );

    return (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 flex flex-col h-full overflow-y-auto">
            {selectedWidget ? (
                <>
                    <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-4">
                        <button 
                            onClick={() => setSelectedWidgetId(null)} 
                            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-cyan-400 transition"
                            title="Voltar para lista"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Settings size={20} className="text-amber-400" /> 
                            {selectedWidget.type.replace('_', ' ')}
                        </h3>
                    </div>

                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        
                        {/* DATA SOURCE SELECTOR */}
                        <div className="bg-blue-900/20 p-3 rounded border border-blue-900/50">
                            <label className="text-[10px] text-blue-300 uppercase font-bold mb-2 block flex items-center gap-1">
                                <Database size={12}/> Fonte de Dados
                            </label>
                            <select 
                                value={selectedWidget.valueSource || 'NONE'} 
                                onChange={e => updateDisplayWidget(selectedWidget.id, {valueSource: e.target.value as any})}
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-xs"
                            >
                                <option value="NONE">Estático / Nenhum</option>
                                <option value="TIDE">Nível da Maré (%)</option>
                                <option value="TIME">Horário Local</option>
                                <option value="TEMP">Temperatura</option>
                                <option value="HUM">Umidade</option>
                                <option value="WIND">Velocidade Vento</option>
                            </select>
                        </div>

                        {/* POSITION */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase font-bold">X</label>
                                <input type="number" value={selectedWidget.x} onChange={e => updateDisplayWidget(selectedWidget.id, {x: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-white text-sm mt-1 outline-none" />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase font-bold">Y</label>
                                <input type="number" value={selectedWidget.y} onChange={e => updateDisplayWidget(selectedWidget.id, {y: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-white text-sm mt-1 outline-none" />
                            </div>
                        </div>

                        {/* SPECIFIC DIMENSIONS FOR IMAGE WIDGETS */}
                        {selectedWidget.type === WidgetType.AI_IMAGE && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold">Largura (px)</label>
                                    <input type="number" value={selectedWidget.w || 32} onChange={e => updateDisplayWidget(selectedWidget.id, {w: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-white text-sm mt-1 outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold">Altura (px)</label>
                                    <input type="number" value={selectedWidget.h || 32} onChange={e => updateDisplayWidget(selectedWidget.id, {h: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-white text-sm mt-1 outline-none" />
                                </div>
                            </div>
                        )}

                        {/* SCALE & ROTATION */}
                        <div>
                             <div className="flex justify-between">
                                 <label className="text-[10px] text-slate-500 uppercase font-bold">Escala</label>
                                 <span className="text-[10px] text-slate-300 font-mono">{selectedWidget.scale.toFixed(1)}x</span>
                             </div>
                             <input type="range" min="0.5" max="3" step="0.1" value={selectedWidget.scale} onChange={e => updateDisplayWidget(selectedWidget.id, {scale: parseFloat(e.target.value)})} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer mt-1" />
                        </div>

                        {selectedWidget.type !== WidgetType.DIGITAL_CLOCK && (
                        <div>
                             <div className="flex justify-between">
                                 <label className="text-[10px] text-slate-500 uppercase font-bold">Rotação</label>
                                 <span className="text-[10px] text-slate-300 font-mono">{selectedWidget.rotation || 0}°</span>
                             </div>
                             <input type="range" min="0" max="360" value={selectedWidget.rotation || 0} onChange={e => updateDisplayWidget(selectedWidget.id, {rotation: parseInt(e.target.value)})} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer mt-1" />
                        </div>
                        )}

                        {/* COLORS */}
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase font-bold">Cor Primária</label>
                            <div className="flex gap-2 mt-1">
                                <input type="color" value={selectedWidget.color} onChange={e => updateDisplayWidget(selectedWidget.id, {color: e.target.value})} className="h-8 w-8 rounded cursor-pointer bg-transparent border-0" />
                                <input type="text" value={selectedWidget.color} onChange={e => updateDisplayWidget(selectedWidget.id, {color: e.target.value})} className="flex-1 bg-slate-900 border border-slate-600 rounded p-1.5 text-white text-sm font-mono uppercase" />
                            </div>
                        </div>

                        {/* SPECIFICS */}
                        {(selectedWidget.type === WidgetType.ARC_GAUGE || selectedWidget.type === WidgetType.RING_OUTER) && (
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase font-bold">Espessura Linha</label>
                                <input type="number" value={selectedWidget.thickness || 5} onChange={e => updateDisplayWidget(selectedWidget.id, {thickness: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-white text-sm mt-1" />
                            </div>
                        )}

                        {(selectedWidget.type === WidgetType.TEXT_VALUE || selectedWidget.type === WidgetType.TEXT_SIMPLE || selectedWidget.type === WidgetType.ARC_GAUGE) && (
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase font-bold">Texto Label</label>
                                <input type="text" value={selectedWidget.label || ''} onChange={e => updateDisplayWidget(selectedWidget.id, {label: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 text-white text-sm mt-1" placeholder="Auto" />
                            </div>
                        )}
                        
                        <div className="bg-slate-900 p-3 rounded border border-slate-700 mt-4">
                            <label className="text-[10px] text-slate-500 uppercase font-bold mb-2 block flex items-center gap-1"><Layers size={10}/> Camada (Z: {selectedWidget.zIndex || 0})</label>
                            <div className="flex gap-1 justify-between">
                                <LayerBtn onClick={() => handleLayerChange(selectedWidget.id, 'back')} icon={<SendToBack size={14}/>} title="Fundo" />
                                <LayerBtn onClick={() => handleLayerChange(selectedWidget.id, 'down')} icon={<ArrowDown size={14}/>} title="Descer" />
                                <LayerBtn onClick={() => handleLayerChange(selectedWidget.id, 'up')} icon={<ArrowUp size={14}/>} title="Subir" />
                                <LayerBtn onClick={() => handleLayerChange(selectedWidget.id, 'front')} icon={<BringToFront size={14}/>} title="Topo" />
                            </div>
                        </div>

                        <button onClick={() => { removeDisplayWidget(selectedWidget.id); setSelectedWidgetId(null); }} className="w-full mt-6 flex items-center justify-center gap-2 bg-red-900/20 text-red-400 border border-red-900/50 hover:bg-red-900/40 px-4 py-3 rounded-lg text-xs transition uppercase font-bold">
                            <Trash2 size={14} /> Excluir Widget
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Layers size={20} className="text-cyan-400" /> 
                            Camadas
                        </h3>
                    </div>
                    
                    <div className="flex-1 flex flex-col">
                        <div className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
                            {displayWidgets.length === 0 && (
                                <div className="text-center py-10 text-slate-600 flex flex-col items-center">
                                    <Smartphone size={32} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Nenhum widget.</p>
                                </div>
                            )}
                            {[...displayWidgets].sort((a,b) => (b.zIndex||0) - (a.zIndex||0)).map((w) => (
                                <div 
                                    key={w.id} 
                                    onClick={() => setSelectedWidgetId(w.id)} 
                                    className="p-3 bg-slate-900 rounded-lg border border-slate-700 hover:border-cyan-500 cursor-pointer flex justify-between items-center group transition shadow-sm"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-slate-500 text-[10px] font-mono w-6 text-center bg-slate-800 rounded py-0.5">Z{w.zIndex || 0}</span>
                                        <div className="flex flex-col">
                                            <span className="text-xs text-slate-200 font-bold uppercase">{w.type.replace('_', ' ')}</span>
                                            {w.valueSource !== 'NONE' && w.valueSource && <span className="text-[9px] text-blue-400 font-mono">Src: {w.valueSource}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                         {w.visible ? <Eye size={12} className="text-slate-500" /> : <Eye size={12} className="text-slate-700" />}
                                         <span className="w-3 h-3 rounded-full border border-white/20 shadow-sm" style={{backgroundColor: w.color}}></span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
