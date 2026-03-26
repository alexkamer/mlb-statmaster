import React, { useMemo } from 'react';

export const LiveRoster = ({ roster, onPlayerClick }: { roster: any[], onPlayerClick: (p: any) => void }) => {
  if (!roster || !Array.isArray(roster) || roster.length === 0) return null;

  // Group the roster back into the categories (Pitchers, Catchers, etc.)
  const groupedRoster = useMemo(() => {
    const groups: Record<string, any[]> = {};
    roster.forEach(player => {
      const group = player.roster_group || 'Other';
      if (!groups[group]) groups[group] = [];
      groups[group].push(player);
    });
    return groups;
  }, [roster]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-primary px-6 py-4 flex justify-between items-center">
        <h3 className="text-white font-headline font-bold uppercase tracking-wider text-sm">Live 40-Man Roster</h3>
      </div>
      
      <div className="p-0">
        {Object.entries(groupedRoster).map(([groupName, players]) => (
          <div key={groupName} className="border-b border-slate-100 last:border-0">
            <div className="bg-slate-50 px-6 py-2 border-y border-slate-100 first:border-t-0">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">{groupName}</h4>
            </div>
            <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
              {players.map((player) => (
                <div 
                  key={player.athlete_id} 
                  onClick={() => onPlayerClick(player)}
                  className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border border-slate-300 shadow-sm shrink-0">
                      {player.headshot ? (
                        <img src={player.headshot} alt={player.full_name} className="w-full h-full object-cover object-top" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-xs">{player.position}</div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-primary group-hover:text-secondary flex items-center gap-2">
                        {player.display_name}
                        {player.jersey && <span className="text-[10px] font-black text-slate-400">#{player.jersey}</span>}
                      </p>
                      <p className="text-[10px] font-medium text-slate-500">
                        {player.position} • B/T: {player.bats}/{player.throws} • {player.height} • {player.weight}
                      </p>
                    </div>
                  </div>
                  
                  {/* Status Indicator */}
                  <div className="text-right">
                    {player.status === 'active' ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-1 rounded bg-rose-50 text-rose-600 text-[9px] font-black uppercase tracking-widest">
                        {player.status || 'Injured'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};