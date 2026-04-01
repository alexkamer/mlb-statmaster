import React from 'react';
import { SafeImage } from '../shared/SafeImage';

interface OpponentHistoryTabProps {
    propType: string;
    propLine: string | number;
    isPitching: boolean;
    opponentLogs: any[];
    positionFilter: string;
    setPositionFilter: (pos: string) => void;
    player: any;
    initialOpponentAbbrev: string;
    initialIsHome: boolean;
    getStatValueFromLog: (log: any, pType: string) => number | null;
}

export const OpponentHistoryTab: React.FC<OpponentHistoryTabProps> = ({ 
    propType, propLine, isPitching, opponentLogs, positionFilter, setPositionFilter, player, initialOpponentAbbrev, initialIsHome, getStatValueFromLog 
}) => {
    const getAbbrev = (pos: string) => {
        const p = pos.toLowerCase();
        if (p.includes('shortstop')) return 'SS';
        if (p.includes('first base')) return '1B';
        if (p.includes('second base')) return '2B';
        if (p.includes('third base')) return '3B';
        if (p.includes('catcher')) return 'C';
        if (p.includes('left field')) return 'LF';
        if (p.includes('center field')) return 'CF';
        if (p.includes('right field')) return 'RF';
        if (p.includes('designated hitter')) return 'DH';
        if (p.includes('pitcher')) return 'P';
        return '';
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">
                        <span className="text-emerald-600">{propType}</span> vs {initialOpponentAbbrev}
                    </h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">
                        Analyzing historical {propType} by opposing {isPitching ? 'Starting Pitchers' : (positionFilter !== 'all' ? positionFilter + 's' : 'Starting Batters')} against {initialOpponentAbbrev}.
                    </p>
                </div>
                
                {!isPitching && (
                    <div className="flex bg-white rounded-md border border-slate-200 p-1 shadow-sm w-fit">
                        <button 
                            onClick={() => setPositionFilter('all')}
                            className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ${positionFilter === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            All Batters
                        </button>
                        <button 
                            onClick={() => setPositionFilter(getAbbrev(player?.position || ''))}
                            className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ${positionFilter !== 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            disabled={!player?.position}
                        >
                            Only {getAbbrev(player?.position || '') || 'Same Pos'}
                        </button>
                    </div>
                )}
            </div>

            <div className="p-6">
                {(() => {
                    const p = propType.toLowerCase();
                    const target = parseFloat(String(propLine).replace('+', ''));
                    const isPlus = String(propLine).includes('+');
                    
                    const filteredLogs = (!isPitching && positionFilter !== 'all') 
                        ? opponentLogs.filter(log => log.position === positionFilter)
                        : opponentLogs;

                    const values = filteredLogs.map(log => {
                        let val = getStatValueFromLog(log, propType);
                        if (val === null) val = 0;
                        return { ...log, val };
                    }).sort((a, b) => new Date(b.game_date).getTime() - new Date(a.game_date).getTime());

                    const hits = values.filter(v => isPlus ? v.val >= target : v.val > target).length;
                    const total = values.length;
                    const hitRate = total > 0 ? Math.round((hits / total) * 100) : 0;
                    const avg = total > 0 ? (values.reduce((sum, v) => sum + v.val, 0) / total).toFixed(2) : '0';

                    const expectedOpponentLocation = initialIsHome ? 'away' : 'home';
                    const splitValues = values.filter(v => v.home_away === expectedOpponentLocation);
                    const splitHits = splitValues.filter(v => isPlus ? v.val >= target : v.val > target).length;
                    const splitTotal = splitValues.length;
                    const splitHitRate = splitTotal > 0 ? Math.round((splitHits / splitTotal) * 100) : 0;
                    const splitAvg = splitTotal > 0 ? (splitValues.reduce((sum, v) => sum + v.val, 0) / splitTotal).toFixed(2) : '0';
                    
                    return (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Opponent Allows {propLine}+</p>
                                    <p className={`text-3xl font-black font-headline ${hitRate >= 60 ? 'text-indigo-600' : hitRate <= 40 ? 'text-rose-600' : 'text-slate-700'}`}>
                                        {hitRate}%
                                    </p>
                                    <p className="text-xs text-slate-400 font-medium mt-1">{hits} of {total} games</p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Avg {propType} Allowed</p>
                                    <p className="text-3xl font-black font-headline text-slate-800">{avg}</p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">At {expectedOpponentLocation === 'home' ? 'Home' : 'Away'} ({propLine}+)</p>
                                    <p className={`text-3xl font-black font-headline ${splitHitRate >= 60 ? 'text-indigo-600' : splitHitRate <= 40 ? 'text-rose-600' : 'text-slate-700'}`}>
                                        {splitHitRate}%
                                    </p>
                                    <p className="text-xs text-slate-400 font-medium mt-1">{splitHits} of {splitTotal} games (Avg: {splitAvg})</p>
                                </div>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden mt-6 overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse tabular-nums">
                                    <thead>
                                        <tr className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-black border-b border-slate-200">
                                            <th className="p-4">Date</th>
                                            <th className="p-4">Player</th>
                                            <th className="p-4">Pos</th>
                                            <th className="p-4 text-center text-primary">{propType}</th>
                                            <th className="p-4 text-center">AB</th>
                                            <th className="p-4 text-center">H</th>
                                            <th className="p-4 text-center">R</th>
                                            <th className="p-4 text-center">BB</th>
                                            <th className="p-4 text-center">K</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {values.map((v, i) => {
                                            const isHit = isPlus ? v.val >= target : v.val > target;
                                            return (
                                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-4 font-bold text-slate-700">{new Date(v.game_date).toLocaleDateString(undefined, {month: 'numeric', day: 'numeric'})}</td>
                                                    <td className="p-4 font-bold text-indigo-600 truncate max-w-[150px]">{v.name}</td>
                                                    <td className="p-4 font-black text-slate-400 text-xs">{v.position}</td>
                                                    <td className={`p-4 text-center font-black ${isHit ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                                                        {v.val}
                                                    </td>
                                                    <td className="p-4 text-center text-slate-600">{v.ab || v.ip || '-'}</td>
                                                    <td className="p-4 text-center text-slate-600">{v.h || '-'}</td>
                                                    <td className="p-4 text-center text-slate-600">{v.r || '-'}</td>
                                                    <td className="p-4 text-center text-slate-600">{v.bb || '-'}</td>
                                                    <td className="p-4 text-center text-slate-600">{v.k || '-'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};