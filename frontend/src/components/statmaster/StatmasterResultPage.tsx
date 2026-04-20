import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Sparkles, ChevronRight, Loader2 } from 'lucide-react';
import { SafeImage } from '../shared/SafeImage';
import { StatmasterResponse } from './types';
import { StatmasterHero } from './components/StatmasterHero';
import { RecentGamesAppendix } from './components/RecentGamesAppendix';
import { StatmasterTable } from './components/StatmasterTable';
import { StatmasterSearchInput } from './components/StatmasterSearchInput';

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
        <StatmasterSearchInput 
          query={query} 
          setQuery={setQuery} 
          onSubmit={handleSearch} 
          isLoading={isLoading} 
        />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 min-h-[300px]">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm animate-pulse">
              Crunching the numbers...
            </p>
          </div>
        ) : data ? (
          <StatmasterHero data={data} />
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
            <StatmasterTable data={data} />

          </div>
          
          {/* Recent Games Appendix */}
          <RecentGamesAppendix data={data} />
          
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
