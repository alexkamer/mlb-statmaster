import React from 'react';
import { Search, Sparkles } from 'lucide-react';

interface StatmasterSearchInputProps {
  query: string;
  setQuery: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

export const StatmasterSearchInput = ({ query, setQuery, onSubmit, isLoading }: StatmasterSearchInputProps) => {
  return (
    <form onSubmit={onSubmit} className="w-full max-w-3xl relative group mb-16 px-4 z-20">
      <div className="absolute inset-y-0 left-4 pl-6 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
      </div>
      <input
        type="text"
        className="block w-full pl-14 pr-8 py-4 border-2 border-slate-300 rounded-full text-lg font-bold text-primary placeholder-slate-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm bg-white"
        placeholder="Ask another question..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="absolute inset-y-0 right-6 flex items-center">
        <button
          type="submit"
          className="bg-primary hover:bg-[#1a1a1a] text-white p-2.5 rounded-full transition-all duration-300 shadow-sm"
          disabled={isLoading}
        >
          <Sparkles className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
};
