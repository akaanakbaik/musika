import React, { useState, useEffect } from "react";
import { Clock, Trash2, Lock } from "lucide-react";
import { SongCard } from "@/components/SongCard";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Song } from "@/lib/musicApi";
import { Link } from "wouter";
import { toast } from "@/hooks/use-toast";

export default function History() {
  const { user } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadHistory();
  }, [user]);

  async function loadHistory() {
    setLoading(true);
    const { data } = await supabase
      .from("play_history")
      .select("*")
      .eq("user_id", user!.id)
      .order("played_at", { ascending: false })
      .limit(100);
    
    setSongs((data || []).map((h: any) => ({
      videoId: h.video_id,
      title: h.title,
      author: { name: h.artist },
      thumbnail: h.thumbnail,
      duration: h.duration,
      source: h.source,
      url: h.url
    })));
    setLoading(false);
  }

  async function clearHistory() {
    if (!user) return;
    if (!confirm("Clear all play history?")) return;
    await supabase.from("play_history").delete().eq("user_id", user.id);
    setSongs([]);
    toast({ title: "History cleared" });
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center text-center px-4">
        <Lock className="w-16 h-16 text-white/20 mb-4" />
        <h2 className="text-white text-2xl font-bold mb-2">Sign in to see your History</h2>
        <p className="text-white/50 text-sm mb-6">See what you've been listening to</p>
        <Link href="/auth" className="bg-[#1DB954] text-black font-bold px-8 py-3 rounded-full hover:bg-[#1ed760] transition-colors">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <div className="bg-gradient-to-b from-blue-900 to-[#121212] px-6 pt-8 pb-6">
        <div className="flex items-end gap-6">
          <div className="w-40 h-40 rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-600 flex items-center justify-center flex-shrink-0 shadow-2xl">
            <Clock className="w-20 h-20 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white/60 text-sm uppercase font-semibold tracking-wider mb-1">Recent</p>
            <h1 className="text-white text-4xl md:text-5xl font-black mb-2">History</h1>
            <p className="text-white/60 text-sm">{songs.length} plays</p>
          </div>
          {songs.length > 0 && (
            <button onClick={clearHistory} className="flex items-center gap-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg text-sm transition-colors">
              <Trash2 className="w-4 h-4" /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="px-4 md:px-6">
        {loading ? (
          <div className="space-y-2 mt-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                <div className="w-10 h-10 bg-white/10 rounded" />
                <div className="flex-1">
                  <div className="h-3 bg-white/10 rounded w-3/4 mb-2" />
                  <div className="h-2 bg-white/10 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Clock className="w-16 h-16 text-white/20 mb-4" />
            <h3 className="text-white text-xl font-semibold mb-2">No plays yet</h3>
            <p className="text-white/50 text-sm">Songs you listen to will appear here</p>
          </div>
        ) : (
          <div className="mt-4 space-y-1">
            {songs.map((song, i) => (
              <SongCard key={`${song.videoId}-${i}`} song={song} queue={songs} variant="list" index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
