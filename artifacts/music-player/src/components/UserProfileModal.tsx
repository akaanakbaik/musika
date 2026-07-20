import React, { useEffect, useState } from "react";
import { X, Calendar, Music2, Plus, Copy, CheckCheck, UserCircle2, Disc3 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePlayer } from "@/lib/PlayerContext";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { toast } from "@/hooks/use-toast";
import type { Song } from "@/lib/musicApi";
import { getHQThumbnail, onThumbnailError } from "@/lib/utils";

interface PublicProfile {
  id: string;
  username: string;
  bio: string;
  avatar_url: string;
  created_at: string;
  musika_id?: string;
}

interface PublicPlaylist {
  id: string;
  name: string;
  description: string;
  cover_url: string;
  song_count?: number;
  songs?: Song[];
}

interface Props {
  userId: string;
  onClose: () => void;
}

export default function UserProfileModal({ userId, onClose }: Props) {
  const { theme, accentColor } = useAppSettings();
  const { addToQueue } = usePlayer();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [playlists, setPlaylists] = useState<PublicPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(false);
  const [expandedPlaylist, setExpandedPlaylist] = useState<string | null>(null);
  const [playlistSongs, setPlaylistSongs] = useState<Record<string, Song[]>>({});
  const [loadingPlaylist, setLoadingPlaylist] = useState<string | null>(null);

  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#141414]" : "bg-white";
  const card = isDark ? "bg-[#1e1e1e] border-white/8" : "bg-[#F5F5F5] border-black/8";
  const textP = isDark ? "text-white" : "text-[#121212]";
  const textS = isDark ? "text-white/50" : "text-[#121212]/50";

  useEffect(() => {
    loadUserData();
  }, [userId]);

  async function loadUserData() {
    setLoading(true);
    try {
      const { data: prof } = await supabase
        .from("user_profiles")
        .select("id, username, bio, avatar_url, created_at, musika_id")
        .eq("id", userId)
        .single();
      if (prof) setProfile(prof);

      const { data: pls } = await supabase
        .from("playlists")
        .select("id, name, description, cover_url")
        .eq("user_id", userId)
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(20);

      if (pls) {
        const withCounts = await Promise.all(
          pls.map(async pl => {
            const { count } = await supabase
              .from("playlist_songs")
              .select("*", { count: "exact", head: true })
              .eq("playlist_id", pl.id);
            return { ...pl, song_count: count || 0 };
          })
        );
        setPlaylists(withCounts);
      }
    } catch {}
    setLoading(false);
  }

  async function loadPlaylistSongs(playlistId: string) {
    if (playlistSongs[playlistId]) {
      setExpandedPlaylist(expandedPlaylist === playlistId ? null : playlistId);
      return;
    }
    setLoadingPlaylist(playlistId);
    const { data } = await supabase
      .from("playlist_songs")
      .select("*")
      .eq("playlist_id", playlistId)
      .order("added_at", { ascending: true })
      .limit(50);
    setPlaylistSongs(prev => ({ ...prev, [playlistId]: (data || []) as Song[] }));
    setExpandedPlaylist(playlistId);
    setLoadingPlaylist(null);
  }

  async function addPlaylistToMine(playlist: PublicPlaylist) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast({ title: "Masuk dulu untuk menyimpan playlist", variant: "destructive" }); return; }

    try {
      const { data: newPl, error } = await supabase.from("playlists").insert({
        user_id: session.user.id,
        name: playlist.name + " (Salinan)",
        description: playlist.description,
        is_public: false
      }).select().single();

      if (error || !newPl) throw error;

      const songs = playlistSongs[playlist.id] || [];
      if (songs.length > 0) {
        await supabase.from("playlist_songs").insert(
          songs.map(s => ({ ...s, id: undefined, playlist_id: newPl.id, added_at: new Date().toISOString() }))
        );
      }
      toast({ title: "✓ Playlist disimpan ke librarimu", description: `"${playlist.name}" berhasil disalin` });
    } catch {
      toast({ title: "Gagal menyimpan playlist", variant: "destructive" });
    }
  }

  function copyId() {
    if (!profile?.musika_id) return;
    navigator.clipboard.writeText(profile.musika_id).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    });
  }

  const getInitial = (s: string) => s?.trim()[0]?.toUpperCase() || "?";

  return (
    <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div
        className={`w-full max-w-lg rounded-t-3xl md:rounded-3xl ${bg} shadow-2xl flex flex-col max-h-[90vh] overflow-hidden`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className={`font-bold text-base ${textP}`}>Profil Pengguna</h3>
          <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDark ? "hover:bg-white/10" : "hover:bg-black/8"}`}>
            <X className={`w-5 h-5 ${textS}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-2 border-white/20 rounded-full animate-spin" style={{ borderTopColor: accentColor }} />
              <p className={`text-sm ${textS}`}>Memuat profil…</p>
            </div>
          ) : !profile ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <UserCircle2 className={`w-14 h-14 ${textS}`} />
              <p className={`text-sm ${textS}`}>Pengguna tidak ditemukan</p>
            </div>
          ) : (
            <>
              {/* Profile header */}
              <div className="px-5 pb-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative flex-shrink-0">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} className="w-20 h-20 rounded-full object-cover border-4" style={{ borderColor: accentColor }} alt={profile.username} />
                    ) : (
                      <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black text-black border-4" style={{ background: accentColor, borderColor: accentColor }}>
                        {getInitial(profile.username || profile.id)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className={`text-xl font-black truncate ${textP}`}>{profile.username || "Pengguna"}</h2>
                    {profile.musika_id && (
                      <button onClick={copyId} className={`flex items-center gap-1.5 mt-1 group`}>
                        <span className={`text-xs font-mono tracking-widest ${textS}`}>#{profile.musika_id}</span>
                        {copiedId
                          ? <CheckCheck className="w-3.5 h-3.5" style={{ color: accentColor }} />
                          : <Copy className={`w-3 h-3 ${textS} group-hover:opacity-100 opacity-50 transition-opacity`} />
                        }
                      </button>
                    )}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Calendar className={`w-3.5 h-3.5 ${textS}`} />
                      <span className={`text-xs ${textS}`}>Bergabung {new Date(profile.created_at).toLocaleDateString("id-ID", { year: "numeric", month: "long" })}</span>
                    </div>
                  </div>
                </div>

                {profile.bio && (
                  <div className={`rounded-2xl px-4 py-3 border ${card} text-sm ${textS} italic leading-relaxed`}>
                    "{profile.bio}"
                  </div>
                )}
              </div>

              {/* Playlists */}
              <div className="px-5 pb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Disc3 className={`w-4 h-4 ${textS}`} />
                  <h4 className={`font-bold text-sm ${textP}`}>Playlist Publik</h4>
                  <span className={`text-xs ${textS}`}>({playlists.length})</span>
                </div>

                {playlists.length === 0 ? (
                  <div className={`text-center py-8 text-sm ${textS}`}>Belum ada playlist publik</div>
                ) : (
                  <div className="space-y-2">
                    {playlists.map(pl => (
                      <div key={pl.id} className={`rounded-2xl border overflow-hidden ${card}`}>
                        <div className="flex items-center gap-3 p-3">
                          <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden">
                            {pl.cover_url ? (
                              <img src={pl.cover_url} className="w-full h-full object-cover" alt={pl.name} />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center" style={{ background: `${accentColor}22` }}>
                                <Music2 className="w-5 h-5" style={{ color: accentColor }} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${textP}`}>{pl.name}</p>
                            <p className={`text-xs ${textS}`}>{pl.song_count} lagu</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => addPlaylistToMine(pl)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-90"
                              style={{ background: `${accentColor}22`, color: accentColor }}
                            >
                              <Plus className="w-3 h-3" />
                              Simpan
                            </button>
                            <button
                              onClick={() => loadPlaylistSongs(pl.id)}
                              className={`p-1.5 rounded-full transition-colors ${isDark ? "hover:bg-white/10" : "hover:bg-black/8"}`}
                            >
                              {loadingPlaylist === pl.id ? (
                                <div className="w-4 h-4 border-2 border-white/20 rounded-full animate-spin" style={{ borderTopColor: accentColor }} />
                              ) : (
                                <Music2 className={`w-4 h-4 ${textS} transition-transform ${expandedPlaylist === pl.id ? "rotate-90" : ""}`} />
                              )}
                            </button>
                          </div>
                        </div>

                        {expandedPlaylist === pl.id && playlistSongs[pl.id] && (
                          <div className={`border-t ${isDark ? "border-white/8" : "border-black/8"} px-3 pb-2`}>
                            {playlistSongs[pl.id].length === 0 ? (
                              <p className={`text-xs py-3 text-center ${textS}`}>Playlist kosong</p>
                            ) : (
                              playlistSongs[pl.id].slice(0, 10).map((song, i) => (
                                <div key={i} className={`flex items-center gap-2 py-2 ${i > 0 ? `border-t ${isDark ? "border-white/5" : "border-black/5"}` : ""}`}>
                                  <img src={getHQThumbnail(song.thumbnail)} className="w-8 h-8 rounded-lg object-cover img-hq flex-shrink-0" alt="" decoding="async" onError={e => onThumbnailError(e, song.thumbnail)} />
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-medium truncate ${textP}`}>{song.title}</p>
                                    <p className={`text-[10px] ${textS} truncate`}>{song.artist}</p>
                                  </div>
                                  <button onClick={() => { addToQueue(song); toast({ title: "✓ Ditambahkan ke antrean" }); }} className={`p-1 rounded transition-colors ${isDark ? "hover:bg-white/10" : "hover:bg-black/8"}`}>
                                    <Plus className={`w-3.5 h-3.5 ${textS}`} />
                                  </button>
                                </div>
                              ))
                            )}
                            {playlistSongs[pl.id].length > 10 && (
                              <p className={`text-xs text-center py-2 ${textS}`}>+{playlistSongs[pl.id].length - 10} lagu lagi</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
