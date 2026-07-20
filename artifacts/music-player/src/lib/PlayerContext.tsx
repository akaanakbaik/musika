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

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface PlayUrlEntry { playUrl: string; expires: number; }
const playUrlCache = new Map<string, PlayUrlEntry>();

const RESOLVING_MESSAGES: Record<string, string> = {
  youtube:    "Memuat dari YouTube…",
  spotify:    "Memuat dari Spotify…",
  apple:      "Memuat dari Apple Music…",
  soundcloud: "Memuat dari SoundCloud…",
  default:    "Memuat lagu…"
};

// Tiny silent WAV — used to pre-warm the audio element synchronously
// so browser preserves user-activation context across async URL resolution
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  // Track which song is currently being resolved so we can cancel stale loads
  const resolveIdRef = useRef<string | null>(null);
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const repeatRef = useRef(repeat);
  const volumeRef = useRef(0.8);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  // ─── Audio element setup ─────────────────────────────────────────────────────
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audio.preload = "auto";
    // NO crossOrigin attribute — removing this was the key CORS fix.
    // Without crossOrigin="anonymous", browser does NOT enforce CORS on audio,
    // so direct CDN URLs and stream proxies both work fine.
    audioRef.current = audio;

    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onDuration   = () => { if (!isNaN(audio.duration) && isFinite(audio.duration)) setDuration(audio.duration); };
    const onWaiting    = () => setIsBuffering(true);
    const onCanPlay    = () => setIsBuffering(false);
    const onPlay       = () => { setIsPlaying(true); setIsBuffering(false); };
    const onPause      = () => setIsPlaying(false);
    const onError      = (e: Event) => {
      const err = (e.target as HTMLAudioElement).error;
      if (err) console.warn("[Audio] error:", err.code, err.message);
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
      navigator.mediaSession.setActionHandler("play",          () => resume());
      navigator.mediaSession.setActionHandler("pause",         () => pause());
      navigator.mediaSession.setActionHandler("nexttrack",     () => next());
      navigator.mediaSession.setActionHandler("previoustrack", () => prev());
      navigator.mediaSession.setActionHandler("seekto",        (d) => { if (d.seekTime !== undefined) seek(d.seekTime); });
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
   * Gets a playable audio URL for a song.
   *
   * Strategy 1: /api/music/prepare — CDN-first pipeline (kabox CDN or stream proxy).
   *   Available once the Replit backend is deployed.
   *
   * Strategy 2: /api/music/download — gets direct CDN URL from source API.
   *   The direct URL (e.g. kelvdra) is played WITHOUT going through stream proxy,
   *   since the audio element has no crossOrigin attr and CORS is not enforced.
   *   This is faster (no double-hop) and works reliably.
   *
   * CORS note: Audio elements without crossOrigin play from any URL without CORS checks.
   */
  async function resolvePlayUrl(song: Song, signal: AbortSignal): Promise<string> {
    const cacheEntry = playUrlCache.get(song.videoId);
    if (cacheEntry && Date.now() < cacheEntry.expires) {
      return cacheEntry.playUrl;
    }

    // ── Strategy 1: /api/music/prepare ──────────────────────────────────────
    try {
      const prepareRes = await fetch(
        `${BASE}/api/music/prepare?url=${encodeURIComponent(song.url)}&source=${song.source}&videoId=${encodeURIComponent(song.videoId)}`,
        { signal }
      );
      if (prepareRes.ok) {
        const data = await prepareRes.json();
        if (data.success && (data.stream_url || data.cdn_url)) {
          const playUrl = data.cdn_url
            ? data.cdn_url
            : `${BASE}${data.stream_url}`;
          storeCache(song.videoId, playUrl);
          return playUrl;
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") throw err;
      // Fall through to strategy 2
    }

    // ── Strategy 2: /api/music/download → direct CDN URL (no proxy) ─────────
    const downloadRes = await fetch(
      `${BASE}/api/music/download?url=${encodeURIComponent(song.url)}&source=${song.source}`,
      { signal }
    );

    if (!downloadRes.ok) {
      throw new Error(`Gagal mengunduh: HTTP ${downloadRes.status}`);
    }

    const data = await downloadRes.json();
    if (!data.success || !data.download_url) {
      throw new Error(data.error || "Tidak ada URL audio");
    }

    // Play directly from CDN URL (no proxy needed — no crossOrigin = no CORS enforcement)
    const playUrl = data.download_url;
    storeCache(song.videoId, playUrl);
    return playUrl;
  }

  function storeCache(videoId: string, playUrl: string) {
    if (playUrlCache.size > 50) {
      const k = playUrlCache.keys().next().value;
      if (k) playUrlCache.delete(k);
    }
    playUrlCache.set(videoId, { playUrl, expires: Date.now() + 4 * 60 * 60 * 1000 });
  }

  // ─── Internal play ───────────────────────────────────────────────────────────
  async function internalPlay(song: Song) {
    const audio = audioRef.current;
    if (!audio) return;

    // Cancel any in-progress resolution for a different song
    const songKey = song.videoId;
    resolveIdRef.current = songKey;

    // Update UI immediately — show info + loading state
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

    // ── PRE-WARM: Preserve user activation across async gap ──────────────────
    // Browsers expire "user activation" after 5s. Since URL resolution takes 3-8s,
    // we call audio.play() SYNCHRONOUSLY with a tiny silent audio to "unlock" audio
    // for this session. Future audio.play() calls won't need a new gesture.
    try {
      audio.src = SILENT_WAV;
      audio.volume = 0;
      await audio.play();
      audio.pause();
      audio.src = "";
      audio.volume = volumeRef.current;
    } catch {
      audio.volume = volumeRef.current;
    }

    recordHistory(song);

    // ── Resolve URL ──────────────────────────────────────────────────────────
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
      setResolvingStep(RESOLVING_MESSAGES[song.source] || RESOLVING_MESSAGES.default);
      const playUrl = await resolvePlayUrl(song, controller.signal);
      clearTimeout(timer);

      // Stale check — user may have clicked another song while we were resolving
      if (resolveIdRef.current !== songKey) return;

      setResolvingStep("Memulai putar…");

      // ── Play ─────────────────────────────────────────────────────────────
      audio.src = playUrl;
      audio.volume = volumeRef.current;
      audio.load();

      await audio.play();

      // Guard again — song may have changed during load()
      if (resolveIdRef.current !== songKey) {
        audio.pause();
        return;
      }

      setIsPlaying(true);
      setIsResolving(false);
      setResolvingStep("");

      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }

    } catch (err: any) {
      clearTimeout(timer);
      if (resolveIdRef.current !== songKey) return;

      console.error("[Player] Playback failed:", err.name, err.message);

      playUrlCache.delete(song.videoId);
      setIsResolving(false);
      setResolvingStep("");
      setIsBuffering(false);
      setIsPlaying(false);

      if (err.name === "AbortError") {
        toast({
          title: "Waktu habis",
          description: `Koneksi lambat. Coba lagi.`,
          variant: "destructive"
        });
      } else if (err.name === "NotAllowedError") {
        toast({
          title: "Tekan tombol Play",
          description: "Browser memblokir autoplay. Tekan ▶ untuk memutar.",
        });
      } else {
        toast({
          title: "Gagal memutar lagu",
          description: err.message || "Terjadi kesalahan. Coba lagi.",
          variant: "destructive"
        });
      }
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
    volumeRef.current = clamped;
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
