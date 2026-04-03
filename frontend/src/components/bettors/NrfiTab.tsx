import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useScoreboard } from '../../context/ScoreboardContext';
import { ShieldOff } from 'lucide-react';
import { SafeImage } from '../shared/SafeImage';
import { fetchBatchPlayerGameLogs, fetchRecentGames } from '../../api';

const getStartingPitcher = (team: any) => {
  // Try to find probables which are the starters
  const pitcher = team?.probables?.[0];
  if (!pitcher || !pitcher.athlete) return null;
  
  const a = pitcher.athlete;
  const stats = pitcher.statistics || [];
  
  // Extract standard stats
  const era = stats.find((s: any) => s.name === 'ERA')?.displayValue || '0.00';
  const wins = stats.find((s: any) => s.name === 'wins')?.displayValue || '0';
  const losses = stats.find((s: any) => s.name === 'losses')?.displayValue || '0';
  const recordStr = `(${wins}-${losses})`;
  
  return {
    id: a.id,
    name: a.shortName || a.displayName || a.fullName,
    headshot: a.headshot?.href || a.headshot || `https://a.espncdn.com/i/headshots/mlb/players/full/${a.id}.png`,
    era: era,
    record: recordStr,
  };
};

const getInningPrefix = (inning: number) => {
  if (inning === 1) return '1st';
  if (inning === 2) return '2nd';
  if (inning === 3) return '3rd';
  return `${inning}th`;
};

const RecentStartsList = ({ logs, metric, inning }: { logs: any[], metric: 'runs' | 'hits', inning: number }) => {
  const navigate = useNavigate();

  if (!logs || logs.length === 0) return <div className="text-xs text-slate-400 mt-2 px-2">No recent starts found.</div>;

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-2 w-full overflow-visible">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
        {getInningPrefix(inning)} Inning {metric === 'runs' ? 'Runs' : 'Hits'} (Last 10 Starts)
      </span>
      <div className="flex flex-wrap items-center gap-2 px-2 pb-1">
        {logs.map((log: any, idx: number) => {
          const dateString = log.date.endsWith('Z') ? log.date : `${log.date}Z`;
          const dateObj = new Date(dateString);
          const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
          
          const total = metric === 'runs' ? (log.inning_total_runs ?? 0) : metric === 'hits' ? (log.inning_total_hits ?? 0) : (log.inning_total_k ?? 0);
          const isGameSuccess = metric === 'strikeouts' ? total > 0 : total === 0;

          if (log.inning_runs_allowed === null || log.inning_hits_allowed === null || log.inning_k_recorded === null) {
            return (
              <div 
                key={idx} 
                className="flex flex-col items-center gap-1 shrink-0 relative group cursor-pointer hover:scale-105 transition-transform" 
                onClick={() => navigate(`/games/${log.event_id}`)}
              >
                <div className="flex flex-col border shadow-sm rounded overflow-hidden">
                  <div className="w-8 h-5 flex items-center justify-center text-[10px] font-black border-b bg-slate-50 text-slate-300" title="Did not pitch in this inning">
                    -
                  </div>
                  <div className={`w-8 h-5 flex items-center justify-center text-[10px] font-black ${
                    isGameSuccess ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    {total}
                  </div>
                </div>
                <span className="text-[9px] font-medium text-slate-400">{dateStr}</span>
                
                {/* Custom Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-50 w-32 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs rounded-lg shadow-xl py-2 px-3">
                  <div className="font-bold text-slate-300 mb-1">{dateStr}</div>
                  <div className="flex items-center gap-2 mb-2 bg-slate-700/50 rounded px-2 py-1 w-full justify-center">
                      <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/${log.home_away === 'away' ? log.team_id : log.opponent_id}.png`} alt="Away" className="w-4 h-4 object-contain" />
                      <span className="text-[10px] font-black text-slate-400">@</span>
                      <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/${log.home_away === 'home' ? log.team_id : log.opponent_id}.png`} alt="Home" className="w-4 h-4 object-contain" />
                  </div>
                  <div className="flex justify-between w-full text-[10px] font-medium text-slate-300">
                      <span>Pitcher {metric === 'strikeouts' ? 'Recorded' : 'Allowed'}:</span>
                      <span className="font-bold text-slate-400">-</span>
                  </div>
                  <div className="flex justify-between w-full text-[10px] font-medium text-slate-300">
                      <span>Total:</span>
                      <span className={`font-bold ${isGameSuccess ? 'text-emerald-400' : 'text-rose-400'}`}>{total}</span>
                  </div>
                  {/* Tooltip Arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                </div>
              </div>
            );
          }

          const allowed = metric === 'runs' ? (log.inning_runs_allowed ?? 0) : metric === 'hits' ? (log.inning_hits_allowed ?? 0) : (log.inning_k_recorded ?? 0);
          const isPitcherSuccess = metric === 'strikeouts' ? allowed > 0 : allowed === 0;

          return (
            <div 
              key={idx} 
              className="flex flex-col items-center gap-1 shrink-0 relative group cursor-pointer hover:scale-105 transition-transform" 
              onClick={() => navigate(`/games/${log.event_id}`)}
            >
              <div className="flex flex-col border shadow-sm rounded overflow-hidden">
                <div className={`w-8 h-5 flex items-center justify-center text-[10px] font-black border-b ${
                  isPitcherSuccess ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'
                }`}>
                  {allowed}
                </div>
                <div className={`w-8 h-5 flex items-center justify-center text-[10px] font-black ${
                  isGameSuccess ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}>
                  {total}
                </div>
              </div>
              <span className="text-[9px] font-medium text-slate-400">{dateStr}</span>
              
              {/* Custom Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-50 w-32 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs rounded-lg shadow-xl py-2 px-3">
                <div className="font-bold text-slate-300 mb-1">{dateStr}</div>
                <div className="flex items-center gap-2 mb-2 bg-slate-700/50 rounded px-2 py-1 w-full justify-center">
                    <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/${log.home_away === 'away' ? log.team_id : log.opponent_id}.png`} alt="Away" className="w-4 h-4 object-contain" />
                    <span className="text-[10px] font-black text-slate-400">@</span>
                    <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/${log.home_away === 'home' ? log.team_id : log.opponent_id}.png`} alt="Home" className="w-4 h-4 object-contain" />
                </div>
                <div className="flex justify-between w-full text-[10px] font-medium text-slate-300">
                    <span>Pitcher {metric === 'strikeouts' ? 'Recorded' : 'Allowed'}:</span>
                    <span className={`font-bold ${isPitcherSuccess ? 'text-emerald-400' : 'text-rose-400'}`}>{allowed}</span>
                </div>                <div className="flex justify-between w-full text-[10px] font-medium text-slate-300">
                    <span>Total:</span>
                    <span className={`font-bold ${isGameSuccess ? 'text-emerald-400' : 'text-rose-400'}`}>{total}</span>
                </div>
                {/* Tooltip Arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TeamBattingLogs = ({ teamId, teamName, metric, inning }: { teamId: number, teamName: string, metric: 'runs' | 'hits' | 'strikeouts', inning: number }) => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const year = new Date().getFullYear(); // ONLY CURRENT SEASON
        const data = await fetchRecentGames(teamId, 10, year, undefined, inning);
        setLogs(data || []);
      } catch (err) {
        console.error("Error fetching team recent games", err);
      }
    };
    if (teamId) fetchLogs();
  }, [teamId, inning]);

  if (!logs || logs.length === 0) return <div className="text-xs text-slate-400 mt-2 px-2">No recent games found.</div>;

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-2 w-full overflow-visible">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
        Opponent {getInningPrefix(inning)} Inning {metric === 'runs' ? 'Batting' : metric === 'hits' ? 'Hitting' : 'Strikeouts'} ({teamName} - Last 10)
      </span>
      <div className="flex flex-wrap items-center gap-2 px-2 pb-1">
        {logs.map((log: any, idx: number) => {
          const dateString = log.date.endsWith('Z') ? log.date : `${log.date}Z`;
          const dateObj = new Date(dateString);
          const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
          const scored = metric === 'runs' ? (log.inning_runs_scored ?? 0) : metric === 'hits' ? (log.inning_hits_scored ?? 0) : (log.inning_k_suffered ?? 0);
          const hasMetric = scored > 0;

          return (
            <div 
              key={idx} 
              className="flex flex-col items-center gap-1 shrink-0 relative group cursor-pointer hover:scale-105 transition-transform" 
              onClick={() => navigate(`/games/${log.event_id}`)}
            >
              <div className="flex flex-col border shadow-sm rounded overflow-hidden">
                <div className={`w-8 h-6 flex items-center justify-center text-xs font-black ${
                  !hasMetric ? 'bg-slate-50 text-slate-400' : 'bg-indigo-50 text-indigo-600'
                }`} title={`${metric === 'runs' ? 'Runs' : metric === 'hits' ? 'Hits' : "K's"} in ${getInningPrefix(inning)} Inning`}>
                  {scored}
                </div>
              </div>
              <span className="text-[9px] font-medium text-slate-400">{dateStr}</span>
              
              {/* Custom Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-50 w-36 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs rounded-lg shadow-xl py-2 px-3">
                <div className="font-bold text-slate-300 mb-1">{dateStr}</div>
                <div className="flex items-center gap-2 mb-2 bg-slate-700/50 rounded px-2 py-1 w-full justify-center">
                    <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/${log.location === 'away' ? teamId : log.opponent_id}.png`} alt="Away" className="w-4 h-4 object-contain" />
                    <span className="text-[10px] font-black text-slate-400">@</span>
                    <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/${log.location === 'home' ? teamId : log.opponent_id}.png`} alt="Home" className="w-4 h-4 object-contain" />
                </div>
                <div className="flex justify-between w-full text-[10px] font-medium text-slate-300 mb-0.5">
                    <span>Opp. Pitcher:</span>
                    <span className="font-bold text-slate-100">{log.opp_starter_name || 'Unknown'}</span>
                </div>
                <div className="flex justify-between w-full text-[10px] font-medium text-slate-300">
                    <span>{getInningPrefix(inning)} Inning {metric === 'runs' ? 'Runs' : metric === 'hits' ? 'Hits' : "K's"}:</span>
                    <span className={`font-bold ${!hasMetric ? 'text-slate-400' : 'text-indigo-400'}`}>{scored}</span>
                </div>
                {/* Tooltip Arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const NrfiTab = () => {
  const { todayEvents, displayDateToday } = useScoreboard();
  const [pitcherLogs, setPitcherLogs] = useState<any>({});
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [metric, setMetric] = useState<'runs' | 'hits' | 'strikeouts'>('runs');
  const [inning, setInning] = useState<number>(1);

  useEffect(() => {
    if (!todayEvents || todayEvents.length === 0) return;

    const fetchLogs = async () => {
      setLoadingLogs(true);
      try {
        const pIds: string[] = [];
        todayEvents.forEach((event: any) => {
          const comp = event.competitions?.[0];
          if (!comp) return;

          const homeTeam = comp.competitors?.find((c: any) => c.homeAway === 'home');
          const awayTeam = comp.competitors?.find((c: any) => c.homeAway === 'away');

          if (homeTeam) {
            const homeSP = getStartingPitcher(homeTeam);
            if (homeSP && homeSP.id) pIds.push(homeSP.id.toString());
          }
          if (awayTeam) {
            const awaySP = getStartingPitcher(awayTeam);
            if (awaySP && awaySP.id) pIds.push(awaySP.id.toString());
          }
        });

        if (pIds.length > 0) {
          // Pass year as null to get last 10 starts all-time (reg/postseason combined per type_filter in backend)
          const data = await fetchBatchPlayerGameLogs(pIds, null, 10, inning);
          setPitcherLogs(data || {});
        }
      } catch (err) {
        console.error("Error fetching recent pitcher logs", err);
      } finally {
        setLoadingLogs(false);
      }
    };

    fetchLogs();
  }, [todayEvents, inning]);

  if (!todayEvents || todayEvents.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{getInningPrefix(inning)} Inning Analysis</h2>
            <p className="text-slate-500 text-sm">{displayDateToday} • {getInningPrefix(inning)} Inning Scoring & Hitting Probabilities</p>
          </div>
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button 
              onClick={() => setMetric('runs')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${metric === 'runs' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Runs (NRFI)
            </button>
            <button 
              onClick={() => setMetric('hits')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${metric === 'hits' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Hits (NHFI)
            </button>
          </div>
        </div>
        <div className="w-full h-64 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center text-slate-400 bg-slate-50/50">
          No games scheduled for today.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{getInningPrefix(inning)} Inning Analysis</h2>
          <p className="text-slate-500 text-sm">{displayDateToday} • {getInningPrefix(inning)} Inning Scoring & Hitting Probabilities</p>
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                <button 
                  key={i}
                  onClick={() => setInning(i)}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md text-[10px] sm:text-xs font-bold transition-colors ${inning === i ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {i}
                </button>
              ))}
          </div>
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button 
                onClick={() => setMetric('runs')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${metric === 'runs' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Runs
              </button>
              <button 
                onClick={() => setMetric('hits')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${metric === 'hits' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Hits
              </button>
              <button 
                onClick={() => setMetric('strikeouts')}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${metric === 'strikeouts' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                K's
              </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {todayEvents.map((event: any) => {
          const comp = event.competitions?.[0];
          if (!comp) return null;

          const homeTeam = comp.competitors?.find((c: any) => c.homeAway === 'home');
          const awayTeam = comp.competitors?.find((c: any) => c.homeAway === 'away');

          if (!homeTeam || !awayTeam) return null;

          const isScheduled = event.status?.type?.state === 'pre';
          const isLive = event.status?.type?.state === 'in';
          const isCompleted = event.status?.type?.state === 'post';

          let statusText = event.status?.type?.detail || event.status?.type?.shortDetail;
          let statusColor = 'bg-slate-100 text-slate-600 border-slate-200';
          if (isLive) {
            statusColor = 'bg-rose-50 text-rose-600 border-rose-100';
          } else if (isScheduled) {
            statusColor = 'bg-blue-50 text-blue-600 border-blue-100';
            const dateObj = new Date(event.date);
            statusText = dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          }

          const awaySP = getStartingPitcher(awayTeam);
          const homeSP = getStartingPitcher(homeTeam);

          return (
            <div key={event.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row md:items-center gap-6">
              {/* Game Header (Left Side) */}
              <div className="flex flex-col gap-3 min-w-[200px] border-b md:border-b-0 md:border-r border-slate-100 pb-3 md:pb-0 md:pr-6">
                <div className="flex items-center gap-2">
                  <div className="flex items-center -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center p-1 z-10">
                      <SafeImage src={awayTeam.team?.logo} alt={awayTeam.team?.abbreviation} className="w-full h-full object-contain" />
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center p-1 z-0">
                      <SafeImage src={homeTeam.team?.logo} alt={homeTeam.team?.abbreviation} className="w-full h-full object-contain" />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700">
                      {awayTeam.team?.abbreviation} @ {homeTeam.team?.abbreviation}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider self-start mt-1 ${statusColor}`}>
                      {statusText}
                    </span>
                  </div>
                </div>
              </div>

              {/* Starting Pitchers (Right Side / Stacked) */}
              <div className="flex flex-col gap-2 flex-1">
                {/* Away SP (Facing Home Team) */}
                <div className="flex flex-col flex-1 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white border border-slate-200 overflow-hidden shrink-0 shadow-sm">
                      {awaySP ? (
                        <SafeImage src={awaySP.headshot} alt={awaySP.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">TBD</div>
                      )}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{awayTeam.team?.abbreviation} {isScheduled ? 'Probable' : 'Starter'}</span>
                      {awaySP ? (
                        <>
                          <Link to={`/players/${awaySP.id}`} className="text-sm font-black text-primary truncate leading-tight hover:underline">{awaySP.name}</Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-medium text-slate-600 bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-200">ERA {awaySP.era}</span>
                            <span className="text-[10px] font-bold text-slate-500">{awaySP.record}</span>
                          </div>
                        </>
                      ) : (
                        <span className="text-sm font-bold text-slate-500 mt-1">TBD</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col xl:flex-row xl:items-start gap-4">
                    <div className="flex-1 min-w-[50%]">
                      {awaySP && pitcherLogs[awaySP.id]?.pitching && (
                        <RecentStartsList logs={pitcherLogs[awaySP.id].pitching} metric={metric} inning={inning} />
                      )}
                    </div>
                    <div className="flex-1 min-w-[40%]">
                      {homeTeam?.team?.id && <TeamBattingLogs teamId={homeTeam.team.id} teamName={homeTeam.team.abbreviation} metric={metric} inning={inning} />}
                    </div>
                  </div>
                </div>

                {/* Home SP (Facing Away Team) */}
                <div className="flex flex-col flex-1 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white border border-slate-200 overflow-hidden shrink-0 shadow-sm">
                      {homeSP ? (
                        <SafeImage src={homeSP.headshot} alt={homeSP.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">TBD</div>
                      )}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{homeTeam.team?.abbreviation} {isScheduled ? 'Probable' : 'Starter'}</span>
                      {homeSP ? (
                        <>
                          <Link to={`/players/${homeSP.id}`} className="text-sm font-black text-primary truncate leading-tight hover:underline">{homeSP.name}</Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-medium text-slate-600 bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-200">ERA {homeSP.era}</span>
                            <span className="text-[10px] font-bold text-slate-500">{homeSP.record}</span>
                          </div>
                        </>
                      ) : (
                        <span className="text-sm font-bold text-slate-500 mt-1">TBD</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col xl:flex-row xl:items-start gap-4">
                    <div className="flex-1 min-w-[50%]">
                      {homeSP && pitcherLogs[homeSP.id]?.pitching && (
                        <RecentStartsList logs={pitcherLogs[homeSP.id].pitching} metric={metric} inning={inning} />
                      )}
                    </div>
                    <div className="flex-1 min-w-[40%]">
                      {awayTeam?.team?.id && <TeamBattingLogs teamId={awayTeam.team.id} teamName={awayTeam.team.abbreviation} metric={metric} inning={inning} />}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
