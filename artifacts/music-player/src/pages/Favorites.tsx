import React, { useState, useEffect } from "react";
import { Heart, Music, Lock } from "lucide-react";
import { SongCard } from "@/components/SongCard";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Song } from "@/lib/musicApi";
import { Link } from "wouter";

export default function Favorites() {
  const { user } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadFavorites();
  }, [user]);

  async function loadFavorites() {
    setLoading(true);
    const { data } = await supabase
      .from("favorites")
      .select("*")
      .eq("user_id", user!.id)
      .order("liked_at", { ascending: false });
    
    setSongs((data || []).map((f: any) => ({
      videoId: f.video_id,
      title: f.title,
      author: { name: f.artist },
      thumbnail: f.thumbnail,
      duration: f.duration,
      source: f.source,
      url: f.url
    })));
    setLoading(false);
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center text-center px-4">
        <Lock className="w-16 h-16 text-white/20 mb-4" />
        <h2 className="text-white text-2xl font-bold mb-2">Sign in to see your Liked Songs</h2>
        <p className="text-white/50 text-sm mb-6">Save songs you love and access them anytime</p>
        <Link href="/auth" className="bg-[#1DB954] text-black font-bold px-8 py-3 rounded-full hover:bg-[#1ed760] transition-colors">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      {/* Header */}
      <div className="bg-gradient-to-b from-purple-900 to-[#121212] px-6 pt-8 pb-6">
        <div className="flex items-end gap-6">
          <div className="w-40 h-40 rounded-2xl bg-gradient-to-br from-purple-400 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-2xl">
            <Heart className="w-20 h-20 text-white fill-white" />
          </div>
          <div>
            <p className="text-white/60 text-sm uppercase font-semibold tracking-wider mb-1">Playlist</p>
            <h1 className="text-white text-4xl md:text-5xl font-black mb-2">Liked Songs</h1>
            <p className="text-white/60 text-sm">{songs.length} songs</p>
          </div>
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
            <Heart className="w-16 h-16 text-white/20 mb-4" />
            <h3 className="text-white text-xl font-semibold mb-2">Songs you like will appear here</h3>
            <p className="text-white/50 text-sm">Save songs by tapping the heart icon</p>
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
