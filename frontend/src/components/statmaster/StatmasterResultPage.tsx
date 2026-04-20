import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Sparkles, ChevronRight, Loader2 } from 'lucide-react';
import { SafeImage } from '../shared/SafeImage';

interface StatmasterResponse {
  query: string;
  answerText: string;
  primaryImage?: string;
  secondaryImage?: string;
  primaryImageAlt?: string;
  subjectName?: string;
  subjectType?: 'player' | 'team';
  subjectId?: number;
  columns: string[];
  rows: any[][];
  rowLinks?: string[];
  relatedQueries?: string[];
  primaryColumnIndex?: number;
  heroStats?: { label: string; value: string }[];
  recentGames?: {
    columns: string[];
    rows: any[][];
    rowLinks?: string[];
  };
}

// Simple in-memory cache to persist results when navigating away and hitting "back"
const statmasterCache = new Map<string, StatmasterResponse>();

export const StatmasterResultPage = () => {
  const [searchParams] = useSearchParams();
  const rawQuery = searchParams.get('q')?.replace(/-/g, ' ') || '';
  const [query, setQuery] = useState(rawQuery);
  const [isLoading, setIsLoading] = useState(!statmasterCache.has(rawQuery));
  const [data, setData] = useState<StatmasterResponse | null>(statmasterCache.get(rawQuery) || null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!rawQuery) return;
    
    setQuery(rawQuery);
    
    // Check if we already have the answer cached
    if (statmasterCache.has(rawQuery)) {
      setData(statmasterCache.get(rawQuery)!);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    
    const fetchData = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/ask/?q=${encodeURIComponent(rawQuery)}`);
        if (!res.ok) {
          throw new Error('Failed to fetch data');
        }
        const jsonData = await res.json();
        
        // Save to cache
        statmasterCache.set(rawQuery, jsonData);
        
        setData(jsonData);
      } catch (error) {
        console.error('Error fetching statmaster data:', error);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [rawQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || query.trim().toLowerCase() === rawQuery.toLowerCase()) return;
    navigate(`/ask?q=${encodeURIComponent(query.trim().replace(/\s+/g, '-'))}`);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    navigate(`/ask?q=${encodeURIComponent(suggestion.trim().replace(/\s+/g, '-'))}`);
  };

  return (
    <div className="w-full flex flex-col items-center justify-start pb-24 min-h-screen">
      
      {/* Answer Hero Section (Edge-to-Edge Background) */}
      <div className={`w-full ${data && data.rows.length > 0 ? 'bg-[#f4f2ee]' : 'bg-surface'} pt-12 pb-16 flex flex-col items-center border-b border-slate-200 transition-colors duration-500`}>
        
        {/* Compact Search Bar inside Hero */}
        <form onSubmit={handleSearch} className="w-full max-w-3xl relative group mb-16 px-4 z-20">
          <div className="absolute inset-y-0 left-4 pl-6 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
          </div>
          <input
            type="text"
            className="block w-full pl-14 pr-8 py-4 border-2 border-slate-300 rounded-full text-lg font-bold text-primary placeholder-slate-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm bg-white"
            placeholder="Ask another question..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="absolute inset-y-0 right-6 flex items-center">
            <button
              type="submit"
              className="bg-primary hover:bg-[#1a1a1a] text-white p-2.5 rounded-full transition-all duration-300 shadow-sm"
              disabled={isLoading}
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </form>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 min-h-[300px]">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm animate-pulse">
              Crunching the numbers...
            </p>
          </div>
        ) : data ? (
          <div className="w-full max-w-5xl mx-auto px-6 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out relative z-10">
            
            {(data.primaryImage || data.secondaryImage) && (
              <div 
                className="relative mb-6 group cursor-pointer inline-block" 
                onClick={() => data.subjectId && navigate(`/${data.subjectType}s/${data.subjectId}`)}
              >
                {/* Statmuse-style image presentation: clean cutout style */}
                {data.primaryImage && (
                  <SafeImage 
                    src={data.primaryImage} 
                    alt={data.primaryImageAlt || 'Subject'} 
                    className="w-40 h-40 md:w-56 md:h-56 object-contain relative z-10 drop-shadow-[0_10px_20px_rgba(0,0,0,0.15)] transition-transform duration-300 group-hover:scale-105"
                    hideOnError
                  />
                )}
                {data.secondaryImage && (
                  <div className="absolute -bottom-2 -right-4 md:-right-6 z-20 bg-white rounded-full p-1.5 shadow-lg border-2 border-slate-100 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                    <SafeImage 
                      src={data.secondaryImage} 
                      alt="Team Logo" 
                      className="w-12 h-12 md:w-16 md:h-16 object-contain"
                      hideOnError
                    />
                  </div>
                )}
              </div>
            )}
            
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-headline font-black text-[#111111] tracking-tight leading-[1.1] max-w-3xl">
              {data.answerText.split(data.subjectName || '').map((part, i, arr) => (
                  <React.Fragment key={i}>
                    {part}
                    {i < arr.length - 1 && data.subjectName && (
                      <span 
                        className="text-[#0051e5] hover:underline cursor-pointer px-1 relative inline-block group transition-colors"
                        onClick={() => data.subjectId && navigate(`/${data.subjectType}s/${data.subjectId}`)}
                      >
                        {data.subjectName}
                      </span>
                    )}
                  </React.Fragment>
              ))}
            </h1>

            {/* HERO STAT BADGES */}
            {data.heroStats && data.heroStats.length > 0 && (
              <div className="flex flex-wrap justify-center gap-8 md:gap-16 mt-10 w-full animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
                {data.heroStats.map((stat, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <span className="text-4xl md:text-6xl font-black text-[#111111] font-mono tracking-tighter">
                      {stat.value}
                    </span>
                    <span className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest">
            Something went wrong. Please try asking again.
          </div>
        )}
      </div>

      {/* Main Content Area (White background) */}
      {!isLoading && data && (
        <div className="w-full bg-white flex flex-col items-center pt-12 px-4 sm:px-6">
          <div className="max-w-5xl w-full">
            
            {/* Statmuse Table Style: No outer borders, minimal lines, bold headers */}
            {data.rows.length > 0 ? (
              <div className="w-full overflow-x-auto mb-16">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="border-b-2 border-[#111111]">
                      {/* Add Rank Column Header */}
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
                        {/* Add Rank Column Cell */}
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
            ) : (
              <div className="w-full rounded-xl border-2 border-dashed border-slate-200 p-12 text-center mb-16">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No tabular data to display</p>
              </div>
            )}

          </div>
          
          {/* Recent Games Appendix */}
          {data.recentGames && data.recentGames.rows.length > 0 && (
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
          )}
          
          {/* Related Queries (Statmuse style: list of links under the table) */}
          {data.relatedQueries && data.relatedQueries.length > 0 && (
            <div className="w-full max-w-5xl mx-auto px-6 mt-16 mb-12 border-t border-slate-200 pt-8">
              <h3 className="text-lg font-black text-[#111111] mb-4">
                Related Searches
              </h3>
              <div className="flex flex-col gap-3">
                {data.relatedQueries.map((rq, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(rq)}
                    className="text-left text-[#0051e5] font-bold text-base md:text-lg hover:underline decoration-2 underline-offset-4 transition-all w-fit"
                  >
                    {rq}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
