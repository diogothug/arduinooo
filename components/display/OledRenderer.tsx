
import React from 'react';
import { WeatherData } from '../../types';
import { Sun, Cloud, CloudRain, Moon } from 'lucide-react';

interface OledRendererProps {
    ctx: CanvasRenderingContext2D;
    tidePercent: number;
    weatherData: WeatherData;
    time: number; // Simulated Time
}

// Helper to draw text centered
const drawText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, color: string) => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
};

export const renderOledModern = ({ ctx, tidePercent, weatherData, time }: OledRendererProps) => {
    // Canvas is 128x128
    const CX = 64;
    const CY = 64;
    const RADIUS = 60;
    
    // 1. Background (OLED Black)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 128, 128);

    // 2. Tide Ring (The main indicator)
    const startAngle = -Math.PI / 2; // Top
    const endAngle = startAngle + (Math.PI * 2 * (tidePercent / 100));
    
    // Track (Dim Blue)
    ctx.beginPath();
    ctx.arc(CX, CY, RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = '#1e3a8a'; // Dark Blue
    ctx.lineWidth = 4;
    ctx.stroke();

    // Active Level (Bright Blue -> Cyan Gradient Logic simplified)
    ctx.beginPath();
    ctx.arc(CX, CY, RADIUS, startAngle, endAngle);
    ctx.strokeStyle = '#38bdf8'; // Sky Blue
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 3. Clock (Center)
    const h = Math.floor(time % 24);
    const m = Math.floor((time % 1) * 60);
    const timeStr = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
    
    drawText(ctx, timeStr, CX, CY - 10, 'bold 24px monospace', '#ffffff');

    // 4. Weather (Bottom Center)
    const temp = Math.round(weatherData.temp);
    // Temp Color Scale (Blue -> Red)
    let tempColor = '#60a5fa';
    if (temp > 25) tempColor = '#fbbf24'; // Warm
    if (temp > 30) tempColor = '#ef4444'; // Hot

    drawText(ctx, `${temp}°C`, CX, CY + 15, 'bold 12px sans-serif', tempColor);
    
    // Weather Icon Placeholder (Simple shapes)
    ctx.fillStyle = weatherData.isDay ? '#fbbf24' : '#94a3b8';
    ctx.beginPath();
    ctx.arc(CX + 25, CY + 15, 4, 0, Math.PI * 2); // Little sun/moon dot
    ctx.fill();

    // 5. Mini Curve Chart (Tide Prediction)
    // Draw a small sine wave at the very bottom curve
    ctx.beginPath();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    const chartY = 100;
    const chartWidth = 60;
    const startX = CX - chartWidth/2;
    
    for(let i=0; i<=chartWidth; i+=2) {
        // Mock sine wave based on time
        const y = chartY + Math.sin((i + time * 10) * 0.1) * 5;
        if(i===0) ctx.moveTo(startX + i, y);
        else ctx.lineTo(startX + i, y);
    }
    ctx.stroke();

    // 6. Status Dots (Top Rim)
    // WiFi
    ctx.fillStyle = '#22c55e'; // Green
    ctx.beginPath(); ctx.arc(CX - 10, 15, 2, 0, Math.PI*2); ctx.fill();
    // Battery
    ctx.fillStyle = '#f59e0b'; // Amber
    ctx.beginPath(); ctx.arc(CX + 10, 15, 2, 0, Math.PI*2); ctx.fill();
};
