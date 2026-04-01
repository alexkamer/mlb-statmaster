import React from 'react';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip as RechartsTooltip, 
    ResponsiveContainer, 
    ReferenceLine,
    Cell
} from 'recharts';

interface PlayerTrendTabProps {
    propType: string;
    propLine: string | number;
    isPitching: boolean;
    logs: any[];
    getStatValueFromLog: (log: any, pType: string) => number | null;
}

export const PlayerTrendTab: React.FC<PlayerTrendTabProps> = ({ 
    propType, propLine, isPitching, logs, getStatValueFromLog 
}) => {
    const target = parseFloat(String(propLine).replace('+', ''));
    const isPlus = String(propLine).includes('+');

    const values = logs.map(log => {
        let val = getStatValueFromLog(log, propType);
        if (val === null) val = 0;
        return { ...log, val, isHit: isPlus ? val >= target : val > target };
    }).sort((a, b) => new Date(a.game_date).getTime() - new Date(b.game_date).getTime());

    const hits = values.filter(v => v.isHit).length;
    const total = values.length;
    const hitRate = total > 0 ? Math.round((hits / total) * 100) : 0;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50">
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">
                    Last {total} Games Trend
                </h2>
                <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Over ({hits})</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-slate-300 rounded-sm"></div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Under ({total - hits})</span>
                    </div>
                </div>
            </div>

            <div className="p-6">
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={values} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis 
                                dataKey="game_date" 
                                tickFormatter={(val) => {
                                    const d = new Date(val);
                                    return `${d.getMonth()+1}/${d.getDate()}`;
                                }}
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} 
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} 
                            />
                            <RechartsTooltip 
                                cursor={{ fill: '#f1f5f9' }}
                                content={({ active, payload }: any) => {
                                    if (active && payload && payload.length) {
                                        const d = payload[0].payload;
                                        return (
                                            <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg">
                                                <p className="font-bold text-[10px] uppercase tracking-widest text-slate-400 mb-1">
                                                    {new Date(d.game_date).toLocaleDateString()} vs {d.opponent_abbrev || 'OPP'}
                                                </p>
                                                <p className="text-lg font-black text-slate-800">
                                                    {d.val} <span className="text-sm font-medium text-slate-500">{propType}</span>
                                                </p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <ReferenceLine y={target} stroke="#64748b" strokeDasharray="4 4" strokeWidth={2} />
                            <Bar dataKey="val" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                {values.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.isHit ? '#10b981' : '#cbd5e1'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="mt-8 border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse tabular-nums">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-black border-b border-slate-200">
                                <th className="p-4">Date</th>
                                <th className="p-4">Opponent</th>
                                <th className="p-4 text-center text-primary">{propType}</th>
                                <th className="p-4 text-center">AB</th>
                                <th className="p-4 text-center">H</th>
                                <th className="p-4 text-center">R</th>
                                <th className="p-4 text-center">BB</th>
                                <th className="p-4 text-center">K</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {[...values].reverse().map((v, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-bold text-slate-700">{new Date(v.game_date).toLocaleDateString(undefined, {month: 'numeric', day: 'numeric'})}</td>
                                    <td className="p-4 font-bold text-slate-500">{v.opponent_abbrev || 'OPP'}</td>
                                    <td className={`p-4 text-center font-black ${v.isHit ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                                        {v.val}
                                    </td>
                                    <td className="p-4 text-center text-slate-600">{v.ab || v.ip || '-'}</td>
                                    <td className="p-4 text-center text-slate-600">{v.h || '-'}</td>
                                    <td className="p-4 text-center text-slate-600">{v.r || '-'}</td>
                                    <td className="p-4 text-center text-slate-600">{v.bb || '-'}</td>
                                    <td className="p-4 text-center text-slate-600">{v.k || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};