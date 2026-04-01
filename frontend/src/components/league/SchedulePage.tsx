import React, { useState, useEffect } from 'react';
import { fetchAllGames, fetchSeasons } from '../../api';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export const SchedulePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [games, setGames] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState<any[]>([]);
  
  // Read initial state from URL parameters or fall back to defaults
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [selectedYear, setSelectedYear] = useState<number>(Number(searchParams.get('year')) || new Date().getFullYear());
  const [selectedSeasonType, setSelectedSeasonType] = useState<string>(searchParams.get('type') || 'All');

  // Update the URL whenever these states change so it becomes shareable
  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', page.toString());
    if (selectedYear !== new Date().getFullYear()) params.set('year', selectedYear.toString());
    if (selectedSeasonType !== 'All') params.set('type', selectedSeasonType);
    setSearchParams(params, { replace: true });
  }, [page, selectedYear, selectedSeasonType, setSearchParams]);

  useEffect(() => {
    async function loadSeasons() {
      try {
        const s = await fetchSeasons();
        setSeasons(s);
        // Only auto-select the latest year if the URL didn't explicitly provide one
        if (s.length > 0 && !searchParams.get('year')) {
          setSelectedYear(s[0].season_year);
        }
      } catch(e) {
        console.error(e);
      }
    }
    loadSeasons();
  }, []);

  useEffect(() => {
    async function loadSchedule() {
      setLoading(true);
      try {
        const response = await fetchAllGames(selectedYear, page, 50, selectedSeasonType);
        setGames(response.data);
        setMeta(response.meta);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    loadSchedule();
  }, [page, selectedYear, selectedSeasonType]);

  return (
    <div className="max-w-7xl mx-auto w-full px-6 pb-12">
      <div className="mb-8 border-b border-slate-200 pb-8 flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h1 className="text-4xl font-headline font-black text-primary uppercase tracking-tighter flex items-center gap-4">
            <CalendarDays className="w-10 h-10 text-secondary" />
            League Schedule
          </h1>
          <p className="text-slate-500 font-medium mt-2">Comprehensive game results and live scores for the {selectedYear} season.</p>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-6">
          <select 
            className="bg-white border border-slate-200 text-primary px-4 py-2 rounded-lg outline-none font-bold cursor-pointer shadow-sm"
            value={selectedSeasonType}
            onChange={(e) => {
              setSelectedSeasonType(e.target.value);
              setPage(1);
            }}
          >
            <option value="All">All Games</option>
            <option value="Preseason">Spring Training</option>
            <option value="Regular Season">Regular Season</option>
            <option value="Postseason">Postseason</option>
          </select>
          <select 
            className="bg-white border border-slate-200 text-primary px-4 py-2 rounded-lg outline-none font-bold cursor-pointer shadow-sm"
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(Number(e.target.value));
              setPage(1); // Reset pagination when year changes
            }}
          >
            {seasons.map(s => (
              <option key={s.season_year} value={s.season_year}>{s.display_name} Season</option>
            ))}
          </select>
          <div className="w-px h-8 bg-slate-200" />

          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Page {page} of {meta?.total_pages || 1}
          </span>
          <div className="flex gap-2">
            <button 
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => p - 1)}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-primary" />
            </button>
            <button 
              disabled={!meta || page >= meta.total_pages || loading}
              onClick={() => setPage(p => p + 1)}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-primary" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center font-headline font-black text-slate-300 text-xl tracking-widest">
          LOADING SCHEDULE...
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Matchup</th>
                <th className="px-6 py-4 text-center">Score</th>
                <th className="px-6 py-4 text-right">Game ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {games.map(game => {
                const dateString = game.date.endsWith('Z') ? game.date : `${game.date}Z`;
                const dateObj = new Date(dateString);
                return (
                  <tr key={game.event_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-primary">{dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      <p className="text-[10px] font-medium text-slate-500">{dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} {new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).format(dateObj).split(' ')[1]}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-primary hover:text-secondary cursor-pointer transition-colors">
                        {game.matchup}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {game.home_score !== null ? (
                        <div className="inline-flex items-center gap-3 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                           <span className={`font-bold text-sm ${game.away_score > game.home_score ? 'text-primary' : 'text-slate-400'}`}>{game.away_score}</span>
                           <span className="text-[10px] text-slate-400 font-black">-</span>
                           <span className={`font-bold text-sm ${game.home_score > game.away_score ? 'text-primary' : 'text-slate-400'}`}>{game.home_score}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded">Scheduled</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-mono text-slate-400">
                      #{game.event_id}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};