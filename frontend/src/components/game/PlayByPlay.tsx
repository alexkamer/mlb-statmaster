import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SafeImage } from '../shared/SafeImage';

interface PlayByPlayProps {
    data: any;
    awayTeam: any;
    homeTeam: any;
    searchParams: URLSearchParams;
    setSearchParams: (params: URLSearchParams) => void;
    filterPlays: string;
}

export const PlayByPlay: React.FC<PlayByPlayProps> = ({ data, awayTeam, homeTeam, searchParams, setSearchParams, filterPlays }) => {
  const [expandedAtBats, setExpandedAtBats] = useState<Set<string>>(new Set());

  const toggleAtBat = (abId: string) => {
      setExpandedAtBats(prev => {
          const newSet = new Set(prev);
          if (newSet.has(abId)) newSet.delete(abId);
          else newSet.add(abId);
          return newSet;
      });
  };

  const handleFilterChange = (filter: "all" | "scoring") => {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("filter", filter);
      setSearchParams(newParams);
  };

  return (
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
                              if (item.type === "at-bat") {
                                  // Find the result play for this at-bat.
                                  // We do not want to render "ghost" at-bats where the batter didn't actually finish their plate appearance
                                  // (e.g. runner caught stealing ending the inning).
                                  const ab = item.atBat;
                                  const resultPlay = ab.resultPlay || ab.plays[ab.plays.length - 1];
                                  
                                  let batterId = null;
                                  const startPlay = ab.startPlay || ab.plays[0];
                                  if (startPlay && startPlay.participants) {
                                      batterId = startPlay.participants.find((p: any) => p.type === 'batter')?.athlete?.id;
                                  }

                                  // If there is no batter, or the result play doesn't involve the batter, it's a ghost at-bat.
                                  if (batterId) {
                                      const resultBatter = resultPlay?.participants?.find((p: any) => p.type === 'batter');
                                      if (!resultBatter || resultBatter.athlete?.id !== batterId) {
                                          return false;
                                      }
                                  }

                                  if (filterPlays === "scoring") {
                                      return ab.scoringPlay;
                                  }
                                  return true;
                              }

                              if (filterPlays === "scoring") {
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
  );
};
