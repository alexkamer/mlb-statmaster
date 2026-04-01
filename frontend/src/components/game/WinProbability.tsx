import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts';

interface WinProbabilityProps {
    data: any;
    awayTeam: any;
    homeTeam: any;
    hoveredProb: any;
    setHoveredProb: (val: any) => void;
    TooltipStateSyncer: React.FC<any>;
}

export const WinProbability: React.FC<WinProbabilityProps> = ({ data, awayTeam, homeTeam, hoveredProb, setHoveredProb, TooltipStateSyncer }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-6">
            <h3 className="font-headline font-black text-2xl uppercase tracking-widest text-primary mb-6">Win Probability</h3>
            <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.winprobability} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="splitGradient" x1="0" y1="0" x2="0" y2="100%" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor={`#${awayTeam?.team?.color || "000000"}`} stopOpacity={0.8} />
                                <stop offset="50%" stopColor={`#${awayTeam?.team?.color || "000000"}`} stopOpacity={0} />
                                
                                <stop offset="50%" stopColor={`#${homeTeam?.team?.color || "000000"}`} stopOpacity={0} />
                                <stop offset="100%" stopColor={`#${homeTeam?.team?.color || "000000"}`} stopOpacity={0.8} />
                            </linearGradient>
                            <linearGradient id="splitStroke" x1="0" y1="0" x2="0" y2="100%" gradientUnits="userSpaceOnUse">
                                <stop offset="49.9%" stopColor={`#${awayTeam?.team?.color || "000000"}`} stopOpacity={1} />
                                <stop offset="50%" stopColor={`#${homeTeam?.team?.color || "000000"}`} stopOpacity={1} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="index" tick={false} hide={true} />
                        <XAxis 
                            xAxisId="innings" 
                            dataKey="inningLabel" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 'bold' }} 
                            interval={0}
                            tickMargin={0}
                            textAnchor="middle"
                        />
                        <YAxis 
                            orientation="right"
                            domain={[0, 100]} 
                            ticks={[0, 25, 50, 75, 100]} 
                            tickFormatter={(val) => {
                                if (val === 50) return "50%";
                                if (val === 100) return "100%"; 
                                if (val === 0) return "100%"; 
                                if (val === 25 || val === 75) return ""; 
                                return `${val}%`;
                            }}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 'bold' }}
                            type="number"
                        />
                        <Tooltip 
                            content={({ active, payload }: any) => {
                                return (
                                    <>
                                        <TooltipStateSyncer active={active} payload={payload} onHover={setHoveredProb} />
                                        {active && payload && payload.length ? (
                                            (() => {
                                                const d = payload[0].payload;
                                                const wp = d.awayWinPct;
                                                const displayWp = wp >= 50 ? wp : (100 - wp);
                                                const leaderStr = wp >= 50 ? awayTeam?.team?.abbreviation : homeTeam?.team?.abbreviation;
                                                const leaderColor = wp >= 50 ? awayTeam?.team?.color : homeTeam?.team?.color;
                                                return (
                                                    <div className="bg-white border border-slate-200 shadow-xl rounded-lg p-4 max-w-xs text-sm">
                                                        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                                                            <div className="font-black flex items-center gap-2" style={{ color: `#${leaderColor}` }}>
                                                                {leaderStr} <span className="text-xl">{displayWp.toFixed(1)}%</span>
                                                            </div>
                                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                                {d.inningLabel} Inn
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()
                                        ) : null}
                                    </>
                                );
                            }} 
                            cursor={{ stroke: '#cbd5e1', strokeWidth: 2, strokeDasharray: '4 4' }} 
                        />
                        <ReferenceLine y={50} stroke="#94a3b8" strokeDasharray="3 3" />
                        
                        <Area 
                            type="monotone" 
                            dataKey="awayWinPct" 
                            stroke="url(#splitStroke)" 
                            strokeWidth={3} 
                            fillOpacity={1} 
                            fill="url(#splitGradient)" 
                            isAnimationActive={false} 
                            baseValue={50}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            
            <div className="mt-8 flex justify-center gap-12">
                <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: `#${awayTeam?.team?.color}` }}></div>
                    <span className="font-bold text-slate-600 uppercase tracking-widest text-xs">{awayTeam?.team?.abbreviation} Win %</span>
                    <span className="font-black text-xl tabular-nums" style={{ color: `#${awayTeam?.team?.color}` }}>
                        {hoveredProb ? `${hoveredProb.awayWinPct.toFixed(1)}%` : `${data.winprobability?.[data.winprobability?.length - 1]?.awayWinPct?.toFixed(1) || 50}%`}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: `#${homeTeam?.team?.color}` }}></div>
                    <span className="font-bold text-slate-600 uppercase tracking-widest text-xs">{homeTeam?.team?.abbreviation} Win %</span>
                    <span className="font-black text-xl tabular-nums" style={{ color: `#${homeTeam?.team?.color}` }}>
                        {hoveredProb ? `${hoveredProb.homeWinPct.toFixed(1)}%` : `${data.winprobability?.[data.winprobability?.length - 1]?.homeWinPct?.toFixed(1) || 50}%`}
                    </span>
                </div>
            </div>
        </div>
    );
};