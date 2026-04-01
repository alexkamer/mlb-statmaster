import { SafeImage } from '../shared/SafeImage';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { fetchEspnSplits, fetchPlayerProfile as fetchBackendProfile, fetchPlayerGameLogs } from '../../api';

export const PlayerPage = () => {
  const { playerId } = useParams();
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New state for handling the dynamic historical table
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [splitsData, setSplitsData] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(searchParams.get("category") || null);
  const [loadingSplits, setLoadingSplits] = useState(false);
  
  const [gameLogs, setGameLogs] = useState<any>({ batting: [], pitching: [] });
  const [activeLogYear, setActiveLogYear] = useState<number>(parseInt(searchParams.get("season") || String(new Date().getFullYear())));
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  const _tabParam = searchParams.get("tab");
  const initialTab = _tabParam === "awards" ? "Awards" : _tabParam === "gamelog" ? "GameLog" : "Stats";
  const [activeTab, setActiveTab] = useState<"Stats" | "Awards" | "GameLog">(initialTab);

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
        
        
        
        // Failsafe: if backend is unreachable, at least use the ESPN base abbreviation
        if (!teamHistory["default"] && espnBase.athlete.team?.abbreviation) {
            teamHistory["default"] = espnBase.athlete.team.abbreviation;
        }

        setProfile({
          espnBase: espnBase.athlete,
          espnOverview: espnOverview,
          teamHistory: teamHistory
        });

        // Set active category automatically if not in URL
        if (!searchParams.get("category")) {
          const pos = espnBase.athlete.position?.abbreviation;
          if (pos === "SP" || pos === "RP") {
            setActiveCategory("pitching");
          } else {
            setActiveCategory("batting");
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadBaseData();
  }, [playerId]);

  // Effect to load gamelogs
  useEffect(() => {
    async function loadLogs() {
        if (!playerId || activeTab !== "GameLog") return;
        setLoadingLogs(true);
        try {
            const logs = await fetchPlayerGameLogs(Number(playerId), activeLogYear);
            setGameLogs(logs);
        } catch (e) {
            console.error("Failed to load logs", e);
        } finally {
            setLoadingLogs(false);
        }
    }
    loadLogs();
  }, [playerId, activeTab, activeLogYear]);

  // Secondary effect to load the multithreaded splits data
  useEffect(() => {
    async function loadSplits() {
      if (!playerId || !activeCategory) return;
      setLoadingSplits(true);
      try {
          const splits = await fetchEspnSplits(Number(playerId), activeCategory);
          setSplitsData(splits);
      } catch (e) {
          console.error("Failed to load detailed splits", e);
      } finally {
          setLoadingSplits(false);
      }
    }
    loadSplits();
  }, [playerId, activeCategory]);

  // Synchronize state changes to URL
  useEffect(() => {
    const params: Record<string, string> = { tab: activeTab.toLowerCase() };
    if (activeCategory) params.category = activeCategory;
    if (activeTab === "GameLog") params.season = activeLogYear.toString();
    setSearchParams(params, { replace: true });
  }, [activeTab, activeCategory, activeLogYear, setSearchParams]);

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



  const awards = espnOverview.awards || [];

  // Sort seasons descending
  const sortedSeasons = [...(splitsData?.seasons || [])].sort((a: any, b: any) => Number(b.season) - Number(a.season));

  // Top Level Stats (from statsSummary OR extracted dynamically from the latest splits row)
  let statsSummaryMap = (espnBase.statsSummary?.statistics || []).reduce((acc: any, s: any) => {
    acc[s.name] = { value: s.displayValue, rank: s.rankDisplayValue, display: s.shortDisplayName };
    return acc;
  }, {});

  // If ESPN's high-level statsSummary is empty (often happens early in the season), we will manually extract the active category's most recent season from our deeply fetched splitsData!
  if (Object.keys(statsSummaryMap).length === 0 && sortedSeasons.length > 0 && splitsData?.labels) {
      const latestSeason = sortedSeasons[0];
      const labels = splitsData.labels;
      const stats = latestSeason.stats;
      
      const findStat = (key: string) => {
          const idx = labels.indexOf(key);
          return idx !== -1 ? stats[idx] : "0";
      };

      const isPitching = activeCategory === "pitching";
      if (isPitching) {
          statsSummaryMap = {
              "ERA": { value: findStat("ERA"), display: "ERA", rank: "" },
              "WHIP": { value: findStat("WHIP"), display: "WHIP", rank: "" },
              "SO": { value: findStat("SO"), display: "K", rank: "" },
              "IP": { value: findStat("IP"), display: "IP", rank: "" }
          };
      } else {
          statsSummaryMap = {
              "HR": { value: findStat("HR"), display: "HR", rank: "" },
              "RBI": { value: findStat("RBI"), display: "RBI", rank: "" },
              "AVG": { value: findStat("AVG"), display: "AVG", rank: "" },
              "OPS": { value: findStat("OPS"), display: "OPS", rank: "" }
          };
      }
  }

  const statKeys = Object.keys(statsSummaryMap);
  
  // If stats are somehow still empty, provide sensible defaults based on their position/category
  const isPitcher = bio.position_abbreviation === "SP" || bio.position_abbreviation === "RP";
  const defaults = isPitcher && activeCategory !== "batting" 
    ? [{display: "ERA"}, {display: "WHIP"}, {display: "K"}, {display: "IP"}] 
    : [{display: "HR"}, {display: "RBI"}, {display: "AVG"}, {display: "OPS"}];

  const card1 = statKeys[0] ? statsSummaryMap[statKeys[0]] : { value: "0", display: defaults[0].display, rank: "" };
  const card2 = statKeys[1] ? statsSummaryMap[statKeys[1]] : { value: "0", display: defaults[1].display, rank: "" };
  const card3 = statKeys[2] ? statsSummaryMap[statKeys[2]] : { value: "0", display: defaults[2].display, rank: "" };
  const card4 = statKeys[3] ? statsSummaryMap[statKeys[3]] : { value: "0", display: defaults[3].display, rank: "" };

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
              <SafeImage 
                src={bio.headshot} 
                alt={bio.first_name} 
                className="w-full h-full object-cover object-top"
                referrerPolicy="no-referrer"
                fallbackSrc="https://a.espncdn.com/i/headshots/nophoto.png"
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

      {/* Tabs & Content Section */}
      <section className="max-w-7xl mx-auto px-8 pt-12 pb-4">
        <div className="flex items-end justify-between border-b-2 border-slate-200 mb-8 pb-4">
          <div className="flex gap-8">
            <button 
              onClick={() => setActiveTab("Stats")}
              className={`font-headline font-black text-3xl md:text-4xl tracking-tighter transition-all ${activeTab === "Stats" ? "opacity-100" : "opacity-30 hover:opacity-60"}`}
              style={{ color: `#${bio.team_color}` }}
            >
              STATS
            </button>
            <button 
              onClick={() => setActiveTab("GameLog")}
              className={`font-headline font-black text-3xl md:text-4xl tracking-tighter transition-all ${activeTab === "GameLog" ? "opacity-100" : "opacity-30 hover:opacity-60"}`}
              style={{ color: `#${bio.team_color}` }}
            >
              GAMELOG
            </button>
            {awards.length > 0 && (
              <button 
                onClick={() => setActiveTab("Awards")}
                className={`font-headline font-black text-3xl md:text-4xl tracking-tighter transition-all ${activeTab === "Awards" ? "opacity-100" : "opacity-30 hover:opacity-60"}`}
                style={{ color: `#${bio.team_color}` }}
              >
                AWARDS
              </button>
            )}
          </div>
          
          {/* Only show category toggle if looking at Stats */}
          {activeTab === "Stats" && (
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
          )}
        </div>

        {/* Tab Content: STATS */}
        {activeTab === "Stats" && (
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
                        {row.teamsObj && row.teamsObj.length > 0 ? (
                            <div className="flex items-center gap-1">
                                {row.teamsObj.map((t: any, i: number) => (
                                    <React.Fragment key={t.id}>
                                        <Link to={`/teams/${t.id}`} className="flex items-center gap-1.5 hover:bg-slate-100 px-1 py-1 rounded transition-colors group">
                                            <SafeImage 
                                              src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${t.abbrev.toLowerCase()}.png`} 
                                              className="w-5 h-5 object-contain group-hover:scale-110 transition-transform" 
                                              alt={t.abbrev} 
                                              hideOnError
                                            />
                                            <span className="font-bold group-hover:text-primary transition-colors" style={{ color: `#${bio.team_color}` }}>{t.abbrev}</span>
                                        </Link>
                                        {i < row.teamsObj.length - 1 && <span className="text-slate-300 px-0.5">/</span>}
                                    </React.Fragment>
                                ))}
                            </div>
                        ) : (
                            row.team
                        )}
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
            
            {splitsData?.labels && splitsData.labels.length > 0 && splitsData?.displayNames && splitsData?.descriptions && (
              <div className="bg-slate-50 border-t border-slate-200 p-6">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Stats Legend</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {splitsData.labels.map((label: string, i: number) => {
                    const displayName = splitsData.displayNames?.[i];
                    const description = splitsData.descriptions?.[i];
                    if (!displayName) return null;
                    return (
                      <div key={i} className="flex flex-col">
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold text-sm text-slate-700">{label}</span>
                          <span className="text-xs font-medium text-slate-500">{displayName}</span>
                        </div>
                        {description && description !== displayName && (
                          <span className="text-[10px] text-slate-400 leading-snug mt-0.5">{description}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Tab Content: AWARDS */}
        {activeTab === "Awards" && awards.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {awards.map((award: any, i: number) => (
              <div key={i} className="bg-white p-6 border border-slate-200 rounded-xl flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="p-3 rounded-lg flex items-center justify-center" style={{ backgroundColor: `#${bio.team_color}10`, color: `#${bio.team_color}` }}>
                  <span className="text-xl font-black">{award.displayCount}</span>
                </div>
                <div>
                  <p className="font-bold leading-tight" style={{ color: `#${bio.team_color}` }}>{award.name}</p>
                  <p className="text-xs text-slate-500 font-medium mt-1 leading-snug">
                    {award.seasons?.join(", ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Content: GAMELOG */}
        {activeTab === "GameLog" && (
          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h4 className="font-headline font-black text-xl tracking-tighter uppercase" style={{ color: `#${bio.team_color}` }}>Game Log</h4>
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2 mr-2">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Category</label>
                     <select 
                        value={activeCategory || "batting"} 
                        onChange={(e) => setActiveCategory(e.target.value)}
                        className="border border-slate-300 rounded px-4 py-2 font-bold text-sm text-primary focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer bg-white capitalize"
                     >
                        <option value="batting">Batting</option>
                        <option value="pitching">Pitching</option>
                     </select>
                 </div>
                 <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Season</label>
                 <select 
                    value={activeLogYear} 
                    onChange={(e) => setActiveLogYear(Number(e.target.value))}
                    className="border border-slate-300 rounded px-4 py-2 font-bold text-sm text-primary focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer bg-white"
                 >
                    {/* Render a dropdown for the last 10 years */}
                    {[...Array(10)].map((_, i) => {
                        const year = new Date().getFullYear() - i;
                        return <option key={year} value={year}>{year}</option>;
                    })}
                 </select>
              </div>
            </div>
            
            <div className="overflow-x-auto relative">
              {loadingLogs && (
                  <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
                      <span className="font-bold text-slate-500 animate-pulse uppercase tracking-widest text-sm">Loading Game Log...</span>
                  </div>
              )}
              
              
              {/* Batting Log Table Helper */}
              {activeCategory !== "pitching" && gameLogs.batting && (
                <>
                  {(() => {
                      const post = gameLogs.batting.filter((log: any) => log.season_type === 3);
                      const reg = gameLogs.batting.filter((log: any) => log.season_type === 2);
                      
                      const renderTable = (logs: any[], title: string) => {
                          if (logs.length === 0) return null;
                          return (
                              <div className="mb-8">
                                <h5 className="px-6 py-3 font-headline font-black text-sm uppercase tracking-widest bg-slate-100 text-slate-500">{title}</h5>
                                <table className="w-full text-left border-collapse tabular-nums">
                                  <thead>
                                    <tr className="text-white font-bold text-[10px] uppercase tracking-widest" style={{ backgroundColor: `#${bio.team_color}` }}>
                                      <th className="px-6 py-4 whitespace-nowrap">Date</th>
                                      <th className="px-4 py-4 whitespace-nowrap">Opp</th>
                                      <th className="px-4 py-4 whitespace-nowrap">Result</th>
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
                                    {logs.map((log: any, idx: number) => {
                                      const isHome = log.home_away === "home";
                                      const oppPrefix = isHome ? "vs " : "@ ";
                                      const resultPrefix = log.is_win ? "W" : "L";
                                      const scoreStr = log.team_score !== null && log.opponent_score !== null ? `${log.team_score}-${log.opponent_score}` : "";
                                      const dateObj = new Date(log.date + (log.date.endsWith("Z") ? "" : "Z"));
                                      const formattedDate = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                                      
                                      return (
                                        <tr key={`bat-${log.event_id}-${idx}`} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                                          <td className="px-6 py-3 font-bold" style={{ color: `#${bio.team_color}` }}>{formattedDate}</td>
                                          <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <span>{oppPrefix}</span>
                                                {log.opponent_id && log.opponent_abbrev ? (
                                                    <Link to={`/teams/${log.opponent_id}`} className="flex items-center gap-2 hover:bg-slate-100 px-2 py-1 -ml-2 rounded transition-colors group">
                                                        <SafeImage 
                                                          src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${log.opponent_abbrev.toLowerCase()}.png`} 
                                                          className="w-5 h-5 object-contain group-hover:scale-110 transition-transform" 
                                                          alt={log.opponent_abbrev} 
                                                          hideOnError
                                                        />
                                                        <span className="font-bold group-hover:text-primary transition-colors" style={{ color: `#${bio.team_color}` }}>{log.opponent_abbrev}</span>
                                                    </Link>
                                                ) : (
                                                    <span>{log.opponent_abbrev || "TBD"}</span>
                                                )}
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 text-slate-500 font-medium whitespace-nowrap">
                                             <span className={`mr-2 font-black ${log.is_win ? "text-emerald-600" : "text-rose-600"}`}>{resultPrefix}</span>
                                             {scoreStr}
                                          </td>
                                          <td className="px-4 py-3 text-right font-medium">{log.ab}</td>
                                          <td className="px-4 py-3 text-right font-medium">{log.r}</td>
                                          <td className="px-4 py-3 text-right font-bold text-slate-700">{log.h}</td>
                                          <td className="px-4 py-3 text-right font-black text-slate-800">{log.hr}</td>
                                          <td className="px-4 py-3 text-right font-medium">{log.rbi}</td>
                                          <td className="px-4 py-3 text-right font-medium">{log.bb}</td>
                                          <td className="px-4 py-3 text-right font-medium">{log.k}</td>
                                          
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                          );
                      };

                      return (
                          <>
                              {renderTable(post, "Postseason")}
                              {renderTable(reg, "Regular Season")}
                          </>
                      );
                  })()}
                </>
              )}


              {/* Pitching Log Table Helper */}
              {activeCategory === "pitching" && gameLogs.pitching && (
                <>
                  {(() => {
                      const post = gameLogs.pitching.filter((log: any) => log.season_type === 3);
                      const reg = gameLogs.pitching.filter((log: any) => log.season_type === 2);
                      
                      const renderTable = (logs: any[], title: string) => {
                          if (logs.length === 0) return null;
                          return (
                              <div className="mb-8">
                                <h5 className="px-6 py-3 font-headline font-black text-sm uppercase tracking-widest bg-slate-100 text-slate-500">{title}</h5>
                                <table className="w-full text-left border-collapse tabular-nums">
                                  <thead>
                                    <tr className="text-white font-bold text-[10px] uppercase tracking-widest" style={{ backgroundColor: `#${bio.team_color}` }}>
                                      <th className="px-6 py-4 whitespace-nowrap">Date</th>
                                      <th className="px-4 py-4 whitespace-nowrap">Opp</th>
                                      <th className="px-4 py-4 whitespace-nowrap">Result</th>
                                      <th className="px-4 py-4 text-right">IP</th>
                                      <th className="px-4 py-4 text-right">H</th>
                                      <th className="px-4 py-4 text-right">R</th>
                                      <th className="px-4 py-4 text-right">ER</th>
                                      <th className="px-4 py-4 text-right">HR</th>
                                      <th className="px-4 py-4 text-right">BB</th>
                                      <th className="px-4 py-4 text-right">K</th>
                                      <th className="px-4 py-4 text-right">Pitches</th>
                                    </tr>
                                  </thead>
                                  <tbody className="text-slate-800 text-sm">
                                    {logs.map((log: any, idx: number) => {
                                      const isHome = log.home_away === "home";
                                      const oppPrefix = isHome ? "vs " : "@ ";
                                      const resultPrefix = log.is_win ? "W" : "L";
                                      const scoreStr = log.team_score !== null && log.opponent_score !== null ? `${log.team_score}-${log.opponent_score}` : "";
                                      const dateObj = new Date(log.date + (log.date.endsWith("Z") ? "" : "Z"));
                                      const formattedDate = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                                      
                                      return (
                                        <tr key={`pitch-${log.event_id}-${idx}`} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                                          <td className="px-6 py-3 font-bold" style={{ color: `#${bio.team_color}` }}>{formattedDate}</td>
                                          <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <span>{oppPrefix}</span>
                                                {log.opponent_id && log.opponent_abbrev ? (
                                                    <Link to={`/teams/${log.opponent_id}`} className="flex items-center gap-2 hover:bg-slate-100 px-2 py-1 -ml-2 rounded transition-colors group">
                                                        <SafeImage 
                                                          src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${log.opponent_abbrev.toLowerCase()}.png`} 
                                                          className="w-5 h-5 object-contain group-hover:scale-110 transition-transform" 
                                                          alt={log.opponent_abbrev} 
                                                          hideOnError
                                                        />
                                                        <span className="font-bold group-hover:text-primary transition-colors" style={{ color: `#${bio.team_color}` }}>{log.opponent_abbrev}</span>
                                                    </Link>
                                                ) : (
                                                    <span>{log.opponent_abbrev || "TBD"}</span>
                                                )}
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 text-slate-500 font-medium whitespace-nowrap">
                                             <span className={`mr-2 font-black ${log.is_win ? "text-emerald-600" : "text-rose-600"}`}>{resultPrefix}</span>
                                             {scoreStr}
                                          </td>
                                          <td className="px-4 py-3 text-right font-medium">{log.ip}</td>
                                          <td className="px-4 py-3 text-right font-medium">{log.h}</td>
                                          <td className="px-4 py-3 text-right font-medium">{log.r}</td>
                                          <td className="px-4 py-3 text-right font-bold text-slate-700">{log.er}</td>
                                          <td className="px-4 py-3 text-right font-medium text-rose-500">{log.hr}</td>
                                          <td className="px-4 py-3 text-right font-medium">{log.bb}</td>
                                          <td className="px-4 py-3 text-right font-black" style={{ color: `#${bio.team_color}` }}>{log.k}</td>
                                          <td className="px-4 py-3 text-right text-slate-400">{log.pitches}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                          );
                      };

                      return (
                          <>
                              {renderTable(post, "Postseason")}
                              {renderTable(reg, "Regular Season")}
                          </>
                      );
                  })()}
                </>
              )}
              
              {!loadingLogs && 
                ((activeCategory !== "pitching" && (!gameLogs.batting || gameLogs.batting.length === 0)) || 
                 (activeCategory === "pitching" && (!gameLogs.pitching || gameLogs.pitching.length === 0))) && (
                <div className="p-12 text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">event_busy</span>
                    <p className="text-slate-500 font-bold">No game logs found for this season.</p>
                </div>
              )}

            </div>
          </div>
        )}

              </section>
    </>
  );
};
