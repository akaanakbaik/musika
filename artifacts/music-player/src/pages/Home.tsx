import React, { useState, useEffect } from "react";
import { usePlayer } from "@/lib/PlayerContext";
import { SongCard } from "@/components/SongCard";
import { getRecommendations, type Song } from "@/lib/musicApi";
import { useAuth } from "@/lib/AuthContext";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { t } from "@/lib/i18n";
import { RefreshCw, Music, TrendingUp, Sparkles, WifiOff, Search } from "lucide-react";
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

const SUGGESTED_SEARCHES = [
  "pop indonesia 2024", "kpop hits 2025", "lo-fi chill",
  "dangdut viral", "billboard top 100", "acoustic covers",
];

export default function Home() {
  const { user, profile } = useAuth();
  const { theme, accentColor, lang } = useAppSettings();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const isDark = theme === "dark";
  const bg = isDark
    ? "bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#121212]"
    : "bg-gradient-to-b from-green-50 via-white to-[#F5F5F5]";
  const textP = isDark ? "text-white" : "text-[#121212]";
  const textS = isDark ? "text-white/50" : "text-[#121212]/50";

  const quickActions = [
    { label: t(lang, "favorites"), Icon: HeartFilledIcon, href: "/favorites", color: "from-purple-500 to-purple-800" },
    { label: t(lang, "history"), Icon: ClockIcon, href: "/history", color: "from-blue-500 to-blue-800" },
    { label: t(lang, "playlists"), Icon: LibraryIcon, href: "/playlists", color: "from-orange-500 to-orange-800" },
    { label: "Musika AI", Icon: AIBotIcon, href: "/ai", color: "from-emerald-500 to-emerald-800" },
  ];

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else { setLoading(true); setLoadingStep(lang === "en" ? "Connecting to server…" : "Menghubungkan ke server…"); }
    setError(false);
    try {
      setLoadingStep(lang === "en" ? "Loading recommendations…" : "Memuat rekomendasi…");
      const results = await getRecommendations();
      setSongs(results);
      setLoadingStep("");
    } catch {
      setSongs([]);
      setError(true);
      setLoadingStep("");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const displayName = profile?.username || user?.email?.split("@")[0] || "";

  return (
    <div className={`min-h-screen ${bg} px-4 md:px-8 pb-24 md:pb-8`}>
      {/* Header */}
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
          className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-full text-sm transition-all disabled:opacity-50 ${isDark ? "glass-btn text-white" : "glass-btn-light text-[#121212]"}`}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          <span className="hidden md:inline">{t(lang, "refresh")}</span>
        </button>
      </div>

      {/* Quick action cards with glass shine effect */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {quickActions.map(({ label, Icon, href, color }) => (
          <Link
            key={href}
            href={href}
            className={`glass-action flex items-center gap-3 bg-gradient-to-br ${color} rounded-2xl p-3 md:p-4 cursor-pointer hover:brightness-110 transition-all active:scale-95 shadow-lg`}
          >
            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl glass-btn flex items-center justify-center flex-shrink-0`}>
              <Icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <span className="text-white font-semibold text-sm md:text-base truncate">{label}</span>
          </Link>
        ))}
      </div>

      {/* Recommendations */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5" style={{ color: accentColor }} />
          <h2 className={`text-lg md:text-xl font-bold ${textP}`}>{t(lang, "recommended")}</h2>
        </div>

        {loading ? (
          <div>
            {loadingStep && (
              <div className={`flex items-center gap-2 mb-3 text-xs ${textS}`}>
                <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: accentColor }} />
                <span className="animate-pulse">{loadingStep}</span>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className={`rounded-2xl aspect-[3/4] ${isDark ? "skeleton" : "skeleton-light"}`} />
              ))}
            </div>
          </div>
        ) : error ? (
          /* ─── Error state ─────────────────────────────── */
          <div className={`rounded-2xl p-6 text-center ${isDark ? "glass-surface" : "glass-light"}`}>
            <WifiOff className={`w-12 h-12 mx-auto mb-3 ${textS}`} />
            <p className={`font-semibold mb-1 ${textP}`}>
              {lang === "en" ? "Couldn't load recommendations" : "Gagal memuat rekomendasi"}
            </p>
            <p className={`text-sm mb-4 ${textS}`}>
              {lang === "en" ? "Check your connection and try again" : "Periksa koneksi kamu dan coba lagi"}
            </p>
            <button
              onClick={() => load()}
              className="font-bold px-6 py-2.5 rounded-full text-sm text-black transition-all active:scale-95"
              style={{ background: accentColor }}
            >
              {t(lang, "retry")}
            </button>

            {/* Suggested searches */}
            <div className="mt-5">
              <p className={`text-xs mb-2 ${textS}`}>
                {lang === "en" ? "Or search for music" : "Atau cari musik"}
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTED_SEARCHES.slice(0, 4).map(q => (
                  <Link
                    key={q}
                    href={`/search?q=${encodeURIComponent(q)}`}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-all ${isDark ? "glass-btn text-white/80" : "glass-btn-light text-[#121212]/70"}`}
                  >
                    <Search className="w-3 h-3" />
                    {q}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : songs.length === 0 ? (
          /* ─── Empty state (API returned 0 results) ───── */
          <div className={`rounded-2xl p-6 text-center ${isDark ? "glass-surface" : "glass-light"}`}>
            <Music className={`w-12 h-12 mx-auto mb-3 ${textS}`} />
            <p className={`font-semibold mb-1 ${textP}`}>
              {lang === "en" ? "No recommendations right now" : "Belum ada rekomendasi"}
            </p>
            <p className={`text-sm mb-4 ${textS}`}>
              {lang === "en" ? "Tap refresh or search your favorite music" : "Ketuk refresh atau cari musik favorit kamu"}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => load()}
                className="font-bold px-5 py-2 rounded-full text-sm text-black transition-all active:scale-95"
                style={{ background: accentColor }}
              >
                {t(lang, "refresh")}
              </button>
              <Link
                href="/search"
                className={`font-semibold px-5 py-2 rounded-full text-sm transition-all active:scale-95 ${isDark ? "glass-btn text-white" : "glass-btn-light text-[#121212]"}`}
              >
                <span className="flex items-center gap-1.5"><Search className="w-3.5 h-3.5" /> {lang === "en" ? "Search" : "Cari"}</span>
              </Link>
            </div>

            {/* Trending searches */}
            <div className="mt-5">
              <p className={`text-xs mb-2 ${textS}`}>{lang === "en" ? "Try searching for" : "Coba cari"}</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTED_SEARCHES.map(q => (
                  <Link
                    key={q}
                    href={`/search?q=${encodeURIComponent(q)}`}
                    className={`text-xs px-3 py-1.5 rounded-full transition-all ${isDark ? "glass-btn text-white/70" : "glass-btn-light text-[#121212]/60"}`}
                  >
                    {q}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {songs.map(song => <SongCard key={song.videoId} song={song} queue={songs} />)}
          </div>
        )}
      </div>

      {/* Sign-in promo (only when not logged in + content loaded) */}
      {!user && !loading && (
        <div className={`rounded-2xl p-5 md:p-6 mt-8 ${isDark ? "glass-surface border border-white/10" : "glass-light border border-black/08"}`}>
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="w-6 h-6" style={{ color: accentColor }} />
            <h3 className={`font-bold text-lg ${textP}`}>{t(lang, "get_full_exp")}</h3>
          </div>
          <p className={`text-sm mb-4 ${textS}`}>{t(lang, "sign_in_desc")}</p>
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 font-bold px-6 py-2.5 rounded-full text-sm text-black transition-all active:scale-95"
            style={{ background: accentColor }}
          >
            {t(lang, "sign_in_free")}
          </Link>
        </div>
      )}
    </div>
  );
}
