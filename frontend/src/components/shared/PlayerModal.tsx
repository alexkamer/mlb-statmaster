import { SafeImage } from './SafeImage';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, Activity, Award, Calendar } from 'lucide-react';

export const PlayerModal = ({ isOpen, onClose, player }: any) => {
  if (!isOpen || !player) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        />
        
        {/* Modal */}
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        >
          {/* Header Graphic */}
          <div className="bg-primary p-8 text-white relative overflow-hidden">
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-white/50 hover:text-white bg-black/20 hover:bg-black/40 p-2 rounded-full transition-all z-10"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="absolute -right-8 -bottom-16 text-[150px] font-black font-headline opacity-5 tracking-tighter">
              {player.position}
            </div>
            
            <div className="relative z-10 flex items-end gap-6">
              <div className="w-24 h-24 bg-white text-primary rounded-xl flex items-center justify-center text-4xl font-black font-headline shadow-lg border-4 border-white/20 overflow-hidden relative group">
                {player.headshot ? (
                    <SafeImage 
                      src={player.headshot} 
                      alt={player.full_name} 
                      className="w-full h-full object-cover object-top absolute inset-0 z-10" 
                      referrerPolicy="no-referrer"
                      hideOnError
                    />
                ) : null}
                <span className="relative z-0">{player.position || 'UN'}</span>
              </div>
              <div>
                <p className="text-secondary font-bold text-sm tracking-widest uppercase mb-1">Active Roster</p>
                <h2 className="text-4xl font-headline font-black tracking-tight">{player.full_name}</h2>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-8">
            <h3 className="font-headline font-black text-slate-800 uppercase tracking-wider text-sm mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4 text-secondary" /> Season Performance (2024)
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {player.ip !== undefined ? [
                // Pitching Stats
                { label: 'Games', value: player.g || '0' },
                { label: 'Innings', value: player.ip || '0.0' },
                { label: 'Hits', value: player.h || '0' },
                { label: 'Walks', value: player.bb || '0' },
                { label: 'Strikeouts', value: player.k || '0', highlight: true },
                { label: 'Earned Runs', value: player.er || '0' },
                { label: 'Home Runs', value: player.hr || '0' },
                { label: 'ERA', value: player.era || '0.00', highlight: true },
              ].map((stat, idx) => (
                <div key={idx} className={`p-4 rounded-xl border ${stat.highlight ? 'bg-slate-50 border-secondary/20' : 'border-slate-100'}`}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{stat.label}</p>
                  <p className={`text-2xl font-headline font-black ${stat.highlight ? 'text-secondary' : 'text-primary'}`}>{stat.value}</p>
                </div>
              )) : [
                // Batting Stats
                { label: 'Games', value: player.g || '0' },
                { label: 'At Bats', value: player.ab || '0' },
                { label: 'Hits', value: player.h || '0' },
                { label: 'Runs', value: player.r || '0' },
                { label: 'Home Runs', value: player.hr || '0', highlight: true },
                { label: 'RBI', value: player.rbi || '0' },
                { label: 'AVG', value: player.avg || '.000', highlight: true },
                { label: 'OPS', value: player.ops || '.000', highlight: true },
              ].map((stat, idx) => (
                <div key={idx} className={`p-4 rounded-xl border ${stat.highlight ? 'bg-slate-50 border-secondary/20' : 'border-slate-100'}`}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{stat.label}</p>
                  <p className={`text-2xl font-headline font-black ${stat.highlight ? 'text-secondary' : 'text-primary'}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};