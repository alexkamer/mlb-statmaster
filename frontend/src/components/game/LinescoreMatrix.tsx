import React from 'react';
import { SafeImage } from '../shared/SafeImage';

interface LinescoreMatrixProps {
    awayTeam: any;
    homeTeam: any;
    header: any;
    isPregame: boolean;
    boxscorePitchers: Map<string, any>;
    className?: string;
}

export const LinescoreMatrix: React.FC<LinescoreMatrixProps> = ({ awayTeam, homeTeam, header, isPregame, boxscorePitchers, className }) => {
    if (isPregame) return null;

    return (
      <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className || 'mb-12'}`}>
         <div className="overflow-x-auto">
             <table className="w-full text-center border-collapse tabular-nums table-fixed">
                <thead>
                   <tr className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-widest border-b border-slate-200">
                       <th className="px-4 py-3 text-left w-48">Team</th>
                       {awayTeam?.linescores?.map((_: any, i: number) => (
                           <th key={i} className="px-3 py-3 text-center border-l border-slate-200/60">{i + 1}</th>
                       ))}
                       <th className="px-4 py-3 font-black text-primary border-l border-slate-200 w-[6%]">R</th>
                       <th className="px-4 py-3 w-[6%]">H</th>
                       <th className="px-4 py-3 w-[6%]">E</th>
                   </tr>
                </thead>
                <tbody className="font-medium text-slate-700">
                   <tr className="border-b border-slate-100 hover:bg-slate-50">
                       <td className="px-4 py-3 text-left font-black flex items-center gap-2" style={{ color: `#${awayTeam?.team?.color}` }}>
                           <SafeImage src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${awayTeam?.team?.abbreviation?.toLowerCase()}.png`} className="w-5 h-5 object-contain" alt="" hideOnError />
                           {awayTeam?.team?.abbreviation}
                       </td>
                       {awayTeam?.linescores?.map((inning: any, i: number) => (
                           <td key={i} className="px-3 py-3 border-l border-slate-200/60">{inning.displayValue !== undefined ? inning.displayValue : "-"}</td>
                       ))}
                       <td className="px-4 py-3 font-black text-primary border-l border-slate-200">{awayTeam?.score}</td>
                       <td className="px-4 py-3 font-bold">{awayTeam?.hits}</td>
                       <td className="px-4 py-3 font-bold">{awayTeam?.errors}</td>
                   </tr>
                   <tr className="hover:bg-slate-50">
                       <td className="px-4 py-3 text-left font-black flex items-center gap-2" style={{ color: `#${homeTeam?.team?.color}` }}>
                           <SafeImage src={`https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${homeTeam?.team?.abbreviation?.toLowerCase()}.png`} className="w-5 h-5 object-contain" alt="" hideOnError />
                           {homeTeam?.team?.abbreviation}
                       </td>
                       {awayTeam?.linescores?.map((_: any, i: number) => {
                           const inning = homeTeam?.linescores?.[i];
                           return (
                               <td key={i} className="px-3 py-3 border-l border-slate-200/60">{inning ? (inning.displayValue !== undefined ? inning.displayValue : "-") : ""}</td>
                           );
                       })}
                       <td className="px-4 py-3 font-black text-primary border-l border-slate-200">{homeTeam?.score}</td>
                       <td className="px-4 py-3 font-bold">{homeTeam?.hits}</td>
                       <td className="px-4 py-3 font-bold">{homeTeam?.errors}</td>
                   </tr>
                </tbody>
             </table>
         </div>
         
         {/* Pitchers of Record */}
         {header?.status?.type?.completed && header?.status?.featuredAthletes && header.status.featuredAthletes.length > 0 && (
             <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-wrap items-center gap-x-8 gap-y-2">
                 {header.status.featuredAthletes.map((fa: any, idx: number) => {
                     const isWinner = fa.name === 'winningPitcher';
                     const isLoser = fa.name === 'losingPitcher';
                     const isSaver = fa.name === 'savingPitcher';
                     if (!isWinner && !isLoser && !isSaver) return null;
                     
                     const label = isWinner ? 'W' : isLoser ? 'L' : 'SV';
                     const colorClass = isWinner ? 'text-emerald-600' : isLoser ? 'text-rose-600' : 'text-blue-600';
                     const boxData = boxscorePitchers.get(fa.athlete.id);
                     let statStr = "";
                     
                     if (boxData) {
                         const ipIdx = boxData.labels.indexOf('IP');
                         const hIdx = boxData.labels.indexOf('H');
                         const erIdx = boxData.labels.indexOf('ER');
                         const bbIdx = boxData.labels.indexOf('BB');
                         const kIdx = boxData.labels.indexOf('K');
                         
                         const ip = ipIdx > -1 ? boxData.stats[ipIdx] : '-';
                         const h = hIdx > -1 ? boxData.stats[hIdx] : '-';
                         const er = erIdx > -1 ? boxData.stats[erIdx] : '-';
                         const bb = bbIdx > -1 ? boxData.stats[bbIdx] : '-';
                         const k = kIdx > -1 ? boxData.stats[kIdx] : '-';
                         
                         statStr = `${ip} IP, ${h} H, ${er} ER, ${bb} BB, ${k} K`;
                     }
                     
                     return (
                         <div key={idx} className="flex items-center gap-3 text-sm">
                             <span className={`font-black uppercase tracking-widest ${colorClass}`}>{label}</span>
                             <SafeImage src={`https://a.espncdn.com/i/headshots/mlb/players/full/${fa.athlete.id}.png`} alt={fa.athlete.displayName} className="w-8 h-8 rounded-full border border-slate-200 bg-white object-cover" hideOnError />
                             <div>
                                 <p className="font-bold text-primary">{fa.athlete.displayName}</p>
                                 <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{statStr}</p>
                             </div>
                         </div>
                     );
                 })}
             </div>
         )}
      </div>
    );
};