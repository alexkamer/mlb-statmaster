import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SafeImage } from '../../shared/SafeImage';
import { StatmasterResponse } from '../types';

export const StatmasterHero = ({ data }: { data: StatmasterResponse }) => {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-5xl mx-auto px-6 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out relative z-10">
      {(data.primaryImage || data.secondaryImage) && (
        <div 
          className="relative mb-6 group cursor-pointer inline-block" 
          onClick={() => data.subjectId && navigate(`/${data.subjectType}s/${data.subjectId}`)}
        >
          {data.primaryImage && (
            <SafeImage 
              src={data.primaryImage} 
              alt={data.primaryImageAlt || 'Subject'} 
              className="w-40 h-40 md:w-56 md:h-56 object-contain relative z-10 drop-shadow-[0_10px_20px_rgba(0,0,0,0.15)] transition-transform duration-300 group-hover:scale-105"
              hideOnError
            />
          )}
          {data.secondaryImage && (
            <div className="absolute -bottom-2 -right-4 md:-right-6 z-20 bg-white rounded-full p-1.5 shadow-lg border-2 border-slate-100 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
              <SafeImage 
                src={data.secondaryImage} 
                alt="Team Logo" 
                className="w-12 h-12 md:w-16 md:h-16 object-contain"
                hideOnError
              />
            </div>
          )}
        </div>
      )}
      
      <h1 className="text-3xl md:text-4xl lg:text-5xl font-headline font-black text-[#111111] tracking-tight leading-[1.1] max-w-3xl">
        {data.answerText.split(data.subjectName || '').map((part, i, arr) => (
            <React.Fragment key={i}>
              {part}
              {i < arr.length - 1 && data.subjectName && (
                <span 
                  className="text-[#0051e5] hover:underline cursor-pointer px-1 relative inline-block group transition-colors"
                  onClick={() => data.subjectId && navigate(`/${data.subjectType}s/${data.subjectId}`)}
                >
                  {data.subjectName}
                </span>
              )}
            </React.Fragment>
        ))}
      </h1>

      {/* HERO STAT BADGES */}
      {data.heroStats && data.heroStats.length > 0 && (
        <div className="flex flex-wrap justify-center gap-8 md:gap-16 mt-10 w-full animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
          {data.heroStats.map((stat, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <span className="text-4xl md:text-6xl font-black text-[#111111] font-mono tracking-tighter">
                {stat.value}
              </span>
              <span className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
