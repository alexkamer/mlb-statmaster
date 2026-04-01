import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SafeImage } from '../shared/SafeImage';

interface PlayByPlayProps {
    data: any;
    awayTeam: any;
    homeTeam: any;
    searchParams: URLSearchParams;
    setSearchParams: (params: URLSearchParams) => void;
    filterPlays: string;
}

export const PlayByPlay: React.FC<PlayByPlayProps> = ({ data, awayTeam, homeTeam, searchParams, setSearchParams, filterPlays }) => {
  const [expandedAtBats, setExpandedAtBats] = useState<Set<string>>(new Set());

  const toggleAtBat = (abId: string) => {
      setExpandedAtBats(prev => {
          const newSet = new Set(prev);
          if (newSet.has(abId)) newSet.delete(abId);
          else newSet.add(abId);
          return newSet;
      });
  };

  const handleFilterChange = (filter: string) => {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("filter", filter);
      setSearchParams(newParams);
  };

  const playsToRender = data.plays?.filter((p: any) => filterPlays === "all" || p.scoringPlay);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
            <h4 className="font-bold text-xs uppercase tracking-widest text-slate-500">Play-by-Play Filter</h4>
            <div className="flex gap-2">
                <button onClick={() => handleFilterChange("all")} className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-widest ${filterPlays === "all" ? "bg-primary text-white" : "bg-slate-200 text-slate-500 hover:bg-slate-300"}`}>All Plays</button>
                <button onClick={() => handleFilterChange("scoring")} className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-widest ${filterPlays === "scoring" ? "bg-secondary text-white" : "bg-slate-200 text-slate-500 hover:bg-slate-300"}`}>Scoring Plays</button>
            </div>
        </div>

        <div className="divide-y divide-slate-100">
            {playsToRender?.length === 0 && (
                <div className="p-8 text-center text-slate-500 font-bold">No plays found matching this filter.</div>
            )}
            {playsToRender?.map((play: any, idx: number) => {
                const isScoring = play.scoringPlay;
                const batTeam = play.participants?.[0]?.athlete?.team?.id || play.team?.id;
                const isAwayBatting = batTeam === awayTeam?.id;
                const scoreColor = isScoring ? (isAwayBatting ? `#${awayTeam?.team?.color}` : `#${homeTeam?.team?.color}`) : undefined;
                const hasPitches = play.playEvents && play.playEvents.length > 0;
                const isExpanded = expandedAtBats.has(play.id);
                const abCount = play.atBatId ? play.atBatId.split("-")[1] : null;

                return (
                    <div key={idx} className={`p-4 transition-colors ${isScoring ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
                        <div className="flex gap-4">
                            {/* Inning / Outs / Score Status */}
                            <div className="flex-none w-20 flex flex-col gap-1">
                                <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                                    {play.period?.half === "top" ? "TOP" : "BOT"} {play.period?.number}
                                </div>
                                <div className="text-[10px] font-bold text-slate-500">{play.clock?.displayValue} Outs</div>
                            </div>
                            
                            {/* Play Description */}
                            <div className="flex-1 flex flex-col gap-1 min-w-0">
                                <p className={`font-bold text-sm ${isScoring ? 'text-primary' : 'text-slate-700'}`}>
                                    {play.text}
                                </p>
                                
                                {isScoring && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded text-white" style={{ backgroundColor: scoreColor || '#000' }}>Score</span>
                                        <span className="text-xs font-black" style={{ color: `#${awayTeam?.team?.color}` }}>{awayTeam?.team?.abbreviation} {play.awayScore}</span>
                                        <span className="text-xs font-bold text-slate-400">-</span>
                                        <span className="text-xs font-black" style={{ color: `#${homeTeam?.team?.color}` }}>{homeTeam?.team?.abbreviation} {play.homeScore}</span>
                                    </div>
                                )}
                            </div>

                            {/* Interaction */}
                            {hasPitches && (
                                <button onClick={() => toggleAtBat(play.id)} className="flex-none flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 transition-colors">
                                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                </button>
                            )}
                        </div>

                        {/* Pitch-by-Pitch Expansion */}
                        {hasPitches && isExpanded && (
                            <div className="mt-4 ml-24 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 flex justify-between">
                                    <span>Pitches in AB {abCount ? `#${abCount}` : ""}</span>
                                    <span>Result</span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {play.playEvents.map((pe: any, peIdx: number) => {
                                        const isStrike = pe.text?.toLowerCase().includes("strike");
                                        const isBall = pe.text?.toLowerCase().includes("ball");
                                        const isHit = pe.text?.toLowerCase().includes("in play");
                                        
                                        let pColor = "bg-slate-200 text-slate-600";
                                        if (isStrike) pColor = "bg-rose-100 text-rose-700";
                                        else if (isBall) pColor = "bg-emerald-100 text-emerald-700";
                                        else if (isHit) pColor = "bg-indigo-100 text-indigo-700";

                                        return (
                                            <div key={peIdx} className="px-3 py-2 flex items-center gap-3 text-xs">
                                                <span className="font-bold text-slate-400 w-4">{peIdx + 1}</span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${pColor}`}>
                                                    {pe.text || "Unknown"}
                                                </span>
                                                <span className="flex-1 font-medium text-slate-600">{pe.details || "-"}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    </div>
  );
};