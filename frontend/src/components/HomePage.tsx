import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Calendar as CalendarIcon, TrendingUp, BarChart2, Play, Ticket } from 'lucide-react';
import { LiveTicker } from './shared/LiveTicker';
import { DailyScoreboard } from './shared/DailyScoreboard';

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
              export const HomePage = () => {
              return (
              <div className="w-full">      <div className="p-8 space-y-12 mx-auto max-w-[1600px]">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-12">
            {/* Hero Section: Bento Grid */}

            <DailyScoreboard />
            
            {/* Leaders Sidebar & Data Section */}
          </div>
          <div className="w-full lg:w-64 shrink-0 flex flex-col gap-8">
             <LatestNews />
             <LeagueLeaders />
          </div>
        </div>
      </div>
    </div>
  );
};
