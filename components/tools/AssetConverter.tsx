
import React, { useState, useRef, useEffect } from 'react';
import { Upload, Copy, Library, Monitor, Image as ImageIcon, FileCode } from 'lucide-react';
import { useAppStore } from '../../store';
import { ViewState, WidgetType } from '../../types';
import { ICON_LIBRARY } from '../../data/iconLibrary';

export const AssetConverter: React.FC = () => {
    const { setNotification, addDisplayWidget, setView } = useAppStore();
    const [assetSource, setAssetSource] = useState<'UPLOAD' | 'LIBRARY'>('LIBRARY');
    const [assetFile, setAssetFile] = useState<File | null>(null);
    const [assetPreviewUrl, setAssetPreviewUrl] = useState<string | null>(null);
    const [assetFormat, setAssetFormat] = useState<'XBM' | 'RGB565'>('XBM');
    const [assetSize, setAssetSize] = useState<number>(32);
    const [assetThreshold, setAssetThreshold] = useState<number>(128);
    const [conversionResult, setConversionResult] = useState<string>('');
    const [assetName, setAssetName] = useState('icon_custom');
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAssetFile(file);
            const url = URL.createObjectURL(file);
            setAssetPreviewUrl(url);
            setAssetName(file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_').toLowerCase());
            setConversionResult(''); 
            setTimeout(() => processImageSource(url), 100);
        }
    };

    const handlePresetSelect = (preset: typeof ICON_LIBRARY[0]) => {
        setAssetSource('LIBRARY');
        setAssetName(preset.id);
        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${preset.path}</svg>`;
        const blob = new Blob([svgString], {type: 'image/svg+xml'});
        const url = URL.createObjectURL(blob);
        setAssetPreviewUrl(url);
        setTimeout(() => processImageSource(url), 100);
    };

    const processImageSource = (url: string) => {
        if (!canvasRef.current) return;
        const img = new Image();
        img.onload = () => {
            const canvas = canvasRef.current!;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            canvas.width = assetSize;
            canvas.height = assetSize;
            ctx.fillStyle = '#FFFFFF'; 
            ctx.fillRect(0, 0, assetSize, assetSize);
            ctx.drawImage(img, 0, 0, assetSize, assetSize);
            generateCode(ctx);
        };
        img.src = url;
    };

    useEffect(() => {
        if (assetPreviewUrl) {
            processImageSource(assetPreviewUrl);
        }
    }, [assetSize, assetThreshold, assetFormat]);

    const generateCode = (ctx: CanvasRenderingContext2D) => {
        const imageData = ctx.getImageData(0, 0, assetSize, assetSize);
        const data = imageData.data;
        const varName = `icon_${assetName}_${assetSize}`;
        let output = '';

        if (assetFormat === 'XBM') {
            let bytes: string[] = [];
            for (let y = 0; y < assetSize; y++) {
                for (let x = 0; x < assetSize; x += 8) {
                    let byte = 0;
                    for (let b = 0; b < 8; b++) {
                        if (x + b < assetSize) {
                            const idx = (y * assetSize + (x + b)) * 4;
                            const avg = (data[idx] + data[idx+1] + data[idx+2]) / 3;
                            if (avg < assetThreshold) byte |= (1 << b);
                        }
                    }
                    bytes.push('0x' + byte.toString(16).padStart(2, '0'));
                }
            }
            output = `// XBM Icon: ${assetSize}x${assetSize} (${assetName})\n#define ${varName}_width ${assetSize}\n#define ${varName}_height ${assetSize}\nstatic unsigned char ${varName}_bits[] = {\n` + formatBytes(bytes) + `\n};`;
        } else {
            let hexes: string[] = [];
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i+1], b = data[i+2];
                const rgb = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
                hexes.push('0x' + rgb.toString(16).padStart(4, '0'));
            }
            output = `// RGB565 Icon: ${assetSize}x${assetSize} (${assetName})\nconst uint16_t ${varName}[${assetSize}*${assetSize}] = {\n` + formatBytes(hexes) + `\n};`;
        }
        setConversionResult(output);
    };

    const formatBytes = (arr: string[]) => {
        let res = '  ';
        arr.forEach((val, i) => {
            res += val + ', ';
            if ((i + 1) % 12 === 0) res += '\n  ';
        });
        return res;
    };

    const copyCode = () => {
        navigator.clipboard.writeText(conversionResult);
        setNotification('success', 'Código copiado!');
    };

    const handleAddToDisplay = () => {
        if (!canvasRef.current) return;
        const dataUrl = canvasRef.current.toDataURL('image/png');
        addDisplayWidget({
            id: Math.random().toString(36).substr(2, 9),
            type: WidgetType.AI_IMAGE,
            x: 120, y: 120, scale: 1, color: '#ffffff', visible: true, zIndex: 10,
            imageUrl: dataUrl, label: assetName, w: assetSize, h: assetSize
        });
        setNotification('success', `Ícone adicionado ao Display!`);
        setView(ViewState.DISPLAY);
    };

    return (
        <div className="h-full flex flex-col animate-in fade-in">
            <div className="mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <ImageIcon className="text-pink-400" /> Conversor de Assets (Ícones)
                </h2>
                <p className="text-sm text-slate-400">Converta ícones para C Arrays otimizados (XBM/RGB565).</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-0">
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 flex flex-col gap-4">
                    <div className="flex bg-slate-800 rounded p-1 border border-slate-700 mb-2">
                        <button onClick={()=>setAssetSource('LIBRARY')} className={`flex-1 text-xs font-bold py-1.5 rounded flex items-center justify-center gap-2 ${assetSource==='LIBRARY'?'bg-slate-600 text-white':'text-slate-400 hover:text-white'}`}>
                            <Library size={12}/> Biblioteca
                        </button>
                        <button onClick={()=>setAssetSource('UPLOAD')} className={`flex-1 text-xs font-bold py-1.5 rounded flex items-center justify-center gap-2 ${assetSource==='UPLOAD'?'bg-slate-600 text-white':'text-slate-400 hover:text-white'}`}>
                            <Upload size={12}/> Upload
                        </button>
                    </div>

                    {assetSource === 'LIBRARY' ? (
                        <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                            {ICON_LIBRARY.map(icon => (
                                <button key={icon.id} onClick={() => handlePresetSelect(icon)} className={`aspect-square bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded flex flex-col items-center justify-center p-2 group transition ${assetName === icon.id ? 'border-pink-500 ring-1 ring-pink-500' : ''}`} title={icon.name}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-white mb-1">
                                        <g dangerouslySetInnerHTML={{__html: icon.path}} />
                                    </svg>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-pink-500 hover:bg-slate-800 transition">
                            <div className="text-center"><Upload size={24} className="mx-auto text-slate-500 mb-2"/><span className="text-xs text-slate-400">PNG/SVG</span></div>
                            <input type="file" className="hidden" accept="image/*" onChange={handleAssetUpload} />
                        </label>
                    )}
                    
                    <div className="bg-slate-800 p-2 rounded border border-slate-700 flex gap-3 items-center">
                        <div className="w-12 h-12 bg-white rounded border border-slate-500 overflow-hidden flex items-center justify-center">
                            {assetPreviewUrl ? <img src={assetPreviewUrl} className="w-full h-full object-contain p-1" alt="Preview"/> : <div className="text-[9px] text-slate-400">Preview</div>}
                        </div>
                        <div className="flex-1">
                            <div className="text-[10px] text-slate-500 font-bold uppercase">Nome Variável</div>
                            <div className="text-xs font-mono text-white truncate">icon_{assetName}_{assetSize}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <select value={assetSize} onChange={e => setAssetSize(parseInt(e.target.value))} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-xs text-white">
                            <option value={16}>16x16</option><option value={24}>24x24</option><option value={32}>32x32</option><option value={48}>48x48</option><option value={64}>64x64</option>
                        </select>
                        {assetFormat === 'XBM' && <input type="range" min="0" max="255" value={assetThreshold} onChange={e => setAssetThreshold(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded appearance-none accent-pink-500 mt-2"/>}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setAssetFormat('XBM')} className={`p-2 rounded text-xs font-bold border ${assetFormat === 'XBM' ? 'bg-pink-600 border-pink-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>XBM (Mono)</button>
                        <button onClick={() => setAssetFormat('RGB565')} className={`p-2 rounded text-xs font-bold border ${assetFormat === 'RGB565' ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>RGB565 (Color)</button>
                    </div>
                    <canvas ref={canvasRef} className="hidden" />
                </div>

                <div className="col-span-1 lg:col-span-2 bg-[#0d1117] rounded-lg border border-slate-700 p-0 flex flex-col overflow-hidden relative">
                    <div className="bg-slate-800 p-2 border-b border-slate-700 flex justify-between items-center">
                        <span className="text-xs font-mono text-slate-400 flex items-center gap-2"><FileCode size={12}/> icon_{assetName}_{assetSize}.h</span>
                        <div className="flex gap-2">
                            <button onClick={handleAddToDisplay} className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-2 py-1 rounded flex items-center gap-1 transition border border-purple-500"><Monitor size={12} /> Add to Display</button>
                            <button onClick={copyCode} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded flex items-center gap-1 transition border border-slate-600"><Copy size={12} /> Copiar</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                        {conversionResult ? <pre className="text-[10px] font-mono text-green-400 leading-relaxed whitespace-pre-wrap">{conversionResult}</pre> : <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50"><ImageIcon size={32} className="mb-2"/><p className="text-xs">Selecione um ícone...</p></div>}
                    </div>
                </div>
            </div>
        </div>
    );
};
