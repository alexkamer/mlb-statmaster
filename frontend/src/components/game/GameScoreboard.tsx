import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, ArrowRight } from 'lucide-react';
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
        <div className="px-8 py-6 flex flex-col items-center justify-center shrink-0 border-y md:border-y-0 md:border-x border-slate-200 bg-slate-50 relative z-10 w-full md:w-auto">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{header?.status?.type?.detail || "Final"}</p>
            {isPregame && (
                <Link 
                    to={`/games/${gameId}/predict`}
                    className="mt-2 flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-[10px] font-black tracking-widest uppercase shadow-lg shadow-indigo-200 transition-all group"
                >
                    <Zap className="w-3 h-3 text-secondary fill-secondary" />
                    Game Predictor
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
            )}
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 font-black text-sm my-4">@</div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest max-w-[120px] text-center">{data.gameInfo?.venue?.fullName}</p>
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