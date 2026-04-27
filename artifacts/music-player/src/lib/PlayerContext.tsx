import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "./supabase";
import type { Song } from "./musicApi";

export type { Song };

interface PlayerContextType {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  isBuffering: boolean;
  shuffle: boolean;
  repeat: "none" | "one" | "all";
  playSong: (song: Song, queue?: Song[]) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
  seek: (t: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addToQueue: (song: Song) => void;
  removeFromQueue: (videoId: string) => void;
  clearQueue: () => void;
  isFavorite: (videoId: string) => boolean;
  toggleFavorite: (song: Song) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"none" | "one" | "all">("none");
  const resolveRef = useRef<string | null>(null);

  // Initialize audio
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audio.preload = "auto";
    audioRef.current = audio;

    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onDuration = () => setDuration(audio.duration);
    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);
    const onEnded = () => handleEnded();
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.pause();
    };
  }, []);

  // Media Session API
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentSong) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist,
      artwork: [{ src: currentSong.thumbnail, sizes: "512x512", type: "image/jpeg" }]
    });
    navigator.mediaSession.setActionHandler("play", () => resume());
    navigator.mediaSession.setActionHandler("pause", () => pause());
    navigator.mediaSession.setActionHandler("nexttrack", () => next());
    navigator.mediaSession.setActionHandler("previoustrack", () => prev());
  }, [currentSong]);

  // Load favorites from Supabase or localStorage
  useEffect(() => {
    const stored = localStorage.getItem("musika-favorites");
    if (stored) {
      try { setFavorites(new Set(JSON.parse(stored))); } catch {}
    }
    loadFavoritesFromDB();
  }, []);

  async function loadFavoritesFromDB() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from("favorites").select("video_id");
      if (data) setFavorites(new Set(data.map((f: any) => f.video_id)));
    } catch {}
  }

  function handleEnded() {
    if (repeat === "one") {
      const audio = audioRef.current;
      if (audio) { audio.currentTime = 0; audio.play(); }
    } else if (queue.length > 1) {
      next();
    } else if (repeat === "all" && queue.length > 0) {
      playSong(queue[0], queue);
    }
  }

  async function resolveStreamUrl(song: Song): Promise<string> {
    // For YouTube, use download API to get MP3 URL
    if (song.source === "youtube" && song.url) {
      try {
        const res = await fetch(`${BASE}/api/music/download?url=${encodeURIComponent(song.url)}&source=youtube`);
        const data = await res.json();
        if (data.success && data.download_url) {
          return `${BASE}/api/music/stream?url=${encodeURIComponent(data.download_url)}`;
        }
      } catch {}
    }
    // For other sources, try download endpoint
    if (song.url) {
      try {
        const res = await fetch(`${BASE}/api/music/download?url=${encodeURIComponent(song.url)}&source=${song.source}`);
        const data = await res.json();
        if (data.success && data.download_url) {
          return `${BASE}/api/music/stream?url=${encodeURIComponent(data.download_url)}`;
        }
      } catch {}
    }
    return `${BASE}/api/music/stream?url=${encodeURIComponent(song.url)}`;
  }

  const playSong = useCallback(async (song: Song, newQueue?: Song[]) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (newQueue) {
      setQueue(newQueue);
      const idx = newQueue.findIndex(s => s.videoId === song.videoId);
      setQueueIndex(idx >= 0 ? idx : 0);
    }

    setCurrentSong(song);
    setIsBuffering(true);
    audio.pause();
    audio.src = "";

    // Track in DB
    recordHistory(song);

    // Resolve stream URL
    const songKey = song.videoId;
    resolveRef.current = songKey;

    try {
      const streamUrl = await resolveStreamUrl(song);
      if (resolveRef.current !== songKey) return; // Song changed while resolving
      audio.src = streamUrl;
      await audio.play();
      setIsPlaying(true);
    } catch (err: any) {
      toast({ title: "Playback error", description: err.message, variant: "destructive" });
      setIsBuffering(false);
      setIsPlaying(false);
    }

    // Update Media Session
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist,
        artwork: [{ src: song.thumbnail, sizes: "512x512", type: "image/jpeg" }]
      });
    }
  }, []);

  async function recordHistory(song: Song) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.from("play_history").insert({
        user_id: session.user.id,
        video_id: song.videoId,
        title: song.title,
        artist: song.artist,
        thumbnail: song.thumbnail,
        duration: song.duration,
        source: song.source,
        url: song.url
      });
    } catch {}
  }

  function pause() {
    audioRef.current?.pause();
    setIsPlaying(false);
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
  }

  function resume() {
    audioRef.current?.play().catch(() => {});
    setIsPlaying(true);
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
  }

  function next() {
    if (queue.length === 0) return;
    let nextIdx: number;
    if (shuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else {
      nextIdx = (queueIndex + 1) % queue.length;
    }
    setQueueIndex(nextIdx);
    playSong(queue[nextIdx], queue);
  }

  function prev() {
    if (queue.length === 0) return;
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const prevIdx = (queueIndex - 1 + queue.length) % queue.length;
    setQueueIndex(prevIdx);
    playSong(queue[prevIdx], queue);
  }

  function setVolume(v: number) {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  }

  function seek(t: number) {
    if (audioRef.current) {
      audioRef.current.currentTime = t;
      setProgress(t);
    }
  }

  function toggleShuffle() { setShuffle(s => !s); }
  function toggleRepeat() {
    setRepeat(r => r === "none" ? "all" : r === "all" ? "one" : "none");
  }

  function addToQueue(song: Song) {
    setQueue(q => [...q, song]);
    toast({ title: "Added to queue", description: song.title });
  }

  function removeFromQueue(videoId: string) {
    setQueue(q => q.filter(s => s.videoId !== videoId));
  }

  function clearQueue() { setQueue([]); }

  function isFavorite(videoId: string) { return favorites.has(videoId); }

  async function toggleFavorite(song: Song) {
    const isFav = favorites.has(song.videoId);
    const newFavs = new Set(favorites);
    if (isFav) {
      newFavs.delete(song.videoId);
      toast({ title: "Removed from favorites" });
    } else {
      newFavs.add(song.videoId);
      toast({ title: "Added to favorites ♥", description: song.title });
    }
    setFavorites(newFavs);
    localStorage.setItem("musika-favorites", JSON.stringify([...newFavs]));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      if (isFav) {
        await supabase.from("favorites").delete()
          .eq("user_id", session.user.id).eq("video_id", song.videoId);
      } else {
        await supabase.from("favorites").upsert({
          user_id: session.user.id,
          video_id: song.videoId,
          title: song.title,
          artist: song.artist,
          thumbnail: song.thumbnail,
          duration: song.duration,
          source: song.source,
          url: song.url
        });
      }
    } catch {}
  }

  return (
    <PlayerContext.Provider value={{
      currentSong, queue, isPlaying, volume, progress, duration, isBuffering,
      shuffle, repeat,
      playSong, pause, resume, next, prev, setVolume, seek,
      toggleShuffle, toggleRepeat,
      addToQueue, removeFromQueue, clearQueue,
      isFavorite, toggleFavorite
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
