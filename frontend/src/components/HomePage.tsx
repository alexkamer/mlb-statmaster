import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Calendar as CalendarIcon, TrendingUp } from 'lucide-react';
import { LiveTicker } from './LiveTicker';

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
