import React, { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { usePlayer } from "@/lib/PlayerContext";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, Play, Plus, Music2, Globe, Lock, Share2, Loader2, Check,
  UserCircle2, Trash2, Shuffle, ListPlus, MoreVertical, X
} from "lucide-react";
import type { Song } from "@/lib/musicApi";
import { getPlaylistShareUrl } from "@/lib/config";

interface PlaylistInfo {
  id: string;
  name: string;
  description: string;
  cover_url: string;
  is_public: boolean;
  created_at: string;
  user_id: string;
  owner_username?: string;
  owner_avatar?: string;
}

interface PlaylistSong extends Song {
  rowId?: string;
}

export default function PlaylistDetail() {
  const [, params] = useRoute("/playlist/:id");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { theme, accentColor, lang } = useAppSettings();
  const { playSong, addToQueue } = usePlayer();

  const playlistId = params?.id;

  const [playlist, setPlaylist] = useState<PlaylistInfo | null>(null);
  const [songs, setSongs] = useState<PlaylistSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [addingToMine, setAddingToMine] = useState(false);
  const [addedToMine, setAddedToMine] = useState(false);
  const [copied, setCopied] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [menuSongId, setMenuSongId] = useState<string | null>(null);

  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#0d0d0d]" : "bg-[#F2F2F2]";
  const textP = isDark ? "text-white" : "text-[#111]";
  const textS = isDark ? "text-white/50" : "text-[#111]/50";
  const cardHover = isDark ? "hover:bg-white/[0.04]" : "hover:bg-black/[0.02]";
  const divider = isDark ? "border-white/[0.05]" : "border-black/[0.05]";

  useEffect(() => { if (playlistId) load(); }, [playlistId]);

  // Close menu on click outside
  useEffect(() => {
    if (!menuSongId) return;
    const handler = () => setMenuSongId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuSongId]);

  async function load() {
    setLoading(true);
    const { data: pl } = await supabase
      .from("playlists")
      .select("*")
      .eq("id", playlistId)
      .single();

    if (!pl) { setNotFound(true); setLoading(false); return; }
    if (!pl.is_public && pl.user_id !== user?.id) { setNotFound(true); setLoading(false); return; }

    const { data: owner } = await supabase
      .from("user_profiles").select("username, avatar_url")
      .eq("id", pl.user_id).single();

    setPlaylist({ ...pl, owner_username: owner?.username, owner_avatar: owner?.avatar_url });

    const { data: songData } = await supabase
      .from("playlist_songs").select("*")
      .eq("playlist_id", playlistId)
      .order("added_at", { ascending: true });

    setSongs((songData || []).map(s => ({ ...s, rowId: s.id, videoId: s.video_id } as PlaylistSong)));
    setLoading(false);
  }

  async function addToMyPlaylists() {
    if (!user) { toast({ title: "Masuk dulu untuk menyimpan playlist", variant: "destructive" }); return; }
    if (addingToMine) return;
    setAddingToMine(true);

    const { data: newPl, error } = await supabase.from("playlists").insert({
      user_id: user.id,
      name: playlist!.name + " (Salinan)",
      description: playlist!.description,
      is_public: false,
    }).select().single();

    if (!error && newPl && songs.length > 0) {
      await supabase.from("playlist_songs").insert(
        songs.map(s => ({
          playlist_id: newPl.id,
          video_id: s.videoId, title: s.title,
          artist: s.artist, thumbnail: s.thumbnail,
          duration: s.duration, source: s.source, url: s.url,
          added_at: new Date().toISOString(),
        }))
      );
    }

    setAddingToMine(false);
    setAddedToMine(true);
    toast({ title: `✓ Playlist "${playlist!.name}" disimpan!` });
  }

  async function removeSong(song: PlaylistSong) {
    if (!song.rowId) return;
    setRemovingId(song.rowId);
    await supabase.from("playlist_songs").delete().eq("id", song.rowId);
    setSongs(prev => prev.filter(s => s.rowId !== song.rowId));
    setRemovingId(null);
    setMenuSongId(null);
    toast({ title: "✓ Lagu dihapus dari playlist" });
  }

  function shareUrl() {
    const url = getPlaylistShareUrl(playlistId!);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast({ title: "✓ Link disalin!" });
    });
  }

  function playAll() {
    if (songs.length === 0) return;
    playSong(songs[0], songs);
    toast({ title: `▶ Memutar ${songs.length} lagu` });
  }

  function shuffleAll() {
    if (songs.length === 0) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    playSong(shuffled[0], shuffled);
    toast({ title: `🔀 Memutar acak ${songs.length} lagu` });
  }

  function addAllToQueue() {
    songs.forEach(s => addToQueue(s));
    toast({ title: `✓ ${songs.length} lagu ditambahkan ke antrian` });
  }

  const isOwner = user?.id === playlist?.user_id;

  /* ── Loading ────────────────────────────────────────── */
  if (loading) {
    return (
      <div className={`min-h-screen ${bg} flex flex-col animate-fade-in`}>
        {/* skeleton header */}
        <div className="h-72 skeleton opacity-40" />
        <div className="px-4 py-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${isDark ? "skeleton" : "skeleton-light"}`} />
              <div className="flex-1">
                <div className={`h-3 rounded-full w-3/4 mb-2 ${isDark ? "skeleton" : "skeleton-light"}`} />
                <div className={`h-2.5 rounded-full w-1/2 ${isDark ? "skeleton" : "skeleton-light"}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Not Found ──────────────────────────────────────── */
  if (notFound || !playlist) {
    return (
      <div className={`min-h-screen ${bg} flex flex-col items-center justify-center gap-4 px-6 text-center animate-fade-in`}>
        <div className="w-18 h-18 rounded-3xl flex items-center justify-center" style={{ background: `${accentColor}18` }}>
          <Lock className="w-9 h-9" style={{ color: accentColor }} />
        </div>
        <h2 className={`text-xl font-bold ${textP}`}>Playlist tidak ditemukan</h2>
        <p className={`text-sm ${textS}`}>Playlist ini bersifat privat atau tidak ada.</p>
        <button onClick={() => navigate("/playlists")}
          className="font-bold px-6 py-3 rounded-full text-sm text-black shadow-md" style={{ background: accentColor }}>
          Ke Perpustakaan
        </button>
      </div>
    );
  }

  /* ── Main ───────────────────────────────────────────── */
  return (
    <div className={`min-h-screen ${bg} pb-32 md:pb-8 animate-fade-in`}>
      {/* ── Blurred hero ───────────────────────────────── */}
      <div className="relative" style={{ height: 280 }}>
        <div className="absolute inset-0 overflow-hidden">
          {playlist.cover_url && (
            <img src={playlist.cover_url} className="w-full h-full object-cover"
              style={{ filter: "blur(48px) brightness(0.35) saturate(1.8)" }} alt="" />
          )}
          <div className="absolute inset-0"
            style={{ background: `linear-gradient(to bottom, ${accentColor}22 0%, ${isDark ? "#0d0d0d" : "#F2F2F2"} 100%)` }} />
        </div>

        <div className="relative px-4 md:px-6 pt-4 h-full flex flex-col">
          {/* Back */}
          <button
            onClick={() => navigate("/playlists")}
            className={`self-start p-2.5 rounded-2xl mb-3 transition-colors ${isDark ? "bg-black/40 hover:bg-black/60 text-white" : "bg-white/60 hover:bg-white text-[#111]"}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Info row */}
          <div className="flex items-end gap-5 flex-1 pb-5">
            {/* Cover */}
            <div className="w-36 h-36 md:w-44 md:h-44 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0">
              {playlist.cover_url
                ? <img src={playlist.cover_url} className="w-full h-full object-cover" alt={playlist.name} />
                : (
                  <div className="w-full h-full flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${accentColor}66, ${accentColor}22)` }}>
                    <Music2 className="w-14 h-14 text-white/60" />
                  </div>
                )
              }
            </div>

            <div className="flex-1 min-w-0 pb-1">
              <div className={`inline-flex items-center gap-1 text-xs font-semibold mb-2 px-2 py-0.5 rounded-full ${isDark ? "bg-white/10" : "bg-black/10"}`}>
                {playlist.is_public
                  ? <><Globe className="w-3 h-3" style={{ color: accentColor }} /><span className={textS}>Publik</span></>
                  : <><Lock className="w-3 h-3" /><span className={textS}>Privat</span></>
                }
              </div>
              <h1 className={`text-2xl md:text-3xl font-black tracking-tight mb-1 ${textP} leading-tight`}>
                {playlist.name}
              </h1>
              {playlist.description && (
                <p className={`text-xs mb-2 ${textS} line-clamp-1`}>{playlist.description}</p>
              )}
              {playlist.owner_username && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  {playlist.owner_avatar
                    ? <img src={playlist.owner_avatar} className="w-5 h-5 rounded-full object-cover" alt="" />
                    : <UserCircle2 className={`w-5 h-5 ${textS}`} />
                  }
                  <span className={`text-xs font-semibold ${textP}`}>{playlist.owner_username}</span>
                </div>
              )}
              <p className={`text-xs ${textS}`}>{songs.length} lagu</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Action buttons ──────────────────────────────── */}
      <div className="px-4 md:px-6 flex items-center gap-2.5 mb-6 mt-1 flex-wrap">
        <button
          onClick={playAll}
          disabled={songs.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-sm text-black disabled:opacity-50 shadow-lg transition-all active:scale-95"
          style={{ background: accentColor }}
        >
          <Play className="w-4 h-4 fill-current" />
          Putar Semua
        </button>

        <button
          onClick={shuffleAll}
          disabled={songs.length === 0}
          className={`p-2.5 rounded-full transition-all active:scale-95 disabled:opacity-50 ${isDark ? "bg-white/8 hover:bg-white/12 text-white" : "bg-black/8 hover:bg-black/12 text-[#111]"}`}
          title="Acak"
        >
          <Shuffle className="w-4 h-4" />
        </button>

        <button
          onClick={addAllToQueue}
          disabled={songs.length === 0}
          className={`p-2.5 rounded-full transition-all active:scale-95 disabled:opacity-50 ${isDark ? "bg-white/8 hover:bg-white/12 text-white" : "bg-black/8 hover:bg-black/12 text-[#111]"}`}
          title="Tambah semua ke antrian"
        >
          <ListPlus className="w-4 h-4" />
        </button>

        {!isOwner && (
          <button
            onClick={addToMyPlaylists}
            disabled={addingToMine || addedToMine}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95 disabled:opacity-70 ${isDark ? "bg-white/8 hover:bg-white/12 text-white" : "bg-black/8 hover:bg-black/12 text-[#111]"}`}
          >
            {addedToMine
              ? <><Check className="w-3.5 h-3.5" style={{ color: accentColor }} /><span style={{ color: accentColor }}>Tersimpan</span></>
              : addingToMine ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <><Plus className="w-3.5 h-3.5" />Simpan</>
            }
          </button>
        )}

        <button
          onClick={shareUrl}
          className={`p-2.5 rounded-full transition-all active:scale-95 ${isDark ? "bg-white/8 hover:bg-white/12 text-white" : "bg-black/8 hover:bg-black/12 text-[#111]"}`}
          title="Bagikan"
        >
          {copied ? <Check className="w-4 h-4" style={{ color: accentColor }} /> : <Share2 className="w-4 h-4" />}
        </button>
      </div>

      {/* ── Song list ───────────────────────────────────── */}
      <div className="px-4 md:px-6">
        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in gap-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${accentColor}18` }}>
              <Music2 className="w-8 h-8" style={{ color: accentColor }} />
            </div>
            <h3 className={`text-base font-bold ${textP}`}>Playlist masih kosong</h3>
            <p className={`text-sm ${textS}`}>Tambahkan lagu dari halaman Cari</p>
          </div>
        ) : (
          <div className={`rounded-2xl overflow-hidden border divide-y ${isDark ? "bg-[#161616] border-white/[0.06] divide-white/[0.04]" : "bg-white border-black/[0.06] divide-black/[0.04]"}`}>
            {songs.map((song, i) => (
              <div
                key={`${song.videoId}-${i}`}
                className={`relative flex items-center gap-2.5 px-3 py-2.5 ${cardHover} song-item cursor-pointer group`}
                onClick={() => playSong(song, songs)}
              >
                <span className={`w-5 text-xs text-right flex-shrink-0 ${textS}`}>{i + 1}</span>
                <img src={song.thumbnail} className="w-11 h-11 rounded-xl object-cover flex-shrink-0"
                  onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/44x44/333/999?text=♪"; }} alt="" />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${textP}`}>{song.title}</p>
                  <p className={`text-xs truncate ${textS}`}>{song.artist}</p>
                </div>
                <span className={`text-xs flex-shrink-0 ${textS} hidden sm:block`}>{song.duration}</span>

                {/* Menu button */}
                <button
                  onClick={e => { e.stopPropagation(); setMenuSongId(menuSongId === song.rowId ? null : (song.rowId || null)); }}
                  className={`p-2 rounded-full transition-all ${isDark ? "hover:bg-white/10" : "hover:bg-black/8"} ${textS} opacity-0 group-hover:opacity-100`}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* Context menu */}
                {menuSongId === song.rowId && (
                  <div
                    className={`absolute right-3 top-full mt-1 w-48 rounded-xl border shadow-xl z-50 overflow-hidden animate-scale-in ${isDark ? "bg-[#222] border-white/10" : "bg-white border-black/10"}`}
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => { addToQueue(song); setMenuSongId(null); toast({ title: "✓ Ditambahkan ke antrian" }); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition-colors ${isDark ? `text-white/70 hover:bg-white/8` : `text-[#111]/70 hover:bg-black/5`}`}
                    >
                      <Plus className="w-3.5 h-3.5" />Tambah ke Antrian
                    </button>
                    {isOwner && (
                      <button
                        onClick={() => removeSong(song)}
                        disabled={removingId === song.rowId}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        {removingId === song.rowId
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                        Hapus dari Playlist
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
