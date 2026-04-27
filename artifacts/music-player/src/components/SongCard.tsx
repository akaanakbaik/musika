import React, { useState } from "react";
import { Play, Pause, Heart, MoreHorizontal, Plus, Download, Clock, Share2 } from "lucide-react";
import type { Song } from "@/lib/musicApi";
import { usePlayer } from "@/lib/PlayerContext";
import { sourceLabels, sourceIcons } from "@/lib/musicApi";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";

interface SongCardProps {
  song: Song;
  queue?: Song[];
  variant?: "default" | "compact" | "list";
  index?: number;
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export function SongCard({ song, queue, variant = "default", index }: SongCardProps) {
  const { currentSong, isPlaying, playSong, pause, resume, toggleFavorite, isFavorite, addToQueue } = usePlayer();
  const [downloading, setDownloading] = useState(false);
  const isActive = currentSong?.videoId === song.videoId;
  const isFav = isFavorite(song.videoId);
  const srcInfo = sourceLabels[song.source] || { label: song.source, color: "#888", bg: "bg-gray-600" };

  const handlePlay = () => {
    if (isActive) {
      if (isPlaying) pause();
      else resume();
    } else {
      playSong(song, queue || [song]);
    }
  };

  const handleDownload = async () => {
    if (!song.url) { toast({ title: "No download URL", variant: "destructive" }); return; }
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
        toast({ title: "Download started", description: song.title });
      } else {
        throw new Error(data.error || "Download failed");
      }
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  if (variant === "list") {
    return (
      <div
        className={`flex items-center gap-3 px-4 py-2 rounded-md group hover:bg-white/5 transition-colors cursor-pointer ${isActive ? "bg-white/10" : ""}`}
        onClick={handlePlay}
      >
        {index !== undefined && (
          <span className={`w-6 text-center text-sm ${isActive ? "text-[#1DB954]" : "text-white/40"} group-hover:hidden`}>
            {isActive && isPlaying ? "▶" : index + 1}
          </span>
        )}
        <div className="w-6 hidden group-hover:flex items-center justify-center">
          {isActive && isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white fill-white" />}
        </div>
        <img src={song.thumbnail} alt={song.title} className="w-10 h-10 rounded object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/40x40/333/999?text=♪"; }} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isActive ? "text-[#1DB954]" : "text-white"}`}>{song.title}</p>
          <p className="text-xs text-white/50 truncate">{song.artist}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${srcInfo.bg} text-white font-medium flex-shrink-0`}>
          {sourceIcons[song.source]} {srcInfo.label}
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
            <button
              onClick={e => e.stopPropagation()}
              className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-white/50 hover:text-white"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#282828] border-white/10">
            <DropdownMenuItem onClick={() => addToQueue(song)} className="cursor-pointer text-white hover:bg-white/10">
              <Plus className="w-4 h-4 mr-2" /> Add to Queue
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownload} disabled={downloading} className="cursor-pointer text-white hover:bg-white/10">
              <Download className="w-4 h-4 mr-2" /> {downloading ? "Downloading..." : "Download MP3"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="group relative flex flex-col rounded-lg bg-[#181818] hover:bg-[#282828] transition-all duration-200 cursor-pointer p-4">
      <div className="relative mb-4" onClick={handlePlay}>
        <img
          src={song.thumbnail}
          alt={song.title}
          className="w-full aspect-square object-cover rounded-md shadow-lg"
          onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/200x200/333/999?text=♪"; }}
        />
        <button
          className={`absolute bottom-2 right-2 w-12 h-12 rounded-full bg-[#1DB954] text-black flex items-center justify-center shadow-lg transition-all duration-200 translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 hover:scale-105`}
        >
          {isActive && isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
        </button>
        <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full ${srcInfo.bg} text-white font-medium`}>
          {sourceIcons[song.source]} {srcInfo.label}
        </span>
      </div>
      <div className="flex-1 min-w-0" onClick={handlePlay}>
        <h3 className={`font-semibold text-sm truncate ${isActive ? "text-[#1DB954]" : "text-white"}`}>{song.title}</h3>
        <p className="text-white/60 text-xs mt-1 truncate">{song.artist}</p>
        <p className="text-white/40 text-xs mt-0.5">{song.duration}</p>
      </div>
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
              <Plus className="w-4 h-4 mr-2" /> Add to Queue
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownload} disabled={downloading} className="cursor-pointer text-white hover:bg-white/10">
              <Download className="w-4 h-4 mr-2" /> {downloading ? "Downloading..." : "Download MP3"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
