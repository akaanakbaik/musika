import React, { useState, useEffect } from "react";
import { Library, Plus, Lock, Music, MoreHorizontal, Trash2, Edit, Lock as LockIcon, Globe } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { Link } from "wouter";
import { toast } from "@/hooks/use-toast";

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
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

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
    
    setPlaylists((data || []).map((p: any) => ({
      ...p,
      song_count: p.playlist_songs?.[0]?.count || 0
    })));
    setLoading(false);
  }

  async function createPlaylist() {
    if (!newName.trim() || !user) return;
    setCreating(true);
    const { error } = await supabase.from("playlists").insert({
      user_id: user.id,
      name: newName.trim(),
      description: newDesc.trim()
    });
    if (error) {
      toast({ title: "Failed to create playlist", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Playlist created!", description: newName });
      setNewName(""); setNewDesc(""); setShowCreate(false);
      loadPlaylists();
    }
    setCreating(false);
  }

  async function deletePlaylist(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    await supabase.from("playlists").delete().eq("id", id);
    setPlaylists(p => p.filter(pl => pl.id !== id));
    toast({ title: "Playlist deleted" });
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center text-center px-4">
        <Lock className="w-16 h-16 text-white/20 mb-4" />
        <h2 className="text-white text-2xl font-bold mb-2">Sign in to manage playlists</h2>
        <Link href="/auth" className="bg-[#1DB954] text-black font-bold px-8 py-3 rounded-full hover:bg-[#1ed760] transition-colors mt-4 inline-block">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] px-4 md:px-8 pb-24 md:pb-8">
      <div className="flex items-center justify-between py-6">
        <div className="flex items-center gap-3">
          <Library className="w-6 h-6 text-[#1DB954]" />
          <h1 className="text-white text-2xl font-bold">Your Library</h1>
        </div>
        <button
          onClick={() => setShowCreate(s => !s)}
          className="flex items-center gap-2 bg-[#1DB954] text-black font-bold px-4 py-2 rounded-full text-sm hover:bg-[#1ed760] transition-colors"
        >
          <Plus className="w-4 h-4" /> New Playlist
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold mb-4">Create Playlist</h3>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Playlist name"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#1DB954] mb-3 transition-colors"
            onKeyDown={e => e.key === "Enter" && createPlaylist()}
          />
          <input
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Add an optional description"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#1DB954] mb-4 transition-colors"
          />
          <div className="flex gap-3">
            <button onClick={() => setShowCreate(false)} className="flex-1 bg-white/10 text-white py-2 rounded-full hover:bg-white/20 transition-colors text-sm font-medium">Cancel</button>
            <button onClick={createPlaylist} disabled={creating || !newName.trim()} className="flex-1 bg-[#1DB954] text-black py-2 rounded-full hover:bg-[#1ed760] transition-colors text-sm font-bold disabled:opacity-50">
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Playlists grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white/5 rounded-lg p-4 animate-pulse">
              <div className="w-full aspect-square bg-white/10 rounded-lg mb-3" />
              <div className="h-3 bg-white/10 rounded w-3/4 mb-2" />
              <div className="h-2 bg-white/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : playlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Library className="w-16 h-16 text-white/20 mb-4" />
          <h3 className="text-white text-xl font-semibold mb-2">Create your first playlist</h3>
          <p className="text-white/50 text-sm mb-4">It's easy, we'll help you</p>
          <button onClick={() => setShowCreate(true)} className="bg-[#1DB954] text-black font-bold px-6 py-2 rounded-full hover:bg-[#1ed760] transition-colors text-sm">
            Create playlist
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {playlists.map(pl => (
            <div key={pl.id} className="group relative bg-[#181818] hover:bg-[#282828] rounded-lg p-4 cursor-pointer transition-all">
              <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-[#1DB954]/40 to-purple-600/40 flex items-center justify-center mb-3 overflow-hidden">
                {pl.cover_url ? (
                  <img src={pl.cover_url} alt={pl.name} className="w-full h-full object-cover" />
                ) : (
                  <Music className="w-12 h-12 text-white/60" />
                )}
              </div>
              <h3 className="text-white font-semibold text-sm truncate mb-1">{pl.name}</h3>
              <p className="text-white/50 text-xs truncate">{pl.song_count || 0} songs • {pl.is_public ? <><Globe className="w-3 h-3 inline" /> Public</> : <><LockIcon className="w-3 h-3 inline" /> Private</>}</p>
              <button
                onClick={(e) => { e.stopPropagation(); deletePlaylist(pl.id, pl.name); }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-black/60 p-1.5 rounded-full text-white/50 hover:text-white transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
