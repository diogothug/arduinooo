


import { DisplayWidget, WidgetType, DisplayConfig, WeatherData, Keyframe } from '../types';

export const oledPixelEngine = {
    
    // Renders the scene to a high-res virtual canvas (4x scale for AA text)
    renderScene: (
        ctx: CanvasRenderingContext2D, 
        width: number, 
        height: number, 
        widgets: DisplayWidget[], 
        data: { tide: number, weather: WeatherData, time: number, keyframes: Keyframe[] }
    ) => {
        // Clear background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        // Sort by Z-Index
        const sortedWidgets = [...widgets].sort((a,b) => (a.zIndex||0) - (b.zIndex||0));

        sortedWidgets.forEach(w => {
            if (!w.visible) return;
            
            ctx.save();
            ctx.translate(w.x, w.y);
            ctx.rotate((w.rotation || 0) * Math.PI / 180);
            ctx.scale(w.scale, w.scale);

            // Resolve values
            let text = w.label || '';
            if (w.valueSource === 'TIDE') text = `${Math.round(data.tide)}%`;
            if (w.valueSource === 'TEMP') text = `${Math.round(data.weather.temp)}°`;
            if (w.valueSource === 'TIME') {
                const h = Math.floor(data.time % 24);
                const m = Math.floor((data.time % 1) * 60);
                text = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
            }

            // Set Color (White for OLED simulation typically)
            const color = w.color || '#ffffff';
            ctx.fillStyle = color;
            ctx.strokeStyle = color;

            switch(w.type) {
                case WidgetType.TEXT_VALUE:
                case WidgetType.DIGITAL_CLOCK:
                case WidgetType.TEXT_SIMPLE:
                    // Font Logic
                    const fontSize = w.fontSize || (w.type === WidgetType.TEXT_VALUE ? 28 : 14);
                    const weight = w.fontWeight || 'bold';
                    const family = w.fontFamily || 'sans-serif';
                    ctx.font = `${weight} ${fontSize}px ${family}`;
                    ctx.textAlign = w.textAlign || 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(text, 0, 0);
                    
                    if (w.type === WidgetType.TEXT_VALUE && w.label) {
                        ctx.font = `normal 10px ${family}`;
                        ctx.fillText(w.label.toUpperCase(), 0, fontSize/1.5);
                    }
                    break;

                case WidgetType.ARC_GAUGE:
                    const r = 40;
                    ctx.lineWidth = w.thickness || 4;
                    ctx.beginPath();
                    ctx.arc(0, 0, r, Math.PI*0.8, Math.PI*2.2);
                    ctx.strokeStyle = '#333333';
                    ctx.stroke();
                    
                    const pct = Math.max(0, Math.min(100, data.tide)) / 100;
                    ctx.beginPath();
                    ctx.arc(0, 0, r, Math.PI*0.8, Math.PI*0.8 + (Math.PI*1.4 * pct));
                    ctx.strokeStyle = color;
                    ctx.stroke();
                    
                    ctx.font = `bold 16px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.fillText(`${Math.round(data.tide)}`, 0, 0);
                    break;

                case WidgetType.SPARKLINE:
                    // Draw a curve based on keyframes
                    const W = w.w || 60;
                    const H = w.h || 30;
                    
                    ctx.fillStyle = '#111';
                    ctx.fillRect(-W/2, -H/2, W, H);
                    
                    ctx.beginPath();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2;
                    
                    // Simple sine simulation for preview if not enough keyframes
                    for(let i=0; i<=W; i+=2) {
                        const relX = i;
                        const phase = (data.time * 2 * Math.PI) / 24; 
                        const y = Math.sin((i / W * Math.PI * 2) + phase) * (H * 0.4);
                        if (i===0) ctx.moveTo(-W/2 + i, y);
                        else ctx.lineTo(-W/2 + i, y);
                    }
                    ctx.stroke();
                    
                    // Fill area?
                    ctx.lineTo(W/2, H/2);
                    ctx.lineTo(-W/2, H/2);
                    ctx.globalAlpha = 0.2;
                    ctx.fill();
                    ctx.globalAlpha = 1.0;
                    break;

                case WidgetType.RAIN_CHART:
                    const rW = w.w || 64;
                    const rH = w.h || 32;
                    const rainData = data.weather.hourlyRain || [0,0,0,0,0,0,0,0];
                    const bars = Math.min(rainData.length, 8); // Show max 8 bars
                    const barWidth = (rW / bars) - 2;
                    
                    ctx.textAlign = 'left';
                    // Container
                    // ctx.strokeStyle = '#333';
                    // ctx.strokeRect(-rW/2, -rH/2, rW, rH);
                    
                    for(let i=0; i<bars; i++) {
                        const prob = rainData[i] || 0;
                        const barH = (prob / 100) * rH;
                        const bx = (-rW/2) + (i * (barWidth + 2));
                        const by = (rH/2) - barH;
                        
                        ctx.fillStyle = color;
                        // Draw Bar
                        ctx.fillRect(bx, by, barWidth, barH);
                        
                        // Draw empty placeholder if 0
                        if (prob === 0) {
                            ctx.fillStyle = '#333';
                            ctx.fillRect(bx, (rH/2)-1, barWidth, 1);
                        }
                    }
                    // Label
                    if (w.label) {
                        ctx.font = '9px monospace';
                        ctx.fillStyle = color;
                        ctx.textAlign = 'right';
                        ctx.fillText(w.label, rW/2, -rH/2 - 2);
                    }
                    break;

                case WidgetType.ICON_WEATHER:
                    // Simple shapes for vector export
                    const isDay = data.weather.isDay;
                    ctx.lineWidth = 2;
                    if (isDay) {
                        ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.stroke();
                        for(let i=0; i<8; i++) {
                            ctx.save(); ctx.rotate(i*Math.PI/4); ctx.moveTo(14,0); ctx.lineTo(17,0); ctx.stroke(); ctx.restore();
                        }
                    } else {
                        ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.stroke();
                        ctx.fillStyle = '#000';
                        ctx.beginPath(); ctx.arc(6,-6,8,0,Math.PI*2); ctx.fill();
                    }
                    break;
                    
                case WidgetType.ICON_STATUS:
                    // Battery outline
                    ctx.strokeStyle = color;
                    ctx.strokeRect(-10, -5, 18, 10);
                    ctx.fillRect(8, -2, 2, 4);
                    // Fill
                    ctx.fillStyle = color;
                    const batt = data.weather.battery || 100;
                    ctx.fillRect(-8, -3, 14 * (batt/100), 6);
                    break;
            }
            ctx.restore();
        });
    },

    // Apply Floyd-Steinberg Dithering to convert to 1-bit
    ditherImage: (ctx: CanvasRenderingContext2D, width: number, height: number, threshold = 128): Uint8Array => {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const w = width;
        const h = height;
        
        // Convert to grayscale first
        const gray = new Float32Array(w * h);
        for(let i=0; i<w*h; i++) {
            gray[i] = (data[i*4]*0.299 + data[i*4+1]*0.587 + data[i*4+2]*0.114);
        }

        const mono = new Uint8Array(Math.ceil((w*h)/8)); // Packed bits

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = y * w + x;
                const oldPixel = gray[idx];
                const newPixel = oldPixel < threshold ? 0 : 255;
                const error = oldPixel - newPixel;
                
                gray[idx] = newPixel; // Update strictly for preview if needed, but we output packed bits

                // Distribute Error
                if (x + 1 < w) gray[idx + 1] += error * 7 / 16;
                if (y + 1 < h) {
                    if (x > 0) gray[idx + w - 1] += error * 3 / 16;
                    gray[idx + w] += error * 5 / 16;
                    if (x + 1 < w) gray[idx + w + 1] += error * 1 / 16;
                }

                // Set bit
                if (newPixel > 0) { // White pixel
                    const byteIdx = Math.floor(idx / 8);
                    const bitIdx = idx % 8;
                    mono[byteIdx] |= (1 << (7 - bitIdx)); // MSB first commonly
                }
            }
        }
        return mono;
    },

    // Convert dithered mono buffer to C Header
    generateCHeader: (buffer: Uint8Array, width: number, height: number, name: string) => {
        let output = `// TideFlux OLED Asset: ${name} (${width}x${height})\n`;
        output += `// Format: 1-bit Monochrome (MSB First)\n`;
        output += `const uint8_t ${name}_bits[] PROGMEM = {\n  `;
        
        for (let i = 0; i < buffer.length; i++) {
            output += '0x' + buffer[i].toString(16).padStart(2, '0') + (i < buffer.length - 1 ? ', ' : '');
            if ((i + 1) % 12 === 0) output += '\n  ';
        }
        output += '\n};\n';
        return output;
    }
};