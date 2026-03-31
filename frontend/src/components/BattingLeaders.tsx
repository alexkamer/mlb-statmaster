import React from 'react';
import { Link } from 'react-router-dom';

export const BattingLeaders = ({ leaders, onPlayerClick }: { leaders: any[], onPlayerClick?: (p: any) => void }) => {
  if (!leaders || leaders.length === 0) {
    return (
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-black text-primary uppercase tracking-tighter mb-4">Team Leaders</h2>
        <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
          No Leader Data Available for this Period
        </div>
      </div>
    );
  }

  const LeaderCard = ({ leader }: any) => (
    <Link 
      to={`/players/${leader.id || leader.athlete_id}`}
      className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex flex-col justify-between group hover:border-slate-300 transition-colors block h-full w-full"
    >
      <div>
        <h3 className="text-primary font-headline font-black uppercase tracking-wider text-[10px] mb-4 opacity-60">
          {leader.category}
        </h3>
        
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-slate-200 overflow-hidden border-2 border-slate-200 shadow-sm shrink-0 flex items-center justify-center text-primary font-black text-xs group-hover:scale-105 transition-transform">
            <img 
              src={leader.headshot || 'https://a.espncdn.com/i/headshots/nophoto.png'} 
              alt={leader.name} 
              className="w-full h-full object-cover object-top bg-white" 
              referrerPolicy="no-referrer"
              onError={(e) => {
                 e.currentTarget.onerror = null; 
                 e.currentTarget.src = 'https://a.espncdn.com/i/headshots/nophoto.png';
              }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-bold text-primary group-hover:text-secondary transition-colors leading-tight" title={leader.name}>{leader.name}</p>
            <p className="text-[10px] uppercase font-bold text-slate-400 mt-1">{leader.position}</p>
          </div>
        </div>
      </div>
      
      <div className="mt-5 flex items-end justify-between border-t border-slate-100 pt-3">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</span>
        <span className="text-2xl font-headline font-black text-primary group-hover:text-secondary transition-colors">{leader.value}</span>
      </div>
    </Link>
  );

  return (
    <div className="mb-8">
      <h2 className="text-3xl font-headline font-black text-primary uppercase tracking-tighter mb-4">Team Leaders</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
        {leaders.map((leader, idx) => (
          <LeaderCard key={idx} leader={leader} />
        ))}
      </div>
    </div>
  );
};