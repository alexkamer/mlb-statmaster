import React from 'react';
import { Newspaper, ChevronRight } from 'lucide-react';

interface TeamNewsFeedProps {
  teamName: string;
}

export const TeamNewsFeed: React.FC<TeamNewsFeedProps> = ({ teamName }) => {
  // Mock News Data (since we don't have a reliable free ESPN news endpoint hooked up yet)
  const mockNews = [
    {
      id: 1,
      title: `${teamName} announce minor league call-ups`,
      source: 'MLB.com',
      date: '2h ago',
      category: 'Roster'
    },
    {
      id: 2,
      title: `Injury Update: Star player begins rehab assignment`,
      source: 'Local Beat',
      date: '5h ago',
      category: 'Injuries'
    },
    {
      id: 3,
      title: `Recap: Late inning heroics seal the victory for the ${teamName}`,
      source: 'ESPN',
      date: '1d ago',
      category: 'Game Recap'
    }
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-3">
        <Newspaper className="w-5 h-5 text-primary" />
        <h3 className="font-headline font-black text-primary tracking-tight uppercase">Latest News</h3>
      </div>
      <div className="flex-1 p-4 flex flex-col gap-3">
        {mockNews.map((news) => (
          <a key={news.id} href="#" className="group block p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <span className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1 block">
                  {news.category}
                </span>
                <h4 className="text-sm font-bold text-primary group-hover:text-secondary transition-colors line-clamp-2 leading-tight">
                  {news.title}
                </h4>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-medium">
                  <span>{news.source}</span>
                  <span>•</span>
                  <span>{news.date}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors shrink-0 mt-2" />
            </div>
          </a>
        ))}
      </div>
      <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 mt-auto">
        <button className="text-xs font-bold text-primary hover:text-secondary uppercase tracking-widest w-full text-center transition-colors">
          View All News
        </button>
      </div>
    </div>
  );
};
