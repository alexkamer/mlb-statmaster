import React, { useMemo } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar 
} from 'recharts';
import { TrendingUp, Activity, Target } from 'lucide-react';

interface TeamStatsDashboardProps {
  teamStats: any;
  pitchingRoster: any[];
  recentGames: any[];
  teamColor?: string;
}

export const TeamStatsDashboard: React.FC<TeamStatsDashboardProps> = ({ teamStats, pitchingRoster, recentGames, teamColor }) => {
  const primaryColor = teamColor ? `#${teamColor}` : '#0f172a';

  // 1. Calculate Pitching Aggregates from Roster
  const pitchingAggregates = useMemo(() => {
    if (!pitchingRoster || pitchingRoster.length === 0) return null;
    let totalER = 0;
    let totalIP = 0;
    let totalSO = 0;
    let totalWHIPSum = 0;
    let countWHIP = 0;

    pitchingRoster.forEach(p => {
      const era = parseFloat(p.era) || 0;
      const ip = parseFloat(p.ip) || 0;
      const so = parseFloat(p.so) || 0;
      const whip = parseFloat(p.whip) || 0;

      // Reverse engineer ER: ERA = (ER / IP) * 9  => ER = (ERA * IP) / 9
      totalER += (era * ip) / 9;
      totalIP += ip;
      totalSO += so;
      
      if (ip > 10) { // Only count pitchers with > 10 IP for avg WHIP to avoid crazy outliers
        totalWHIPSum += whip * ip;
        countWHIP += ip;
      }
    });

    const teamERA = totalIP > 0 ? ((totalER * 9) / totalIP).toFixed(2) : '0.00';
    const teamWHIP = countWHIP > 0 ? (totalWHIPSum / countWHIP).toFixed(2) : '0.00';
    const teamK9 = totalIP > 0 ? ((totalSO * 9) / totalIP).toFixed(2) : '0.00';

    return {
      era: teamERA,
      whip: teamWHIP,
      k9: teamK9,
      totalSO
    };
  }, [pitchingRoster]);

  // 2. Prepare Game Trend Data
  const trendData = useMemo(() => {
    if (!recentGames) return [];
    
    // Filter out Preseason/Spring Training games so they don't skew the trend
    const competitiveGames = recentGames.filter(g => 
      g.season_type_name === 'Regular Season' || g.season_type_name === 'Postseason'
    );

    // recentGames comes in descending order by date usually, let's reverse to show timeline left to right
    return [...competitiveGames].reverse().map(g => ({
      name: new Date(g.date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
      Runs: g.team_score,
      Allowed: g.opponent_score,
      Diff: g.team_score - g.opponent_score,
      result: g.winner ? 'W' : 'L'
    }));
  }, [recentGames]);

  // 3. Prepare Offensive Radar Data (mocking league averages for visual context)
  const offensiveRadarData = useMemo(() => {
    if (!teamStats) return [];
    const avg = parseFloat(teamStats.team_avg) || 0;
    return [
      { metric: 'AVG', team: avg * 1000, league: 245, fullMark: 300 },
      { metric: 'R', team: (teamStats.total_runs / 162) * 10, league: 45, fullMark: 60 },
      { metric: 'HR', team: (teamStats.total_hr / 162) * 10, league: 12, fullMark: 20 },
      { metric: 'H', team: (teamStats.total_hits / 162) * 10, league: 85, fullMark: 110 }
    ];
  }, [teamStats]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Offensive Overview Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-headline font-black text-xl text-primary tracking-tight">Run Differential Trend</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Runs Scored vs Runs Allowed</p>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                <Line type="monotone" dataKey="Runs" stroke={primaryColor} strokeWidth={3} dot={{ r: 4, fill: primaryColor, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Allowed" stroke="#94a3b8" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Aggregate Pitching Stats */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-headline font-black text-xl text-primary tracking-tight">Pitching Metrics</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Team Aggregates</p>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center gap-6">
            {pitchingAggregates ? (
              <>
                <div className="flex items-end justify-between border-b border-slate-100 pb-4">
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Team ERA</span>
                  <span className="text-4xl font-black text-primary font-headline">{pitchingAggregates.era}</span>
                </div>
                <div className="flex items-end justify-between border-b border-slate-100 pb-4">
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Team WHIP</span>
                  <span className="text-4xl font-black text-primary font-headline">{pitchingAggregates.whip}</span>
                </div>
                <div className="flex items-end justify-between border-b border-slate-100 pb-4">
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">K/9</span>
                  <span className="text-4xl font-black text-primary font-headline">{pitchingAggregates.k9}</span>
                </div>
              </>
            ) : (
              <p className="text-slate-400 text-center text-sm font-medium">Pitching data not available</p>
            )}
          </div>
        </div>
      </div>

      {/* Offensive Radar Chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
         <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-headline font-black text-xl text-primary tracking-tight">Offensive Profile vs League Average</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Scaled metrics (Team vs MLB)</p>
            </div>
          </div>
          <div className="h-[400px] w-full max-w-2xl mx-auto">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={offensiveRadarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#475569', fontSize: 12, fontWeight: 'bold' }} />
                <PolarRadiusAxis angle={30} domain={[0, 300]} tick={false} axisLine={false} />
                <Radar name="Team Performance" dataKey="team" stroke={primaryColor} fill={primaryColor} fillOpacity={0.5} />
                <Radar name="League Average" dataKey="league" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.3} />
                <RechartsTooltip />
                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
};
