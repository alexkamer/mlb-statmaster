
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchEspnSplits, fetchPlayerProfile as fetchBackendProfile } from '../api';

export const PlayerPage = () => {
  const { playerId } = useParams();
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New state for handling the dynamic historical table
  const [splitsData, setSplitsData] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loadingSplits, setLoadingSplits] = useState(false);

  useEffect(() => {
    async function loadBaseData() {
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

        let teamHistory: Record<string, string> = {};
        try {
            const beData = await fetchBackendProfile(Number(playerId));
            if (beData && beData.team_history) {
                teamHistory = beData.team_history;
            }
            if (beData && beData.bio && beData.bio.team_abbreviation) {
                teamHistory["default"] = beData.bio.team_abbreviation;
            }
        } catch (e) {
            console.warn("Backend team mapping unavailable");
        }
        
        console.log("Loaded teamHistory:", teamHistory);
        
        // Failsafe: if backend is unreachable, at least use the ESPN base abbreviation
        if (!teamHistory["default"] && espnBase.athlete.team?.abbreviation) {
            teamHistory["default"] = espnBase.athlete.team.abbreviation;
        }

        setProfile({
          espnBase: espnBase.athlete,
          espnOverview: espnOverview,
          teamHistory: teamHistory
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadBaseData();
  }, [playerId]);

  // Secondary effect to load the multithreaded splits data
  useEffect(() => {
    async function loadSplits() {
      if (!playerId) return;
      setLoadingSplits(true);
      try {
          const splits = await fetchEspnSplits(Number(playerId), activeCategory || undefined);
          setSplitsData(splits);
          if (!activeCategory && splits.activeCategory) {
              setActiveCategory(splits.activeCategory);
          }
      } catch (e) {
          console.error("Failed to load detailed splits", e);
      } finally {
          setLoadingSplits(false);
      }
    }
    loadSplits();
  }, [playerId, activeCategory]);

  if (loading) return <div className="min-h-screen bg-surface flex items-center justify-center font-headline font-black text-2xl text-primary">LOADING PLAYER...</div>;
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
    acc[s.name] = { value: s.displayValue, rank: s.rankDisplayValue, display: s.shortDisplayName };
    return acc;
  }, {});

  const statKeys = Object.keys(statsSummaryMap);
  const card1 = statKeys[0] ? statsSummaryMap[statKeys[0]] : { value: "-", display: "-", rank: "" };
  const card2 = statKeys[1] ? statsSummaryMap[statKeys[1]] : { value: "-", display: "-", rank: "" };
  const card3 = statKeys[2] ? statsSummaryMap[statKeys[2]] : { value: "-", display: "-", rank: "" };
  const card4 = statKeys[3] ? statsSummaryMap[statKeys[3]] : { value: "-", display: "-", rank: "" };

  const awards = espnOverview.awards || [];

  // Sort seasons descending
  const sortedSeasons = [...(splitsData?.seasons || [])].sort((a: any, b: any) => Number(b.season) - Number(a.season));

  // Calculate background brightness to determine which logo to use
  const getBrightness = (hex: string) => {
    const rgb = parseInt(hex || "00193c", 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >>  8) & 0xff;
    const b = (rgb >>  0) & 0xff;
    return (r * 299 + g * 587 + b * 114) / 1000;
  };
  
  const isDarkBackground = getBrightness(bio.team_color) < 128;
  const isLightAlternate = getBrightness(bio.team_alternate_color) > 160;





  let backgroundLogo = espnBase.team?.logos?.[0]?.href;
  if (espnBase.team?.logos) {
      if (isDarkBackground) {
          const darkLogo = espnBase.team.logos.find((l:any) => l.rel?.includes("dark"));
          if (darkLogo) backgroundLogo = darkLogo.href;
      } else {
          const defaultLogo = espnBase.team.logos.find((l:any) => l.rel?.includes("default"));
          if (defaultLogo) backgroundLogo = defaultLogo.href;
      }
  }


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
              <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full flex items-center justify-center font-headline font-black text-2xl shadow-lg border-2 border-white/20" 
                   style={{ 
                       backgroundColor: `#${bio.team_alternate_color}`,
                       color: isLightAlternate ? `#${bio.team_color}` : "#ffffff"
                   }}>
                  {espnBase.displayJersey}
              </div>
            )}
          </div>
          
          {/* Player Info */}
          <div className="flex-1 mb-2 relative">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 text-xs font-bold tracking-widest uppercase rounded-full" 
                      style={{ 
                          backgroundColor: bio.is_active ? `#${bio.team_alternate_color}` : "#64748b",
                          color: bio.is_active && isLightAlternate ? `#${bio.team_color}` : "#ffffff",
                          border: bio.is_active && isLightAlternate ? "1px solid rgba(0,0,0,0.1)" : "none"
                      }}>
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
            <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Season {card1.display}</p>
            <p className="font-headline font-black text-4xl" style={{ color: `#${bio.team_color}` }}>{card1.value}</p>
            <p className="text-emerald-700 text-xs font-bold mt-1">{card1.rank}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-b-4 transition-all hover:translate-y-[-4px]" style={{ borderColor: `#${bio.team_color}` }}>
            <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Season {card2.display}</p>
            <p className="font-headline font-black text-4xl" style={{ color: `#${bio.team_color}` }}>{card2.value}</p>
            <p className="text-slate-500 text-xs mt-1">{card2.rank}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-b-4 transition-all hover:translate-y-[-4px]" style={{ borderColor: `#${bio.team_color}` }}>
            <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Season {card3.display}</p>
            <p className="font-headline font-black text-4xl" style={{ color: `#${bio.team_color}` }}>{card3.value}</p>
            <p className="text-emerald-700 text-xs font-bold mt-1">{card3.rank}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-b-4 transition-all hover:translate-y-[-4px]" style={{ borderColor: `#${bio.team_color}` }}>
            <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-2">Season {card4.display}</p>
            <p className="font-headline font-black text-4xl" style={{ color: `#${bio.team_color}` }}>{card4.value}</p>
            <p className="text-emerald-700 text-xs font-bold mt-1">{card4.rank}</p>
          </div>
        </div>
      </section>

      {/* Dynamic Splits Table Section */}
      <section className="max-w-7xl mx-auto p-8 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
          <div>
            <h2 className="font-headline font-black text-xs uppercase tracking-[0.2em] mb-2" style={{ color: `#${bio.team_alternate_color}` }}>The Archive</h2>
            <h3 className="font-headline font-black text-4xl tracking-tighter" style={{ color: `#${bio.team_color}` }}>SEASON-BY-SEASON SPLITS</h3>
          </div>
          
          <div className="flex gap-2">
            {splitsData?.availableCategories?.length > 1 && splitsData.availableCategories.map((cat: string) => (
               <button 
                 key={cat}
                 onClick={() => setActiveCategory(cat)}
                 className="px-4 py-2 text-xs font-black uppercase tracking-widest rounded-md transition-colors" 
                 style={{ 
                     backgroundColor: activeCategory === cat ? `#${bio.team_color}` : '#e2e8f0',
                     color: activeCategory === cat ? '#ffffff' : `#${bio.team_color}`
                 }}
               >
                 {cat}
               </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200">
          <div className="overflow-x-auto relative">
            {loadingSplits && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
                    <span className="font-bold text-slate-500 animate-pulse uppercase tracking-widest text-sm">Aggregating History...</span>
                </div>
            )}
            <table className="w-full text-left border-collapse tabular-nums">
              <thead>
                <tr className="text-white font-bold text-[10px] uppercase tracking-widest" style={{ backgroundColor: `#${bio.team_color}` }}>
                  <th className="px-6 py-4 whitespace-nowrap">Year</th>
                  <th className="px-4 py-4 whitespace-nowrap">Team</th>
                  {splitsData?.labels?.map((label: string, i: number) => (
                      <th key={i} className={`px-4 py-4 text-right whitespace-nowrap ${i === splitsData.labels.length - 1 ? "bg-black/20" : ""}`}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-slate-800 text-sm">
                {sortedSeasons.length > 0 ? sortedSeasons.map((row: any, idx: number) => (
                  <tr key={`${row.season}-${idx}`} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                    <td className="px-6 py-3 font-bold" style={{ color: `#${bio.team_color}` }}>{row.season}</td>
                    <td className="px-4 py-3 text-slate-500 font-medium whitespace-nowrap">
                        {row.team}
                    </td>
                    {row.stats.map((stat: string, i: number) => (
                        <td key={i} className={`px-4 py-3 text-right whitespace-nowrap ${i === row.stats.length - 1 ? "font-black bg-slate-50" : ""}`} style={i === row.stats.length - 1 ? { color: `#${bio.team_color}` } : {}}>
                            {stat}
                        </td>
                    ))}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={20} className="px-6 py-8 text-center text-slate-500 font-bold">
                        {loadingSplits ? "Loading stats..." : "No detailed split statistics available for this category."}
                    </td>
                  </tr>
                )}
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
