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

// Cache resolved stream URLs so we don't re-fetch for same song
const streamUrlCache = new Map<string, string>();

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
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const repeatRef = useRef(repeat);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onDuration = () => { if (!isNaN(audio.duration)) setDuration(audio.duration); };
    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);
    const onPlay = () => { setIsPlaying(true); setIsBuffering(false); };
    const onPause = () => setIsPlaying(false);
    const onError = (e: Event) => {
      const err = (e.target as HTMLAudioElement).error;
      console.warn("Audio error:", err?.message);
      setIsBuffering(false);
    };
    const onEnded = () => {
      const r = repeatRef.current;
      const q = queueRef.current;
      const qi = queueIndexRef.current;
      if (r === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else if (q.length > 1) {
        const nextIdx = (qi + 1) % q.length;
        queueIndexRef.current = nextIdx;
        setQueueIndex(nextIdx);
        internalPlay(q[nextIdx]);
      } else if (r === "all" && q.length > 0) {
        internalPlay(q[0]);
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Media Session API
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentSong) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist,
        artwork: [
          { src: currentSong.thumbnail, sizes: "512x512", type: "image/jpeg" },
          { src: currentSong.thumbnail, sizes: "256x256", type: "image/jpeg" },
        ]
      });
      navigator.mediaSession.setActionHandler("play", () => resume());
      navigator.mediaSession.setActionHandler("pause", () => pause());
      navigator.mediaSession.setActionHandler("nexttrack", () => next());
      navigator.mediaSession.setActionHandler("previoustrack", () => prev());
      navigator.mediaSession.setActionHandler("seekto", (d) => {
        if (d.seekTime !== undefined) seek(d.seekTime);
      });
    } catch {}
  }, [currentSong]);

  // Load favorites
  useEffect(() => {
    try {
      const stored = localStorage.getItem("musika-favorites");
      if (stored) setFavorites(new Set(JSON.parse(stored)));
    } catch {}
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

  async function resolveStreamUrl(song: Song): Promise<string> {
    // Return cached URL if available
    if (streamUrlCache.has(song.videoId)) {
      return streamUrlCache.get(song.videoId)!;
    }

    let streamUrl: string | null = null;

    // Try download API for all sources
    if (song.url) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        const res = await fetch(
          `${BASE}/api/music/download?url=${encodeURIComponent(song.url)}&source=${song.source}`,
          { signal: controller.signal }
        );
        clearTimeout(timer);
        const data = await res.json();
        if (data.success && data.download_url) {
          // Stream through our proxy to avoid CORS issues
          streamUrl = `${BASE}/api/music/stream?url=${encodeURIComponent(data.download_url)}`;
        }
      } catch (err) {
        console.warn("Download API failed:", err);
      }
    }

    // Fallback: stream directly from song URL
    if (!streamUrl && song.url) {
      streamUrl = `${BASE}/api/music/stream?url=${encodeURIComponent(song.url)}`;
    }

    if (!streamUrl) throw new Error("Tidak dapat memuat lagu ini.");

    // Cache for future use (cache up to 20 entries)
    if (streamUrlCache.size > 20) {
      const firstKey = streamUrlCache.keys().next().value;
      if (firstKey) streamUrlCache.delete(firstKey);
    }
    streamUrlCache.set(song.videoId, streamUrl);

    return streamUrl;
  }

  async function internalPlay(song: Song) {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentSong(song);
    setIsBuffering(true);
    setProgress(0);
    setDuration(0);
    audio.pause();
    audio.src = "";

    recordHistory(song);

    const songKey = song.videoId;
    resolveRef.current = songKey;

    try {
      const streamUrl = await resolveStreamUrl(song);
      if (resolveRef.current !== songKey) return; // Song changed mid-resolve

      audio.src = streamUrl;
      audio.load();
      await audio.play();
      setIsPlaying(true);

      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }
    } catch (err: any) {
      if (resolveRef.current !== songKey) return;
      console.error("Playback failed:", err);
      // Remove from cache so next attempt re-fetches
      streamUrlCache.delete(song.videoId);
      toast({
        title: "Gagal memutar",
        description: "Lagu tidak dapat diputar. Coba lagi.",
        variant: "destructive"
      });
      setIsBuffering(false);
      setIsPlaying(false);
    }
  }

  const playSong = useCallback(async (song: Song, newQueue?: Song[]) => {
    if (newQueue) {
      setQueue(newQueue);
      queueRef.current = newQueue;
      const idx = newQueue.findIndex(s => s.videoId === song.videoId);
      const newIdx = idx >= 0 ? idx : 0;
      setQueueIndex(newIdx);
      queueIndexRef.current = newIdx;
    }
    await internalPlay(song);
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
    const q = queueRef.current;
    if (q.length === 0) return;
    const nextIdx = shuffle
      ? Math.floor(Math.random() * q.length)
      : (queueIndexRef.current + 1) % q.length;
    setQueueIndex(nextIdx);
    queueIndexRef.current = nextIdx;
    internalPlay(q[nextIdx]);
  }

  function prev() {
    const q = queueRef.current;
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    if (q.length === 0) return;
    const prevIdx = (queueIndexRef.current - 1 + q.length) % q.length;
    setQueueIndex(prevIdx);
    queueIndexRef.current = prevIdx;
    internalPlay(q[prevIdx]);
  }

  function setVolume(v: number) {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
  }

  function seek(t: number) {
    if (audioRef.current && !isNaN(t)) {
      audioRef.current.currentTime = t;
      setProgress(t);
    }
  }

  function toggleShuffle() { setShuffle(s => !s); }
  function toggleRepeat() {
    setRepeat(r => {
      const next = r === "none" ? "all" : r === "all" ? "one" : "none";
      repeatRef.current = next;
      return next;
    });
  }

  function addToQueue(song: Song) {
    setQueue(q => {
      const next = [...q, song];
      queueRef.current = next;
      return next;
    });
    toast({ title: "✓ Ditambahkan ke antrean", description: song.title });
  }

  function removeFromQueue(videoId: string) {
    setQueue(q => {
      const next = q.filter(s => s.videoId !== videoId);
      queueRef.current = next;
      return next;
    });
  }

  function clearQueue() {
    setQueue([]);
    queueRef.current = [];
  }

  function isFavorite(videoId: string) { return favorites.has(videoId); }

  async function toggleFavorite(song: Song) {
    const isFav = favorites.has(song.videoId);
    const newFavs = new Set(favorites);
    if (isFav) {
      newFavs.delete(song.videoId);
      toast({ title: "Dihapus dari favorit" });
    } else {
      newFavs.add(song.videoId);
      toast({ title: "✓ Ditambahkan ke favorit", description: song.title });
    }
    setFavorites(newFavs);
    try { localStorage.setItem("musika-favorites", JSON.stringify([...newFavs])); } catch {}

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
          url: song.url,
          liked_at: new Date().toISOString()
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
