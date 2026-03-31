import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchPlayerGameLogs, fetchPlayerPropsAvailable } from '../api';
import { TrendingUp, ArrowLeft, BarChart2 } from 'lucide-react';

export const PropAnalysisPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const initialPlayerId = searchParams.get('playerId') || '';
    const initialPropType = searchParams.get('propType') || 'Total Bases';
    const initialPropLine = searchParams.get('propLine') || '1.5';

    const [playerId, setPlayerId] = useState(initialPlayerId);
    const [propType, setPropType] = useState(initialPropType);
    const [propLine, setPropLine] = useState(initialPropLine);

    const [player, setPlayer] = useState<any>(null);
    const [gameLogs, setGameLogs] = useState<any[]>([]);
    const [availableProps, setAvailableProps] = useState<{type: string, line: string}[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!playerId) return;
        const loadData = async () => {
            setLoading(true);
            try {
                const year = new Date().getFullYear();
                
                // Fetch player data from ESPN
                const espnBaseRes = await fetch(`https://site.web.api.espn.com/apis/common/v3/sports/baseball/mlb/athletes/${playerId}`);
                let profileData = null;
                if (espnBaseRes.ok) {
                    const espnData = await espnBaseRes.json();
                    profileData = {
                        full_name: espnData.athlete?.displayName || '',
                        team_name: espnData.athlete?.team?.displayName || 'Free Agent',
                        position: espnData.athlete?.position?.displayName || '',
                        headshot: espnData.athlete?.headshot?.href || ''
                    };
                }

                const [logsData, propsData] = await Promise.all([
                    fetchPlayerGameLogs(parseInt(playerId), year),
                    fetchPlayerPropsAvailable(parseInt(playerId))
                ]);
                
                if (profileData) {
                    setPlayer(profileData);
                }
                
                // Clean and sort the available props so they match the expected format
                // the database may contain raw ones we filter out in the UI like "milestones"
                const cleanedProps = propsData
                    .filter((p: any) => !p.prop_type.toLowerCase().includes('milestones') && p.prop_type.toLowerCase() !== 'to record win')
                    .map((p: any) => ({ type: p.prop_type, line: p.prop_line }))
                    .sort((a: any, b: any) => a.type.localeCompare(b.type));
                    
                setAvailableProps(cleanedProps.length > 0 ? cleanedProps : [{ type: propType, line: propLine }]);
                
                // Determine if pitching or batting prop
                const p = propType.toLowerCase();
                const isPitching = (p.includes('strikeout') && !p.includes('batter')) || p.includes('out') || p.includes('allow') || p.includes('earned run') || p.includes('win');
                
                let activeLogs = isPitching ? (logsData.pitching || []) : (logsData.batting || []);
                activeLogs = activeLogs.filter((l: any) => {
                    if (isPitching) return parseFloat(l.ip || '0') > 0;
                    return (l.ab && parseInt(l.ab) > 0) || (l.pitches_faced && parseInt(l.pitches_faced) > 0);
                });
                
                setGameLogs(activeLogs);
            } catch (e) {
                console.error(e);
            }
            setLoading(false);
        };
        loadData();
    }, [playerId, propType]);

    // Update URL params when state changes
    useEffect(() => {
        const params = new URLSearchParams();
        if (playerId) params.set('playerId', playerId);
        if (propType) params.set('propType', propType);
        if (propLine) params.set('propLine', propLine);
        setSearchParams(params, { replace: true });
    }, [playerId, propType, propLine, setSearchParams]);

    const getStatValueFromLog = (log: any, pType: string) => {
        const p = pType.toLowerCase().trim();
        
        if (log.ip !== undefined) {
            if (p === 'total strikeouts' || p === 'strikeouts') return parseInt(log.k || '0');
            if (p === 'total outs recorded' || p === 'outs recorded') {
                 const ipStr = String(log.ip || '0');
                 const parts = ipStr.split('.');
                 const full = parseInt(parts[0]) || 0;
                 const part = parseInt(parts[1]) || 0;
                 return (full * 3) + part;
            }
            if (p === 'total hits allowed' || p === 'hits allowed') return parseInt(log.h || '0');
            if (p === 'total walks allowed' || p === 'walks allowed') return parseInt(log.bb || '0');
            if (p === 'earned runs allowed') return parseInt(log.er || '0');
            if (p === 'total runs allowed' || p === 'runs allowed') return parseInt(log.r || '0');
            if (p === 'total home runs allowed') return parseInt(log.hr || '0');
            if (p === 'to record win') return log.recorded_win ? 1 : 0;
            return null;
        }
        
        if (log.ab !== undefined) {
            const h = parseInt(log.h || '0');
            const r = parseInt(log.r || '0');
            const rbi = parseInt(log.rbi || '0');
            const hr = parseInt(log.hr || '0');
            const bb = parseInt(log.bb || '0');
            const k = parseInt(log.k || '0');
            const sb = parseInt(log.sb || '0');
            const d = parseInt(log['d'] || log['2b'] || log.doubles || '0');
            const t = parseInt(log['t'] || log['3b'] || log.triples || '0');
            
            const singles = log.singles !== undefined ? parseInt(log.singles) : (h - d - t - hr);
            const tb = singles + (d * 2) + (t * 3) + (hr * 4);

            if (p === 'total home runs' || p === 'home runs milestones') return hr;
            if (p === 'total hits' || p === 'hits milestones') return h;
            if (p === 'total rbis' || p === 'rbis milestones') return rbi;
            if (p === 'total runs scored' || p === 'runs milestones') return r;
            if (p === 'total hits + runs + rbis' || p === 'hits + runs + rbis milestones') return h + r + rbi;
            if (p === 'total walks (batter)' || p === 'walks (batter) milestones') return bb;
            if (p === 'strikeouts (batter) milestones' || p === 'total strikeouts (batter)') return k;
            
            if (p === 'doubles milestones' || p === 'total doubles' || p === 'total doubles hit') return d;
            if (p === 'singles milestones' || p === 'total singles' || p === 'total singles hit') return singles;
            if (p === 'stolen bases milestones' || p === 'total stolen bases') return sb;
            if (p === 'total bases milestones' || p === 'total bases') return tb;

            return null;
        }
        return null;
    };

    // Calculate hit rates
    let target = parseFloat(String(propLine).replace('+', ''));
    let isPlus = String(propLine).includes('+');

    const last10 = gameLogs.slice(0, 10);
    const last15 = gameLogs.slice(0, 15);

    const calculateHitRate = (logs: any[]) => {
        if (!logs.length) return { hits: 0, total: 0 };
        let hits = 0;
        let valid = 0;
        logs.forEach(l => {
            const val = getStatValueFromLog(l, propType);
            if (val !== null) {
                valid++;
                if (propType.toLowerCase() === 'to record win') {
                    if (val === 1) hits++;
                } else if (!isNaN(target)) {
                    if (isPlus) {
                        if (val >= target) hits++;
                    } else {
                        if (val > target) hits++;
                    }
                }
            }
        });
        return { hits, total: valid };
    };

    const l10Stats = calculateHitRate(last10);
    const l15Stats = calculateHitRate(last15);
    
    const commonProps = [
        "Total Bases", "Total Hits", "Total Home Runs", "Total RBIs", "Total Runs Scored",
        "Total Strikeouts", "Total Outs Recorded", "Earned Runs Allowed", "Total Hits Allowed",
        "Total Hits + Runs + RBIs"
    ];

    if (!playerId) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-slate-500 font-bold">
                    Please select a player from the Props page to view analysis.
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
            <div className="flex items-center gap-4 mb-2">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="bg-primary/10 p-3 rounded-2xl">
                    <BarChart2 className="w-8 h-8 text-primary" />
                </div>
                <div className="flex flex-col">
                    <h1 className="font-headline font-black text-3xl uppercase tracking-widest text-slate-800">Prop Analysis</h1>
                    <p className="text-slate-500 font-medium">Player performance trends against specific prop lines.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center gap-8">
                    {/* Player Info */}
                    <div className="flex items-center gap-4 min-w-[250px]">
                        <div className="w-16 h-16 rounded-full bg-slate-100 overflow-hidden border-2 border-slate-200 flex-shrink-0">
                            {player?.headshot ? (
                                <img src={player.headshot} alt={player?.full_name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-xl">
                                    {player?.full_name?.charAt(0) || '?'}
                                </div>
                            )}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">{player?.full_name || 'Loading...'}</h2>
                            <p className="text-sm font-medium text-slate-500">{player?.team_name || ''} • {player?.position || ''}</p>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-wrap gap-4 w-full md:w-auto">
                        <div className="flex flex-col flex-1 min-w-[200px]">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Prop Type</label>
                            <select 
                                className="text-sm border border-slate-200 rounded-lg p-2.5 outline-none font-bold text-primary bg-slate-50 focus:border-primary transition-colors"
                                value={propType}
                                onChange={(e) => {
                                    const newType = e.target.value;
                                    setPropType(newType);
                                    const found = availableProps.find(p => p.type === newType);
                                    if (found) {
                                        setPropLine(found.line);
                                    }
                                }}
                            >
                                <option value={propType}>{propType}</option>
                                {availableProps.filter(p => p.type !== propType).map(p => (
                                    <option key={p.type} value={p.type}>{p.type}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="flex flex-col w-32">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Line</label>
                            <input 
                                type="text"
                                className="text-sm border border-slate-200 rounded-lg p-2.5 outline-none font-bold text-primary bg-slate-50 focus:border-primary transition-colors text-center"
                                value={propLine}
                                onChange={(e) => setPropLine(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="bg-slate-50 p-6 flex gap-8 border-b border-slate-200">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Last 10 Games</p>
                        <p className="text-3xl font-black font-headline text-primary">
                            {l10Stats.hits} <span className="text-lg text-slate-400">/ {l10Stats.total}</span>
                        </p>
                        <p className={`text-xs font-bold mt-1 ${l10Stats.hits >= l10Stats.total * 0.6 ? 'text-emerald-600' : l10Stats.hits <= l10Stats.total * 0.4 ? 'text-rose-600' : 'text-slate-500'}`}>
                            {l10Stats.total > 0 ? Math.round((l10Stats.hits / l10Stats.total) * 100) : 0}% OVER
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Last 15 Games</p>
                        <p className="text-3xl font-black font-headline text-primary">
                            {l15Stats.hits} <span className="text-lg text-slate-400">/ {l15Stats.total}</span>
                        </p>
                        <p className={`text-xs font-bold mt-1 ${l15Stats.hits >= l15Stats.total * 0.6 ? 'text-emerald-600' : l15Stats.hits <= l15Stats.total * 0.4 ? 'text-rose-600' : 'text-slate-500'}`}>
                            {l15Stats.total > 0 ? Math.round((l15Stats.hits / l15Stats.total) * 100) : 0}% OVER
                        </p>
                    </div>
                </div>

                {/* Game Logs Table */}
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-12 text-center text-slate-500 font-bold">Loading game logs...</div>
                    ) : (
                        <table className="w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                                <tr className="bg-white border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                    <th className="p-4">Date</th>
                                    <th className="p-4">Opponent</th>
                                    <th className="p-4 text-center">Result</th>
                                    <th className="p-4 text-right">Prop Result</th>
                                    <th className="p-4 text-right">Value</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {gameLogs.slice(0, 15).map((log, idx) => {
                                    const val = getStatValueFromLog(log, propType);
                                    let isOver = false;
                                    
                                    if (propType.toLowerCase() === 'to record win') {
                                        isOver = val === 1;
                                    } else if (!isNaN(target) && val !== null) {
                                        isOver = isPlus ? val >= target : val > target;
                                    }

                                    const logDate = log.date || '';
                                    const dateObj = new Date(logDate.endsWith('Z') ? logDate : `${logDate}Z`);
                                    const dateStr = logDate ? dateObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) : 'Unknown';
                                    
                                    // Parse opponent from log if possible, otherwise generic
                                    let opponent = 'Opponent';
                                    if (log.opponent_abbrev) {
                                        opponent = `${log.home_away === 'home' ? 'vs' : '@'} ${log.opponent_abbrev}`;
                                    }

                                    return (
                                        <tr 
                                            key={idx} 
                                            className="hover:bg-slate-50 transition-colors cursor-pointer"
                                            onClick={() => navigate(`/games/${log.event_id}`)}
                                        >
                                            <td className="p-4 font-medium text-slate-600">{dateStr}</td>
                                            <td className="p-4 font-bold text-slate-700">{opponent}</td>
                                            <td className="p-4 text-center">
                                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${log.team_score > log.opponent_score ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {log.team_score > log.opponent_score ? 'W' : 'L'} {log.team_score}-{log.opponent_score}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                {val === null ? (
                                                    <span className="text-slate-400 font-bold">N/A</span>
                                                ) : (
                                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${isOver ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                        {isOver ? 'OVER' : 'UNDER'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right font-black text-slate-800 text-lg">
                                                {val !== null ? val : '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {gameLogs.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center font-bold text-slate-500">No recent game logs found for this player.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
