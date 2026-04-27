import React, { useState, useEffect } from "react";
import { Library, Plus, Lock, Music, Trash2, Globe } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { Link } from "wouter";
import { toast } from "@/hooks/use-toast";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { t } from "@/lib/i18n";

interface Playlist {
  id: string;
  name: string;
  description: string;
  cover_url: string;
  is_public: boolean;
  created_at: string;
  song_count?: number;
}

export default function Playlists() {
  const { user } = useAuth();
  const { theme, accentColor, lang } = useAppSettings();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#121212]" : "bg-[#F5F5F5]";
  const cardBg = isDark ? "bg-[#181818] hover:bg-[#282828]" : "bg-white hover:bg-gray-50";
  const textP = isDark ? "text-white" : "text-[#121212]";
  const textS = isDark ? "text-white/50" : "text-[#121212]/50";
  const inputClass = isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/30" : "bg-black/5 border-black/10 text-[#121212] placeholder:text-black/30 focus:border-black/30";
  const borderC = isDark ? "border-white/8" : "border-black/8";

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadPlaylists();
  }, [user]);

  async function loadPlaylists() {
    setLoading(true);
    const { data } = await supabase
      .from("playlists")
      .select("*, playlist_songs(count)")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });
    setPlaylists((data || []).map((p: any) => ({ ...p, song_count: p.playlist_songs?.[0]?.count || 0 })));
    setLoading(false);
  }

  async function createPlaylist() {
    if (!newName.trim() || !user) return;
    setCreating(true);
    const { error } = await supabase.from("playlists").insert({ user_id: user.id, name: newName.trim(), description: newDesc.trim() });
    if (error) { toast({ title: t(lang, "error"), description: error.message, variant: "destructive" }); }
    else {
      toast({ title: "✓ " + t(lang, "success"), description: newName });
      setNewName(""); setNewDesc(""); setShowCreate(false);
      loadPlaylists();
    }
    setCreating(false);
  }

  async function deletePlaylist(id: string, name: string) {
    if (!confirm(lang === "en" ? `Delete "${name}"?` : `Hapus "${name}"?`)) return;
    await supabase.from("playlists").delete().eq("id", id);
    setPlaylists(p => p.filter(pl => pl.id !== id));
    toast({ title: "✓ " + t(lang, "song_removed") });
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
      <div className="flex items-center justify-between py-6">
        <div className="flex items-center gap-3">
          <Library className="w-6 h-6" style={{ color: accentColor }} />
          <h1 className={`text-2xl font-bold ${textP}`}>{t(lang, "library")}</h1>
        </div>
        <button
          onClick={() => setShowCreate(s => !s)}
          className="flex items-center gap-2 font-bold px-4 py-2 rounded-full text-sm text-black transition-colors"
          style={{ background: accentColor }}
        >
          <Plus className="w-4 h-4" /> {t(lang, "create_playlist")}
        </button>
      </div>

      {showCreate && (
        <div className={`border ${borderC} rounded-2xl p-6 mb-6 ${isDark ? "bg-[#1A1A1A]" : "bg-white"}`}>
          <h3 className={`font-bold mb-4 ${textP}`}>{t(lang, "create_playlist")}</h3>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={lang === "en" ? "Playlist name" : "Nama playlist"}
            className={`w-full border rounded-xl px-4 py-3 outline-none mb-3 transition-colors ${inputClass}`}
            onKeyDown={e => e.key === "Enter" && createPlaylist()} />
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder={lang === "en" ? "Optional description" : "Deskripsi (opsional)"}
            className={`w-full border rounded-xl px-4 py-3 outline-none mb-4 transition-colors ${inputClass}`} />
          <div className="flex gap-3">
            <button onClick={() => setShowCreate(false)} className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-colors ${isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-black/10 text-[#121212] hover:bg-black/20"}`}>{t(lang, "cancel")}</button>
            <button onClick={createPlaylist} disabled={creating || !newName.trim()} className="flex-1 py-2.5 rounded-full text-sm font-bold text-black disabled:opacity-50 transition-all" style={{ background: accentColor }}>
              {creating ? t(lang, "loading") : t(lang, "create_playlist")}
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
      ) : playlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Library className={`w-16 h-16 mb-4 ${textS}`} />
          <h3 className={`text-xl font-semibold mb-2 ${textP}`}>{lang === "en" ? "Create your first playlist" : "Buat playlist pertamamu"}</h3>
          <p className={`text-sm mb-4 ${textS}`}>{lang === "en" ? "It's easy, we'll help you" : "Mudah, kami bantu kamu"}</p>
          <button onClick={() => setShowCreate(true)} className="font-bold px-6 py-2.5 rounded-full text-sm text-black" style={{ background: accentColor }}>
            {t(lang, "create_playlist")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {playlists.map(pl => (
            <div key={pl.id} className={`group relative rounded-xl p-4 cursor-pointer transition-all ${cardBg} border ${borderC}`}>
              <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center mb-3 overflow-hidden">
                {pl.cover_url ? <img src={pl.cover_url} alt={pl.name} className="w-full h-full object-cover" /> : <Music className={`w-12 h-12 ${textS}`} />}
              </div>
              <h3 className={`font-semibold text-sm truncate mb-1 ${textP}`}>{pl.name}</h3>
              <p className={`text-xs truncate ${textS}`}>{pl.song_count || 0} {lang === "en" ? "songs" : "lagu"}</p>
              <button onClick={e => { e.stopPropagation(); deletePlaylist(pl.id, pl.name); }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-black/60 p-1.5 rounded-full text-white/50 hover:text-white transition-all">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
