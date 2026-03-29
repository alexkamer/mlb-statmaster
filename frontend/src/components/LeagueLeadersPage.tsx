import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { fetchLeagueLeaders } from '../api';

export const LeagueLeadersPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [year, setYear] = useState<number>(Number(searchParams.get("year")) || new Date().getFullYear());
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLeaders() {
      setLoading(true);
      const data = await fetchLeagueLeaders(year);
      setLeaders(data);
      setLoading(false);
    }
    loadLeaders();
    
    // Sync to URL
    const params: Record<string, string> = {};
    if (year !== new Date().getFullYear()) params.year = year.toString();
    setSearchParams(params, { replace: true });
  }, [year, setSearchParams]);

  const formatStat = (catName: string, val: number) => {
    if (["avg", "onBasePct", "slugAvg", "OPS", "opponentAvg"].includes(catName)) {
        return val.toFixed(3).replace(/^0+/, "");
    }
    if (["ERA", "WHIP"].includes(catName)) {
        return val.toFixed(2);
    }
    if (["WARBR"].includes(catName)) {
        return val.toFixed(1);
    }
    // Count stats like HR, RBI
    return Math.round(val).toString();
  };

  if (loading) return <div className="min-h-screen bg-surface flex items-center justify-center font-headline font-black text-2xl text-primary">LOADING LEADERBOARDS...</div>;

  return (
    <div className="max-w-7xl mx-auto px-8 relative z-30">
      <div className="mb-8 flex justify-between items-end border-b-2 border-slate-200 pb-4">
        <div>
          <h1 className="font-headline font-black text-4xl text-primary tracking-tighter uppercase">League Leaders</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm mt-2">The absolute best in baseball.</p>
        </div>
        <div className="flex items-center gap-4">
           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Season</label>
           <select 
              value={year} 
              onChange={(e) => setYear(Number(e.target.value))}
              className="border border-slate-300 rounded px-4 py-2 font-bold text-sm text-primary focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer bg-white"
           >
              {[...Array(10)].map((_, i) => {
                  const y = new Date().getFullYear() - i;
                  return <option key={y} value={y}>{y}</option>;
              })}
           </select>
        </div>
      </div>
      
      {leaders.length === 0 && !loading && (
          <div className="py-12 text-center text-slate-500 font-bold w-full">No leader data available for {year}.</div>
      )}

      {leaders.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 mb-16">
            
            {/* Hitting Column */}
            <div>
              <div className="flex items-center gap-3 mb-6 border-b-2 border-slate-200 pb-2">
                <h2 className="font-headline font-black text-3xl text-primary tracking-tighter uppercase">Hitting</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {leaders.filter(c => !["ERA", "wins", "strikeouts", "saves", "WHIP", "qualityStarts", "opponentAvg", "holds", "avgGameScore"].includes(c.name)).map((cat: any, idx: number) => (
                  <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
                       <h3 className="font-headline font-black text-primary uppercase tracking-widest text-sm truncate">{cat.displayName}</h3>
                    </div>
                    <div className="flex-1 p-0">
                       {cat.leaders.map((leader: any, lIdx: number) => (
                           <Link key={lIdx} to={`/players/${leader.id}`} className="flex items-center gap-4 p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors group cursor-pointer block">
                               <span className="font-black text-xl text-slate-300 w-4 group-hover:text-primary transition-colors">{lIdx + 1}</span>
                               <div className="w-10 h-10 rounded-full border-2 overflow-hidden shrink-0 shadow-sm relative bg-slate-200 group-hover:scale-110 transition-transform" style={{ borderColor: `#${leader.teamColor}` }}>
                                   <img src={leader.headshot} alt={leader.name} className="w-full h-full object-cover object-top bg-white" referrerPolicy="no-referrer" />
                                   <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/${leader.teamId}.png`} className="absolute bottom-0 right-0 w-4 h-4 bg-white rounded-full border border-slate-200 object-contain" alt="team" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                               </div>
                               <div className="flex-1 min-w-0">
                                   <p className="font-bold text-sm text-primary truncate group-hover:text-secondary transition-colors" style={{ color: `#${leader.teamColor}` }}>{leader.name}</p>
                               </div>
                               <div className="text-right shrink-0">
                                   <span className="font-black text-lg" style={{ color: `#${leader.teamColor}` }}>{formatStat(cat.name, leader.value)}</span>
                               </div>
                           </Link>
                       ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pitching Column */}
            <div>
              <div className="flex items-center gap-3 mb-6 border-b-2 border-slate-200 pb-2">
                <h2 className="font-headline font-black text-3xl text-primary tracking-tighter uppercase">Pitching</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {leaders.filter(c => ["ERA", "wins", "strikeouts", "saves", "WHIP", "qualityStarts", "opponentAvg", "holds", "avgGameScore"].includes(c.name)).map((cat: any, idx: number) => (
                  <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
                       <h3 className="font-headline font-black text-primary uppercase tracking-widest text-sm truncate">{cat.displayName}</h3>
                    </div>
                    <div className="flex-1 p-0">
                       {cat.leaders.map((leader: any, lIdx: number) => (
                           <Link key={lIdx} to={`/players/${leader.id}`} className="flex items-center gap-4 p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors group cursor-pointer block">
                               <span className="font-black text-xl text-slate-300 w-4 group-hover:text-primary transition-colors">{lIdx + 1}</span>
                               <div className="w-10 h-10 rounded-full border-2 overflow-hidden shrink-0 shadow-sm relative bg-slate-200 group-hover:scale-110 transition-transform" style={{ borderColor: `#${leader.teamColor}` }}>
                                   <img src={leader.headshot} alt={leader.name} className="w-full h-full object-cover object-top bg-white" referrerPolicy="no-referrer" />
                                   <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/${leader.teamId}.png`} className="absolute bottom-0 right-0 w-4 h-4 bg-white rounded-full border border-slate-200 object-contain" alt="team" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                               </div>
                               <div className="flex-1 min-w-0">
                                   <p className="font-bold text-sm text-primary truncate group-hover:text-secondary transition-colors" style={{ color: `#${leader.teamColor}` }}>{leader.name}</p>
                               </div>
                               <div className="text-right shrink-0">
                                   <span className="font-black text-lg" style={{ color: `#${leader.teamColor}` }}>{formatStat(cat.name, leader.value)}</span>
                               </div>
                           </Link>
                       ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
      )}
    </div>
  );
};
