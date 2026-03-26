import re

with open("frontend/src/components/PlayerModal.tsx", "r") as f:
    code = f.read()

# Make the PlayerModal smart enough to show Pitching stats if the player is a pitcher, 
# or Batting stats if they are a batter!

modal_old = """            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Games', value: player.g || '0' },
                { label: 'At Bats', value: player.ab || '0' },
                { label: 'Hits', value: player.h || '0' },
                { label: 'Runs', value: player.r || '0' },
                { label: 'Home Runs', value: player.hr || '0', highlight: true },
                { label: 'RBI', value: player.rbi || '0' },
                { label: 'AVG', value: player.avg || '.000', highlight: true },
                { label: 'OPS', value: player.ops || '.000', highlight: true },
              ].map((stat, idx) => ("""

modal_new = """            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {player.ip !== undefined ? [
                // Pitching Stats
                { label: 'Games', value: player.g || '0' },
                { label: 'Innings', value: player.ip || '0.0' },
                { label: 'Hits', value: player.h || '0' },
                { label: 'Walks', value: player.bb || '0' },
                { label: 'Strikeouts', value: player.k || '0', highlight: true },
                { label: 'Earned Runs', value: player.er || '0' },
                { label: 'Home Runs', value: player.hr || '0' },
                { label: 'ERA', value: player.era || '0.00', highlight: true },
              ].map((stat, idx) => (
                <div key={idx} className={`p-4 rounded-xl border ${stat.highlight ? 'bg-slate-50 border-secondary/20' : 'border-slate-100'}`}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{stat.label}</p>
                  <p className={`text-2xl font-headline font-black ${stat.highlight ? 'text-secondary' : 'text-primary'}`}>{stat.value}</p>
                </div>
              )) : [
                // Batting Stats
                { label: 'Games', value: player.g || '0' },
                { label: 'At Bats', value: player.ab || '0' },
                { label: 'Hits', value: player.h || '0' },
                { label: 'Runs', value: player.r || '0' },
                { label: 'Home Runs', value: player.hr || '0', highlight: true },
                { label: 'RBI', value: player.rbi || '0' },
                { label: 'AVG', value: player.avg || '.000', highlight: true },
                { label: 'OPS', value: player.ops || '.000', highlight: true },
              ].map((stat, idx) => ("""

code = code.replace(modal_old, modal_new)

with open("frontend/src/components/PlayerModal.tsx", "w") as f:
    f.write(code)
