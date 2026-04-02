import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Coins, TrendingUp, BarChart3, ShieldOff, Zap } from 'lucide-react';
import { NrfiTab } from './NrfiTab';

export const BettorsHeavenPage = () => {
  const [activeTab, setActiveTab] = useState('nrfi');

  const tabs = [
    { id: 'nrfi', label: 'NRFI / YRFI', icon: ShieldOff },
    { id: 'builder', label: 'Parlay Builder', icon: Zap },
    { id: 'trends', label: 'Trend Finder', icon: TrendingUp },
  ];

  return (
    <div className="w-full h-full bg-slate-50 flex flex-col p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto w-full flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-primary font-headline tracking-tight">Bettors Heaven</h1>
              <p className="text-slate-500 text-sm font-medium">Your ultimate dashboard for betting insights and analysis.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Odds
            </span>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex items-center gap-8 border-b border-slate-200 px-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-4 text-sm font-bold flex items-center gap-2 transition-colors relative ${
                activeTab === tab.id ? 'text-secondary' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="bettorsTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-[500px] flex flex-col">
          {activeTab === 'nrfi' && (
            <NrfiTab />
          )}

          {activeTab !== 'nrfi' && (
            <div className="flex-1 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-slate-400 gap-4 p-8 text-center bg-slate-50/50 mt-4">
              {tabs.find(t => t.id === activeTab)?.icon({ className: "w-12 h-12 text-slate-300" })}
              <div className="max-w-md">
                <h3 className="text-lg font-bold text-slate-700 mb-2">{tabs.find(t => t.id === activeTab)?.label}</h3>
                <p className="text-sm text-slate-500 mb-6">
                  This space is reserved for future betting tools and modules.
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
