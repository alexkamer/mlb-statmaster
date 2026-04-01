import React from 'react';

interface BvpTabProps {
    bvpData: any;
    player: any;
    opposingPitcher: any;
}

export const BvpTab: React.FC<BvpTabProps> = ({ bvpData, player, opposingPitcher }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50">
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">
                    Head-to-Head History
                </h2>
                <p className="text-sm text-slate-500 font-medium mt-1">
                    {player?.shortName || "Batter"} vs {opposingPitcher?.shortName || "Pitcher"}
                </p>
            </div>
            <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Batting Avg</p>
                        <p className="text-3xl font-black font-headline text-slate-800">{bvpData.avg.toFixed(3).replace(/^0+/, '')}</p>
                        <p className="text-xs text-slate-400 font-medium mt-1">{bvpData.h} for {bvpData.ab}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">On-Base Pct</p>
                        <p className="text-3xl font-black font-headline text-slate-800">{bvpData.obp.toFixed(3).replace(/^0+/, '')}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Slugging Pct</p>
                        <p className="text-3xl font-black font-headline text-slate-800">{bvpData.slg.toFixed(3).replace(/^0+/, '')}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Home Runs</p>
                        <p className="text-3xl font-black font-headline text-emerald-600">{bvpData.hr}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Plate App</span>
                        <span className="font-black text-slate-700">{bvpData.ab + bvpData.bb}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Doubles</span>
                        <span className="font-black text-slate-700">{bvpData.d}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Walks</span>
                        <span className="font-black text-slate-700">{bvpData.bb}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Strikeouts</span>
                        <span className="font-black text-rose-600">{bvpData.k}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};