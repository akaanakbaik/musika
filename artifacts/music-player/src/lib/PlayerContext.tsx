import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "./supabase";
import type { Song } from "./musicApi";

export type { Song };

interface PlayerContextType {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  isResolving: boolean;
  resolvingStep: string;
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

// BASE is the Vite base path (e.g. "" in production or "/prefix" in sub-path)
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// Cache resolved play URLs so re-plays are instant
interface PlayUrlEntry { playUrl: string; expires: number; }
const playUrlCache = new Map<string, PlayUrlEntry>();

// Source-specific loading messages shown to user
const RESOLVING_MESSAGES: Record<string, string> = {
  youtube:    "Memuat dari YouTube…",
  spotify:    "Memuat dari Spotify…",
  apple:      "Memuat dari Apple Music…",
  soundcloud: "Memuat dari SoundCloud…",
  default:    "Memuat lagu…"
};

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  // ─── Audio element ───────────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ─── State ───────────────────────────────────────────────────────────────────
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolvingStep, setResolvingStep] = useState("");
  const [volume, setVolumeState] = useState(0.8);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"none" | "one" | "all">("none");

  // ─── Refs for closures ───────────────────────────────────────────────────────
  const resolveRef = useRef<string | null>(null); // tracks which song is being resolved
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const repeatRef = useRef(repeat);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);

  // ─── Audio element setup ─────────────────────────────────────────────────────
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audio.preload = "auto";
    // ✅ DO NOT set crossOrigin="anonymous" — this causes CORS blocks with external CDNs
    // (kelvdra returns Access-Control-Allow-Origin: null which browser rejects in CORS mode)
    audioRef.current = audio;

    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onDuration   = () => { if (!isNaN(audio.duration) && isFinite(audio.duration)) setDuration(audio.duration); };
    const onWaiting    = () => setIsBuffering(true);
    const onCanPlay    = () => { setIsBuffering(false); };
    const onPlay       = () => { setIsPlaying(true); setIsBuffering(false); };
    const onPause      = () => setIsPlaying(false);
    const onError      = (e: Event) => {
      const err = (e.target as HTMLAudioElement).error;
      console.warn("[Audio] Playback error:", err?.code, err?.message);
      setIsBuffering(false);
      setIsResolving(false);
    };
    const onEnded = () => {
      const r = repeatRef.current;
      const q = queueRef.current;
      const qi = queueIndexRef.current;
      if (r === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else if (q.length > 1) {
        const next = (qi + 1) % q.length;
        queueIndexRef.current = next;
        setQueueIndex(next);
        internalPlay(q[next]);
      } else if (r === "all" && q.length > 0) {
        internalPlay(q[0]);
      }
    };

    audio.addEventListener("timeupdate",     onTimeUpdate);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("waiting",        onWaiting);
    audio.addEventListener("canplay",        onCanPlay);
    audio.addEventListener("play",           onPlay);
    audio.addEventListener("pause",          onPause);
    audio.addEventListener("error",          onError);
    audio.addEventListener("ended",          onEnded);

    return () => {
      audio.removeEventListener("timeupdate",     onTimeUpdate);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("waiting",        onWaiting);
      audio.removeEventListener("canplay",        onCanPlay);
      audio.removeEventListener("play",           onPlay);
      audio.removeEventListener("pause",          onPause);
      audio.removeEventListener("error",          onError);
      audio.removeEventListener("ended",          onEnded);
      audio.pause();
      audio.src = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Media Session API ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentSong) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title:   currentSong.title,
        artist:  currentSong.artist,
        artwork: [
          { src: currentSong.thumbnail, sizes: "512x512", type: "image/jpeg" },
          { src: currentSong.thumbnail, sizes: "256x256", type: "image/jpeg" },
        ]
      });
      navigator.mediaSession.setActionHandler("play",           () => resume());
      navigator.mediaSession.setActionHandler("pause",          () => pause());
      navigator.mediaSession.setActionHandler("nexttrack",      () => next());
      navigator.mediaSession.setActionHandler("previoustrack",  () => prev());
      navigator.mediaSession.setActionHandler("seekto",         (d) => { if (d.seekTime !== undefined) seek(d.seekTime); });
    } catch {}
  }, [currentSong]);

  // ─── Load favorites ──────────────────────────────────────────────────────────
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

  // ─── Resolve playable URL ────────────────────────────────────────────────────
  /**
   * Multi-strategy URL resolution for reliable audio playback.
   *
   * Strategy 1 (primary): /api/music/prepare  [CDN-first pipeline]
   *   - Gets raw URL, triggers CDN upload in bg, returns stream_url immediately
   *   - Returns cdn_url on subsequent plays (kabox CDN, best for seeking)
   *   - Available after backend deployment
   *
   * Strategy 2 (fallback): /api/music/download [always available]
   *   - Gets raw download URL from source API
   *   - Wraps it in /api/music/stream proxy (same-origin, no CORS issue)
   *   - Works with current production API
   *
   * KEY: Audio element has NO crossOrigin attribute set.
   * Without crossOrigin="anonymous", browser does NOT enforce CORS on audio.
   * The stream proxy (same-origin) and kabox CDN (CORS-enabled) both work fine.
   */
  async function resolvePlayUrl(song: Song): Promise<string> {
    // 1. Check local cache (avoids re-resolving same song)
    const cacheEntry = playUrlCache.get(song.videoId);
    if (cacheEntry && Date.now() < cacheEntry.expires) {
      return cacheEntry.playUrl;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 28000); // 28s overall timeout

    try {
      // ── Strategy 1: /api/music/prepare (CDN pipeline, new endpoint) ──────────
      const prepareRes = await fetch(
        `${BASE}/api/music/prepare?url=${encodeURIComponent(song.url)}&source=${song.source}&videoId=${encodeURIComponent(song.videoId)}`,
        { signal: controller.signal }
      );

      if (prepareRes.ok) {
        const prepareData = await prepareRes.json();
        if (prepareData.success && (prepareData.stream_url || prepareData.cdn_url)) {
          // Prefer CDN URL (direct, best seeking); fallback to stream proxy
          const playUrl = prepareData.cdn_url || `${BASE}${prepareData.stream_url}`;
          cachePlayUrl(song.videoId, playUrl);
          clearTimeout(timer);
          return playUrl;
        }
      }
      // If prepare returns 404 (endpoint not deployed yet), fall through to strategy 2
    } catch (err: any) {
      if (err.name === "AbortError") { clearTimeout(timer); throw err; }
      // Network or parse error — fall through to strategy 2
      console.warn("[Player] /prepare failed, trying /download:", err.message);
    }

    // ── Strategy 2: /api/music/download + stream proxy (always available) ─────
    const downloadRes = await fetch(
      `${BASE}/api/music/download?url=${encodeURIComponent(song.url)}&source=${song.source}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);

    if (!downloadRes.ok) {
      throw new Error(`Download gagal: HTTP ${downloadRes.status}`);
    }

    const downloadData = await downloadRes.json();
    if (!downloadData.success || !downloadData.download_url) {
      throw new Error(downloadData.error || "Tidak ada URL audio yang tersedia");
    }

    // Wrap raw download URL in stream proxy
    // Stream proxy: same-origin, adds CORS headers, handles Range requests
    // No crossOrigin on audio element → no CORS preflight → works perfectly
    const playUrl = `${BASE}/api/music/stream?url=${encodeURIComponent(downloadData.download_url)}`;
    cachePlayUrl(song.videoId, playUrl);
    return playUrl;
  }

  function cachePlayUrl(videoId: string, playUrl: string) {
    if (playUrlCache.size > 50) {
      const oldKey = playUrlCache.keys().next().value;
      if (oldKey) playUrlCache.delete(oldKey);
    }
    playUrlCache.set(videoId, { playUrl, expires: Date.now() + 4 * 60 * 60 * 1000 });
  }

  // ─── Internal play function ──────────────────────────────────────────────────
  async function internalPlay(song: Song) {
    const audio = audioRef.current;
    if (!audio) return;

    // Update UI immediately — show song info + loading state
    setCurrentSong(song);
    setIsResolving(true);
    setResolvingStep(RESOLVING_MESSAGES[song.source] || RESOLVING_MESSAGES.default);
    setIsBuffering(true);
    setProgress(0);
    setDuration(0);
    setIsPlaying(false);

    // Stop current playback
    audio.pause();
    audio.src = "";

    recordHistory(song);

    const songKey = song.videoId;
    resolveRef.current = songKey;

    try {
      // Step A: Get playable URL (2–8 seconds typically)
      setResolvingStep(RESOLVING_MESSAGES[song.source] || RESOLVING_MESSAGES.default);
      const playUrl = await resolvePlayUrl(song);

      // If song changed while resolving, abort
      if (resolveRef.current !== songKey) return;

      setResolvingStep("Mempersiapkan audio…");

      // Step B: Set audio source — no crossOrigin attribute, so browser won't
      // enforce CORS preflight. Works with both same-origin proxy URLs and CDN URLs.
      audio.src = playUrl;
      audio.load();

      // Step C: Play — triggered right after user interaction, so browser allows it
      await audio.play();

      setIsPlaying(true);
      setIsResolving(false);
      setResolvingStep("");

      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }

    } catch (err: any) {
      if (resolveRef.current !== songKey) return; // Song changed, ignore error

      console.error("[Player] Playback failed:", err.name, err.message);

      // Clear cache so next attempt re-fetches
      playUrlCache.delete(song.videoId);
      setIsResolving(false);
      setResolvingStep("");
      setIsBuffering(false);
      setIsPlaying(false);

      // User-facing error
      const isAbort   = err.name === "AbortError";
      const isNotAllow = err.name === "NotAllowedError";
      toast({
        title: isAbort     ? "Waktu habis — coba lagi"
             : isNotAllow  ? "Putar gagal — klik Play"
             : "Gagal memutar lagu",
        description: isAbort    ? `Koneksi lambat saat memuat ${song.title}`
                   : isNotAllow ? "Browser memblokir autoplay. Tekan tombol Play."
                   : err.message || "Terjadi kesalahan. Coba lagi.",
        variant: "destructive"
      });
    }
  }

  // ─── Public play ─────────────────────────────────────────────────────────────
  const playSong = useCallback(async (song: Song, newQueue?: Song[]) => {
    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
      queueRef.current = newQueue;
      const idx = newQueue.findIndex(s => s.videoId === song.videoId);
      const newIdx = idx >= 0 ? idx : 0;
      setQueueIndex(newIdx);
      queueIndexRef.current = newIdx;
    }
    await internalPlay(song);
  }, []);

  // ─── History ─────────────────────────────────────────────────────────────────
  async function recordHistory(song: Song) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.from("play_history").insert({
        user_id:   session.user.id,
        video_id:  song.videoId,
        title:     song.title,
        artist:    song.artist,
        thumbnail: song.thumbnail,
        duration:  song.duration,
        source:    song.source,
        url:       song.url
      });
    } catch {}
  }

  // ─── Controls ────────────────────────────────────────────────────────────────
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
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) { audio.currentTime = 0; return; }
    const q = queueRef.current;
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
    if (audioRef.current && !isNaN(t) && isFinite(t)) {
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

  function clearQueue() { setQueue([]); queueRef.current = []; }

  function isFavorite(videoId: string) { return favorites.has(videoId); }

  async function toggleFavorite(song: Song) {
    const wasFav = favorites.has(song.videoId);
    const newFavs = new Set(favorites);
    if (wasFav) {
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
      if (wasFav) {
        await supabase.from("favorites").delete().eq("user_id", session.user.id).eq("video_id", song.videoId);
      } else {
        await supabase.from("favorites").upsert({
          user_id:   session.user.id,
          video_id:  song.videoId,
          title:     song.title,
          artist:    song.artist,
          thumbnail: song.thumbnail,
          duration:  song.duration,
          source:    song.source,
          url:       song.url,
          liked_at:  new Date().toISOString()
        });
      }
    } catch {}
  }

  return (
    <PlayerContext.Provider value={{
      currentSong, queue, isPlaying, isResolving, resolvingStep,
      volume, progress, duration, isBuffering,
      shuffle, repeat,
      playSong, pause, resume, next, prev,
      setVolume, seek, toggleShuffle, toggleRepeat,
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
