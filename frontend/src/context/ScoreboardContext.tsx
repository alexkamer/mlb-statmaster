import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ScoreboardContextType {
  events: any[];
  displayDate: string;
}

const ScoreboardContext = createContext<ScoreboardContextType>({ events: [], displayDate: '' });

export const ScoreboardProvider = ({ children }: { children: ReactNode }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [displayDate, setDisplayDate] = useState<string>('');

  useEffect(() => {
    const fetchScores = async () => {
      try {
        const today = new Date();
        // Allow passing date via query string for testing/simulation (e.g. ?date=20260326)
        const params = new URLSearchParams(window.location.search);
        const dateOverride = params.get('date');
        
        let dateString;
        if (dateOverride) {
          dateString = dateOverride;
          // Parse override into a readable date for the header
          const year = parseInt(dateOverride.substring(0, 4));
          const month = parseInt(dateOverride.substring(4, 6)) - 1;
          const day = parseInt(dateOverride.substring(6, 8));
          const parsedDate = new Date(year, month, day);
          setDisplayDate(parsedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
        } else {
          dateString = today.toISOString().split('T')[0].replace(/-/g, '');
          setDisplayDate(today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
        }
        
        const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${dateString}`);
        const data = await response.json();
        if (data && data.events) {
          setEvents(data.events);
        }
      } catch (err) {
        console.error("Error fetching scoreboard:", err);
      }
    };

    fetchScores();
    const intervalId = setInterval(fetchScores, 15000); // 15 seconds
    return () => clearInterval(intervalId);
  }, []);

  return (
    <ScoreboardContext.Provider value={{ events, displayDate }}>
      {children}
    </ScoreboardContext.Provider>
  );
};

export const useScoreboard = () => useContext(ScoreboardContext);
