import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import { SafeImage } from './SafeImage';
import { API_URL } from '../../api';

export const SearchBar = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<{players: any[], teams: any[]}>({ players: [], teams: [] });
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const search = async () => {
            if (!query.trim() || query.length < 2) {
                setResults({ players: [], teams: [] });
                return;
            }
            
            setIsLoading(true);
            try {
                const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    setResults(data);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };

        const debounceTimer = setTimeout(search, 300);
        return () => clearTimeout(debounceTimer);
    }, [query]);

    const handleSelect = (type: 'player' | 'team', id: number) => {
        setIsOpen(false);
        setQuery('');
        if (type === 'player') {
            navigate(`/players/${id}`);
        } else {
            navigate(`/teams/${id}`);
        }
    };

    return (
        <div ref={wrapperRef} className="relative w-full max-w-md ml-4 z-[100]">
            <div className="relative flex items-center">
                <input 
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => { if (query.length >= 2) setIsOpen(true); }}
                    placeholder="Search players or teams..."
                    className="bg-[#002d62] border-none text-white text-xs pl-4 pr-10 py-2 rounded-lg w-64 focus:ring-1 focus:ring-secondary transition-all outline-none placeholder:text-slate-400"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 text-secondary animate-spin" />
                    ) : (
                        <Search className="w-4 h-4 text-slate-400" />
                    )}
                </div>
            </div>

            {isOpen && (query.length >= 2) && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden max-h-[400px] overflow-y-auto">
                    {results.teams.length === 0 && results.players.length === 0 && !isLoading && (
                        <div className="p-4 text-center text-sm font-bold text-slate-400 uppercase tracking-widest">
                            No results found
                        </div>
                    )}

                    {results.teams.length > 0 && (
                        <div>
                            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 sticky top-0 z-10">
                                Teams
                            </div>
                            <div className="divide-y divide-slate-100">
                                {results.teams.map((team) => (
                                    <button
                                        key={`team-${team.team_id}`}
                                        onClick={() => handleSelect('team', team.team_id)}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <SafeImage 
                                            src={`https://a.espncdn.com/i/teamlogos/mlb/500/${team.abbreviation.toLowerCase()}.png`}
                                            alt={team.name}
                                            className="w-6 h-6 object-contain"
                                            hideOnError
                                        />
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{team.display_name}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {results.players.length > 0 && (
                        <div>
                            <div className="px-4 py-2 bg-slate-50 border-y border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 sticky top-0 z-10">
                                Players
                            </div>
                            <div className="divide-y divide-slate-100">
                                {results.players.map((player) => (
                                    <button
                                        key={`player-${player.athlete_id}`}
                                        onClick={() => handleSelect('player', player.athlete_id)}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <SafeImage 
                                            src={`https://a.espncdn.com/i/headshots/mlb/players/full/${player.athlete_id}.png`}
                                            fallbackSrc="https://a.espncdn.com/i/headshots/nophoto.png"
                                            alt={player.display_name}
                                            className="w-8 h-8 rounded-full border border-slate-200 bg-white object-cover flex-shrink-0"
                                        />
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate">{player.display_name}</p>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                {player.team_abbrev || 'FA'} • {player.position_abbrev || 'UNK'}
                                            </p>
                                        </div>
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