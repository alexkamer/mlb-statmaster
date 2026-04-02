import React, { useState, useEffect } from 'react';
import { PlayCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { SafeImage } from '../shared/SafeImage';

interface GameVideoPlayerProps {
    data: any;
}

export const GameVideoPlayer: React.FC<GameVideoPlayerProps> = ({ data }) => {
    const videos = data.videos || [];
    const [activeVideoIdx, setActiveVideoIdx] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    // Reset playing state when game changes
    useEffect(() => {
        setActiveVideoIdx(0);
        setIsPlaying(false);
    }, [data.header?.id]);

    const handleVideoSelect = (idx: number) => {
        setActiveVideoIdx(idx);
        setIsPlaying(true);
    };

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (activeVideoIdx < videos.length - 1) {
            setActiveVideoIdx(prev => prev + 1);
            setIsPlaying(true);
        }
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (activeVideoIdx > 0) {
            setActiveVideoIdx(prev => prev - 1);
            setIsPlaying(true);
        }
    };

    const formatDuration = (seconds: number) => {
        if (!seconds) return "";
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (videos.length === 0) {
        // Fallback to static stadium image or headline thumbnail
        const headline = data.header?.headlines?.[0];
        const imageUrl = headline?.video?.[0]?.thumbnail || data.gameInfo?.venue?.images?.[0]?.href || 'https://via.placeholder.com/800x450?text=No+Media+Available';
        const title = headline?.description || headline?.shortLinkText || "Game Overview";
        const desc = data.header?.competitions?.[0]?.notes?.[0]?.headline || "Matchup highlights and information.";
        
        return (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="relative w-full aspect-video bg-slate-900 overflow-hidden border-b border-slate-200">
                    <SafeImage src={imageUrl} alt="Highlight" className="w-full h-full object-cover opacity-90" hideOnError />
                </div>
                <div className="p-5">
                    <h2 className="text-xl font-bold text-slate-800 leading-tight mb-2">{title}</h2>
                    <p className="text-sm text-slate-500 line-clamp-2">{desc}</p>
                </div>
            </div>
        );
    }

    const activeVideo = videos[activeVideoIdx];
    // ESPN often provides multiple resolutions. The highest quality mp4 usually sits in links.source.HD.href or links.source.full.href
    const videoUrl = activeVideo.links?.source?.HD?.href || activeVideo.links?.source?.mezzanine?.href || activeVideo.links?.source?.full?.href || activeVideo.links?.mobile?.source?.href;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Main Player */}
            <div className="relative w-full aspect-video bg-black group flex items-center justify-center overflow-hidden border-b border-slate-200">
                {videos.length > 1 && (
                    <>
                        <button 
                            onClick={handlePrev}
                            disabled={activeVideoIdx === 0}
                            className={`absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all backdrop-blur-sm shadow-xl ${activeVideoIdx === 0 ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100 bg-black/50 hover:bg-black/80 text-white'}`}
                        >
                            <ChevronLeft className="w-7 h-7 -ml-0.5" />
                        </button>
                        <button 
                            onClick={handleNext}
                            disabled={activeVideoIdx === videos.length - 1}
                            className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all backdrop-blur-sm shadow-xl ${activeVideoIdx === videos.length - 1 ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100 bg-black/50 hover:bg-black/80 text-white'}`}
                        >
                            <ChevronRight className="w-7 h-7 -mr-0.5" />
                        </button>
                    </>
                )}
                {isPlaying && videoUrl ? (
                    <video 
                        src={videoUrl} 
                        className="w-full h-full" 
                        controls 
                        autoPlay 
                        poster={activeVideo.thumbnail}
                        playsInline
                    />
                ) : (
                    <>
                        <SafeImage 
                            src={activeVideo.thumbnail} 
                            alt={activeVideo.headline} 
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer" 
                            onClick={() => setIsPlaying(true)}
                            hideOnError
                        />
                        <div 
                            className="absolute inset-0 flex items-center justify-center cursor-pointer"
                            onClick={() => setIsPlaying(true)}
                        >
                            <div className="w-16 h-16 bg-black/60 rounded-full flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-primary/90 transition-all backdrop-blur-sm shadow-xl">
                                <PlayCircle className="w-10 h-10" />
                            </div>
                        </div>
                        {activeVideo.duration > 0 && (
                            <div className="absolute bottom-4 right-4 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded shadow-sm">
                                {formatDuration(activeVideo.duration)}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Video Info */}
            <div className="p-5 bg-white">
                <div className="flex justify-between items-start gap-4 mb-1">
                    <h2 className="text-lg font-black text-slate-800 leading-tight">{activeVideo.headline}</h2>
                    {videos.length > 1 && (
                        <div className="flex items-center gap-1.5 shrink-0 bg-slate-100 px-2 py-1 rounded text-[10px] font-black text-slate-500 tracking-widest mt-0.5 border border-slate-200">
                            <span>{activeVideoIdx + 1}</span>
                            <span className="text-slate-300">/</span>
                            <span>{videos.length}</span>
                        </div>
                    )}
                </div>
                {activeVideo.description && activeVideo.description !== activeVideo.headline && (
                    <p className="text-sm text-slate-500 line-clamp-2">{activeVideo.description}</p>
                )}
            </div>

                    </div>
    );
};
