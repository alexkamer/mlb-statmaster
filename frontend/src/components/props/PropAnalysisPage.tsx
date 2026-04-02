import { SafeImage } from '../shared/SafeImage';
import { PlayerTrendTab } from './PlayerTrendTab';
import { OpponentHistoryTab } from './OpponentHistoryTab';
import { OpponentSplitTab } from './OpponentSplitTab';
import { OpponentBattingSplitsTab } from './OpponentBattingSplitsTab';
import { BvpTab } from './BvpTab';
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchPlayerGameLogs, fetchPlayerPropsAvailable, fetchOpponentStarters, fetchOpponentBatters, fetchOpponentBattingSplits, fetchGameSummary, fetchBvpStats } from '../../api';
import { TrendingUp, ArrowLeft, BarChart2, Trophy, LayoutList, BarChart3, Swords } from 'lucide-react';
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

export const PropAnalysisPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const initialPlayerId = searchParams.get('playerId') || '';
    const initialPropType = searchParams.get('propType') || 'Total Bases';
    const initialPropLine = searchParams.get('propLine') || '1.5';
    const initialViewLimit = parseInt(searchParams.get('limit') || '20');
    const initialViewMode = (searchParams.get('view') as 'table' | 'chart') || 'table';
    const initialHand = searchParams.get('hand') || 'all';
    const initialOpponentId = searchParams.get('opponentId') || null;
    const initialOpponentAbbrev = searchParams.get('opponentAbbrev') || '';
    const initialIsHome = searchParams.get('isHome') === 'true';
    const initialGameId = searchParams.get('gameId') || null;
    const [opponentDataMode, setOpponentDataMode] = useState(false);
    const [opponentLogs, setOpponentLogs] = useState<any[]>([]);
    const [opponentSplitDataMode, setOpponentSplitDataMode] = useState(false);
    const [splitOuts, setSplitOuts] = useState<number>(18);
    const [opponentSplitLogs, setOpponentSplitLogs] = useState<any[]>([]);
    const [positionFilter, setPositionFilter] = useState<string>('all');
    const [bvpData, setBvpData] = useState<any>(null);
    const [opposingPitcher, setOpposingPitcher] = useState<any>(null);



    const [playerId, setPlayerId] = useState(initialPlayerId);
    const [propType, setPropType] = useState(initialPropType);
    const [propLine, setPropLine] = useState(initialPropLine);
    const [viewLimit, setViewLimit] = useState(initialViewLimit);
    const [viewMode, setViewMode] = useState<'table' | 'chart'>(initialViewMode);
    const [pitcherHandFilter, setPitcherHandFilter] = useState(initialHand);

    const pName = propType.toLowerCase().trim();
    const isPitching = (pName.includes('strikeout') && !pName.includes('batter')) || pName.includes('out') || pName.includes('allow') || pName.includes('earned run') || pName.includes('win');


    const [player, setPlayer] = useState<any>(null);
    const [gameLogs, setGameLogs] = useState<any[]>([]);
    const [availableProps, setAvailableProps] = useState<{type: string, line: string}[]>([]);
    const [expectedOuts, setExpectedOuts] = useState<number | null>(null);

    const [loading, setLoading] = useState(false);

    // Filters
    const [homeAwayFilter, setHomeAwayFilter] = useState('all');
    const [oddsFilter, setOddsFilter] = useState('all');
    const [restFilter, setRestFilter] = useState('all');

    useEffect(() => {
        if (player?.shortName || player?.displayName || player?.full_name) {
            document.title = `${player.shortName || player.displayName || player.full_name} ${propType} | Prop Analysis`;
        } else {
            document.title = "Prop Analysis | MLB Statmaster";
        }
        return () => { document.title = "MLB Statmaster"; };
    }, [player, propType]);

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
                    fetchPlayerGameLogs(parseInt(playerId), year, 100), // Fetch a larger pool for the slider
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
                // Identify Expected Outs
                const outsProp = propsData.find((p: any) => p.prop_type.toLowerCase() === 'outs recorded' || p.prop_type.toLowerCase() === 'pitching outs');
                if (outsProp) {
                    setExpectedOuts(parseFloat(outsProp.prop_line));
                } else {
                    setExpectedOuts(null);
                }

                // Fetch Opponent Context if opponentId is provided
                if (initialOpponentId && initialOpponentId !== "undefined" && initialOpponentId !== "null") {
                    const opId = parseInt(initialOpponentId);
                    if (!isNaN(opId)) {
                        if (isPitching) {
                            const starters = await fetchOpponentStarters(opId, year);
                            setOpponentLogs(starters);
                            
                            const splits = await fetchOpponentBattingSplits(opId, 18, year);
                            setOpponentSplitLogs(splits);
                            setSplitOuts(18);
                        } else {
                            const batters = await fetchOpponentBatters(opId, year);
                            setOpponentLogs(batters);
                            
                            // Check for gameId and specific opposing pitcher context
                            if (initialGameId) {
                                const gameSummary = await fetchGameSummary(initialGameId);
                                if (gameSummary && gameSummary.boxscore && gameSummary.rosters) {
                                    // Identify opposing pitcher
                                    const awayTeamId = gameSummary.boxscore.teams[0].team.id;
                                    const homeTeamId = gameSummary.boxscore.teams[1].team.id;
                                    const opposingTeamId = initialIsHome ? awayTeamId : homeTeamId;
                                    
                                    // Find probable pitchers
                                    const opposingTeamRoster = gameSummary.rosters.find((r: any) => r.team.id === opposingTeamId);
                                    if (opposingTeamRoster && gameSummary.header?.competitions?.[0]?.competitors) {
                                        const competitor = gameSummary.header.competitions[0].competitors.find((c: any) => c.team.id === opposingTeamId);
                                        if (competitor && competitor.probables && competitor.probables.length > 0) {
                                            const pId = competitor.probables[0].athlete.id;
                                            const pName = competitor.probables[0].athlete.displayName;
                                            setOpposingPitcher({ id: pId, name: pName });
                                            
                                            // Fetch BvP
                                            const bvp = await fetchBvpStats(initialPlayerId, pId);
                                            if (bvp && Object.keys(bvp).length > 0) {
                                                setBvpData(bvp);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                
                let activeLogs = isPitching ? (logsData.pitching || []) : (logsData.batting || []);
                activeLogs = activeLogs.filter((l: any) => {
                    // Exclude today's game from historical context
                    if (initialGameId && String(l.event_id) === String(initialGameId)) return false;
                    
                    if (isPitching) return parseFloat(l.ip || '0') > 0;
                    return (l.ab && parseInt(l.ab) > 0) || (l.pitches_faced && parseInt(l.pitches_faced) > 0);
                });
                
                // Calculate rest days
                const logsWithRest = activeLogs.map((log: any, index: number) => {
                    if (index === activeLogs.length - 1) return { ...log, restDays: null };
                    const currentDate = new Date(log.date);
                    const prevDate = new Date(activeLogs[index + 1].date);
                    const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    return { ...log, restDays: diffDays };
                });

                setGameLogs(logsWithRest);
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
        if (viewLimit) params.set('limit', viewLimit.toString());
        if (viewMode) params.set('view', viewMode);
        if (pitcherHandFilter !== 'all') params.set('hand', pitcherHandFilter);
        
        // Preserve opponent context
        if (initialOpponentId) params.set('opponentId', initialOpponentId);
        if (initialOpponentAbbrev) params.set('opponentAbbrev', initialOpponentAbbrev);
        if (searchParams.get('isHome') !== null) params.set('isHome', searchParams.get('isHome')!);
        
        setSearchParams(params, { replace: true });
    }, [playerId, propType, propLine, viewLimit, viewMode, pitcherHandFilter, setSearchParams]);

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

    const filteredLogs = gameLogs.filter(log => {
        if (homeAwayFilter !== 'all' && log.home_away !== homeAwayFilter) return false;
        if (pitcherHandFilter !== 'all' && log.opp_starter_throws !== pitcherHandFilter) return false;
        if (oddsFilter !== 'all') {
            const moneyLine = parseFloat(log.team_money_line);
            if (isNaN(moneyLine)) return false;
            if (oddsFilter === 'favored' && moneyLine >= 0) return false;
            if (oddsFilter === 'underdog' && moneyLine < 0) return false;
        }
        if (restFilter !== 'all') {
            if (log.restDays === null) return false;
            if (restFilter === '4+' && log.restDays < 4) return false;
            if (restFilter !== '4+' && log.restDays !== parseInt(restFilter)) return false;
        }
        return true;
    });

    const activeViewLimit = Math.min(viewLimit, filteredLogs.length || 1);
    const viewLogs = filteredLogs.slice(0, activeViewLimit);

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

    const currentStats = calculateHitRate(viewLogs);
    const allFilteredStats = calculateHitRate(filteredLogs);
    
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

            {/* Head-to-Head Banner (If BvP exists) */}
            {!isPitching && bvpData && bvpData.g > 0 && opposingPitcher && (
                <div className="bg-slate-900 rounded-xl shadow-lg overflow-hidden mb-6 flex flex-col sm:flex-row items-center justify-between p-1">
                    <div className="flex items-center gap-3 px-5 py-3">
                        <div className="bg-rose-500/20 p-2 rounded-full">
                            <Swords className="w-5 h-5 text-rose-400" />
                        </div>
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Head to Head Matchup</div>
                            <div className="text-white font-bold text-sm">vs. {opposingPitcher.name}</div>
                        </div>
                    </div>
                    <div className="flex divide-x divide-slate-800 bg-slate-800/50 rounded-lg mr-1 py-1">
                        <div className="px-4 py-2 text-center">
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">At Bats</div>
                            <div className="text-white font-bold">{bvpData.ab}</div>
                        </div>
                        <div className="px-4 py-2 text-center">
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Hits</div>
                            <div className="text-emerald-400 font-bold">{bvpData.h}</div>
                        </div>
                        <div className="px-4 py-2 text-center">
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">HR</div>
                            <div className="text-rose-400 font-bold">{bvpData.hr}</div>
                        </div>
                        <div className="px-4 py-2 text-center">
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">AVG</div>
                            <div className="text-white font-bold">{bvpData.avg.toFixed(3).replace('0.', '.')}</div>
                        </div>
                        <div className="px-4 py-2 text-center">
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">OPS</div>
                            <div className="text-amber-400 font-bold">{(bvpData.obp + bvpData.slg).toFixed(3).replace('0.', '.')}</div>
                        </div>
                    </div>
                </div>
            )}


            {initialOpponentId && initialOpponentId !== 'undefined' && initialOpponentId !== 'null' && (
                <div className="flex items-center gap-2 mb-2 border-b border-slate-200 pb-2">
                    <button 
                        onClick={() => { setOpponentDataMode(false); setOpponentSplitDataMode(false); }}
                        className={`px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-t-lg transition-colors ${!opponentDataMode && !opponentSplitDataMode ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                        Player Trends
                    </button>
                    <button 
                        onClick={() => { setOpponentDataMode(true); setOpponentSplitDataMode(false); }}
                        className={`px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-t-lg transition-colors ${opponentDataMode && !opponentSplitDataMode ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                        Vs. {initialOpponentAbbrev}
                    </button>
                    {isPitching && (
                        <button 
                            onClick={() => { setOpponentDataMode(false); setOpponentSplitDataMode(true); }}
                            className={`px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-t-lg transition-colors ${opponentSplitDataMode ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                            {initialOpponentAbbrev} Splits
                        </button>
                    )}
                </div>
            )}


            {opponentSplitDataMode && isPitching ? (
                <OpponentBattingSplitsTab 
                    propType={propType}
                    propLine={propLine}
                    opponentSplitLogs={opponentSplitLogs}
                    initialIsHome={initialIsHome}
                    splitOuts={splitOuts}
                    setSplitOuts={setSplitOuts}
                    initialOpponentId={initialOpponentId}
                    initialOpponentAbbrev={initialOpponentAbbrev}
                    fetchOpponentBattingSplits={fetchOpponentBattingSplits}
                    setOpponentSplitLogs={setOpponentSplitLogs}
                />
            ) : opponentDataMode ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 bg-slate-50">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">
                                    <span className="text-emerald-600">{propType}</span> vs {initialOpponentAbbrev}
                                </h2>
                                <p className="text-sm text-slate-500 font-medium mt-1">
                                    Analyzing historical {propType} by opposing {isPitching ? 'Starting Pitchers' : (positionFilter !== 'all' ? positionFilter + 's' : 'Starting Batters')} against {initialOpponentAbbrev}.
                                </p>
                            </div>
                            
                            {!isPitching && (
                                <div className="flex bg-white rounded-md border border-slate-200 p-1 shadow-sm w-fit">
                                    <button 
                                        onClick={() => setPositionFilter('all')}
                                        className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ${positionFilter === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        All Batters
                                    </button>
                                    <button 
                                        onClick={() => {
                                            const getAbbrev = (pos: string) => {
                                                const p = pos.toLowerCase();
                                                if (p.includes('shortstop')) return 'SS';
                                                if (p.includes('first base')) return '1B';
                                                if (p.includes('second base')) return '2B';
                                                if (p.includes('third base')) return '3B';
                                                if (p.includes('catcher')) return 'C';
                                                if (p.includes('left field')) return 'LF';
                                                if (p.includes('center field')) return 'CF';
                                                if (p.includes('right field')) return 'RF';
                                                if (p.includes('designated hitter')) return 'DH';
                                                if (p.includes('pitcher')) return 'P';
                                                return '';
                                            };
                                            setPositionFilter(getAbbrev(player?.position || ''));
                                        }}
                                        className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ${positionFilter !== 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        disabled={!player?.position}
                                    >
                                        Only {(() => {
                                            const getAbbrev = (pos: string) => {
                                                const p = pos.toLowerCase();
                                                if (p.includes('shortstop')) return 'SS';
                                                if (p.includes('first base')) return '1B';
                                                if (p.includes('second base')) return '2B';
                                                if (p.includes('third base')) return '3B';
                                                if (p.includes('catcher')) return 'C';
                                                if (p.includes('left field')) return 'LF';
                                                if (p.includes('center field')) return 'CF';
                                                if (p.includes('right field')) return 'RF';
                                                if (p.includes('designated hitter')) return 'DH';
                                                if (p.includes('pitcher')) return 'P';
                                                return '';
                                            };
                                            return getAbbrev(player?.position || '') || 'Same Pos';
                                        })()}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-6">
                        {(() => {
                            const p = propType.toLowerCase();
                            
                            // Apply position filter if batter
                            const filteredLogs = (!isPitching && positionFilter !== 'all') 
                                ? opponentLogs.filter(log => log.position === positionFilter)
                                : opponentLogs;

                            // Map logs to values
                            const values = filteredLogs.map(log => {
                                let val = 0;
                                if (isPitching) {
                                    if (p === 'total strikeouts' || p === 'strikeouts') val = parseInt(log.k || '0');
                                    if (p === 'total outs recorded' || p === 'outs recorded') {
                                         const ipStr = String(log.ip || '0');
                                         const parts = ipStr.split('.');
                                         val = (parseInt(parts[0]) || 0) * 3 + (parseInt(parts[1]) || 0);
                                    }
                                    if (p === 'total hits allowed' || p === 'hits allowed') val = parseInt(log.h || '0');
                                    if (p === 'total walks allowed' || p === 'walks allowed') val = parseInt(log.bb || '0');
                                    if (p === 'earned runs allowed') val = parseInt(log.er || '0');
                                    if (p === 'total runs allowed' || p === 'runs allowed') val = parseInt(log.r || '0');
                                    if (p === 'total home runs allowed') val = parseInt(log.hr || '0');
                                } else {
                                    const h = parseInt(log.h || '0');
                                    const r = parseInt(log.r || '0');
                                    const rbi = parseInt(log.rbi || '0');
                                    const hr = parseInt(log.hr || '0');
                                    const bb = parseInt(log.bb || '0');
                                    const k = parseInt(log.k || '0');
                                    const sb = parseInt(log.sb || '0');
                                    const d = parseInt(log.d || '0');
                                    const t = parseInt(log.t || '0');
                                    const singles = parseInt(log.singles || '0');
                                    const tb = singles + (d * 2) + (t * 3) + (hr * 4);

                                    if (p === 'total home runs' || p === 'home runs milestones') val = hr;
                                    if (p === 'total hits' || p === 'hits milestones') val = h;
                                    if (p === 'total rbis' || p === 'rbis milestones') val = rbi;
                                    if (p === 'total runs scored' || p === 'runs milestones') val = r;
                                    if (p === 'total hits + runs + rbis' || p === 'hits + runs + rbis milestones') val = h + r + rbi;
                                    if (p === 'total walks (batter)' || p === 'walks (batter) milestones') val = bb;
                                    if (p === 'strikeouts (batter) milestones' || p === 'total strikeouts (batter)') val = k;
                                    if (p === 'doubles milestones' || p === 'total doubles' || p === 'total doubles hit') val = d;
                                    if (p === 'singles milestones' || p === 'total singles' || p === 'total singles hit') val = singles;
                                    if (p === 'stolen bases milestones' || p === 'total stolen bases') val = sb;
                                    if (p === 'total bases milestones' || p === 'total bases') val = tb;
                                }
                                return { ...log, val };
                            });

                            const target = parseFloat(String(propLine).replace('+', ''));
                            const isPlus = String(propLine).includes('+');

                            const hits = values.filter(v => isPlus ? v.val >= target : v.val > target).length;
                            const total = values.length;
                            const hitRate = total > 0 ? Math.round((hits / total) * 100) : 0;
                            const avg = total > 0 ? (values.reduce((sum, v) => sum + v.val, 0) / total).toFixed(2) : '0';

                            // Split by upcoming location
                            // If player isHome, then opponent is Away
                            const expectedOpponentLocation = initialIsHome ? 'away' : 'home';
                            const splitValues = values.filter(v => v.opponent_home_away === expectedOpponentLocation);
                            const splitHits = splitValues.filter(v => isPlus ? v.val >= target : v.val > target).length;
                            const splitTotal = splitValues.length;
                            const splitHitRate = splitTotal > 0 ? Math.round((splitHits / splitTotal) * 100) : 0;
                            const splitAvg = splitTotal > 0 ? (splitValues.reduce((sum, v) => sum + v.val, 0) / splitTotal).toFixed(2) : '0';
                            
                            // Projection for Pitchers based on Outs
                            let expectedProj = null;
                            if (isPitching && expectedOuts && expectedOuts > 0) {
                                let totalStat = 0;
                                let totalOuts = 0;
                                values.forEach(v => {
                                    totalStat += v.val;
                                    const ipStr = String(v.ip || '0');
                                    const parts = ipStr.split('.');
                                    totalOuts += (parseInt(parts[0]) || 0) * 3 + (parseInt(parts[1]) || 0);
                                });
                                if (totalOuts > 0) {
                                    expectedProj = ((totalStat / totalOuts) * expectedOuts).toFixed(2);
                                }
                            }

                            return (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Opponent Hit Rate ({propLine})</p>
                                            <p className={`text-3xl font-black font-headline ${hitRate >= 60 ? 'text-emerald-600' : hitRate <= 40 ? 'text-rose-600' : 'text-slate-700'}`}>
                                                {hitRate}%
                                            </p>
                                            <p className="text-xs text-slate-400 font-medium mt-1">{hits} of {total} games</p>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Overall Average</p>
                                            <p className="text-3xl font-black font-headline text-slate-700">
                                                {avg}
                                            </p>
                                            <p className="text-xs text-slate-400 font-medium mt-1">Per {isPitching ? 'Starter' : 'Starter'}</p>
                                        </div>
                                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">{initialOpponentAbbrev} at {expectedOpponentLocation.toUpperCase()}</p>
                                            <p className="text-3xl font-black font-headline text-emerald-700">
                                                {splitAvg} <span className="text-sm text-emerald-600/70 font-bold">AVG</span>
                                            </p>
                                            <p className="text-xs text-emerald-600/70 font-bold mt-1">{splitHitRate}% Hit Rate ({splitHits}/{splitTotal})</p>
                                        </div>
                                        {isPitching && expectedOuts && (
                                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">Projected via {expectedOuts} Outs</p>
                                                <p className="text-3xl font-black font-headline text-indigo-700">
                                                    {expectedProj || '-'}
                                                </p>
                                                <p className="text-xs text-indigo-600/70 font-bold mt-1">Expected {propType}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Data Table */}
                                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-black tracking-wider">
                                                <tr>
                                                    <th className="p-4">Date</th>
                                                    <th className="p-4">{isPitching ? 'Pitcher' : 'Batter'}</th>
                                                    <th className="p-4 text-center">Game</th>
                                                    <th className="p-4 bg-emerald-50 text-emerald-700 text-center">{propType}</th>
                                                    {isPitching ? (
                                                        <>
                                                            <th className="p-4 text-center">IP</th>
                                                            <th className="p-4 text-center">K</th>
                                                            <th className="p-4 text-center">BB</th>
                                                            <th className="p-4 text-center">H</th>
                                                            <th className="p-4 text-center">ER</th>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <th className="p-4 text-center">AB</th>
                                                            <th className="p-4 text-center">H</th>
                                                            <th className="p-4 text-center">HR</th>
                                                            <th className="p-4 text-center">RBI</th>
                                                        </>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {values.slice(0, 30).map((v, i) => {
                                                    const isHit = isPlus ? v.val >= target : v.val > target;
                                                    return (
                                                        <tr key={i} className="hover:bg-slate-50">
                                                            <td className="p-4 text-slate-500 font-medium">{new Date(v.date).toLocaleDateString()}</td>
                                                            <td className="p-4 font-bold text-slate-700">
                                                                {isPitching ? v.pitcher_name : v.batter_name} <span className="text-xs text-slate-400 font-normal">({isPitching ? v.pitcher_team : v.batter_team})</span>
                                                            </td>
                                                            
                                                            <td className="p-4 text-center">
                                                                <div className="flex items-center justify-center gap-1.5 bg-slate-100 rounded-md px-2 py-1 mx-auto w-max">
                                                                    <img 
                                                                        src={`https://a.espncdn.com/i/teamlogos/mlb/500/${v.opponent_home_away === 'home' ? (isPitching ? v.pitcher_team_id : v.batter_team_id) : initialOpponentId}.png`}
                                                                        alt="Away"
                                                                        className="w-4 h-4 object-contain"
                                                                        onError={(e) => e.currentTarget.style.display = 'none'}
                                                                    />
                                                                    <span className="text-[10px] font-black text-slate-400">@</span>
                                                                    <img 
                                                                        src={`https://a.espncdn.com/i/teamlogos/mlb/500/${v.opponent_home_away === 'home' ? initialOpponentId : (isPitching ? v.pitcher_team_id : v.batter_team_id)}.png`}
                                                                        alt="Home"
                                                                        className="w-4 h-4 object-contain"
                                                                        onError={(e) => e.currentTarget.style.display = 'none'}
                                                                    />
                                                                </div>
                                                            </td>

                                                            <td className={`p-4 text-center font-black ${isHit ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                                                                {v.val}
                                                            </td>
                                                            {isPitching ? (
                                                                <>
                                                                    <td className="p-4 text-center text-slate-600">{v.ip}</td>
                                                                    <td className="p-4 text-center text-slate-600">{v.k}</td>
                                                                    <td className="p-4 text-center text-slate-600">{v.bb}</td>
                                                                    <td className="p-4 text-center text-slate-600">{v.h}</td>
                                                                    <td className="p-4 text-center text-slate-600">{v.er}</td>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <td className="p-4 text-center text-slate-600">{v.ab}</td>
                                                                    <td className="p-4 text-center text-slate-600">{v.h}</td>
                                                                    <td className="p-4 text-center text-slate-600">{v.hr}</td>
                                                                    <td className="p-4 text-center text-slate-600">{v.rbi}</td>
                                                                </>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            ) : (            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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

                {/* Filters Row */}
                <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-200 flex flex-wrap gap-x-8 gap-y-6">
                    <div className="flex flex-col flex-1 min-w-[200px]">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Sample Size</label>
                            <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded">
                                Last {activeViewLimit} {filteredLogs.length > 0 ? `of ${filteredLogs.length}` : ''} Games
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <input 
                                type="range"
                                min="1"
                                max={Math.max(1, filteredLogs.length)}
                                value={activeViewLimit}
                                onChange={(e) => setViewLimit(parseInt(e.target.value))}
                                className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">Venue</label>
                        <div className="flex bg-white rounded-lg border border-slate-200 p-0.5 shadow-sm">
                            {['all', 'home', 'away'].map(v => (
                                <button
                                    key={v}
                                    onClick={() => setHomeAwayFilter(v)}
                                    className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${homeAwayFilter === v ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">Vs. Pitcher Hand</label>
                        <div className="flex bg-white rounded-lg border border-slate-200 p-0.5 shadow-sm">
                            {['all', 'L', 'R'].map(v => (
                                <button
                                    key={v}
                                    onClick={() => setPitcherHandFilter(v)}
                                    className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${pitcherHandFilter === v ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {v === 'all' ? 'All' : `${v}HP`}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">Odds Status</label>
                        <div className="flex bg-white rounded-lg border border-slate-200 p-0.5 shadow-sm">
                            {['all', 'favored', 'underdog'].map(v => (
                                <button
                                    key={v}
                                    onClick={() => setOddsFilter(v)}
                                    className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${oddsFilter === v ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">Days Rest</label>
                        <div className="flex bg-white rounded-lg border border-slate-200 p-0.5 shadow-sm">
                            {['all', '0', '1', '2', '3', '4+'].map(v => (
                                <button
                                    key={v}
                                    onClick={() => setRestFilter(v)}
                                    className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${restFilter === v ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">View Mode</label>
                        <div className="flex bg-white rounded-lg border border-slate-200 p-0.5 shadow-sm">
                            <button
                                onClick={() => setViewMode('table')}
                                className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${viewMode === 'table' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <LayoutList className="w-3 h-3" />
                                Table
                            </button>
                            <button
                                onClick={() => setViewMode('chart')}
                                className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${viewMode === 'chart' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <BarChart3 className="w-3 h-3" />
                                Chart
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="bg-slate-50 p-6 flex gap-6 border-b border-slate-200">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Current Selection ({activeViewLimit}G)</p>
                        <p className="text-3xl font-black font-headline text-primary">
                            {currentStats.hits} <span className="text-lg text-slate-400">/ {currentStats.total}</span>
                        </p>
                        <p className={`text-xs font-bold mt-1 ${currentStats.hits >= currentStats.total * 0.6 ? 'text-emerald-600' : currentStats.hits <= currentStats.total * 0.4 ? 'text-rose-600' : 'text-slate-500'}`}>
                            {currentStats.total > 0 ? Math.round((currentStats.hits / currentStats.total) * 100) : 0}% OVER
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">All Filtered Matches</p>
                        <p className="text-3xl font-black font-headline text-primary">
                            {allFilteredStats.hits} <span className="text-lg text-slate-400">/ {allFilteredStats.total}</span>
                        </p>
                        <p className={`text-xs font-bold mt-1 ${allFilteredStats.hits >= allFilteredStats.total * 0.6 ? 'text-emerald-600' : allFilteredStats.hits <= allFilteredStats.total * 0.4 ? 'text-rose-600' : 'text-slate-500'}`}>
                            {allFilteredStats.total > 0 ? Math.round((allFilteredStats.hits / allFilteredStats.total) * 100) : 0}% OVER
                        </p>
                    </div>
                </div>

                {/* Game Logs Content */}
                <div className="overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-slate-500 font-bold">Loading game logs...</div>
                    ) : viewMode === 'chart' ? (
                        <div className="p-6 h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={viewLogs.slice().reverse().map(log => ({
                                        ...log,
                                        value: getStatValueFromLog(log, propType),
                                        displayDate: new Date(log.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })
                                    }))}
                                    margin={{ top: 20, right: 60, left: 0, bottom: 40 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="displayDate" 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={(props: any) => {
                                            const { x, y, payload, index } = props;
                                            const reversedLogs = viewLogs.slice().reverse();
                                            const log = reversedLogs[index];
                                            const prefix = log?.home_away === 'home' ? 'vs' : '@';
                                            return (
                                                <g transform={`translate(${x},${y})`}>
                                                    <text x={0} y={10} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight={700}>
                                                        {payload.value}
                                                    </text>
                                                    <text x={0} y={24} textAnchor="middle" fill="#94a3b8" fontSize={9} fontWeight={800}>
                                                        {log ? `${prefix} ${log.opponent_abbrev}` : ''}
                                                        {log?.opp_starter_throws ? ` (${log.opp_starter_throws})` : ''}
                                                    </text>
                                                </g>
                                            );
                                        }}
                                    />
                                    <YAxis 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                    />
                                    <RechartsTooltip 
                                        cursor={{ fill: '#f8fafc' }}
                                        content={({ active, payload }: any) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                const val = data.value;
                                                const isOver = isPlus ? val >= target : val > target;
                                                return (
                                                    <div className="bg-white p-3 rounded-lg shadow-xl border border-slate-200 min-w-[140px]">
                                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{data.displayDate} vs {data.opponent_abbrev}</p>
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-xs font-bold text-slate-600">{propType}</span>
                                                            <span className="text-sm font-black text-slate-900">{val}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-50">
                                                            <span className="text-[10px] font-bold text-slate-400">Line</span>
                                                            <span className="text-[10px] font-black text-slate-600">{propLine}</span>
                                                        </div>
                                                        <div className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded text-center ${isOver ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                            {isOver ? 'OVER' : 'UNDER'}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    {!isNaN(target) && (
                                        <ReferenceLine 
                                            y={target} 
                                            stroke="#64748b" 
                                            strokeDasharray="4 4" 
                                            strokeWidth={2}
                                            label={{ 
                                                position: 'right', 
                                                value: `Line: ${propLine}`, 
                                                fill: '#64748b', 
                                                fontSize: 10, 
                                                fontWeight: 900,
                                                offset: 10
                                            }}
                                        />
                                    )}
                                    <Bar 
                                        dataKey="value" 
                                        radius={[4, 4, 0, 0]}
                                        onMouseUp={(data) => navigate(`/games/${data.event_id}`)}
                                        cursor="pointer"
                                    >
                                        {viewLogs.slice().reverse().map((log, index) => {
                                            const val = getStatValueFromLog(log, propType);
                                            const isOver = isPlus ? val >= target : val > target;
                                            return (
                                                <Cell 
                                                    key={`cell-${index}`} 
                                                    fill={isOver ? '#10b981' : '#f43f5e'} 
                                                    fillOpacity={0.8}
                                                />
                                            );
                                        })}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse whitespace-nowrap">
                                <thead>
                                    <tr className="bg-white border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Opponent</th>
                                        <th className="p-4 text-center">Rest</th>
                                        <th className="p-4 text-center">Odds</th>
                                        <th className="p-4 text-center">Result</th>
                                        <th className="p-4 text-right">Prop Result</th>
                                        <th className="p-4 text-right">Value</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {viewLogs.map((log, idx) => {
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
                                        const prefix = log.home_away === 'home' ? 'vs' : '@';
                                        const opponentAbbrev = log.opponent_abbrev || 'OPP';

                                        const moneyLine = parseFloat(log.team_money_line);
                                        const isFavored = !isNaN(moneyLine) && moneyLine < 0;

                                        return (
                                            <tr 
                                                key={idx} 
                                                className="hover:bg-slate-50 transition-colors cursor-pointer"
                                                onClick={() => navigate(`/games/${log.event_id}`)}
                                            >
                                                <td className="p-4 font-medium text-slate-600">{dateStr}</td>
                                                <td className="p-4 font-bold text-slate-700">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-slate-400 font-medium w-4">{prefix}</span>
                                                        {log.opponent_id && (
                                                            <img 
                                                                src={`https://a.espncdn.com/i/teamlogos/mlb/500/${log.opponent_id}.png`} 
                                                                alt={opponentAbbrev} 
                                                                className="w-5 h-5 object-contain"
                                                            />
                                                        )}
                                                        <div className="flex items-center gap-1.5">
                                                            <span>{opponentAbbrev}</span>
                                                            {log.opp_starter_throws && (
                                                                <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1 rounded">
                                                                    {log.opp_starter_throws}HP
                                                                </span>
                                                            )}
                                                            {log.season_type === 3 && (
                                                                <Trophy className="w-3.5 h-3.5 text-amber-500" title="Postseason" />
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className="font-medium text-slate-500">
                                                        {log.restDays !== null ? `${log.restDays}d` : '-'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {!isNaN(moneyLine) ? (
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isFavored ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}>
                                                            {moneyLine > 0 ? `+${moneyLine}` : moneyLine}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="inline-flex flex-col items-center">
                                                        <span className={`text-[9px] font-black w-5 h-4 flex items-center justify-center rounded-sm mb-0.5 ${log.team_score > log.opponent_score ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                                            {log.team_score > log.opponent_score ? 'W' : 'L'}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                                                            {log.team_score}-{log.opponent_score}
                                                        </span>
                                                    </div>
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
                                    {viewLogs.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center font-bold text-slate-500">No recent game logs found matching these filters.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            )} 
        </div>
    );
};
