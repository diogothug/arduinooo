
import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../../store';
import { DisplayTheme, WidgetType } from '../../types';
import { oledPixelEngine } from '../../services/oledPixelEngine';

export const DisplayCanvas: React.FC<{ selectedWidgetId: string | null; setSelectedWidgetId: (id: string | null) => void }> = ({ selectedWidgetId, setSelectedWidgetId }) => {
    const { 
        displayConfig, displayWidgets, 
        simulatedTime, keyframes, weatherData
    } = useAppStore();
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pixelCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const pixelCanvas = pixelCanvasRef.current;
        if (!canvas || !pixelCanvas) return;
        
        const ctx = canvas.getContext('2d');
        const pCtx = pixelCanvas.getContext('2d');
        if (!ctx || !pCtx) return;

        // Configuration
        const targetW = displayConfig.width || 128;
        const targetH = displayConfig.height || 64;
        const scale = 2; // Preview scale on screen
        
        // 1. High Res Render (4x internal scale for crisp text)
        const internalScale = 4;
        canvas.width = targetW * internalScale;
        canvas.height = targetH * internalScale;
        
        // 2. Data Calculation
        let tide = 50;
        if (keyframes.length > 0) {
             // Simple interpolation logic
             const cycle = 24;
             const t = simulatedTime % cycle;
             const frame = keyframes[0]; // Simplified for brevity in this engine call
             tide = frame.height; // Use full logic in production
        }

        const render = () => {
            // A. Draw Vector Scene
            oledPixelEngine.renderScene(ctx, canvas.width, canvas.height, displayWidgets, {
                tide, 
                weather: weatherData, 
                time: simulatedTime, 
                keyframes
            });

            // B. Downsample & Dither to Pixel Grid
            pixelCanvas.width = targetW * scale;
            pixelCanvas.height = targetH * scale;
            
            // Draw scaled down version to temp canvas to average pixels
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = targetW;
            tempCanvas.height = targetH;
            const tCtx = tempCanvas.getContext('2d');
            if (tCtx) {
                tCtx.drawImage(canvas, 0, 0, targetW, targetH);
                
                // Dither?
                if (displayConfig.ditherEnabled) {
                    const dithered = oledPixelEngine.ditherImage(tCtx, targetW, targetH);
                    // Draw back dithered pixels to preview
                    // This visualizes the 1-bit buffer
                    pCtx.fillStyle = '#000';
                    pCtx.fillRect(0, 0, pixelCanvas.width, pixelCanvas.height);
                    pCtx.fillStyle = '#44ffaa'; // OLED Cyan simulation or white
                    if (displayConfig.theme === DisplayTheme.MINIMAL_OLED) pCtx.fillStyle = '#ffffff';
                    
                    // Iterate bits
                    for(let i=0; i<dithered.length; i++) {
                        for(let b=0; b<8; b++) {
                            if (dithered[i] & (1 << (7-b))) {
                                const globalIdx = i*8 + b;
                                const x = globalIdx % targetW;
                                const y = Math.floor(globalIdx / targetW);
                                pCtx.fillRect(x*scale, y*scale, scale*0.9, scale*0.9); // Gap for pixel grid effect
                            }
                        }
                    }
                } else {
                    // Direct Draw (Grayscale)
                    pCtx.imageSmoothingEnabled = false;
                    pCtx.drawImage(tempCanvas, 0, 0, pixelCanvas.width, pixelCanvas.height);
                    
                    // Grid Overlay
                    if (displayConfig.simulatePixelGrid) {
                        pCtx.fillStyle = 'rgba(0,0,0,0.2)';
                        for(let x=0; x<targetW; x++) pCtx.fillRect(x*scale + scale-1, 0, 1, pixelCanvas.height);
                        for(let y=0; y<targetH; y++) pCtx.fillRect(0, y*scale + scale-1, pixelCanvas.width, 1);
                    }
                }
            }
            
            requestAnimationFrame(render);
        };
        
        const raf = requestAnimationFrame(render);
        return () => cancelAnimationFrame(raf);

    }, [displayWidgets, simulatedTime, displayConfig, keyframes, weatherData]);

    return (
        <div className="flex flex-col items-center bg-slate-900 rounded-lg border border-slate-700 p-6 relative overflow-hidden">
             
             {/* Wrapper for the OLED physical look */}
             <div className="relative bg-slate-950 p-2 rounded-lg shadow-2xl border border-slate-800" style={{
                 width: (displayConfig.width * 2) + 20,
                 height: (displayConfig.height * 2) + 20
             }}>
                 <div className="w-full h-full bg-black relative overflow-hidden ring-1 ring-slate-800">
                     <canvas ref={pixelCanvasRef} className="w-full h-full rendering-pixelated" />
                 </div>
                 
                 {/* Gloss Reflection */}
                 {displayConfig.simulateSunlight && (
                     <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none rounded-lg"></div>
                 )}
             </div>
             
             {/* Hidden High-Res Source Canvas */}
             <canvas ref={canvasRef} className="hidden" />

             <div className="mt-4 text-[10px] text-slate-500 font-mono text-center flex flex-col gap-1">
                 <span>{displayConfig.type} • {displayConfig.width}x{displayConfig.height}</span>
                 <span className="text-slate-600">DRIVER: {displayConfig.driver}</span>
             </div>
        </div>
    );
};
