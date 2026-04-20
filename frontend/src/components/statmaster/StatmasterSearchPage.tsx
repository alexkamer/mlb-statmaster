import React, { useState, useEffect } from 'react';
import { Search, Sparkles, TrendingUp, Trophy, History, BarChart3, ChevronRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SafeImage } from '../shared/SafeImage';

export const StatmasterSearchPage = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q')?.replace(/-/g, ' ') || '';
  const [query, setQuery] = useState(initialQuery);
  const navigate = useNavigate();

  useEffect(() => {
    setQuery(searchParams.get('q')?.replace(/-/g, ' ') || '');
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/ask?q=${encodeURIComponent(query.trim().replace(/\s+/g, '-'))}`);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    navigate(`/ask?q=${encodeURIComponent(suggestion.trim().replace(/\s+/g, '-'))}`);
  };

  const trendingTopics = [
    {
      title: "Ohtani vs Lefties",
      query: "Shohei Ohtani batting average vs LHP this season",
      image: "https://a.espncdn.com/i/headshots/mlb/players/full/39832.png", // Ohtani
      color: "bg-blue-50 border-blue-200",
      textColor: "text-blue-700"
    },
    {
      title: "Judge's Power",
      query: "Aaron Judge total home runs since 2022",
      image: "https://a.espncdn.com/i/headshots/mlb/players/full/33192.png", // Judge
      color: "bg-slate-50 border-slate-200",
      textColor: "text-slate-700"
    },
    {
      title: "Mets Streak",
      query: "New York Mets record in their last 15 games",
      image: "https://a.espncdn.com/i/teamlogos/mlb/500/nym.png", // Mets
      color: "bg-orange-50 border-orange-200",
      textColor: "text-orange-700"
    },
    {
      title: "Strikeout Leaders",
      query: "Who has the most strikeouts in the MLB right now?",
      icon: <Trophy className="w-12 h-12 text-yellow-500 opacity-20 absolute -bottom-2 -right-2" />,
      color: "bg-yellow-50 border-yellow-200",
      textColor: "text-yellow-700"
    }
  ];

  const categories = [
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Player Props & Trends",
      description: "Ask about recent performance, hit streaks, or specific situational splits (e.g., 'vs LHP' or 'at home')."
    },
    {
      icon: <History className="w-6 h-6" />,
      title: "Historical Records",
      description: "Dive into the past. Find out who holds franchise records or league-wide milestones."
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Team Comparisons",
      description: "Compare team stats over specific timeframes or against specific opponents."
    }
  ];

  const exampleCategories = [
    {
      title: "Scores",
      questions: ["Did the Giants win?", "Which team has won the most World Series?", "Who won the World Series last year?"]
    },
    {
      title: "Schedules",
      questions: ["When is the next Athletics home game?", "What channel is the Mariners game on?", "When do the Dodgers play the Giants next?"]
    },
    {
      title: "Standings",
      questions: ["What is the Cubs' record?", "What was the White Sox' record last season?", "Who had the best record in the American League last season?"]
    },
    {
      title: "Stats",
      questions: ["Which pitcher has the most strikeouts this season?", "Which team had the most home runs in a season?", "Who has the most RBI in a World Series?"]
    },
    {
      title: "Bios",
      questions: ["How tall was Randy Johnson?", "How much does Bartolo Colon weigh?", "What are Babe Ruth's career stats?"]
    },
    {
      title: "Recaps",
      questions: ["How did Shohei do?", "How did the Blue Jays do last season?", "How did Jose Altuve do in his rookie season?"]
    },
    {
      title: "Odds",
      questions: ["MLB odds", "Who are the favorites tonight?", "Red Sox moneyline"]
    },
    {
      title: "Beyond the Box Score",
      questions: ["Who has the highest wRC+ in a season?", "Which pitcher has the highest career strikeouts per nine innings?", "Who has the highest weighted on base percentage in a season?"]
    }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-center justify-start pt-16 pb-24">
      {/* Hero Section */}
      <div className="text-center mb-16 max-w-3xl">
        <div className="inline-flex items-center justify-center gap-2 bg-secondary/10 text-secondary px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
          <Sparkles className="w-4 h-4" />
          AI-Powered Baseball Insights
        </div>
        <h1 className="text-6xl md:text-8xl font-headline font-black text-primary tracking-tighter mb-6 leading-none">
          Ask <span className="text-secondary">Statmaster</span>
        </h1>
        <p className="text-slate-500 font-medium text-xl md:text-2xl tracking-tight">
          Natural language answers to your deepest baseball questions. Powered by real-time MLB data.
        </p>
      </div>

      {/* Main Search Bar */}
      <form onSubmit={handleSearch} className="w-full max-w-4xl relative group mb-20">
        <div className="absolute inset-y-0 left-0 pl-8 flex items-center pointer-events-none">
          <Search className="h-8 w-8 text-slate-300 group-focus-within:text-secondary transition-colors" />
        </div>
        <input
          type="text"
          className="block w-full pl-20 pr-8 py-8 border-4 border-slate-200 rounded-3xl text-2xl md:text-3xl font-bold text-primary placeholder-slate-300 outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/20 transition-all shadow-xl hover:shadow-2xl bg-white"
          placeholder="What do you want to know?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="absolute inset-y-0 right-4 flex items-center">
          <button
            type="submit"
            className="bg-primary hover:bg-secondary text-white p-5 rounded-2xl transition-all duration-300 shadow-md hover:scale-105 active:scale-95 flex items-center gap-2 font-bold uppercase tracking-wider text-sm"
          >
            Ask <Sparkles className="w-5 h-5" />
          </button>
        </div>
      </form>

      {/* Trending Grid */}
      <div className="w-full mb-20">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 pl-2">
          Trending Searches
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {trendingTopics.map((topic, idx) => (
            <button
              key={idx}
              onClick={() => handleSuggestionClick(topic.query)}
              className={`relative overflow-hidden p-6 rounded-2xl border-2 text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group ${topic.color}`}
            >
              {topic.image && (
                <SafeImage 
                  src={topic.image} 
                  alt={topic.title}
                  className="absolute -bottom-4 -right-4 w-24 h-24 object-contain opacity-30 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500 pointer-events-none"
                  hideOnError
                />
              )}
              {topic.icon}
              <div className="relative z-10">
                <h3 className={`text-lg font-black tracking-tight mb-2 ${topic.textColor}`}>
                  {topic.title}
                </h3>
                <p className="text-sm font-medium text-slate-600 line-clamp-3">
                  "{topic.query}"
                </p>
                <div className={`mt-4 flex items-center gap-1 text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity ${topic.textColor}`}>
                  Search <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Example Questions Section */}
      <div className="w-full mb-24">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8 pl-2">
          Example Questions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12 pl-2">
          {exampleCategories.map((category, idx) => (
            <div key={idx}>
              <h3 className="text-sm font-black text-primary mb-4">
                {category.title}
              </h3>
              <ul className="space-y-3">
                {category.questions.map((q, qIdx) => (
                  <li key={qIdx}>
                    <button
                      onClick={() => handleSuggestionClick(q)}
                      className="text-left text-sm font-medium text-slate-500 hover:text-secondary hover:underline transition-colors block w-full outline-none"
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Capabilities Section */}
      <div className="w-full bg-white border border-slate-200 rounded-3xl p-8 md:p-12 shadow-sm">
        <h2 className="text-2xl md:text-3xl font-headline font-black text-primary tracking-tight mb-8 text-center">
          What can Statmaster do?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {categories.map((cat, idx) => (
            <div key={idx} className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-colors">
                {cat.icon}
              </div>
              <h3 className="text-lg font-bold text-primary mb-3">{cat.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {cat.description}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
