import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchGameSummary, fetchRecentGames, fetchPlayerProfile, fetchPlayerGameLogs } from '../api';
import { 
    TrendingUp, 
    ArrowLeft, 
    Zap, 
    Wind, 
    Thermometer, 
    Users, 
    BarChart2, 
    ShieldAlert,
    Target,
    Activity
} from 'lucide-react';

export const GamePredictorPage = () => {
    const { gameId } = useParams();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [gameData, setGameData] = useState<any>(null);
    const [awayRecent, setAwayRecent] = useState<any[]>([]);
    const [homeRecent, setHomeRecent] = useState<any[]>([]);
    const [awayStarter, setAwayStarter] = useState<any>(null);
    const [homeStarter, setHomeStarter] = useState<any>(null);
    const [awayStarterLogs, setAwayStarterLogs] = useState<any>(null);
    const [homeStarterLogs, setHomeStarterLogs] = useState<any>(null);

    useEffect(() => {
        if (!gameId) return;
        
        const loadPredictionData = async () => {
            setLoading(true);
            try {
                const summary = await fetchGameSummary(gameId);
                setGameData(summary);
                
                if (summary) {
                    const header = summary.header?.competitions?.[0];
                    const awayTeam = header?.competitors?.find((c: any) => c.homeAway === "away");
                    const homeTeam = header?.competitors?.find((c: any) => c.homeAway === "home");
                    
                    const awayProbable = awayTeam?.probables?.[0]?.athlete;
                    const homeProbable = homeTeam?.probables?.[0]?.athlete;
                    
                    const year = new Date().getFullYear();

                    const [aRecent, hRecent, aStarter, hStarter, aLogs, hLogs] = await Promise.all([
                        fetchRecentGames(parseInt(awayTeam.id), 10),
                        fetchRecentGames(parseInt(homeTeam.id), 10),
                        awayProbable ? fetchPlayerProfile(parseInt(awayProbable.id)) : Promise.resolve(null),
                        homeProbable ? fetchPlayerProfile(parseInt(homeProbable.id)) : Promise.resolve(null),
                        awayProbable ? fetchPlayerGameLogs(parseInt(awayProbable.id), year, 5) : Promise.resolve(null),
                        homeProbable ? fetchPlayerGameLogs(parseInt(homeProbable.id), year, 5) : Promise.resolve(null)
                    ]);
                    
                    setAwayRecent(aRecent);
                    setHomeRecent(hRecent);
                    setAwayStarter(aStarter);
                    setHomeStarter(hStarter);
                    setAwayStarterLogs(aLogs);
                    setHomeStarterLogs(hLogs);
                }
            } catch (e) {
                console.error(e);
            }
            setLoading(false);
        };
        
        loadPredictionData();
    }, [gameId]);

    if (loading) return (
        <div className="max-w-7xl mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-[600px]">
            <Activity className="w-12 h-12 text-primary animate-spin mb-4" />
            <p className="text-slate-500 font-bold uppercase tracking-widest animate-pulse">Running Prediction Model...</p>
        </div>
    );

    if (!gameData) return <div className="p-12 text-center text-rose-500 font-bold">Failed to load game data for prediction.</div>;

    const header = gameData.header?.competitions?.[0];
    const awayTeam = header?.competitors?.find((c: any) => c.homeAway === "away");
    const homeTeam = header?.competitors?.find((c: any) => c.homeAway === "home");
    const venue = gameData.gameInfo?.venue;
    const weather = gameData.gameInfo?.weather;

    // --- Prediction Logic ---
    
    // 1. Recent Form (Win %)
    const awayWinPct = awayRecent.filter(g => g.winner).length / (awayRecent.length || 1);
    const homeWinPct = homeRecent.filter(g => g.winner).length / (homeRecent.length || 1);
    
    // 2. Pitcher Edge
    const getPitcherScore = (starter: any, logs: any) => {
        if (!starter || !logs) return 0;
        // Simple heuristic: Lower ERA is better, high K/9 is better
        const era = parseFloat(starter.pitching?.era || '4.50');
        const whip = parseFloat(starter.pitching?.whip || '1.30');
        
        // Recent form (last 5 starts)
        const recentEras = logs.pitching?.map((l: any) => parseFloat(l.er || '0') / (parseFloat(l.ip || '1') || 1) * 9) || [];
        const avgRecentEra = recentEras.length > 0 ? recentEras.reduce((a: number, b: number) => a + b, 0) / recentEras.length : era;
        
        return (10 - era) + (2 - whip) * 2 + (10 - avgRecentEra);
    };
    
    const awayStarterScore = getPitcherScore(awayStarter, awayStarterLogs);
    const homeStarterScore = getPitcherScore(homeStarter, homeStarterLogs);
    
    // 3. Prediction Score
    const baseAway = 4.2 + (awayWinPct * 2) + (awayStarterScore / 10);
    const baseHome = 4.4 + (homeWinPct * 2) + (homeStarterScore / 10); // Slight home field advantage
    
    // Weather adjustments
    let weatherAdj = 0;
    if (weather) {
        const temp = parseInt(weather.temperature || '70');
        if (temp > 85) weatherAdj += 0.5; // Ball flies in heat
        if (temp < 55) weatherAdj -= 0.5; // Pitcher's weather
        
        if (weather.wind) {
            const windSpeed = parseInt(weather.wind.speed || '0');
            const windDir = weather.wind.direction?.toLowerCase() || '';
            if (windSpeed > 10) {
                if (windDir.includes('out')) weatherAdj += 0.8;
                if (windDir.includes('in')) weatherAdj -= 0.8;
            }
        }
    }
    
    const projectedAway = Math.max(0, baseAway + (weatherAdj / 2)).toFixed(1);
    const projectedHome = Math.max(0, baseHome + (weatherAdj / 2)).toFixed(1);
    
    const winner = parseFloat(projectedHome) > parseFloat(projectedAway) ? homeTeam : awayTeam;
    const winProb = 50 + (Math.abs(parseFloat(projectedHome) - parseFloat(projectedAway)) * 10);
    const cappedWinProb = Math.min(95, Math.max(51, winProb)).toFixed(1);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="bg-indigo-600 p-3 rounded-2xl shadow-indigo-200 shadow-lg">
                        <Zap className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="font-headline font-black text-3xl uppercase tracking-widest text-slate-800">Game Predictor</h1>
                        <p className="text-slate-500 font-medium">AI-driven situational analysis and score projections.</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Model Active</span>
                </div>
            </div>

            {/* Matchup Hero */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(79,70,229,0.1),transparent)] pointer-events-none"></div>
                <div className="p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
                    
                    {/* Away Team */}
                    <div className="flex flex-col items-center text-center flex-1">
                        <img src={awayTeam.team?.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/mlb/500/${awayTeam.team?.abbreviation?.toLowerCase()}.png`} className="w-32 h-32 object-contain mb-6 drop-shadow-2xl" alt="" />
                        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-800">{awayTeam.team?.displayName}</h2>
                        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mt-1">{awayTeam.record?.[0]?.summary}</p>
                        <div className="mt-6 px-4 py-1 rounded-full bg-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">Visitor</div>
                    </div>

                    {/* Prediction Center */}
                    <div className="flex flex-col items-center shrink-0">
                        <div className="mb-4 text-center">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Projected Score</p>
                            <div className="flex items-center gap-6">
                                <span className="text-6xl font-black font-headline text-slate-800 tabular-nums">{projectedAway}</span>
                                <div className="h-12 w-[2px] bg-slate-200"></div>
                                <span className="text-6xl font-black font-headline text-slate-800 tabular-nums">{projectedHome}</span>
                            </div>
                        </div>
                        
                        <div className="mt-8 flex flex-col items-center">
                            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-8 py-4 flex flex-col items-center shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Model Confidence</p>
                                <p className="text-4xl font-black font-headline text-indigo-600 leading-none">{cappedWinProb}%</p>
                                <p className="text-xs font-bold text-indigo-400 mt-2 uppercase tracking-wider">On {winner.team?.abbreviation} ML</p>
                            </div>
                        </div>
                    </div>

                    {/* Home Team */}
                    <div className="flex flex-col items-center text-center flex-1">
                        <img src={homeTeam.team?.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/mlb/500/${homeTeam.team?.abbreviation?.toLowerCase()}.png`} className="w-32 h-32 object-contain mb-6 drop-shadow-2xl" alt="" />
                        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-800">{homeTeam.team?.displayName}</h2>
                        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mt-1">{homeTeam.record?.[0]?.summary}</p>
                        <div className="mt-6 px-4 py-1 rounded-full bg-primary/10 text-[10px] font-black text-primary uppercase tracking-widest">Home Field</div>
                    </div>
                </div>
            </div>

            {/* Analysis Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* 1. Pitcher Duel */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-slate-400" />
                                <h3 className="font-headline font-black uppercase tracking-widest text-slate-700">The Pitcher Duel</h3>
                            </div>
                            <span className="text-[10px] font-black text-indigo-500 uppercase bg-indigo-50 px-2 py-0.5 rounded">Key Factor</span>
                        </div>
                        
                        <div className="p-6 grid grid-cols-2 divide-x divide-slate-100">
                            {[
                                { starter: awayStarter, logs: awayStarterLogs, team: awayTeam },
                                { starter: homeStarter, logs: homeStarterLogs, team: homeTeam }
                            ].map((p, i) => (
                                <div key={i} className={`px-6 flex flex-col ${i === 1 ? 'items-end text-right' : ''}`}>
                                    <div className={`flex items-center gap-4 mb-6 ${i === 1 ? 'flex-row-reverse' : ''}`}>
                                        <div className="w-16 h-16 rounded-full bg-slate-100 overflow-hidden border-2 border-slate-200 shadow-sm">
                                            <img src={p.starter?.headshot} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800 text-lg leading-tight">{p.starter?.display_name || 'TBD'}</p>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">{p.team?.team?.abbreviation} • {p.starter?.throws}HP</p>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-4 w-full">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Season ERA</span>
                                            <span className="text-2xl font-black font-headline text-slate-700">{p.starter?.pitching?.era || '0.00'}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">WHIP / K:BB</span>
                                            <span className="text-lg font-bold text-slate-600">{p.starter?.pitching?.whip || '0.00'} <span className="text-slate-300 mx-1">/</span> {p.starter?.pitching?.k_bb || '0.0'}</span>
                                        </div>
                                        <div className="pt-4 border-t border-slate-50">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Recent Trend (Last 5)</span>
                                            <div className={`flex gap-1 ${i === 1 ? 'justify-end' : ''}`}>
                                                {p.logs?.pitching?.slice(0, 5).map((l: any, idx: number) => {
                                                    const er = parseInt(l.er || '0');
                                                    const color = er <= 1 ? 'bg-emerald-500' : er >= 4 ? 'bg-rose-500' : 'bg-slate-300';
                                                    return (
                                                        <div key={idx} className={`w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-black text-white ${color}`} title={`${er} ER Allowed`}>
                                                            {er}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                            <Target className="w-5 h-5 text-slate-400" />
                            <h3 className="font-headline font-black uppercase tracking-widest text-slate-700">Team Form Index</h3>
                        </div>
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="flex gap-1">
                                            {awayRecent.slice(0, 5).map((g, i) => (
                                                <div key={i} className={`w-4 h-4 rounded-full ${g.winner ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                            ))}
                                        </div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase">L5</span>
                                    </div>
                                    <p className="text-3xl font-black font-headline text-slate-800">{Math.round(awayWinPct * 100)}% <span className="text-sm text-slate-400 font-bold uppercase tracking-widest ml-1">Wins</span></p>
                                </div>
                                
                                <div className="text-center px-8 border-x border-slate-100 flex flex-col items-center">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Matchup Heat</span>
                                    <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden flex">
                                        <div className="h-full bg-indigo-500" style={{ width: `${(awayWinPct / (awayWinPct + homeWinPct)) * 100}%` }}></div>
                                    </div>
                                </div>

                                <div className="flex-1 flex flex-col items-end">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase">L5</span>
                                        <div className="flex gap-1">
                                            {homeRecent.slice(0, 5).map((g, i) => (
                                                <div key={i} className={`w-4 h-4 rounded-full ${g.winner ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-3xl font-black font-headline text-slate-800">{Math.round(homeWinPct * 100)}% <span className="text-sm text-slate-400 font-bold uppercase tracking-widest ml-1">Wins</span></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Situational Factors */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
                            <Wind className="w-5 h-5 text-slate-400" />
                            <h3 className="font-headline font-black uppercase tracking-widest text-slate-700">Environment</h3>
                        </div>
                        <div className="p-6 space-y-6">
                            {weather ? (
                                <>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-orange-50 rounded-lg">
                                                <Thermometer className="w-5 h-5 text-orange-500" />
                                            </div>
                                            <span className="text-sm font-bold text-slate-600">Temperature</span>
                                        </div>
                                        <span className="font-black text-slate-800">{weather.temperature}°F</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-50 rounded-lg">
                                                <Wind className="w-5 h-5 text-blue-500" />
                                            </div>
                                            <span className="text-sm font-bold text-slate-600">Wind Speed</span>
                                        </div>
                                        <span className="font-black text-slate-800">{weather.wind?.speed} MPH</span>
                                    </div>
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-50">
                                        <div className="flex items-center gap-3 ml-10">
                                            <span className="text-sm font-bold text-slate-600">Direction</span>
                                        </div>
                                        <span className={`font-black uppercase tracking-widest text-xs px-2 py-0.5 rounded ${weather.wind?.direction?.toLowerCase().includes('out') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {weather.wind?.direction || 'Variable'}
                                        </span>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl p-4 mt-4">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                            <ShieldAlert className="w-3 h-3" /> Impact Rating
                                        </p>
                                        <p className="text-xs font-bold text-slate-600 leading-relaxed">
                                            {Math.abs(weatherAdj) < 0.3 ? 'Neutral conditions. Ball flight should remain consistent with season averages.' : 
                                             weatherAdj > 0 ? 'Hitter-friendly conditions. The ball is likely to carry further than average.' : 
                                             'Pitcher-friendly conditions. Atmospheric pressure and wind may suppress long balls.'}
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div className="py-8 text-center">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-loose">Weather data not yet <br/>available for this venue.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl shadow-xl p-6 text-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <BarChart2 className="w-32 h-32" />
                        </div>
                        <h3 className="font-headline font-black uppercase tracking-widest text-xs mb-6 opacity-70">Predictor Tip</h3>
                        <p className="text-sm font-bold leading-relaxed mb-6 relative z-10">
                            {parseFloat(projectedHome) + parseFloat(projectedAway) > 9 ? 'Expect a high scoring affair. Both offenses are trending up and current environmental factors favor the hitter.' : 
                             parseFloat(projectedHome) + parseFloat(projectedAway) < 7 ? 'Defensive masterclass expected. Strong starting pitching and neutral weather suggest a low-run game.' : 
                             'Standard scoring patterns projected. The outcome will likely hinge on bullpen performance in the late innings.'}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] relative z-10">
                            <Zap className="w-3 h-3 text-secondary" /> 
                            <span>Sharp Signal: {parseFloat(projectedHome) + parseFloat(projectedAway) > 8.5 ? 'OVER 8.5' : 'UNDER 8.5'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
