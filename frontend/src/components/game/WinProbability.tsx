import React, { useMemo } from 'react';
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

    const winProbData = useMemo(() => {
        if (!data?.winprobability || data.winprobability.length === 0) return null;
        
        const inningDividers: number[] = [];
        const getOrdinal = (n: number) => {
            const s = ["th", "st", "nd", "rd"], v = n % 100;
            return n + (s[(v - 20) % 10] || s[v] || s[0]);
        };

        let chartData = data.winprobability.map((wp: any, i: number, arr: any[]) => {
            const play = data.plays?.find((p: any) => p.id === wp.playId);
            
            if (play?.period?.number) {
                if (i > 0) {
                    const prevWp = arr[i - 1];
                    const prevPlay = data.plays?.find((p: any) => p.id === prevWp.playId);
                    if (prevPlay?.period?.number && prevPlay.period.number !== play.period.number) {
                        inningDividers.push(i);
                    }
                } else {
                    inningDividers.push(0); // Start of game
                }
            }

            return {
                index: i,
                homeWinPct: wp.homeWinPercentage * 100,
                awayWinPct: (1 - wp.homeWinPercentage) * 100,
                chartValue: (1 - wp.homeWinPercentage) * 100,
                playText: play?.text || "Unknown play",
                homeScore: play?.homeScore,
                awayScore: play?.awayScore,
                inning: play?.period?.displayValue,
                inningNumber: play?.period?.number,
                half: play?.period?.type,
                inningLabel: "",
            };
        });
        
        const boundaries = [...inningDividers, chartData.length - 1];
        for (let i = 0; i < boundaries.length - 1; i++) {
            const start = boundaries[i];
            const end = boundaries[i + 1];
            const mid = Math.floor((start + end) / 2);
            const inningNum = chartData[mid]?.inningNumber;
            if (inningNum) {
                chartData[mid].inningLabel = getOrdinal(inningNum);
            }
        }
        
        if (inningDividers[0] === 0) {
            inningDividers.shift();
        }
        
        return { chartData, inningDividers };
    }, [data]);

    const latestWp = data.winprobability?.[data.winprobability.length - 1];
    const defaultProb = latestWp ? {
        homeWinPct: latestWp.homeWinPercentage * 100,
        awayWinPct: (1 - latestWp.homeWinPercentage) * 100
    } : null;
    const currentProb = hoveredProb || defaultProb;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-6">
            <div className="flex items-center justify-between mb-8">
                <div className="flex flex-col gap-2">
                    <h3 className="font-headline font-black text-2xl uppercase tracking-widest text-primary leading-none">Win Probability</h3>
                    <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest mt-1">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: `#${awayTeam?.team?.color}` }}></div>
                            <span className="text-slate-500">{awayTeam?.team?.abbreviation}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: `#${homeTeam?.team?.color}` }}></div>
                            <span className="text-slate-500">{homeTeam?.team?.abbreviation}</span>
                        </div>
                    </div>
                </div>
                
                {currentProb && (
                    <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-2 border border-slate-200 shadow-sm">
                        {currentProb.homeWinPct >= 50 ? (
                            <>
                                <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${homeTeam?.team?.abbreviation?.toLowerCase()}.png`} className="w-8 h-8 object-contain" alt={homeTeam?.team?.abbreviation} />
                                <span className="font-black text-2xl text-slate-800 tracking-tighter" style={{ color: `#${homeTeam?.team?.color}` }}>{currentProb.homeWinPct.toFixed(1)}%</span>
                            </>
                        ) : (
                            <>
                                <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${awayTeam?.team?.abbreviation?.toLowerCase()}.png`} className="w-8 h-8 object-contain" alt={awayTeam?.team?.abbreviation} />
                                <span className="font-black text-2xl text-slate-800 tracking-tighter" style={{ color: `#${awayTeam?.team?.color}` }}>{currentProb.awayWinPct.toFixed(1)}%</span>
                            </>
                        )}
                    </div>
                )}
            </div>
            
            {!winProbData ? (
                <div className="p-12 text-center text-slate-500 font-bold">Win probability data is not available for this game.</div>
            ) : (
                <div className="h-[400px] w-full relative">
                    <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between items-center py-4 z-10 pointer-events-none">
                        <div className="flex flex-col items-center opacity-70">
                            <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${awayTeam?.team?.abbreviation?.toLowerCase()}.png`} className="w-6 h-6 object-contain mb-1" alt="Away" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{awayTeam?.team?.abbreviation}</span>
                        </div>
                        <div className="flex flex-col items-center opacity-70">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{homeTeam?.team?.abbreviation}</span>
                            <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${homeTeam?.team?.abbreviation?.toLowerCase()}.png`} className="w-6 h-6 object-contain" alt="Home" />
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height="100%" minHeight={400} minWidth={100}>
                        <AreaChart 
                            data={winProbData.chartData}
                            margin={{ top: 20, right: 10, left: 30, bottom: 25 }}
                        >
                            <defs>
                                {(() => {
                                    // Recharts uses gradientUnits="objectBoundingBox" by default for linearGradient.
                                    // This means the gradient is rendered relative to the exact bounding box of the SVG path being drawn, NOT the Y-axis.
                                    // Since the Stroke path and the Fill path have slightly different bounding boxes (because the Fill goes down to baseValue={50}),
                                    // we must calculate the exact split percentage dynamically for both.
                                    
                                    const yValues = winProbData.chartData.map((d: any) => d.chartValue);
                                    if (yValues.length === 0) return null;
                                    
                                    const dataMax = Math.max(...yValues);
                                    const dataMin = Math.min(...yValues);
                                    
                                    // Stroke bounding box is exactly dataMax to dataMin
                                    const strokePercent = dataMax === dataMin ? 50 : ((dataMax - 50) / (dataMax - dataMin)) * 100;
                                    const splitStrokePercent = Math.max(0, Math.min(100, strokePercent));
                                    
                                    // Fill bounding box spans from dataMax to 50 (if min > 50) OR 50 to dataMin (if max < 50)
                                    const fillTop = Math.max(dataMax, 50);
                                    const fillBottom = Math.min(dataMin, 50);
                                    const fillPercent = fillTop === fillBottom ? 50 : ((fillTop - 50) / (fillTop - fillBottom)) * 100;
                                    const splitFillPercent = Math.max(0, Math.min(100, fillPercent));
                                    
                                    return (
                                        <>
                                            <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="100%">
                                                <stop offset="0%" stopColor={`#${awayTeam?.team?.color || "000000"}`} stopOpacity={0.8} />
                                                <stop offset={`${splitFillPercent}%`} stopColor={`#${awayTeam?.team?.color || "000000"}`} stopOpacity={0} />
                                                
                                                <stop offset={`${splitFillPercent}%`} stopColor={`#${homeTeam?.team?.color || "000000"}`} stopOpacity={0} />
                                                <stop offset="100%" stopColor={`#${homeTeam?.team?.color || "000000"}`} stopOpacity={0.8} />
                                            </linearGradient>
                                            <linearGradient id="splitStroke" x1="0" y1="0" x2="0" y2="100%">
                                                <stop offset={`${splitStrokePercent - 0.01}%`} stopColor={`#${awayTeam?.team?.color || "000000"}`} stopOpacity={1} />
                                                <stop offset={`${splitStrokePercent}%`} stopColor={`#${homeTeam?.team?.color || "000000"}`} stopOpacity={1} />
                                            </linearGradient>
                                        </>
                                    );
                                })()}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis 
                                dataKey="index" 
                                tick={false} 
                                hide={true} 
                            />
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
                                    if (val === 100) return "100%"; // Top is Away 100%
                                    if (val === 0) return "100%"; // Bottom is Home 100%
                                    if (val === 25 || val === 75) return ""; // No label for 75%s
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
                                                    return (
                                                        <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg max-w-sm z-[100]">
                                                            {d.inning && <p className="font-bold text-[10px] uppercase text-slate-400 mb-1">{d.half} {d.inning}</p>}
                                                            <p className="text-sm font-medium text-slate-800 mb-2 leading-tight">{d.playText}</p>
                                                            <div className="flex gap-4 text-xs font-bold mt-2 pt-2 border-t border-slate-100">
                                                                <span style={{ color: `#${awayTeam?.team?.color}` }}>{awayTeam?.team?.abbreviation}: {d.awayWinPct.toFixed(1)}%</span>
                                                                <span style={{ color: `#${homeTeam?.team?.color}` }}>{homeTeam?.team?.abbreviation}: {d.homeWinPct.toFixed(1)}%</span>
                                                            </div>
                                                            {d.homeScore !== undefined && d.awayScore !== undefined && (
                                                                <div className="mt-1.5 text-[10px] uppercase tracking-widest text-slate-500 font-bold bg-slate-50 rounded px-2 py-1 inline-block">
                                                                    Score: {awayTeam?.team?.abbreviation} {d.awayScore} - {homeTeam?.team?.abbreviation} {d.homeScore}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()
                                            ) : null}
                                        </>
                                    );
                                }}
                            />
                            {winProbData.inningDividers.map((idx) => (
                                <ReferenceLine key={idx} x={idx} stroke="#e2e8f0" strokeDasharray="3 3" />
                            ))}
                            <ReferenceLine y={75} stroke="#e2e8f0" strokeDasharray="3 3" />
                            <ReferenceLine y={50} stroke="#cbd5e1" strokeWidth={2} />
                            <ReferenceLine y={25} stroke="#e2e8f0" strokeDasharray="3 3" />
                            <Area 
                                type="monotone" 
                                dataKey="chartValue" 
                                stroke="url(#splitStroke)" 
                                fill="url(#splitColor)"
                                fillOpacity={1}
                                strokeWidth={3}
                                dot={false}
                                activeDot={{ r: 6, fill: "#fff", stroke: '#cbd5e1', strokeWidth: 2 }}
                                baseValue={50}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};
