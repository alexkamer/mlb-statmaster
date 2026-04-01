import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ScoreboardContextType {
  events: any[]; // Events for the selected date (for the ticker)
  todayEvents: any[]; // Events strictly for the daily scoreboard's active date
  displayDate: string;
  displayDateToday: string;
  currentDate: Date;
  changeDate: (days: number) => void;
  setDate: (date: Date) => void;
  scoreboardDate: Date;
  changeScoreboardDate: (days: number) => void;
  setScoreboardDate: (date: Date) => void;
  isLoadingScores: boolean;
}

const ScoreboardContext = createContext<ScoreboardContextType>({ 
  events: [], 
  todayEvents: [],
  displayDate: '', 
  displayDateToday: '',
  currentDate: new Date(), 
  changeDate: () => {},
  setDate: () => {},
  scoreboardDate: new Date(),
  changeScoreboardDate: () => {},
  setScoreboardDate: () => {},
  isLoadingScores: true
});

export const ScoreboardProvider = ({ children }: { children: ReactNode }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [todayEvents, setTodayEvents] = useState<any[]>([]);
  const [displayDate, setDisplayDate] = useState<string>('');
  const [displayDateToday, setDisplayDateToday] = useState<string>('');
  const [isLoadingScores, setIsLoadingScores] = useState<boolean>(true);
  
  const getInitialDate = () => {
    const params = new URLSearchParams(window.location.search);
    const dateOverride = params.get('date');
    if (dateOverride) {
      const year = parseInt(dateOverride.substring(0, 4));
      const month = parseInt(dateOverride.substring(4, 6)) - 1;
      const day = parseInt(dateOverride.substring(6, 8));
      return new Date(year, month, day);
    }
    return new Date();
  };

  const [currentDate, setCurrentDate] = useState<Date>(getInitialDate());
  const [scoreboardDate, setScoreboardDate] = useState<Date>(getInitialDate());

  const changeDate = (days: number) => {
    setIsLoadingScores(true);
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + days);
      return d;
    });
  };

  const changeScoreboardDate = (days: number) => {
    setIsLoadingScores(true);
    setScoreboardDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + days);
      return d;
    });
  };

  useEffect(() => {
    let isInitialLoadOrDateChange = true;
    
    const fetchScores = async () => {
      // Don't poll if the document is hidden and we already loaded once
      if (document.visibilityState === 'hidden' && !isInitialLoadOrDateChange) return;

      if (isInitialLoadOrDateChange) setIsLoadingScores(true);
      
      try {
        // Ticker / Header Date
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const d = String(currentDate.getDate()).padStart(2, '0');
        const dateString = `${y}${m}${d}`;
        
        setDisplayDate(currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
        
        // Scoreboard Date
        const sy = scoreboardDate.getFullYear();
        const sm = String(scoreboardDate.getMonth() + 1).padStart(2, '0');
        const sd = String(scoreboardDate.getDate()).padStart(2, '0');
        const scoreboardString = `${sy}${sm}${sd}`;
        
        setDisplayDateToday(scoreboardDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));

        if (dateString === scoreboardString) {
            const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateString}`);
            const data = await res.json();
            setEvents(data?.events || []);
            setTodayEvents(data?.events || []);
        } else {
            // Parallel Fetch
            const [dateRes, todayRes] = await Promise.all([
              fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateString}`),
              fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${scoreboardString}`)
            ]);

            const dateData = await dateRes.json();
            const todayData = await todayRes.json();

            setEvents(dateData?.events || []);
            setTodayEvents(todayData?.events || []);
        }

      } catch (err) {
        console.error("Error fetching scoreboard:", err);
      } finally {
        if (isInitialLoadOrDateChange) {
          setIsLoadingScores(false);
          isInitialLoadOrDateChange = false;
        }
      }
    };

    fetchScores();
    const intervalId = setInterval(fetchScores, 15000); // 15 seconds
    
    // Also re-fetch immediately when the tab becomes visible again
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') fetchScores();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        clearInterval(intervalId);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentDate, scoreboardDate]);

  return (
    <ScoreboardContext.Provider value={{ 
      events, todayEvents, displayDate, displayDateToday, 
      currentDate, changeDate, setDate: (d: Date) => { setIsLoadingScores(true); setCurrentDate(d); },
      scoreboardDate, changeScoreboardDate, setScoreboardDate: (d: Date) => { setIsLoadingScores(true); setScoreboardDate(d); },
      isLoadingScores
    }}>
      {children}
    </ScoreboardContext.Provider>
  );
};

export const useScoreboard = () => useContext(ScoreboardContext);
