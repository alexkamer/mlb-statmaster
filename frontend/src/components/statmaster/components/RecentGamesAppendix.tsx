import { useNavigate } from 'react-router-dom';
import { StatmasterResponse } from '../types';

export const RecentGamesAppendix = ({ data }: { data: StatmasterResponse }) => {
  const navigate = useNavigate();

  if (!data.recentGames || data.recentGames.rows.length === 0) return null;

  return (
    <div className="w-full max-w-5xl mx-auto px-6 mt-16 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-both">
      <h2 className="text-xl font-black text-[#111111] uppercase tracking-widest mb-6">Recent Games</h2>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="border-b-2 border-slate-200 bg-[#f8f9fa]">
                <th className="px-4 py-3 text-xs md:text-sm font-black uppercase tracking-widest whitespace-nowrap text-slate-400 text-center w-12">
                  #
                </th>
                {data.recentGames.columns.map((col, idx) => (
                  <th key={idx} className={`px-4 py-3 text-xs md:text-sm font-black uppercase tracking-widest whitespace-nowrap ${col === '' ? 'text-center w-8' : idx === 0 ? 'text-left' : 'text-right'} text-slate-400`}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.recentGames.rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-[#f8f9fa] transition-colors cursor-default">
                  <td className="px-4 py-3 text-sm font-black text-slate-400 text-center">
                    {rowIdx + 1}
                  </td>
                  {row.map((cell, cellIdx) => {
                    const isHomeAway = cell === '@' || cell === 'vs';
                    const cellLink = cellIdx === 0 && data.recentGames?.rowLinks?.[rowIdx] ? data.recentGames.rowLinks[rowIdx] : null;

                    return (
                      <td 
                        key={cellIdx} 
                        onClick={() => cellLink && navigate(cellLink)}
                        className={`px-4 py-3 text-sm md:text-base whitespace-nowrap ${
                          isHomeAway
                            ? 'text-center font-bold text-slate-400 text-xs uppercase'
                            : cellIdx === 0 
                              ? `font-bold text-[#0051e5] text-left ${cellLink ? 'cursor-pointer hover:underline' : ''}` 
                              : 'font-medium text-[#111111] text-right font-mono opacity-60'
                        }`}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
