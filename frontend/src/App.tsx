/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';

import { PlayerModal } from './components/PlayerModal';
import { BattingLeaders as TeamLeaders } from './components/BattingLeaders';
import { LiveRoster } from './components/LiveRoster';
import { TeamTabs } from './components/TeamTabs';
import { TeamsPage } from './components/TeamsPage';
import { SchedulePage } from './components/SchedulePage';
import { PlayerPage } from './components/PlayerPage';
import { LeagueLeadersPage } from './components/LeagueLeadersPage';
import { LeaguePlayersPage } from './components/LeaguePlayersPage';
import { GamePage } from './components/GamePage';
import { HomePage } from './components/HomePage';
import { LiveTicker } from './components/LiveTicker';
import { useScoreboard } from './context/ScoreboardContext';
import { fetchTeams, fetchTeamStats, fetchTeamRoster, fetchTeamPitchingStats, fetchPaginatedTeamGames, fetchLiveTeamRoster, fetchTeamEspnData, fetchTeamDepthChart, fetchTeamLeaders, fetchTeamStanding } from './api';
import {
  LayoutDashboard,
  Trophy,
  ArrowLeftRight,
  Activity,
  Archive,
  Search,
  Users,
  Calendar,
  BarChart3,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  Award,
  ShieldCheck,
  Menu,
  ChevronDown
} from 'lucide-react';
import { motion } from 'motion/react';

// --- Types ---

interface PlayerStat {
  id: string;
  name: string;
  position: string;
  number: string;
  image: string;
  g: number;
  ab: number;
  r: number;
  h: number;
  hr: number;
  rbi: number;
  avg: string;
  ops: string;
}

interface GameResult {
  id: string;
  opponent: string;
  date: string;
  score: string;
  result: 'W' | 'L';
}

interface UpcomingGame {
  id: string;
  opponent: string;
  logo: string;
  location: string;
  time: string;
  dateRange?: string;
}

// --- Mock Data ---

const ROSTER_STATS: PlayerStat[] = [
  {
    id: '1',
    name: 'Marcus Vance',
    position: 'SS',
    number: '#12',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB0xvkJq2nWH30mtT9ZxbQofL9fKIQk_eUND1N0Wp20wxwxAWaXft3aeokIzlnsi0gw1AlFftobXdEGWQfSELQAfaaden2gwDGRpOYHlHdgH3z7KlEcN5a5ZS0FM8rZDyxHbZ4yvlNplsLc9wBTVu26_JnLkw6eCx6-SarZXQ6CYjlTDQDRsRskoUFx4zn-OXVphsY_rDIQ3UfZYZYI_1D4ee871jw-oXI44LcIDayXtZfLHSv7pCDUaArDGKQgy3Wf8uf6LX1eTRiu',
    g: 138,
    ab: 542,
    r: 94,
    h: 174,
    hr: 34,
    rbi: 102,
    avg: '.321',
    ops: '.984'
  },
  {
    id: '2',
    name: 'Jared Thorne',
    position: 'RF',
    number: '#27',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCDYo1aY6X9tHNZVgfF90bQZx_jljRWzWroJV3LJjejw9V1DcDRZS5y084xa1xdfYxdsUOkIaGWosz9GfoDekgwFcH9ettITiLTjnc5i7J9dtiYzYNlNRnbNAOSyl_fpX0qX_egFnmfGDpqFse2FffNkV75miqm8IH4bc_lrAmxK0R0Obh1WGYCGE_pm9yWHpKvg3y_MPccQ1UPPdhN7xifjfhT7qYunWAMdc62H6PUjrT_xspo5IwOU-S5AIHFehS-EP-ARDTpXRuh',
    g: 140,
    ab: 512,
    r: 88,
    h: 148,
    hr: 42,
    rbi: 118,
    avg: '.289',
    ops: '.956'
  },
  {
    id: '3',
    name: 'Leo Russo',
    position: '3B',
    number: '#5',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAbztDWRbxKNao6mmiALXFYXh7boqhv1G7-RtREmyZZvB5k_JvI_SgjET3RSaeV8SlgHnDfvih_Clqrs-x11J2HGdviVVuOngWEAkyvX_lLkuwndm6E4-HFR5L2Z29_Bjpkwx58C8LLHAed5CxipAI2DCBZIa3OcN4jYPEUXlhfqBUYmnCc8Ao5ABXam43ys6tOfzPgmNz4qZgoCpXP5rFnpPk-OnSMU21Kn1V8xqlJER3a9P3DyJpzbqExelNLRITg1SkrSsWAkhFM',
    g: 124,
    ab: 480,
    r: 72,
    h: 132,
    hr: 18,
    rbi: 74,
    avg: '.275',
    ops: '.812'
  }
];

const RECENT_RESULTS: GameResult[] = [
  { id: '1', opponent: 'vs Boston', date: 'Sept 14, 2024', score: '8 - 2', result: 'W' },
  { id: '2', opponent: 'vs Boston', date: 'Sept 13, 2024', score: '4 - 3', result: 'W' },
  { id: '3', opponent: 'at Toronto', date: 'Sept 11, 2024', score: '1 - 5', result: 'L' }
];

const UPCOMING_GAMES: UpcomingGame[] = [
  { 
    id: '1', 
    opponent: 'Seattle Mariners', 
    logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBoFOh6X0zXpqh-EMcVxSPxKR6kw3X-7EFSmai8aTLb62TqUbOiKXK25qFi9imTQwhz_GAlEN4GSrHNI24M5tCUC_PsZCTz1t2orQIl_mE-5CfFriuO_5couruOqWJwGG4a89RlS17Mc_OtbqR4lD4MXcm6oE4L1s2UaXWkn905QsSUkLKs06pwHwj3eX2h8vFYT9eXf8L8LqIsZJ3brvYt36uD56RMRBZ9V27FTdnHEx8PzuoMDLOnSUEWj7GoHTAE0o9qkQrT0Cdi',
    location: 'Empire Stadium',
    time: '7:05 PM ET'
  },
  { 
    id: '2', 
    opponent: 'Baltimore Orioles', 
    logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDOw9owk_N0y1DDMv8hl0QuwUSzczjuxVwkBIP2KxNFyMWUxgRIEjXlrYhA5xK7508u_TKTrrQIQAop-WUspWAi0oVUBTsI3SqByzuHxKpHKyF5Mfn8ClqUuuVtszzvxEc_h9cUCBXUjGDgq_9aeUOiH9Pq61Xq698RmHAKnwax1h1Dm2hcsBvx1frH408r0a-RkcaaGPAmCxFfuEbG1cqWLWB68_Kf_B44SSQvcDlwCoMurC80t6iZd3CB-61-lKgnjd-620C6q_0N',
    location: 'Oriole Park',
    time: '4 Games',
    dateRange: 'Sept 18 — Sept 21'
  }
];


// --- Components ---

const TopNav = () => {
  const navigate = useNavigate();
  return (
    <div className="w-full bg-[#002d62] text-white flex items-center px-6 h-12 shadow-sm relative z-40 gap-8 overflow-x-auto hide-scrollbar">
      <button 
        onClick={() => navigate('/teams')}
        className={`flex items-center gap-2 font-bold text-sm hover:text-secondary transition-colors whitespace-nowrap ${location.pathname.includes('/teams') ? 'text-secondary' : 'text-slate-300'}`}
      >
        <Activity className="w-4 h-4" />
        Teams
      </button>
      {[
        { label: 'Live Scores', icon: Activity, path: '/' },
        { label: 'League Leaders', icon: Trophy, path: '/leaders' },
        { label: 'Transactions', icon: ArrowLeftRight, path: '#' },
        { label: 'Injury Report', icon: Activity, path: '#' },
        { label: 'Archive', icon: Archive, path: '#' },
      ].map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button 
            key={item.label}
            onClick={() => { if(item.path !== '#') navigate(item.path); }}
            className={`flex items-center gap-2 font-bold text-sm hover:text-secondary transition-colors whitespace-nowrap ${isActive ? 'text-white border-b-2 border-secondary h-full' : 'text-slate-300'}`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

const Header = ({ selectedTeamId }: { selectedTeamId: number | null }) => {
  const navigate = useNavigate();
  const { displayDate, currentDate, changeDate, setDate } = useScoreboard();

  return (
  <header className="fixed top-0 z-50 w-full shadow-xl flex flex-col bg-primary">
    <div className="flex bg-primary items-center px-6 h-20 w-full gap-6">
      <div className="flex items-start gap-1 shrink-0 flex-col justify-center">
        <button onClick={() => navigate('/')} className="text-2xl font-black text-white tracking-tighter font-headline hover:text-secondary transition-colors leading-none">Statmaster</button>
        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">
          <button onClick={() => changeDate(-1)} className="hover:text-white p-0.5"><ChevronLeft className="w-3 h-3" /></button>
          <div className="relative group">
            <span className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors">{displayDate} <ChevronDown className="w-3 h-3" /></span>
            <input 
              type="date" 
              className="absolute inset-0 opacity-0 cursor-pointer" 
              value={`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`}
              onChange={(e) => {
                if (e.target.value) {
                  const [y, m, d] = e.target.value.split('-').map(Number);
                  setDate(new Date(y, m - 1, d));
                }
              }}
            />
          </div>
          <button onClick={() => changeDate(1)} className="hover:text-white p-0.5"><ChevronRight className="w-3 h-3" /></button>
        </div>
      </div>

      <LiveTicker />
      <div className="flex items-center gap-4 shrink-0">
        <div className="relative hidden sm:block">
          <input 
            className="bg-[#002d62] border-none text-white text-xs px-4 py-2 rounded-lg w-64 focus:ring-1 focus:ring-secondary transition-all outline-none" 
            placeholder="Search league..." 
            type="text"
          />
          <Search className="absolute right-3 top-2 w-4 h-4 text-slate-400" />
        </div>

        <button className="text-white hover:bg-[#002d62] p-2 rounded-full transition-all duration-200">
          <User className="w-6 h-6" />
        </button>
      </div>
    </div>
    <TopNav />
  </header>
  );
};

const HeroSection = ({ team, standing, seasons, selectedYear, onYearChange, espnRecords }: { team: any, standing: any, seasons: any[], selectedYear: number, onYearChange: (y: number) => void, espnRecords?: any }) => {
  const getRankSuffix = (rank: number) => {
    if (!rank) return '';
    const j = rank % 10, k = rank % 100;
    if (j == 1 && k != 11) return "ST";
    if (j == 2 && k != 12) return "ND";
    if (j == 3 && k != 13) return "RD";
    return "TH";
  };

  return (
  <section className="max-w-7xl mx-auto mb-16 relative overflow-hidden rounded-xl p-8 md:p-12 text-white" style={{ backgroundColor: `#${team.color || '00193c'}` }}>
    <div className="absolute inset-0 opacity-20">
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent"></div>
      <img 
        className="w-full h-full object-cover grayscale mix-blend-multiply" 
        src="https://lh3.googleusercontent.com/aida-public/AB6AXuCdO7Pyv58VNhyTxUenv1Agv-9QnA4eckzwFpe1EOdOtpaGJy7Y3kZcJvlAFnG3foorWjUZbl6M18vdwj71UHZUKmvH2blkWiVkLU2Dk0v57rUU4Nkgj-VnWFhDElYChGAUeEDK46cGLMgje-PTik6vD3zRAvWIYkaAELBw4j9ZFS30hgO4NbvEhadMacsxOlWn11B9nPGvcHa6AJiPT4ZK05h6uxH_WnOEHS-YRhJced_nUPlWIw2hCfUTe3y2E5VgZgAMcXMuxe2q" 
        alt="Stadium"
        referrerPolicy="no-referrer"
      />
    </div>
    <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
      <div>
        <span className="inline-block bg-black/30 px-3 py-1 text-[10px] font-black tracking-widest uppercase mb-4 border border-white/20">
          {standing?.division_name || 'MLB FRANCHISE'}
        </span>
        <h1 className="text-5xl md:text-7xl font-headline font-black tracking-tighter uppercase leading-none mt-2 drop-shadow-lg">
          {team.location} <br/><span style={{ color: `#${team.alternate_color || 'ffffff'}` }}>{team.name}</span>
        </h1>
        
        <div className="mt-8 flex gap-10">
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-70">Season Record</p>
            <p className="text-3xl font-headline font-black tabular-nums">{standing ? `${standing.wins} — ${standing.losses}` : '0 — 0'}</p>
          </div>
          {standing?.division_rank && (
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-70">League Rank</p>
              <p className="text-3xl font-headline font-black">{standing.division_rank}<span className="text-sm align-top">{getRankSuffix(standing.division_rank)}</span></p>
            </div>
          )}
          {standing?.streak && standing.streak !== 'None' && (
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-70">Streak</p>
              <p className={`text-3xl font-headline font-black ${standing.streak.includes('W') ? 'text-emerald-400' : 'text-rose-400'}`}>
                {standing.streak}
              </p>
            </div>
          )}
        </div>

        {seasons && seasons.length > 0 && (
          <div className="mt-8">
            <select 
              className="bg-black/20 text-white border border-white/20 px-4 py-2 rounded-lg outline-none font-bold cursor-pointer hover:bg-black/40 transition-colors"
              value={selectedYear}
              onChange={(e) => onYearChange(Number(e.target.value))}
            >
              {seasons.map((s: any) => (
                <option key={s.season_year} value={s.season_year} className="text-black">{s.display_name} Season</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="hidden xl:block">
        <div className="w-72 h-72 opacity-50 drop-shadow-2xl mix-blend-screen -mr-8">
            <img src={`https://a.espncdn.com/i/teamlogos/mlb/500/${team.abbreviation.toLowerCase()}.png`} className="w-full h-full object-contain" alt="logo" />
        </div>
      </div>
    </div>
  </section>
  );
};

const StatsGrid = ({ stats }: { stats: any }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {[
      { label: 'Team AVG', value: stats?.team_avg || '.000', sub: 'Batting Avg', icon: TrendingUp },
      { label: 'Total Hits', value: stats?.total_hits || '0', sub: 'Season Total', icon: Award },
      { label: 'Home Runs', value: stats?.total_hr || '0', sub: 'Season Total', icon: ShieldCheck },
      { label: 'Runs Scored', value: stats?.total_runs || '0', sub: 'Offensive Prod', icon: LayoutDashboard },
    ].map((stat) => (
      <div key={stat.label} className="bg-white p-6 rounded-xl border-b-2 border-primary shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{stat.label}</p>
        <p className="text-3xl font-headline font-black text-primary">{stat.value}</p>
        <span className="text-xs text-emerald-600 font-bold">{stat.sub}</span>
      </div>
    ))}
  </div>
);

const TeamRecords = ({ espnRecords }: { espnRecords: any }) => {
  if (!espnRecords || !espnRecords.records || espnRecords.records.length === 0) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      {espnRecords.records.map((r: any) => (
        <div key={r.type} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
           <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{r.description}</span>
           <span className="text-3xl font-headline font-black text-primary">{r.summary}</span>
        </div>
      ))}
    </div>
  );
};

const RosterTable = ({ battingRoster, pitchingRoster, onPlayerClick }: { battingRoster: any[], pitchingRoster: any[], onPlayerClick: (p: any) => void }) => {
  const [view, setView] = useState<'batting' | 'pitching'>('batting');
  
  // Filter out empty rows (Pitchers with 0 ABs, or Hitters with 0 IPs)
  const activeBatters = battingRoster.filter(p => p.ab > 0 || p.g > 0);
  const activePitchers = pitchingRoster.filter(p => p.ip && p.ip !== "0" && p.ip !== "0.0");
  
  return (
  <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200">
    <div className="bg-primary px-6 py-4 flex justify-between items-center">
      <h3 className="text-white font-headline font-bold uppercase tracking-wider text-sm">Active Roster Statistics</h3>
      <div className="flex gap-4">
        <button 
          onClick={() => setView('batting')}
          className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${view === 'batting' ? 'text-secondary' : 'text-white/50 hover:text-white'}`}
        >
          Batting
        </button>
        <button 
          onClick={() => setView('pitching')}
          className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${view === 'pitching' ? 'text-secondary' : 'text-white/50 hover:text-white'}`}
        >
          Pitching
        </button>
      </div>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          {view === 'batting' ? (
            <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
              <th className="px-6 py-4">Player</th>
              <th className="px-4 py-4 text-right">G</th>
              <th className="px-4 py-4 text-right">AB</th>
              <th className="px-4 py-4 text-right">R</th>
              <th className="px-4 py-4 text-right">H</th>
              <th className="px-4 py-4 text-right">HR</th>
              <th className="px-4 py-4 text-right">RBI</th>
              <th className="px-4 py-4 text-right">AVG</th>
              <th className="px-6 py-4 text-right">OPS</th>
            </tr>
          ) : (
            <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
              <th className="px-6 py-4">Pitcher</th>
              <th className="px-4 py-4 text-right">G</th>
              <th className="px-4 py-4 text-right">IP</th>
              <th className="px-4 py-4 text-right">H</th>
              <th className="px-4 py-4 text-right">R</th>
              <th className="px-4 py-4 text-right">ER</th>
              <th className="px-4 py-4 text-right">BB</th>
              <th className="px-4 py-4 text-right">K</th>
              <th className="px-6 py-4 text-right">ERA</th>
            </tr>
          )}
        </thead>
        <tbody className="divide-y divide-slate-100">
          {view === 'batting' && activeBatters.map((player) => (
            <tr key={`b_${player.athlete_id}`} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onPlayerClick(player)}>
              <td className="px-6 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-300 shadow-sm shrink-0 flex items-center justify-center text-primary font-black text-[10px]">
                  {player.headshot ? (
                    <img 
                      src={player.headshot} 
                      alt={player.display_name} 
                      className="w-full h-full object-cover object-top bg-white" 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                         e.currentTarget.onerror = null; // Prevent infinite loops if the fallback ALSO fails
                         e.currentTarget.src = 'https://a.espncdn.com/i/headshots/nophoto.png';
                      }}
                    />
                  ) : (
                    player.position || 'UN'
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-primary group-hover:text-secondary truncate max-w-[120px]" title={player.full_name}>{player.display_name}</p>
                </div>
              </td>
              <td className="px-4 py-4 text-right tabular-nums text-sm font-medium">{player.g}</td>
              <td className="px-4 py-4 text-right tabular-nums text-sm font-medium">{player.ab || '0'}</td>
              <td className="px-4 py-4 text-right tabular-nums text-sm font-medium">{player.r || '0'}</td>
              <td className="px-4 py-4 text-right tabular-nums text-sm font-medium">{player.h || '0'}</td>
              <td className="px-4 py-4 text-right tabular-nums text-sm font-black">{player.hr || '0'}</td>
              <td className="px-4 py-4 text-right tabular-nums text-sm font-medium">{player.rbi || '0'}</td>
              <td className="px-4 py-4 text-right tabular-nums text-sm font-bold">{player.avg || '.000'}</td>
              <td className="px-6 py-4 text-right tabular-nums text-sm font-black text-primary">{player.ops || '.000'}</td>
            </tr>
          ))}
          {view === 'pitching' && activePitchers.map((player) => (
            <tr key={`p_${player.athlete_id}`} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onPlayerClick(player)}>
              <td className="px-6 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-300 shadow-sm shrink-0 flex items-center justify-center text-primary font-black text-[10px]">
                  {player.headshot ? (
                    <img 
                      src={player.headshot} 
                      alt={player.display_name} 
                      className="w-full h-full object-cover object-top bg-white" 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                         e.currentTarget.onerror = null; // Prevent infinite loops if the fallback ALSO fails
                         e.currentTarget.src = 'https://a.espncdn.com/i/headshots/nophoto.png';
                      }}
                    />
                  ) : (
                    player.position || 'UN'
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-primary group-hover:text-secondary truncate max-w-[120px]" title={player.full_name}>{player.display_name}</p>
                </div>
              </td>
              <td className="px-4 py-4 text-right tabular-nums text-sm font-medium">{player.g}</td>
              <td className="px-4 py-4 text-right tabular-nums text-sm font-black">{player.ip}</td>
              <td className="px-4 py-4 text-right tabular-nums text-sm font-medium">{player.h || '0'}</td>
              <td className="px-4 py-4 text-right tabular-nums text-sm font-medium">{player.r || '0'}</td>
              <td className="px-4 py-4 text-right tabular-nums text-sm font-medium">{player.er || '0'}</td>
              <td className="px-4 py-4 text-right tabular-nums text-sm font-medium">{player.bb || '0'}</td>
              <td className="px-4 py-4 text-right tabular-nums text-sm font-bold">{player.k || '0'}</td>
              <td className="px-6 py-4 text-right tabular-nums text-sm font-black text-primary">{player.era}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
}

const RecentForm = ({ games = [], teamId, page, meta, onPageChange, isFullPage = false }: { games: any[], teamId: number, page: number, meta: any, onPageChange: (p: number) => void, isFullPage?: boolean }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col ${isFullPage ? '' : 'h-full'}`}>
    <div className="bg-primary px-6 py-4">
      <h3 className="text-white font-headline font-black uppercase tracking-wider text-sm">Schedule & Results</h3>
    </div>
    
    <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
      {(games?.length || 0) === 0 && (
        <div className="p-8 text-center text-slate-500 text-sm font-bold">No games scheduled for this period.</div>
      )}
      
      {(games || []).map((game) => {
        const isWin = game.winner;
        // If team_score is null, it hasn't been played yet
        const isScheduled = game.team_score === null;
        
        const isHome = game.location === 'home';
        const locationPrefix = isHome ? 'vs' : '@';
        
        // Ensure opponent_abbreviation exists safely
        const oppAbbr = game.opponent_abbreviation ? game.opponent_abbreviation.toLowerCase() : 'mlb';
        const logoUrl = `https://a.espncdn.com/i/teamlogos/mlb/500/${oppAbbr}.png`;
        
        // Ensure we treat the incoming database string as UTC by appending 'Z' if it's missing
        const dateString = game.date.endsWith('Z') ? game.date : `${game.date}Z`;
        const dateObj = new Date(dateString);
        
        // Use local timezone formatting to match the Upcoming game logic
        const fullDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        
        const seasonType = (game.season_type_name || '').replace(' Season', '');
        
        return (
          <div key={game.event_id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-start justify-center min-w-[80px]">
                <span className="text-xs font-bold text-primary">{fullDate}</span>
                {isScheduled && <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{timeStr}</span>}
              </div>
              
              <div className="w-8 h-8 shrink-0">
                <img src={logoUrl} alt={game.opponent_abbreviation} className="w-full h-full object-contain" />
              </div>
              
              <div>
                <p className="text-sm font-bold text-primary">
                  <span className="text-slate-400 font-medium mr-1">{locationPrefix}</span>
                  {game.opponent_abbreviation || game.opponent_name}
                </p>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  {seasonType} • {isScheduled ? timeStr : 'FINAL'}
                </p>
              </div>
            </div>
            
            <div className="text-right">
              {isScheduled ? (
                 <span className="text-xs font-bold text-slate-400">TBD</span>
              ) : (
                <div className="flex items-center gap-2 justify-end">
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isWin ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {isWin ? 'W' : 'L'}
                  </span>
                  <span className="text-sm font-black text-primary tabular-nums">
                    {game.team_score} - {game.opponent_score}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
    
    {/* Only show pagination controls if there is actually more than 1 page! */}
    {meta && meta.total_pages > 1 && (
      <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex justify-between items-center mt-auto">
        <button 
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="p-1.5 rounded bg-white border border-slate-200 text-primary hover:bg-slate-100 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Page {page} of {meta.total_pages}
        </span>
        <button 
          disabled={page >= meta.total_pages}
          onClick={() => onPageChange(page + 1)}
          className="p-1.5 rounded bg-white border border-slate-200 text-primary hover:bg-slate-100 disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    )}
  </div>
);

const UpcomingSeries = ({ nextGame }: { nextGame: any }) => {
  if (!nextGame) {
    return (
      <div className="bg-[#002d62] rounded-xl p-6 text-white overflow-hidden relative h-32 flex items-center justify-center opacity-80">
        <div className="absolute inset-0 bg-slate-900/50 flex flex-col items-center justify-center">
          <CalendarIcon className="w-8 h-8 opacity-50 mb-2" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-300">No Scheduled Games</p>
        </div>
      </div>
    );
  }

  const dateObj = new Date(nextGame.date.endsWith('Z') ? nextGame.date : `${nextGame.date}Z`);
  // Use the browser's local timezone for the Upcoming Game so fans know when to watch!
  const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const locationPrefix = nextGame.is_home ? 'vs' : '@';

  return (
    <div className="bg-[#002d62] rounded-xl p-6 text-white overflow-hidden relative shadow-lg">
      <div className="absolute -top-4 -right-4 p-4 opacity-10">
        <CalendarIcon className="w-32 h-32" />
      </div>
      <h3 className="font-headline font-black uppercase tracking-wider text-xs mb-6 text-slate-300">Up Next</h3>
      
      <div className="relative z-10">
        <p className="text-[10px] uppercase font-bold text-secondary mb-2">{dateStr}</p>
        
        <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10 mt-4 group cursor-pointer hover:bg-white/10 transition-colors">
          <div className="w-12 h-12 shrink-0 bg-white rounded-full p-2">
            <img 
              className="w-full h-full object-contain" 
              src={nextGame.opponent_logo} 
              alt={nextGame.opponent_abbreviation} 
              referrerPolicy="no-referrer" 
            />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-300">{locationPrefix} {nextGame.opponent_abbreviation}</p>
            <p className="text-lg font-black font-headline tracking-tight">{nextGame.opponent_name}</p>
            <p className="text-[10px] opacity-70 mt-1 font-medium tracking-wider">
              {timeStr} {new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).format(dateObj).split(' ')[1]} • {nextGame.venue_name || 'TBD Stadium'}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 ml-auto text-slate-400 group-hover:text-white transition-colors" />
        </div>
      </div>
    </div>
  );
};

const DiamondArchitecture = ({ depthChart, teamColor, onPlayerClick }: { depthChart: any, teamColor: string, onPlayerClick?: (p: any) => void }) => {
  // We grab the starters safely
  const lf = depthChart['LF'];
  const cf = depthChart['CF'];
  const rf = depthChart['RF'];
  const ss = depthChart['SS'];
  const second = depthChart['2B'];
  const third = depthChart['3B'];
  const first = depthChart['1B'];
  const p = depthChart['P'] || depthChart['SP'] || depthChart['RP'];
  const c = depthChart['C'];

  const PlayerPin = ({ player, pos, top, left, right, bottom, featured = false }: any) => {
    if (!player) return null;
    
    // Convert right/bottom props to proper CSS if they exist
    const style: any = { top };
    if (left) style.left = left;
    if (right) style.right = right;
    if (bottom) {
        delete style.top;
        style.bottom = bottom;
    }

    return (
      <div className="absolute flex flex-col items-center z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-auto" style={style}>
        <div 
          onClick={() => onPlayerClick && onPlayerClick({ ...player, full_name: player.name })}
          className={`rounded-full bg-white border-4 p-1 shadow-lg group hover:scale-110 transition-transform cursor-pointer ${featured ? 'w-20 h-20' : 'w-16 h-16'}`}
          style={{ borderColor: `#${teamColor || 'b80a2e'}` }}
        >
          <img 
            src={player.headshot || 'https://a.espncdn.com/i/headshots/nophoto.png'} 
            alt={player.name} 
            className="w-full h-full rounded-full object-contain bg-white" 
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://a.espncdn.com/i/headshots/nophoto.png'; }}
          />
        </div>
        <p className="mt-2 text-[10px] font-black text-white px-2 py-0.5 rounded shadow-sm" style={{ backgroundColor: `#${teamColor || 'b80a2e'}` }}>
          {pos}
        </p>
        <p className={`text-[10px] bg-white/80 px-2 py-0.5 rounded-full mt-1 ${featured ? 'font-bold text-primary' : 'font-medium text-slate-700'}`}>
          {player.name}
        </p>
      </div>
    );
  };

  return (
    <section className="max-w-7xl mx-auto mt-16">
      <div className="mb-8">
        <h2 className="text-3xl font-headline font-black text-primary uppercase tracking-tighter">Diamond Architecture</h2>
        <p className="text-slate-500 font-medium">The official starting depth chart for the current season.</p>
      </div>
      <div className="relative w-full aspect-[16/10] rounded-3xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50">
        {/* The Field */}
        <div className="absolute inset-0 w-full h-full flex items-center justify-center p-8">
          <svg className="w-full h-full drop-shadow-sm" preserveAspectRatio="xMidYMid meet" viewBox="0 0 800 500">
            {/* Outfield Grass */}
            <path d="M 100,205 C 200,-20 600,-20 700,205 L 400,430 Z" fill="#e2f1e6" stroke="#c0d7c5" strokeWidth="2"></path>
            {/* Dirt Paths */}
            <path d="M 400,130 L 600,280 L 400,430 L 200,280 Z" fill="none" stroke="#dcc5a1" strokeLinejoin="round" strokeWidth="24"></path>
            {/* Infield Grass */}
            <path d="M 400,155 L 565,280 L 400,405 L 235,280 Z" fill="#d4e7d8" stroke="#b0c7b5" strokeWidth="1"></path>
            {/* Bases */}
            <rect fill="white" height="16" stroke="#ccc" transform="rotate(45 400 130)" width="16" x="392" y="122"></rect> 
            <rect fill="white" height="16" stroke="#ccc" transform="rotate(45 600 280)" width="16" x="592" y="272"></rect> 
            <rect fill="white" height="16" stroke="#ccc" transform="rotate(45 200 280)" width="16" x="192" y="272"></rect> 
            {/* Home Plate Area */}
            <circle cx="400" cy="430" fill="#dcc5a1" r="24"></circle> 
            {/* Home Plate */}
            <path d="M 392,422 L 408,422 L 408,432 L 400,440 L 392,432 Z" fill="white"></path> 
            {/* Pitcher's Mound */}
            <circle cx="400" cy="290" fill="#dcc5a1" r="22"></circle>
            <rect fill="white" height="4" width="24" x="388" y="288"></rect>
          </svg>
        </div>

        {/* Players Overlay */}
        <div className="absolute inset-0 w-full h-full pointer-events-none p-8 flex justify-center">
          {/* Lock overlay to a wider max-width to allow the fielders to stretch into standard depths */}
          <div className="relative w-full max-w-[1000px] h-full">
            {/* Outfielders: Deeper and wider */}
            <PlayerPin player={lf} pos="LF" top="28%" left="18%" />
            <PlayerPin player={cf} pos="CF" top="18%" left="50%" />
            <PlayerPin player={rf} pos="RF" top="28%" left="82%" />
            
            {/* Middle Infielders: Pushed back into the actual dirt path */}
            <PlayerPin player={ss} pos="SS" top="42%" left="37%" />
            <PlayerPin player={second} pos="2B" top="42%" left="63%" />
            
            {/* Corner Infielders: Placed directly over the white bases */}
            <PlayerPin player={third} pos="3B" top="62%" left="22%" />
            <PlayerPin player={first} pos="1B" top="62%" left="78%" />
            
            {/* Battery: Pitcher directly over the mound, catcher over the plate */}
            <PlayerPin player={p} pos="P" top="60%" left="50%" featured={true} />
            <PlayerPin player={c} pos="C" top="93%" left="50%" />
          </div>
        </div>
      </div>
    </section>
  );
};

const Footer = () => (
  <footer className="bg-surface w-full py-12 px-8 flex flex-col md:flex-row justify-between items-center gap-6 border-t border-slate-200 mt-16">
    <div className="flex flex-col gap-2">
      <span className="text-sm font-black text-primary font-headline uppercase tracking-tight">Statmaster Editorial</span>
      <p className="text-xs uppercase tracking-widest text-slate-500">© 2024 The Statmaster’s Editorial. Data as a prestige asset.</p>
    </div>
    <div className="flex flex-wrap justify-center gap-8">
      {['Privacy Policy', 'Terms of Service', 'Data Methodology', 'API Access'].map((link) => (
        <a 
          key={link}
          className="text-xs uppercase tracking-widest text-slate-500 hover:text-primary transition-opacity underline decoration-secondary decoration-2 underline-offset-4" 
          href="#"
        >
          {link}
        </a>
      ))}
    </div>
  </footer>
);

// --- Main App ---



import { fetchSeasons } from './api';

const TeamDashboard = ({ teams }: { teams: any[] }) => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const selectedTeamId = Number(teamId);
  const selectedTeam = teams.find(t => t.team_id === selectedTeamId);
  
  const [searchParams, setSearchParams] = useSearchParams();

  const [teamStats, setTeamStats] = useState<any>(null);
  const [battingRoster, setBattingRoster] = useState<any[]>([]);
  const [pitchingRoster, setPitchingRoster] = useState<any[]>([]);
  const [recentGames, setRecentGames] = useState<any[]>([]);
  const [gamesMeta, setGamesMeta] = useState<any>(null);
  const [liveRoster, setLiveRoster] = useState<any[]>([]);
  const [nextGame, setNextGame] = useState<any>(null);
  const [espnRecords, setEspnRecords] = useState<any>(null);
  const [depthChart, setDepthChart] = useState<any>({});
  const [teamLeaders, setTeamLeaders] = useState<any[]>([]);
  const [teamStanding, setTeamStanding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  
  // Read state from URL parameters or fall back to defaults
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('tab') || 'overview');
  const [selectedYear, setSelectedYear] = useState<number>(Number(searchParams.get('year')) || new Date().getFullYear());
  const [selectedSeasonType, setSelectedSeasonType] = useState<string>(searchParams.get('type') || 'All');
  const [gamesPage, setGamesPage] = useState<number>(Number(searchParams.get('page')) || 1);

  // Sync state changes back to the URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab !== 'overview') params.set('tab', activeTab);
    if (selectedYear !== new Date().getFullYear()) params.set('year', selectedYear.toString());
    if (selectedSeasonType !== 'All') params.set('type', selectedSeasonType);
    if (gamesPage > 1) params.set('page', gamesPage.toString());
    setSearchParams(params, { replace: true });
  }, [activeTab, selectedYear, selectedSeasonType, gamesPage, setSearchParams]);

  useEffect(() => {
    async function loadSeasons() {
      try {
        const s = await fetchSeasons();
        setSeasons(s);
        if (s.length > 0 && !searchParams.get('year')) {
          setSelectedYear(s[0].season_year);
        }
      } catch(e) {}
    }
    loadSeasons();
  }, []);
  
  // (Removed automated page reset side-effect to support deep-linking)

  useEffect(() => {
    async function loadTeamData() {
      if (!selectedTeamId) return;
      setLoading(true);
      try {
        const [stats, batData, pitchData, gamesResponse, liveRosterData, espnData, depthData, leadersData, standingData] = await Promise.all([
          fetchTeamStats(selectedTeamId, selectedYear, selectedSeasonType),
          fetchTeamRoster(selectedTeamId, selectedYear, selectedSeasonType),
          fetchTeamPitchingStats(selectedTeamId, selectedYear, selectedSeasonType),
          fetchPaginatedTeamGames(selectedTeamId, selectedYear, gamesPage, 200, selectedSeasonType),
          fetchLiveTeamRoster(selectedTeamId),
          fetchTeamEspnData(selectedTeamId),
          fetchTeamDepthChart(selectedTeamId),
          fetchTeamLeaders(selectedTeamId, selectedYear, selectedSeasonType),
          fetchTeamStanding(selectedTeamId, selectedYear)
        ]);
        setTeamStats(stats);
        setBattingRoster(batData);
        setPitchingRoster(pitchData);
        setRecentGames(gamesResponse.data);
        setGamesMeta(gamesResponse.meta);
        setLiveRoster(liveRosterData);
        setNextGame(espnData.next_game);
        setEspnRecords(espnData);
        setDepthChart(depthData);
        setTeamLeaders(leadersData);
        setTeamStanding(standingData);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    loadTeamData();
  }, [selectedTeamId, gamesPage, selectedYear, selectedSeasonType]);
  
  if (loading || !selectedTeam) {
    return <div className="min-h-screen bg-surface flex items-center justify-center font-headline font-black text-2xl text-primary">LOADING DASHBOARD...</div>;
  }
  
  return (
    <>
      <Header selectedTeamId={selectedTeamId} />
      <main className="pt-36 px-6 pb-12 transition-all duration-300">        <HeroSection team={selectedTeam} standing={teamStanding} seasons={seasons} selectedYear={selectedYear} onYearChange={setSelectedYear} espnRecords={espnRecords} />
        <div className="max-w-7xl mx-auto">
          <TeamTabs activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
              <div className="lg:col-span-2 space-y-8">
                <TeamRecords espnRecords={espnRecords} />
                <StatsGrid stats={teamStats} />
                <TeamLeaders leaders={teamLeaders} onPlayerClick={setSelectedPlayer} />
              </div>
              <div className="space-y-8 flex flex-col">
                <div className="h-[400px]">
                  <RecentForm games={activeTab === 'overview' ? recentGames.slice(0, 5) : recentGames} teamId={selectedTeamId} page={gamesPage} meta={gamesMeta} onPageChange={setGamesPage} />
                </div>
                <UpcomingSeries nextGame={nextGame} />
              </div>
            </div>
          )}
          {activeTab === 'roster' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
              <div className="lg:col-span-2">
                 <RosterTable battingRoster={battingRoster} pitchingRoster={pitchingRoster} onPlayerClick={setSelectedPlayer} />
              </div>
              <div>
                 <LiveRoster roster={liveRoster} onPlayerClick={setSelectedPlayer} />
              </div>
            </div>
          )}
          
          {activeTab === 'schedule' && (
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-end mb-4">
                  <select 
                    className="bg-white border border-slate-200 text-primary px-4 py-2 rounded-lg outline-none font-bold cursor-pointer shadow-sm text-sm"
                    value={selectedSeasonType}
                    onChange={(e) => {
                      setSelectedSeasonType(e.target.value);
                      setGamesPage(1);
                    }}
                  >
                    <option value="All">All Games</option>
                    <option value="Preseason">Spring Training</option>
                    <option value="Regular Season">Regular Season</option>
                    <option value="Postseason">Postseason</option>
                  </select>
                </div>
                <div className="h-auto">
                  <RecentForm games={recentGames} teamId={selectedTeamId} page={gamesPage} meta={gamesMeta} onPageChange={setGamesPage} isFullPage={true} />
                </div>
            </div>
          )}

          {activeTab === 'stats' && (
             <div className="opacity-50 text-center py-20 font-headline font-black text-2xl">
               DEEP STATS DASHBOARD COMING SOON
             </div>
          )}
        </div>
        
        {activeTab === 'overview' && <DiamondArchitecture depthChart={depthChart} teamColor={selectedTeam?.color} onPlayerClick={setSelectedPlayer} />}
      </main>
      <Footer />
      <PlayerModal isOpen={!!selectedPlayer} player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </>
  );
};



const AppContent = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function init() {
      try {
        // Fetch teams for the most recent valid season dynamically (e.g. 2026)
        const s = await fetchSeasons();
        const latestYear = s.length > 0 ? s[0].season_year : 2024;
        
        const teamsData = await fetchTeams(latestYear);
        setTeams(teamsData);
      } catch (e) {
        console.error(e);
      }
    }
    init();
  }, []);

  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={
          <>
            <Header selectedTeamId={null} />
            <main className="pt-36 transition-all duration-300">
              <HomePage />
            </main>
            <Footer />
          </>
        } />
        <Route path="/teams" element={
          <>
            <Header selectedTeamId={null} />
            <main className="pt-36 px-6 pb-12 transition-all duration-300">
              <TeamsPage teams={teams} onSelectTeam={(id) => navigate(`/teams/${id}`)} />
            </main>
            <Footer />
          </>
        } />
        <Route path="/teams/:teamId" element={<TeamDashboard teams={teams} />} />
        <Route path="/schedule" element={
          <>
            <Header selectedTeamId={null} />
            <main className="pt-36 px-6 pb-12 transition-all duration-300">
              <SchedulePage />
            </main>
            <Footer />
          </>
        } />
        <Route path="/players/:playerId" element={
          <>
            <Header selectedTeamId={null} />
            <main className="pt-36 px-6 pb-12 transition-all duration-300">
              <PlayerPage />
            </main>
            <Footer />
          </>
        } />
        <Route path="/leaders" element={
          <>
            <Header selectedTeamId={null} />
            <main className="pt-36 px-6 pb-12 transition-all duration-300">
              <LeagueLeadersPage />
            </main>
            <Footer />
          </>
        } />
        <Route path="/leaders/players" element={
          <>
            <Header selectedTeamId={null} />
            <main className="pt-36 px-6 pb-12 transition-all duration-300">
              <LeaguePlayersPage />
            </main>
            <Footer />
          </>
        } />
        <Route path="/games/:gameId" element={
          <>
            <Header selectedTeamId={null} />
            <main className="pt-36 px-6 pb-12 transition-all duration-300">
              <GamePage />
            </main>
            <Footer />
          </>
        } />
      </Routes>
    </div>
  );
};

export default function App() {
  return <AppContent />;
}
