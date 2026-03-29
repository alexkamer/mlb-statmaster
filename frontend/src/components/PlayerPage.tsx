
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export const PlayerPage = () => {
  const { playerId } = useParams();
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!playerId) return;
      setLoading(true);
      setError(null);
      try {
        const espnBaseRes = await fetch(`https://site.web.api.espn.com/apis/common/v3/sports/baseball/mlb/athletes/${playerId}`);
        if (!espnBaseRes.ok) throw new Error("Failed to load base player data");
        const espnBase = await espnBaseRes.json();
        
        const espnOverviewRes = await fetch(`https://site.web.api.espn.com/apis/common/v3/sports/baseball/mlb/athletes/${playerId}/overview`);
        if (!espnOverviewRes.ok) throw new Error("Failed to load player overview");
        const espnOverview = await espnOverviewRes.json();

        setProfile({
          espnBase: espnBase.athlete,
          espnOverview: espnOverview
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [playerId]);

  if (loading) return <div className="min-h-screen bg-surface flex items-center justify-center font-headline font-black text-2xl text-[#00193c]">LOADING PLAYER...</div>;
  if (error || !profile) return <div className="min-h-screen bg-surface flex items-center justify-center font-bold text-rose-500">{error || "Error loading player"}</div>;

  const { espnBase, espnOverview } = profile;
  
  const bio = {
    first_name: espnBase.firstName || "",
    last_name: espnBase.lastName || "",
    team_name: espnBase.team?.displayName || "Free Agent",
    team_color: espnBase.team?.color || "00193c",
    team_alternate_color: espnBase.team?.alternateColor || "b80a2e",
    position_name: espnBase.position?.name || "Unknown",
    position_abbreviation: espnBase.position?.abbreviation || "UN",
    bats: espnBase.displayBatsThrows?.split("/")?.[0]?.charAt(0) || "?",
    throws: espnBase.displayBatsThrows?.split("/")?.[1]?.charAt(0) || "?",
    height: espnBase.displayHeight || "--",
    weight: espnBase.displayWeight || "--",
    age: espnBase.age || "--",
    is_active: espnBase.status?.type === "active",
    headshot: espnBase.headshot?.href || `https://a.espncdn.com/i/headshots/mlb/players/full/${playerId}.png`
  };

  const draftStr = espnBase.displayDraft ? espnBase.displayDraft : "Undrafted";

  // Top Level Stats (from statsSummary)
  const statsSummaryMap = (espnBase.statsSummary?.statistics || []).reduce((acc: any, s: any) => {
    acc[s.name] = { value: s.displayValue, rank: s.rankDisplayValue };
    return acc;
  }, {});

  const hrVal = statsSummaryMap.homeRuns?.value || "0";
  const hrRank = statsSummaryMap.homeRuns?.rank || "";
  const rbiVal = statsSummaryMap.RBIs?.value || "0";
  const rbiRank = statsSummaryMap.RBIs?.rank || "";
  const avgVal = statsSummaryMap.avg?.value || ".000";
  const opsVal = statsSummaryMap.OPS?.value || ".000";

  // Calculate background brightness to determine which logo to use
  const getBrightness = (hex: string) => {
    const rgb = parseInt(hex || "00193c", 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >>  8) & 0xff;
    const b = (rgb >>  0) & 0xff;
    return (r * 299 + g * 587 + b * 114) / 1000;
  };
  const isDarkBackground = getBrightness(bio.team_color) < 128;

  // Select the appropriate logo
  let backgroundLogo = espnBase.team?.logos?.[0]?.href;
  if (espnBase.team?.logos) {
      if (isDarkBackground) {
          // Look for a dark mode logo (usually white or highly contrasted)
          const darkLogo = espnBase.team.logos.find((l:any) => l.rel?.includes("dark"));
          if (darkLogo) backgroundLogo = darkLogo.href;
      } else {
          // Look for default/light logo
          const defaultLogo = espnBase.team.logos.find((l:any) => l.rel?.includes("default"));
          if (defaultLogo) backgroundLogo = defaultLogo.href;
      }
  }

  const awards = espnOverview.awards || [];

  // Parse Career Totals from overview endpoint!
  // It has splits: ["Regular Season", "Projected", "Career"]
  let careerStats = { g: "0", ab: "0", r: "0", h: "0", hr: "0", rbi: "0", bb: "0", k: "0", avg: ".000", obp: ".000", slg: ".000", ops: ".000" };
  
  if (espnOverview.statistics && espnOverview.statistics.splits) {
      const labels = espnOverview.statistics.labels || [];
      const careerSplit = espnOverview.statistics.splits.find((s:any) => s.displayName === "Career");
      
      if (careerSplit && careerSplit.stats) {
          const statsArr = careerSplit.stats;
          // Map array back to labels
          // Labels usually: ["GP","AB","R","H","2B","3B","HR","RBI","BB","SO"]
          const getStat = (lbl:string) => {
              const idx = labels.indexOf(lbl);
              return idx !== -1 ? statsArr[idx] : "0";
          };
          
          careerStats = {
              g: getStat("GP"),
              ab: getStat("AB"),
              r: getStat("R"),
              h: getStat("H"),
              hr: getStat("HR"),
              rbi: getStat("RBI"),
              bb: getStat("BB"),
              k: getStat("SO"),
              // If AVG/OBP/SLG/OPS arent in the labels (often they arent in the short overview),
              // we can pull them from espnBase.statsSummary if needed, or leave as "-"
              avg: avgVal,
              obp: "-",
              slg: "-",
              ops: opsVal
          };
      }
  }

  // We are skipping the backend historical table for now to fix the crash
  // and ensure we rely solely on ESPN as requested.

  return (
    <>
      {/* Player Hero Section */}
      <section className="relative overflow-hidden h-[480px] flex items-end" style={{ backgroundColor: `#${bio.team_color}` }}>
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent opacity-90 z-10"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10"></div>
        
        {/* Massive Team Logo Background Texture */}
        {backgroundLogo && (
          <div className="absolute inset-0 flex justify-center items-center pointer-events-none select-none overflow-hidden opacity-10">
            <img 
              src={backgroundLogo} 
              alt="Team Logo Background" 
              className="w-[120%] h-[120%] object-contain" 
            />
          </div>
        )}
        
        <div className="max-w-7xl mx-auto px-8 pb-12 w-full relative z-20 flex flex-col md:flex-row items-end gap-12">
          {/* Player Photo */}
          <div className="relative group shrink-0">
            <div className="w-64 h-80 bg-slate-100 rounded-xl overflow-hidden shadow-2xl border-4 border-white transform hover:rotate-2 transition-transform duration-300 flex items-center justify-center text-4xl text-slate-300 font-black">
              <img 
                src={bio.headshot} 
                alt={bio.first_name} 
                className="w-full h-full object-cover object-top"
                referrerPolicy="no-referrer"
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://a.espncdn.com/i/headshots/nophoto.png'; }}
              />
            </div>
            {espnBase.displayJersey && (
              <div className="absolute -top-4 -right-4 text-white w-16 h-16 rounded-full flex items-center justify-center font-headline font-black text-2xl shadow-lg" style={{ backgroundColor: `#${bio.team_alternate_color}` }}>
                  {espnBase.displayJersey}
              </div>
            )}
          </div>
          

          {/* Player Info */}
          {/* Player Info */}
          <div className="flex-1 mb-2 relative">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-3 py-1 text-xs font-bold tracking-widest uppercase rounded-full ${bio.is_active ? 'text-white' : 'bg-slate-500 text-white'}`} style={{ backgroundColor: bio.is_active ? `#${bio.team_alternate_color}` : '#64748b' }}>
                  {bio.is_active ? "Active" : "Inactive"}
                </span>
                <span className="text-white/70 text-sm font-medium tracking-wide">Major League Baseball</span>
              </div>
              
              <h1 className="text-white font-headline font-black text-6xl md:text-8xl tracking-tighter leading-none mb-6 drop-shadow-lg uppercase">
                {bio.first_name} <br/> 
                <span style={{ color: `#${bio.team_alternate_color}` }}>{bio.last_name}</span>
              </h1>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-6 border-t border-white/10">
                <div>
                  <p className="text-white/50 text-xs uppercase font-bold tracking-widest mb-1">Team</p>
                  <p className="text-white font-bold text-lg uppercase">{bio.team_name}</p>
                </div>
                <div>
                  <p className="text-white/50 text-xs uppercase font-bold tracking-widest mb-1">Position</p>
                  <p className="text-white font-bold text-lg uppercase">{bio.position_name}</p>
                </div>
                <div>
                  <p className="text-white/50 text-xs uppercase font-bold tracking-widest mb-1">Bio</p>
                  <p className="text-white font-bold text-lg">{bio.height} / {bio.weight}</p>
                </div>
                <div>
                  <p className="text-white/50 text-xs uppercase font-bold tracking-widest mb-1">Draft</p>
                  <p className="text-white font-bold text-sm leading-tight">{draftStr}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Overview Cards */}
      <section className="max-w-7xl mx-auto px-8 -mt-8 relative z-30">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border-b-4 transition-all hover:translate-y-[-4px]" style={{ borderColor: `#${bio.team_alternate_color}` }}>
            <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Season HR</p>
            <p className="font-headline font-black text-4xl" style={{ color: `#${bio.team_color}` }}>{hrVal}</p>
            <p className="text-emerald-700 text-xs font-bold mt-1">{hrRank}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-b-4 transition-all hover:translate-y-[-4px]" style={{ borderColor: `#${bio.team_color}` }}>
            <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Season AVG</p>
            <p className="font-headline font-black text-4xl" style={{ color: `#${bio.team_color}` }}>{avgVal}</p>
            <p className="text-slate-500 text-xs mt-1">Batting Average</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-b-4 transition-all hover:translate-y-[-4px]" style={{ borderColor: `#${bio.team_color}` }}>
            <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Season RBI</p>
            <p className="font-headline font-black text-4xl" style={{ color: `#${bio.team_color}` }}>{rbiVal}</p>
            <p className="text-emerald-700 text-xs font-bold mt-1">{rbiRank}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-b-4 transition-all hover:translate-y-[-4px]" style={{ borderColor: `#${bio.team_color}` }}>
            <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Season OPS</p>
            <p className="font-headline font-black text-4xl" style={{ color: `#${bio.team_color}` }}>{opsVal}</p>
            <p className="text-emerald-700 text-xs font-bold mt-1">OBP + SLG</p>
          </div>
        </div>
      </section>

      {/* Stats Table Section */}
      <section className="max-w-7xl mx-auto p-8 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
          <div>
            <h2 className="font-headline font-black text-xs uppercase tracking-[0.2em] mb-2" style={{ color: `#${bio.team_alternate_color}` }}>The Archive</h2>
            <h3 className="font-headline font-black text-4xl tracking-tighter" style={{ color: `#${bio.team_color}` }}>CAREER TOTALS</h3>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-white text-xs font-black uppercase tracking-widest rounded-md" style={{ backgroundColor: `#${bio.team_color}` }}>Hitting</button>
          </div>
        </div>

        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse tabular-nums">
              <thead>
                <tr className="text-white font-bold text-[10px] uppercase tracking-widest" style={{ backgroundColor: `#${bio.team_color}` }}>
                  <th className="px-6 py-4">Span</th>
                  <th className="px-4 py-4 text-right">G</th>
                  <th className="px-4 py-4 text-right">AB</th>
                  <th className="px-4 py-4 text-right">R</th>
                  <th className="px-4 py-4 text-right">H</th>
                  <th className="px-4 py-4 text-right">HR</th>
                  <th className="px-4 py-4 text-right">RBI</th>
                  <th className="px-4 py-4 text-right">BB</th>
                  <th className="px-4 py-4 text-right">K</th>
                </tr>
              </thead>
              <tbody className="text-slate-800 text-sm">
                  <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                    <td className="px-6 py-3 font-bold" style={{ color: `#${bio.team_color}` }}>Career</td>
                    <td className="px-4 py-3 text-right">{careerStats.g}</td>
                    <td className="px-4 py-3 text-right">{careerStats.ab}</td>
                    <td className="px-4 py-3 text-right">{careerStats.r}</td>
                    <td className="px-4 py-3 text-right">{careerStats.h}</td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: `#${bio.team_alternate_color}` }}>{careerStats.hr}</td>
                    <td className="px-4 py-3 text-right">{careerStats.rbi}</td>
                    <td className="px-4 py-3 text-right">{careerStats.bb}</td>
                    <td className="px-4 py-3 text-right">{careerStats.k}</td>
                  </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Career Highlights Grid */}
      {awards.length > 0 && (
        <section className="max-w-7xl mx-auto p-8 mb-16">
          <h3 className="font-headline font-black text-2xl tracking-tighter mb-6 uppercase" style={{ color: `#${bio.team_color}` }}>CAREER ACCOLADES</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {awards.slice(0, 8).map((award: any, i: number) => (
              <div key={i} className="bg-white p-6 border border-slate-200 rounded-xl flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="p-3 rounded-lg flex items-center justify-center" style={{ backgroundColor: `#${bio.team_color}10`, color: `#${bio.team_color}` }}>
                  <span className="text-xl font-black">{award.displayCount}</span>
                </div>
                <div>
                  <p className="font-bold leading-tight" style={{ color: `#${bio.team_color}` }}>{award.name}</p>
                  <p className="text-xs text-slate-500 font-medium mt-1 truncate" title={award.seasons?.join(", ")}>
                    {award.seasons?.slice(0, 3).join(", ")} {award.seasons?.length > 3 ? "..." : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
};
