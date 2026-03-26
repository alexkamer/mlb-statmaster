import React from 'react';

export const BattingLeaders = ({ leaders, onPlayerClick }: { leaders: any[], onPlayerClick: (p: any) => void }) => {
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
    <div 
      onClick={() => onPlayerClick({ ...leader, full_name: leader.name })}
      className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 flex-1 flex flex-col justify-between group cursor-pointer hover:border-slate-300 transition-colors"
    >
      <div>
        <h3 className="text-primary font-headline font-black uppercase tracking-wider text-[10px] mb-4 opacity-60">
          {leader.category}
        </h3>
        
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-200 overflow-hidden border-2 border-slate-200 shadow-sm shrink-0 flex items-center justify-center text-primary font-black text-xs group-hover:scale-105 transition-transform">
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
          <div>
            <p className="text-sm font-bold text-primary group-hover:text-secondary transition-colors truncate max-w-[120px]" title={leader.name}>{leader.name}</p>
            <p className="text-[10px] uppercase font-bold text-slate-400">{leader.position}</p>
          </div>
        </div>
      </div>
      
      <div className="mt-6 flex items-end justify-between border-t border-slate-100 pt-4">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Season Total</span>
        <span className="text-3xl font-headline font-black text-primary group-hover:text-secondary transition-colors">{leader.value}</span>
      </div>
    </div>
  );

  return (
    <div className="mb-8">
      <h2 className="text-3xl font-headline font-black text-primary uppercase tracking-tighter mb-4">Team Leaders</h2>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 w-full">
        {leaders.map((leader, idx) => (
          <LeaderCard key={idx} leader={leader} />
        ))}
      </div>
    </div>
  );
};