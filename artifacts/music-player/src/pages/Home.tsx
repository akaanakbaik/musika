import React, { useState, useEffect } from "react";
import { usePlayer } from "@/lib/PlayerContext";
import { SongCard } from "@/components/SongCard";
import { getRecommendations, type Song } from "@/lib/musicApi";
import { useAuth } from "@/lib/AuthContext";
import { RefreshCw, Music, TrendingUp, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { HeartFilledIcon, ClockIcon, LibraryIcon, AIBotIcon } from "@/components/SourceIcon";

const LOGO = "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const quickActions = [
  { label: "Liked Songs", Icon: HeartFilledIcon, href: "/favorites", color: "from-purple-600 to-purple-900" },
  { label: "History", Icon: ClockIcon, href: "/history", color: "from-blue-600 to-blue-900" },
  { label: "My Playlists", Icon: LibraryIcon, href: "/playlists", color: "from-orange-600 to-orange-900" },
  { label: "Musika AI", Icon: AIBotIcon, href: "/ai", color: "from-emerald-600 to-emerald-900" },
];

export default function Home() {
  const { playSong } = usePlayer();
  const { user, profile } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const results = await getRecommendations();
      setSongs(results);
      setQuery(results.length ? "Trending recommendations" : "");
    } catch {
      setSongs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const displayName = profile?.username || user?.email?.split("@")[0] || "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#121212] px-4 md:px-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between py-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <img src={LOGO} alt="musika" className="h-7 object-contain md:hidden" />
          </div>
          <h1 className="text-white text-2xl md:text-3xl font-bold flex items-center gap-2">
            {user ? `${getGreeting()}, ${displayName}` : "Welcome to Musika"}
          </h1>
          <p className="text-white/50 text-sm mt-1">Discover new music every day</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden md:inline">Refresh</span>
        </button>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {quickActions.map(({ label, Icon, href, color }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 bg-gradient-to-r ${color} rounded-lg p-3 md:p-4 cursor-pointer hover:brightness-110 transition-all`}
          >
            <Icon className="w-6 h-6 text-white flex-shrink-0" />
            <span className="text-white font-semibold text-sm md:text-base">{label}</span>
          </Link>
        ))}
      </div>

      {/* Recommendations */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#1DB954]" />
            <h2 className="text-white text-xl font-bold">Recommended for You</h2>
          </div>
          {query && <span className="text-white/40 text-xs">"{query}"</span>}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-white/5 rounded-lg aspect-[3/4] animate-pulse" />
            ))}
          </div>
        ) : songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Music className="w-16 h-16 text-white/20 mb-4" />
            <p className="text-white/50 text-lg font-medium">No recommendations right now</p>
            <p className="text-white/30 text-sm mt-1">Check your internet connection and try again</p>
            <button onClick={() => load()} className="mt-4 bg-[#1DB954] text-black font-bold px-6 py-2 rounded-full hover:bg-[#1ed760] transition-colors text-sm">
              Try Again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {songs.map((song) => (
              <SongCard key={song.videoId} song={song} queue={songs} />
            ))}
          </div>
        )}
      </div>

      {/* Not logged in CTA */}
      {!user && (
        <div className="bg-gradient-to-r from-[#1DB954]/20 to-purple-600/20 border border-[#1DB954]/30 rounded-2xl p-6 mt-8">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="w-6 h-6 text-[#1DB954]" />
            <h3 className="text-white font-bold text-lg">Get the full experience</h3>
          </div>
          <p className="text-white/60 text-sm mb-4">Sign in to save your favorites, create playlists, and get personalized recommendations.</p>
          <Link href="/auth" className="inline-flex items-center gap-2 bg-[#1DB954] text-black font-bold px-6 py-2 rounded-full hover:bg-[#1ed760] transition-colors text-sm">
            Sign In Free
          </Link>
        </div>
      )}
    </div>
  );
}
