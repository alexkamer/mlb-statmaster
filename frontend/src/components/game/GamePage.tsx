import { SafeImage } from '../shared/SafeImage';
import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { fetchGameSummary, fetchSavedProps, fetchPlayerGameLogs, fetchGameOdds } from '../../api';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Clock, Info, Shield, Users, Ticket, TrendingUp, Zap, ArrowRight } from 'lucide-react';
import { WinProbability } from './WinProbability';
import { PlayByPlay } from './PlayByPlay';
import { LinescoreMatrix } from './LinescoreMatrix';
import { GamePropsTab } from './GamePropsTab';
import { GameOverviewTab } from './GameOverviewTab';
import { GameScoreboard } from './GameScoreboard';
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
  const [propBets, setPropBets] = React.useState<any>(null);
  const [gameOdds, setGameOdds] = React.useState<any>(null);
  const [propFilterTeam, setPropFilterTeam] = React.useState<string>('all');
  const [propFilterPlayer, setPropFilterPlayer] = React.useState<string>('all');
  const [propFilterType, setPropFilterType] = React.useState<string>('all');
  const [propFilterLine, setPropFilterLine] = React.useState<string>('all');
  const [loading, setLoading] = React.useState(true);
  const [expandedAtBats, setExpandedAtBats] = React.useState<Set<string>>(new Set());
  const [hoveredProb, setHoveredProb] = React.useState<any>(null);
  const [playerGameLogs, setPlayerGameLogs] = React.useState<any[]>([]);
  const [isFetchingLogs, setIsFetchingLogs] = React.useState(false);
  const [allPlayersLogs, setAllPlayersLogs] = React.useState<Record<string, any>>({});
  
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
  
  let activeTab = searchParams.get("tab") || "overview";
  const filterPlays = searchParams.get("filter") === "scoring" ? "scoring" : "all";

  React.useEffect(() => {
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
                      const logs = await fetchPlayerGameLogs(parseInt(pId), year);
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

  React.useEffect(() => {
      async function loadLogs() {
          if (propFilterPlayer !== 'all' && propFilterType !== 'all') {
              setIsFetchingLogs(true);
              const year = new Date().getFullYear();
              const logs = await fetchPlayerGameLogs(parseInt(propFilterPlayer), year);
              
              // Determine if we need batting or pitching logs based on the prop type
              const p = propFilterType.toLowerCase();
              let isPitching = (p.includes('strikeout') && !p.includes('batter')) || p.includes('out') || p.includes('allow') || p.includes('earned run');
              
              let activeLogs = isPitching ? (logs.pitching || []) : (logs.batting || []);
              
              // Filter out games where they didn't play (e.g., 0 ABs and not a starter, or 0 IP)
              activeLogs = activeLogs.filter((l: any) => {
                  if (isPitching) return parseFloat(l.ip || '0') > 0;
                  return (l.ab && parseInt(l.ab) > 0) || (l.pitches_faced && parseInt(l.pitches_faced) > 0);
              });
              
              setPlayerGameLogs(activeLogs.reverse()); // Chronological order for chart (oldest to newest)
              setIsFetchingLogs(false);
          } else {
              setPlayerGameLogs([]);
          }
      }
      loadLogs();
  }, [propFilterPlayer, propFilterType]);

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
      const [summary, odds] = await Promise.all([fetchGameSummary(gameId), fetchGameOdds(gameId)]);
      setData(summary);
      setGameOdds(odds);
      
      if (summary && summary.header) {
          const gameDate = summary.header.competitions?.[0]?.date;
          if (gameDate) {
              const dt = new Date(gameDate);
              const y = dt.getFullYear();
              const m = String(dt.getMonth() + 1).padStart(2, '0');
              const d = String(dt.getDate()).padStart(2, '0');
              const dateStr = `${y}${m}${d}`;
              
              // Fetch historical props from our database for this specific game
              const props = await fetchSavedProps(dateStr, [gameId]);
              if (props && Array.isArray(props) && props.length > 0) {
                  // Transform our DB format back into the format the UI expects
                  const mappedProps = props.map((p: any) => ({
                      athlete: { 
                          $ref: `http://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/athletes/${p.athlete_id}?lang=en&region=us`,
                          id: p.athlete_id,
                          displayName: p.athlete_name || `Player ${p.athlete_id}`
                      },
                      type: { name: p.prop_type },
                      current: { target: { displayValue: p.prop_line } },
                      odds: { american: { value: p.over_odds, displayValue: p.over_odds } },
                      _underOdds: p.under_odds,
                      _teamAbbrev: p.team_abbrev
                  }));
                  setPropBets(mappedProps);
              }
          }
      }
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
  const validTabs = isPregame ? ["matchup", "props"] : ["overview", "boxscore", "plays", "win_probability", "props"];
  // If the user navigates directly to a pregame game, or the state changes, ensure they land on a valid tab.
  // We MUST NOT force 'matchup' if they are already on 'props'.
  if (!validTabs.includes(activeTab)) {
      activeTab = isPregame ? "matchup" : "overview";
  }
  const awayTeam = header?.competitors?.find((c: any) => c.homeAway === "away");

  React.useEffect(() => {
      if (awayTeam && homeTeam) {
          document.title = `${awayTeam.team?.abbreviation || 'Away'} @ ${homeTeam.team?.abbreviation || 'Home'} | MLB Statmaster`;
      } else {
          document.title = "MLB Statmaster";
      }
      return () => { document.title = "MLB Statmaster"; };
  }, [awayTeam, homeTeam]);

  return (
    <div className="max-w-[1400px] mx-auto px-6 relative z-30">
      <GameScoreboard 
        data={data}
        gameId={gameId as string}
        awayTeam={awayTeam}
        homeTeam={homeTeam}
        header={header}
        isPregame={isPregame}
      />



      {/* Game Content Navigation */}
      {isPregame ? (
          <div className="flex gap-4 mb-6 border-b-2 border-slate-200 pb-2">
             <button onClick={() => handleTabChange("matchup")} className={`font-headline font-black text-xl uppercase tracking-widest transition-colors ${activeTab === "matchup" ? "text-primary" : "text-slate-300 hover:text-slate-400"}`}>Matchup Preview</button>
             {propBets && propBets.length > 0 && (
                 <button onClick={() => handleTabChange("props")} className={`font-headline font-black text-xl uppercase tracking-widest transition-colors ${activeTab === "props" ? "text-primary" : "text-slate-300 hover:text-slate-400"}`}>Prop Bets</button>
             )}
          </div>
      ) : (
      <div className="flex gap-4 mb-6 border-b-2 border-slate-200 pb-2">
         <button onClick={() => handleTabChange("overview")} className={`font-headline font-black text-xl uppercase tracking-widest transition-colors ${activeTab === "overview" ? "text-primary" : "text-slate-300 hover:text-slate-400"}`}>Overview</button>
         <button onClick={() => handleTabChange("boxscore")} className={`font-headline font-black text-xl uppercase tracking-widest transition-colors ${activeTab === "boxscore" ? "text-primary" : "text-slate-300 hover:text-slate-400"}`}>Box Score</button>
         {propBets && propBets.length > 0 && <button onClick={() => handleTabChange("props")} className={`font-headline font-black text-xl uppercase tracking-widest transition-colors ${activeTab === "props" ? "text-primary" : "text-slate-300 hover:text-slate-400"}`}>Prop Bets</button>}
         <button onClick={() => handleTabChange("plays")} className={`font-headline font-black text-xl uppercase tracking-widest transition-colors ${activeTab === "plays" ? "text-primary" : "text-slate-300 hover:text-slate-400"}`}>Play-by-Play</button>
         <button onClick={() => handleTabChange("win_probability")} className={`font-headline font-black text-xl uppercase tracking-widest transition-colors ${activeTab === "win_probability" ? "text-primary" : "text-slate-300 hover:text-slate-400"}`}>Win Probability</button>
      </div>
      )}

            {activeTab === "overview" && (
          <GameOverviewTab 
              data={data}
              gameId={gameId as string}
              gameOdds={gameOdds}
              awayTeam={awayTeam}
              homeTeam={homeTeam}
              header={header}
              isPregame={isPregame}
              boxscorePitchers={boxscorePitchers}
              onTabChange={handleTabChange}
          />
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

      {activeTab === "props" && propBets && propBets.length > 0 && (
          <GamePropsTab 
              data={data}
              propBets={propBets}
              awayTeam={awayTeam}
              homeTeam={homeTeam}
          />
      )}

      {activeTab === "plays" && (
        <PlayByPlay 
            data={data}
            awayTeam={awayTeam}
            homeTeam={homeTeam}
            searchParams={searchParams}
            setSearchParams={setSearchParams}
            filterPlays={filterPlays}
        />
      )}

      {activeTab === "win_probability" && (
        <WinProbability 
            data={data}
            awayTeam={awayTeam}
            homeTeam={homeTeam}
            hoveredProb={hoveredProb}
            setHoveredProb={setHoveredProb}
            TooltipStateSyncer={TooltipStateSyncer}
        />
      )}
    </div>
  );
};
