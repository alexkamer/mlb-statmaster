import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Calendar as CalendarIcon, TrendingUp, BarChart2 } from 'lucide-react';
import { LiveTicker } from './LiveTicker';

const LeagueLeaders = () => {
  const [leaders, setLeaders] = useState<any[]>([]);

  useEffect(() => {
    const fetchLeaders = async () => {
      try {
        const response = await fetch('https://site.web.api.espn.com/apis/site/v3/sports/baseball/mlb/teamleaders');
        const data = await response.json();
        
        if (data && data.teamLeaders && data.teamLeaders.categories) {
          // Grab specific categories of interest: AVG, HR, ERA, Wins, Strikeouts
          const desiredStats = ['avg', 'homeRuns', 'ERA', 'wins', 'strikeouts'];
          const filtered = data.teamLeaders.categories.filter((cat: any) => desiredStats.includes(cat.name));
          setLeaders(filtered);
        }      } catch (err) {
        console.error("Error fetching league leaders:", err);
      }
    };
    fetchLeaders();
  }, []);

  return (
    <div className="bg-primary p-6 rounded-xl shadow-lg mt-8">
      <h3 className="font-headline text-lg font-black text-white uppercase mb-6 flex justify-between items-center">
        League Leaders
        <BarChart2 className="w-5 h-5 text-secondary" />
      </h3>
      
      <div className="space-y-8 overflow-y-auto hide-scrollbar pr-2 max-h-[500px]">
        {leaders.map(cat => (
          <div key={cat.name}>
            <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
              <span className="text-[10px] font-black text-[#7796d1] uppercase tracking-widest">{cat.displayName}</span>
              <span className="text-[10px] font-black text-secondary uppercase tracking-widest">AL/NL</span>
            </div>
            <div className="space-y-3">
              {cat.leaders.slice(0, 3).map((leader: any, index: number) => {
                const team = leader.team;
                const logo = `https://a.espncdn.com/i/teamlogos/mlb/500/${team.abbreviation?.toLowerCase() || 'mlb'}.png`;

                const getContrastColor = (teamData: any) => {
                  if (!teamData) return '#ffffff';
                  const abbr = teamData.abbreviation;
                  const safeColors: Record<string, string> = {
                    'ATL': '#ce1141', 
                    'HOU': '#eb6e1f', 
                    'TEX': '#c0111f', 
                    'TB': '#8fbce6', 
                    'MIN': '#e20e32', 
                    'CHC': '#cc3433', 
                    'MIA': '#c4ced4', 
                    'SD': '#ffc425',
                    'CLE': '#e31937', 
                    'DET': '#ff4713', 
                    'KC': '#74b4fa',
                    'CWS': '#c4ced4', 
                    'BOS': '#bd3039', 
                    'COL': '#7ab2dd', 
                    'LAA': '#c4ced4',
                    'NYM': '#ff5910', 
                    'MIL': '#ffc72c'
                  };
                  return safeColors[abbr] || '#ffffff';
                };                const teamColor = getContrastColor(team);
                return (
                  <div key={team.id} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${index === 0 ? 'font-bold text-white' : 'font-medium text-[#7796d1]'} uppercase tracking-tight w-3`}>{index + 1}.</span>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center p-0.5" style={{ backgroundColor: teamColor }}>
                        <img src={logo} alt={team.abbreviation} className="w-full h-full object-contain" />
                      </div>
                      <span className={`text-xs ${index === 0 ? 'font-bold text-white' : 'font-medium text-[#7796d1]'} uppercase tracking-tight`}>{team.shortDisplayName}</span>
                    </div>
                    <span className={`font-headline font-black ${index === 0 ? 'text-white' : 'text-[#7796d1]'} text-sm`}>{leader.displayValue}</span>
                  </div>
                );
              })}
            </div>          </div>
        ))}
      </div>
      <button className="w-full mt-8 py-3 bg-[#002d62] rounded text-xs font-black uppercase tracking-widest text-white border border-[#7796d1]/20 hover:bg-[#003d85] transition-colors">
        Complete Statistical Index
      </button>
    </div>
  );
};

const LatestNews = () => {
  const [news, setNews] = useState<any[]>([]);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?limit=50');
        const data = await response.json();
        if (data && data.articles) {
          // Filter strictly for HeadlineNews to avoid fantasy/betting "Story" types
          const filtered = data.articles.filter((a: any) => a.type === 'HeadlineNews');
          
          // Sort by published date descending (newest first)
          const sorted = filtered.sort((a: any, b: any) => {
             return new Date(b.published).getTime() - new Date(a.published).getTime();
          });
          setNews(sorted);
        }
      } catch (err) {
        console.error("Error fetching news:", err);
      }
    };
    fetchNews();
  }, []);

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
      <h3 className="text-sm font-headline font-black uppercase tracking-widest text-primary mb-6 flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
        Latest News
        <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
      </h3>
      <div className="space-y-4 overflow-y-auto hide-scrollbar pb-4 pr-2 max-h-96">
        {news.map(article => {
          // Find the first category that is an athlete
          const athleteCategory = article.categories?.find((c: any) => c.type === 'athlete');
          const athleteId = athleteCategory?.athleteId;
          const playerUrl = athleteId ? `https://a.espncdn.com/i/headshots/mlb/players/full/${athleteId}.png` : null;

          // Find the first category that is a team
          const teamCategory = article.categories?.find((c: any) => c.type === 'team');
          const teamId = teamCategory?.teamId;
          const logoUrl = teamId ? `https://a.espncdn.com/i/teamlogos/mlb/500/${teamId}.png` : null;

          return (
            <a key={article.id} href={article.links?.web?.href || '#'} target="_blank" rel="noreferrer" className="flex items-start gap-3 pb-4 border-b border-slate-100 last:border-b-0 group">
              {(playerUrl || logoUrl) && (
                <div className="relative w-12 h-12 shrink-0">
                  {logoUrl && (
                    <div className="absolute inset-0 rounded-full border border-slate-200 overflow-hidden flex items-center justify-center bg-white">
                      <img src={logoUrl} alt="Team" className="w-10 h-10 object-contain" />
                    </div>
                  )}
                  {playerUrl && (
                    <img 
                      src={playerUrl} 
                      alt="Player" 
                      className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-11 h-11 object-contain drop-shadow-sm z-10 ${!logoUrl ? 'top-1/2 -translate-y-1/2' : ''}`} 
                    />
                  )}
                </div>
              )}
              <p className="text-xs font-bold text-primary group-hover:text-secondary transition-colors leading-relaxed line-clamp-3 mt-1">
                {article.headline}
              </p>
            </a>
          );
        })}
      </div>
    </div>
  );
};

const DailyScoreboardShell = () => {
  return (
    <section className="space-y-6 mt-12">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h2 className="font-headline text-3xl font-black text-primary uppercase tracking-tighter">Daily Scoreboard</h2>
          <p className="text-sm text-slate-500 uppercase tracking-widest">Thursday, October 24</p>
        </div>
        <button className="bg-slate-200 px-6 py-2 rounded text-primary text-xs font-black uppercase tracking-widest hover:bg-slate-300 transition-colors">View All Scores</button>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        
        {/* Placeholder Card 1: Live */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200 relative">
          <div className="grid grid-cols-12 min-h-[140px]">            {/* Section 1: Teams & Score */}
            <div className="col-span-5 p-6 border-r border-slate-100 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-secondary text-white rounded-sm">Live • Bot 8</span>
                <div className="flex gap-4">
                  <span className="w-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">R</span>
                  <span className="w-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">H</span>
                  <span className="w-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">E</span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#003087] flex items-center justify-center text-white text-[10px] font-bold">NYY</div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">New York</span>
                      <span className="font-headline font-black text-primary text-lg uppercase tracking-tight leading-tight">Yankees</span>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <span className="w-6 text-center font-headline font-black text-primary text-xl tracking-tighter">4</span>
                    <span className="w-6 text-center font-headline font-black text-slate-500 text-xl tracking-tighter">8</span>
                    <span className="w-6 text-center font-headline font-black text-slate-500 text-xl tracking-tighter">0</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#bd3039] flex items-center justify-center text-white text-[10px] font-bold">BOS</div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Boston</span>
                      <span className="font-headline font-black text-primary text-lg uppercase tracking-tight leading-tight">Red Sox</span>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <span className="w-6 text-center font-headline font-black text-primary text-xl tracking-tighter">2</span>
                    <span className="w-6 text-center font-headline font-black text-slate-500 text-xl tracking-tighter">5</span>
                    <span className="w-6 text-center font-headline font-black text-slate-500 text-xl tracking-tighter">1</span>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fox Sports 1</span>
              </div>
              </div>

              {/* Section 2: Live Scenario */}              <div className="col-span-3 p-6 border-r border-slate-100 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  {/* Bases Graphic */}
                  <div className="relative w-12 h-12 mt-1">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-[#0066cc] rotate-45" /> {/* 2B */}
                    <div className="absolute top-[12px] left-[6px] w-3.5 h-3.5 bg-slate-300 rotate-45" /> {/* 3B */}
                    <div className="absolute top-[12px] right-[6px] w-3.5 h-3.5 bg-slate-300 rotate-45" /> {/* 1B */}
                  </div>

                  {/* B-S-O Counters */}
                  <div className="flex flex-col gap-1.5 w-[70px]">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 w-2 text-right">B</span>
                      <div className="flex gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#1e9b42]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[#1e9b42]" />
                        <div className="w-2.5 h-2.5 rounded-full border border-slate-300 bg-white" />
                        <div className="w-2.5 h-2.5 rounded-full border border-slate-300 bg-white" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 w-2 text-right">S</span>
                      <div className="flex gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#d5001c]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[#d5001c]" />
                        <div className="w-2.5 h-2.5 rounded-full border border-slate-300 bg-white" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 w-2 text-right">O</span>
                      <div className="flex gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#d5001c]" />
                        <div className="w-2.5 h-2.5 rounded-full border border-slate-300 bg-white" />
                        <div className="w-2.5 h-2.5 rounded-full border border-slate-300 bg-white" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-1">
                  <p className="text-[11px] text-slate-600 font-medium leading-tight">
                    <span className="font-bold uppercase tracking-widest text-slate-400 text-[9px] mr-1">Last Play:</span>
                    Pitch 5 : Strike 2 Foul
                  </p>
                  <p className="text-[11px] text-[#0066cc] font-bold cursor-pointer hover:underline">Play-by-Play</p>
                </div>
              </div>            {/* Section 3: Placeholder */}
            <div className="col-span-4 p-6 flex items-center justify-center bg-slate-50/50">              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Section 3 Placeholder</span>
            </div>
          </div>
          <div className="bg-slate-50 px-6 py-3 flex justify-between items-center border-t border-slate-100">
            <div className="flex gap-4">
              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-widest"><span className="font-black text-primary">P:</span> Cole (98)</div>
              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-widest"><span className="font-black text-primary">AB:</span> Devers</div>
            </div>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
            </div>
          </div>
        </div>
        {/* Placeholder Card 2: Final */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200 relative">
          <div className="grid grid-cols-12 min-h-[140px]">            {/* Section 1: Teams & Score */}
            <div className="col-span-5 p-6 border-r border-slate-100 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-slate-800 text-white rounded-sm">Final</span>
                <div className="flex items-center gap-6">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest underline cursor-pointer hover:text-primary">Recap</span>
                  <div className="flex gap-4">
                    <span className="w-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">R</span>
                    <span className="w-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">H</span>
                    <span className="w-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">E</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center opacity-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-400 flex items-center justify-center text-white text-[10px] font-bold">LAD</div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Los Angeles</span>
                      <span className="font-headline font-black text-primary text-lg uppercase tracking-tight leading-tight">Dodgers</span>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <span className="w-6 text-center font-headline font-black text-primary text-xl tracking-tighter">1</span>
                    <span className="w-6 text-center font-headline font-black text-slate-500 text-xl tracking-tighter">4</span>
                    <span className="w-6 text-center font-headline font-black text-slate-500 text-xl tracking-tighter">1</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#ff5910] flex items-center justify-center text-white text-[10px] font-bold">NYM</div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">New York</span>
                      <span className="font-headline font-black text-primary text-lg uppercase tracking-tight leading-tight">Mets</span>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <span className="w-6 text-center font-headline font-black text-primary text-xl tracking-tighter">6</span>
                    <span className="w-6 text-center font-headline font-black text-slate-500 text-xl tracking-tighter">11</span>
                    <span className="w-6 text-center font-headline font-black text-slate-500 text-xl tracking-tighter">0</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Placeholder */}
            <div className="col-span-3 p-6 border-r border-slate-100 flex items-center justify-center bg-slate-50/50">              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Section 2 Placeholder</span>
            </div>

            {/* Section 3: Placeholder */}
            <div className="col-span-4 p-6 flex items-center justify-center bg-slate-50/50">              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Section 3 Placeholder</span>
            </div>
          </div>
          <div className="bg-slate-50 px-6 py-3 flex justify-between items-center border-t border-slate-100">
            <div className="text-[10px] font-medium text-slate-500 uppercase tracking-widest"><span className="font-black text-primary">W:</span> Senga (2-1)</div>
            <div className="text-[10px] font-medium text-slate-500 uppercase tracking-widest"><span className="font-black text-primary">L:</span> Yamamoto (4-2)</div>
          </div>
        </div>

        {/* Placeholder Card 3: Upcoming */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200 hidden md:block relative">
          <div className="grid grid-cols-12 min-h-[140px]">
            {/* Section 1: Teams & Score */}
            <div className="col-span-5 p-6 border-r border-slate-100 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-[#002d62] text-white rounded-sm">Upcoming • 7:10 PM</span>
              </div>
              <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#003278] flex items-center justify-center text-white text-[10px] font-bold">PHI</div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Philadelphia</span>
                    <span className="font-headline font-black text-primary text-lg uppercase tracking-tight leading-tight">Phillies</span>
                  </div>
                </div>
                <span className="font-headline font-black text-slate-500 text-sm tracking-widest pr-2">92-62</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#ce1141] flex items-center justify-center text-white text-[10px] font-bold">ATL</div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Atlanta</span>
                    <span className="font-headline font-black text-primary text-lg uppercase tracking-tight leading-tight">Braves</span>
                  </div>
                </div>
                <span className="font-headline font-black text-slate-500 text-sm tracking-widest pr-2">88-66</span>
                </div>
                </div>
                <div className="mt-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Apple TV+</span>
                </div>
                </div>

                {/* Section 2: Placeholder */}
                <div className="col-span-3 p-6 border-r border-slate-100 flex items-center justify-center bg-slate-50/50">              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Section 2 Placeholder</span>
            </div>

            {/* Section 3: Placeholder */}
            <div className="col-span-4 p-6 flex items-center justify-center bg-slate-50/50">              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Section 3 Placeholder</span>
            </div>
          </div>
          <div className="bg-slate-50 px-6 py-3 flex justify-between items-center border-t border-slate-100">
            <div className="text-[10px] font-medium text-slate-500 uppercase tracking-widest"><span className="font-black text-primary">Probables:</span> Wheeler vs Sale</div>
          </div>
        </div>

      </div>
    </section>
  );
};

export const HomePage = () => {
  return (
    <div className="w-full">
      <div className="p-8 space-y-12 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-12">
            {/* Hero Section: Bento Grid */}

            <DailyScoreboardShell />
            
            {/* Leaders Sidebar & Data Section */}
          </div>
          <div className="w-full lg:w-72 shrink-0 flex flex-col gap-8">
             <LatestNews />
             <LeagueLeaders />
          </div>
        </div>
      </div>
    </div>
  );
};
