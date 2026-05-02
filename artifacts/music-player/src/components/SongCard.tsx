import React, { useState } from "react";
import { Play, Pause, Heart, MoreHorizontal, Plus, Download, Loader2 } from "lucide-react";
import type { Song } from "@/lib/musicApi";
import { usePlayer } from "@/lib/PlayerContext";
import { sourceLabels } from "@/lib/musicApi";
import { YouTubeIcon, SpotifyIcon, AppleMusicIcon, SoundCloudIcon, GlobeIcon } from "@/components/SourceIcon";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { getHQThumbnail, onThumbnailError } from "@/lib/utils";

const SOURCE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  youtube:    YouTubeIcon,
  spotify:    SpotifyIcon,
  apple:      AppleMusicIcon,
  soundcloud: SoundCloudIcon,
};

interface SongCardProps {
  song: Song;
  queue?: Song[];
  variant?: "default" | "compact" | "list";
  index?: number;
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export function SongCard({ song, queue, variant = "default", index }: SongCardProps) {
  const { currentSong, isPlaying, isResolving, playSong, pause, resume, toggleFavorite, isFavorite, addToQueue } = usePlayer();
  const [downloading, setDownloading] = useState(false);

  const isActive    = currentSong?.videoId === song.videoId;
  const isLoading   = isActive && isResolving;
  const isFav       = isFavorite(song.videoId);
  const srcInfo     = sourceLabels[song.source] || { label: song.source, color: "#888", bg: "bg-gray-600" };
  const SourceIconComp = SOURCE_ICON_MAP[song.source] || GlobeIcon;

  const thumb = getHQThumbnail(song.thumbnail);

  const handlePlay = () => {
    if (isActive && !isResolving) {
      if (isPlaying) pause();
      else resume();
    } else if (isActive && isResolving) {
      return;
    } else {
      playSong(song, queue || [song]);
    }
  };

  const handleDownload = async () => {
    if (!song.url) { toast({ title: "Tidak ada URL unduhan", variant: "destructive" }); return; }
    setDownloading(true);
    try {
      const res = await fetch(`${BASE}/api/music/download?url=${encodeURIComponent(song.url)}&source=${song.source}`);
      const data = await res.json();
      if (data.success && data.download_url) {
        const a = document.createElement("a");
        a.href = data.download_url;
        a.download = `${song.title}.mp3`;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast({ title: "✓ Unduhan dimulai", description: song.title });
      } else {
        throw new Error(data.error || "Download gagal");
      }
    } catch (e: any) {
      toast({ title: "Gagal mengunduh", description: e.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  // ─── List variant ─────────────────────────────────────────────────────────────
  if (variant === "list") {
    return (
      <div
        className={`flex items-center gap-3 px-4 py-2 rounded-md group hover:bg-white/5 transition-colors cursor-pointer ${isActive ? "bg-white/10" : ""} ${isLoading ? "opacity-90" : ""}`}
        onClick={handlePlay}
      >
        {index !== undefined && (
          <span className={`w-6 text-center text-sm ${isActive ? "text-[#1DB954]" : "text-white/40"} group-hover:hidden`}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-[#1DB954] inline" /> : isActive && isPlaying ? "▶" : index + 1}
          </span>
        )}
        <div className="w-6 hidden group-hover:flex items-center justify-center">
          {isLoading
            ? <Loader2 className="w-4 h-4 text-[#1DB954] animate-spin" />
            : isActive && isPlaying
              ? <Pause className="w-4 h-4 text-white" />
              : <Play className="w-4 h-4 text-white fill-white" />
          }
        </div>

        <div className="relative flex-shrink-0">
          <img
            src={thumb}
            alt={song.title}
            className={`w-10 h-10 rounded object-cover img-hq ${isLoading ? "opacity-60" : ""}`}
            loading="lazy"
            decoding="async"
            onError={(e) => onThumbnailError(e, song.thumbnail)}
          />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center rounded bg-black/50">
              <Loader2 className="w-4 h-4 text-[#1DB954] animate-spin" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isActive ? "text-[#1DB954]" : "text-white"}`}>{song.title}</p>
          <p className="text-xs text-white/50 truncate">
            {isLoading ? <span className="text-[#1DB954] animate-pulse">Memuat…</span> : song.artist}
          </p>
        </div>

        <span className={`text-xs px-2 py-0.5 rounded-full ${srcInfo.bg} text-white font-medium flex-shrink-0 flex items-center gap-1`}>
          <SourceIconComp className="w-2.5 h-2.5" /> {srcInfo.label}
        </span>
        <span className="text-white/40 text-xs flex-shrink-0">{song.duration}</span>

        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(song); }}
          className={`p-1 opacity-0 group-hover:opacity-100 transition-opacity ${isFav ? "text-[#1DB954] opacity-100" : "text-white/50 hover:text-white"}`}
        >
          <Heart className={`w-4 h-4 ${isFav ? "fill-current" : ""}`} />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button onClick={e => e.stopPropagation()} className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-white/50 hover:text-white">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#282828] border-white/10">
            <DropdownMenuItem onClick={() => addToQueue(song)} className="cursor-pointer text-white hover:bg-white/10">
              <Plus className="w-4 h-4 mr-2" /> Tambah ke Antrean
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownload} disabled={downloading} className="cursor-pointer text-white hover:bg-white/10">
              <Download className="w-4 h-4 mr-2" /> {downloading ? "Mengunduh…" : "Unduh MP3"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // ─── Default / Compact card variant ─────────────────────────────────────────
  return (
    <div
      className={`group relative flex flex-col rounded-lg bg-[#181818] hover:bg-[#282828] transition-all duration-200 cursor-pointer p-4 ${isActive ? "ring-1 ring-[#1DB954]/30" : ""}`}
      onClick={handlePlay}
    >
      {/* Thumbnail */}
      <div className="relative mb-4">
        <img
          src={thumb}
          alt={song.title}
          className={`w-full aspect-square object-cover rounded-md shadow-lg img-hq transition-all duration-300 ${isLoading ? "brightness-50" : ""}`}
          loading="lazy"
          decoding="async"
          onError={(e) => onThumbnailError(e, song.thumbnail)}
        />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-md bg-black/60 gap-2">
            <Loader2 className="w-8 h-8 text-[#1DB954] animate-spin" />
            <span className="text-[10px] text-[#1DB954] font-medium animate-pulse px-2 text-center">Memuat…</span>
          </div>
        )}

        {/* Play button */}
        {!isLoading && (
          <button
            className="absolute bottom-2 right-2 w-12 h-12 rounded-full bg-[#1DB954] text-black flex items-center justify-center shadow-lg transition-all duration-200 translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 hover:scale-105 hover:bg-[#1ed760]"
            onClick={(e) => { e.stopPropagation(); handlePlay(); }}
          >
            {isActive && isPlaying
              ? <Pause className="w-5 h-5 fill-current" />
              : <Play className="w-5 h-5 fill-current ml-0.5" />
            }
          </button>
        )}

        {/* Source badge */}
        <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full ${srcInfo.bg} text-white font-medium flex items-center gap-1`}>
          <SourceIconComp className="w-2.5 h-2.5" /> {srcInfo.label}
        </span>

        {/* Playing indicator */}
        {isActive && isPlaying && !isLoading && (
          <div className="absolute bottom-2 left-2 flex items-end gap-0.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-0.5 bg-[#1DB954] rounded-full"
                style={{ animation: "musicBar 0.8s ease-in-out infinite", animationDelay: `${i * 0.15}s`, height: "10px" }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Song info */}
      <div className="flex-1 min-w-0">
        <h3 className={`font-semibold text-sm truncate ${isActive ? "text-[#1DB954]" : "text-white"}`}>{song.title}</h3>
        <p className="text-white/60 text-xs mt-0.5 truncate">
          {isLoading
            ? <span className="text-[#1DB954]/80 animate-pulse">Memuat audio…</span>
            : song.artist
          }
        </p>
        <p className="text-white/40 text-xs mt-0.5">{song.duration}</p>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between mt-2">
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(song); }}
          className={`p-1 transition-colors ${isFav ? "text-[#1DB954]" : "text-white/30 hover:text-white"}`}
        >
          <Heart className={`w-4 h-4 ${isFav ? "fill-current" : ""}`} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button onClick={e => e.stopPropagation()} className="p-1 text-white/30 hover:text-white transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#282828] border-white/10">
            <DropdownMenuItem onClick={() => addToQueue(song)} className="cursor-pointer text-white hover:bg-white/10">
              <Plus className="w-4 h-4 mr-2" /> Tambah ke Antrean
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownload} disabled={downloading} className="cursor-pointer text-white hover:bg-white/10">
              <Download className="w-4 h-4 mr-2" /> {downloading ? "Mengunduh…" : "Unduh MP3"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
