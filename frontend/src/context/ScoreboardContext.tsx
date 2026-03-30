import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ScoreboardContextType {
  events: any[];
  displayDate: string;
  currentDate: Date;
  changeDate: (days: number) => void;
  setDate: (date: Date) => void;
}

const ScoreboardContext = createContext<ScoreboardContextType>({ 
  events: [], 
  displayDate: '', 
  currentDate: new Date(), 
  changeDate: () => {},
  setDate: () => {} 
});

export const ScoreboardProvider = ({ children }: { children: ReactNode }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [displayDate, setDisplayDate] = useState<string>('');
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
        // Format YYYYMMDD
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const d = String(currentDate.getDate()).padStart(2, '0');
        const dateString = `${y}${m}${d}`;
        
        setDisplayDate(currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
        
        const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateString}`);
        const data = await response.json();
        if (data && data.events) {
          setEvents(data.events);
        } else {
          setEvents([]);
        }
      } catch (err) {
        console.error("Error fetching scoreboard:", err);
      }
    };

    fetchScores();
    const intervalId = setInterval(fetchScores, 15000); // 15 seconds
    return () => clearInterval(intervalId);
  }, [currentDate]);

  return (
    <ScoreboardContext.Provider value={{ events, displayDate, currentDate, changeDate, setDate: setCurrentDate }}>
      {children}
    </ScoreboardContext.Provider>
  );
};

export const useScoreboard = () => useContext(ScoreboardContext);
