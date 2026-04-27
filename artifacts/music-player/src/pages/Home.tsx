import React, { useState, useEffect } from "react";
import { usePlayer } from "@/lib/PlayerContext";
import { SongCard } from "@/components/SongCard";
import { getRecommendations, type Song } from "@/lib/musicApi";
import { useAuth } from "@/lib/AuthContext";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { t } from "@/lib/i18n";
import { RefreshCw, Music, TrendingUp, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { HeartFilledIcon, ClockIcon, LibraryIcon, AIBotIcon } from "@/components/SourceIcon";

function getGreeting(lang: string) {
  const h = new Date().getHours();
  if (lang === "id") {
    if (h < 12) return "Selamat pagi";
    if (h < 18) return "Selamat siang";
    return "Selamat malam";
  }
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const { user, profile } = useAuth();
  const { theme, accentColor, lang } = useAppSettings();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isDark = theme === "dark";
  const bg = isDark ? "bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#121212]" : "bg-gradient-to-b from-green-50 via-white to-[#F5F5F5]";
  const textP = isDark ? "text-white" : "text-[#121212]";
  const textS = isDark ? "text-white/50" : "text-[#121212]/50";

  const quickActions = [
    { label: t(lang, "favorites"), Icon: HeartFilledIcon, href: "/favorites", color: "from-purple-600 to-purple-900" },
    { label: t(lang, "history"), Icon: ClockIcon, href: "/history", color: "from-blue-600 to-blue-900" },
    { label: t(lang, "playlists"), Icon: LibraryIcon, href: "/playlists", color: "from-orange-600 to-orange-900" },
    { label: "Musika AI", Icon: AIBotIcon, href: "/ai", color: "from-emerald-600 to-emerald-900" },
  ];

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const results = await getRecommendations();
      setSongs(results);
    } catch { setSongs([]); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const displayName = profile?.username || user?.email?.split("@")[0] || "";

  return (
    <div className={`min-h-screen ${bg} px-4 md:px-8 pb-24 md:pb-8`}>
      <div className="flex items-center justify-between pt-4 pb-6">
        <div>
          <h1 className={`text-xl md:text-3xl font-bold ${textP}`}>
            {user ? `${getGreeting(lang)}, ${displayName}` : t(lang, "welcome")}
          </h1>
          <p className={`text-sm mt-0.5 ${textS}`}>{t(lang, "discover")}</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-full text-sm transition-colors disabled:opacity-50 ${isDark ? "bg-white/10 hover:bg-white/20 text-white" : "bg-black/10 hover:bg-black/20 text-[#121212]"}`}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden md:inline">{t(lang, "refresh")}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-8">
        {quickActions.map(({ label, Icon, href, color }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 bg-gradient-to-r ${color} rounded-xl p-3 md:p-4 cursor-pointer hover:brightness-110 transition-all active:scale-95`}
          >
            <Icon className="w-5 h-5 md:w-6 md:h-6 text-white flex-shrink-0" />
            <span className="text-white font-semibold text-sm md:text-base truncate">{label}</span>
          </Link>
        ))}
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5" style={{ color: accentColor }} />
          <h2 className={`text-lg md:text-xl font-bold ${textP}`}>{t(lang, "recommended")}</h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className={`rounded-xl aspect-[3/4] animate-pulse ${isDark ? "bg-white/5" : "bg-black/5"}`} />
            ))}
          </div>
        ) : songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Music className={`w-16 h-16 mb-4 ${textS}`} />
            <p className={`text-lg font-medium ${textS}`}>{lang === "en" ? "No recommendations right now" : "Belum ada rekomendasi"}</p>
            <p className={`text-sm mt-1 ${textS}`}>{lang === "en" ? "Check your internet and try again" : "Periksa internet dan coba lagi"}</p>
            <button onClick={() => load()} className="mt-4 font-bold px-6 py-2 rounded-full text-sm text-black" style={{ background: accentColor }}>
              {t(lang, "retry")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {songs.map(song => <SongCard key={song.videoId} song={song} queue={songs} />)}
          </div>
        )}
      </div>

      {!user && (
        <div className={`border rounded-2xl p-5 md:p-6 mt-8 ${isDark ? "bg-gradient-to-r from-[#1DB954]/10 to-purple-600/10 border-[#1DB954]/20" : "bg-gradient-to-r from-[#1DB954]/20 to-purple-600/20 border-[#1DB954]/30"}`}>
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="w-6 h-6" style={{ color: accentColor }} />
            <h3 className={`font-bold text-lg ${textP}`}>{t(lang, "get_full_exp")}</h3>
          </div>
          <p className={`text-sm mb-4 ${textS}`}>{t(lang, "sign_in_desc")}</p>
          <Link href="/auth" className="inline-flex items-center gap-2 font-bold px-6 py-2 rounded-full text-sm text-black" style={{ background: accentColor }}>
            {t(lang, "sign_in_free")}
          </Link>
        </div>
      )}
    </div>
  );
}
