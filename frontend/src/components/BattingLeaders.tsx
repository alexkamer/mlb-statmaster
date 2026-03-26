import React from 'react';

export const BattingLeaders = ({ roster }: { roster: any[] }) => {
  if (!roster || roster.length === 0) return null;

  // Sort by Home Runs for the "Power Threat" leader
  const hrLeaders = [...roster].sort((a, b) => (b.hr || 0) - (a.hr || 0)).slice(0, 3);
  // Sort by Batting Average (must have at least 50 AB to qualify)
  const avgLeaders = [...roster].filter(p => p.ab > 50).sort((a, b) => (b.avg || 0) - (a.avg || 0)).slice(0, 3);
  // Sort by RBI
  const rbiLeaders = [...roster].sort((a, b) => (b.rbi || 0) - (a.rbi || 0)).slice(0, 3);

  const LeaderCard = ({ title, metricLabel, players, metricKey }: any) => (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 flex-1">
      <h3 className="text-primary font-headline font-black uppercase tracking-wider text-xs mb-4">{title}</h3>
      <div className="space-y-4">
        {players.map((p: any, idx: number) => (
          <div key={p.athlete_id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-slate-400 font-bold text-xs w-4">{idx + 1}.</span>
              <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border border-slate-300 shadow-sm shrink-0 flex items-center justify-center text-primary font-black text-[10px]">
                {p.headshot ? (
                  <img 
                    src={p.headshot} 
                    alt={p.display_name} 
                    className="w-full h-full object-cover object-top bg-white" 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                       e.currentTarget.onerror = null; 
                       e.currentTarget.src = 'https://a.espncdn.com/i/headshots/nophoto.png';
                    }}
                  />
                ) : (
                  p.position || 'UN'
                )}
              </div>
              <p className="text-sm font-bold text-primary truncate max-w-[100px]" title={p.full_name}>{p.display_name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-primary">{p[metricKey]}</p>
              <p className="text-[9px] uppercase font-bold text-slate-400">{metricLabel}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row gap-4 w-full">
      <LeaderCard title="Batting Champion" metricLabel="AVG" players={avgLeaders} metricKey="avg" />
      <LeaderCard title="Power Threat" metricLabel="Home Runs" players={hrLeaders} metricKey="hr" />
      <LeaderCard title="Run Producer" metricLabel="RBI" players={rbiLeaders} metricKey="rbi" />
    </div>
  );
};