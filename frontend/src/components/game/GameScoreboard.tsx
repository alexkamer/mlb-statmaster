import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, ArrowRight, MapPin, Calendar, Clock, Cloud } from 'lucide-react';

import { SafeImage } from '../shared/SafeImage';

interface GameScoreboardProps {
    data: any;
    gameId: string;
    awayTeam: any;
    homeTeam: any;
    header: any;
    isPregame: boolean;
}

export const GameScoreboard: React.FC<GameScoreboardProps> = ({ data, gameId, awayTeam, homeTeam, header, isPregame }) => {
    const gameDateStr = header?.date || data?.header?.competitions?.[0]?.date;
    let formattedDate = "";
    let formattedTime = "";
    
    if (gameDateStr) {
        const d = new Date(gameDateStr);
        formattedDate = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        formattedTime = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    }

    const weather = data?.gameInfo?.weather;
    const weatherString = weather ? `${weather.temperature ? weather.temperature + '°' : ''} ${weather.displayValue || ''}`.trim() : null;

    return (
      <div className="mb-12 mt-8 flex flex-col md:flex-row items-center justify-between bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Away Team */}
        <div className="flex-1 w-full p-8 flex flex-col items-center relative" style={{ backgroundColor: `#${awayTeam?.team?.color}10` }}>
            <SafeImage src={awayTeam?.team?.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/mlb/500/${awayTeam?.team?.abbreviation?.toLowerCase()}.png`} alt="away logo" className="w-24 h-24 object-contain mb-4" />
            <Link to={`/teams/${awayTeam?.id}`} className="font-headline font-black text-3xl uppercase tracking-tighter hover:underline" style={{ color: `#${awayTeam?.team?.color}` }}>{awayTeam?.team?.name}</Link>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">{awayTeam?.record?.[0]?.summary || ""}</p>
            <div className="mt-6 font-black text-6xl tabular-nums" style={{ color: `#${awayTeam?.team?.color}` }}>{awayTeam?.score || "0"}</div>
        </div>

        {/* Center Divider / Info */}
        <div className="px-8 py-6 flex flex-col items-center justify-center shrink-0 border-y md:border-y-0 md:border-x border-slate-200 bg-slate-50 relative z-10 w-full md:w-auto min-w-[280px]">
            <p className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4 bg-white border border-slate-200 shadow-sm px-4 py-1.5 rounded-full">{header?.status?.type?.detail || "Final"}</p>
            
            <div className="flex flex-col gap-2 w-full">
                {formattedDate && (
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 justify-center">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formattedDate}
                    </div>
                )}
                {formattedTime && (
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 justify-center">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formattedTime}
                    </div>
                )}
                {data.gameInfo?.venue?.fullName && (
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-slate-500 justify-center text-center">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[200px]">{data.gameInfo.venue.fullName}</span>
                    </div>
                )}
                {weatherString && (
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 justify-center">
                        <Cloud className="w-3.5 h-3.5 text-slate-400" />
                        {weatherString}
                    </div>
                )}
            </div>

            {isPregame && (
                <Link 
                    to={`/games/${gameId}/predict`}
                    className="mt-6 flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-[10px] font-black tracking-widest uppercase shadow-lg shadow-indigo-200 transition-all group"
                >
                    <Zap className="w-3.5 h-3.5 text-secondary fill-secondary" />
                    Game Predictor
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </Link>
            )}
        </div>

        {/* Home Team */}
        <div className="flex-1 w-full p-8 flex flex-col items-center relative" style={{ backgroundColor: `#${homeTeam?.team?.color}10` }}>
            <SafeImage src={homeTeam?.team?.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/mlb/500/${homeTeam?.team?.abbreviation?.toLowerCase()}.png`} alt="home logo" className="w-24 h-24 object-contain mb-4" />
            <Link to={`/teams/${homeTeam?.id}`} className="font-headline font-black text-3xl uppercase tracking-tighter hover:underline" style={{ color: `#${homeTeam?.team?.color}` }}>{homeTeam?.team?.name}</Link>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">{homeTeam?.record?.[0]?.summary || ""}</p>
            <div className="mt-6 font-black text-6xl tabular-nums" style={{ color: `#${homeTeam?.team?.color}` }}>{homeTeam?.score || "0"}</div>
        </div>
      </div>
    );
};