import React, { useState, useEffect } from 'react';
import { fetchPropBets, fetchSavedProps, fetchPlayerGameLogs, fetchBatchPlayerGameLogs } from '../api';
import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp, ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';
import { useScoreboard } from '../context/ScoreboardContext';

const Sparkline = ({ sequence }: { sequence: boolean[] }) => {
    if (!sequence || sequence.length === 0) return null;
    
    // We want chronologically from left (oldest) to right (newest).
    // The logs array comes back newest first, so we reverse it for display.
    const chronological = [...sequence].reverse();
    
    // Fill remaining with nulls if < 10
    const filled = Array.from({ length: 10 }, (_, i) => chronological[i] ?? null);
    
    return (
        <div className="flex items-center gap-0.5 justify-center mt-1">
            {filled.map((isHit, i) => (
                <div 
                    key={i} 
                    className={`w-1 h-3.5 rounded-full shadow-sm ${
                        isHit === true ? 'bg-emerald-500' : 
                        isHit === false ? 'bg-rose-500' : 
                        'bg-slate-100'
                    }`}
                />
            ))}
        </div>
    );
};

export const PropsPage = () => {
    const navigate = useNavigate();
    const { todayEvents, events } = useScoreboard();
    const [propBets, setPropBets] = useState<any[]>([]);
    const [allPlayersLogs, setAllPlayersLogs] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [propFilterGame, setPropFilterGame] = useState<string>('all');
    const [propFilterTeam, setPropFilterTeam] = useState<string>('all');
    const [propFilterPlayer, setPropFilterPlayer] = useState<string>('all');
    const [propFilterType, setPropFilterType] = useState<string>('all');
    const [l10TrendMode, setL10TrendMode] = useState<'over' | 'under'>('over');
    const [hitRateFilter, setHitRateFilter] = useState<string>('all');
    const [edgeFilter, setEdgeFilter] = useState<string>('all');
    const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'}>({ key: 'game', direction: 'asc' });

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };
    
    // Prevent auto-refreshing when ScoreboardContext interval updates todayEvents
    const [fetchedDate, setFetchedDate] = useState<string>('');

    useEffect(() => {
        const loadAllProps = async () => {
            if (!events || events.length === 0) {
                if (!todayEvents || todayEvents.length === 0) return;
            }
            
            const targetEvents = (events && events.length > 0) ? events : todayEvents;
            const currentDateStr = targetEvents[0]?.date ? targetEvents[0].date.split('T')[0] : 'unknown';
            
            if (fetchedDate === currentDateStr && propBets.length > 0) return; 
            
            setFetchedDate(currentDateStr);
            // We do NOT setLoading(false) here, we wait for logs to load
            
            const allBets: any[] = [];
            
            try {
                const searchDate = currentDateStr.replace(/-/g, '');
                const eventIds = targetEvents.map((e: any) => e.id);
                const savedProps = await fetchSavedProps(searchDate, eventIds);

                // Transform saved props back into the format the UI expects
                savedProps.forEach((sp: any) => {
                    const pt = sp.prop_type ? sp.prop_type.toLowerCase() : '';
                    if (pt.includes('milestones') || pt === 'to record win') return;
                    
                    const event = targetEvents.find((e: any) => e.id === String(sp.event_id));
                    if (!event) return;

                    const awayComp = event.competitions[0].competitors.find((c: any) => c.homeAway === 'away');
                    const homeComp = event.competitions[0].competitors.find((c: any) => c.homeAway === 'home');
                    
                    const bet: any = {
                        _gameId: String(sp.event_id),
                        _awayTeam: awayComp?.team?.abbreviation || sp._awayteam || 'AWY',
                        _awayTeamId: awayComp?.team?.id || sp._awayteamid || null,
                        _homeTeam: homeComp?.team?.abbreviation || sp._hometeam || 'HME',
                        _homeTeamId: homeComp?.team?.id || sp._hometeamid || null,
                        _athleteName: sp.athlete_name || `Player ${sp.athlete_id}`,
                        _teamAbbrev: sp.team_abbrev || 'UNK',
                        athlete: { $ref: `athletes/${sp.athlete_id}` },
                        type: { name: sp.prop_type },
                        current: { target: { displayValue: sp.prop_type === 'To Record Win' ? '0.5' : sp.prop_line } },
                        odds: { american: { value: null } }
                    };
                    
                    // We need to push individual "bets" for over and under to simulate the API response structure the UI expects
                    if (sp.over_odds && sp.over_odds !== 'None') {
                        const overBet = JSON.parse(JSON.stringify(bet));
                        overBet.odds.american.value = sp.over_odds;
                        overBet.current.target.value = "OVER"; // Hack to separate them in grouping
                        allBets.push(overBet);
                    }
                    if (sp.under_odds && sp.under_odds !== 'None') {
                        const underBet = JSON.parse(JSON.stringify(bet));
                        underBet.odds.american.value = sp.under_odds;
                        underBet.current.target.value = "UNDER";
                        allBets.push(underBet);
                    }
                });

            } catch (e) {
                console.error("Failed to load daily scoreboard", e);
                setLoading(false);
            }
            
            setPropBets(allBets);
        };
        
        loadAllProps();
    }, [todayEvents]);

    useEffect(() => {
        if (propBets.length > 0) {
            const pIds = new Set<string>();
            propBets.forEach((bet: any) => {
                const match = bet.athlete?.$ref?.match(/athletes\/(\d+)/);
                if (match) pIds.add(match[1]);
            });
            
            const fetchAllLogs = async () => {
                const year = new Date().getFullYear();
                try {
                    const idsArray = Array.from(pIds);
                    
                    // We might exceed URL length limits if there are hundreds of players. 
                    // Let's chunk them into groups of 50 just to be safe.
                    const chunkSize = 200;
                    const chunks = [];
                    for (let i = 0; i < idsArray.length; i += chunkSize) {
                        chunks.push(idsArray.slice(i, i + chunkSize));
                    }
                    
                    const chunkMaps = await Promise.all(
                        chunks.map(chunk => fetchBatchPlayerGameLogs(chunk, year, 15))
                    );
                    
                    const logsMap: Record<string, any> = {};
                    chunkMaps.forEach(chunkMap => Object.assign(logsMap, chunkMap));
                    
                    console.log("logsMap keys:", Object.keys(logsMap).length);
                    setAllPlayersLogs(logsMap);
                } catch (e) {
                    console.error("Batch fetch failed", e);
                } finally {
                    setLoading(false);
                }
            };
            fetchAllLogs();
        } else if (!loading) {
            setLoading(false);
        }
    }, [propBets]);

    const getStatValueFromLog = (log: any, propType: string) => {
        const p = propType.toLowerCase().trim();
        
        if (log.ip !== undefined) {
            // Pitching
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
            // Batting
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

    const calculateImpliedProbability = (americanOdds: string) => {
        const odds = parseInt(americanOdds);
        if (isNaN(odds)) return null;
        if (odds > 0) {
            return 100 / (odds + 100);
        } else {
            return Math.abs(odds) / (Math.abs(odds) + 100);
        }
    };

    const allRows = React.useMemo(() => {
        const tableRowsMap = new Map<string, any>();
                      
    propBets.forEach((bet: any) => {
        const ref = bet.athlete?.$ref;
        const match = ref?.match(/athletes\/(\d+)/);
        const pId = match ? match[1] : null;
        if (!pId) return;
        
        const targetVal = bet.current?.target?.displayValue || bet.current?.target?.value || 'N/A';
        const typeName = bet.type?.name || "Other";
        
        const rowKey = `${bet._gameId}-${pId}-${typeName}-${targetVal}`;
        
        if (!tableRowsMap.has(rowKey)) {
            let athleteName = bet._athleteName || "Player " + pId;
            let teamAbbr = bet._teamAbbrev || "UNK";
            
            let opponentAbbr = "UNK";
            let opponentId = null;
            let isHome = teamAbbr === bet._homeTeam;
            
            if (isHome) {
                opponentAbbr = bet._awayTeam;
                opponentId = bet._awayTeamId;
            } else {
                opponentAbbr = bet._homeTeam;
                opponentId = bet._homeTeamId;
            }

            tableRowsMap.set(rowKey, {
                gameId: bet._gameId,
                game: `${bet._awayTeam} @ ${bet._homeTeam}`,
                awayTeam: bet._awayTeam,
                awayTeamId: bet._awayTeamId,
                homeTeam: bet._homeTeam,
                homeTeamId: bet._homeTeamId,
                team: teamAbbr,
                opponent: opponentAbbr,
                opponentId: opponentId,
                isHome: isHome,
                name: athleteName,
                playerId: pId,
                propType: typeName,
                propLine: targetVal,
                overOdds: '-',
                underOdds: '-',
                bets: []
            });
        }
        
        tableRowsMap.get(rowKey).bets.push(bet);
    });

    return Array.from(tableRowsMap.values()).map(row => {
        if (row.bets.length >= 2) {
            const overBet = row.bets.find((b: any) => b.current?.target?.value === "OVER");
            const underBet = row.bets.find((b: any) => b.current?.target?.value === "UNDER");
            row.overOdds = overBet?.odds?.american?.displayValue || overBet?.odds?.american?.value || '-';
            row.underOdds = underBet?.odds?.american?.displayValue || underBet?.odds?.american?.value || '-';
        } else if (row.bets.length === 1) {
            const bet = row.bets[0];
            if (bet.current?.target?.value === "UNDER") {
                row.underOdds = bet.odds?.american?.displayValue || bet.odds?.american?.value || '-';
            } else {
                row.overOdds = bet.odds?.american?.displayValue || bet.odds?.american?.value || '-';
            }
        }
        
        row.l10 = '-';
        row.hitRate = 0;
        row.edge = null;
        row.sequence = [];

        const logs = allPlayersLogs[row.playerId];
        if (logs) {
            const p = row.propType.toLowerCase();
            let isPitching = (p.includes('strikeout') && !p.includes('batter')) || p.includes('out') || p.includes('allow') || p.includes('earned run') || p.includes('win');
            let activeLogs = isPitching ? (logs.pitching || []) : (logs.batting || []);
            
            activeLogs = activeLogs.filter((l: any) => {
                if (isPitching) return parseFloat(l.ip || '0') > 0;
                return (l.ab && parseInt(l.ab) > 0) || (l.pitches_faced && parseInt(l.pitches_faced) > 0);
            });
            
            const last10 = activeLogs.slice(0, 10);
            if (last10.length > 0) {
                let hitCount = 0;
                let validCount = 0;
                let sequence: boolean[] = [];
                
                if (p === 'to record win') {
                    last10.forEach((log: any) => {
                        const val = getStatValueFromLog(log, row.propType);
                        if (val !== null) {
                            validCount++;
                            const isWin = val === 1;
                            const isHit = l10TrendMode === 'over' ? isWin : !isWin;
                            if (isHit) hitCount++;
                            sequence.push(isHit);
                        }
                    });
                } else {
                    let target = parseFloat(String(row.propLine).replace('+', ''));
                    if (!isNaN(target)) {
                        last10.forEach((log: any) => {
                            const val = getStatValueFromLog(log, row.propType);
                            if (val !== null) {
                                validCount++;
                                const isOver = String(row.propLine).includes('+') ? val >= target : val > target;
                                const isHit = l10TrendMode === 'over' ? isOver : !isOver;
                                if (isHit) hitCount++;
                                sequence.push(isHit);
                            }
                        });
                    }
                }

                if (validCount > 0) {
                    row.sequence = sequence;
                    row.l10 = `${hitCount} / ${validCount}`;
                    row.hitRate = hitCount / validCount;
                    
                    const relevantOdds = l10TrendMode === 'over' ? row.overOdds : row.underOdds;
                    if (relevantOdds !== '-') {
                        const impliedProb = calculateImpliedProbability(relevantOdds);
                        if (impliedProb !== null) {
                            row.edge = row.hitRate - impliedProb;
                        }
                    }
                } else {
                    row.l10 = '-';
                    row.hitRate = 0;
                }
            }
        }
        
        return row;
    });
    }, [propBets, allPlayersLogs, l10TrendMode]); // Recalculate only when base data changes

    const filteredRows = React.useMemo(() => {
        return allRows.filter(row => {
            if (propFilterGame !== 'all' && row.gameId !== propFilterGame) return false;
            if (propFilterTeam !== 'all' && row.team !== propFilterTeam) return false;
            if (propFilterPlayer !== 'all' && row.playerId !== propFilterPlayer) return false;
            if (propFilterType !== 'all' && row.propType !== propFilterType) return false;
            
            if (hitRateFilter !== 'all') {
                const threshold = parseInt(hitRateFilter) / 100;
                if (!row.hitRate || row.hitRate < threshold) return false;
            }
            
            if (edgeFilter !== 'all') {
                const threshold = parseInt(edgeFilter) / 100;
                if (row.edge === null || row.edge < threshold) return false;
            }
            
            return true;
        });
    }, [allRows, propFilterGame, propFilterTeam, propFilterPlayer, propFilterType, hitRateFilter, edgeFilter]);

    const tableRows = React.useMemo(() => {
        // Create a shallow copy so we don't mutate the filtered array
        const sorted = [...filteredRows];
        
        sorted.sort((a, b) => {
            let aVal: any = a[sortConfig.key];
            let bVal: any = b[sortConfig.key];

            if (sortConfig.key === 'propLine') {
                aVal = parseFloat(String(a.propLine).replace('+', ''));
                bVal = parseFloat(String(b.propLine).replace('+', ''));
            } else if (sortConfig.key === 'edge') {
                aVal = a.edge === null ? -999 : a.edge;
                bVal = b.edge === null ? -999 : b.edge;
            } else if (sortConfig.key === 'l10') {
                aVal = a.hitRate;
                bVal = b.hitRate;
            } else if (sortConfig.key === 'overOdds') {
                aVal = a.overOdds === '-' ? -999 : parseInt(a.overOdds);
                bVal = b.overOdds === '-' ? -999 : parseInt(b.overOdds);
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            
            if (a.game !== b.game) return a.game.localeCompare(b.game);
            return a.name.localeCompare(b.name);
        });
        
        return sorted;
    }, [filteredRows, sortConfig]);

    const uniqueTypes = React.useMemo(() => Array.from(new Set(propBets.map(b => b.type?.name).filter(Boolean))).sort() as string[], [propBets]);

    if (loading) return <div className="min-h-screen bg-surface flex items-center justify-center font-bold text-slate-500">Loading Props...</div>;
    if (!propBets || propBets.length === 0) return <div className="min-h-screen bg-surface flex items-center justify-center font-bold text-slate-500">No prop bets available today.</div>;

    const selectedGameBet = propBets.find(b => b._gameId === propFilterGame);
    const teamsForSelectedGame = selectedGameBet ? [selectedGameBet._awayTeam, selectedGameBet._homeTeam].filter(Boolean) : [];
    
    const playersForSelectedTeamMap = new Map<string, string>();
    allRows.forEach(row => {
        if (row.gameId === propFilterGame && row.team === propFilterTeam) {
            playersForSelectedTeamMap.set(row.playerId, row.name);
        }
    });
    const playersForSelectedTeam = Array.from(playersForSelectedTeamMap.entries()).map(([id, name]) => ({id, name})).sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-3 rounded-2xl">
                        <TrendingUp className="w-8 h-8 text-primary" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="font-headline font-black text-3xl uppercase tracking-widest text-slate-800">Daily Prop Bets</h1>
                        <p className="text-slate-500 font-medium">Player prop odds and L10 trends across all games.</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4">
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Game</label>
                        <select 
                            className="text-sm border border-slate-200 bg-white rounded-md p-2 outline-none font-medium text-slate-700 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                            value={propFilterGame}
                            onChange={(e) => {
                                setPropFilterGame(e.target.value);
                                setPropFilterTeam('all');
                                setPropFilterPlayer('all');
                            }}
                        >
                            <option value="all">All Games</option>
                            {Array.from(new Set(propBets.map(b => b._gameId))).map(gameId => {
                                const bet = propBets.find(b => b._gameId === gameId);
                                const label = bet ? `${bet._awayTeam} @ ${bet._homeTeam}` : gameId;
                                return <option key={gameId as string} value={gameId as string}>{label}</option>;
                            })}
                        </select>
                    </div>
                    {propFilterGame !== 'all' && (
                        <div className="flex flex-col">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Team</label>
                            <select 
                                className="text-sm border border-slate-200 bg-white rounded-md p-2 outline-none font-medium text-slate-700 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                                value={propFilterTeam}
                                onChange={(e) => {
                                    setPropFilterTeam(e.target.value);
                                    setPropFilterPlayer('all');
                                }}
                            >
                                <option value="all">All Teams</option>
                                {teamsForSelectedGame.map(team => (
                                    <option key={team} value={team}>{team}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {propFilterGame !== 'all' && propFilterTeam !== 'all' && (
                        <div className="flex flex-col">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Player</label>
                            <select 
                                className="text-sm border border-slate-200 bg-white rounded-md p-2 outline-none font-medium text-slate-700 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                                value={propFilterPlayer}
                                onChange={(e) => setPropFilterPlayer(e.target.value)}
                            >
                                <option value="all">All Players</option>
                                {playersForSelectedTeam.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Prop Type</label>
                        <select 
                            className="text-sm border border-slate-200 bg-white rounded-md p-2 outline-none font-medium text-slate-700 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                            value={propFilterType}
                            onChange={(e) => setPropFilterType(e.target.value)}
                        >
                            <option value="all">All Prop Types</option>
                            {uniqueTypes.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Min Hit Rate</label>
                        <select 
                            className="text-sm border border-slate-200 bg-white rounded-md p-2 outline-none font-medium text-slate-700 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                            value={hitRateFilter}
                            onChange={(e) => setHitRateFilter(e.target.value)}
                        >
                            <option value="all">All</option>
                            <option value="70">70%+</option>
                            <option value="80">80%+</option>
                            <option value="90">90%+</option>
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Min Edge</label>
                        <select 
                            className="text-sm border border-slate-200 bg-white rounded-md p-2 outline-none font-medium text-slate-700 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                            value={edgeFilter}
                            onChange={(e) => setEdgeFilter(e.target.value)}
                        >
                            <option value="all">All</option>
                            <option value="5">5%+</option>
                            <option value="10">10%+</option>
                            <option value="15">15%+</option>
                            <option value="20">20%+</option>
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Trend Mode</label>
                        <div className="flex bg-slate-200/70 rounded-md p-0.5">
                            <button
                                onClick={() => setL10TrendMode('over')}
                                className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${l10TrendMode === 'over' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Over
                            </button>
                            <button
                                onClick={() => setL10TrendMode('under')}
                                className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${l10TrendMode === 'under' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Under
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="text-[10px] uppercase tracking-wider text-slate-500 font-bold select-none">
                                <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('game')}>
                                    <div className="flex items-center gap-1.5">Matchup {sortConfig.key === 'game' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-slate-300" />}</div>
                                </th>
                                <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('name')}>
                                    <div className="flex items-center gap-1.5">Name {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-slate-300" />}</div>
                                </th>
                                <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('propType')}>
                                    <div className="flex items-center gap-1.5">Prop Type {sortConfig.key === 'propType' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-slate-300" />}</div>
                                </th>
                                <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('propLine')}>
                                    <div className="flex items-center gap-1.5">Prop Line {sortConfig.key === 'propLine' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-slate-300" />}</div>
                                </th>
                                <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('l10')}>
                                    <div className="flex items-center justify-center gap-1.5">L10 {l10TrendMode === 'over' ? 'Over' : 'Under'} {sortConfig.key === 'l10' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-slate-300" />}</div>
                                </th>
                                <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('edge')}>
                                    <div className="flex items-center justify-center gap-1.5">Edge {sortConfig.key === 'edge' ? (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />) : <ArrowUpDown className="w-3 h-3 text-slate-300" />}</div>
                                </th>
                                <th className="p-4 text-center">
                                    <div className="flex items-center justify-center gap-1.5">Odds (O / U)</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm tabular-nums">
                            {tableRows.map((row, idx) => (
                                <tr 
                                    key={idx} 
                                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                                    onClick={() => navigate(`/props/analysis?playerId=${row.playerId}&propType=${encodeURIComponent(row.propType)}&propLine=${row.propLine}&opponentId=${row.opponentId}&opponentAbbrev=${row.opponent}&isHome=${row.isHome}&gameId=${row.gameId}`)}
                                >
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            <Link to={`/games/${row.gameId}?tab=props`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 hover:bg-slate-100 p-1 -ml-1 rounded transition-colors w-fit">
                                                <div className="flex items-center">
                                                    {row.awayTeamId && <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/${row.awayTeamId}.png`} alt={row.awayTeam} className="w-4 h-4 object-contain" />}
                                                    <span className={`text-xs font-bold ml-1 ${!row.isHome ? 'text-slate-800' : 'text-slate-400'}`}>{row.awayTeam}</span>
                                                </div>
                                                <span className="text-[10px] font-black text-slate-300">@</span>
                                                <div className="flex items-center">
                                                    {row.homeTeamId && <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/${row.homeTeamId}.png`} alt={row.homeTeam} className="w-4 h-4 object-contain" />}
                                                    <span className={`text-xs font-bold ml-1 ${row.isHome ? 'text-slate-800' : 'text-slate-400'}`}>{row.homeTeam}</span>
                                                </div>
                                            </Link>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <Link to={`/players/${row.playerId}`} onClick={(e) => e.stopPropagation()} className="font-bold text-slate-800 hover:text-primary hover:underline text-sm">{row.name}</Link>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{row.team}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-slate-600">{row.propType}</td>
                                    <td className="p-4 font-black text-slate-800">{row.propLine}</td>
                                    <td className="p-4 text-center">
                                        {row.l10 === '-' ? (
                                            <span className="text-slate-400">-</span>
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                <span className={`text-xs font-bold ${parseInt(row.l10.split(' ')[0]) >= 6 ? 'text-emerald-600' : parseInt(row.l10.split(' ')[0]) <= 4 ? 'text-rose-600' : 'text-slate-600'}`}>
                                                    {row.l10}
                                                </span>
                                                <Sparkline sequence={row.sequence} />
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-center">
                                        {row.edge === null ? (
                                            <span className="text-slate-400">-</span>
                                        ) : (
                                            <span className={`px-2 py-1 rounded text-[10px] font-black ${
                                                row.edge > 0.15 ? 'bg-emerald-500 text-white' : 
                                                row.edge > 0.05 ? 'bg-emerald-100 text-emerald-700' : 
                                                row.edge < -0.05 ? 'bg-rose-100 text-rose-700' :
                                                'bg-slate-100 text-slate-600'
                                            }`}>
                                                {row.edge > 0 ? '+' : ''}{Math.round(row.edge * 100)}%
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col items-center justify-center w-[72px] mx-auto border border-slate-200 rounded shadow-sm overflow-hidden bg-white">
                                            <div className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] border-b border-slate-100 ${row.overOdds !== '-' ? 'text-emerald-700 hover:bg-emerald-50/50' : 'text-slate-300'}`}>
                                                <span className="font-bold opacity-60">O</span>
                                                <span className="font-black">{row.overOdds}</span>
                                            </div>
                                            <div className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] ${row.underOdds !== '-' ? 'text-rose-700 hover:bg-rose-50/50' : 'text-slate-300'}`}>
                                                <span className="font-bold opacity-60">U</span>
                                                <span className="font-black">{row.underOdds}</span>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {tableRows.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center font-bold text-slate-500">No props found for this filter.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
