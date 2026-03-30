import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { fetchGameSummary } from '../api';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Clock, Info, Shield, Users, Ticket, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts';

const TooltipStateSyncer = ({ active, payload, onHover }: any) => {
    React.useEffect(() => {
        if (active && payload && payload.length) {
            const p = payload[0].payload;
            onHover((prev: any) => {
                if (prev?.homeWinPct === p.homeWinPct && prev?.awayWinPct === p.awayWinPct) return prev;
                return { homeWinPct: p.homeWinPct, awayWinPct: p.awayWinPct };
            });
        } else {
            onHover((prev: any) => prev !== null ? null : prev);
        }
    }, [active, payload, onHover]);
    return null;
};

export const GamePage = () => {
  const { gameId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [expandedAtBats, setExpandedAtBats] = React.useState<Set<string>>(new Set());
  const [hoveredProb, setHoveredProb] = React.useState<any>(null);
  
  const toggleAtBat = (abId: string) => {
      setExpandedAtBats(prev => {
          const newSet = new Set(prev);
          if (newSet.has(abId)) {
              newSet.delete(abId);
          } else {
              newSet.add(abId);
          }
          return newSet;
      });
  };
  
  let activeTab = searchParams.get("tab") || "boxscore";
  const filterPlays = searchParams.get("filter") === "scoring" ? "scoring" : "all";

  const handleTabChange = (tab: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", tab);
    setSearchParams(newParams);
  };
  
  const handleFilterChange = (filter: "all" | "scoring") => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("filter", filter);
    setSearchParams(newParams);
  };

  React.useEffect(() => {
    async function loadData() {
      if (!gameId) return;
      setLoading(true);
      const summary = await fetchGameSummary(gameId);
      setData(summary);
      setLoading(false);
    }
    loadData();
  }, [gameId]);

  const winProbData = React.useMemo(() => {
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

  const boxscorePitchers = React.useMemo(() => {
      const pitchers = new Map();
      if (data?.boxscore?.players) {
          data.boxscore.players.forEach((teamStats: any) => {
              const pitchingStats = teamStats.statistics?.find((s: any) => s.type === "pitching");
              if (pitchingStats && pitchingStats.athletes) {
                  pitchingStats.athletes.forEach((ath: any) => {
                      if (ath.athlete?.id) {
                          pitchers.set(ath.athlete.id, {
                              stats: ath.stats,
                              labels: pitchingStats.labels
                          });
                      }
                  });
              }
          });
      }
      return pitchers;
  }, [data]);

  if (loading) return <div className="min-h-screen bg-surface flex items-center justify-center font-headline font-black text-2xl text-primary uppercase tracking-widest animate-pulse">Loading Game Data...</div>;
  if (!data) return <div className="min-h-screen bg-surface flex items-center justify-center font-bold text-rose-500">Failed to load game data.</div>;

  const header = data.header?.competitions?.[0];
  const homeTeam = header?.competitors?.find((c: any) => c.homeAway === "home");
  const isPregame = header?.status?.type?.state === 'pre';
  const validTabs = isPregame ? ["matchup"] : ["boxscore", "plays", "win_probability"];
  if (isPregame && activeTab !== "matchup") {
      activeTab = "matchup";
  } else if (!isPregame && activeTab === "matchup") {
      activeTab = "boxscore";
  }
  if (!validTabs.includes(activeTab)) {
      activeTab = isPregame ? "matchup" : "boxscore";
  }
  const awayTeam = header?.competitors?.find((c: any) => c.homeAway === "away");

  return (
    <div className="max-w-[1400px] mx-auto px-6 relative z-30">
      {/* High-Level Scoreboard */}
      <div className="mb-12 mt-8 flex flex-col md:flex-row items-center justify-between bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Away Team */}
        <div className="flex-1 w-full p-8 flex flex-col items-center relative" style={{ backgroundColor: `#${awayTeam?.team?.color}10` }}>
            <img src={awayTeam?.team?.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/mlb/500/${awayTeam?.team?.abbreviation?.toLowerCase()}.png`} alt="away logo" className="w-24 h-24 object-contain mb-4" />
            <Link to={`/teams/${awayTeam?.id}`} className="font-headline font-black text-3xl uppercase tracking-tighter hover:underline" style={{ color: `#${awayTeam?.team?.color}` }}>{awayTeam?.team?.name}</Link>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">{awayTeam?.record?.[0]?.summary || ""}</p>
            <div className="mt-6 font-black text-6xl tabular-nums" style={{ color: `#${awayTeam?.team?.color}` }}>{awayTeam?.score || "0"}</div>
        </div>

        {/* Center Divider / Info */}
        <div className="px-8 py-6 flex flex-col items-center justify-center shrink-0 border-y md:border-y-0 md:border-x border-slate-200 bg-slate-50 relative z-10 w-full md:w-auto">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{header?.status?.type?.detail || "Final"}</p>
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 font-black text-sm my-4">@</div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest max-w-[120px] text-center">{data.gameInfo?.venue?.fullName}</p>
        </div>

        {/* Home Team */}
        <div className="flex-1 w-full p-8 flex flex-col items-center relative" style={{ backgroundColor: `#${homeTeam?.team?.color}10` }}>
            <img src={homeTeam?.team?.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/mlb/500/${homeTeam?.team?.abbreviation?.toLowerCase()}.png`} alt="home logo" className="w-24 h-24 object-contain mb-4" />
            <Link to={`/teams/${homeTeam?.id}`} className="font-headline font-black text-3xl uppercase tracking-tighter hover:underline" style={{ color: `#${homeTeam?.team?.color}` }}>{homeTeam?.team?.name}</Link>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">{homeTeam?.record?.[0]?.summary || ""}</p>
            <div className="mt-6 font-black text-6xl tabular-nums" style={{ color: `#${homeTeam?.team?.color}` }}>{homeTeam?.score || "0"}</div>
        </div>
      </div>
      
      {/* Linescore Matrix (Always Visible unless Pregame) */}
      {!isPregame && (
      <div className="mb-12 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="overflow-x-auto">
             <table className="w-full text-center border-collapse tabular-nums table-fixed">
                <thead>
                   <tr className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-widest border-b border-slate-200">
                       <th className="px-4 py-3 text-left w-48">Team</th>
                       {awayTeam?.linescores?.map((_: any, i: number) => (
                           <th key={i} className="px-3 py-3 text-center border-l border-slate-200/60">{i + 1}</th>
                       ))}
                       <th className="px-4 py-3 font-black text-primary border-l border-slate-200 w-[6%]">R</th>
                       <th className="px-4 py-3 font-black text-primary w-[6%]">H</th>
                       <th className="px-4 py-3 font-black text-primary w-[6%]">E</th>
                   </tr>
                </thead>
                <tbody className="font-medium text-slate-700">
                   <tr className="border-b border-slate-100 hover:bg-slate-50">
                       <td className="px-4 py-3 text-left font-black flex items-center gap-2" style={{ color: `#${awayTeam?.team?.color}` }}>
                           <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${awayTeam?.team?.abbreviation?.toLowerCase()}.png`} className="w-5 h-5 object-contain" alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                           {awayTeam?.team?.abbreviation}
                       </td>
                       {awayTeam?.linescores?.map((inning: any, i: number) => (
                           <td key={i} className="px-3 py-3 border-l border-slate-200/60">{inning.displayValue !== undefined ? inning.displayValue : "-"}</td>
                       ))}
                       <td className="px-4 py-3 font-black text-primary border-l border-slate-200">{awayTeam?.score}</td>
                       <td className="px-4 py-3 font-bold">{awayTeam?.hits}</td>
                       <td className="px-4 py-3 font-bold">{awayTeam?.errors}</td>
                   </tr>
                   <tr className="hover:bg-slate-50">
                       <td className="px-4 py-3 text-left font-black flex items-center gap-2" style={{ color: `#${homeTeam?.team?.color}` }}>
                           <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${homeTeam?.team?.abbreviation?.toLowerCase()}.png`} className="w-5 h-5 object-contain" alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                           {homeTeam?.team?.abbreviation}
                       </td>
                       {awayTeam?.linescores?.map((_: any, i: number) => {
                           const inning = homeTeam?.linescores?.[i];
                           return (
                               <td key={i} className="px-3 py-3 border-l border-slate-200/60">{inning ? (inning.displayValue !== undefined ? inning.displayValue : "-") : ""}</td>
                           );
                       })}
                       <td className="px-4 py-3 font-black text-primary border-l border-slate-200">{homeTeam?.score}</td>
                       <td className="px-4 py-3 font-bold">{homeTeam?.hits}</td>
                       <td className="px-4 py-3 font-bold">{homeTeam?.errors}</td>
                   </tr>
                </tbody>
             </table>
         </div>
         
         {/* Pitchers of Record */}
         {header?.status?.type?.completed && header?.status?.featuredAthletes && header.status.featuredAthletes.length > 0 && (
             <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-wrap items-center gap-x-8 gap-y-2">
                 {header.status.featuredAthletes.map((fa: any, idx: number) => {
                     const isWinner = fa.name === 'winningPitcher';
                     const isLoser = fa.name === 'losingPitcher';
                     const isSaver = fa.name === 'savingPitcher';
                     if (!isWinner && !isLoser && !isSaver) return null;
                     
                     const label = isWinner ? 'W' : isLoser ? 'L' : 'SV';
                     const colorClass = isWinner ? 'text-emerald-600' : isLoser ? 'text-rose-600' : 'text-blue-600';
                     const boxData = boxscorePitchers.get(fa.athlete.id);
                     let statStr = "";
                     
                     if (boxData) {
                         const ipIdx = boxData.labels.indexOf('IP');
                         const hIdx = boxData.labels.indexOf('H');
                         const erIdx = boxData.labels.indexOf('ER');
                         const bbIdx = boxData.labels.indexOf('BB');
                         const kIdx = boxData.labels.indexOf('K');
                         
                         const ip = ipIdx > -1 ? boxData.stats[ipIdx] : '-';
                         const h = hIdx > -1 ? boxData.stats[hIdx] : '-';
                         const er = erIdx > -1 ? boxData.stats[erIdx] : '-';
                         const bb = bbIdx > -1 ? boxData.stats[bbIdx] : '-';
                         const k = kIdx > -1 ? boxData.stats[kIdx] : '-';
                         
                         statStr = `${ip} IP, ${h} H, ${er} ER, ${bb} BB, ${k} K`;
                     }
                     
                     let seasonStat = "";
                     if (isWinner || isLoser) {
                         seasonStat = fa.athlete.record || "";
                     } else if (isSaver) {
                         seasonStat = fa.athlete.saves ? `${fa.athlete.saves} SV` : "";
                     }

                     return (
                         <div key={idx} className="flex items-center gap-2 text-sm">
                             <span className={`font-black ${colorClass}`}>{label}</span>
                             <Link to={`/players/${fa.athlete.id}`} className="font-bold text-slate-700 hover:underline">{fa.athlete.shortName}</Link>
                             {seasonStat && <span className="text-slate-500 font-medium text-xs">({seasonStat})</span>}
                             {statStr && <span className="text-slate-500 font-medium text-xs border-l border-slate-300 pl-2 ml-1">{statStr}</span>}
                         </div>
                     );
                 })}
             </div>
         )}
      </div>
      )}
      
      {/* Game Content Navigation */}
      {isPregame ? (
          <div className="flex gap-4 mb-6 border-b-2 border-slate-200 pb-2">
             <button onClick={() => handleTabChange("matchup")} className={`font-headline font-black text-xl uppercase tracking-widest transition-colors ${activeTab === "matchup" ? "text-primary" : "text-slate-300 hover:text-slate-400"}`}>Matchup Preview</button>
          </div>
      ) : (
      <div className="flex gap-4 mb-6 border-b-2 border-slate-200 pb-2">
         <button onClick={() => handleTabChange("boxscore")} className={`font-headline font-black text-xl uppercase tracking-widest transition-colors ${activeTab === "boxscore" ? "text-primary" : "text-slate-300 hover:text-slate-400"}`}>Box Score</button>
         <button onClick={() => handleTabChange("plays")} className={`font-headline font-black text-xl uppercase tracking-widest transition-colors ${activeTab === "plays" ? "text-primary" : "text-slate-300 hover:text-slate-400"}`}>Play-by-Play</button>
         <button onClick={() => handleTabChange("win_probability")} className={`font-headline font-black text-xl uppercase tracking-widest transition-colors ${activeTab === "win_probability" ? "text-primary" : "text-slate-300 hover:text-slate-400"}`}>Win Probability</button>
      </div>
      )}

      {activeTab === "boxscore" && (
          <div className="flex flex-col gap-8">

              {/* Player Box Scores */}
              <div className="flex flex-col gap-12">
                  {data.boxscore?.players?.map((teamBox: any, tIdx: number) => {
                      const tInfo = teamBox.team;
                      const battingStats = teamBox.statistics?.find((s: any) => s.type === "batting");
                      const pitchingStats = teamBox.statistics?.find((s: any) => s.type === "pitching");
                      
                      return (
                          <div key={tIdx} className="flex-1 min-w-0 flex flex-col gap-6">
                              <h3 className="font-headline font-black text-2xl uppercase tracking-widest text-primary flex items-center gap-3">
                                  <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${tInfo?.abbreviation?.toLowerCase()}.png`} className="w-8 h-8 object-contain" alt="" />
                                  {tInfo?.shortDisplayName}
                              </h3>

                              {/* Batting Box */}
                              {battingStats && (
                                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                                          <span className="font-bold text-xs uppercase tracking-widest text-slate-500">Batters</span>
                                      </div>
                                      <div className="overflow-x-auto">
                                          <table className="w-full text-left border-collapse tabular-nums">
                                              <thead>
                                                  <tr className="border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-400 font-black">
                                                      <th className="px-4 py-2 w-32">Player</th>
                                                      {battingStats.labels.map((lbl: string, i: number) => (
                                                          lbl !== "#P" ? <th key={i} className="px-2 py-2 text-right">{lbl}</th> : null
                                                      ))}
                                                  </tr>
                                              </thead>
                                              <tbody className="text-xs font-medium text-slate-700">
                                                  {battingStats.athletes?.map((ath: any, i: number) => {
                                                      const isStarter = ath.starter;
                                                      return (
                                                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                                          <td className="px-4 py-2 whitespace-nowrap flex items-center gap-2">
                                                              <span className="w-4 text-right text-xs font-black text-slate-300 shrink-0">{isStarter ? ath.batOrder : ""}</span>
                                                              <div className={`${isStarter ? "font-bold text-primary" : "font-medium text-slate-500 ml-4"}`}>
                                                                  <Link to={`/players/${ath.athlete?.id}`} className="hover:underline">{ath.athlete?.shortName}</Link>
                                                                  <span className="text-[10px] text-slate-400 ml-1 font-normal">{ath.athlete?.position?.abbreviation || ath.position?.abbreviation}</span>
                                                              </div>
                                                          </td>
                                                          {ath.stats?.map((stat: string, j: number) => (
                                                              battingStats.labels[j] !== "#P" ? <td key={j} className="px-2 py-2 text-right">{stat}</td> : null
                                                          ))}
                                                      </tr>
                                                      );
                                                  })}
                                                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-200 text-primary">
                                                      <td className="px-4 py-2">TOTALS</td>
                                                      {battingStats.totals?.map((tot: string, j: number) => (
                                                          battingStats.labels[j] !== "#P" ? <td key={j} className="px-2 py-2 text-right">{tot}</td> : null
                                                      ))}
                                                  </tr>
                                              </tbody>
                                          </table>
                                      </div>
                                  </div>
                              )}

                              {/* Pitching Box */}
                              {pitchingStats && (
                                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                                          <span className="font-bold text-xs uppercase tracking-widest text-slate-500">Pitchers</span>
                                      </div>
                                      <div className="overflow-x-auto">
                                          <table className="w-full text-left border-collapse tabular-nums">
                                              <thead>
                                                  <tr className="border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-400 font-black">
                                                      <th className="px-4 py-2 w-32">Player</th>
                                                      {pitchingStats.labels.map((lbl: string, i: number) => (
                                                          <th key={i} className="px-2 py-2 text-right">{lbl}</th>
                                                      ))}
                                                  </tr>
                                              </thead>
                                              <tbody className="text-xs font-medium text-slate-700">
                                                  {pitchingStats.athletes?.map((ath: any, i: number) => (
                                                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                                          <td className="px-4 py-2 font-bold text-primary whitespace-nowrap">
                                                              <Link to={`/players/${ath.athlete?.id}`} className="hover:underline">{ath.athlete?.shortName}</Link>
                                                          </td>
                                                          {ath.stats?.map((stat: string, j: number) => (
                                                              <td key={j} className="px-2 py-2 text-right">{stat}</td>
                                                          ))}
                                                      </tr>
                                                  ))}
                                                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-200 text-primary">
                                                      <td className="px-4 py-2">TOTALS</td>
                                                      {pitchingStats.totals?.map((tot: string, j: number) => (
                                                          <td key={j} className="px-2 py-2 text-right">{tot}</td>
                                                      ))}
                                                  </tr>
                                              </tbody>
                                          </table>
                                      </div>
                                  </div>
                              )}
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {activeTab === "plays" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-sm text-slate-700 uppercase tracking-wider">Play-by-Play</span>
                <div className="flex bg-slate-200 p-1 rounded-lg">
                    <button 
                        onClick={() => handleFilterChange("all")} 
                        className={`px-4 py-1 text-xs font-bold uppercase tracking-widest rounded-md transition-colors ${filterPlays === "all" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        All Plays
                    </button>
                    <button 
                        onClick={() => handleFilterChange("scoring")} 
                        className={`px-4 py-1 text-xs font-bold uppercase tracking-widest rounded-md transition-colors ${filterPlays === "scoring" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        Scoring Plays
                    </button>
                </div>
              </div>
              {data.plays?.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 font-bold">Play-by-play data is not available for this game yet.</div>
              ) : (
                  <div className="flex flex-col">
                      {(() => {
                          const plays = data.plays || [];
                          let atBats: any[] = [];
                          let currentAtBat: any = null;

                          const playerLookup: Record<string, any> = {};
                          if (data.rosters) {
                              data.rosters.forEach((r: any) => {
                                  r.roster?.forEach((entry: any) => {
                                      const ath = entry.athlete;
                                      if (ath) {
                                          playerLookup[ath.id] = { 
                                              lastName: ath.lastName, 
                                              shortName: ath.shortName,
                                              headshot: ath.headshot?.href || `https://a.espncdn.com/i/headshots/mlb/players/full/${ath.id}.png`
                                          };
                                      }
                                  });
                              });
                          }
                          if (data.boxscore?.players) {
                              data.boxscore.players.forEach((teamStats: any) => {
                                  teamStats.statistics?.forEach((statGroup: any) => {
                                      statGroup.athletes?.forEach((entry: any) => {
                                          const ath = entry.athlete;
                                          if (ath && !playerLookup[ath.id]) {
                                              playerLookup[ath.id] = {
                                                  lastName: ath.lastName || ath.displayName.split(' ').pop(),
                                                  shortName: ath.shortName || ath.displayName,
                                                  headshot: ath.headshot?.href || `https://a.espncdn.com/i/headshots/mlb/players/full/${ath.id}.png`
                                              };
                                          }
                                      });
                                  });
                              });
                          }
                          const normalize = (str: string) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : '';

                          const lastPitcherByHalf: Record<string, string> = {};

                          plays.forEach((play: any) => {
                              const isStartInning = play.type?.type === "start-inning" || play.type?.type === "end-inning";
                              if (isStartInning) {
                                  atBats.push({ type: "inning-marker", play });
                                  return;
                              }
                              
                              if (play.type?.type === "start-batterpitcher") {
                                  const pitcher = play.participants?.find((p: any) => p.type === 'pitcher');
                                  if (pitcher && pitcher.athlete?.id) {
                                      const half = play.period?.type; // "Top" or "Bottom"
                                      const lastPlay = atBats[atBats.length - 1];
                                      
                                      let isPitchingChange = false;
                                      let isStartOfInningPitcher = false;
                                      
                                      if (lastPitcherByHalf[half] !== pitcher.athlete.id) {
                                          isPitchingChange = true;
                                          lastPitcherByHalf[half] = pitcher.athlete.id;
                                      }
                                      
                                      let realLastPlay = lastPlay;
                                      if (lastPlay && lastPlay.type === "at-bat" && lastPlay.atBat.id === play.atBatId) {
                                          realLastPlay = atBats[atBats.length - 2];
                                      }
                                      
                                      if (realLastPlay && realLastPlay.type === "inning-marker") {
                                          // It's the start of an inning, we ALWAYS state the pitcher for the inning
                                          isStartOfInningPitcher = true;
                                          isPitchingChange = false; // Don't call it a change if it's the start of an inning
                                      }
                                      
                                      if (isPitchingChange || isStartOfInningPitcher) {
                                          const pBlock = { 
                                              type: "pitching-change", 
                                              play, 
                                              pitcherId: pitcher.athlete.id, 
                                              isChange: isPitchingChange 
                                          };
                                          if (currentAtBat && currentAtBat.id === play.atBatId) {
                                              const idx = atBats.findIndex(a => a.type === "at-bat" && a.atBat.id === play.atBatId);
                                              if (idx !== -1) {
                                                  atBats.splice(idx, 0, pBlock);
                                              } else {
                                                  atBats.push(pBlock);
                                              }
                                          } else {
                                              atBats.push(pBlock);
                                          }
                                      }
                                  }
                              }

                              if (play.atBatId) {
                                  if (!currentAtBat || currentAtBat.id !== play.atBatId) {
                                      currentAtBat = { id: play.atBatId, plays: [], resultPlay: null, startPlay: null, scoringPlay: false };
                                      atBats.push({ type: "at-bat", atBat: currentAtBat });
                                  }
                                  
                                  currentAtBat.plays.push(play);
                                  if (play.scoringPlay) currentAtBat.scoringPlay = true;
                                  if (play.type?.type === "play-result") currentAtBat.resultPlay = play;
                                  if (play.type?.type === "start-batterpitcher") currentAtBat.startPlay = play;
                              } else {
                                  atBats.push({ type: "misc", play });
                              }
                          });

                          let filteredItems = atBats.filter(item => {
                              if (filterPlays === "scoring") {
                                  if (item.type === "at-bat") return item.atBat.scoringPlay;
                                  if (item.type === "misc") return item.play.scoringPlay;
                                  return item.type === "inning-marker" || item.type === "pitching-change"; 
                              }
                              return true;
                          });
                          
                          // Clean up consecutive or trailing markers that happen after filtering
                          filteredItems = filteredItems.filter((item, idx, arr) => {
                              if (item.type === "inning-marker" || item.type === "pitching-change") {
                                  const isEndInning = item.play.type.type === "end-inning";
                                  if (isEndInning) {
                                      // Only keep end-inning if there was an actual play before it in this inning
                                      let hasPrevPlay = false;
                                      for (let i = idx - 1; i >= 0; i--) {
                                          if (arr[i].type === "at-bat" || arr[i].type === "misc") {
                                              hasPrevPlay = true;
                                              break;
                                          }
                                          if (arr[i].type === "inning-marker" && arr[i].play.type.type === "start-inning") {
                                              break;
                                          }
                                      }
                                      return hasPrevPlay;
                                  } else {
                                      // Start-inning / pitching-change should be kept if there's a play AFTER them
                                      let hasNextPlay = false;
                                      for (let i = idx + 1; i < arr.length; i++) {
                                          if (arr[i].type === "at-bat" || arr[i].type === "misc") {
                                              hasNextPlay = true;
                                              break;
                                          }
                                          if (arr[i].type === "inning-marker" && arr[i].play.type.type === "start-inning") {
                                              break; // Hit the next inning before finding a play, this is an orphan
                                          }
                                      }
                                      return hasNextPlay;
                                  }
                              }
                              return true;
                          });

                          return filteredItems.map((item: any, idx: number) => {
                              if (item.type === "inning-marker") {
                                  const play = item.play;
                                  
                                  if (play.type.type === "end-inning") {
                                      // It's the end of a half-inning, so we show the runs/hits/errors summary.
                                      // The team parameter on this play indicates who was batting.
                                      // "Middle of 1st" -> Away Team batted in the Top of 1st
                                      // "End of 1st" -> Home Team batted in the Bottom of 1st
                                      
                                      const isMid = play.period?.type === "Mid";
                                      const inningIdx = play.period?.number ? play.period.number - 1 : 0;
                                      
                                      let summaryStr = "0 RUNS, 0 HITS, 0 ERRORS";
                                      if (isMid && awayTeam?.linescores?.[inningIdx]) {
                                          const ls = awayTeam.linescores[inningIdx];
                                          summaryStr = `${ls.displayValue || 0} RUNS, ${ls.hits || 0} HITS, ${ls.errors || 0} ERRORS`;
                                      } else if (!isMid && homeTeam?.linescores?.[inningIdx]) {
                                          const ls = homeTeam.linescores[inningIdx];
                                          summaryStr = `${ls.displayValue || 0} RUNS, ${ls.hits || 0} HITS, ${ls.errors || 0} ERRORS`;
                                      }
                                      
                                      return (
                                          <div key={`inning-${idx}`} className="bg-white px-6 py-2 border-b border-slate-100 font-bold text-[10px] uppercase tracking-widest text-slate-500 flex justify-end">
                                              <span>{summaryStr}</span>
                                          </div>
                                      );
                                  } else {
                                      let team = null;
                                      if (play.team?.id) {
                                          if (play.team.id === homeTeam?.id) team = homeTeam?.team;
                                          if (play.team.id === awayTeam?.id) team = awayTeam?.team;
                                      }
                                      
                                      const periodType = play.period?.type || "Top"; // "Top" or "Bottom"
                                      const periodNum = play.period?.displayValue || play.period?.number || ""; // e.g. "1st Inning"
                                      const periodShort = periodNum.toString().split(' ')[0]; // "1st"
                                      
                                      return (
                                          <div key={`inning-${idx}`} className="bg-slate-100 px-6 py-2 border-y border-slate-200 font-black text-xs uppercase tracking-widest text-slate-500 sticky top-0 z-10 shadow-sm flex items-center justify-between">
                                              <div className="flex items-center gap-3">
                                                  {team && <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/${team.abbreviation.toLowerCase()}.png`} alt={team.abbreviation} className="w-5 h-5 object-contain" />}
                                                  <span>{team ? team.name : ""} - {periodType} {periodShort}</span>
                                              </div>
                                          </div>
                                      );
                                  }
                              }

                              if (item.type === "pitching-change") {
                                  const pitcher = playerLookup[item.pitcherId];
                                  const play = item.play;
                                  let team = null;
                                  if (play.team?.id) {
                                      if (play.team.id === homeTeam?.id) team = awayTeam?.team;
                                      if (play.team.id === awayTeam?.id) team = homeTeam?.team;
                                  }
                                  
                                  return (
                                      <div key={`pitcher-${idx}`} className={`px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50 text-slate-600 font-bold uppercase tracking-widest text-[10px]`}>
                                          <div className="flex-1">
                                              <span className="text-slate-900 font-black">{pitcher?.shortName?.toUpperCase() || pitcher?.lastName?.toUpperCase()} PITCHING FOR {team?.abbreviation}</span>
                                          </div>
                                          <div className="shrink-0 flex items-center justify-end">
                                              <div className="flex items-center gap-4 w-20 pl-4 mr-4 text-slate-900">
                                                  <div className="flex flex-col flex-1 items-center">
                                                      <span className="text-[10px] font-black uppercase tracking-widest leading-none">{awayTeam?.team?.abbreviation}</span>
                                                  </div>
                                                  <div className="flex flex-col flex-1 items-center">
                                                      <span className="text-[10px] font-black uppercase tracking-widest leading-none">{homeTeam?.team?.abbreviation}</span>
                                                  </div>
                                              </div>
                                              <div className="w-10"></div>
                                          </div>
                                      </div>
                                  );
                              }

                              if (item.type === "at-bat") {
                                  const ab = item.atBat;
                                  const isExpanded = expandedAtBats.has(ab.id);
                                  const resultPlay = ab.resultPlay || ab.plays[ab.plays.length - 1];
                                  const isScoring = ab.scoringPlay;
                                  
                                  let displayText = resultPlay.text;
                                  let batter = null;
                                  let pitcher = null;
                                  if (resultPlay.participants) {
                                      const batterId = resultPlay.participants.find((p: any) => p.type === 'batter')?.athlete?.id;
                                      const pitcherId = resultPlay.participants.find((p: any) => p.type === 'pitcher')?.athlete?.id;
                                      
                                      if (batterId && playerLookup[batterId]) {
                                          batter = playerLookup[batterId];
                                          const { lastName, shortName } = batter;
                                          const normText = normalize(displayText);
                                          const normLastName = normalize(lastName);
                                          if (normLastName && normText.startsWith(normLastName)) {
                                              displayText = shortName + displayText.substring(lastName.length);
                                          }
                                      }
                                      if (pitcherId && playerLookup[pitcherId]) {
                                          pitcher = playerLookup[pitcherId];
                                      }
                                  }
                                  
                                  return (
                                      <div key={`ab-${ab.id}-${idx}`} className="border-b border-slate-100">
                                          {/* At-Bat Header */}
                                          <div 
                                              onClick={() => toggleAtBat(ab.id)}
                                              className={`px-4 py-3 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors ${isScoring ? "bg-emerald-50/50 hover:bg-emerald-50" : ""} ${isExpanded ? "bg-slate-50" : ""}`}
                                          >
                                              <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
                                                  <div className="flex flex-col justify-center pr-4">
                                                      <p className={`text-sm leading-snug ${isScoring ? "font-black text-emerald-800" : "font-bold text-primary"}`}>
                                                          {displayText}
                                                      </p>
                                                  </div>
                                              </div>
                                              
                                              <div className="shrink-0 flex items-center justify-end">
                                                  {(resultPlay.awayScore !== undefined && resultPlay.homeScore !== undefined) ? (
                                                      <div className="flex items-center gap-4 w-20 text-slate-700 font-bold border-l border-slate-200 pl-4 mr-4">
                                                          <div className="flex flex-col flex-1 items-center justify-center h-full">
                                                              <span className="text-xs tabular-nums leading-none">{resultPlay.awayScore}</span>
                                                          </div>
                                                          <div className="flex flex-col flex-1 items-center justify-center h-full">
                                                              <span className="text-xs tabular-nums leading-none">{resultPlay.homeScore}</span>
                                                          </div>
                                                      </div>
                                                  ) : null}
                                                  <div className="text-slate-400 w-10 flex justify-end">
                                                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                  </div>
                                              </div>
                                          </div>
                                          
                                          {/* Pitches / Detailed Plays */}
                                          {isExpanded && (
                                              <div className="bg-slate-50/50 border-t border-slate-100 pl-24 flex flex-col">
                                                  {ab.plays.filter((p: any) => p.type?.type !== "start-batterpitcher" && p.type?.type !== "end-batterpitcher" && p.type?.type !== "play-result").map((play: any, pIdx: number, arr: any[]) => {
                                                      const isPitch = play.pitchVelocity !== undefined || play.pitchType !== undefined;
                                                      let pitchNumber = null;
                                                      let pitchColor = "bg-slate-200 text-slate-500"; // default grey
                                                      
                                                      if (isPitch && play.text) {
                                                          const match = play.text.match(/^Pitch (\d+)\s*:\s*(.*)$/i);
                                                          if (match) {
                                                              pitchNumber = match[1];
                                                              const outcome = match[2].toLowerCase();
                                                              if (outcome.includes("ball in play") || outcome.includes("ball") && !outcome.includes("foul")) {
                                                                  if (outcome.includes("ball in play")) {
                                                                      pitchColor = "bg-blue-600 text-white"; // blue for in play
                                                                  } else {
                                                                      pitchColor = "bg-emerald-500 text-white"; // green for ball
                                                                  }
                                                              } else if (outcome.includes("strike") && !outcome.includes("foul")) {
                                                                  pitchColor = "bg-rose-500 text-white"; // red for strike
                                                              } else if (outcome.includes("foul")) {
                                                                  const startingStrikes = pIdx > 0 ? (arr[pIdx - 1].resultCount?.strikes || 0) : 0;
                                                                  if (startingStrikes === 2 && !outcome.includes("strike 3")) {
                                                                       pitchColor = "bg-slate-300 text-slate-600"; // grey for foul with 2 strikes
                                                                  } else {
                                                                       pitchColor = "bg-rose-400 text-white"; // lighter red for foul
                                                                  }
                                                              }
                                                              // strip 'Pitch X :' from the display text
                                                              play.display_text = match[2];
                                                          }
                                                      }

                                                      return (
                                                          <div key={`p-${play.id}-${pIdx}`} className="flex items-center gap-3 py-1 border-b border-slate-100 last:border-0">
                                                              {isPitch && (
                                                                  <div className="w-12 shrink-0 flex flex-col items-end border-r border-slate-200 pr-2">
                                                                      {play.pitchVelocity ? <span className="text-[10px] font-black text-slate-700 tracking-tighter">{play.pitchVelocity} <span className="text-[8px] font-bold text-slate-400 uppercase">MPH</span></span> : <span className="text-[10px] text-slate-400 font-bold">-</span>}
                                                                      {play.pitchType && <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter text-right leading-none mt-0.5">{play.pitchType.text}</span>}
                                                                  </div>
                                                              )}
                                                              {!isPitch && <div className="w-12 shrink-0 border-r border-slate-200 pr-2"></div>}
                                                              
                                                              <div className="flex-1 py-1 flex items-center gap-2">
                                                                  {pitchNumber && (
                                                                      <div className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black ${pitchColor}`}>
                                                                          {pitchNumber}
                                                                      </div>
                                                                  )}
                                                                  <p className="text-xs text-slate-600">
                                                                      {play.display_text || play.text}
                                                                  </p>
                                                              </div>
                                                              {play.pitchCoordinate && (
                                                                  <div className="shrink-0 w-12 flex justify-end pr-3 relative h-8 items-center">
                                                                      {/* Full Pitch Container (represents X:55-195, Y:112-220) */}
                                                                      <div className="w-6 h-6 relative">
                                                                          {/* The actual Strikezone Box (inset 25% on all sides) */}
                                                                          <div className="absolute inset-x-0 inset-y-0 m-auto w-[50%] h-[50%] border border-slate-300 bg-white">
                                                                              {/* Grid lines */}
                                                                              <div className="absolute top-1/3 left-0 right-0 border-b border-slate-200" />
                                                                              <div className="absolute top-2/3 left-0 right-0 border-b border-slate-200" />
                                                                              <div className="absolute left-1/3 top-0 bottom-0 border-r border-slate-200" />
                                                                              <div className="absolute left-2/3 top-0 bottom-0 border-r border-slate-200" />
                                                                          </div>
                                                                          
                                                                          {/* Pitch location dot */}
                                                                          <div 
                                                                              className={`absolute w-2 h-2 rounded-full ${pitchColor} shadow-sm z-10`}
                                                                              style={{
                                                                                  // Adjusted ESPN coordinate mapping to fit inset box
                                                                                  left: `calc(${Math.max(-10, Math.min(110, ((play.pitchCoordinate.x - 55) / 140) * 100))}% - 4px)`,
                                                                                  top: `calc(${Math.max(-10, Math.min(110, ((play.pitchCoordinate.y - 112) / 108) * 100))}% - 4px)`
                                                                              }}
                                                                          />
                                                                      </div>
                                                                  </div>
                                                              )}
                                                          </div>
                                                      );
                                                  })}
                                              </div>
                                          )}
                                      </div>
                                  );
                              }

                              // Misc plays (e.g. balks, pickoffs, etc not tied to an AB)
                              const play = item.play;
                              const isScoring = play.scoringPlay;
                              return (
                                  <div key={`misc-${play.id}-${idx}`} className={`px-4 py-3 border-b border-slate-100 flex items-center gap-4 ${isScoring ? "bg-emerald-50/50" : ""}`}>
                                      <div className="flex-1 min-w-0 flex items-center justify-between">
                                          <div className="flex flex-col justify-center pr-4">
                                              <p className={`text-sm leading-snug ${isScoring ? "font-black text-emerald-800" : "font-bold text-slate-500"}`}>
                                                  <span className="text-[10px] font-black uppercase tracking-widest leading-none text-slate-400 mr-2 border border-slate-200 px-1 py-0.5 rounded-sm bg-white">MISC PLAY</span> {play.text}
                                              </p>
                                          </div>
                                      </div>
                                      
                                      <div className="shrink-0 flex items-center justify-end">
                                          {(play.awayScore !== undefined && play.homeScore !== undefined) ? (
                                              <div className="flex items-center gap-4 w-20 text-slate-700 font-bold border-l border-slate-200 pl-4 mr-4">
                                                  <div className="flex flex-col flex-1 items-center justify-center h-full">
                                                      <span className="text-xs tabular-nums leading-none">{play.awayScore}</span>
                                                  </div>
                                                  <div className="flex flex-col flex-1 items-center justify-center h-full">
                                                      <span className="text-xs tabular-nums leading-none">{play.homeScore}</span>
                                                  </div>
                                              </div>
                                          ) : <div className="w-20 border-l border-slate-200 pl-4 mr-4"></div>}
                                          <div className="w-10"></div>
                                      </div>
                                  </div>
                              );
                          });
                      })()}
                  </div>
              )}
          </div>
      )}


      {activeTab === "matchup" && (
          <div className="flex flex-col gap-8">
              {/* Matchup Predictor & Odds */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Predictor */}
                  {data.predictor && (
                      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                              <TrendingUp className="w-5 h-5 text-slate-400" />
                              <h3 className="font-headline font-black uppercase tracking-widest text-slate-700">Matchup Predictor</h3>
                          </div>
                          <div className="p-8 flex-1 flex flex-col justify-center">
                              <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-3">
                                      <img src={awayTeam?.team?.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/mlb/500/${awayTeam?.team?.abbreviation?.toLowerCase()}.png`} className="w-8 h-8 object-contain" alt="" />
                                      <span className="font-bold text-xl" style={{ color: `#${awayTeam?.team?.color}` }}>{data.predictor.awayTeam?.gameProjection}%</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                      <span className="font-bold text-xl" style={{ color: `#${homeTeam?.team?.color}` }}>{data.predictor.homeTeam?.gameProjection}%</span>
                                      <img src={homeTeam?.team?.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/mlb/500/${homeTeam?.team?.abbreviation?.toLowerCase()}.png`} className="w-8 h-8 object-contain" alt="" />
                                  </div>
                              </div>
                              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                  <div className="h-full" style={{ width: `${data.predictor.awayTeam?.gameProjection}%`, backgroundColor: `#${awayTeam?.team?.color}` }}></div>
                                  <div className="h-full" style={{ width: `${data.predictor.homeTeam?.gameProjection}%`, backgroundColor: `#${homeTeam?.team?.color}` }}></div>
                              </div>
                          </div>
                      </div>
                  )}

                  {/* Odds */}
                  {data.pickcenter && data.pickcenter.length > 0 && (
                      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                              <Shield className="w-5 h-5 text-slate-400" />
                              <h3 className="font-headline font-black uppercase tracking-widest text-slate-700">Odds & Lines</h3>
                          </div>
                          <div className="p-6 flex-1 flex flex-col gap-4 justify-center">
                              {data.pickcenter.slice(0, 2).map((pc: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                                      <div className="flex items-center gap-3">
                                          {pc.provider?.logos?.[0]?.href ? (
                                              <img src={pc.provider.logos[0].href} className="h-6 object-contain" alt={pc.provider.name} />
                                          ) : (
                                              <span className="font-bold text-slate-600 text-sm">{pc.provider?.name || 'Odds'}</span>
                                          )}
                                      </div>
                                      <div className="flex gap-6 text-sm font-medium">
                                          <div className="flex flex-col items-end">
                                              <span className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Moneyline</span>
                                              <div className="flex flex-col items-end gap-0.5 mt-0.5">
                                                  <div className="flex items-center gap-1">
                                                      <span className="text-xs font-bold text-slate-500">{awayTeam?.team?.abbreviation}</span>
                                                      <span className="font-black text-primary w-10 text-right">{pc.awayTeamOdds?.moneyLine > 0 ? `+${pc.awayTeamOdds.moneyLine}` : pc.awayTeamOdds?.moneyLine || '-'}</span>
                                                  </div>
                                                  <div className="flex items-center gap-1">
                                                      <span className="text-xs font-bold text-slate-500">{homeTeam?.team?.abbreviation}</span>
                                                      <span className="font-black text-primary w-10 text-right">{pc.homeTeamOdds?.moneyLine > 0 ? `+${pc.homeTeamOdds.moneyLine}` : pc.homeTeamOdds?.moneyLine || '-'}</span>
                                                  </div>
                                              </div>
                                          </div>
                                          {pc.overUnder && (
                                              <div className="flex flex-col items-end">
                                                  <span className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">O/U</span>
                                                  <span className="font-black text-primary mt-0.5">{pc.overUnder}</span>
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
              </div>

              {/* Probable Pitchers */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                      <Users className="w-5 h-5 text-slate-400" />
                      <h3 className="font-headline font-black uppercase tracking-widest text-slate-700">Probable Pitchers</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                      {[awayTeam, homeTeam].map((teamData: any, idx: number) => {
                          const probable = teamData?.probables?.[0]?.athlete;
                          
                          // Look up season stats from boxscore or leaders if available. 
                          // Often in pre-game, probables might not have detailed stats directly under them in the "header" 
                          // but wait, we can just show the basics.
                          return (
                              <div key={idx} className="p-8 flex items-center gap-6">
                                  <div className="w-24 h-24 rounded-full bg-slate-100 border-2 overflow-hidden shadow-sm shrink-0 flex items-center justify-center text-slate-300 font-black text-xs" style={{ borderColor: `#${teamData?.team?.color}` }}>
                                      {probable?.headshot?.href ? (
                                          <img src={probable.headshot.href} alt={probable.displayName} className="w-full h-full object-cover object-top bg-white" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                      ) : (
                                          <span>TBD</span>
                                      )}
                                  </div>
                                  <div className="flex flex-col justify-center">
                                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: `#${teamData?.team?.color}` }}>{teamData?.team?.name} Starter</span>
                                      {probable ? (
                                          <>
                                              <Link to={`/players/${probable.id}?tab=stats&category=pitching`} className="font-headline font-black text-2xl text-primary hover:underline">{probable.displayName}</Link>
                                              <div className="flex items-center gap-2 mt-1">
                                                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{probable.position?.abbreviation || 'P'}</span>
                                                  {probable.throws?.abbreviation && (
                                                      <>
                                                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Throws {probable.throws.abbreviation}</span>
                                                      </>
                                                  )}
                                                  {probable.statsSummary && (
                                                      <>
                                                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{probable.statsSummary}</span>
                                                      </>
                                                  )}
                                              </div>
                                          </>
                                      ) : (
                                          <p className="font-headline font-black text-xl text-slate-400 mt-1">To Be Determined</p>
                                      )}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>

              {/* Game Info */}
              {data.gameInfo && (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
                      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                          <Info className="w-5 h-5 text-slate-400" />
                          <h3 className="font-headline font-black uppercase tracking-widest text-slate-700">Game Information</h3>
                      </div>
                      <div className="flex flex-col md:flex-row">
                          {data.gameInfo.venue?.images?.[0]?.href && (
                              <div className="w-full md:w-1/3 h-48 md:h-auto bg-slate-200 relative">
                                  <img src={data.gameInfo.venue.images[0].href} className="absolute inset-0 w-full h-full object-cover" alt="Venue" />
                              </div>
                          )}
                          <div className="p-6 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
                              <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Venue</p>
                                  <p className="font-bold text-primary">{data.gameInfo.venue?.fullName || 'TBD Venue'}</p>
                                  {(data.gameInfo.venue?.address?.city || data.gameInfo.venue?.address?.state) && (
                                      <p className="text-sm font-medium text-slate-500 mt-0.5">
                                          {data.gameInfo.venue.address.city}{data.gameInfo.venue.address.city && data.gameInfo.venue.address.state ? ', ' : ''}{data.gameInfo.venue.address.state}
                                      </p>
                                  )}
                              </div>
                              {data.ticketsInfo && (
                                  <div>
                                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Tickets</p>
                                      <a href={data.ticketsInfo.seatSituation?.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-bold text-sm text-secondary hover:text-primary transition-colors">
                                          <Ticket className="w-4 h-4" />
                                          {data.ticketsInfo.seatSituation?.summary || "Find Tickets"}
                                      </a>
                                  </div>
                              )}
                              {data.broadcasts && data.broadcasts.length > 0 && (
                                  <div>
                                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Broadcast</p>
                                      <p className="font-bold text-primary">{data.broadcasts[0].media?.shortName || data.broadcasts[0].market?.name}</p>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              )}
          </div>
      )}

      {activeTab === "win_probability" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-6">
              {(() => {
                  const latestWp = data.winprobability?.[data.winprobability.length - 1];
                  const defaultProb = latestWp ? {
                      homeWinPct: latestWp.homeWinPercentage * 100,
                      awayWinPct: (1 - latestWp.homeWinPercentage) * 100
                  } : null;
                  const currentProb = hoveredProb || defaultProb;
                  
                  return (
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
                  );
              })()}
              
              {!winProbData ? (
                  <div className="p-12 text-center text-slate-500 font-bold">Win probability data is not available for this game.</div>
              ) : (
                  <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%" minHeight={400} minWidth={100}>
                          <AreaChart 
                              data={winProbData.chartData}
                              margin={{ top: 20, right: 10, left: 10, bottom: 25 }}
                          >
                              <defs>
                                  <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="100%" gradientUnits="userSpaceOnUse">
                                      {/* Top half: Away Team (100% to 50%) */}
                                      <stop offset="0%" stopColor={`#${awayTeam?.team?.color || "000000"}`} stopOpacity={0.8} />
                                      <stop offset="50%" stopColor={`#${awayTeam?.team?.color || "000000"}`} stopOpacity={0} />
                                      
                                      {/* Bottom half: Home Team (50% to 0%) */}
                                      <stop offset="50%" stopColor={`#${homeTeam?.team?.color || "000000"}`} stopOpacity={0} />
                                      <stop offset="100%" stopColor={`#${homeTeam?.team?.color || "000000"}`} stopOpacity={0.8} />
                                  </linearGradient>
                                  <linearGradient id="splitStroke" x1="0" y1="0" x2="0" y2="100%" gradientUnits="userSpaceOnUse">
                                      <stop offset="49.9%" stopColor={`#${awayTeam?.team?.color || "000000"}`} stopOpacity={1} />
                                      <stop offset="50%" stopColor={`#${homeTeam?.team?.color || "000000"}`} stopOpacity={1} />
                                  </linearGradient>
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
                                                          <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg max-w-sm z-50">
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
      )}
    </div>
  );
};
