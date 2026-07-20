import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Library, Plus, Lock, Music, Trash2, Globe, Download, Share2, Check,
  Play, ChevronRight, Loader2, Wifi, WifiOff, PenLine, X, Search,
  Heart, Shuffle, Clock, ListMusic, SortAsc
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { Link, useLocation } from "wouter";
import { toast } from "@/hooks/use-toast";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { usePlayer } from "@/lib/PlayerContext";
import { t } from "@/lib/i18n";
import { getPlaylistShareUrl } from "@/lib/config";
import type { Song } from "@/lib/musicApi";

interface Playlist {
  id: string;
  name: string;
  description: string;
  cover_url: string;
  is_public: boolean;
  created_at: string;
  song_count?: number;
  cover_thumbs?: string[];
}

interface DownloadedSong {
  id: string;
  video_id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: string;
  source: string;
  url: string;
  cdn_url?: string;
  downloaded_at: string;
}

type SortMode = "newest" | "oldest" | "name" | "songs";

const SORT_LABELS: Record<SortMode, string> = {
  newest: "Terbaru",
  oldest: "Terlama",
  name: "Nama",
  songs: "Jumlah Lagu",
};

export default function Playlists() {
  const { user } = useAuth();
  const { theme, accentColor, lang } = useAppSettings();
  const { playSong, addToQueue } = usePlayer();
  const [, navigate] = useLocation();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [downloads, setDownloads] = useState<DownloadedSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [dlLoading, setDlLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPublic, setNewPublic] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [showSort, setShowSort] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [showDlList, setShowDlList] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#0d0d0d]" : "bg-[#F2F2F2]";
  const card = isDark ? "bg-[#181818] border-white/[0.07]" : "bg-white border-black/[0.07]";
  const cardHover = isDark ? "hover:bg-[#1e1e1e]" : "hover:bg-[#F8F8F8]";
  const textP = isDark ? "text-white" : "text-[#111]";
  const textS = isDark ? "text-white/45" : "text-[#111]/45";
  const inputCls = isDark
    ? "bg-white/[0.06] border-white/10 text-white placeholder:text-white/25 focus:border-white/30"
    : "bg-black/[0.04] border-black/10 text-[#111] placeholder:text-black/25 focus:border-black/30";

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadAll();
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [user]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSort(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadPlaylists(), loadDownloads()]);
    setLoading(false);
  }

  async function loadPlaylists() {
    const { data } = await supabase
      .from("playlists")
      .select("*, playlist_songs(count, thumbnail)")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });

    setPlaylists((data || []).map((p: any) => {
      const songs = p.playlist_songs || [];
      const thumbs = songs.slice(0, 4).map((s: any) => s.thumbnail).filter(Boolean);
      return { ...p, song_count: songs[0]?.count || 0, cover_thumbs: thumbs };
    }));
  }

  async function loadDownloads() {
    setDlLoading(true);
    const { data } = await supabase
      .from("user_downloads")
      .select("*")
      .eq("user_id", user!.id)
      .order("downloaded_at", { ascending: false })
      .limit(200);
    setDownloads(data || []);
    setDlLoading(false);
  }

  async function createPlaylist() {
    if (!newName.trim() || !user) return;
    setCreating(true);
    const { error } = await supabase.from("playlists").insert({
      user_id: user.id, name: newName.trim(),
      description: newDesc.trim(), is_public: newPublic
    });
    if (error) {
      toast({ title: "Gagal membuat playlist", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✓ Playlist dibuat!", description: newName.trim() });
      setNewName(""); setNewDesc(""); setNewPublic(false); setShowCreate(false);
      loadPlaylists();
    }
    setCreating(false);
  }

  async function deletePlaylist(id: string, name: string) {
    if (!confirm(`Hapus playlist "${name}"?`)) return;
    await supabase.from("playlists").delete().eq("id", id);
    setPlaylists(p => p.filter(pl => pl.id !== id));
    toast({ title: "✓ Playlist dihapus" });
  }

  async function togglePublic(pl: Playlist) {
    const newVal = !pl.is_public;
    await supabase.from("playlists").update({ is_public: newVal }).eq("id", pl.id);
    setPlaylists(prev => prev.map(p => p.id === pl.id ? { ...p, is_public: newVal } : p));
    toast({ title: newVal ? "🌐 Playlist sekarang publik" : "🔒 Playlist sekarang privat" });
  }

  async function sharePlaylist(pl: Playlist) {
    if (!pl.is_public) {
      if (confirm(`Jadikan "${pl.name}" publik dulu agar bisa dibagikan?`)) {
        await togglePublic(pl);
        const url = getPlaylistShareUrl(pl.id);
        await navigator.clipboard.writeText(url);
        setCopiedId(pl.id);
        setTimeout(() => setCopiedId(null), 2500);
        toast({ title: "✓ Dijadikan publik & link disalin!" });
      }
      return;
    }
    const url = getPlaylistShareUrl(pl.id);
    await navigator.clipboard.writeText(url);
    setCopiedId(pl.id);
    setTimeout(() => setCopiedId(null), 2500);
    toast({ title: "✓ Link playlist disalin!" });
  }

  function playDownloads() {
    if (downloads.length === 0) return;
    const songs = downloads.map(d => ({
      videoId: d.video_id, title: d.title, artist: d.artist,
      thumbnail: d.thumbnail, duration: d.duration,
      source: d.source as any, url: d.cdn_url || d.url, album: ""
    } as Song));
    playSong(songs[0], songs);
    toast({ title: `▶ Memutar ${songs.length} unduhan` });
  }

  function shuffleDownloads() {
    if (downloads.length === 0) return;
    const shuffled = [...downloads].sort(() => Math.random() - 0.5);
    const songs = shuffled.map(d => ({
      videoId: d.video_id, title: d.title, artist: d.artist,
      thumbnail: d.thumbnail, duration: d.duration,
      source: d.source as any, url: d.cdn_url || d.url, album: ""
    } as Song));
    playSong(songs[0], songs);
    toast({ title: `🔀 Memainkan acak ${songs.length} unduhan` });
  }

  function deleteDownload(id: string) {
    supabase.from("user_downloads").delete().eq("id", id).then(() => {
      setDownloads(d => d.filter(dl => dl.id !== id));
      toast({ title: "✓ Unduhan dihapus" });
    });
  }

  const sortedPlaylists = [...playlists]
    .filter(pl => !searchQ || pl.name.toLowerCase().includes(searchQ.toLowerCase()))
    .sort((a, b) => {
      if (sortMode === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortMode === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortMode === "name") return a.name.localeCompare(b.name);
      if (sortMode === "songs") return (b.song_count || 0) - (a.song_count || 0);
      return 0;
    });

  if (!user) {
    return (
      <div className={`min-h-screen ${bg} flex flex-col items-center justify-center text-center px-6 animate-fade-in`}>
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5 shadow-xl"
          style={{ background: `linear-gradient(135deg, ${accentColor}33, ${accentColor}11)` }}>
          <Library className="w-10 h-10" style={{ color: accentColor }} />
        </div>
        <h2 className={`text-xl font-bold mb-2 ${textP}`}>Masuk untuk kelola playlist</h2>
        <p className={`text-sm mb-6 ${textS}`}>Simpan dan kelola koleksi musik favoritmu</p>
        <Link href="/auth"
          className="font-bold px-8 py-3 rounded-full text-sm text-black shadow-lg transition-all active:scale-95"
          style={{ background: accentColor }}>
          Masuk
        </Link>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bg} pb-24 md:pb-8 animate-fade-in`}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="px-4 md:px-6 pt-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <h1 className={`text-xl font-bold ${textP}`}>Perpustakaan</h1>
            {!isOnline && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                <WifiOff className="w-3 h-3" /> Offline
              </span>
            )}
          </div>
          <button
            onClick={() => setShowCreate(s => !s)}
            className="flex items-center gap-1.5 font-semibold px-3.5 py-2 rounded-full text-xs text-black transition-all active:scale-95 shadow-md"
            style={{ background: accentColor }}
          >
            <Plus className="w-3.5 h-3.5" />
            Buat Playlist
          </button>
        </div>

        {/* Search */}
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border ${isDark ? "bg-white/5 border-white/8" : "bg-black/5 border-black/8"}`}>
          <Search className={`w-4 h-4 flex-shrink-0 ${textS}`} />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Cari playlist…"
            className={`flex-1 bg-transparent outline-none text-sm ${textP} placeholder:${textS}`}
          />
          {searchQ && (
            <button onClick={() => setSearchQ("")} className={`${textS} hover:${textP}`}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Create form ────────────────────────────────────── */}
      {showCreate && (
        <div className={`mx-4 md:mx-6 mb-4 rounded-2xl border ${isDark ? "bg-[#1a1a1a] border-white/8" : "bg-white border-black/8"} p-4 animate-slide-down`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`font-bold text-sm ${textP}`}>Playlist baru</h3>
            <button onClick={() => setShowCreate(false)} className={textS}><X className="w-4 h-4" /></button>
          </div>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nama playlist *"
            className={`w-full border rounded-xl px-3 py-2.5 outline-none mb-2.5 text-sm transition-colors ${inputCls}`}
            onKeyDown={e => e.key === "Enter" && createPlaylist()}
            autoFocus
          />
          <input
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Deskripsi (opsional)"
            className={`w-full border rounded-xl px-3 py-2.5 outline-none mb-3 text-sm transition-colors ${inputCls}`}
          />
          {/* Public toggle */}
          <div className="flex items-center justify-between mb-4 p-3 rounded-xl" style={{ background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}>
            <div className="flex items-center gap-2.5">
              {newPublic ? <Globe className="w-4 h-4" style={{ color: accentColor }} /> : <Lock className={`w-4 h-4 ${textS}`} />}
              <div>
                <p className={`text-sm font-semibold ${textP}`}>{newPublic ? "Publik" : "Privat"}</p>
                <p className={`text-xs ${textS}`}>{newPublic ? "Siapa saja bisa melihat" : "Hanya kamu"}</p>
              </div>
            </div>
            <button
              onClick={() => setNewPublic(p => !p)}
              className={`relative w-11 h-6 rounded-full toggle-track flex-shrink-0`}
              style={{ background: newPublic ? accentColor : isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)" }}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow toggle-thumb ${newPublic ? "left-5" : "left-0.5"}`} />
            </button>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => setShowCreate(false)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${isDark ? "bg-white/8 text-white hover:bg-white/12" : "bg-black/8 text-[#111] hover:bg-black/12"}`}
            >
              Batal
            </button>
            <button
              onClick={createPlaylist}
              disabled={creating || !newName.trim()}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-black disabled:opacity-40 transition-all active:scale-95 shadow-md"
              style={{ background: accentColor }}
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Buat"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="px-4 md:px-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`rounded-2xl p-3 ${isDark ? "skeleton" : "skeleton-light"}`}>
              <div className={`w-full aspect-square rounded-xl mb-2.5 ${isDark ? "bg-white/8" : "bg-black/8"}`} />
              <div className={`h-3 rounded-full w-3/4 mb-1.5 ${isDark ? "bg-white/8" : "bg-black/8"}`} />
              <div className={`h-2.5 rounded-full w-1/2 ${isDark ? "bg-white/5" : "bg-black/5"}`} />
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 md:px-6">
          {/* ── DOWNLOADS ─────────────────────────────────────── */}
          <div className="mb-5">
            {/* Downloads header row */}
            <div className={`flex items-center gap-3 p-3 rounded-2xl border ${card} mb-2 card-hover cursor-pointer`}
              onClick={() => setShowDlList(s => !s)}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}99)` }}>
                <Download className="w-5 h-5 text-black" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${textP}`}>Unduhan Saya</p>
                <p className={`text-xs ${textS}`}>
                  {dlLoading ? "Memuat…" : `${downloads.length} lagu`}
                  {!isOnline && <span className="ml-2" style={{ color: accentColor }}>• Offline siap</span>}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={e => { e.stopPropagation(); shuffleDownloads(); }}
                  className={`p-2 rounded-full ${isDark ? "hover:bg-white/10" : "hover:bg-black/8"} transition-colors`}
                  title="Putar acak"
                >
                  <Shuffle className={`w-3.5 h-3.5 ${textS}`} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); playDownloads(); }}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-black transition-all active:scale-90 shadow-md"
                  style={{ background: accentColor }}
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </button>
                <ChevronRight className={`w-4 h-4 transition-transform ${showDlList ? "rotate-90" : ""} ${textS}`} />
              </div>
            </div>

            {/* Expandable download list */}
            {showDlList && (
              <div className={`rounded-2xl border ${isDark ? "bg-[#161616] border-white/[0.06]" : "bg-white border-black/[0.06]"} overflow-hidden animate-slide-down`}>
                {downloads.length === 0 ? (
                  <div className="flex flex-col items-center py-8 gap-2">
                    <Download className={`w-8 h-8 ${textS}`} />
                    <p className={`text-sm ${textS}`}>Belum ada unduhan</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}>
                    {downloads.map((dl, i) => (
                      <div key={dl.id}
                        className={`flex items-center gap-2.5 px-3 py-2.5 song-item cursor-pointer group ${isDark ? "hover:bg-white/[0.04]" : "hover:bg-black/[0.02]"}`}
                        onClick={() => playSong(
                          { videoId: dl.video_id, title: dl.title, artist: dl.artist, thumbnail: dl.thumbnail, duration: dl.duration, source: dl.source as any, url: dl.cdn_url || dl.url, album: "" },
                          downloads.map(d => ({ videoId: d.video_id, title: d.title, artist: d.artist, thumbnail: d.thumbnail, duration: d.duration, source: d.source as any, url: d.cdn_url || d.url, album: "" }))
                        )}
                      >
                        <span className={`w-5 text-xs text-right flex-shrink-0 ${textS}`}>{i + 1}</span>
                        <img src={dl.thumbnail} className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                          onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/36x36/333/999?text=♪"; }} alt="" />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium truncate ${textP}`}>{dl.title}</p>
                          <p className={`text-xs truncate ${textS}`}>{dl.artist}</p>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); deleteDownload(dl.id); }}
                          className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all text-red-400/60 hover:text-red-400 hover:bg-red-500/10`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── PLAYLISTS HEADER ───────────────────────────────── */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className={`text-sm font-bold ${textP}`}>Playlist Saya</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDark ? "bg-white/8 text-white/50" : "bg-black/8 text-black/50"}`}>
                {sortedPlaylists.length}
              </span>
            </div>
            <div className="relative" ref={sortRef}>
              <button
                onClick={() => setShowSort(s => !s)}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors ${isDark ? "bg-white/8 text-white/60 hover:bg-white/12" : "bg-black/8 text-black/60 hover:bg-black/12"}`}
              >
                <SortAsc className="w-3.5 h-3.5" />
                {SORT_LABELS[sortMode]}
              </button>
              {showSort && (
                <div className={`absolute right-0 top-full mt-1.5 w-40 rounded-xl border shadow-xl z-50 overflow-hidden animate-scale-in ${isDark ? "bg-[#222] border-white/10" : "bg-white border-black/10"}`}>
                  {(Object.entries(SORT_LABELS) as [SortMode, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => { setSortMode(key); setShowSort(false); }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${sortMode === key
                        ? `font-bold`
                        : isDark ? "text-white/70 hover:bg-white/6" : "text-black/70 hover:bg-black/5"
                      }`}
                      style={sortMode === key ? { color: accentColor } : {}}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── PLAYLIST GRID ──────────────────────────────────── */}
          {sortedPlaylists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: `${accentColor}18` }}>
                <ListMusic className="w-8 h-8" style={{ color: accentColor }} />
              </div>
              <h3 className={`text-base font-bold mb-1 ${textP}`}>
                {searchQ ? "Tidak ada hasil" : "Buat playlist pertamamu"}
              </h3>
              <p className={`text-xs mb-4 ${textS}`}>
                {searchQ ? `Tidak ada playlist dengan "${searchQ}"` : "Mudah, kami bantu kamu"}
              </p>
              {!searchQ && (
                <button onClick={() => setShowCreate(true)}
                  className="font-bold px-5 py-2 rounded-full text-xs text-black shadow-md active:scale-95"
                  style={{ background: accentColor }}>
                  Buat Playlist
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {sortedPlaylists.map((pl, idx) => (
                <PlaylistCard
                  key={pl.id}
                  pl={pl}
                  idx={idx}
                  isDark={isDark}
                  accentColor={accentColor}
                  textP={textP}
                  textS={textS}
                  copiedId={copiedId}
                  onShare={sharePlaylist}
                  onTogglePublic={togglePublic}
                  onDelete={deletePlaylist}
                  navigate={navigate}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlaylistCard({
  pl, idx, isDark, accentColor, textP, textS,
  copiedId, onShare, onTogglePublic, onDelete, navigate
}: {
  pl: Playlist; idx: number; isDark: boolean; accentColor: string;
  textP: string; textS: string; copiedId: string | null;
  onShare: (pl: Playlist) => void;
  onTogglePublic: (pl: Playlist) => void;
  onDelete: (id: string, name: string) => void;
  navigate: (path: any) => void;
}) {
  const card = isDark ? "bg-[#181818] border-white/[0.07]" : "bg-white border-black/[0.07]";

  return (
    <div
      className={`group relative rounded-2xl overflow-hidden border ${card} card-hover animate-fade-in`}
      style={{ animationDelay: `${idx * 0.04}s` }}
    >
      {/* Cover */}
      <div
        className="w-full aspect-square cursor-pointer relative overflow-hidden"
        onClick={() => navigate(`/playlist/${pl.id}`)}
      >
        {pl.cover_url ? (
          <img src={pl.cover_url} alt={pl.name} className="w-full h-full object-cover" />
        ) : pl.cover_thumbs && pl.cover_thumbs.length >= 4 ? (
          <div className="playlist-cover-grid w-full h-full">
            {pl.cover_thumbs.slice(0, 4).map((t, i) => (
              <img key={i} src={t} className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} alt="" />
            ))}
          </div>
        ) : pl.cover_thumbs && pl.cover_thumbs.length > 0 ? (
          <img src={pl.cover_thumbs[0]} alt={pl.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${accentColor}55 0%, ${accentColor}22 100%)` }}>
            <Music className={`w-10 h-10 ${textS}`} />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 scale-75 group-hover:scale-100 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
            <Play className="w-4 h-4 text-white fill-current ml-0.5" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5 cursor-pointer" onClick={() => navigate(`/playlist/${pl.id}`)}>
        <h3 className={`font-semibold text-xs truncate mb-0.5 ${textP}`}>{pl.name}</h3>
        <div className="flex items-center gap-1.5">
          {pl.is_public
            ? <Globe className={`w-2.5 h-2.5`} style={{ color: accentColor }} />
            : <Lock className={`w-2.5 h-2.5 ${textS}`} />
          }
          <p className={`text-xs ${textS}`}>{pl.song_count || 0} lagu</p>
        </div>
      </div>

      {/* Action buttons — visible on hover */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex flex-col gap-1 transition-opacity duration-150">
        <button
          onClick={e => { e.stopPropagation(); onShare(pl); }}
          className={`p-1.5 rounded-full bg-black/70 backdrop-blur-sm transition-colors ${copiedId === pl.id ? "text-green-400" : "text-white/70 hover:text-white"}`}
          title="Bagikan"
        >
          {copiedId === pl.id ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
        </button>
        <button
          onClick={e => { e.stopPropagation(); onTogglePublic(pl); }}
          className={`p-1.5 rounded-full bg-black/70 backdrop-blur-sm transition-colors ${pl.is_public ? "text-white/70" : "text-white/40"} hover:text-white`}
          title={pl.is_public ? "Jadikan privat" : "Jadikan publik"}
        >
          {pl.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(pl.id, pl.name); }}
          className="p-1.5 rounded-full bg-black/70 backdrop-blur-sm text-white/70 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
