import React, { useState, useEffect } from 'react';
import { fetchPropBets, fetchSavedProps, fetchPlayerGameLogs } from '../api';
import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { useScoreboard } from '../context/ScoreboardContext';

export const PropsPage = () => {
    const { todayEvents, events } = useScoreboard();
    const [propBets, setPropBets] = useState<any[]>([]);
    const [allPlayersLogs, setAllPlayersLogs] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [propFilterGame, setPropFilterGame] = useState<string>('all');
    const [propFilterType, setPropFilterType] = useState<string>('all');
    
    // Prevent auto-refreshing when ScoreboardContext interval updates todayEvents
    const [fetchedDate, setFetchedDate] = useState<string>('');

    useEffect(() => {
        const loadAllProps = async () => {
            if (!events || events.length === 0) {
                // fallback to todayEvents if events is empty for some reason
                if (!todayEvents || todayEvents.length === 0) return;
            }
            
            const targetEvents = (events && events.length > 0) ? events : todayEvents;
            const currentDateStr = targetEvents[0]?.date ? targetEvents[0].date.split('T')[0] : 'unknown';
            
            if (fetchedDate === currentDateStr && propBets.length > 0) return; 
            
            setFetchedDate(currentDateStr);
            setLoading(true);
            
            const allBets: any[] = [];
            const summaries: Record<string, any> = {};
            
            try {
                // Fetch summaries in parallel for all games to get rosters
                const summaryPromises = targetEvents.map(async (event: any) => {
                    const gameId = event.id;
                    try {
                        const summaryRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${gameId}`);
                        if (summaryRes.ok) {
                            summaries[gameId] = await summaryRes.json();
                        }
                    } catch (e) { }
                });
                await Promise.all(summaryPromises);

                // Fetch saved props from backend for this date
                const searchDate = currentDateStr.replace(/-/g, ''); // e.g., 20260330
                const savedProps = await fetchSavedProps(searchDate);

                // Transform saved props back into the format the UI expects
                savedProps.forEach((sp: any) => {
                    const event = targetEvents.find((e: any) => e.id === String(sp.event_id));
                    if (!event) return;
                    
                    const bet: any = {
                        _gameId: String(sp.event_id),
                        _awayTeam: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away')?.team?.abbreviation,
                        _homeTeam: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home')?.team?.abbreviation,
                        _summary: summaries[String(sp.event_id)],
                        athlete: { $ref: `athletes/${sp.athlete_id}` },
                        type: { name: sp.prop_type },
                        current: { target: { displayValue: sp.prop_line } },
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
            }
            
            setPropBets(allBets);
            setLoading(false);
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
                const logsMap: Record<string, any> = {};
                const promises = Array.from(pIds).map(async pId => {
                    try {
                        const logs = await fetchPlayerGameLogs(parseInt(pId), year);
                        logsMap[pId] = logs;
                    } catch (e) {
                        // ignore error
                    }
                });
                await Promise.all(promises);
                setAllPlayersLogs(logsMap);
            };
            fetchAllLogs();
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
            return null;
        }
        
        if (log.ab !== undefined) {
            // Batting
            if (p === 'total home runs' || p === 'home runs milestones') return parseInt(log.hr || '0');
            if (p === 'total hits' || p === 'hits milestones') return parseInt(log.h || '0');
            if (p === 'total rbis' || p === 'rbis milestones') return parseInt(log.rbi || '0');
            if (p === 'total runs scored' || p === 'runs milestones') return parseInt(log.r || '0');
            if (p === 'total hits + runs + rbis' || p === 'hits + runs + rbis milestones') {
                return parseInt(log.h || '0') + parseInt(log.r || '0') + parseInt(log.rbi || '0');
            }
            if (p === 'total walks (batter)' || p === 'walks (batter) milestones') return parseInt(log.bb || '0');
            if (p === 'strikeouts (batter) milestones' || p === 'total strikeouts (batter)') return parseInt(log.k || '0');
            return null;
        }
        return null;
    };

    if (loading) return <div className="min-h-screen bg-surface flex items-center justify-center font-bold text-slate-500">Loading Props...</div>;
    if (!propBets || propBets.length === 0) return <div className="min-h-screen bg-surface flex items-center justify-center font-bold text-slate-500">No prop bets available today.</div>;

    const filteredBets = propBets.filter(b => {
        if (propFilterGame !== 'all' && b._gameId !== propFilterGame) return false;
        if (propFilterType !== 'all' && b.type?.name !== propFilterType) return false;
        return true;
    });

    const tableRowsMap = new Map<string, any>();
                      
    filteredBets.forEach((bet: any) => {
        const ref = bet.athlete?.$ref;
        const match = ref?.match(/athletes\/(\d+)/);
        const pId = match ? match[1] : null;
        if (!pId) return;
        
        const targetVal = bet.current?.target?.displayValue || bet.current?.target?.value || 'N/A';
        const typeName = bet.type?.name || "Other";
        
        const rowKey = `${bet._gameId}-${pId}-${typeName}-${targetVal}`;
        
        if (!tableRowsMap.has(rowKey)) {
            let athleteName = "Player " + pId;
            let teamAbbr = "UNK";
            
            const summary = bet._summary;
            if (summary) {
                if (summary.rosters) {
                    summary.rosters.forEach((r: any) => {
                        const found = r.roster?.find((entry: any) => entry.athlete?.id === pId);
                        if (found) {
                            athleteName = found.athlete.displayName;
                            const isAwayRoster = r.team?.abbreviation === bet._awayTeam;
                            teamAbbr = isAwayRoster ? bet._awayTeam : bet._homeTeam;
                        }
                    });
                }
                if (teamAbbr === "UNK" && summary.boxscore?.players) {
                    summary.boxscore.players.forEach((teamStats: any) => {
                        teamStats.statistics?.forEach((statGroup: any) => {
                            const found = statGroup.athletes?.find((entry: any) => entry.athlete?.id === pId);
                            if (found) {
                                athleteName = found.athlete.displayName;
                                teamAbbr = teamStats.team?.abbreviation || "UNK";
                            }
                        });
                    });
                }
                if (teamAbbr === "UNK" && summary.header?.competitions?.[0]?.competitors) {
                    summary.header.competitions[0].competitors.forEach((c: any) => {
                        if (c.probables?.[0]?.athlete?.id === pId) {
                            athleteName = c.probables[0].athlete.displayName;
                            teamAbbr = c.team?.abbreviation;
                        }
                    });
                }
            }

            tableRowsMap.set(rowKey, {
                gameId: bet._gameId,
                game: `${bet._awayTeam} @ ${bet._homeTeam}`,
                team: teamAbbr,
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

    const tableRows = Array.from(tableRowsMap.values()).map(row => {
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
        const logs = allPlayersLogs[row.playerId];
        if (logs) {
            const p = row.propType.toLowerCase();
            let isPitching = (p.includes('strikeout') && !p.includes('batter')) || p.includes('out') || p.includes('allow') || p.includes('earned run');
            let activeLogs = isPitching ? (logs.pitching || []) : (logs.batting || []);
            
            activeLogs = activeLogs.filter((l: any) => {
                if (isPitching) return parseFloat(l.ip || '0') > 0;
                return (l.ab && parseInt(l.ab) > 0) || (l.pitches_faced && parseInt(l.pitches_faced) > 0);
            });
            
            const last10 = activeLogs.slice(0, 10);
            if (last10.length > 0) {
                let overCount = 0;
                let target = parseFloat(String(row.propLine).replace('+', ''));
                if (!isNaN(target)) {
                    let validCount = 0;
                    last10.forEach((log: any) => {
                        const val = getStatValueFromLog(log, row.propType);
                        if (val !== null) {
                            validCount++;
                            if (String(row.propLine).includes('+')) {
                                if (val >= target) overCount++;
                            } else {
                                if (val > target) overCount++;
                            }
                        }
                    });
                    if (validCount > 0) {
                        row.l10 = `${overCount} / ${validCount}`;
                    } else {
                        row.l10 = '-';
                    }
                }
            }
        }
        
        return row;
    });

    tableRows.sort((a, b) => {
        if (a.game !== b.game) return a.game.localeCompare(b.game);
        if (a.propType !== b.propType) return a.propType.localeCompare(b.propType);
        return a.name.localeCompare(b.name);
    });

    const uniqueTypes = Array.from(new Set(propBets.map(b => b.type?.name).filter(Boolean))).sort() as string[];

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
                            className="text-sm border border-slate-200 rounded p-2 outline-none font-bold text-primary"
                            value={propFilterGame}
                            onChange={(e) => setPropFilterGame(e.target.value)}
                        >
                            <option value="all">All Games</option>
                            {Array.from(new Set(propBets.map(b => b._gameId))).map(gameId => {
                                const bet = propBets.find(b => b._gameId === gameId);
                                const label = bet ? `${bet._awayTeam} @ ${bet._homeTeam}` : gameId;
                                return <option key={gameId} value={gameId}>{label}</option>;
                            })}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Prop Type</label>
                        <select 
                            className="text-sm border border-slate-200 rounded p-2 outline-none font-bold text-primary"
                            value={propFilterType}
                            onChange={(e) => setPropFilterType(e.target.value)}
                        >
                            <option value="all">All Prop Types</option>
                            {uniqueTypes.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                <th className="p-4">Game</th>
                                <th className="p-4">Team</th>
                                <th className="p-4">Name</th>
                                <th className="p-4">Prop Type</th>
                                <th className="p-4">Prop Line</th>
                                <th className="p-4 text-center">L10 Over</th>
                                <th className="p-4 text-right">Over Odds</th>
                                <th className="p-4 text-right">Under Odds</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {tableRows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4">
                                        <Link to={`/games/${row.gameId}?tab=props`} className="font-medium text-slate-500 hover:text-primary hover:underline">{row.game}</Link>
                                    </td>
                                    <td className="p-4 font-bold text-slate-700">{row.team}</td>
                                    <td className="p-4">
                                        <Link to={`/players/${row.playerId}`} className="font-bold text-primary hover:underline">{row.name}</Link>
                                    </td>
                                    <td className="p-4 text-slate-600">{row.propType}</td>
                                    <td className="p-4 font-black text-slate-800">{row.propLine}</td>
                                    <td className="p-4 text-center">
                                        {row.l10 === '-' ? (
                                            <span className="text-slate-400">-</span>
                                        ) : (
                                            <span className={`font-bold ${parseInt(row.l10.split(' ')[0]) >= 6 ? 'text-emerald-600' : parseInt(row.l10.split(' ')[0]) <= 4 ? 'text-rose-600' : 'text-slate-600'}`}>
                                                {row.l10}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right font-bold text-emerald-600">{row.overOdds}</td>
                                    <td className="p-4 text-right font-bold text-rose-600">{row.underOdds}</td>
                                </tr>
                            ))}
                            {tableRows.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center font-bold text-slate-500">No props found for this filter.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
