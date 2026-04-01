import React from 'react';
import { LayoutDashboard, Users, CalendarDays, Activity } from 'lucide-react';

export const TeamTabs = ({ activeTab, onTabChange }: { activeTab: string, onTabChange: (t: string) => void }) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'roster', label: 'Roster', icon: Users },
    { id: 'schedule', label: 'Schedule', icon: CalendarDays },
    { id: 'stats', label: 'Stats', icon: Activity },
  ];

  return (
    <div className="border-b border-slate-200 mb-8 mt-4">
      <nav className="flex gap-8 px-2 overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 pb-4 text-sm font-headline font-bold uppercase tracking-wider transition-all relative whitespace-nowrap ${
              activeTab === tab.id 
                ? 'text-primary' 
                : 'text-slate-400 hover:text-primary'
            }`}
          >
            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-secondary' : ''}`} />
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 w-full h-1 bg-secondary rounded-t-lg" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
};