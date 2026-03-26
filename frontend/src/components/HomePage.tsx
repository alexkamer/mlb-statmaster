import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Calendar as CalendarIcon, TrendingUp } from 'lucide-react';

const LiveTicker = () => {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const fetchScores = async () => {
      try {
        // Construct YYYYMMDD for the current date
        const today = new Date();
        const dateString = today.toISOString().split('T')[0].replace(/-/g, '');
        
        const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateString}`);
        const data = await response.json();
        if (data && data.events) {
          setEvents(data.events);
        }
      } catch (err) {
        console.error("Error fetching live scores:", err);
      }
    };

    fetchScores();
    const intervalId = setInterval(fetchScores, 15000); // 15 seconds
    return () => clearInterval(intervalId);
  }, []);

  if (events.length === 0) return null;

  return (
    <div className="w-full bg-[#002d62] h-20 flex items-center overflow-x-auto hide-scrollbar border-b border-primary/20">
      <div className="flex flex-nowrap items-center divide-x divide-white/10 px-4 h-full py-2">
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

          // Fallback short details
          let statusText = status.shortDetail; // e.g., "3/26 - 4:15 PM EDT"
          let badgeColor = 'text-slate-400';
          let badgeText = '';

          if (status.name === 'STATUS_POSTPONED' || status.detail.toLowerCase().includes('postponed')) {
            badgeColor = 'text-slate-400';
            badgeText = 'Postponed';
          } else if (isLive) {
            badgeColor = 'text-[#b80a2e]'; // secondary color
            badgeText = 'Live';
            statusText = event.status.detail; // e.g., "Bot 7th"
          } else if (isFinal) {
            badgeColor = 'text-slate-400';
            badgeText = 'Final';
          } else if (isScheduled) {
            // Convert UTC date to local time string e.g. "4:15 PM"
            const dateObj = new Date(event.date);
            statusText = dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
            badgeText = statusText;
          }

          let awayScoreOrRecord = awayTeam?.score;
          let homeScoreOrRecord = homeTeam?.score;

          if (isScheduled) {
            const awayRecord = awayTeam?.records?.find((r: any) => r.type === 'total')?.summary || '0-0';
            const homeRecord = homeTeam?.records?.find((r: any) => r.type === 'total')?.summary || '0-0';
            awayScoreOrRecord = awayRecord;
            homeScoreOrRecord = homeRecord;
          }

          return (
            <div key={event.id} className="flex flex-col justify-center gap-1 px-6 min-w-max hover:bg-white/5 transition-colors cursor-pointer h-full border-r border-white/10 last:border-r-0">
              <div className="flex justify-between items-center mb-1 gap-4">
                <span className={`text-[10px] font-bold ${badgeColor} uppercase tracking-tighter`}>{badgeText}</span>
                {isLive && <span className="text-[10px] text-[#7796d1] font-medium">{statusText}</span>}
              </div>
              <div className="flex flex-col text-[12px] leading-relaxed font-bold gap-1 w-full">
                <div className="flex items-center justify-between gap-4 text-white min-w-[90px]">
                  <div className="flex items-center gap-2">
                    <img src={awayLogo} className="w-4 h-4 object-contain" alt={awayTeam?.team?.abbreviation} />
                    <span>{awayTeam?.team?.abbreviation}</span>
                  </div>
                  <span className={isScheduled ? 'text-[10px] text-slate-500 font-medium tracking-widest' : ''}>{awayScoreOrRecord}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-white min-w-[90px]">
                  <div className="flex items-center gap-2">
                    <img src={homeLogo} className="w-4 h-4 object-contain" alt={homeTeam?.team?.abbreviation} />
                    <span>{homeTeam?.team?.abbreviation}</span> 
                  </div>
                  <span className={isScheduled ? 'text-[10px] text-slate-500 font-medium tracking-widest' : ''}>{homeScoreOrRecord}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
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
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 sticky top-24 max-h-[calc(100vh-8rem)] flex flex-col">
      <h3 className="text-sm font-headline font-black uppercase tracking-widest text-primary mb-6 flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
        Latest News
        <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
      </h3>
      <div className="space-y-4 overflow-y-auto hide-scrollbar flex-1 pb-4 pr-2">
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
    <div className="w-full">
      {/* Live Ticker Area */}
      <LiveTicker />
      
      <div className="p-8 space-y-12 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-12">
            {/* Hero Section: Bento Grid */}

            {/* Detailed Scoreboard Grid */}
            
            {/* Leaders Sidebar & Data Section */}
          </div>
          <div className="w-full lg:w-80 shrink-0">
             <LatestNews />
          </div>
        </div>
      </div>
    </div>
  );
};
