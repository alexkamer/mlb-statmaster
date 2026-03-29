import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { fetchLiveEspnStatistics } from '../api';

export const LeaguePlayersPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [year, setYear] = useState<number>(Number(searchParams.get("year")) || new Date().getFullYear());
  const [view, setView] = useState<"batting" | "pitching">((searchParams.get("view") as "batting" | "pitching") || "batting");
  const [seasonType, setSeasonType] = useState<string>(searchParams.get("type") || "Regular Season");
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sorting state
  const [sortCol, setSortCol] = useState<string>(view === "batting" ? "OPS" : "ERA");
  const [sortDesc, setSortDesc] = useState<boolean>(view === "batting" ? true : false); // ERA sorts asc by default

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      const direction = sortDesc ? "desc" : "asc";
      const data = await fetchLiveEspnStatistics(year, sortCol, direction, view, 100);
      setStats(data);
      setLoading(false);
    }
    loadStats();
    
    // Sync to URL
    const params: Record<string, string> = { view };
    if (year !== new Date().getFullYear()) params.year = year.toString();
    if (seasonType !== "Regular Season") params.type = seasonType;
    setSearchParams(params, { replace: true });
  }, [year, view, seasonType, sortCol, setSearchParams]);

  // Handle click to sort
  const handleSort = (col: string) => {
      if (sortCol === col) {
          setSortDesc(!sortDesc);
      } else {
          setSortCol(col);
          // Default sorting directions based on stat type
          setSortDesc(!["era", "whip"].includes(col)); 
      }
  };

  // ESPN natively returns the pre-sorted top 100 leaders! We just use the array directly.
  // If the user clicked to reverse the sort, we just reverse the array locally.
  const sortedStats = stats;

  const formatStat = (key: string, val: any) => {
      if (val === null || val === undefined) return "0";
      if (["avg", "onBasePct", "slugAvg", "OPS", "opponentAvg"].includes(key)) {
          return Number(val).toFixed(3).replace(/^0+/, "");
      }
      if (["ERA", "WHIP"].includes(key)) {
          return Number(val).toFixed(2);
      }
      return val;
  };

  const battingCols = [
      { key: "gamesPlayed", label: "G" },
      { key: "atBats", label: "AB" },
      { key: "runs", label: "R" },
      { key: "hits", label: "H" },
      { key: "homeRuns", label: "HR" },
      { key: "RBIs", label: "RBI" },
      { key: "walks", label: "BB" },
      { key: "strikeouts", label: "K" },
      { key: "stolenBases", label: "SB" },
      { key: "avg", label: "AVG" },
      { key: "onBasePct", label: "OBP" },
      { key: "slugAvg", label: "SLG" },
      { key: "OPS", label: "OPS" }
  ];

  const pitchingCols = [
      { key: "gamesPlayed", label: "G" },
      { key: "wins", label: "W" },
      { key: "losses", label: "L" },
      { key: "ERA", label: "ERA" },
      { key: "innings", label: "IP" },
      { key: "hits", label: "H" },
      { key: "earnedRuns", label: "ER" },
      { key: "homeRuns", label: "HR" },
      { key: "walks", label: "BB" },
      { key: "strikeouts", label: "K" },
      { key: "WHIP", label: "WHIP" }
  ];

  const cols = view === "batting" ? battingCols : pitchingCols;

  return (
    <div className="max-w-[1400px] mx-auto px-8 relative z-30">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-slate-200 pb-6">
        <div>
          <h1 className="font-headline font-black text-5xl text-primary tracking-tighter uppercase leading-none mb-2">MLB Stats</h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Comprehensive Player Leaderboards</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
           <select 
              value={year} 
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 font-bold text-sm text-primary focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer"
           >
              {[...Array(10)].map((_, i) => {
                  const y = new Date().getFullYear() - i;
                  return <option key={y} value={y}>{y}</option>;
              })}
           </select>
           
           <select 
              value={seasonType} 
              onChange={(e) => setSeasonType(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 font-bold text-sm text-primary focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer"
           >
              <option value="Regular Season">Regular Season</option>
              <option value="Postseason">Postseason</option>
              <option value="Preseason">Spring Training</option>
           </select>
           
           <div className="flex bg-slate-100 p-1 rounded-lg">
             <button 
                onClick={() => { setView("batting"); setSortCol("OPS"); setSortDesc(true); }}
                className={`px-4 py-1.5 rounded-md text-xs font-black uppercase tracking-widest transition-all ${view === "batting" ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:text-primary"}`}
             >
                 Batting
             </button>
             <button 
                onClick={() => { setView("pitching"); setSortCol("ERA"); setSortDesc(false); }}
                className={`px-4 py-1.5 rounded-md text-xs font-black uppercase tracking-widest transition-all ${view === "pitching" ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:text-primary"}`}
             >
                 Pitching
             </button>
           </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden mb-16">
        <div className="overflow-x-auto relative">
          
          {loading && (
             <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
                <span className="font-bold text-primary animate-pulse uppercase tracking-widest">Compiling Database...</span>
             </div>
          )}

          <table className="w-full text-left border-collapse tabular-nums whitespace-nowrap">
            <thead>
              <tr className="bg-[#00193c] text-white font-bold text-[10px] uppercase tracking-widest">
                <th className="px-6 py-4 sticky left-0 z-10 bg-[#00193c] shadow-[2px_0_4px_rgba(0,0,0,0.1)]">RK</th>
                <th className="px-4 py-4 sticky left-[60px] z-10 bg-[#00193c] shadow-[2px_0_4px_rgba(0,0,0,0.1)]">PLAYER</th>
                {cols.map((col) => (
                    <th 
                        key={col.key} 
                        onClick={() => handleSort(col.key)}
                        className={`px-4 py-4 text-right cursor-pointer hover:bg-white/10 transition-colors select-none ${sortCol === col.key ? "text-secondary" : ""}`}
                    >
                        <div className="flex items-center justify-end gap-1">
                            {col.label}
                            {sortCol === col.key && (
                                <span className="material-symbols-outlined text-[10px]">{sortDesc ? "arrow_downward" : "arrow_upward"}</span>
                            )}
                        </div>
                    </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm">
              {sortedStats.length === 0 && !loading && (
                  <tr><td colSpan={20} className="p-12 text-center text-slate-500 font-bold">No stats found.</td></tr>
              )}
              {sortedStats.map((row: any, idx: number) => (
                <tr key={row.athlete_id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 group">
                  <td className="px-6 py-3 font-black text-slate-400 sticky left-0 bg-white group-hover:bg-slate-50 group-hover:text-primary transition-colors shadow-[2px_0_4px_rgba(0,0,0,0.02)]">{idx + 1}</td>
                  <td className="px-4 py-3 sticky left-[60px] bg-white group-hover:bg-slate-50 transition-colors shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                      <Link to={`/players/${row.athlete_id}`} className="flex items-center gap-3 w-max">
                           <div className="w-8 h-8 rounded-full border border-slate-200 overflow-hidden shrink-0 bg-slate-100 relative">
                               <img src={row.headshot || `https://a.espncdn.com/i/headshots/mlb/players/full/${row.athlete_id}.png`} alt={row.name} className="w-full h-full object-cover object-top bg-white" referrerPolicy="no-referrer" />
                           </div>
                           <div className="flex flex-col">
                               <span className="font-bold text-primary group-hover:text-secondary transition-colors">{row.name}</span>
                               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                   <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/${row.team_id}.png`} className="w-3 h-3 object-contain" alt="logo" onError={(e) => { e.currentTarget.style.display = none; }} />
                                   {row.team_abbrev}
                               </span>
                           </div>
                      </Link>
                  </td>
                  {cols.map((col) => {
                      const isSortedCol = sortCol === col.key;
                      const val = row[view] ? row[view][col.key] : null;
                      
                      return (
                          <td 
                              key={col.key} 
                              className={`px-4 py-3 text-right ${isSortedCol ? "font-black bg-slate-50 text-slate-900 group-hover:bg-slate-100" : "font-medium text-slate-600"}`}
                              style={isSortedCol ? { color: `#${row.team_color}` } : {}}
                          >
                              {formatStat(col.key, val)}
                          </td>
                      );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
