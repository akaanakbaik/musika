import React, { useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2, Minimize2, Download, Heart, ListMusic, Shuffle, Repeat, Repeat1, X } from "lucide-react";
import { usePlayer } from "@/lib/PlayerContext";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { sourceLabels, sourceIcons } from "@/lib/musicApi";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function formatTime(seconds: number) {
  if (isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Player() {
  const {
    currentSong, isPlaying, progress, duration, volume, isBuffering,
    shuffle, repeat,
    pause, resume, next, prev, setVolume, seek, toggleShuffle, toggleRepeat,
    toggleFavorite, isFavorite, queue, removeFromQueue
  } = usePlayer();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.8);

  if (!currentSong) return null;

  const isFav = isFavorite(currentSong.videoId);
  const srcInfo = sourceLabels[currentSong.source] || { label: currentSong.source, bg: "bg-gray-600" };
  const progressPct = duration ? (progress / duration) * 100 : 0;

  const handlePlayPause = () => { if (isPlaying) pause(); else resume(); };

  const handleMute = () => {
    if (isMuted) { setVolume(prevVolume); setIsMuted(false); }
    else { setPrevVolume(volume); setVolume(0); setIsMuted(true); }
  };

  const handleDownload = async () => {
    if (!currentSong.url) return;
    setIsDownloading(true);
    try {
      toast({ title: "Starting download…", description: currentSong.title });
      const res = await fetch(`${BASE}/api/music/download?url=${encodeURIComponent(currentSong.url)}&source=${currentSong.source}`);
      const data = await res.json();
      if (data.success && data.download_url) {
        const a = document.createElement("a");
        a.href = data.download_url;
        a.download = `${currentSong.title}.mp3`;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast({ title: "Download started" });
      } else {
        throw new Error(data.error || "No download URL");
      }
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;

  return (
    <>
      {/* Mini Player */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 h-[72px] md:h-[90px] bg-[#181818] border-t border-white/10 flex items-center px-3 md:px-6 z-50 gap-4">
        
        {/* Song info */}
        <div className="flex items-center gap-3 w-[30%] min-w-0">
          <img
            src={currentSong.thumbnail}
            alt={currentSong.title}
            className="w-14 h-14 rounded object-cover cursor-pointer flex-shrink-0"
            onClick={() => setIsExpanded(true)}
            onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/56x56/333/999?text=♪"; }}
          />
          <div className="flex-1 min-w-0 hidden md:block">
            <p
              className="text-white text-sm font-medium truncate cursor-pointer hover:underline"
              onClick={() => setIsExpanded(true)}
            >{currentSong.title}</p>
            <p className="text-white/60 text-xs truncate">{currentSong.artist}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${srcInfo.bg} text-white font-medium`}>
              {sourceIcons[currentSong.source]} {srcInfo.label}
            </span>
          </div>
          <button
            onClick={() => toggleFavorite(currentSong)}
            className={`p-1 hidden md:block flex-shrink-0 ${isFav ? "text-[#1DB954]" : "text-white/40 hover:text-white"}`}
          >
            <Heart className={`w-4 h-4 ${isFav ? "fill-current" : ""}`} />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-1 flex-1 max-w-[600px]">
          <div className="flex items-center gap-4 md:gap-6">
            <button onClick={toggleShuffle} className={`hidden md:block transition-colors ${shuffle ? "text-[#1DB954]" : "text-white/50 hover:text-white"}`}>
              <Shuffle className="w-4 h-4" />
            </button>
            <button onClick={prev} className="text-white/70 hover:text-white">
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            <button
              onClick={handlePlayPause}
              className="w-9 h-9 md:w-8 md:h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
            >
              {isBuffering ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>
            <button onClick={next} className="text-white/70 hover:text-white">
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
            <button onClick={toggleRepeat} className={`hidden md:block transition-colors ${repeat !== "none" ? "text-[#1DB954]" : "text-white/50 hover:text-white"}`}>
              <RepeatIcon className="w-4 h-4" />
            </button>
          </div>
          {/* Progress */}
          <div className="hidden md:flex items-center gap-2 w-full">
            <span className="text-xs text-white/50 w-9 text-right">{formatTime(progress)}</span>
            <Slider
              value={[progress]}
              max={duration || 100}
              step={1}
              onValueChange={([val]) => seek(val)}
              className="flex-1 h-1 cursor-pointer"
            />
            <span className="text-xs text-white/50 w-9">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center justify-end gap-3 w-[30%]">
          <button onClick={() => setShowQueue(q => !q)} className={`hidden md:block transition-colors ${showQueue ? "text-[#1DB954]" : "text-white/50 hover:text-white"}`}>
            <ListMusic className="w-4 h-4" />
          </button>
          <button onClick={handleDownload} disabled={isDownloading} className="hidden md:block text-white/50 hover:text-white disabled:opacity-30 transition-colors">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={handleMute} className="hidden md:block text-white/50 hover:text-white transition-colors">
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className="hidden md:flex items-center w-24">
            <Slider
              value={[isMuted ? 0 : volume * 100]}
              max={100}
              step={1}
              onValueChange={([val]) => { setVolume(val / 100); if (val > 0) setIsMuted(false); }}
              className="w-full h-1"
            />
          </div>
          <button onClick={() => setIsExpanded(true)} className="text-white/50 hover:text-white transition-colors">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Queue panel */}
      {showQueue && (
        <div className="fixed bottom-[90px] right-4 w-80 bg-[#282828] rounded-xl border border-white/10 shadow-2xl z-40 flex flex-col max-h-[60vh]">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="text-white font-semibold">Queue ({queue.length})</h3>
            <button onClick={() => setShowQueue(false)} className="text-white/50 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {queue.map((song, i) => {
              const isCurr = song.videoId === currentSong.videoId;
              return (
                <div key={`${song.videoId}-${i}`} className={`flex items-center gap-3 p-2 rounded-md ${isCurr ? "bg-white/10" : "hover:bg-white/5"}`}>
                  <img src={song.thumbnail} className="w-10 h-10 rounded object-cover flex-shrink-0" alt={song.title} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${isCurr ? "text-[#1DB954]" : "text-white"}`}>{song.title}</p>
                    <p className="text-white/50 text-[10px] truncate">{song.artist}</p>
                  </div>
                  {isCurr && isPlaying && <div className="w-2 h-2 bg-[#1DB954] rounded-full animate-pulse flex-shrink-0" />}
                  {!isCurr && (
                    <button onClick={() => removeFromQueue(song.videoId)} className="text-white/30 hover:text-white flex-shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expanded Player */}
      {isExpanded && (
        <div className="fixed inset-0 bg-[#121212] z-[100] flex flex-col md:flex-row overflow-hidden">
          {/* Blurred bg */}
          <div className="absolute inset-0" style={{ backgroundImage: `url(${currentSong.thumbnail})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(60px) brightness(0.3) saturate(1.5)", transform: "scale(1.1)" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-black/90" />

          {/* Main player */}
          <div className={`relative flex flex-col items-center justify-center p-8 md:p-12 flex-1 transition-all duration-500 ${showQueue ? "md:flex-none md:w-1/2" : "w-full"}`}>
            <button onClick={() => setIsExpanded(false)} className="absolute top-6 left-6 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white/70 hover:text-white transition-colors">
              <Minimize2 className="w-5 h-5" />
            </button>

            {/* Artwork */}
            <div className="w-full max-w-xs md:max-w-sm aspect-square mb-8 rounded-2xl overflow-hidden shadow-2xl">
              <img src={currentSong.thumbnail} alt={currentSong.title} className="w-full h-full object-cover" />
            </div>

            {/* Info */}
            <div className="w-full max-w-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0 pr-4">
                  <h2 className="text-2xl font-bold text-white truncate">{currentSong.title}</h2>
                  <p className="text-white/60 truncate">{currentSong.artist}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${srcInfo.bg} text-white font-medium mt-1 inline-block`}>
                    {sourceIcons[currentSong.source]} {srcInfo.label}
                  </span>
                </div>
                <button onClick={() => toggleFavorite(currentSong)} className={`p-2 flex-shrink-0 ${isFav ? "text-[#1DB954]" : "text-white/50 hover:text-white"}`}>
                  <Heart className={`w-6 h-6 ${isFav ? "fill-current" : ""}`} />
                </button>
              </div>

              {/* Progress */}
              <Slider value={[progress]} max={duration || 100} step={1} onValueChange={([v]) => seek(v)} className="w-full mb-1" />
              <div className="flex justify-between text-xs text-white/50 mb-6">
                <span>{formatTime(progress)}</span>
                <span>{formatTime(duration)}</span>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between mb-6">
                <button onClick={toggleShuffle} className={`${shuffle ? "text-[#1DB954]" : "text-white/50 hover:text-white"}`}><Shuffle className="w-5 h-5" /></button>
                <button onClick={prev} className="text-white hover:text-[#1DB954] transition-colors"><SkipBack className="w-8 h-8 fill-current" /></button>
                <button onClick={handlePlayPause} className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow-lg">
                  {isBuffering ? (
                    <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                </button>
                <button onClick={next} className="text-white hover:text-[#1DB954] transition-colors"><SkipForward className="w-8 h-8 fill-current" /></button>
                <button onClick={toggleRepeat} className={`${repeat !== "none" ? "text-[#1DB954]" : "text-white/50 hover:text-white"}`}><RepeatIcon className="w-5 h-5" /></button>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-3">
                <button onClick={handleMute} className="text-white/50 hover:text-white">
                  {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <Slider value={[isMuted ? 0 : volume * 100]} max={100} step={1} onValueChange={([v]) => { setVolume(v / 100); if (v > 0) setIsMuted(false); }} className="flex-1" />
              </div>

              {/* Bottom actions */}
              <div className="flex items-center justify-between mt-6">
                <button onClick={handleDownload} disabled={isDownloading} className="flex items-center gap-2 text-white/50 hover:text-white disabled:opacity-30 transition-colors text-sm">
                  <Download className="w-4 h-4" /> {isDownloading ? "Downloading…" : "Download"}
                </button>
                <button onClick={() => setShowQueue(q => !q)} className={`flex items-center gap-2 text-sm transition-colors ${showQueue ? "text-[#1DB954]" : "text-white/50 hover:text-white"}`}>
                  <ListMusic className="w-4 h-4" /> Queue
                </button>
              </div>
            </div>
          </div>

          {/* Queue in expanded */}
          {showQueue && (
            <div className="relative w-full md:w-80 bg-black/60 backdrop-blur-xl border-t md:border-t-0 md:border-l border-white/10 flex flex-col max-h-60 md:max-h-full">
              <div className="p-4 border-b border-white/10">
                <h3 className="text-white font-semibold">Up next ({queue.length})</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {queue.map((song, i) => {
                  const isCurr = song.videoId === currentSong.videoId;
                  return (
                    <div key={`${song.videoId}-${i}`} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${isCurr ? "bg-white/10" : "hover:bg-white/5"}`}>
                      <img src={song.thumbnail} className="w-10 h-10 rounded object-cover" alt="" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${isCurr ? "text-[#1DB954]" : "text-white"}`}>{song.title}</p>
                        <p className="text-white/50 text-[10px] truncate">{song.artist}</p>
                      </div>
                      {isCurr && isPlaying && <div className="w-2 h-2 bg-[#1DB954] rounded-full animate-pulse" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
