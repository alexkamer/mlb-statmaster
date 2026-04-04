import { GameVideoPlayer } from './GameVideoPlayer';
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SafeImage } from '../shared/SafeImage';
import { PlayCircle, ChevronRight, ChevronDown } from 'lucide-react';
import { LinescoreMatrix } from './LinescoreMatrix';
import { ResponsiveContainer, AreaChart, Area, ReferenceLine, YAxis, Tooltip } from 'recharts';

interface GameOverviewTabProps {
    data: any;
    gameId: string;
    gameOdds: any;
    awayTeam: any;
    homeTeam: any;
    header: any;
    isPregame: boolean;
    boxscorePitchers: Map<string, any>;
    onTabChange: (tab: string) => void;
}

export const GameOverviewTab: React.FC<GameOverviewTabProps> = ({ 
    data, gameId, gameOdds, awayTeam, homeTeam, header, isPregame, boxscorePitchers, onTabChange 
}) => {
    const [activeBoxTeam, setActiveBoxTeam] = useState<string>(awayTeam?.team?.id?.toString());
    const [expandedHitters, setExpandedHitters] = useState<Set<string>>(new Set());
    const [activeSeriesTab, setActiveSeriesTab] = useState<number>(0);
    const [miniHoveredProb, setMiniHoveredProb] = useState<any>(null);
    const [teamStatsTab, setTeamStatsTab] = useState<'batting'|'pitching'>('batting');

    const toggleHitter = (id: string) => {
        setExpandedHitters(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const scoringPlays = data.plays?.filter((p: any) => p.scoringPlay) || [];
    const headline = header?.headlines?.[0];
    const imageUrl = 'https://via.placeholder.com/800x450?text=Mock+Highlight+Thumbnail';

    const currentTeamBox = data.boxscore?.players?.find((p: any) => p.team?.id === activeBoxTeam);
    const battingStats = currentTeamBox?.statistics?.find((s: any) => s.type === 'batting');
    const pitchingStats = currentTeamBox?.statistics?.find((s: any) => s.type === 'pitching');
    
    // Helper for mini box score stats
    const getStat = (ath: any, labels: string[], statName: string) => {
        if (!labels || !ath.stats) return '-';
        const idx = labels.indexOf(statName);
        return idx > -1 ? ath.stats[idx] : '-';
    };

    const hitters = battingStats?.athletes?.filter((a: any) => a.starter || parseInt(getStat(a, battingStats.labels, 'AB')) > 0).slice(0, 9) || [];
    const pitchers = pitchingStats?.athletes?.filter((a: any) => parseFloat(getStat(a, pitchingStats.labels, 'IP') || '0') > 0).slice(0, 6) || [];

    const hitterAtBats = useMemo(() => {
        const map = new Map<string, any[]>();
        if (!data?.plays) return map;

        const abs = new Map<string, any>();
        data.plays.forEach((play: any) => {
            if (!play.atBatId) return;

            if (!abs.has(play.atBatId)) {
                abs.set(play.atBatId, { 
                    id: play.atBatId, 
                    plays: [], 
                    batterId: null, 
                    inning: play.period?.number,
                    half: play.period?.half === "top" ? "▲" : "▼"
                });
            }
            
            const ab = abs.get(play.atBatId);
            ab.plays.push(play);

            const batter = play.participants?.find((p: any) => p.type === "batter");
            if (batter?.athlete?.id) {
                ab.batterId = batter.athlete.id;
            }
        });

        for (const ab of abs.values()) {
            if (!ab.batterId) continue;
            if (!map.has(ab.batterId)) map.set(ab.batterId, []);
            
            const resultPlay = ab.plays.find((p: any) => p.type?.type === "play-result") || ab.plays[ab.plays.length - 1];
            
            const getOrdinal = (n: number) => {
                const s = ["th", "st", "nd", "rd"], v = n % 100;
                return n + (s[(v - 20) % 10] || s[v] || s[0]);
            };

            map.get(ab.batterId)!.push({
                inning: getOrdinal(resultPlay?.period?.number || ab.inning),
                text: resultPlay?.text || "At bat",
                isScoring: resultPlay?.scoringPlay || false
            });
        }
        
        return map;
    }, [data]);

    // Mini Win Probability Data
    const miniWpData = useMemo(() => {
        if (!data?.winprobability || data.winprobability.length === 0) return null;
        
        return data.winprobability.map((wp: any, i: number) => {
            const play = data.plays?.find((p: any) => p.id === wp.playId);
            return {
                index: i,
                homeWinPct: wp.homeWinPercentage * 100,
                awayWinPct: (1 - wp.homeWinPercentage) * 100,
                chartValue: (1 - wp.homeWinPercentage) * 100,
                playText: play?.text || "Unknown play",
                homeScore: play?.homeScore,
                awayScore: play?.awayScore,
                inning: play?.period?.displayValue,
                half: play?.period?.type
            };
        });
    }, [data]);

    const latestWp = miniWpData ? miniWpData[miniWpData.length - 1] : null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: Mini Box Score & Win Probability */}
            <div className="lg:col-span-3 flex flex-col gap-6">
                
                {/* Mini Box Score */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="flex border-b border-slate-200">
                        <button 
                            onClick={() => setActiveBoxTeam(awayTeam?.team?.id?.toString())}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 font-black text-sm uppercase tracking-widest transition-colors ${activeBoxTeam === awayTeam?.team?.id?.toString() ? 'border-b-2 bg-slate-50' : 'text-slate-400 hover:bg-slate-50'}`}
                            style={{ borderColor: activeBoxTeam === awayTeam?.team?.id?.toString() ? `#${awayTeam?.team?.color}` : 'transparent', color: activeBoxTeam === awayTeam?.team?.id?.toString() ? `#${awayTeam?.team?.color}` : undefined }}
                        >
                            <SafeImage src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${awayTeam?.team?.abbreviation?.toLowerCase()}.png`} className="w-5 h-5 object-contain" alt="" hideOnError />
                            {awayTeam?.team?.abbreviation}
                        </button>
                        <button 
                            onClick={() => setActiveBoxTeam(homeTeam?.team?.id?.toString())}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 font-black text-sm uppercase tracking-widest transition-colors ${activeBoxTeam === homeTeam?.team?.id?.toString() ? 'border-b-2 bg-slate-50' : 'text-slate-400 hover:bg-slate-50'}`}
                            style={{ borderColor: activeBoxTeam === homeTeam?.team?.id?.toString() ? `#${homeTeam?.team?.color}` : 'transparent', color: activeBoxTeam === homeTeam?.team?.id?.toString() ? `#${homeTeam?.team?.color}` : undefined }}
                        >
                            <SafeImage src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${homeTeam?.team?.abbreviation?.toLowerCase()}.png`} className="w-5 h-5 object-contain" alt="" hideOnError />
                            {homeTeam?.team?.abbreviation}
                        </button>
                    </div>
                    
                    <div className="p-0">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-3 py-2">Hitters</th>
                                    <th className="px-2 py-2 text-right">H-AB</th>
                                    <th className="px-2 py-2 text-right">R</th>
                                    <th className="px-2 py-2 text-right">HR</th>
                                    <th className="px-2 py-2 text-right">RBI</th>
                                    <th className="px-3 py-2 text-right">AVG</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {hitters.map((ath: any, i: number) => {
                                    const isExpanded = expandedHitters.has(ath.athlete?.id);
                                    const atBats = hitterAtBats.get(ath.athlete?.id) || [];
                                    const hasAtBats = atBats.length > 0;
                                    
                                    return (
                                        <React.Fragment key={i}>
                                            <tr className="hover:bg-slate-50">
                                                <td className={`px-2 py-2 text-blue-600 font-medium truncate max-w-[160px] flex items-center gap-1 ${!ath.starter ? 'pl-6' : ''}`}>
                                                    {hasAtBats ? (
                                                        <button onClick={() => toggleHitter(ath.athlete?.id)} className="p-0.5 hover:bg-slate-200 rounded text-slate-400">
                                                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                        </button>
                                                    ) : (
                                                        <div className="w-4 h-4" />
                                                    )}
                                                    <Link to={`/players/${ath.athlete?.id}`} className="hover:underline">{ath.athlete?.shortName}</Link>
                                                    <span className="text-[9px] text-slate-400 ml-0.5">{ath.position?.abbreviation}</span>
                                                </td>
                                                <td className="px-2 py-2 text-right text-slate-600">{getStat(ath, battingStats?.labels, 'H')}-{getStat(ath, battingStats?.labels, 'AB')}</td>
                                                <td className="px-2 py-2 text-right text-slate-600">{getStat(ath, battingStats?.labels, 'R')}</td>
                                                <td className="px-2 py-2 text-right text-slate-600">{getStat(ath, battingStats?.labels, 'HR')}</td>
                                                <td className="px-2 py-2 text-right text-slate-600">{getStat(ath, battingStats?.labels, 'RBI')}</td>
                                                <td className="px-3 py-2 text-right text-slate-500">{getStat(ath, battingStats?.labels, 'AVG')}</td>
                                            </tr>
                                            {isExpanded && hasAtBats && (
                                                <tr className="bg-slate-50/80 border-b border-slate-100">
                                                    <td colSpan={6} className="px-6 py-2">
                                                        <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-slate-200">
                                                            {atBats.map((ab: any, idx: number) => (
                                                                <div key={idx} className="flex gap-3 text-[10px] items-start">
                                                                    <span className="font-bold text-slate-400 whitespace-nowrap w-6 shrink-0 mt-0.5">{ab.inning}</span>
                                                                    <span className={`font-medium flex-1 ${ab.isScoring ? 'text-primary font-bold' : 'text-slate-600'}`}>{ab.text}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                            <thead className="bg-slate-50 border-y border-slate-100 text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-2">
                                <tr>
                                    <th className="px-3 py-2">Pitchers</th>
                                    <th className="px-2 py-2 text-right">IP</th>
                                    <th className="px-2 py-2 text-right">H</th>
                                    <th className="px-2 py-2 text-right">ER</th>
                                    <th className="px-2 py-2 text-right">BB</th>
                                    <th className="px-3 py-2 text-right">K</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pitchers.map((ath: any, i: number) => (
                                    <tr key={i} className="hover:bg-slate-50">
                                        <td className="px-3 py-2 text-blue-600 font-medium truncate max-w-[160px]">
                                            <Link to={`/players/${ath.athlete?.id}`} className="hover:underline">{ath.athlete?.shortName}</Link>
                                        </td>
                                        <td className="px-2 py-2 text-right text-slate-600">{getStat(ath, pitchingStats?.labels, 'IP')}</td>
                                        <td className="px-2 py-2 text-right text-slate-600">{getStat(ath, pitchingStats?.labels, 'H')}</td>
                                        <td className="px-2 py-2 text-right text-slate-600">{getStat(ath, pitchingStats?.labels, 'ER')}</td>
                                        <td className="px-2 py-2 text-right text-slate-600">{getStat(ath, pitchingStats?.labels, 'BB')}</td>
                                        <td className="px-3 py-2 text-right text-slate-500">{getStat(ath, pitchingStats?.labels, 'K')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="border-t border-slate-200 p-3 text-center bg-slate-50">
                        <button onClick={() => onTabChange("boxscore")} className="text-blue-600 text-sm font-bold hover:underline">Full Box Score</button>
                    </div>
                </div>

                {/* Mini Win Probability */}
                {miniWpData && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <span className="font-bold text-slate-800">Win Probability</span>
                            {latestWp && (
                                <div className="flex items-center gap-2">
                                    <SafeImage 
                                        src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${latestWp.homeWinPct >= 50 ? homeTeam?.team?.abbreviation?.toLowerCase() : awayTeam?.team?.abbreviation?.toLowerCase()}.png`} 
                                        className="w-4 h-4 object-contain" 
                                    />
                                    <span className="font-black text-lg" style={{ color: latestWp.homeWinPct >= 50 ? `#${homeTeam?.team?.color}` : `#${awayTeam?.team?.color}` }}>
                                        {Math.max(latestWp.homeWinPct, latestWp.awayWinPct).toFixed(1)}%
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="h-32 w-full pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={miniWpData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                    <defs>
                                        {(() => {
                                            const yValues = miniWpData.map((d: any) => d.chartValue);
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
                                                    <linearGradient id="miniSplitColor" x1="0" y1="0" x2="0" y2="100%">
                                                        <stop offset="0%" stopColor={`#${awayTeam?.team?.color || "000000"}`} stopOpacity={0.5} />
                                                        <stop offset={`${splitFillPercent}%`} stopColor={`#${awayTeam?.team?.color || "000000"}`} stopOpacity={0} />
                                                        
                                                        <stop offset={`${splitFillPercent}%`} stopColor={`#${homeTeam?.team?.color || "000000"}`} stopOpacity={0} />
                                                        <stop offset="100%" stopColor={`#${homeTeam?.team?.color || "000000"}`} stopOpacity={0.5} />
                                                    </linearGradient>
                                                    <linearGradient id="miniSplitStroke" x1="0" y1="0" x2="0" y2="100%">
                                                        <stop offset={`${splitStrokePercent - 0.01}%`} stopColor={`#${awayTeam?.team?.color || "000000"}`} stopOpacity={1} />
                                                        <stop offset={`${splitStrokePercent}%`} stopColor={`#${homeTeam?.team?.color || "000000"}`} stopOpacity={1} />
                                                    </linearGradient>
                                                </>
                                            );
                                        })()}
                                    </defs>
                                    <YAxis domain={[0, 100]} hide />
                                    <ReferenceLine y={50} stroke="#cbd5e1" strokeWidth={1} />
                                    <Tooltip 
                                        content={({ active, payload }: any) => {
                                            if (active && payload && payload.length) {
                                                const d = payload[0].payload;
                                                // Sync state so the header updates
                                                setTimeout(() => setMiniHoveredProb(d), 0);
                                                
                                                return (
                                                    <div className="bg-white p-2 border border-slate-200 shadow-lg rounded max-w-[200px] z-[100] transform -translate-y-4">
                                                        {d.inning && (
                                                            <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-100">
                                                                <p className="font-bold text-[8px] uppercase text-slate-400">{d.half} {d.inning}</p>
                                                                <div className="font-black text-[10px] flex items-center gap-1" style={{ color: d.homeWinPct >= 50 ? `#${homeTeam?.team?.color}` : `#${awayTeam?.team?.color}` }}>
                                                                    {d.homeWinPct >= 50 ? homeTeam?.team?.abbreviation : awayTeam?.team?.abbreviation} {Math.max(d.homeWinPct, d.awayWinPct).toFixed(1)}%
                                                                </div>
                                                            </div>
                                                        )}
                                                        <p className="text-[10px] font-medium text-slate-800 mb-1 leading-tight line-clamp-3">{d.playText}</p>
                                                        {d.homeScore !== undefined && d.awayScore !== undefined && (
                                                            <div className="mt-1 text-[8px] uppercase tracking-widest text-slate-500 font-bold bg-slate-50 rounded px-1.5 py-0.5 inline-block">
                                                                {awayTeam?.team?.abbreviation} {d.awayScore} - {homeTeam?.team?.abbreviation} {d.homeScore}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }
                                            setTimeout(() => setMiniHoveredProb(null), 0);
                                            return null;
                                        }}
                                        cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} 
                                        position={{ y: 0 }}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="chartValue" 
                                        stroke="url(#miniSplitStroke)" 
                                        fill="url(#miniSplitColor)"
                                        strokeWidth={1.5}
                                        isAnimationActive={false} 
                                        baseValue={50}
                                        activeDot={{ r: 4, fill: "#fff", stroke: '#cbd5e1', strokeWidth: 2 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="border-t border-slate-100 p-3 text-center bg-slate-50">
                            <button onClick={() => onTabChange("win_probability")} className="text-blue-600 text-xs font-bold hover:underline">Full Chart</button>
                        </div>
                    </div>
                )}
                
                {/* Team Stats Comparison */}
                {data.boxscore?.teams && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="flex border-b border-slate-200">
                            <button 
                                onClick={() => setTeamStatsTab('batting')}
                                className={`flex-1 py-3 font-black text-xs uppercase tracking-widest transition-colors ${teamStatsTab === 'batting' ? 'bg-slate-50 text-slate-800 border-b-2 border-primary' : 'text-slate-400 hover:bg-slate-50'}`}
                            >
                                Hitting Stats
                            </button>
                            <button 
                                onClick={() => setTeamStatsTab('pitching')}
                                className={`flex-1 py-3 font-black text-xs uppercase tracking-widest transition-colors ${teamStatsTab === 'pitching' ? 'bg-slate-50 text-slate-800 border-b-2 border-primary' : 'text-slate-400 hover:bg-slate-50'}`}
                            >
                                Pitching Stats
                            </button>
                        </div>
                        
                        <div className="p-0">
                            {(() => {
                                const awayTeamBox = data.boxscore.teams.find((t: any) => t.team?.id === awayTeam?.team?.id?.toString());
                                const homeTeamBox = data.boxscore.teams.find((t: any) => t.team?.id === homeTeam?.team?.id?.toString());
                                
                                const getTeamStat = (teamBox: any, category: string, statAbbrev: string) => {
                                    if (!teamBox) return "-";
                                    const statGroup = teamBox.statistics?.find((s: any) => s.name === category);
                                    if (!statGroup) return "-";
                                    const stat = statGroup.stats?.find((s: any) => s.abbreviation === statAbbrev);
                                    return stat?.displayValue || "-";
                                };
                                
                                const rows = teamStatsTab === 'batting' ? [
                                    { label: "Hits", away: getTeamStat(awayTeamBox, 'batting', 'H'), home: getTeamStat(homeTeamBox, 'batting', 'H') },
                                    { label: "Home Runs", away: getTeamStat(awayTeamBox, 'batting', 'HR'), home: getTeamStat(homeTeamBox, 'batting', 'HR') },
                                    { label: "Total Bases", away: getTeamStat(awayTeamBox, 'batting', 'TB'), home: getTeamStat(homeTeamBox, 'batting', 'TB') },
                                    { label: "Runner LOB", away: getTeamStat(awayTeamBox, 'batting', 'LOB'), home: getTeamStat(homeTeamBox, 'batting', 'LOB') }
                                ] : [
                                    { label: "Strikeouts", away: getTeamStat(awayTeamBox, 'pitching', 'K'), home: getTeamStat(homeTeamBox, 'pitching', 'K') },
                                    { label: "Strikes", away: getTeamStat(awayTeamBox, 'pitching', 'S'), home: getTeamStat(homeTeamBox, 'pitching', 'S') },
                                    { label: "Hits Allowed", away: getTeamStat(awayTeamBox, 'pitching', 'H'), home: getTeamStat(homeTeamBox, 'pitching', 'H') },
                                    { label: "Walks", away: getTeamStat(awayTeamBox, 'pitching', 'BB'), home: getTeamStat(homeTeamBox, 'pitching', 'BB') }
                                ];
                                
                                return (
                                    <table className="w-full text-sm text-center tabular-nums table-fixed">
                                        <thead className="bg-slate-50 text-[10px] text-slate-400 font-bold border-b border-slate-100 uppercase tracking-widest">
                                            <tr>
                                                <th className="py-2 w-1/3">
                                                    <div className="flex items-center justify-center gap-1.5" style={{ color: `#${awayTeam?.team?.color}` }}>
                                                        <SafeImage src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${awayTeam?.team?.abbreviation?.toLowerCase()}.png`} className="w-4 h-4 object-contain" hideOnError />
                                                        {awayTeam?.team?.abbreviation}
                                                    </div>
                                                </th>
                                                <th className="py-2 w-1/3 border-x border-slate-100">Stat</th>
                                                <th className="py-2 w-1/3">
                                                    <div className="flex items-center justify-center gap-1.5" style={{ color: `#${homeTeam?.team?.color}` }}>
                                                        {homeTeam?.team?.abbreviation}
                                                        <SafeImage src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${homeTeam?.team?.abbreviation?.toLowerCase()}.png`} className="w-4 h-4 object-contain" hideOnError />
                                                    </div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                            {rows.map((r, i) => {
                                                const aVal = parseFloat(r.away);
                                                const hVal = parseFloat(r.home);
                                                const isAwayHigher = !isNaN(aVal) && !isNaN(hVal) && aVal > hVal;
                                                const isHomeHigher = !isNaN(aVal) && !isNaN(hVal) && hVal > aVal;
                                                
                                                // For stats where lower is better (Hits Allowed, Walks), invert the bolding logic for Pitching!
                                                // But in baseball displays, usually the raw highest number is bolded regardless of "good/bad". 
                                                // We'll stick to bolding the raw highest number to match ESPN/MLB standard.
                                                
                                                return (
                                                    <tr key={i} className="hover:bg-slate-50">
                                                        <td className={`py-2.5 ${isAwayHigher ? 'font-black text-slate-900' : 'text-slate-500'}`}>{r.away}</td>
                                                        <td className="py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-x border-slate-100 bg-slate-50/50">{r.label}</td>
                                                        <td className={`py-2.5 ${isHomeHigher ? 'font-black text-slate-900' : 'text-slate-500'}`}>{r.home}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                );
                            })()}
                        </div>
                    </div>
                )}
            </div>

            {/* CENTER COLUMN: Highlights, Linescore, Scoring Summary */}
            <div className="lg:col-span-6 flex flex-col gap-6">
                
                {/* Media / Headline */}
                <GameVideoPlayer data={data} />

                {/* Recap Article */}
                {data.article && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-6 relative">
                        {(() => {
                            const recap = data.article;
                            const recapLink = recap.links?.web?.href || recap.links?.api?.news?.href || '#';
                            return (
                                <a href={recapLink} target="_blank" rel="noreferrer" className="group block">
                                    <h3 className="font-headline font-black text-2xl uppercase tracking-tighter text-slate-800 mb-2 group-hover:text-primary transition-colors leading-tight">
                                        {recap.headline}
                                    </h3>
                                    <p className="text-sm text-slate-600 font-medium leading-relaxed">
                                        {recap.description}
                                    </p>
                                    <div className="mt-4 flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Read Full Recap</span>
                                        <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors text-slate-400">
                                            <ChevronRight className="w-3 h-3" />
                                        </div>
                                    </div>
                                </a>
                            );
                        })()}
                    </div>
                )}

                {/* Linescore Matrix injected here */}
                <LinescoreMatrix 
                    awayTeam={awayTeam} 
                    homeTeam={homeTeam} 
                    header={header} 
                    isPregame={isPregame} 
                    boxscorePitchers={boxscorePitchers} 
                />

                {/* Scoring Summary */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                        <span className="font-bold text-slate-800">Scoring Summary</span>
                        <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest">
                            <span>{awayTeam?.team?.abbreviation}</span>
                            <span>{homeTeam?.team?.abbreviation}</span>
                        </div>
                    </div>
                    <div className="p-0">
                        {scoringPlays.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-sm">No scoring plays yet.</div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {scoringPlays.map((play: any, idx: number) => {
                                    const batTeamId = play.participants?.[0]?.athlete?.team?.id || play.team?.id;
                                    const isAwayBatting = batTeamId === awayTeam?.team?.id || play.period?.half === "top";
                                    
                                    // Helper for ordinal inning
                                    const getOrdinal = (n: number) => {
                                        const s = ["th", "st", "nd", "rd"], v = n % 100;
                                        return n + (s[(v - 20) % 10] || s[v] || s[0]);
                                    };
                                    
                                    const inningStr = getOrdinal(play.period?.number);
                                    // ESPN uses lowercase 'top' and 'bottom'
                                    const halfText = (play.period?.half || '').toLowerCase();
                                    const isTop = halfText === 'top' || isAwayBatting;
                                    const halfIndicator = isTop ? "▲" : "▼";
                                    
                                    return (
                                        <div key={idx} className="flex gap-4 p-4 hover:bg-slate-50 items-center">
                                            <div className="w-14 shrink-0 flex flex-col items-center justify-center">
                                                <SafeImage 
                                                    src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${isAwayBatting ? awayTeam?.team?.abbreviation?.toLowerCase() : homeTeam?.team?.abbreviation?.toLowerCase()}.png`} 
                                                    className="w-6 h-6 object-contain mb-1" 
                                                    hideOnError 
                                                />
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                    <span className={isTop ? "text-indigo-500" : "text-slate-400"}>{halfIndicator}</span>
                                                    <span>{inningStr}</span>
                                                </div>
                                            </div>
                                            <div className="flex-1 text-sm text-slate-700 pt-1.5 font-medium">
                                                {play.text}
                                            </div>
                                            <div className="w-16 shrink-0 flex gap-4 pt-1.5 font-black text-slate-800 justify-end">
                                                <span className={isAwayBatting ? 'text-primary' : ''}>{play.awayScore}</span>
                                                <span className={!isAwayBatting ? 'text-primary' : ''}>{play.homeScore}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <div className="border-t border-slate-200 p-3 text-center bg-slate-50">
                        <button onClick={() => onTabChange("plays")} className="text-blue-600 text-sm font-bold hover:underline">Full Play-By-Play</button>
                    </div>
                </div>

            </div>

            {/* RIGHT COLUMN: Odds, Series, Standings */}
            <div className="lg:col-span-3 flex flex-col gap-6">
                
                {/* Game Odds */}
                {(() => {
                    // ESPN sometimes hides odds in pickcenter instead of header.odds
                    const odds = gameOdds || header?.odds?.[0] || data.pickcenter?.[0];
                    if (!odds) return null;
                    
                    const formatOdds = (val: any) => val > 0 ? `+${val}` : val;
                    const provider = odds.provider?.name || "Sportsbook";
                    
                    // The odds object contains:
                    // details (e.g. "LAD -1.5")
                    // overUnder
                    // overOdds, underOdds
                    // awayTeamOdds (has moneyLine, spreadOdds, etc)
                    // homeTeamOdds
                    
                    // Map ML
                    let awayML = odds.awayTeamOdds?.moneyLine ? formatOdds(odds.awayTeamOdds.moneyLine) : '-';
                    let homeML = odds.homeTeamOdds?.moneyLine ? formatOdds(odds.homeTeamOdds.moneyLine) : '-';
                    
                    // The pickcenter array has a different format
                    const pickcenter = data.pickcenter?.[0] || odds;
                    
                    if (pickcenter.moneyline) {
                        awayML = pickcenter.moneyline.away?.close?.odds || awayML;
                        homeML = pickcenter.moneyline.home?.close?.odds || homeML;
                    }

                    let pregameAwayML = null;
                    let pregameHomeML = null;
                    const pgOdds = odds._pregameOdds;
                    if (pgOdds) {
                        let pgAwayML = pgOdds.away_money_line ?? pgOdds.awayTeamOdds?.moneyLine;
                        let pgHomeML = pgOdds.home_money_line ?? pgOdds.homeTeamOdds?.moneyLine;
                        
                        if (pgOdds.moneyline) {
                            pgAwayML = pgOdds.moneyline.away?.close?.odds ?? pgAwayML;
                            pgHomeML = pgOdds.moneyline.home?.close?.odds ?? pgHomeML;
                        }
                        
                        if (pgAwayML !== undefined && pgAwayML !== null) pregameAwayML = formatOdds(pgAwayML);
                        if (pgHomeML !== undefined && pgHomeML !== null) pregameHomeML = formatOdds(pgHomeML);
                    }

                    if (pregameAwayML === awayML) pregameAwayML = null;
                    if (pregameHomeML === homeML) pregameHomeML = null;

                    // Map Run Line (Spread)
                    let awaySpread = '-';
                    let homeSpread = '-';
                    let awaySpreadOdds = '-';
                    let homeSpreadOdds = '-';
                    
                    if (pickcenter.pointSpread) {
                        awaySpread = pickcenter.pointSpread.away?.close?.line || '-';
                        awaySpreadOdds = pickcenter.pointSpread.away?.close?.odds || '-';
                        homeSpread = pickcenter.pointSpread.home?.close?.line || '-';
                        homeSpreadOdds = pickcenter.pointSpread.home?.close?.odds || '-';
                    } else {
                        // Historical DB fallback
                        // Baseball runline is universally 1.5. If the details string points to a favorite, they are -1.5.
                        if (odds.details) {
                            const parts = odds.details.split(' ');
                            if (parts.length >= 1) {
                                const favAbbrev = parts[0];
                                if (awayTeam?.team?.abbreviation === favAbbrev) {
                                    awaySpread = "-1.5";
                                    homeSpread = "+1.5";
                                } else if (homeTeam?.team?.abbreviation === favAbbrev) {
                                    homeSpread = "-1.5";
                                    awaySpread = "+1.5";
                                }
                            }
                        }
                        // Note: Our scraper didn't save the exact payout odds for the spread, so we just show the line.
                    }
                    
                    // Map Total (Over/Under)
                    let totalOver = '-';
                    let totalOverOdds = '-';
                    let totalUnder = '-';
                    let totalUnderOdds = '-';
                    
                    if (pickcenter.total) {
                        totalOver = pickcenter.total.over?.close?.line || '-';
                        totalOverOdds = pickcenter.total.over?.close?.odds || '-';
                        totalUnder = pickcenter.total.under?.close?.line || '-';
                        totalUnderOdds = pickcenter.total.under?.close?.odds || '-';
                    } else {
                        const line = odds.overUnder || pickcenter.overUnder;
                        if (line) {
                            totalOver = `o${line}`;
                            totalUnder = `u${line}`;
                        }
                        if (odds.overOdds) totalOverOdds = formatOdds(odds.overOdds);
                        if (odds.underOdds) totalUnderOdds = formatOdds(odds.underOdds);
                    }
                    
                    // Determine Betting Winners (Only if game is Final)
                    const isFinal = header?.status?.type?.completed;
                    
                    let awayMLWin = false;
                    let homeMLWin = false;
                    let awayRLWin = false;
                    let homeRLWin = false;
                    let overWin = false;
                    let underWin = false;
                    
                    if (isFinal) {
                        const awayScore = parseInt(awayTeam?.score || '0');
                        const homeScore = parseInt(homeTeam?.score || '0');
                        const totalScore = awayScore + homeScore;
                        
                        // Moneyline
                        if (awayScore > homeScore) awayMLWin = true;
                        if (homeScore > awayScore) homeMLWin = true;
                        
                        // Runline
                        const aSpreadFloat = parseFloat(awaySpread.replace('+', ''));
                        const hSpreadFloat = parseFloat(homeSpread.replace('+', ''));
                        
                        if (!isNaN(aSpreadFloat) && !isNaN(hSpreadFloat)) {
                            const awayAdjusted = awayScore + aSpreadFloat;
                            const homeAdjusted = homeScore + hSpreadFloat;
                            
                            if (awayAdjusted > homeScore) awayRLWin = true;
                            if (homeAdjusted > awayScore) homeRLWin = true;
                        }
                        
                        // Total
                        const totalLineFloat = pickcenter.total?.over?.close?.line || odds.overUnder || pickcenter.overUnder;
                        if (totalLineFloat !== undefined && totalLineFloat !== null && totalLineFloat !== '-') {
                            const cleanLine = typeof totalLineFloat === 'string' ? totalLineFloat.replace(/^[a-zA-Z]+/, '') : totalLineFloat;
                            const tl = parseFloat(cleanLine);
                            if (!isNaN(tl)) {
                                if (totalScore > tl) overWin = true;
                                if (totalScore < tl) underWin = true;
                            }
                        }
                    }

                    return (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
                            <div className="flex justify-between items-center bg-slate-900 text-white px-4 py-2 border-b border-slate-800">
                                <span className="font-black text-sm uppercase tracking-widest">{awayTeam?.team?.abbreviation} @ {homeTeam?.team?.abbreviation} Odds</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                    {provider === "DraftKings" ? (
                                        <span className="text-[#53d337]">DraftKings</span>
                                    ) : provider === "Caesars Sportsbook" ? (
                                        <span className="text-[#c1a067]">Caesars</span>
                                    ) : provider}
                                </span>
                            </div>
                            
                            <table className="w-full text-center text-xs table-fixed">
                                <thead className="bg-slate-50 text-[10px] text-slate-400 font-bold border-b border-slate-100 uppercase tracking-widest">
                                    <tr>
                                        <th className="text-left px-4 py-2 w-[28%]">Team</th>
                                        <th className="py-2 w-[24%] border-l border-slate-100">Moneyline</th>
                                        <th className="py-2 w-[24%] border-l border-slate-100">Total</th>
                                        <th className="py-2 w-[24%] border-l border-slate-100">Run Line</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700 bg-white">
                                    <tr className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-left font-black flex items-center gap-2" style={{ color: `#${awayTeam?.team?.color}` }}>
                                            <SafeImage src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${awayTeam?.team?.abbreviation?.toLowerCase()}.png`} className="w-4 h-4 object-contain" alt="" hideOnError />
                                            {awayTeam?.team?.abbreviation}
                                        </td>
                                        <td className="py-3 border-l border-slate-100 relative">
                                            <div className="flex flex-col items-center justify-center leading-tight relative z-10">
                                                <span className={`font-bold ${awayMLWin ? 'text-emerald-600' : 'text-slate-800'}`}>{awayML}</span>
                                                {pregameAwayML && (
                                                    <span className="text-[9px] text-slate-400 font-bold">({pregameAwayML})</span>
                                                )}
                                            </div>
                                            {awayMLWin && <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none"></div>}
                                        </td>
                                        <td className="py-3 border-l border-slate-100 relative">
                                            <div className="flex flex-col items-center leading-tight relative z-10">
                                                <span className={`font-black text-[10px] ${overWin ? 'text-emerald-600' : 'text-slate-700'}`}>{totalOver}</span>
                                                <span className={`text-[10px] font-bold ${overWin ? 'text-emerald-500' : 'text-slate-400'}`}>{totalOverOdds}</span>
                                            </div>
                                            {overWin && <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none"></div>}
                                        </td>
                                        <td className="py-3 border-l border-slate-100 relative">
                                            <div className="flex flex-col items-center leading-tight relative z-10">
                                                <span className={`font-black text-[10px] ${awayRLWin ? 'text-emerald-600' : 'text-slate-700'}`}>{awaySpread}</span>
                                                <span className={`text-[10px] font-bold ${awayRLWin ? 'text-emerald-500' : 'text-slate-400'}`}>{awaySpreadOdds}</span>
                                            </div>
                                            {awayRLWin && <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none"></div>}
                                        </td>
                                    </tr>
                                    <tr className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-left font-black flex items-center gap-2" style={{ color: `#${homeTeam?.team?.color}` }}>
                                            <SafeImage src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${homeTeam?.team?.abbreviation?.toLowerCase()}.png`} className="w-4 h-4 object-contain" alt="" hideOnError />
                                            {homeTeam?.team?.abbreviation}
                                        </td>
                                        <td className="py-3 border-l border-slate-100 relative">
                                            <div className="flex flex-col items-center justify-center leading-tight relative z-10">
                                                <span className={`font-bold ${homeMLWin ? 'text-emerald-600' : 'text-slate-800'}`}>{homeML}</span>
                                                {pregameHomeML && (
                                                    <span className="text-[9px] text-slate-400 font-bold">({pregameHomeML})</span>
                                                )}
                                            </div>
                                            {homeMLWin && <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none"></div>}
                                        </td>
                                        <td className="py-3 border-l border-slate-100 relative">
                                            <div className="flex flex-col items-center leading-tight relative z-10">
                                                <span className={`font-black text-[10px] ${underWin ? 'text-emerald-600' : 'text-slate-700'}`}>{totalUnder}</span>
                                                <span className={`text-[10px] font-bold ${underWin ? 'text-emerald-500' : 'text-slate-400'}`}>{totalUnderOdds}</span>
                                            </div>
                                            {underWin && <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none"></div>}
                                        </td>
                                        <td className="py-3 border-l border-slate-100 relative">
                                            <div className="flex flex-col items-center leading-tight relative z-10">
                                                <span className={`font-black text-[10px] ${homeRLWin ? 'text-emerald-600' : 'text-slate-700'}`}>{homeSpread}</span>
                                                <span className={`text-[10px] font-bold ${homeRLWin ? 'text-emerald-500' : 'text-slate-400'}`}>{homeSpreadOdds}</span>
                                            </div>
                                            {homeRLWin && <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none"></div>}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            {header?.links?.some((l: any) => l.text === 'Odds') && (
                                <div className="border-t border-slate-100 p-2 text-center bg-slate-50">
                                    <a href={header.links.find((l: any) => l.text === 'Odds')?.href} target="_blank" rel="noreferrer" className="text-blue-600 text-[10px] uppercase tracking-widest font-black hover:underline">
                                        More Odds Details
                                    </a>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* Series Matchup */}
                {(() => {
                    const seriesData = data.seasonseries;
                    if (!seriesData || seriesData.length === 0) return null;
                    
                    const activeSeries = seriesData[activeSeriesTab];
                    
                    return (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-4">
                            <div className="flex justify-between items-center mb-2">
                                <select 
                                    className="font-bold text-sm text-slate-800 bg-transparent outline-none cursor-pointer hover:text-primary transition-colors appearance-none"
                                    value={activeSeriesTab}
                                    onChange={(e) => setActiveSeriesTab(parseInt(e.target.value))}
                                >
                                    {seriesData.map((s: any, i: number) => (
                                        <option key={i} value={i}>{s.title}</option>
                                    ))}
                                </select>
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">{activeSeries.summary}</p>
                            
                            <div className="flex flex-col gap-2 text-xs">
                                {activeSeries.events.map((ev: any, idx: number) => {
                                    const isCurrentGame = ev.id === gameId;
                                    const away = ev.competitors?.find((c: any) => c.homeAway === 'away');
                                    const home = ev.competitors?.find((c: any) => c.homeAway === 'home');
                                    
                                    const awayScore = away?.score;
                                    const homeScore = home?.score;
                                    
                                    const isFinal = ev.statusType?.completed;
                                    const statusDisplay = ev.statusType?.shortDetail;
                                    
                                    const isAwayWinner = away?.winner;
                                    const isHomeWinner = home?.winner;
                                    
                                    const gameDate = new Date(ev.date);
                                    const dateStr = gameDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
                                    
                                    return (
                                        <Link 
                                            to={`/games/${ev.id}`} 
                                            key={idx} 
                                            className={`flex items-center gap-2 p-2 rounded transition-colors group ${isCurrentGame ? 'bg-indigo-50/50 border border-indigo-200' : 'bg-slate-50 border border-slate-100 hover:bg-slate-100'}`}
                                        >
                                            <div className="flex-1 flex flex-col gap-1.5 justify-center pr-3">
                                                <div className="flex justify-between items-center w-full text-slate-700">
                                                    <div className="flex items-center gap-2">
                                                        <SafeImage src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${away?.team?.abbreviation?.toLowerCase()}.png`} className="w-4 h-4 object-contain" hideOnError />
                                                        <span className={`font-bold ${isFinal && !isAwayWinner ? 'text-slate-400 font-medium' : (isCurrentGame ? 'text-indigo-700' : '')}`}>{away?.team?.abbreviation}</span>
                                                    </div>
                                                    <span className={`font-black ${isFinal && !isAwayWinner ? 'text-slate-400 font-medium' : (isCurrentGame ? 'text-indigo-700' : '')}`}>{isFinal ? awayScore : ''}</span>
                                                </div>
                                                <div className="flex justify-between items-center w-full text-slate-700">
                                                    <div className="flex items-center gap-2">
                                                        <SafeImage src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${home?.team?.abbreviation?.toLowerCase()}.png`} className="w-4 h-4 object-contain" hideOnError />
                                                        <span className={`font-bold ${isFinal && !isHomeWinner ? 'text-slate-400 font-medium' : (isCurrentGame ? 'text-indigo-700' : '')}`}>{home?.team?.abbreviation}</span>
                                                    </div>
                                                    <span className={`font-black ${isFinal && !isHomeWinner ? 'text-slate-400 font-medium' : (isCurrentGame ? 'text-indigo-700' : '')}`}>{isFinal ? homeScore : ''}</span>
                                                </div>
                                            </div>
                                            <div className={`shrink-0 w-16 flex flex-col justify-center items-end text-right gap-0.5 text-[9px] font-bold uppercase tracking-widest border-l pl-3 ${isCurrentGame ? 'border-indigo-200 text-indigo-500' : 'border-slate-200 text-slate-400'}`}>
                                                <span>Game {idx + 1}</span>
                                                <span>{dateStr}</span>
                                                <span className={`mt-0.5 ${isFinal ? (isCurrentGame ? 'text-indigo-700' : 'text-slate-600') : ''}`}>{statusDisplay}</span>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}

                {/* Standings */}
                {data.standings?.groups?.map((group: any, gIdx: number) => (
                    <div key={gIdx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
                            <span className="font-black text-xs uppercase tracking-widest">{group.header || "Division Standings"}</span>
                        </div>
                        <table className="w-full text-xs text-right">
                            <thead className="bg-slate-50 text-[9px] uppercase tracking-widest text-slate-400 font-black border-b border-slate-100">
                                <tr>
                                    <th className="text-left py-2 px-4">Team</th>
                                    <th className="py-2 px-2">W</th>
                                    <th className="py-2 px-2">L</th>
                                    <th className="py-2 px-2">PCT</th>
                                    <th className="py-2 px-3">GB</th>
                                    <th className="py-2 px-4">STRK</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 font-medium text-slate-600">
                                {group.standings?.entries?.map((entry: any, i: number) => {
                                    const isTeamInGame = entry.id === awayTeam?.team?.id || entry.id === homeTeam?.team?.id;
                                    const getStat = (name: string) => entry.stats?.find((s: any) => s.name === name)?.displayValue || '-';
                                    
                                    return (
                                        <tr key={i} className={`hover:bg-slate-50 transition-colors ${isTeamInGame ? 'bg-indigo-50/20' : ''}`}>
                                            <td className="py-2.5 px-4 text-left flex items-center gap-2">
                                                <SafeImage src={entry.logo?.[0]?.href || `https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${entry.id}.png`} className="w-4 h-4 object-contain" hideOnError />
                                                <Link to={`/teams/${entry.id}`} className={`font-bold hover:underline ${isTeamInGame ? 'text-indigo-700' : 'text-blue-600'}`}>
                                                    {entry.team}
                                                </Link>
                                            </td>
                                            <td className={`py-2.5 px-2 ${isTeamInGame ? 'font-bold text-slate-800' : ''}`}>{getStat('wins')}</td>
                                            <td className={`py-2.5 px-2 ${isTeamInGame ? 'font-bold text-slate-800' : ''}`}>{getStat('losses')}</td>
                                            <td className={`py-2.5 px-2 ${isTeamInGame ? 'font-bold text-slate-800' : ''}`}>{getStat('winPercent')}</td>
                                            <td className={`py-2.5 px-3 ${isTeamInGame ? 'font-bold text-slate-800' : ''}`}>{getStat('gamesBehind')}</td>
                                            <td className={`py-2.5 px-4 ${isTeamInGame ? 'font-bold text-slate-800' : ''}`}>{getStat('streak')}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="p-3 text-center border-t border-slate-100 bg-slate-50">
                            {data.standings?.fullViewLink?.href ? (
                                <a href={data.standings.fullViewLink.href} target="_blank" rel="noreferrer" className="text-blue-600 text-xs font-bold hover:underline">
                                    Full Standings
                                </a>
                            ) : (
                                <button className="text-blue-600 text-xs font-bold hover:underline">Full Standings</button>
                            )}
                        </div>
                    </div>
                ))}

            </div>
        </div>
    );
};