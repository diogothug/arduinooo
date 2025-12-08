
import React from 'react';
import { ComposedChart, Bar, Cell, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { Waves, Maximize2 } from 'lucide-react';
import { useAppStore } from '../../store';

interface WaveChartProps {
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
}

// Helper: Color scale for Wave Period
const getPeriodColor = (period: number) => {
  if (period < 6) return '#3b82f6'; // Blue (Short/Windswell) - < 6s
  if (period < 8) return '#10b981'; // Emerald (Weak Swell) - 6-8s
  if (period < 10) return '#facc15'; // Yellow (Medium Swell) - 8-10s
  if (period < 12) return '#f97316'; // Orange (Strong Swell) - 10-12s
  return '#ef4444'; // Red (Groundswell) - > 12s
};

// Helper: Custom SVG Arrow Shape for Direction
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DirectionArrow = (props: any) => {
    const { cx, cy, payload } = props;
    // If height is very low, push arrow up a bit so it doesn't clip
    const yOffset = payload.height < 0.5 ? -10 : -5;
    
    return (
        <g transform={`translate(${cx},${cy + yOffset}) rotate(${payload.direction || 0})`}>
            {/* Arrow pointing UP (0 deg) */}
            <path d="M0,-6 L4,3 L0,1 L-4,3 Z" fill="#94a3b8" stroke="none" />
        </g>
    );
};

export const WaveChart: React.FC<WaveChartProps> = ({ isExpanded, setIsExpanded }) => {
  const { weatherData, simulatedTime } = useAppStore();
  const waves = weatherData.hourlyWaves || [];

  return (
    <div className={`shrink-0 ${isExpanded ? 'fixed inset-4 z-50 bg-slate-900 border-slate-600' : 'h-72 bg-slate-800'} rounded-lg border border-slate-700 p-1 relative flex flex-col shadow-inner transition-all duration-300`}>
        {/* Header */}
        <div className="absolute top-2 left-4 z-10 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700 backdrop-blur-sm flex gap-2">
            <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <Waves size={10} className="text-blue-400"/>
                Ondas (24h)
            </h4>
        </div>
        <div className="absolute top-2 right-4 z-10 flex gap-2">
             <div className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700 backdrop-blur-sm text-[10px] font-mono text-cyan-400">
                Agora: {weatherData.wave?.height || 0}m <span className="text-slate-500">|</span> {weatherData.wave?.period || 0}s
            </div>
            <button onClick={()=>setIsExpanded(!isExpanded)} className="bg-slate-900/80 p-1 rounded border border-slate-700 hover:text-white text-slate-400 transition">
                <Maximize2 size={12}/>
            </button>
        </div>

        {/* Chart Area */}
        <div className="flex-1 w-full mt-8 mb-2">
            <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={waves} margin={{top: 10, right: 10, left: -25, bottom: 0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis 
                    dataKey="time" 
                    type="number" 
                    domain={[0, 24]} 
                    allowDataOverflow={true} 
                    stroke="#64748b" 
                    fontSize={9}
                    tickFormatter={(val) => `+${val}h`}
                    ticks={[0, 6, 12, 18, 24]}
                />
                <YAxis 
                    yAxisId="left" 
                    domain={[0, (dataMax: number) => Math.max(2, Math.ceil(dataMax * 1.2))]} 
                    stroke="#64748b" 
                    fontSize={9} 
                    unit="m" 
                    label={{ value: 'Altura (m)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 9 }} 
                />
                
                <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px', fontSize: '11px' }}
                    labelFormatter={(label) => `Tempo: +${label}h`}
                    formatter={(value: number, name: string, props: any) => {
                        if (name === 'height') return [`${value.toFixed(2)}m`, 'Altura'];
                        if (name === 'dir') return [`${props.payload.direction}°`, 'Direção'];
                        // Don't show redundant period/direction lines in tooltip if possible, but ComposedChart shows all
                        return [value, name];
                    }}
                />
                
                {/* Bars colored by Period */}
                <Bar dataKey="height" yAxisId="left" name="Altura" radius={[2, 2, 0, 0]} maxBarSize={40}>
                    {waves.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getPeriodColor(entry.period)} />
                    ))}
                </Bar>

                {/* Direction Arrows on top of bars */}
                <Scatter 
                    dataKey="height" 
                    yAxisId="left" 
                    shape={<DirectionArrow />} 
                    legendType="none" 
                    tooltipType="none" 
                    isAnimationActive={false}
                />

                {/* Current Time Indicator */}
                <ReferenceDot yAxisId="left" x={simulatedTime % 24} y={0} r={4} fill="#f59e0b" stroke="none" />
            </ComposedChart>
            </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex justify-center flex-wrap gap-x-4 gap-y-2 pb-2 px-4 text-[9px] text-slate-400 border-t border-slate-700/50 pt-2">
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-blue-500"></div> &lt; 6s (Curto)</span>
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-emerald-500"></div> 6-8s</span>
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-yellow-400"></div> 8-10s</span>
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-orange-500"></div> 10-12s</span>
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm bg-red-500"></div> &gt; 12s (Swell)</span>
            <span className="flex items-center gap-1.5 ml-2 border-l border-slate-700 pl-2"><div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[6px] border-b-slate-400"></div> Direção</span>
        </div>
    </div>
  );
};
