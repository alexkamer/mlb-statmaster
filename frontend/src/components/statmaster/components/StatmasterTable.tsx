import { useNavigate } from 'react-router-dom';
import { StatmasterResponse } from '../types';

export const StatmasterTable = ({ data }: { data: StatmasterResponse }) => {
  const navigate = useNavigate();

  if (!data.rows || data.rows.length === 0) {
    return (
      <div className="w-full rounded-xl border-2 border-dashed border-slate-200 p-12 text-center mb-16">
        <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No tabular data to display</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto mb-16">
      <table className="w-full text-left border-collapse whitespace-nowrap">
        <thead>
          <tr className="border-b-2 border-[#111111]">
            <th className="px-4 py-3 text-xs md:text-sm font-black text-[#111111] uppercase tracking-widest whitespace-nowrap text-center w-12">
              #
            </th>
            {data.columns.map((col, idx) => {
              const isPrimary = idx === data.primaryColumnIndex;
              return (
                <th key={idx} className={`px-4 py-3 text-xs md:text-sm font-black uppercase tracking-widest whitespace-nowrap ${col === '' ? 'text-center w-8' : idx === 0 ? 'text-left' : 'text-right'} ${isPrimary ? 'text-[#111111] bg-[#f4f2ee] rounded-t-lg' : 'text-slate-400'}`}>
                  {col}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {data.rows.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-[#f8f9fa] transition-colors cursor-default">
              <td className="px-4 py-3 text-sm font-black text-slate-400 text-center">
                {rowIdx + 1}
              </td>
              {row.map((cell, cellIdx) => {
                const isPrimary = cellIdx === data.primaryColumnIndex;
                const isHomeAway = cell === '@' || cell === 'vs';
                const cellLink = cellIdx === 0 && data.rowLinks?.[rowIdx] ? data.rowLinks[rowIdx] : null;
                
                return (
                  <td 
                    key={cellIdx} 
                    onClick={() => cellLink && navigate(cellLink)}
                    className={`px-4 py-3 text-sm md:text-base whitespace-nowrap ${
                      isHomeAway
                        ? 'text-center font-bold text-slate-400 text-xs uppercase'
                        : cellIdx === 0 
                          ? `font-bold text-[#0051e5] text-left ${cellLink ? 'cursor-pointer hover:underline' : ''}` 
                          : isPrimary
                            ? 'font-black text-[#111111] text-right font-mono bg-[#f4f2ee]'
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
  );
};
