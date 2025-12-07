
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { Activity, Maximize2 } from 'lucide-react';
import { useAppStore } from '../../store';
import { generateSevenDayForecast } from '../../utils/tideLogic';

interface TideChartProps {
  useSevenDayMode: boolean;
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
}

export const TideChart: React.FC<TideChartProps> = ({ useSevenDayMode, isExpanded, setIsExpanded }) => {
  const { keyframes, simulatedTime } = useAppStore();
  
  const cycleLimit = useSevenDayMode ? 168 : 24;

  const chartData = useMemo(() => {
      let data = useSevenDayMode ? generateSevenDayForecast(keyframes) : keyframes;
      // Filter based on view mode
      data = data.filter(k => k.timeOffset <= cycleLimit);
      return data;
  }, [keyframes, useSevenDayMode, cycleLimit]);

  return (
    <div className={`shrink-0 ${isExpanded ? 'fixed inset-4 z-50 bg-slate-900 border-slate-600' : 'h-72 bg-slate-800'} rounded-lg border border-slate-700 p-1 relative flex flex-col shadow-inner transition-all duration-300`}>
        <div className="absolute top-2 left-4 z-10 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700 backdrop-blur-sm flex gap-2">
            <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <Activity size={10} className="text-cyan-400"/>
                {useSevenDayMode ? 'Previsão Semanal' : 'Ciclo Diário'}
            </h4>
        </div>
        <div className="absolute top-2 right-4 z-10 flex gap-2">
             <div className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700 backdrop-blur-sm text-[10px] font-mono text-cyan-400">
                T+{simulatedTime.toFixed(1)}h
            </div>
            <button onClick={()=>setIsExpanded(!isExpanded)} className="bg-slate-900/80 p-1 rounded border border-slate-700 hover:text-white text-slate-400 transition">
                <Maximize2 size={12}/>
            </button>
        </div>

        <div className="flex-1 w-full mt-6">
            <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{top: 10, right: 10, left: -25, bottom: 0}}>
                <defs>
                <linearGradient id="colorHeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis 
                    dataKey="timeOffset" 
                    type="number" 
                    domain={[0, cycleLimit]} 
                    allowDataOverflow={true} 
                    stroke="#64748b" 
                    fontSize={9}
                    tickFormatter={(val) => `${val}h`}
                    ticks={useSevenDayMode ? [0, 24, 48, 72, 96, 120, 144, 168] : [0, 6, 12, 18, 24]}
                />
                <YAxis domain={[0, 100]} stroke="#64748b" fontSize={9} unit="%" />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px', fontSize: '11px' }}
                    itemStyle={{ color: '#38bdf8' }}
                    labelFormatter={(label) => `Hora: ${parseFloat(label).toFixed(1)}h`}
                />
                <Area 
                    type="monotone" 
                    dataKey="height" 
                    stroke="#0ea5e9" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorHeight)" 
                    isAnimationActive={false} 
                />
                <ReferenceDot x={simulatedTime} y={chartData.length > 0 ? (chartData.find(k=>Math.abs(k.timeOffset - simulatedTime) < 1)?.height || 50) : 50} r={4} fill="#f59e0b" stroke="#fff" strokeWidth={1} />
            </AreaChart>
            </ResponsiveContainer>
        </div>
    </div>
  );
};
