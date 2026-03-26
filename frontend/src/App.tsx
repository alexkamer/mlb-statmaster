/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';

import { PlayerModal } from './components/PlayerModal';
import { BattingLeaders } from './components/BattingLeaders';
import { LiveRoster } from './components/LiveRoster';
import { TeamTabs } from './components/TeamTabs';
import { TeamsPage } from './components/TeamsPage';
import { SchedulePage } from './components/SchedulePage';
import { fetchTeams, fetchTeamStats, fetchTeamRoster, fetchTeamPitchingStats, fetchPaginatedTeamGames, fetchLiveTeamRoster } from './api';
import { 
  LayoutDashboard, 
  Trophy, 
  ArrowLeftRight, 
  Activity, 
  Archive, 
  Search, 
  User, 
  ChevronRight,
  ChevronLeft, 
  Calendar as CalendarIcon,
  TrendingUp,
  Award,
  ShieldCheck
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

const FIELD_PLAYERS = [
  { pos: 'LF', name: 'M. Brantley', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA_dEDB7nOo7H4mLTGWIGJxdpWeMf9lNICMAjtgKcZSQyjZKbA8gOaWDTBj-Qw0X8YNWL25P69VVWyRlcbxYXcZFrwbvfu7MrFYz-Lf8-J_58I-20qLd2cEAMNrEE6rsLx5juiENksUzN1AWtLDra4wtq8jh2K1jr_VhF_4pAy-SFy038vlFEeqUcJTDAepWeokd56knkazunY3e03OwoQNqNCv66HV5ZYiq-4DiPtyPX6DuCSHUU1mT4ixstJgW2Kr4hlNOekJFIVC', grid: 'col-start-1 row-start-1' },
  { pos: 'CF', name: 'H. Bader', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAEyFm9jZ4DHWCje97-_T7TbQf3juNALDqc7zr_mbgLa-st7V-OGTCtT6l2GhlCl5POnRt0D4a4u2tsdm0NFyys_kM1SYokaTK0DzhfegqHlrOmfW46CTUhi2eos5avMVFcTH9B9qPmt5Y30MI-gx1ElomIHQmjNBqv5YB5tAq2kzjhI0CIpKkS0322SSUXi6OAvza--TMELpN6fvmeSjFv-2ZC554kGYogjkCG7-OCyEMXnYPBLiCSD_OeyATpUT8RN3YBECaNhmQj', grid: 'col-start-3 row-start-1' },
  { pos: 'RF', name: 'J. Thorne', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDX4AZxkuAqwpPyfftgG6APO5M0zPBXE0zPrCtSQhIx8ItmDoIRw5yDXMy-T4yUcge3YXRKe_NmqSwPsOkeVO2Iq16jfUduiPlvmg31T8fzfJ91FSfICA7EdMjT2FQpernk2i25Tm2lRB-gVa3knAIkzK29h7b3ULhSUBDpcP8PIidz9cs0qaSzrB9aYhqS_2FUeCdq-mYJTmw1PNkmBf2c5m8A9xKziz0cE5kAzx42peD6bHUF5wsChi5VvokteNr_AFufFamNSXS0', grid: 'col-start-5 row-start-1' },
  { pos: 'SS', name: 'M. Vance', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCZ69OaQdss4yF1xKSBOQIq1tBhFgaxGtHusEPuDq7f81GDu5Hiqek7C85uvNiyp6uTUyFEj5GIpZKksP9vpfh4Oot-UGIAvgFfe8Dl0Xg7tmzWfBuIhpfzKfq-UxHA86BmsFSGtwQBQ8Hta_UdHxAdHgdWs7IRR178n2_zH9dAk-mNhrqDK637T913ZW2LGfFDk9ERBhAarAyHaZXjKDUdw7jvR4sA-Uo3n1Jvgfe5qbyo1eBNWYnebd9ys__rtSag7TZLNlT6fEuj', grid: 'col-start-2 row-start-2' },
  { pos: '2B', name: 'G. Torres', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDYO_lcH-Rq05jZ2phROHr7qwAlyRJ8NhOyYHlZdLkHrJSHCPDCFcTrnVvGs1Y_tWabf7JpZxlHVnXN_sD5kqR_jGjagWBTH7Nlb7BoqFeo1V25ZPjWwlWix6yBAzhs4EYHHeFn1ivNOrLp4vUNWH701y56tsb0ifWqdaSOBK4Ag_DRtjUPAkdgoEzf-detUG-2BA7xnNpPvBxp7JIueZZhzNzbdeaUJYQPNv0loFf9YKaOqzrqyClfJJP61RoRQAqOXFI_9m6edWl9', grid: 'col-start-4 row-start-2' },
  { pos: 'P', name: 'G. Cole', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBzI3boJJyliXaTb0WgUsroFcy2xCbzLNVRALVIVHjTgc0wpRizvhgiGeiTfRw2hwxm_RAwhq3rZRt_pmdMw_FOGu1NIESnF1i8q-mU1rjILU_52g3lF94-XL4Xqj-W17VXfxswShw6KfUeQ1HXYuOWOObuoqaMydvKVmsGo4uDL1HyABVNepkOkUMpwjW0hmc4ShMUm2VEZtlWO6pkBZcEKRs86AlVdyHto6R53M6wii029w1zaTKf67M5Octu8Ixne5sb8ozK6Tkm', grid: 'col-start-3 row-start-3', featured: true },
  { pos: 'C', name: 'A. Wells', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCpuH0jG0Srlk0QAp5Ng6ZCWZNSw33qDIoLrAdWnivXWLOctCbL6lX789o4uTSmzn2Bi9w5iWb50rXTWd6ahRPl3lBBZiAwhWGA7ORiIQDQbwb3gMe0WSOe4kGR-D8gPyoMSgwIaPvD94XYkBmgB7svBIQY0i2uGlid1uBJN2yNLhrWV2uhUu_wQ-f_oS8A8-JdjxwDG1ah4HthROITh0tuC98dM2bWBeOjPRWwqQ-G_eSlsgfVdDOoUo2d0Jy68l8fNOZDmMOtxL3b', grid: 'col-start-3 row-start-4' },
];

// --- Components ---

const Header = ({ teams, selectedTeamId, onSelectTeam }: { teams: any[], selectedTeamId: number | null, onSelectTeam: (id: number) => void }) => {
  const navigate = useNavigate();
  return (
  <header className="bg-primary flex justify-between items-center w-full px-6 h-16 fixed top-0 z-50 shadow-xl">
    <div className="flex items-center gap-8">
      <button onClick={() => navigate('/teams')} className="text-2xl font-black text-white tracking-tighter font-headline hover:text-secondary transition-colors">Statmaster</button>
      <nav className="hidden md:flex gap-6 items-center h-full">
        <button 
          onClick={() => navigate('/teams')}
          className={`font-headline font-black tracking-tight uppercase transition-colors text-sm ${!selectedTeamId ? 'text-white border-b-2 border-secondary pb-1' : 'text-slate-300 hover:text-white'}`}
        >
          Teams
        </button>

      </nav>
    </div>
    <div className="flex items-center gap-4">
      <div className="relative hidden sm:block">
        <input 
          className="bg-[#002d62] border-none text-white text-xs px-4 py-2 rounded-lg w-64 focus:ring-1 focus:ring-secondary transition-all outline-none" 
          placeholder="Search league..." 
          type="text"
        />
        <Search className="absolute right-3 top-2 w-4 h-4 text-slate-400" />
      </div>
      <select 
        className="bg-[#002d62] text-white text-xs px-3 py-2 rounded-lg outline-none font-bold cursor-pointer border border-white/10"
        value={selectedTeamId || ''}
        onChange={(e) => onSelectTeam(Number(e.target.value))}
      >
        {teams.map(t => (
          <option key={t.team_id} value={t.team_id}>{t.display_name}</option>
        ))}
      </select>
      <button className="text-white hover:bg-[#002d62] p-2 rounded-full transition-all duration-200">
        <User className="w-6 h-6" />
      </button>
    </div>
  </header>
  );
};

const Sidebar = ({ isVisible }: { isVisible: boolean }) => { if (!isVisible) return null; return (
  <aside className="bg-surface h-screen w-64 border-r-0 fixed left-0 top-16 h-[calc(100vh-4rem)] hidden lg:flex flex-col p-4 z-40">
    <div className="mb-8 px-4">
      <h2 className="text-primary text-lg font-bold font-headline">The Archive</h2>
      <p className="text-slate-500 text-xs font-medium">Season 2024</p>
    </div>
    <nav className="flex flex-col gap-1">
      {[
        { label: 'Live Scores', icon: Activity, active: false },
        { label: 'League Leaders', icon: Trophy, active: true },
        { label: 'Transactions', icon: ArrowLeftRight, active: false },
        { label: 'Injury Report', icon: Activity, active: false },
        { label: 'Archive', icon: Archive, active: false },
      ].map((item) => (
        <a 
          key={item.label}
          className={`flex items-center gap-3 px-4 py-3 transition-all font-medium text-sm rounded-l-lg ${item.active ? 'text-primary font-bold bg-white' : 'text-slate-500 hover:text-primary hover:translate-x-1'}`} 
          href="#"
        >
          <item.icon className={`w-5 h-5 ${item.active ? 'fill-primary/10' : ''}`} />
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  </aside>
);}

const HeroSection = ({ team, seasons, selectedYear, onYearChange }: { team: any, seasons: any[], selectedYear: number, onYearChange: (y: number) => void }) => (
  <section className="max-w-7xl mx-auto mb-16 relative overflow-hidden rounded-xl p-8 md:p-12 text-white" style={{ backgroundColor: `#${team.color || '00193c'}` }}>
    <div className="absolute inset-0 opacity-20">
      <div className="absolute inset-0 bg-gradient-to-r from-primary to-transparent"></div>
      <img 
        className="w-full h-full object-cover grayscale" 
        src="https://lh3.googleusercontent.com/aida-public/AB6AXuCdO7Pyv58VNhyTxUenv1Agv-9QnA4eckzwFpe1EOdOtpaGJy7Y3kZcJvlAFnG3foorWjUZbl6M18vdwj71UHZUKmvH2blkWiVkLU2Dk0v57rUU4Nkgj-VnWFhDElYChGAUeEDK46cGLMgje-PTik6vD3zRAvWIYkaAELBw4j9ZFS30hgO4NbvEhadMacsxOlWn11B9nPGvcHa6AJiPT4ZK05h6uxH_WnOEHS-YRhJced_nUPlWIw2hCfUTe3y2E5VgZgAMcXMuxe2q" 
        alt="Stadium"
        referrerPolicy="no-referrer"
      />
    </div>
    <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
      <div>
        <span className="inline-block bg-secondary px-3 py-1 text-[10px] font-black tracking-widest uppercase mb-4">AMERICAN LEAGUE EAST</span>
        <h1 className="text-5xl md:text-7xl font-headline font-black tracking-tighter uppercase leading-none mt-2">
          {team.location} <br/><span style={{ color: `#${team.alternate_color || 'ffffff'}` }}>{team.name}</span>
        </h1>
        {seasons && seasons.length > 0 && (
          <div className="mt-4">
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
        <div className="mt-6 flex gap-8">
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-70">Season Record</p>
            <p className="text-3xl font-headline font-bold">92 — 48</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-70">Division Rank</p>
            <p className="text-3xl font-headline font-bold">1<span className="text-sm align-top">ST</span></p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-70">Streak</p>
            <p className="text-3xl font-headline font-bold text-emerald-400">W6</p>
          </div>
        </div>
      </div>
      <div className="hidden xl:block">
        <div className="flex -space-x-8">
          <motion.div 
            whileHover={{ y: -16 }}
            className="relative group"
          >
            <img 
              className="w-48 h-64 object-cover rounded-xl border-4 border-primary shadow-2xl" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCNVn1N18cy7WcnbdmbXe8RX4mynb0PreWqmG928ZftTalCA7p4diFGdMXGvsLPYS5-P2hsCwakT_6hGZSL7A6zyQRzsKsHeQaa3pCtwq82UBdw4qsKi9wBFMa-E1xIddwOoz9RlFgbra3fNVBE9S2fNJUo8PLpBEgscoukUSP0_055bAQNn_0bu96p2ymHZrwbdCi4-Eod2uksZod_nTn-g5GzUKSsO7bJ9u4f-yZ4YKUdSkMuF7NnboIV8EkwTdt7oySscSlWCNy7" 
              alt="MVP Candidate"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-4 left-4">
              <span className="bg-secondary text-[10px] font-bold px-2 py-0.5">MVP LEAD</span>
            </div>
          </motion.div>
          <motion.div 
            whileHover={{ y: -16 }}
            className="relative group mt-8"
          >
            <img 
              className="w-48 h-64 object-cover rounded-xl border-4 border-primary shadow-2xl" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDItrQP-r-d3CaPxBVaNKouFa4fA44x7GOWBCRT-jaM5ao_gHYoR32bTTQULfb1UM7WdufN_GYjMK-2Q29l4jUS2iE9Wp3YO7U9maFjD51PFDQej0oxvLwbD2_7MHxSLQtxqW6bixVGLgtqCgjmwpwO-q7cd-lgWt0WdFm8DJjPQ9-06cHptEvq1oR2bVoMdjRTcf1sIB9XBhLPipPLzZyA2wf-37nFBiYxAUjQBH6nB3bfOnia-xIsLXDtFsGc3fQ9n_Ya6RDTwPWR" 
              alt="Cy Young Candidate"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-4 left-4">
              <span className="bg-[#002d62] text-[10px] font-bold px-2 py-0.5">CY YOUNG FR</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  </section>
);

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
        
        // Use full UTC formatting so April 1st doesn't accidentally become March 31st depending on the user's timezone!
        const fullDate = dateObj.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString('en-US', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' });
        
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

const UpcomingSeries = () => (
  <div className="bg-[#002d62] rounded-xl p-6 text-white overflow-hidden relative">
    <div className="absolute top-0 right-0 p-4 opacity-10">
      <CalendarIcon className="w-16 h-16" />
    </div>
    <h3 className="font-headline font-black uppercase tracking-wider text-xs mb-6 text-slate-300">Upcoming Series</h3>
    <div className="space-y-6">
      {UPCOMING_GAMES.map((game, idx) => (
        <div key={game.id} className={idx === 0 ? "border-b border-white/10 pb-4" : ""}>
          {idx === 0 && <p className="text-[10px] uppercase font-bold text-secondary mb-2">Next Up: Tomorrow</p>}
          {game.dateRange && <p className="text-[10px] uppercase font-bold opacity-60 mb-2">{game.dateRange}</p>}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img className="w-8 h-8 opacity-80" src={game.logo} alt={game.opponent} referrerPolicy="no-referrer" />
              <div>
                <p className="text-sm font-bold">{game.opponent}</p>
                <p className="text-[10px] opacity-60">{game.location} | {game.time}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 opacity-60" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const DiamondArchitecture = () => (
  <section className="max-w-7xl mx-auto mt-16">
    <div className="mb-8">
      <h2 className="text-3xl font-headline font-black text-primary uppercase tracking-tighter">Diamond Architecture</h2>
      <p className="text-slate-500 font-medium">The starting lineup and positional hierarchy.</p>
    </div>
    <div className="relative w-full aspect-[16/9] bg-slate-200 rounded-3xl overflow-hidden border border-slate-300 p-8 shadow-inner">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_120%,#003623,transparent)]"></div>
      <div className="relative h-full grid grid-cols-5 grid-rows-4 gap-4">
        {FIELD_PLAYERS.map((player) => (
          <div key={player.pos} className={`${player.grid} flex flex-col items-center`}>
            <motion.div 
              whileHover={{ scale: 1.1 }}
              className={`rounded-full bg-white border-4 p-1 shadow-lg cursor-pointer ${player.featured ? 'w-20 h-20 border-secondary' : 'w-16 h-16 border-primary'}`}
            >
              <img src={player.img} alt={player.name} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
            </motion.div>
            <p className={`mt-2 text-[10px] font-black px-2 py-0.5 rounded shadow-sm ${player.featured ? 'bg-secondary text-white' : 'bg-white text-primary'}`}>
              {player.pos}
            </p>
            <p className={`text-[10px] ${player.featured ? 'font-bold text-primary' : 'font-medium text-slate-500'}`}>
              {player.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

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
        const [stats, batData, pitchData, gamesResponse, liveRosterData] = await Promise.all([
          fetchTeamStats(selectedTeamId, selectedYear, selectedSeasonType),
          fetchTeamRoster(selectedTeamId, selectedYear, selectedSeasonType),
          fetchTeamPitchingStats(selectedTeamId, selectedYear, selectedSeasonType),
          fetchPaginatedTeamGames(selectedTeamId, selectedYear, gamesPage, 200, selectedSeasonType),
          fetchLiveTeamRoster(selectedTeamId) 
        ]);
        setTeamStats(stats);
        setBattingRoster(batData);
        setPitchingRoster(pitchData);
        setRecentGames(gamesResponse.data);
        setGamesMeta(gamesResponse.meta);
        setLiveRoster(liveRosterData);
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
      <Header teams={teams} selectedTeamId={selectedTeamId} onSelectTeam={(id) => navigate(`/teams/${id}`)} />
      <Sidebar isVisible={true} />
      <main className="lg:ml-64 pt-24 px-6 pb-12 transition-all">
        <HeroSection team={selectedTeam} seasons={seasons} selectedYear={selectedYear} onYearChange={setSelectedYear} />
        
        <div className="max-w-7xl mx-auto">
          <TeamTabs activeTab={activeTab} onTabChange={setActiveTab} />
          
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
              <div className="lg:col-span-2 space-y-8">
                <StatsGrid stats={teamStats} />
                <BattingLeaders roster={battingRoster} />
              </div>
              <div className="space-y-8 flex flex-col">
                <div className="h-[400px]">
                  <RecentForm games={activeTab === 'overview' ? recentGames.slice(0, 5) : recentGames} teamId={selectedTeamId} page={gamesPage} meta={gamesMeta} onPageChange={setGamesPage} />
                </div>
                <UpcomingSeries />
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
        
        {activeTab === 'overview' && <DiamondArchitecture />}
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
          <div className="pt-24 px-6 pb-12 min-h-screen flex items-center justify-center">
             <div className="text-center">
               <h1 className="text-6xl font-headline font-black text-primary mb-4">STATMASTER</h1>
               <button onClick={() => navigate('/teams')} className="bg-secondary text-white px-8 py-3 rounded-full font-bold uppercase tracking-widest hover:bg-[#910724] transition-colors">View All Teams</button>
             </div>
          </div>
        } />
        <Route path="/teams" element={
          <>
            <Header teams={teams} selectedTeamId={null} onSelectTeam={() => {}} />
            <main className="pt-24 px-6 pb-12">
              <TeamsPage teams={teams} onSelectTeam={(id) => navigate(`/teams/${id}`)} />
            </main>
            <Footer />
          </>
        } />
        <Route path="/teams/:teamId" element={<TeamDashboard teams={teams} />} />
        <Route path="/schedule" element={
          <>
            <Header teams={teams} selectedTeamId={null} onSelectTeam={() => {}} />
            <main className="pt-24 px-6 pb-12">
              <SchedulePage />
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
