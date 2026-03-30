import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ScoreboardContextType {
  events: any[]; // Events for the selected date (for the ticker)
  todayEvents: any[]; // Events strictly for today (for the daily scoreboard)
  displayDate: string;
  displayDateToday: string;
  currentDate: Date;
  changeDate: (days: number) => void;
  setDate: (date: Date) => void;
}

const ScoreboardContext = createContext<ScoreboardContextType>({ 
  events: [], 
  todayEvents: [],
  displayDate: '', 
  displayDateToday: '',
  currentDate: new Date(), 
  changeDate: () => {},
  setDate: () => {} 
});

export const ScoreboardProvider = ({ children }: { children: ReactNode }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [todayEvents, setTodayEvents] = useState<any[]>([]);
  const [displayDate, setDisplayDate] = useState<string>('');
  const [displayDateToday, setDisplayDateToday] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const params = new URLSearchParams(window.location.search);
    const dateOverride = params.get('date');
    if (dateOverride) {
      const year = parseInt(dateOverride.substring(0, 4));
      const month = parseInt(dateOverride.substring(4, 6)) - 1;
      const day = parseInt(dateOverride.substring(6, 8));
      return new Date(year, month, day);
    }
    return new Date();
  });

  const changeDate = (days: number) => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + days);
      return d;
    });
  };

  useEffect(() => {
    const fetchScores = async () => {
      try {
        // Ticker / Header Date
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const d = String(currentDate.getDate()).padStart(2, '0');
        const dateString = `${y}${m}${d}`;
        
        setDisplayDate(currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
        
        // Today Date
        const today = new Date();
        const ty = today.getFullYear();
        const tm = String(today.getMonth() + 1).padStart(2, '0');
        const td = String(today.getDate()).padStart(2, '0');
        const todayString = `${ty}${tm}${td}`;
        
        setDisplayDateToday(today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));

        // Parallel Fetch
        const [dateRes, todayRes] = await Promise.all([
          fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateString}`),
          fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${todayString}`)
        ]);

        const dateData = await dateRes.json();
        const todayData = await todayRes.json();

        setEvents(dateData?.events || []);
        setTodayEvents(todayData?.events || []);

      } catch (err) {
        console.error("Error fetching scoreboard:", err);
      }
    };

    fetchScores();
    const intervalId = setInterval(fetchScores, 15000); // 15 seconds
    return () => clearInterval(intervalId);
  }, [currentDate]);

  return (
    <ScoreboardContext.Provider value={{ events, todayEvents, displayDate, displayDateToday, currentDate, changeDate, setDate: setCurrentDate }}>
      {children}
    </ScoreboardContext.Provider>
  );
};

export const useScoreboard = () => useContext(ScoreboardContext);
