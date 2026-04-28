import React, { useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2, Download, Heart, ListMusic, Shuffle, Repeat, Repeat1, X, ChevronDown, Loader2, Plus } from "lucide-react";
import { usePlayer } from "@/lib/PlayerContext";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { sourceLabels } from "@/lib/musicApi";
import { YouTubeIcon, SpotifyIcon, AppleMusicIcon, SoundCloudIcon, GlobeIcon } from "@/components/SourceIcon";
import { useAppSettings } from "@/lib/AppSettingsContext";
import AddToPlaylistModal from "./AddToPlaylistModal";
import { api } from "@/lib/config";

const SOURCE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  youtube: YouTubeIcon, spotify: SpotifyIcon, apple: AppleMusicIcon, soundcloud: SoundCloudIcon,
};

function formatTime(s: number) {
  if (isNaN(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function Player() {
  const {
    currentSong, isPlaying, isResolving, resolvingStep,
    progress, duration, volume, isBuffering,
    shuffle, repeat, pause, resume, next, prev, setVolume, seek,
    toggleShuffle, toggleRepeat, toggleFavorite, isFavorite, queue, removeFromQueue
  } = usePlayer();
  const { theme, accentColor } = useAppSettings();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.8);
  const [dismissed, setDismissed] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  // Reset dismissed when a new song starts
  React.useEffect(() => { setDismissed(false); }, [currentSong?.videoId]);

  if (!currentSong || dismissed) return null;

  const isDark = theme === "dark";
  const isFav = isFavorite(currentSong.videoId);
  const srcInfo = sourceLabels[currentSong.source] || { label: currentSong.source, bg: "bg-gray-600" };
  const SourceIconComp = SOURCE_ICON_MAP[currentSong.source] || GlobeIcon;

  const handlePlayPause = () => { if (isResolving) return; if (isPlaying) pause(); else resume(); };
  const handleMute = () => {
    if (isMuted) { setVolume(prevVolume); setIsMuted(false); }
    else { setPrevVolume(volume); setVolume(0); setIsMuted(true); }
  };

  const handleDownload = async () => {
    if (!currentSong.url) return;
    setIsDownloading(true);
    try {
      toast({ title: "⬇️ Mengunduh…", description: currentSong.title });
      const res = await fetch(`${api("/api/music/download")}?url=${encodeURIComponent(currentSong.url)}&source=${currentSong.source}`);
      const data = await res.json();
      if (data.success && data.download_url) {
        const a = document.createElement("a");
        a.href = data.download_url;
        a.download = `${currentSong.title}.mp3`;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast({ title: "✓ Unduhan dimulai", description: currentSong.title });
      } else throw new Error(data.error || "Gagal mendapatkan URL unduhan");
    } catch (e: any) {
      toast({ title: "Gagal mengunduh", description: e.message, variant: "destructive" });
    } finally { setIsDownloading(false); }
  };

  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  const miniPlayerBg = isDark ? "bg-[#181818] border-white/10" : "bg-white border-black/10";
  const miniTextP = isDark ? "text-white" : "text-[#121212]";
  const miniTextS = isDark ? "text-white/50" : "text-[#121212]/50";

  return (
    <>
      {/* ===== MINI PLAYER ===== */}
      <div className={`fixed bottom-[60px] md:bottom-0 left-0 right-0 z-50 border-t ${miniPlayerBg} shadow-lg`}>
        {/* Progress bar */}
        <div className={`w-full h-0.5 ${isDark ? "bg-white/10" : "bg-black/10"} cursor-pointer`} onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          seek((e.clientX - rect.left) / rect.width * (duration || 0));
        }}>
          <div className="h-full transition-all" style={{ width: `${duration ? (progress / duration) * 100 : 0}%`, background: accentColor }} />
        </div>

        <div className="flex items-center px-3 md:px-6 h-[68px] md:h-[80px] gap-3">
          {/* Song info */}
          <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => setIsExpanded(true)}>
            <div className="relative flex-shrink-0">
              <img
                src={currentSong.thumbnail}
                alt={currentSong.title}
                className={`w-12 h-12 rounded-lg object-cover transition-opacity duration-300 ${isResolving ? "opacity-50" : "opacity-100"}`}
                onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/48x48/333/999?text=♪"; }}
              />
              {isResolving && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
              {!isResolving && isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30">
                  <div className="flex gap-0.5">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-0.5 rounded-full bg-white" style={{ animation: "musicBar 0.8s ease-in-out infinite", animationDelay: `${i * 0.1}s`, height: "10px" }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate ${miniTextP}`}>{currentSong.title}</p>
              <p className={`text-xs truncate ${miniTextS}`}>
                {isResolving
                  ? <span className="animate-pulse" style={{ color: accentColor }}>{resolvingStep || "Memuat…"}</span>
                  : currentSong.artist
                }
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => toggleFavorite(currentSong)} className={`p-1.5 ${isFav ? "text-red-400" : miniTextS} transition-colors`}>
              <Heart className={`w-4 h-4 ${isFav ? "fill-current" : ""}`} />
            </button>

            <button onClick={prev} className={`hidden md:block p-1.5 ${miniTextS} hover:${miniTextP} transition-colors`}>
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            <button
              onClick={handlePlayPause}
              disabled={isResolving}
              className="w-10 h-10 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform disabled:opacity-80"
              style={{ background: accentColor }}
            >
              {isResolving ? <Loader2 className="w-4 h-4 text-black animate-spin" />
                : isBuffering ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                : isPlaying ? <Pause className="w-4 h-4 fill-black text-black" />
                : <Play className="w-4 h-4 fill-black text-black ml-0.5" />
              }
            </button>

            <button onClick={next} className={`p-1.5 ${miniTextS} hover:${miniTextP} transition-colors`}>
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            {/* Add to playlist — mobile */}
            <button onClick={() => setShowPlaylistModal(true)} className={`p-1.5 ${miniTextS} hover:${miniTextP} transition-colors`} title="Tambah ke playlist">
              <Plus className="w-4 h-4" />
            </button>

            {/* Dismiss X */}
            <button onClick={() => { if (isPlaying) pause(); setDismissed(true); }} className={`p-1.5 ${miniTextS} hover:text-red-400 transition-colors`} title="Tutup player">
              <X className="w-4 h-4" />
            </button>

            <button onClick={() => setIsExpanded(true)} className={`hidden md:block p-1.5 ${miniTextS} hover:${miniTextP} transition-colors`}>
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Desktop extra controls */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            <button onClick={toggleShuffle} className={`transition-colors ${shuffle ? "" : miniTextS}`} style={shuffle ? { color: accentColor } : {}}>
              <Shuffle className="w-4 h-4" />
            </button>
            <button onClick={toggleRepeat} className={`transition-colors ${repeat !== "none" ? "" : miniTextS}`} style={repeat !== "none" ? { color: accentColor } : {}}>
              <RepeatIcon className="w-4 h-4" />
            </button>
            <button onClick={handleDownload} disabled={isDownloading} className={`${miniTextS} hover:${miniTextP} disabled:opacity-30`}>
              <Download className="w-4 h-4" />
            </button>
            <button onClick={handleMute} className={`${miniTextS} hover:${miniTextP}`}>
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <div className="w-20">
              <Slider value={[isMuted ? 0 : volume * 100]} max={100} step={1}
                onValueChange={([v]) => { setVolume(v / 100); if (v > 0) setIsMuted(false); }}
                className="h-1" />
            </div>
            <button onClick={() => setShowQueue(q => !q)} className={`transition-colors ${showQueue ? "" : miniTextS}`} style={showQueue ? { color: accentColor } : {}}>
              <ListMusic className="w-4 h-4" />
            </button>
          </div>

          {/* Desktop progress */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0 w-44">
            <span className={`text-xs w-8 text-right ${miniTextS}`}>{formatTime(progress)}</span>
            <Slider value={[progress]} max={duration || 100} step={1} onValueChange={([v]) => seek(v)} className="flex-1 h-1 cursor-pointer" />
            <span className={`text-xs w-8 ${miniTextS}`}>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Queue panel */}
      {showQueue && !isExpanded && (
        <div className={`fixed bottom-[80px] right-4 w-72 rounded-xl border shadow-2xl z-50 flex flex-col max-h-[60vh] ${isDark ? "bg-[#282828] border-white/10" : "bg-white border-black/10"}`}>
          <div className={`flex items-center justify-between p-4 border-b ${isDark ? "border-white/10" : "border-black/10"}`}>
            <h3 className={`font-semibold text-sm ${isDark ? "text-white" : "text-[#121212]"}`}>Queue ({queue.length})</h3>
            <button onClick={() => setShowQueue(false)} className={isDark ? "text-white/50 hover:text-white" : "text-black/50 hover:text-black"}><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {queue.map((song, i) => {
              const isCurr = song.videoId === currentSong.videoId;
              return (
                <div key={`${song.videoId}-${i}`} className={`flex items-center gap-3 p-2 rounded-lg ${isCurr ? (isDark ? "bg-white/10" : "bg-black/10") : (isDark ? "hover:bg-white/5" : "hover:bg-black/5")}`}>
                  <img src={song.thumbnail} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" alt="" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={isCurr ? { color: accentColor } : { color: isDark ? "white" : "#121212" }}>{song.title}</p>
                    <p className={`text-[10px] truncate ${isDark ? "text-white/40" : "text-black/40"}`}>{song.artist}</p>
                  </div>
                  {isCurr && isPlaying && <div className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: accentColor }} />}
                  {!isCurr && <button onClick={() => removeFromQueue(song.videoId)} className={`${isDark ? "text-white/30 hover:text-white" : "text-black/30 hover:text-black"} flex-shrink-0`}><X className="w-3 h-3" /></button>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== EXPANDED PLAYER ===== */}
      {isExpanded && (
        <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden" style={{ background: isDark ? "#0d0d0d" : "#f0f0f0" }}>
          {/* Blurred BG */}
          <div className="absolute inset-0" style={{ backgroundImage: `url(${currentSong.thumbnail})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(60px) brightness(0.25) saturate(2)", transform: "scale(1.15)" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/80" />

          <div className="relative flex-1 flex flex-col items-center justify-start px-6 pt-14 pb-4 overflow-y-auto">
            {/* Close */}
            <button onClick={() => setIsExpanded(false)} className="absolute top-6 left-6 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white/80 hover:text-white">
              <ChevronDown className="w-6 h-6" />
            </button>

            {/* Source badge */}
            <div className="absolute top-7 right-6">
              <span className={`text-xs px-2.5 py-1 rounded-full ${srcInfo.bg} text-white flex items-center gap-1.5`}>
                <SourceIconComp className="w-3 h-3" /> {srcInfo.label}
              </span>
            </div>

            {/* Artwork */}
            <div className="w-full max-w-[280px] md:max-w-sm aspect-square rounded-2xl overflow-hidden shadow-2xl mb-8 mt-4">
              <img src={currentSong.thumbnail} alt={currentSong.title} className="w-full h-full object-cover" />
            </div>

            {/* Info + heart */}
            <div className="w-full max-w-sm">
              <div className="flex items-start justify-between mb-5">
                <div className="flex-1 min-w-0 pr-4">
                  <h2 className="text-2xl font-bold text-white truncate">{currentSong.title}</h2>
                  <p className="text-white/60 text-base truncate mt-0.5">
                    {isResolving ? <span className="animate-pulse" style={{ color: accentColor }}>{resolvingStep || "Memuat…"}</span> : currentSong.artist}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => setShowPlaylistModal(true)} className="p-1.5 text-white/50 hover:text-white transition-colors" title="Tambah ke playlist">
                    <Plus className="w-5 h-5" />
                  </button>
                  <button onClick={() => toggleFavorite(currentSong)} className={`p-1.5 flex-shrink-0 transition-colors ${isFav ? "text-red-400" : "text-white/50 hover:text-white"}`}>
                    <Heart className={`w-6 h-6 ${isFav ? "fill-current" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Progress */}
              <div className="mb-5">
                <Slider value={[progress]} max={duration || 100} step={0.5} onValueChange={([v]) => seek(v)} className="w-full mb-2" />
                <div className="flex justify-between text-xs text-white/50">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between mb-6">
                <button onClick={toggleShuffle} className={`transition-colors ${shuffle ? "" : "text-white/40"}`} style={shuffle ? { color: accentColor } : {}}>
                  <Shuffle className="w-6 h-6" />
                </button>
                <button onClick={prev} className="text-white hover:text-white/80 transition-colors">
                  <SkipBack className="w-9 h-9 fill-current" />
                </button>
                <button
                  onClick={handlePlayPause}
                  disabled={isResolving}
                  className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-transform disabled:opacity-80"
                  style={{ background: accentColor }}
                >
                  {isResolving ? <Loader2 className="w-6 h-6 text-black animate-spin" />
                    : isBuffering ? <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    : isPlaying ? <Pause className="w-7 h-7 fill-black text-black" />
                    : <Play className="w-7 h-7 fill-black text-black ml-1" />
                  }
                </button>
                <button onClick={next} className="text-white hover:text-white/80 transition-colors">
                  <SkipForward className="w-9 h-9 fill-current" />
                </button>
                <button onClick={toggleRepeat} className={`transition-colors ${repeat !== "none" ? "" : "text-white/40"}`} style={repeat !== "none" ? { color: accentColor } : {}}>
                  <RepeatIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-3 mb-5">
                <button onClick={handleMute} className="text-white/50 hover:text-white flex-shrink-0">
                  {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <Slider value={[isMuted ? 0 : volume * 100]} max={100} step={1}
                  onValueChange={([v]) => { setVolume(v / 100); if (v > 0) setIsMuted(false); }}
                  className="flex-1" />
              </div>

              {/* Actions row */}
              <div className="flex items-center justify-around pt-2 pb-safe">
                <button onClick={handleDownload} disabled={isDownloading} className="flex flex-col items-center gap-1.5 text-white/50 hover:text-white disabled:opacity-30 transition-colors">
                  <Download className="w-5 h-5" />
                  <span className="text-[10px]">{isDownloading ? "Mengunduh…" : "Unduh"}</span>
                </button>
                <button onClick={() => setShowPlaylistModal(true)} className="flex flex-col items-center gap-1.5 text-white/50 hover:text-white transition-colors">
                  <Plus className="w-5 h-5" />
                  <span className="text-[10px]">Playlist</span>
                </button>
                <button onClick={() => setShowQueue(q => !q)} className="flex flex-col items-center gap-1.5 transition-colors" style={showQueue ? { color: accentColor } : { color: "rgba(255,255,255,0.5)" }}>
                  <ListMusic className="w-5 h-5" />
                  <span className="text-[10px]">Queue</span>
                </button>
              </div>
            </div>
          </div>

          {/* Queue overlay */}
          {showQueue && (
            <div className="absolute inset-x-0 bottom-0 max-h-[50%] bg-black/80 backdrop-blur-xl rounded-t-3xl flex flex-col">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">Berikutnya ({queue.length})</h3>
                <button onClick={() => setShowQueue(false)} className="text-white/50"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {queue.map((song, i) => {
                  const isCurr = song.videoId === currentSong.videoId;
                  return (
                    <div key={`${song.videoId}-${i}`} className={`flex items-center gap-3 p-2 rounded-xl ${isCurr ? "bg-white/15" : "hover:bg-white/5"}`}>
                      <img src={song.thumbnail} className="w-10 h-10 rounded-lg object-cover" alt="" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: isCurr ? accentColor : "white" }}>{song.title}</p>
                        <p className="text-white/40 text-[10px] truncate">{song.artist}</p>
                      </div>
                      {isCurr && isPlaying && <div className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: accentColor }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add to playlist modal */}
      {showPlaylistModal && (
        <AddToPlaylistModal
          song={currentSong}
          onClose={() => setShowPlaylistModal(false)}
        />
      )}
    </>
  );
}
