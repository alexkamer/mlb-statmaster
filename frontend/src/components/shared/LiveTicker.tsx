import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronRight, Calendar as CalendarIcon, TrendingUp } from 'lucide-react';
import { useScoreboard } from '../../context/ScoreboardContext';

export const LiveTicker = () => {
  const { events } = useScoreboard();
  const navigate = useNavigate();

  if (events.length === 0) return null;

  return (
    <div className="flex-1 h-full flex items-center overflow-x-auto hide-scrollbar mx-6 relative">
      <div className="flex flex-nowrap items-center divide-x divide-white/10 h-full py-2">
        {events.map((event: any) => {
          const comp = event.competitions[0];
          const status = event.status.type;
          const isLive = status.state === 'in';
          const isFinal = status.state === 'post';
          const isScheduled = status.state === 'pre';
          
          const homeTeam = comp.competitors.find((c: any) => c.homeAway === 'home');
          const awayTeam = comp.competitors.find((c: any) => c.homeAway === 'away');
          
          const awayLogo = `https://a.espncdn.com/i/teamlogos/mlb/500/${awayTeam?.team?.abbreviation?.toLowerCase() || 'mlb'}.png`;
          const homeLogo = `https://a.espncdn.com/i/teamlogos/mlb/500/${homeTeam?.team?.abbreviation?.toLowerCase() || 'mlb'}.png`;
          const getContrastColor = (team: any) => {
            if (!team || !team.team) return '#ffffff';
            const abbr = team.team.abbreviation;
            const altColor = team.team.alternateColor ? `#${team.team.alternateColor}` : '#ffffff';
            // Specific overrides for teams where their logo blends too much with their alternate color
            if (abbr === 'PIT' || abbr === 'BAL' || abbr === 'ARI') return '#ffffff';
            return altColor;
          };

          const awayColor = getContrastColor(awayTeam);
          const homeColor = getContrastColor(homeTeam);

          // Fallback short details
          let statusText = status.shortDetail; // e.g., "3/26 - 4:15 PM EDT"
          let badgeColor = 'text-slate-400';
          let badgeText = '';

          if (status.name === 'STATUS_POSTPONED' || status.detail.toLowerCase().includes('postponed')) {
            badgeColor = 'text-slate-400';
            badgeText = 'Postponed';
          } else if (isLive) {
            badgeColor = 'text-[#b80a2e]'; // secondary color
            badgeText = 'Live';
            statusText = event.status.detail; // e.g., "Bot 7th"
          } else if (isFinal) {
            badgeColor = 'text-slate-400';
            badgeText = 'Final';
          } else if (isScheduled) {
            // Convert UTC date to local time string e.g. "4:15 PM"
            const dateObj = new Date(event.date);
            statusText = dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
            badgeText = statusText;
          }

          let awayScoreOrRecord = awayTeam?.score;
          let homeScoreOrRecord = homeTeam?.score;

          if (isScheduled) {
            const awayRecord = awayTeam?.records?.find((r: any) => r.type === 'total')?.summary || '0-0';
            const homeRecord = homeTeam?.records?.find((r: any) => r.type === 'total')?.summary || '0-0';
            awayScoreOrRecord = awayRecord;
            homeScoreOrRecord = homeRecord;
          }

          return (
            <div 
              key={event.id} 
              onClick={() => navigate(`/games/${event.id}`)}
              className="group flex flex-col justify-center gap-1 px-6 min-w-max hover:bg-white/5 transition-colors cursor-pointer h-full relative"
            >
              <div className="absolute inset-0 bg-[#002d62] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <span className="text-white font-bold text-xs uppercase tracking-widest">{isScheduled ? 'Preview' : 'Box Score'}</span>
              </div>
              <div className="flex justify-between items-center mb-1 gap-4 group-hover:invisible">
                <span className={`text-[10px] font-bold ${badgeColor} uppercase tracking-tighter`}>{badgeText}</span>
                {isLive && <span className="text-[10px] text-[#7796d1] font-medium">{statusText}</span>}
              </div>
              <div className="flex flex-col text-[12px] leading-relaxed font-bold gap-1 w-full group-hover:invisible">
                <div className="flex items-center justify-between gap-4 text-white min-w-[90px]">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center p-0.5" style={{ backgroundColor: awayColor }}>
                      <img src={awayLogo} className="w-full h-full object-contain" alt={awayTeam?.team?.abbreviation} />
                    </div>
                    <span>{awayTeam?.team?.abbreviation}</span>
                  </div>
                  <span className={isScheduled ? 'text-[10px] text-slate-500 font-medium tracking-widest' : ''}>{awayScoreOrRecord}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-white min-w-[90px]">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center p-0.5" style={{ backgroundColor: homeColor }}>
                      <img src={homeLogo} className="w-full h-full object-contain" alt={homeTeam?.team?.abbreviation} />
                    </div>
                    <span>{homeTeam?.team?.abbreviation}</span> 
                  </div>
                  <span className={isScheduled ? 'text-[10px] text-slate-500 font-medium tracking-widest' : ''}>{homeScoreOrRecord}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
