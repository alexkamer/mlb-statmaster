import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { fetchGameSummary } from '../api';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';

export const GamePage = () => {
  const { gameId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [expandedAtBats, setExpandedAtBats] = React.useState<Set<string>>(new Set());
  
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
  
  const activeTab = searchParams.get("tab") === "plays" ? "plays" : "boxscore";
  const filterPlays = searchParams.get("filter") === "scoring" ? "scoring" : "all";

  const handleTabChange = (tab: "boxscore" | "plays") => {
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

  if (loading) return <div className="min-h-screen bg-surface flex items-center justify-center font-headline font-black text-2xl text-primary uppercase tracking-widest animate-pulse">Loading Game Data...</div>;
  if (!data) return <div className="min-h-screen bg-surface flex items-center justify-center font-bold text-rose-500">Failed to load game data.</div>;

  const header = data.header?.competitions?.[0];
  const homeTeam = header?.competitors?.find((c: any) => c.homeAway === "home");
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
      
            {/* Game Content Navigation */}
      <div className="flex gap-4 mb-6 border-b-2 border-slate-200 pb-2">
         <button onClick={() => handleTabChange("boxscore")} className={`font-headline font-black text-xl uppercase tracking-widest transition-colors ${activeTab === "boxscore" ? "text-primary" : "text-slate-300 hover:text-slate-400"}`}>Box Score</button>
         <button onClick={() => handleTabChange("plays")} className={`font-headline font-black text-xl uppercase tracking-widest transition-colors ${activeTab === "plays" ? "text-primary" : "text-slate-300 hover:text-slate-400"}`}>Play-by-Play</button>
      </div>

      {activeTab === "boxscore" && (
          <div className="flex flex-col gap-8">
              
              {/* Linescore Matrix */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
                                   <td key={i} className="px-3 py-3 border-l border-slate-200/60">{inning.displayValue || "-"}</td>
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
                               {homeTeam?.linescores?.map((inning: any, i: number) => (
                                   <td key={i} className="px-3 py-3 border-l border-slate-200/60">{inning.displayValue || "-"}</td>
                               ))}
                               <td className="px-4 py-3 font-black text-primary border-l border-slate-200">{homeTeam?.score}</td>
                               <td className="px-4 py-3 font-bold">{homeTeam?.hits}</td>
                               <td className="px-4 py-3 font-bold">{homeTeam?.errors}</td>
                           </tr>
                        </tbody>
                     </table>
                 </div>
              </div>

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

                          plays.forEach((play: any) => {
                              const isStartInning = play.type?.type === "start-inning" || play.type?.type === "end-inning";
                              if (isStartInning) {
                                  atBats.push({ type: "inning-marker", play });
                                  return;
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
                                  return item.type === "inning-marker"; 
                              }
                              return true;
                          });
                          
                          // Clean up consecutive inning markers that happen after filtering
                          filteredItems = filteredItems.filter((item, idx, arr) => {
                              if (item.type === "inning-marker") {
                                  if (idx === arr.length - 1) return false;
                                  if (arr[idx+1].type === "inning-marker") return false;
                              }
                              return true;
                          });

                          return filteredItems.map((item: any, idx: number) => {
                              if (item.type === "inning-marker") {
                                  return (
                                      <div key={`inning-${idx}`} className="bg-slate-100 px-6 py-2 border-y border-slate-200 font-black text-xs uppercase tracking-widest text-slate-500 sticky top-0 z-10 shadow-sm flex items-center justify-between">
                                          <span>{item.play.text}</span>
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
                                              className={`px-6 py-4 flex items-center gap-6 cursor-pointer hover:bg-slate-50 transition-colors ${isScoring ? "bg-emerald-50/50 hover:bg-emerald-50" : ""} ${isExpanded ? "bg-slate-50" : ""}`}
                                          >
                                              <div className="w-24 shrink-0 flex items-center justify-between border-r border-slate-200 pr-4 text-slate-700 font-bold">
                                                  {(resultPlay.awayScore !== undefined && resultPlay.homeScore !== undefined) ? (
                                                      <div className="flex items-center gap-4 w-full">
                                                          <div className="flex flex-col flex-1">
                                                              <span className="text-[10px] font-black uppercase tracking-widest leading-none text-slate-400">{awayTeam?.team?.abbreviation}</span>
                                                              <span className="text-sm tabular-nums leading-none mt-1">{resultPlay.awayScore}</span>
                                                          </div>
                                                          <div className="flex flex-col flex-1 items-end">
                                                              <span className="text-[10px] font-black uppercase tracking-widest leading-none text-slate-400">{homeTeam?.team?.abbreviation}</span>
                                                              <span className="text-sm tabular-nums leading-none mt-1">{resultPlay.homeScore}</span>
                                                          </div>
                                                      </div>
                                                  ) : <span className="w-8"></span>}
                                              </div>
                                              <div className="flex-1 min-w-0 flex items-center justify-between gap-6">
                                                  <div className="flex flex-col justify-center pr-4">
                                                      {ab.startPlay && <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{ab.startPlay.text}</p>}
                                                      <p className={`text-base leading-snug ${isScoring ? "font-black text-emerald-800" : "font-bold text-primary"}`}>
                                                          {displayText}
                                                      </p>
                                                  </div>
                                                  
                                                  <div className="shrink-0 flex items-center border-l border-slate-200 pl-6 h-10 w-[200px]">
                                                      {(pitcher || batter) && (
                                                          <div className="flex items-center gap-6 w-full">
                                                              {pitcher ? (
                                                                  <div className="flex flex-col items-center flex-1" title={`Pitcher: ${pitcher.shortName}`}>
                                                                      <img src={pitcher.headshot} alt={pitcher.shortName} className="w-8 h-8 rounded-full object-cover object-top border border-slate-200 bg-white -mb-1 z-10" referrerPolicy="no-referrer" />
                                                                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-1.5 rounded-sm text-center border border-slate-200 w-full truncate">{pitcher.lastName}</span>
                                                                  </div>
                                                              ) : <div className="flex-1"></div>}
                                                              {batter ? (
                                                                  <div className="flex flex-col items-center flex-1" title={`Batter: ${batter.shortName}`}>
                                                                      <img src={batter.headshot} alt={batter.shortName} className="w-8 h-8 rounded-full object-cover object-top border border-slate-200 bg-white -mb-1 z-10" referrerPolicy="no-referrer" />
                                                                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-1.5 rounded-sm text-center border border-slate-200 w-full truncate">{batter.lastName}</span>
                                                                  </div>
                                                              ) : <div className="flex-1"></div>}
                                                          </div>
                                                      )}
                                                  </div>
                                              </div>
                                              
                                              <div className="shrink-0 flex items-center justify-end w-12">
                                                  <div className="text-slate-400">
                                                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                  </div>
                                              </div>
                                          </div>
                                          
                                          {/* Pitches / Detailed Plays */}
                                          {isExpanded && (
                                              <div className="bg-slate-50/50 border-t border-slate-100 p-4 pl-36 space-y-2">
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
                                                          <div key={`p-${play.id}-${pIdx}`} className="flex items-center gap-4">
                                                              {isPitch && (
                                                                  <div className="w-16 shrink-0 flex flex-col items-end border-r border-slate-200 pr-3">
                                                                      {play.pitchVelocity ? <span className="text-xs font-black text-slate-700 tracking-tighter">{play.pitchVelocity} <span className="text-[10px] font-bold text-slate-400 uppercase">MPH</span></span> : <span className="text-xs text-slate-400 font-bold">-</span>}
                                                                      {play.pitchType && <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter text-right leading-none mt-0.5">{play.pitchType.text}</span>}
                                                                  </div>
                                                              )}
                                                              {!isPitch && <div className="w-16 shrink-0 border-r border-slate-200 pr-3"></div>}
                                                              
                                                              <div className="flex-1 py-1 flex items-center gap-3">
                                                                  {pitchNumber && (
                                                                      <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${pitchColor}`}>
                                                                          {pitchNumber}
                                                                      </div>
                                                                  )}
                                                                  <p className="text-sm text-slate-600">
                                                                      {play.display_text || play.text}
                                                                  </p>
                                                              </div>
                                                              {play.pitchCoordinate && (
                                                                  <div className="shrink-0 w-16 flex justify-end pr-4 relative h-10 items-center">
                                                                      {/* Full Pitch Container (represents X:55-195, Y:112-220) */}
                                                                      <div className="w-10 h-10 relative">
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
                                  <div key={`misc-${play.id}-${idx}`} className={`px-6 py-4 border-b border-slate-100 flex items-center gap-6 ${isScoring ? "bg-emerald-50/50" : ""}`}>
                                      <div className="w-24 shrink-0 flex items-center justify-end border-r border-slate-200 pr-4 text-slate-400 font-bold">
                                          <span className="text-[10px] font-black uppercase tracking-widest leading-none text-slate-400">Misc Play</span>
                                      </div>
                                      <div className="flex-1 min-w-0 flex items-center justify-between">
                                          <div className="flex flex-col justify-center pr-4">
                                              <p className={`text-sm leading-snug ${isScoring ? "font-black text-emerald-800" : "font-bold text-slate-500"}`}>
                                                  {play.text}
                                              </p>
                                          </div>
                                      </div>
                                      <div className="shrink-0 flex items-center justify-end w-12"></div>
                                  </div>
                              );
                          });
                      })()}
                  </div>
              )}
          </div>
      )}
    </div>
  );
};
