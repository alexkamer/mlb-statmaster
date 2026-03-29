import React from 'react';
import { useParams } from 'react-router-dom';

import { fetchGameSummary } from '../api';
import { Link } from 'react-router-dom';

export const GamePage = () => {
  const { gameId } = useParams();
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<"boxscore" | "plays">("boxscore");

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
         <button onClick={() => setActiveTab("boxscore")} className={`font-headline font-black text-xl uppercase tracking-widest transition-colors ${activeTab === "boxscore" ? "text-primary" : "text-slate-300 hover:text-slate-400"}`}>Box Score</button>
         <button onClick={() => setActiveTab("plays")} className={`font-headline font-black text-xl uppercase tracking-widest transition-colors ${activeTab === "plays" ? "text-primary" : "text-slate-300 hover:text-slate-400"}`}>Play-by-Play</button>
      </div>

      {activeTab === "boxscore" && (
          <div className="flex flex-col gap-8">
              
              {/* Linescore Matrix */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="overflow-x-auto">
                     <table className="w-full text-center border-collapse tabular-nums">
                        <thead>
                           <tr className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-widest border-b border-slate-200">
                               <th className="px-4 py-3 text-left w-32">Team</th>
                               {awayTeam?.linescores?.map((_: any, i: number) => (
                                   <th key={i} className="px-3 py-3 w-10">{i + 1}</th>
                               ))}
                               <th className="px-4 py-3 font-black text-primary border-l border-slate-200">R</th>
                               <th className="px-4 py-3 font-black text-primary">H</th>
                               <th className="px-4 py-3 font-black text-primary">E</th>
                           </tr>
                        </thead>
                        <tbody className="font-medium text-slate-700">
                           <tr className="border-b border-slate-100 hover:bg-slate-50">
                               <td className="px-4 py-3 text-left font-black flex items-center gap-2" style={{ color: `#${awayTeam?.team?.color}` }}>
                                   <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${awayTeam?.team?.abbreviation?.toLowerCase()}.png`} className="w-5 h-5 object-contain" alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                   {awayTeam?.team?.abbreviation}
                               </td>
                               {awayTeam?.linescores?.map((inning: any, i: number) => (
                                   <td key={i} className="px-3 py-3">{inning.displayValue || "-"}</td>
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
                                   <td key={i} className="px-3 py-3">{inning.displayValue || "-"}</td>
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
                                                          <th key={i} className="px-2 py-2 text-right">{lbl}</th>
                                                      ))}
                                                  </tr>
                                              </thead>
                                              <tbody className="text-xs font-medium text-slate-700">
                                                  {battingStats.athletes?.map((ath: any, i: number) => (
                                                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                                          <td className="px-4 py-2 font-bold text-primary whitespace-nowrap">
                                                              <Link to={`/players/${ath.athlete?.id}`} className="hover:underline">{ath.athlete?.shortName}</Link>
                                                              <span className="text-[10px] text-slate-400 ml-1 font-normal">{ath.athlete?.position?.abbreviation}</span>
                                                          </td>
                                                          {ath.stats?.map((stat: string, j: number) => (
                                                              <td key={j} className="px-2 py-2 text-right">{stat}</td>
                                                          ))}
                                                      </tr>
                                                  ))}
                                                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-200 text-primary">
                                                      <td className="px-4 py-2">TOTALS</td>
                                                      {battingStats.totals?.map((tot: string, j: number) => (
                                                          <td key={j} className="px-2 py-2 text-right">{tot}</td>
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
              {data.plays?.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 font-bold">Play-by-play data is not available for this game yet.</div>
              ) : (
                  <div className="flex flex-col">
                      {data.plays?.map((play: any, idx: number) => {
                          const isStartInning = play.type?.type === "start-inning";
                          const isScoring = play.scoringPlay;
                          
                          if (isStartInning) {
                              return (
                                  <div key={idx} className="bg-slate-100 px-6 py-3 border-y border-slate-200 font-black text-sm uppercase tracking-widest text-slate-500 sticky top-[48px] z-10 shadow-sm">
                                      {play.text}
                                  </div>
                              );
                          }

                          return (
                              <div key={idx} className={`px-6 py-4 border-b border-slate-100 flex gap-6 hover:bg-slate-50 transition-colors ${isScoring ? "bg-emerald-50/30" : ""}`}>
                                  {/* Left Column: Outs & Count */}
                                  <div className="w-20 shrink-0 flex flex-col gap-1 border-r border-slate-200 pr-4">
                                      {play.period?.displayValue && <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{play.period.displayValue}</span>}
                                      <span className="text-xs font-bold text-slate-600 tabular-nums">O: {play.resultCount?.outs || 0}</span>
                                      {(play.resultCount?.balls !== undefined) && (
                                          <span className="text-[10px] font-bold text-slate-400 uppercase tabular-nums">{play.resultCount.balls}-{play.resultCount.strikes} Count</span>
                                      )}
                                  </div>

                                  {/* Right Column: Play Text */}
                                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                                      <p className={`text-sm ${isScoring ? "font-bold text-emerald-800" : "font-medium text-slate-700"}`}>
                                          {play.text}
                                      </p>
                                      {isScoring && (
                                          <span className="inline-block mt-2 text-xs font-black uppercase tracking-widest text-emerald-600 bg-emerald-100/50 px-2 py-1 rounded w-max">
                                              Score: {play.awayScore} - {play.homeScore}
                                          </span>
                                      )}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}
          </div>
      )}
    </div>
  );
};