import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { SafeImage } from '../shared/SafeImage';
import { fetchPlayerGameLogs } from '../../api';

interface GamePropsTabProps {
    data: any;
    propBets: any[];
    awayTeam: any;
    homeTeam: any;
}

export const GamePropsTab: React.FC<GamePropsTabProps> = ({ data, propBets, awayTeam, homeTeam }) => {
    const navigate = useNavigate();
    const [propFilterTeam, setPropFilterTeam] = useState<string>('all');
    const [propFilterPlayer, setPropFilterPlayer] = useState<string>('all');
    const [propFilterType, setPropFilterType] = useState<string>('all');
    const [propFilterLine, setPropFilterLine] = useState<string>('all');
    const [allPlayersLogs, setAllPlayersLogs] = useState<Record<string, any>>({});

    const getPlayerContext = (bet: any, id: string) => {
        let name = bet.athlete?.displayName || `Player ${id}`;
        let teamAbbr = bet._teamAbbrev || "UNK";
        
        // Fallback for live games where `data.rosters` might be needed (not mapped from DB)
        if (teamAbbr === "UNK" && data.rosters) {
            data.rosters.forEach((r: any) => {
                if (r.roster?.some((entry: any) => entry.athlete?.id === id)) {
                    teamAbbr = r.team?.id === awayTeam?.team?.id ? awayTeam?.team?.abbreviation : homeTeam?.team?.abbreviation;
                }
            });
        }
        if (teamAbbr === "UNK" && data.boxscore?.players) {
            data.boxscore.players.forEach((teamStats: any) => {
                teamStats.statistics?.forEach((statGroup: any) => {
                    if (statGroup.athletes?.some((entry: any) => entry.athlete?.id === id)) {
                        teamAbbr = teamStats.team?.abbreviation || "UNK";
                    }
                });
            });
        }
        if (teamAbbr === "UNK") {
            [awayTeam, homeTeam].forEach((teamData: any) => {
                if (teamData?.probables?.[0]?.athlete?.id === id) {
                    teamAbbr = teamData?.team?.abbreviation || "UNK";
                }
            });
        }
        return { name, teamAbbr };
    };

    useEffect(() => {
        if (propBets) {
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
                        const logs = await fetchPlayerGameLogs(parseInt(pId), year, 200);
                        logsMap[pId] = logs;
                    } catch (e) {
                        console.error("Failed to fetch logs for player", pId);
                    }
                });
                await Promise.all(promises);
                setAllPlayersLogs(logsMap);
            };
            fetchAllLogs();
        }
    }, [propBets]);

    const getStatValueFromLog = (log: any, pType: string): number | null => {
        if (!log) return null;
        const p = pType.toLowerCase();
        
        if (p.includes('pitching outs') || p.includes('outs recorded')) return log.ip ? Math.round(parseFloat(log.ip) * 3) : 0; 
        if (p.includes('strikeouts (pitcher)') || p.includes('strikeouts thrown') || (p.includes('strikeouts') && !p.includes('batter'))) return parseInt(log.k || '0');
        if (p.includes('earned runs')) return parseInt(log.er || '0');
        if (p.includes('hits allowed')) return parseInt(log.h || '0');
        if (p.includes('walks allowed')) return parseInt(log.bb || '0');
        
        if (p.includes('total bases')) return parseInt(log.tb || '0') || (parseInt(log.h || '0') + parseInt(log.d || '0') + parseInt(log.t || '0') * 2 + parseInt(log.hr || '0') * 3);
        if (p.includes('hits + runs + rbis')) return parseInt(log.h || '0') + parseInt(log.r || '0') + parseInt(log.rbi || '0');
        if (p.includes('home runs') || p.includes('home run')) return parseInt(log.hr || '0');
        if (p.includes('hits') && !p.includes('runs') && !p.includes('rbis')) return parseInt(log.h || '0');
        if (p.includes('rbis') || p.includes('runs batted in')) return parseInt(log.rbi || '0');
        if (p.includes('runs scored') || (p.includes('runs') && !p.includes('home') && !p.includes('earned'))) return parseInt(log.r || '0');
        if (p.includes('singles')) return parseInt(log.singles || '0') || Math.max(0, parseInt(log.h || '0') - parseInt(log.d || '0') - parseInt(log.t || '0') - parseInt(log.hr || '0'));
        if (p.includes('doubles')) return parseInt(log.d || '0');
        if (p.includes('triples')) return parseInt(log.t || '0');
        if (p.includes('walks') && !p.includes('allowed')) return parseInt(log.bb || '0');
        if (p.includes('stolen bases')) return parseInt(log.sb || '0');
        if (p.includes('strikeouts') && p.includes('batter')) return parseInt(log.k || '0');
        return null;
    };

    return (
<div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-slate-400" />
                      <h3 className="font-headline font-black uppercase tracking-widest text-slate-700">Player Prop Bets</h3>
                  </div>
                  
                  {propBets && propBets.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                      <div className="flex flex-col">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Team</label>
                          <select 
                              className="text-sm border border-slate-200 rounded p-2 outline-none font-bold text-primary"
                              value={propFilterTeam}
                              onChange={(e) => {
                                  setPropFilterTeam(e.target.value);
                                  setPropFilterPlayer('all');
                                  setPropFilterType('all');
                                  setPropFilterLine('all');
                              }}
                          >
                              <option value="all">All Teams</option>
                              <option value={awayTeam?.team?.abbreviation}>{awayTeam?.team?.name}</option>
                              <option value={homeTeam?.team?.abbreviation}>{homeTeam?.team?.name}</option>
                          </select>
                      </div>
                      
                      <div className="flex flex-col">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Player</label>
                          <select 
                              className="text-sm border border-slate-200 rounded p-2 outline-none font-bold text-primary disabled:opacity-50"
                              value={propFilterPlayer}
                              onChange={(e) => {
                                  setPropFilterPlayer(e.target.value);
                                  setPropFilterType('all');
                                  setPropFilterLine('all');
                              }}
                          >
                              <option value="all">All Players</option>
                              {(() => {
                                  // Gather unique players for the current team filter
                                  const players = new Map();
                                  propBets.forEach((bet: any) => {
                                      const ref = bet.athlete?.$ref;
                                      if (!ref) return;
                                      const match = ref.match(/athletes\/(\d+)/);
                                      const id = match ? match[1] : null;
                                      if (!id) return;
                                      
                                      const { name, teamAbbr } = getPlayerContext(bet, id);
                                      
                                      if (propFilterTeam === 'all' || propFilterTeam === teamAbbr) {
                                          players.set(id, name);
                                      }
                                  });
                                  
                                  return Array.from(players.entries()).sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => (
                                      <option key={id} value={id}>{name}</option>
                                  ));
                              })()}
                          </select>
                      </div>
                      
                      <div className="flex flex-col">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Prop Type</label>
                          <select 
                              className="text-sm border border-slate-200 rounded p-2 outline-none font-bold text-primary disabled:opacity-50"
                              value={propFilterType}
                              onChange={(e) => {
                                  setPropFilterType(e.target.value);
                                  setPropFilterLine('all');
                              }}
                          >
                              <option value="all">All Prop Types</option>
                              {(() => {
                                  const types = new Set<string>();
                                  propBets.forEach((bet: any) => {
                                      const ref = bet.athlete?.$ref;
                                      const match = ref?.match(/athletes\/(\d+)/);
                                      const pId = match ? match[1] : null;
                                      
                                      // Respect previous filters
                                      const { teamAbbr } = pId ? getPlayerContext(bet, pId) : { teamAbbr: 'UNK' };
                                      
                                      if (
                                          (propFilterTeam === 'all' || propFilterTeam === teamAbbr) &&
                                          (propFilterPlayer === 'all' || propFilterPlayer === pId)
                                      ) {
                                          if (bet.type?.name) types.add(bet.type.name);
                                      }
                                  });
                                  return Array.from(types).sort().map(t => (
                                      <option key={t} value={t}>{t}</option>
                                  ));
                              })()}
                          </select>
                      </div>
                      
                      <div className="flex flex-col">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Prop Line / Target</label>
                          <select 
                              className="text-sm border border-slate-200 rounded p-2 outline-none font-bold text-primary disabled:opacity-50"
                              value={propFilterLine}
                              onChange={(e) => setPropFilterLine(e.target.value)}
                              disabled={propFilterType === 'all'}
                          >
                              <option value="all">All Lines</option>
                              {(() => {
                                  if (propFilterType === 'all') return null;
                                  const lines = new Set<string>();
                                  propBets.forEach((bet: any) => {
                                      const ref = bet.athlete?.$ref;
                                      const match = ref?.match(/athletes\/(\d+)/);
                                      const pId = match ? match[1] : null;
                                      
                                      const { teamAbbr } = pId ? getPlayerContext(bet, pId) : { teamAbbr: 'UNK' };
                                      
                                      if (
                                          (propFilterTeam === 'all' || propFilterTeam === teamAbbr) &&
                                          (propFilterPlayer === 'all' || propFilterPlayer === pId) &&
                                          (bet.type?.name === propFilterType)
                                      ) {
                                          if (bet.current?.target?.displayValue) lines.add(bet.current.target.displayValue.toString());
                                      }
                                  });
                                  // Sort numerically if possible, else alphabetically
                                  return Array.from(lines).sort((a, b) => {
                                      const na = parseFloat(a);
                                      const nb = parseFloat(b);
                                      if (!isNaN(na) && !isNaN(nb)) return na - nb;
                                      return a.localeCompare(b);
                                  }).map(l => (
                                      <option key={l} value={l}>{l}</option>
                                  ));
                              })()}
                          </select>
                      </div>
                  </div>
                  )}
              </div>
              <div className="p-0">
                  {(() => {
                      if (!propBets || propBets.length === 0) return <div className="p-8 text-center text-slate-500 font-bold">No prop bets available.</div>;
                      
                      // Group by type.name
                      // Apply filters first
                      const filteredBets = propBets.filter((bet: any) => {
                          const ref = bet.athlete?.$ref;
                          const match = ref?.match(/athletes\/(\d+)/);
                          const pId = match ? match[1] : null;
                          
                          const { teamAbbr } = pId ? getPlayerContext(bet, pId) : { teamAbbr: 'UNK' };
                          
                          if (propFilterTeam !== 'all' && propFilterTeam !== teamAbbr) return false;
                          if (propFilterPlayer !== 'all' && propFilterPlayer !== pId) return false;
                          if (propFilterType !== 'all' && propFilterType !== bet.type?.name) return false;
                          if (propFilterLine !== 'all' && String(bet.current?.target?.displayValue) !== propFilterLine) return false;
                          
                          return true;
                      });
                      
                      if (filteredBets.length === 0) return <div className="p-8 text-center text-slate-500 font-bold">No matching prop bets for these filters.</div>;

                      // Process into table rows
                      const tableRowsMap = new Map<string, any>();
                      
                      filteredBets.forEach((bet: any) => {
                          const ref = bet.athlete?.$ref;
                          const match = ref?.match(/athletes\/(\d+)/);
                          const pId = match ? match[1] : null;
                          if (!pId) return;
                          
                          const targetVal = bet.current?.target?.displayValue || bet.current?.target?.value || 'N/A';
                          const typeName = bet.type?.name || "Other";
                          
                          const rowKey = `${pId}-${typeName}-${targetVal}`;
                          
                          if (!tableRowsMap.has(rowKey)) {
                              const { name: athleteName, teamAbbr } = getPlayerContext(bet, pId);

                              tableRowsMap.set(rowKey, {
                                  game: `${awayTeam?.team?.abbreviation} @ ${homeTeam?.team?.abbreviation}`,
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
                          if (row.bets.length === 2) {
                              row.overOdds = row.bets[0].odds?.american?.displayValue || row.bets[0].odds?.american?.value || '-';
                              row.underOdds = row.bets[1].odds?.american?.displayValue || row.bets[1].odds?.american?.value || row.bets[0]._underOdds || '-';
                          } else if (row.bets.length === 1) {
                              const bet = row.bets[0];
                              const isYes = String(row.propLine).includes("+");
                              if (isYes) {
                                  row.overOdds = bet.odds?.american?.displayValue || bet.odds?.american?.value || '-';
                                  row.underOdds = bet._underOdds || '-';
                              } else {
                                  row.overOdds = bet.odds?.american?.displayValue || bet.odds?.american?.value || '-';
                              }
                          }
                          
                          // Calculate Game Result
                          row.gameResult = '-';
                          row.hit = null;
                          
                          if (data.boxscore?.players) {
                              const p = row.propType.toLowerCase();
                              let isPitching = (p.includes('strikeout') && !p.includes('batter')) || p.includes('strikeouts thrown') || p.includes('pitching outs') || p.includes('outs recorded') || p.includes('allow') || p.includes('earned run');
                              
                              row.didNotPlay = true; // Assume true until we find them in the boxscore

                              data.boxscore.players.forEach((teamBox: any) => {
                                  const statsGroup = teamBox.statistics?.find((s: any) => s.type === (isPitching ? 'pitching' : 'batting'));
                                  if (statsGroup && statsGroup.athletes) {
                                      const ath = statsGroup.athletes.find((a: any) => a.athlete.id === row.playerId);
                                      if (ath && ath.stats) {
                                          const statsDict: any = {};
                                          statsGroup.labels.forEach((lbl: string, idx: number) => {
                                              statsDict[lbl.toLowerCase()] = ath.stats[idx];
                                          });
                                          
                                          // Need to format boxscore dict to match what getStatValueFromLog expects
                                          const logDict: any = {
                                              ip: statsDict['ip'],
                                              k: statsDict['k'],
                                              er: statsDict['er'],
                                              h: statsDict['h'],
                                              bb: statsDict['bb'],
                                              tb: statsDict['tb'],
                                              hr: statsDict['hr'],
                                              rbi: statsDict['rbi'],
                                              r: statsDict['r'],
                                              d: statsDict['2b'],
                                              t: statsDict['3b'],
                                              sb: statsDict['sb']
                                          };
                                          
                                          
                                          // Only mark as played if they actually logged ABs/Pitches or are listed in the stats
                                          if (isPitching && logDict['ip'] && logDict['ip'] !== '0.0') row.didNotPlay = false;
                                          if (!isPitching && (logDict['ab'] || logDict['bb'] || logDict['r'] || logDict['h'])) row.didNotPlay = false;

                                          const val = getStatValueFromLog(logDict, row.propType);
                                          if (val !== null) {
                                              row.gameResult = val.toString();
                                              let target = parseFloat(String(row.propLine).replace('+', ''));
                                              if (!isNaN(target)) {
                                                  if (String(row.propLine).includes('+')) {
                                                      row.hit = val >= target ? 'OVER' : 'UNDER';
                                                  } else {
                                                      row.hit = val > target ? 'OVER' : 'UNDER';
                                                  }
                                              }
                                          }
                                      }
                                  }
                              });
                          }
                          
                          row.l10 = '-';
                          const logs = allPlayersLogs[row.playerId];
                          if (logs) {
                              const p = row.propType.toLowerCase();
                              let isPitching = (p.includes('strikeout') && !p.includes('batter')) || p.includes('strikeouts thrown') || p.includes('pitching outs') || p.includes('outs recorded') || p.includes('allow') || p.includes('earned run');
                              let activeLogs = isPitching ? (logs.pitching || []) : (logs.batting || []);
                              
                              const gameDateStr = data.header?.competitions?.[0]?.date;
                              const gameDate = gameDateStr ? new Date(gameDateStr).getTime() : Date.now();

                              activeLogs = activeLogs.filter((l: any) => {
                                  // Ensure we only look at games BEFORE this game
                                  const logDate = new Date(l.date).getTime();
                                  if (logDate >= gameDate) return false;
                                  
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
                          
                          // If game hasn't happened yet, show everyone. If game is over/live, hide DNPs.
                          const isPregame = data.header?.competitions?.[0]?.status?.type?.state === 'pre';
                          if (!isPregame && row.didNotPlay) {
                              return null; 
                          }
                          
                          return row;
                      }).filter(Boolean); // Filter out the nulls

                      return (
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
                                          <th className="p-4 text-center">Final Result</th>
                                          <th className="p-4 text-right">Over Odds</th>
                                          <th className="p-4 text-right">Under Odds</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-sm">
                                      {tableRows.map((row, idx) => (
                                          <tr 
                                            key={idx} 
                                            onClick={() => {
                                                const isHome = row.team === homeTeam?.team?.abbreviation;
                                                const opponentId = isHome ? awayTeam?.team?.id : homeTeam?.team?.id;
                                                const opponentAbbrev = isHome ? awayTeam?.team?.abbreviation : homeTeam?.team?.abbreviation;
                                                navigate(`/props/analysis?playerId=${row.playerId}&propType=${encodeURIComponent(row.propType)}&propLine=${row.propLine}&opponentId=${opponentId}&opponentAbbrev=${opponentAbbrev}&isHome=${isHome}`);
                                            }}
                                            className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                                          >
                                              <td className="p-4 font-medium text-slate-500 group-hover:text-primary transition-colors">{row.game}</td>
                                              <td className="p-4 font-bold text-slate-700">{row.team}</td>
                                              <td className="p-4">
                                                  <div className="font-bold text-primary group-hover:underline">{row.name}</div>
                                              </td>
                                              <td className="p-4 text-slate-600">{row.propType}</td>
                                              <td className="p-4 font-black text-slate-800">{row.propLine}</td>
                                              <td className="p-4 text-center">
                                                  {row.l10 === '-' ? (
                                                      <span className="text-slate-400">-</span>
                                                  ) : (
                                                      <span className={`font-bold transition-colors ${parseInt(row.l10.split(' ')[0]) >= 6 ? 'text-emerald-600 group-hover:text-emerald-700' : parseInt(row.l10.split(' ')[0]) <= 4 ? 'text-rose-600 group-hover:text-rose-700' : 'text-slate-600 group-hover:text-slate-800'}`}>
                                                          {row.l10}
                                                      </span>
                                                  )}
                                              </td>
                                              <td className="p-4 text-center">
                                                  {row.gameResult === '-' ? (
                                                      <span className="text-slate-400">-</span>
                                                  ) : (
                                                      <div className="flex items-center justify-center gap-2">
                                                          <span className="font-black text-slate-800 text-lg">{row.gameResult}</span>
                                                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${row.hit === 'OVER' ? 'bg-emerald-100 text-emerald-700' : row.hit === 'UNDER' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                                                              {row.hit || '?'}
                                                          </span>
                                                      </div>
                                                  )}
                                              </td>
                                              <td className="p-4 text-right font-bold text-slate-500">{row.overOdds}</td>
                                              <td className="p-4 text-right font-bold text-slate-500">{row.underOdds}</td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      );
                  })()}
              </div>
          </div>
    );
};
