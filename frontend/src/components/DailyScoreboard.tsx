import React from 'react';
import { Play, Ticket } from 'lucide-react';
import { useScoreboard } from '../context/ScoreboardContext';
import { Link } from 'react-router-dom';

export const DailyScoreboard = () => {
  const { events, displayDate } = useScoreboard();

  const getContrastColor = (abbr: string) => {
    const safeColors: Record<string, string> = {
      'ATL': '#ce1141', 'HOU': '#eb6e1f', 'TEX': '#c0111f', 'TB': '#8fbce6', 
      'MIN': '#e20e32', 'CHC': '#cc3433', 'MIA': '#c4ced4', 'SD': '#ffc425',
      'CLE': '#e31937', 'DET': '#ff4713', 'KC': '#74b4fa', 'CWS': '#c4ced4', 
      'BOS': '#bd3039', 'COL': '#7ab2dd', 'LAA': '#c4ced4', 'NYM': '#ff5910', 
      'MIL': '#ffc72c'
    };
    return safeColors[abbr] || '#00193c';
  };

  const getPitcherStatus = (pitcher: any, type: string) => {
    if (!pitcher || !pitcher.athlete) return null;
    const a = pitcher.athlete;
    const stats = pitcher.statistics || [];
    
    let extra = '';
    let deepStats = '';
    
    if (type === 'W') {
      const w = stats.find((s:any)=>s.name==='wins')?.displayValue;
      const l = stats.find((s:any)=>s.name==='losses')?.displayValue;
      extra = `(${w}-${l})`;
    } else if (type === 'L') {
      const w = stats.find((s:any)=>s.name==='wins')?.displayValue;
      const l = stats.find((s:any)=>s.name==='losses')?.displayValue;
      extra = `(${w}-${l})`;
    } else if (type === 'SV') {
      const sv = stats.find((s:any)=>s.name==='saves')?.displayValue;
      extra = `(${sv})`;
    }
    
    // ESPN often omits full game IP/ER/H/K strings directly in this node for past games without pulling boxscore API
    // We will build a fallback deepStats string using ERA if it exists.
    let era = stats.find((s:any)=>s.name==='ERA')?.displayValue || '0.00';
    let recordStr = pitcher.record || '';
    
    if (type === 'W' || type === 'L' || type === 'SV') {
       // Since the Scoreboard API does not provide single-game deep stats for these featured pitchers (only their season totals like ERA),
       // we will format their season totals cleanly as a fallback.
       const h = stats.find((s:any)=>s.name==='hits')?.displayValue || '0';
       const er = stats.find((s:any)=>s.name==='runs')?.displayValue || '0';
       const errors = stats.find((s:any)=>s.name==='errors')?.displayValue || '0';
       
       deepStats = `${era} ERA, ${h} H, ${er} R, ${errors} E`;
    }
    
    return {
      name: a.shortName || a.displayName,
      id: a.id,
      headshot: a.headshot || `https://a.espncdn.com/i/headshots/mlb/players/full/${a.id}.png`,
      extra: extra,
      era: era,
      record: recordStr,
      deepStats: deepStats,
      teamId: a.team?.id || pitcher.team?.id,
      teamAbbrev: a.team?.abbreviation || pitcher.team?.abbreviation || ''
    };
  };

  if (events.length === 0) return null;

  return (
    <section className="space-y-6 mt-12">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h2 className="font-headline text-3xl font-black text-primary uppercase tracking-tighter">Daily Scoreboard</h2>
          <p className="text-sm text-slate-500 uppercase tracking-widest">{displayDate}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        {events.map((event) => {
          const comp = event.competitions[0];
          const status = event.status.type;
          const isLive = status.state === 'in';
          const isFinal = status.state === 'post';
          const isScheduled = status.state === 'pre';
          
          const homeTeam = comp.competitors.find((c: any) => c.homeAway === 'home');
          const awayTeam = comp.competitors.find((c: any) => c.homeAway === 'away');
          
          const awayLogo = `https://a.espncdn.com/i/teamlogos/mlb/500/${awayTeam?.team?.abbreviation?.toLowerCase() || 'mlb'}.png`;
          const homeLogo = `https://a.espncdn.com/i/teamlogos/mlb/500/${homeTeam?.team?.abbreviation?.toLowerCase() || 'mlb'}.png`;
          const awayColor = getContrastColor(awayTeam?.team?.abbreviation);
          const homeColor = getContrastColor(homeTeam?.team?.abbreviation);

          let badgeColor = 'bg-slate-800 text-white';
          let badgeText = 'Final';
          let statusText = status.shortDetail;

          if (status.name === 'STATUS_POSTPONED' || status.detail?.toLowerCase().includes('postponed')) {
            badgeColor = 'bg-slate-300 text-slate-600';
            badgeText = 'Postponed';
          } else if (isLive) {
            badgeColor = 'bg-secondary text-white';
            badgeText = `Live • ${status.detail}`;
          } else if (isScheduled) {
            badgeColor = 'bg-[#002d62] text-white';
            const dateObj = new Date(event.date);
            statusText = dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
            badgeText = `Upcoming • ${statusText}`;
          }

          const tvProvider = comp.broadcasts?.[0]?.names?.[0] || '';
          
          // Pitchers and Batters
          const probHome = homeTeam?.probables?.[0];
          const probAway = awayTeam?.probables?.[0];
          
          const winPitcher = comp.status?.featuredAthletes?.find((a:any)=>a.name==='winningPitcher') || event.status?.featuredAthletes?.find((a:any)=>a.name==='winningPitcher');
          const lossPitcher = comp.status?.featuredAthletes?.find((a:any)=>a.name==='losingPitcher') || event.status?.featuredAthletes?.find((a:any)=>a.name==='losingPitcher');
          const savePitcher = comp.status?.featuredAthletes?.find((a:any)=>a.name==='savingPitcher') || event.status?.featuredAthletes?.find((a:any)=>a.name==='savingPitcher');

          return (
            <div key={event.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200 relative">
              <div className="grid grid-cols-12 min-h-[140px]">
                
                {/* SECTION 1: Teams & Score */}
                <Link to={`/games/${event.id}`} className="col-span-4 p-6 border-r border-slate-100 flex flex-col justify-between overflow-hidden hover:bg-slate-50 transition-colors group cursor-pointer block">
                  <div className="flex justify-between items-center mb-4">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-sm shrink-0 ${badgeColor}`}>{badgeText}</span>
                    {(isLive || isFinal) && (
                      <div className="flex gap-4 shrink-0">
                        <span className="w-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">R</span>
                        <span className="w-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">H</span>
                        <span className="w-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">E</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className={`flex justify-between items-center ${isFinal && homeTeam?.winner ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-3 min-w-0 mr-4">
                        <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: awayColor }}>
                          <img src={awayLogo} className="w-6 h-6 object-contain" alt={awayTeam?.team?.abbreviation} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none hidden xl:block truncate">{awayTeam?.team?.location}</span>
                          <span className="font-headline font-black text-primary text-lg uppercase tracking-tight leading-tight hidden xl:block truncate">{awayTeam?.team?.name}</span>
                          <span className="font-headline font-black text-primary text-lg uppercase tracking-tight leading-tight block xl:hidden truncate">{awayTeam?.team?.abbreviation}</span>
                        </div>
                      </div>
                      {(isLive || isFinal) ? (
                        <div className="flex gap-4 shrink-0">
                          <span className="w-6 text-center font-headline font-black text-primary text-xl tracking-tighter">{awayTeam?.score}</span>
                          <span className="w-6 text-center font-headline font-black text-slate-500 text-xl tracking-tighter">{awayTeam?.hits || '0'}</span>
                          <span className="w-6 text-center font-headline font-black text-slate-500 text-xl tracking-tighter">{awayTeam?.errors || '0'}</span>
                        </div>
                      ) : (
                        <span className="font-headline font-black text-slate-500 text-sm tracking-widest pr-2">{awayTeam?.records?.[0]?.summary || '0-0'}</span>
                      )}
                    </div>
                    <div className={`flex justify-between items-center ${isFinal && awayTeam?.winner ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-3 min-w-0 mr-4">
                        <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: homeColor }}>
                          <img src={homeLogo} className="w-6 h-6 object-contain" alt={homeTeam?.team?.abbreviation} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none hidden xl:block truncate">{homeTeam?.team?.location}</span>
                          <span className="font-headline font-black text-primary text-lg uppercase tracking-tight leading-tight hidden xl:block truncate">{homeTeam?.team?.name}</span>
                          <span className="font-headline font-black text-primary text-lg uppercase tracking-tight leading-tight block xl:hidden truncate">{homeTeam?.team?.abbreviation}</span>
                        </div>
                      </div>
                      {(isLive || isFinal) ? (
                        <div className="flex gap-4 shrink-0">
                          <span className="w-6 text-center font-headline font-black text-primary text-xl tracking-tighter">{homeTeam?.score}</span>
                          <span className="w-6 text-center font-headline font-black text-slate-500 text-xl tracking-tighter">{homeTeam?.hits || '0'}</span>
                          <span className="w-6 text-center font-headline font-black text-slate-500 text-xl tracking-tighter">{homeTeam?.errors || '0'}</span>
                        </div>
                      ) : (
                        <span className="font-headline font-black text-slate-500 text-sm tracking-widest pr-2">{homeTeam?.records?.[0]?.summary || '0-0'}</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 shrink-0 flex justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{tvProvider}</span>
                  </div>
                </Link>

                {/* SECTION 2: Dynamic */}
                {isLive && (
                  <div className="col-span-4 p-6 border-r border-slate-100 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div className="relative w-12 h-12 mt-1">
                        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rotate-45 ${comp.situation?.onSecond ? 'bg-[#0066cc]' : 'bg-slate-300'}`} />
                        <div className={`absolute top-[12px] left-[6px] w-3.5 h-3.5 rotate-45 ${comp.situation?.onThird ? 'bg-[#0066cc]' : 'bg-slate-300'}`} />
                        <div className={`absolute top-[12px] right-[6px] w-3.5 h-3.5 rotate-45 ${comp.situation?.onFirst ? 'bg-[#0066cc]' : 'bg-slate-300'}`} />
                      </div>
                      <div className="flex flex-col gap-1.5 w-[70px]">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500 w-2 text-right">B</span>
                          <div className="flex gap-1">
                            {[1,2,3,4].map(b => (
                              <div key={b} className={`w-2.5 h-2.5 rounded-full ${(comp.situation?.balls || 0) >= b ? 'bg-[#1e9b42]' : 'border border-slate-300 bg-white'}`} />
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500 w-2 text-right">S</span>
                          <div className="flex gap-1">
                            {[1,2,3].map(s => (
                              <div key={s} className={`w-2.5 h-2.5 rounded-full ${(comp.situation?.strikes || 0) >= s ? 'bg-[#d5001c]' : 'border border-slate-300 bg-white'}`} />
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500 w-2 text-right">O</span>
                          <div className="flex gap-1">
                            {[1,2,3].map(o => (
                              <div key={o} className={`w-2.5 h-2.5 rounded-full ${(comp.situation?.outs || 0) >= o ? 'bg-[#d5001c]' : 'border border-slate-300 bg-white'}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-1">
                      <p className="text-[11px] text-slate-600 font-medium leading-tight">
                        <span className="font-bold uppercase tracking-widest text-slate-400 text-[9px] mr-1">Last Play:</span>
                        {comp.situation?.lastPlay?.text || 'Waiting for play...'}
                      </p>
                      <p className="text-[11px] text-[#0066cc] font-bold cursor-pointer hover:underline">Play-by-Play</p>
                    </div>
                  </div>
                )}
                
                {isFinal && (
                  <div className="col-span-4 border-r border-slate-100 flex items-center justify-center p-0">
                    {comp.highlights?.[0] ? (
                      <div className="relative w-full h-full overflow-hidden bg-black group cursor-pointer flex items-center justify-center min-h-[90px]">
                        <video 
                          className="w-full h-full object-contain" 
                          controls
                          poster={comp.highlights[0].thumbnail}
                        >
                          {comp.highlights[0].links?.source?.mezzanine?.href && (
                            <source src={comp.highlights[0].links.source.mezzanine.href} type="video/mp4" />
                          )}
                          {comp.highlights[0].links?.mobile?.source?.href && (
                            <source src={comp.highlights[0].links.mobile.source.href} type="video/mp4" />
                          )}
                          Your browser does not support the video tag.
                        </video>
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 text-white text-[9px] font-bold rounded truncate max-w-[calc(100%-1rem)] pointer-events-none group-hover:opacity-0 transition-opacity">
                           {comp.highlights[0].headline || 'Highlights'}
                        </span>
                      </div>
                    ) : comp.headlines?.[0] ? (
                      <div className="relative w-full h-full flex flex-col justify-center gap-1.5 px-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1">{comp.headlines[0].type || 'Recap'}</span>
                        <p className="text-xs font-bold text-primary leading-tight line-clamp-2">{comp.headlines[0].shortLinkText}</p>
                        <p className="text-[10px] text-slate-500 font-medium leading-tight line-clamp-2">{comp.headlines[0].description}</p>
                      </div>
                    ) : (
                      <div className="relative w-full h-full rounded-lg overflow-hidden bg-slate-50 border border-slate-200 shadow-sm flex flex-col items-center justify-center min-h-[90px] opacity-60">
                        <img src={homeLogo} className="w-8 h-8 object-contain mb-2 grayscale opacity-30" alt="No Highlights" />
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">No Highlights</span>
                      </div>
                    )}
                  </div>
                )}

                {isScheduled && (
                  <div className="col-span-4 p-6 border-r border-slate-100 flex flex-col justify-center space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-700">{comp.venue?.fullName}</p>
                      <p className="text-[11px] text-slate-500">{comp.venue?.address?.city}, {comp.venue?.address?.state}</p>
                    </div>
                    <div className="h-px w-full bg-slate-100" />
                    <div className="flex items-center gap-2">
                      <Ticket className="w-5 h-5 text-[#0066cc]" />
                      <a href={event.tickets?.[0]?.links?.[0]?.href || '#'} target="_blank" rel="noreferrer" className="text-xs font-medium text-[#0066cc] hover:underline">
                         {event.tickets?.[0]?.summary || 'Tickets available'}
                      </a>
                    </div>
                    <div className="h-px w-full bg-slate-100" />
                    <div className="bg-slate-50 border border-slate-200 rounded-md py-2 px-3 text-center">
                      <span className="text-[11px] font-bold text-slate-500 mr-2">ML:</span>
                      <span className="text-xs font-black text-slate-800">{comp.odds?.[0]?.details || 'N/A'}</span>
                    </div>
                  </div>
                )}

                {/* SECTION 3: Pitching / Actions */}
                <div className="col-span-4 @container p-4 xl:p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-2 xl:gap-3">
                  <div className="flex-1 flex flex-col justify-center min-w-0 pr-1">
                    
                    {isFinal && (
                      <div className="flex flex-col gap-2">
                        {[
                          { type: 'W', label: 'WIN', data: getPitcherStatus(winPitcher, 'W') },
                          { type: 'L', label: 'LOSS', data: getPitcherStatus(lossPitcher, 'L') },
                          { type: 'SV', label: 'SAVE', data: getPitcherStatus(savePitcher, 'SV') }
                        ].map(p => p.data ? (
                          <div key={p.type} className="flex flex-col gap-1 group">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black text-slate-400 w-4 xl:w-8">
                                <span className="xl:hidden">{p.type}</span>
                                <span className="hidden xl:inline">{p.label}</span>
                              </span>
                              <div className="relative w-8 h-8 xl:w-10 xl:h-10 rounded-full overflow-hidden bg-slate-100 shrink-0 border border-slate-200 flex items-center justify-center">
                                {p.data.teamAbbrev && (
                                  <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/${p.data.teamAbbrev.toLowerCase()}.png`} className="absolute w-[80%] h-[80%] object-contain opacity-30 mix-blend-multiply" alt="Team Logo" />
                                )}
                                <img src={p.data.headshot} className="relative z-10 w-full h-full object-cover mix-blend-multiply" alt={p.data.name} />
                              </div>
                              <span className="text-[clamp(10px,2.5cqi,12px)] xl:text-[clamp(11px,2.5cqi,14px)] font-bold text-primary group-hover:text-secondary cursor-pointer truncate flex-1">{p.data.name} {p.data.extra}</span>
                            </div>
                            <span className="text-[clamp(9px,2cqi,10px)] xl:text-[clamp(10px,2cqi,12px)] text-slate-500 font-medium ml-11 xl:ml-[60px] pl-1 truncate">{p.data.deepStats}</span>                          </div>                        ) : null)}
                      </div>
                    )}

                    {isScheduled && (
                       <div className="flex flex-col gap-2">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-2">Probable Pitchers</span>
                         <div className="space-y-3">
                           {[
                             { team: awayTeam, logo: awayLogo, prob: getPitcherStatus(probAway, 'PROB') },
                             { team: homeTeam, logo: homeLogo, prob: getPitcherStatus(probHome, 'PROB') }
                           ].map((p, idx) => p.prob ? (
                             <div key={idx} className="flex items-center group">
                                <div className="flex items-center gap-3">
                                  <div className="relative w-8 h-8 xl:w-10 xl:h-10 rounded-full overflow-hidden bg-slate-100 shrink-0 border border-slate-200 flex items-center justify-center">
                                    <img src={p.logo} className="absolute w-[80%] h-[80%] object-contain opacity-30 mix-blend-multiply" alt="Team Logo" />
                                    <img src={p.prob.headshot} className="relative z-10 w-full h-full object-cover mix-blend-multiply" alt={p.prob.name} />
                                  </div>
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className="text-[clamp(10px,2.5cqi,12px)] xl:text-[clamp(11px,2.5cqi,14px)] font-bold text-primary group-hover:text-secondary cursor-pointer leading-tight truncate">{p.prob.name}</span>
                                    <span className="text-[clamp(9px,2cqi,10px)] xl:text-[clamp(10px,2cqi,12px)] text-slate-500 font-medium leading-tight truncate">ERA {p.prob.era} {p.prob.record}</span>
                                  </div>
                                </div>
                              </div>
                           ) : null)}
                         </div>
                       </div>
                    )}

                    {isLive && (
                      <div className="flex flex-col gap-4">
                        {(comp.situation?.pitcher && comp.situation?.batter) ? (
                          <>
                            <div className="flex flex-col gap-1.5 group">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1 mb-1">Pitching</span>
                              <div className="flex items-center gap-3">
                                <div className="relative w-8 h-8 xl:w-10 xl:h-10 rounded-full overflow-hidden bg-slate-100 shrink-0 border border-slate-200 flex items-center justify-center">
                                  {comp.situation?.pitcher?.athlete?.team?.id && (
                                    <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/${comp.situation.pitcher.athlete.team.id}.png`} className="absolute w-[80%] h-[80%] object-contain opacity-30 mix-blend-multiply" alt="Team Logo" />
                                  )}
                                  <img src={comp.situation?.pitcher?.athlete?.headshot || 'https://a.espncdn.com/i/headshots/nophoto.png'} className="relative z-10 w-full h-full object-cover mix-blend-multiply" alt="Pitcher" />
                                </div>                                <span className="text-[clamp(10px,2.5cqi,12px)] xl:text-[clamp(11px,2.5cqi,14px)] font-bold text-primary group-hover:text-secondary cursor-pointer leading-tight truncate flex-1">
                                  {comp.situation?.pitcher?.athlete?.shortName || 'Unknown'}
                                </span>
                              </div>
                              <span className="text-[clamp(9px,2cqi,10px)] xl:text-[clamp(10px,2cqi,12px)] text-slate-500 font-medium ml-11 xl:ml-[52px] pl-1 truncate">{comp.situation?.pitcher?.summary || 'Stats unavailable'}</span>
                            </div>

                            <div className="flex flex-col gap-1.5 group">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1 mb-1">Batting</span>
                              <div className="flex items-center gap-3">
                                <div className="relative w-8 h-8 xl:w-10 xl:h-10 rounded-full overflow-hidden bg-slate-100 shrink-0 border border-slate-200 flex items-center justify-center">
                                  {comp.situation?.batter?.athlete?.team?.id && (
                                    <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/${comp.situation.batter.athlete.team.id}.png`} className="absolute w-[80%] h-[80%] object-contain opacity-30 mix-blend-multiply" alt="Team Logo" />
                                  )}
                                  <img src={comp.situation?.batter?.athlete?.headshot || 'https://a.espncdn.com/i/headshots/nophoto.png'} className="relative z-10 w-full h-full object-cover mix-blend-multiply" alt="Batter" />
                                </div>                                <span className="text-[clamp(10px,2.5cqi,12px)] xl:text-[clamp(11px,2.5cqi,14px)] font-bold text-primary group-hover:text-secondary cursor-pointer leading-tight truncate flex-1">
                                   {comp.situation?.batter?.athlete?.shortName || 'Unknown'}
                                </span>
                              </div>
                              <span className="text-[clamp(9px,2cqi,10px)] xl:text-[clamp(10px,2cqi,12px)] text-slate-500 font-medium ml-11 xl:ml-[52px] pl-1 truncate">{comp.situation?.batter?.summary || 'Stats unavailable'}</span>
                            </div>
                          </>
                        ) : comp.situation?.dueUp?.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 border-b border-slate-100 pb-2">Due Up</span>
                            <div className="space-y-2">
                              {comp.situation.dueUp.slice(0, 3).map((batter: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between group">
                                  <div className="flex items-center gap-3">
                                    <div className="relative w-6 h-6 xl:w-8 xl:h-8 rounded-full overflow-hidden bg-slate-100 shrink-0 border border-slate-200 flex items-center justify-center">
                                      {batter.athlete?.team?.id && (
                                        <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/${batter.athlete.team.id}.png`} className="absolute w-[80%] h-[80%] object-contain opacity-30 mix-blend-multiply" alt="Team Logo" />
                                      )}
                                      <img src={batter.athlete?.headshot || 'https://a.espncdn.com/i/headshots/nophoto.png'} className="relative z-10 w-full h-full object-cover mix-blend-multiply" alt={batter.athlete?.shortName || 'Batter'} />
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                      <span className="text-[clamp(10px,2.5cqi,12px)] xl:text-[clamp(11px,2.5cqi,14px)] font-bold text-primary group-hover:text-secondary cursor-pointer leading-tight truncate">{batter.athlete?.shortName || 'Unknown'}</span>
                                      <span className="text-[clamp(9px,2cqi,10px)] xl:text-[clamp(10px,2cqi,12px)] text-slate-500 font-medium leading-tight truncate">{batter.summary || ''}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center py-8">
                             Inning Break
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                  <div className="flex items-center shrink-0">
                    <Link to={`/games/${event.id}`} className="bg-slate-100 hover:bg-slate-200 text-primary text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded transition-colors block text-center">
                      {(isLive || isFinal) ? 'Boxscore' : 'Preview'}
                    </Link>
                  </div>
                </div>

              </div>
              
              {/* Footer (Optional) */}
              <div className="bg-slate-50 px-6 py-3 flex justify-between items-center border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                   {comp.attendance ? `Attendance: ${comp.attendance.toLocaleString()}` : (isScheduled ? 'Scheduled Game' : '')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
