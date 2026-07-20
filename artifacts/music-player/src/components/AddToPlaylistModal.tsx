import React, { useState, useEffect } from "react";
import { X, Plus, Music2, Check, Loader2, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { toast } from "@/hooks/use-toast";
import type { Song } from "@/lib/musicApi";
import { getHQThumbnail, onThumbnailError } from "@/lib/utils";

interface Playlist {
  id: string;
  name: string;
  cover_url: string;
  song_count?: number;
}

interface Props {
  song: Song;
  onClose: () => void;
}

export default function AddToPlaylistModal({ song, onClose }: Props) {
  const { user } = useAuth();
  const { theme, accentColor, lang } = useAppSettings();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#181818]" : "bg-white";
  const card = isDark ? "bg-[#242424] hover:bg-[#2e2e2e] border-white/8" : "bg-[#F5F5F5] hover:bg-[#EBEBEB] border-black/8";
  const border = isDark ? "border-white/8" : "border-black/8";
  const textP = isDark ? "text-white" : "text-[#121212]";
  const textS = isDark ? "text-white/50" : "text-[#121212]/50";
  const inputBg = isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/30" : "bg-black/5 border-black/10 text-[#121212] placeholder:text-black/30";

  useEffect(() => {
    if (user) loadPlaylists();
  }, [user]);

  async function loadPlaylists() {
    setLoading(true);
    const { data } = await supabase
      .from("playlists")
      .select("id, name, cover_url, playlist_songs(count)")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });
    setPlaylists((data || []).map((p: any) => ({
      ...p, song_count: p.playlist_songs?.[0]?.count || 0
    })));

    // Check which playlists already contain this song
    const { data: existing } = await supabase
      .from("playlist_songs")
      .select("playlist_id")
      .eq("video_id", song.videoId);
    setAdded(new Set((existing || []).map((e: any) => e.playlist_id)));
    setLoading(false);
  }

  async function addToPlaylist(playlistId: string) {
    if (added.has(playlistId)) {
      toast({ title: lang === "en" ? "Already in playlist" : "Sudah ada di playlist ini" });
      return;
    }
    setAdding(playlistId);
    const { error } = await supabase.from("playlist_songs").insert({
      playlist_id: playlistId,
      video_id:    song.videoId,
      title:       song.title,
      artist:      song.artist,
      thumbnail:   song.thumbnail,
      duration:    song.duration,
      source:      song.source,
      url:         song.url,
    });
    setAdding(null);
    if (error) {
      toast({ title: "Gagal menambah ke playlist", description: error.message, variant: "destructive" });
    } else {
      setAdded(prev => new Set([...prev, playlistId]));
      const pl = playlists.find(p => p.id === playlistId);
      toast({ title: `✓ Ditambahkan ke "${pl?.name}"` });
    }
  }

  async function createAndAdd() {
    if (!newName.trim() || !user) return;
    setCreating(true);
    const { data: newPl, error } = await supabase.from("playlists").insert({
      user_id: user.id,
      name: newName.trim(),
    }).select().single();
    if (error || !newPl) {
      toast({ title: "Gagal membuat playlist", variant: "destructive" });
      setCreating(false); return;
    }
    await addToPlaylist(newPl.id);
    setNewName(""); setShowCreate(false);
    setPlaylists(prev => [{ ...newPl, song_count: 1 }, ...prev]);
    setCreating(false);
  }

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end md:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-sm rounded-t-3xl md:rounded-3xl ${bg} shadow-2xl flex flex-col border ${border}`}
        style={{ maxHeight: "85vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center gap-3 px-5 pt-5 pb-4 border-b ${border} flex-shrink-0`}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img src={getHQThumbnail(song.thumbnail)} className="w-10 h-10 rounded-xl object-cover img-hq flex-shrink-0" alt=""
              decoding="async" onError={e => onThumbnailError(e, song.thumbnail)} />
            <div className="min-w-0">
              <p className={`text-sm font-bold truncate ${textP}`}>Tambah ke Playlist</p>
              <p className={`text-xs truncate ${textS}`}>{song.title}</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full ${isDark ? "hover:bg-white/10" : "hover:bg-black/8"} transition-colors flex-shrink-0`}>
            <X className={`w-5 h-5 ${textS}`} />
          </button>
        </div>

        {/* Create new button */}
        <div className={`px-4 py-3 border-b ${border} flex-shrink-0`}>
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-3 w-full py-2 px-3 rounded-2xl transition-colors active:scale-[0.98]"
              style={{ background: `${accentColor}18` }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: accentColor }}>
                <Plus className="w-5 h-5 text-black" />
              </div>
              <span className="font-semibold text-sm" style={{ color: accentColor }}>
                {lang === "en" ? "Create new playlist" : "Buat playlist baru"}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={lang === "en" ? "Playlist name…" : "Nama playlist…"}
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") createAndAdd(); if (e.key === "Escape") setShowCreate(false); }}
                className={`flex-1 border rounded-xl px-3 py-2 text-sm outline-none ${inputBg}`}
              />
              <button onClick={createAndAdd} disabled={!newName.trim() || creating}
                className="px-3 py-2 rounded-xl text-sm font-bold text-black disabled:opacity-50 transition-all active:scale-95"
                style={{ background: accentColor }}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : lang === "en" ? "Create" : "Buat"}
              </button>
              <button onClick={() => setShowCreate(false)} className={`p-2 ${textS}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Playlist list */}
        <div className="flex-1 overflow-y-auto">
          {!user ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Lock className={`w-10 h-10 ${textS}`} />
              <p className={`text-sm ${textS}`}>{lang === "en" ? "Sign in to add to playlists" : "Masuk untuk tambah ke playlist"}</p>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: accentColor }} />
            </div>
          ) : playlists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Music2 className={`w-10 h-10 ${textS}`} />
              <p className={`text-sm ${textS}`}>{lang === "en" ? "No playlists yet" : "Belum ada playlist"}</p>
            </div>
          ) : (
            <div className="p-3 space-y-1.5">
              {playlists.map(pl => {
                const isAdded = added.has(pl.id);
                const isAdding = adding === pl.id;
                return (
                  <button
                    key={pl.id}
                    onClick={() => addToPlaylist(pl.id)}
                    disabled={isAdding}
                    className={`flex items-center gap-3 w-full p-3 rounded-2xl border transition-all active:scale-[0.98] ${isAdded ? "" : card}`}
                    style={isAdded ? { background: `${accentColor}18`, borderColor: `${accentColor}44` } : {}}
                  >
                    <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden">
                      {pl.cover_url ? (
                        <img src={pl.cover_url} className="w-full h-full object-cover" alt={pl.name} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: `${accentColor}22` }}>
                          <Music2 className="w-5 h-5" style={{ color: accentColor }} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className={`text-sm font-semibold truncate ${isAdded ? "" : textP}`} style={isAdded ? { color: accentColor } : {}}>
                        {pl.name}
                      </p>
                      <p className={`text-xs ${textS}`}>{pl.song_count || 0} {lang === "en" ? "songs" : "lagu"}</p>
                    </div>
                    <div className="flex-shrink-0">
                      {isAdding ? (
                        <Loader2 className="w-5 h-5 animate-spin" style={{ color: accentColor }} />
                      ) : isAdded ? (
                        <Check className="w-5 h-5" style={{ color: accentColor }} />
                      ) : (
                        <Plus className={`w-5 h-5 ${textS}`} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom padding for safe area */}
        <div className="h-4 flex-shrink-0" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} />
      </div>
    </div>
  );
}
