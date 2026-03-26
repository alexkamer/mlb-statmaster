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
    const groups: Record<string, any[]> = {};
    filteredTeams.forEach(team => {
      // We grab the group_id from the team data injected from PostgreSQL
      const divName = team.group_id ? divisionMap[team.group_id] || 'Other' : 'Uncategorized';
      if (!groups[divName]) groups[divName] = [];
      groups[divName].push(team);
    });
    
    // Sort the keys so AL comes before NL
    return Object.keys(groups).sort().reduce((acc, key) => {
      acc[key] = groups[key];
      return acc;
    }, {} as Record<string, any[]>);
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
        {Object.entries(groupedTeams).map(([division, divTeams]) => (
          <div key={division}>
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 px-2">{division}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {divTeams.map((team, idx) => (
                <motion.button
                  key={team.team_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => onSelectTeam(team.team_id)}
                  className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left group overflow-hidden relative"
                >
                  {/* Team Color Accent Bar */}
                  <div 
                    className="absolute top-0 left-0 w-full h-2 transition-all duration-300 group-hover:h-full group-hover:opacity-10 opacity-100"
                    style={{ backgroundColor: `#${team.color || '000000'}` }}
                  />
                  
                  <div className="relative z-10">
                    <div className="w-16 h-16 rounded-full mb-4 flex items-center justify-center shadow-md transition-transform group-hover:scale-110 overflow-hidden bg-white p-2"
                         style={{ border: `2px solid #${team.color || '000000'}` }}>
                      <img 
                        src={`https://a.espncdn.com/i/teamlogos/mlb/500/${team.abbreviation.toLowerCase()}.png`} 
                        alt={team.abbreviation}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          // Fallback to text if the image 404s
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.innerHTML = `<span style="color: #${team.color}; font-weight: 900; font-size: 1.25rem;">${team.abbreviation}</span>`;
                        }}
                      />
                    </div>
                    
                    <h3 className="font-headline font-black text-xl text-primary leading-none mb-1 group-hover:text-secondary transition-colors">
                      {team.name}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {team.location}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};