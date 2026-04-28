import React, { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { usePlayer } from "@/lib/PlayerContext";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Play, Plus, Music2, Globe, Lock, Share2, Loader2, Check, UserCircle2 } from "lucide-react";
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

export default function PlaylistDetail() {
  const [, params] = useRoute("/playlist/:id");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { theme, accentColor, lang } = useAppSettings();
  const { playSong, addToQueue } = usePlayer();

  const playlistId = params?.id;

  const [playlist, setPlaylist] = useState<PlaylistInfo | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [addingToMine, setAddingToMine] = useState(false);
  const [addedToMine, setAddedToMine] = useState(false);
  const [copied, setCopied] = useState(false);

  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#121212]" : "bg-[#F5F5F5]";
  const card = isDark ? "bg-[#1a1a1a] border-white/8" : "bg-white border-black/8";
  const textP = isDark ? "text-white" : "text-[#121212]";
  const textS = isDark ? "text-white/50" : "text-[#121212]/50";
  const border = isDark ? "border-white/8" : "border-black/8";

  useEffect(() => { if (playlistId) load(); }, [playlistId]);

  async function load() {
    setLoading(true);
    const { data: pl } = await supabase
      .from("playlists")
      .select("*")
      .eq("id", playlistId)
      .single();

    if (!pl) { setNotFound(true); setLoading(false); return; }

    // Only show if public or owner
    if (!pl.is_public && pl.user_id !== user?.id) {
      setNotFound(true); setLoading(false); return;
    }

    // Load owner info
    const { data: owner } = await supabase
      .from("user_profiles")
      .select("username, avatar_url")
      .eq("id", pl.user_id)
      .single();

    setPlaylist({ ...pl, owner_username: owner?.username, owner_avatar: owner?.avatar_url });

    const { data: songData } = await supabase
      .from("playlist_songs")
      .select("*")
      .eq("playlist_id", playlistId)
      .order("added_at", { ascending: true });

    setSongs((songData || []) as Song[]);
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
          video_id:    s.videoId,
          title:       s.title,
          artist:      s.artist,
          thumbnail:   s.thumbnail,
          duration:    s.duration,
          source:      s.source,
          url:         s.url,
          added_at:    new Date().toISOString(),
        }))
      );
    }

    setAddingToMine(false);
    setAddedToMine(true);
    toast({ title: `✓ Playlist "${playlist!.name}" disimpan!` });
  }

  function shareUrl() {
    const url = getPlaylistShareUrl(playlistId!);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "✓ Link disalin!" });
    });
  }

  function playAll() {
    if (songs.length === 0) return;
    playSong(songs[0], songs);
    toast({ title: `▶️ Memutar ${songs.length} lagu` });
  }

  function addAllToQueue() {
    songs.forEach(s => addToQueue(s));
    toast({ title: `✓ ${songs.length} lagu ditambahkan ke queue` });
  }

  if (loading) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center`}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
      </div>
    );
  }

  if (notFound || !playlist) {
    return (
      <div className={`min-h-screen ${bg} flex flex-col items-center justify-center gap-4 px-4`}>
        <Lock className={`w-16 h-16 ${textS}`} />
        <h2 className={`text-xl font-bold ${textP}`}>{lang === "en" ? "Playlist not found" : "Playlist tidak ditemukan"}</h2>
        <p className={`text-sm ${textS} text-center`}>{lang === "en" ? "This playlist is private or doesn't exist." : "Playlist ini bersifat privat atau tidak ada."}</p>
        <button onClick={() => navigate("/playlists")} className="font-bold px-6 py-3 rounded-full text-sm text-black" style={{ background: accentColor }}>
          {lang === "en" ? "Go to Library" : "Ke Perpustakaan"}
        </button>
      </div>
    );
  }

  const isOwner = user?.id === playlist.user_id;

  return (
    <div className={`min-h-screen ${bg} pb-32 md:pb-8`}>
      {/* Header */}
      <div className="relative">
        {/* Blurred BG */}
        <div className="absolute inset-0 overflow-hidden" style={{ height: 280 }}>
          {playlist.cover_url && <img src={playlist.cover_url} className="w-full h-full object-cover" style={{ filter: "blur(40px) brightness(0.4) saturate(1.5)" }} alt="" />}
          <div className="absolute inset-0" style={{ background: isDark ? "linear-gradient(to bottom, rgba(18,18,18,0.3), #121212)" : "linear-gradient(to bottom, rgba(245,245,245,0.3), #F5F5F5)" }} />
        </div>

        <div className="relative px-4 md:px-8 pt-4">
          <button onClick={() => navigate(-1 as any)} className={`p-2 rounded-full mb-4 ${isDark ? "bg-white/10 hover:bg-white/20 text-white" : "bg-black/10 hover:bg-black/20 text-[#121212]"} transition-colors`}>
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-end gap-6 pb-6" style={{ minHeight: 180 }}>
            <div className="w-40 h-40 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0">
              {playlist.cover_url
                ? <img src={playlist.cover_url} className="w-full h-full object-cover" alt={playlist.name} />
                : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${accentColor}44, ${accentColor}22)` }}>
                    <Music2 className="w-16 h-16" style={{ color: accentColor }} />
                  </div>
                )
              }
            </div>

            <div className="flex-1 min-w-0 pb-2">
              <p className={`text-xs uppercase tracking-widest font-bold mb-1 ${textS}`}>
                {playlist.is_public ? <span className="flex items-center gap-1"><Globe className="w-3 h-3" />Publik</span> : <span className="flex items-center gap-1"><Lock className="w-3 h-3" />Privat</span>}
              </p>
              <h1 className={`text-2xl md:text-3xl font-black mb-2 ${textP}`}>{playlist.name}</h1>
              {playlist.description && <p className={`text-sm mb-2 ${textS} line-clamp-2`}>{playlist.description}</p>}

              {/* Owner */}
              {playlist.owner_username && (
                <div className="flex items-center gap-2 mb-2">
                  {playlist.owner_avatar
                    ? <img src={playlist.owner_avatar} className="w-6 h-6 rounded-full object-cover" alt="" />
                    : <UserCircle2 className={`w-6 h-6 ${textS}`} />
                  }
                  <span className={`text-sm font-semibold ${textP}`}>{playlist.owner_username}</span>
                </div>
              )}

              <p className={`text-xs ${textS}`}>{songs.length} {lang === "en" ? "songs" : "lagu"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 md:px-8 flex items-center gap-3 mb-6 flex-wrap">
        <button
          onClick={playAll}
          disabled={songs.length === 0}
          className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-black disabled:opacity-50 shadow-lg transition-all active:scale-95"
          style={{ background: accentColor }}
        >
          <Play className="w-4 h-4 fill-current" />
          {lang === "en" ? "Play All" : "Putar Semua"}
        </button>

        <button
          onClick={addAllToQueue}
          disabled={songs.length === 0}
          className={`flex items-center gap-2 px-4 py-3 rounded-full font-bold text-sm disabled:opacity-50 transition-all active:scale-95 border ${border} ${isDark ? "bg-white/8 text-white hover:bg-white/12" : "bg-black/5 text-[#121212] hover:bg-black/8"}`}
        >
          <Plus className="w-4 h-4" />
          Queue
        </button>

        {!isOwner && (
          <button
            onClick={addToMyPlaylists}
            disabled={addingToMine || addedToMine}
            className={`flex items-center gap-2 px-4 py-3 rounded-full font-bold text-sm transition-all active:scale-95 border ${border} ${isDark ? "bg-white/8 text-white hover:bg-white/12" : "bg-black/5 text-[#121212] hover:bg-black/8"} disabled:opacity-70`}
          >
            {addedToMine
              ? <><Check className="w-4 h-4" style={{ color: accentColor }} /><span style={{ color: accentColor }}>Tersimpan</span></>
              : addingToMine
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><Plus className="w-4 h-4" />{lang === "en" ? "Save to Library" : "Simpan ke Librari"}</>
            }
          </button>
        )}

        <button
          onClick={shareUrl}
          className={`flex items-center gap-2 px-4 py-3 rounded-full font-bold text-sm transition-all active:scale-95 border ${border} ${isDark ? "bg-white/8 text-white hover:bg-white/12" : "bg-black/5 text-[#121212] hover:bg-black/8"}`}
        >
          {copied ? <Check className="w-4 h-4" style={{ color: accentColor }} /> : <Share2 className="w-4 h-4" />}
          {copied ? (lang === "en" ? "Copied!" : "Disalin!") : (lang === "en" ? "Share" : "Bagikan")}
        </button>
      </div>

      {/* Song list */}
      <div className="px-4 md:px-8 space-y-1">
        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Music2 className={`w-12 h-12 ${textS}`} />
            <p className={`text-sm ${textS}`}>{lang === "en" ? "No songs in this playlist" : "Playlist ini masih kosong"}</p>
          </div>
        ) : (
          songs.map((song, i) => (
            <div
              key={`${song.videoId}-${i}`}
              className={`flex items-center gap-3 p-3 rounded-2xl border ${card} cursor-pointer ${isDark ? "hover:bg-white/5" : "hover:bg-black/3"} transition-all active:scale-[0.98]`}
              onClick={() => playSong(song, songs)}
            >
              <span className={`w-5 text-xs text-right flex-shrink-0 ${textS}`}>{i + 1}</span>
              <img src={song.thumbnail} className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/48x48/333/999?text=♪"; }} alt="" />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${textP}`}>{song.title}</p>
                <p className={`text-xs truncate ${textS}`}>{song.artist}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={e => { e.stopPropagation(); addToQueue(song); toast({ title: "✓ Ditambahkan ke queue" }); }}
                  className={`p-2 rounded-full ${isDark ? "hover:bg-white/10" : "hover:bg-black/8"} transition-colors`}>
                  <Plus className={`w-4 h-4 ${textS}`} />
                </button>
                <span className={`text-xs ${textS}`}>{song.duration}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
