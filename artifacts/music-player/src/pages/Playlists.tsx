import React, { useState, useEffect, useCallback } from "react";
import { Library, Plus, Lock, Music, Trash2, Globe, Download, Share2, Check, Play, ChevronRight, Loader2, Wifi, WifiOff } from "lucide-react";
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

  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#121212]" : "bg-[#F5F5F5]";
  const card = isDark ? "bg-[#181818] border-white/8" : "bg-white border-black/8";
  const cardHover = isDark ? "hover:bg-[#1e1e1e]" : "hover:bg-[#F0F0F0]";
  const textP = isDark ? "text-white" : "text-[#121212]";
  const textS = isDark ? "text-white/50" : "text-[#121212]/50";
  const inputClass = isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/30" : "bg-black/5 border-black/10 text-[#121212] placeholder:text-black/30 focus:border-black/30";
  const borderC = isDark ? "border-white/8" : "border-black/8";

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadAll();
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, [user]);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadPlaylists(), loadDownloads()]);
    setLoading(false);
  }

  async function loadPlaylists() {
    const { data } = await supabase
      .from("playlists")
      .select("*, playlist_songs(count)")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });
    setPlaylists((data || []).map((p: any) => ({ ...p, song_count: p.playlist_songs?.[0]?.count || 0 })));
  }

  async function loadDownloads() {
    setDlLoading(true);
    const { data } = await supabase
      .from("user_downloads")
      .select("*")
      .eq("user_id", user!.id)
      .order("downloaded_at", { ascending: false })
      .limit(100);
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
    if (error) { toast({ title: t(lang, "error"), description: error.message, variant: "destructive" }); }
    else {
      toast({ title: "✓ Playlist dibuat!", description: newName.trim() });
      setNewName(""); setNewDesc(""); setNewPublic(false); setShowCreate(false);
      loadPlaylists();
    }
    setCreating(false);
  }

  async function deletePlaylist(id: string, name: string) {
    if (!confirm(lang === "en" ? `Delete "${name}"?` : `Hapus "${name}"?`)) return;
    await supabase.from("playlists").delete().eq("id", id);
    setPlaylists(p => p.filter(pl => pl.id !== id));
    toast({ title: "✓ Playlist dihapus" });
  }

  async function togglePublic(pl: Playlist) {
    const newVal = !pl.is_public;
    await supabase.from("playlists").update({ is_public: newVal }).eq("id", pl.id);
    setPlaylists(prev => prev.map(p => p.id === pl.id ? { ...p, is_public: newVal } : p));
    toast({ title: newVal ? "✓ Playlist sekarang publik" : "✓ Playlist sekarang privat" });
  }

  function sharePlaylist(pl: Playlist) {
    if (!pl.is_public) {
      toast({ title: "Jadikan publik dulu", description: "Aktifkan mode publik untuk bisa berbagi link.", variant: "destructive" });
      return;
    }
    const url = getPlaylistShareUrl(pl.id);
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(pl.id);
      setTimeout(() => setCopiedId(null), 2500);
      toast({ title: "✓ Link playlist disalin!" });
    });
  }

  function playDownloads() {
    if (downloads.length === 0) return;
    const songs = downloads.map(d => ({
      videoId: d.video_id, title: d.title, artist: d.artist,
      thumbnail: d.thumbnail, duration: d.duration,
      source: d.source as any, url: d.cdn_url || d.url, album: ""
    } as Song));
    playSong(songs[0], songs);
    toast({ title: `▶️ Memutar ${songs.length} unduhan` });
  }

  function deleteDownload(id: string) {
    supabase.from("user_downloads").delete().eq("id", id).then(() => {
      setDownloads(d => d.filter(dl => dl.id !== id));
      toast({ title: "✓ Unduhan dihapus" });
    });
  }

  if (!user) {
    return (
      <div className={`min-h-screen ${bg} flex flex-col items-center justify-center text-center px-4`}>
        <Lock className={`w-16 h-16 mb-4 ${textS}`} />
        <h2 className={`text-2xl font-bold mb-2 ${textP}`}>{lang === "en" ? "Sign in to manage playlists" : "Masuk untuk kelola playlist"}</h2>
        <Link href="/auth" className="font-bold px-8 py-3 rounded-full text-black mt-4 inline-block" style={{ background: accentColor }}>
          {t(lang, "sign_in")}
        </Link>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bg} px-4 md:px-8 pb-24 md:pb-8`}>
      {/* Header */}
      <div className="flex items-center justify-between py-6">
        <div className="flex items-center gap-3">
          <Library className="w-6 h-6" style={{ color: accentColor }} />
          <h1 className={`text-2xl font-bold ${textP}`}>{t(lang, "library")}</h1>
          {!isOnline && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
              <WifiOff className="w-3 h-3" /> Offline
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCreate(s => !s)}
          className="flex items-center gap-2 font-bold px-4 py-2 rounded-full text-sm text-black transition-colors"
          style={{ background: accentColor }}
        >
          <Plus className="w-4 h-4" /> {t(lang, "create_playlist")}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className={`border ${borderC} rounded-2xl p-5 mb-6 ${isDark ? "bg-[#1A1A1A]" : "bg-white"}`}>
          <h3 className={`font-bold mb-4 ${textP}`}>{t(lang, "create_playlist")}</h3>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder={lang === "en" ? "Playlist name *" : "Nama playlist *"}
            className={`w-full border rounded-xl px-4 py-3 outline-none mb-3 transition-colors ${inputClass}`}
            onKeyDown={e => e.key === "Enter" && createPlaylist()} />
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
            placeholder={lang === "en" ? "Description (optional)" : "Deskripsi (opsional)"}
            className={`w-full border rounded-xl px-4 py-3 outline-none mb-4 transition-colors ${inputClass}`} />
          {/* Public toggle */}
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setNewPublic(p => !p)}
              className={`w-10 h-6 rounded-full transition-colors relative ${newPublic ? "" : isDark ? "bg-white/20" : "bg-black/20"}`}
              style={newPublic ? { background: accentColor } : {}}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${newPublic ? "left-4" : "left-0.5"}`} />
            </button>
            <span className={`text-sm ${textS}`}>{newPublic ? (lang === "en" ? "Public — shareable" : "Publik — bisa dibagikan") : (lang === "en" ? "Private" : "Privat")}</span>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowCreate(false)} className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-colors ${isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-black/10 text-[#121212] hover:bg-black/20"}`}>{t(lang, "cancel")}</button>
            <button onClick={createPlaylist} disabled={creating || !newName.trim()} className="flex-1 py-2.5 rounded-full text-sm font-bold text-black disabled:opacity-50 transition-all" style={{ background: accentColor }}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t(lang, "create_playlist")}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`rounded-xl p-4 animate-pulse ${isDark ? "bg-white/5" : "bg-black/5"}`}>
              <div className={`w-full aspect-square rounded-xl mb-3 ${isDark ? "bg-white/10" : "bg-black/10"}`} />
              <div className={`h-3 rounded-full w-3/4 mb-2 ${isDark ? "bg-white/10" : "bg-black/10"}`} />
              <div className={`h-2 rounded-full w-1/2 ${isDark ? "bg-white/10" : "bg-black/10"}`} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* ── DOWNLOADS PLAYLIST ────────────────────────────────────────── */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Download className="w-5 h-5" style={{ color: accentColor }} />
              <h2 className={`text-base font-bold ${textP}`}>{lang === "en" ? "Downloads" : "Unduhan"}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? "bg-white/8" : "bg-black/8"} ${textS}`}>
                {dlLoading ? "…" : downloads.length}
              </span>
              {!isOnline && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: `${accentColor}20`, color: accentColor }}>
                  <Wifi className="w-3 h-3" /> Offline ready
                </span>
              )}
            </div>

            {dlLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin" style={{ color: accentColor }} /></div>
            ) : downloads.length === 0 ? (
              <div className={`flex items-center gap-3 p-4 rounded-2xl border ${borderC} ${isDark ? "bg-white/3" : "bg-black/3"}`}>
                <Download className={`w-8 h-8 ${textS} flex-shrink-0`} />
                <div>
                  <p className={`text-sm font-semibold ${textP}`}>{lang === "en" ? "No downloads yet" : "Belum ada unduhan"}</p>
                  <p className={`text-xs ${textS}`}>{lang === "en" ? "Download songs for offline playback" : "Unduh lagu untuk diputar offline"}</p>
                </div>
              </div>
            ) : (
              <div>
                {/* Downloads playlist card */}
                <div className={`flex items-center gap-3 p-3 rounded-2xl border ${card} ${cardHover} transition-all mb-2`}>
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}88)` }}>
                    <Download className="w-6 h-6 text-black" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${textP}`}>{lang === "en" ? "My Downloads" : "Unduhan Saya"}</p>
                    <p className={`text-xs ${textS}`}>{downloads.length} {lang === "en" ? "songs" : "lagu"} • {lang === "en" ? "Offline" : "Offline"}</p>
                  </div>
                  <button onClick={playDownloads} className="w-10 h-10 rounded-full flex items-center justify-center text-black transition-all active:scale-90" style={{ background: accentColor }}>
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </button>
                </div>

                {/* Recent downloads (first 3) */}
                <div className="space-y-1">
                  {downloads.slice(0, 3).map(dl => (
                    <div key={dl.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl ${isDark ? "hover:bg-white/5" : "hover:bg-black/4"} transition-colors cursor-pointer group`}
                      onClick={() => playSong({ videoId: dl.video_id, title: dl.title, artist: dl.artist, thumbnail: dl.thumbnail, duration: dl.duration, source: dl.source as any, url: dl.cdn_url || dl.url, album: "" }, downloads.map(d => ({ videoId: d.video_id, title: d.title, artist: d.artist, thumbnail: d.thumbnail, duration: d.duration, source: d.source as any, url: d.cdn_url || d.url, album: "" })))}
                    >
                      <img src={dl.thumbnail} className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/40x40/333/999?text=♪"; }} alt="" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${textP}`}>{dl.title}</p>
                        <p className={`text-xs ${textS} truncate`}>{dl.artist}</p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); deleteDownload(dl.id); }}
                        className={`opacity-0 group-hover:opacity-100 p-1.5 rounded transition-all text-red-400/60 hover:text-red-400`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {downloads.length > 3 && (
                    <button
                      className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isDark ? "text-white/40 hover:text-white hover:bg-white/5" : "text-black/40 hover:text-black hover:bg-black/4"}`}
                    >
                      <span>{lang === "en" ? `+${downloads.length - 3} more songs` : `+${downloads.length - 3} lagu lagi`}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── MY PLAYLISTS ─────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 mb-3">
            <Library className="w-5 h-5" style={{ color: accentColor }} />
            <h2 className={`text-base font-bold ${textP}`}>{lang === "en" ? "My Playlists" : "Playlist Saya"}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? "bg-white/8" : "bg-black/8"} ${textS}`}>{playlists.length}</span>
          </div>

          {playlists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Library className={`w-16 h-16 mb-4 ${textS}`} />
              <h3 className={`text-xl font-semibold mb-2 ${textP}`}>{lang === "en" ? "Create your first playlist" : "Buat playlist pertamamu"}</h3>
              <p className={`text-sm mb-4 ${textS}`}>{lang === "en" ? "It's easy, we'll help you" : "Mudah, kami bantu kamu"}</p>
              <button onClick={() => setShowCreate(true)} className="font-bold px-6 py-2.5 rounded-full text-sm text-black" style={{ background: accentColor }}>
                {t(lang, "create_playlist")}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {playlists.map(pl => (
                <div key={pl.id} className={`group relative rounded-xl overflow-hidden transition-all ${card} ${cardHover} border`}>
                  {/* Cover */}
                  <Link href={`/playlist/${pl.id}`} className="block">
                    <div className="w-full aspect-square bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center overflow-hidden">
                      {pl.cover_url ? <img src={pl.cover_url} alt={pl.name} className="w-full h-full object-cover" /> : <Music className={`w-12 h-12 ${textS}`} />}
                    </div>
                    <div className="p-3">
                      <h3 className={`font-semibold text-sm truncate mb-0.5 ${textP}`}>{pl.name}</h3>
                      <div className="flex items-center gap-1.5">
                        {pl.is_public ? <Globe className={`w-3 h-3 ${textS}`} /> : <Lock className={`w-3 h-3 ${textS}`} />}
                        <p className={`text-xs ${textS}`}>{pl.song_count || 0} {lang === "en" ? "songs" : "lagu"}</p>
                      </div>
                    </div>
                  </Link>

                  {/* Action overlay */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex flex-col gap-1 transition-opacity">
                    <button
                      onClick={() => sharePlaylist(pl)}
                      className={`p-1.5 rounded-full bg-black/60 backdrop-blur-sm transition-colors ${copiedId === pl.id ? "text-green-400" : "text-white/60 hover:text-white"}`}
                      title={pl.is_public ? "Salin link" : "Jadikan publik dulu"}
                    >
                      {copiedId === pl.id ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => togglePublic(pl)}
                      className="p-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white/60 hover:text-white transition-colors"
                      title={pl.is_public ? "Jadikan privat" : "Jadikan publik"}
                    >
                      {pl.is_public ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => deletePlaylist(pl.id, pl.name)}
                      className="p-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white/60 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
