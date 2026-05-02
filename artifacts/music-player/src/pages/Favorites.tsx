import React, { useState, useEffect } from "react";
import { Heart, Music, Lock, RefreshCw, Search } from "lucide-react";
import { SongCard } from "@/components/SongCard";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Song } from "@/lib/musicApi";
import { Link } from "wouter";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { t } from "@/lib/i18n";

export default function Favorites() {
  const { user } = useAuth();
  const { theme, accentColor, lang } = useAppSettings();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#121212]" : "bg-[#F5F5F5]";
  const textP = isDark ? "text-white" : "text-[#121212]";
  const textS = isDark ? "text-white/50" : "text-[#121212]/50";

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
      artist: f.artist || "",
      thumbnail: f.thumbnail,
      duration: f.duration,
      source: f.source,
      url: f.url
    })));
    setLoading(false);
  }

  if (!user) {
    return (
      <div className={`min-h-screen ${bg} flex flex-col items-center justify-center text-center px-6`}>
        {/* Decorative glass card */}
        <div className={`mb-8 w-28 h-28 rounded-3xl flex items-center justify-center shadow-2xl ${isDark ? "glass-surface" : "glass-light"}`}
          style={{ boxShadow: `0 8px 40px ${accentColor}33` }}>
          <Heart className="w-14 h-14" style={{ color: accentColor }} />
        </div>
        <h2 className={`text-2xl font-bold mb-2 ${textP}`}>
          {lang === "en" ? "Your Liked Songs" : "Lagu Disukai"}
        </h2>
        <p className={`text-sm mb-2 ${textS}`}>
          {lang === "en" ? "Sign in to see and save your favorite songs" : "Masuk untuk melihat dan menyimpan lagu favorit"}
        </p>
        <p className={`text-xs mb-6 ${textS}`}>
          {lang === "en" ? "Tap ♡ on any song to save it here" : "Ketuk ♡ pada lagu mana saja untuk menyimpannya di sini"}
        </p>
        <Link
          href="/auth"
          className="font-bold px-8 py-3 rounded-full text-black transition-all active:scale-95 shadow-lg"
          style={{ background: accentColor }}
        >
          {t(lang, "sign_in")}
        </Link>
        <Link
          href="/search"
          className={`mt-3 flex items-center gap-2 font-medium px-6 py-2.5 rounded-full text-sm transition-all active:scale-95 ${isDark ? "glass-btn text-white" : "glass-btn-light text-[#121212]"}`}
        >
          <Search className="w-3.5 h-3.5" />
          {lang === "en" ? "Browse Music" : "Jelajahi Musik"}
        </Link>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bg} pb-24 md:pb-8`}>
      {/* Header gradient */}
      <div className="bg-gradient-to-b from-purple-900/60 to-transparent px-6 pt-8 pb-6">
        <div className="flex items-end gap-4 md:gap-6">
          <div
            className="w-28 h-28 md:w-40 md:h-40 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-2xl glass-surface"
            style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", boxShadow: "0 8px 40px rgba(124,58,237,0.4)" }}
          >
            <Heart className="w-14 h-14 md:w-20 md:h-20 text-white fill-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs uppercase font-semibold tracking-wider mb-1 ${textS}`}>Playlist</p>
            <h1 className={`text-3xl md:text-5xl font-black mb-1 ${textP}`}>{t(lang, "favorites")}</h1>
            <p className={`text-sm ${textS}`}>{songs.length} {lang === "en" ? "songs" : "lagu"}</p>
          </div>
          <button
            onClick={loadFavorites}
            className={`p-2.5 rounded-full transition-all active:scale-90 ${isDark ? "glass-btn" : "glass-btn-light"} flex-shrink-0`}
          >
            <RefreshCw className={`w-4 h-4 ${textS}`} />
          </button>
        </div>
      </div>

      <div className="px-4 md:px-6">
        {loading ? (
          <div className="space-y-2 mt-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? "skeleton" : "skeleton-light"}`} style={{ height: 64 }} />
            ))}
          </div>
        ) : songs.length === 0 ? (
          <div className={`mt-6 rounded-2xl p-8 text-center ${isDark ? "glass-surface" : "glass-light"}`}>
            <Heart className={`w-12 h-12 mx-auto mb-3 ${textS}`} />
            <h3 className={`text-xl font-semibold mb-2 ${textP}`}>
              {lang === "en" ? "No liked songs yet" : "Belum ada lagu disukai"}
            </h3>
            <p className={`text-sm mb-4 ${textS}`}>
              {lang === "en" ? "Tap the ♡ icon on any song to save it here" : "Ketuk ikon ♡ pada lagu untuk menyimpannya di sini"}
            </p>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 font-bold px-6 py-2.5 rounded-full text-sm text-black transition-all active:scale-95"
              style={{ background: accentColor }}
            >
              <Search className="w-4 h-4" />
              {lang === "en" ? "Find Music" : "Cari Musik"}
            </Link>
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
