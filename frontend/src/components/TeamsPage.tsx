import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Search } from 'lucide-react';

export const TeamsPage = ({ teams, onSelectTeam }: { teams: any[], onSelectTeam: (id: number) => void }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Group teams by division using the internal group_id mapping we built
  // For MLB: 
  // AL (7): East (1), Central (2), West (3)
  // NL (8): East (4), Central (5), West (6)
  
  const divisionMap: Record<number, string> = {
    1: 'American League East', 2: 'American League Central', 3: 'American League West',
    4: 'National League East', 5: 'National League Central', 6: 'National League West'
  };

  const filteredTeams = useMemo(() => {
    return teams.filter(t => 
      t.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.abbreviation.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [teams, searchTerm]);

  const groupedTeams = useMemo(() => {
    // Structure: { "American League": { "East": [], "Central": [], "West": [] }, "National League": ... }
    const leagues: Record<string, Record<string, any[]>> = {
        "American League": { "East": [], "Central": [], "West": [] },
        "National League": { "East": [], "Central": [], "West": [] },
        "Other": { "Uncategorized": [] }
    };

    filteredTeams.forEach(team => {
      const gId = team.group_id;
      let league = "Other";
      let division = "Uncategorized";

      if (gId >= 1 && gId <= 3) {
          league = "American League";
          if (gId === 1) division = "East";
          else if (gId === 2) division = "Central";
          else if (gId === 3) division = "West";
      } else if (gId >= 4 && gId <= 6) {
          league = "National League";
          if (gId === 4) division = "East";
          else if (gId === 5) division = "Central";
          else if (gId === 6) division = "West";
      }

      if (!leagues[league][division]) {
          leagues[league][division] = [];
      }
      leagues[league][division].push(team);
    });
    
    Object.keys(leagues).forEach(l => {
      Object.keys(leagues[l]).forEach(d => {
        leagues[l][d].sort((a: any, b: any) => a.location.localeCompare(b.location));
      });
    });
    // Strip Other if it's empty
    if (leagues["Other"]["Uncategorized"].length === 0) {
        delete leagues["Other"];
    }
    return leagues;
  }, [filteredTeams]);

  return (
    <div className="max-w-7xl mx-auto w-full">
      <div className="mb-12 flex flex-col md:flex-row justify-between items-end gap-6 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-4xl font-headline font-black text-primary uppercase tracking-tighter">Franchise Index</h1>
          <p className="text-slate-500 font-medium mt-2">Select a team to view their deep analytics dashboard.</p>
        </div>
        <div className="relative w-full md:w-96">
          <input 
            type="text" 
            placeholder="Search franchises..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 text-primary px-4 py-3 rounded-xl focus:ring-2 focus:ring-secondary outline-none font-medium shadow-sm pl-11"
          />
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
        </div>
      </div>

      <div className="space-y-16">
                {Object.entries(groupedTeams).map(([league, divisions]) => {
          // Check if league has any teams matching search
          const hasTeams = Object.values(divisions).some((divTeams: any) => divTeams.length > 0);
          if (!hasTeams) return null;

          return (
            <div key={league} className="mb-16">
              <div className="flex items-center gap-4 mb-8 border-b-2 border-slate-200 pb-2">
                 <h2 className="font-headline font-black text-4xl text-primary tracking-tighter uppercase">{league}</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                  {Object.entries(divisions).sort((a, b) => { const order: any = { "East": 1, "Central": 2, "West": 3 }; return (order[a[0]] || 99) - (order[b[0]] || 99); }).map(([division, divTeams]: [string, any]) => {
                    if (divTeams.length === 0) return null;
                    return (
                      <div key={division} className="flex flex-col gap-4">
                        <h3 className="font-headline font-black text-xl tracking-widest uppercase text-slate-500 flex items-center gap-2">
                            <span className="w-4 h-1 bg-secondary rounded-full"></span>
                            {division}
                        </h3>
                        <div className="flex flex-col gap-3">
                          {divTeams.map((team: any, index: number) => (
                            <motion.button
                              key={team.team_id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              onClick={() => onSelectTeam(team.team_id)}
                              className="group relative bg-white border border-slate-200 rounded-xl p-4 text-left hover:shadow-md transition-all duration-300 overflow-hidden flex items-center gap-4"
                            >
                              <div className="absolute top-0 left-0 w-1.5 h-full transition-colors duration-300" style={{ backgroundColor: `#${team.color}` }} />
                              <div className="absolute -right-4 -top-4 w-24 h-24 opacity-5 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none mix-blend-multiply">
                                 <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/${team.abbreviation.toLowerCase()}.png`} alt="" className="w-full h-full object-contain" />
                              </div>
                              
                              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center p-1.5 shadow-inner shrink-0 group-hover:scale-110 transition-transform duration-300 relative z-10 border border-slate-100">
                                <img 
                                  src={`https://a.espncdn.com/i/teamlogos/mlb/500/${team.abbreviation.toLowerCase()}.png`}
                                  alt={team.abbreviation}
                                  className="w-full h-full object-contain mix-blend-multiply"
                                />
                              </div>
                              
                              <div className="relative z-10 flex-1 min-w-0">
                                <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase leading-none mb-1">{team.location}</p>
                                <h3 className="font-headline font-black text-lg text-primary truncate group-hover:text-secondary transition-colors leading-none">{team.name}</h3>
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};