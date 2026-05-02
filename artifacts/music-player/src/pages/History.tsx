import React, { useState, useEffect } from "react";
import { Clock, Trash2, Lock, RefreshCw, Search } from "lucide-react";
import { SongCard } from "@/components/SongCard";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Song } from "@/lib/musicApi";
import { Link } from "wouter";
import { toast } from "@/hooks/use-toast";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { t } from "@/lib/i18n";

export default function History() {
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
      artist: h.artist || "",
      thumbnail: h.thumbnail,
      duration: h.duration,
      source: h.source,
      url: h.url
    })));
    setLoading(false);
  }

  async function clearHistory() {
    if (!user) return;
    if (!confirm(lang === "en" ? "Clear all play history?" : "Hapus semua riwayat putar?")) return;
    await supabase.from("play_history").delete().eq("user_id", user.id);
    setSongs([]);
    toast({ title: "✓ " + t(lang, "clear_history") });
  }

  if (!user) {
    return (
      <div className={`min-h-screen ${bg} flex flex-col items-center justify-center text-center px-6`}>
        {/* Decorative glass icon */}
        <div
          className={`mb-8 w-28 h-28 rounded-3xl flex items-center justify-center shadow-2xl ${isDark ? "glass-surface" : "glass-light"}`}
          style={{ boxShadow: `0 8px 40px ${accentColor}33` }}
        >
          <Clock className="w-14 h-14" style={{ color: accentColor }} />
        </div>
        <h2 className={`text-2xl font-bold mb-2 ${textP}`}>
          {lang === "en" ? "Your Play History" : "Riwayat Putar"}
        </h2>
        <p className={`text-sm mb-2 ${textS}`}>
          {lang === "en" ? "Sign in to track what you've been listening to" : "Masuk untuk melacak lagu yang kamu dengarkan"}
        </p>
        <p className={`text-xs mb-6 ${textS}`}>
          {lang === "en" ? "Every song you play will be saved here" : "Setiap lagu yang kamu putar akan tersimpan di sini"}
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
      <div className="bg-gradient-to-b from-blue-900/60 to-transparent px-6 pt-8 pb-6">
        <div className="flex items-end gap-4 md:gap-6">
          <div
            className="w-28 h-28 md:w-40 md:h-40 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-2xl glass-surface"
            style={{ background: "linear-gradient(135deg, #1d4ed8, #0891b2)", boxShadow: "0 8px 40px rgba(29,78,216,0.4)" }}
          >
            <Clock className="w-14 h-14 md:w-20 md:h-20 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs uppercase font-semibold tracking-wider mb-1 ${textS}`}>
              {lang === "en" ? "Recent" : "Terkini"}
            </p>
            <h1 className={`text-3xl md:text-5xl font-black mb-1 ${textP}`}>{t(lang, "history")}</h1>
            <p className={`text-sm ${textS}`}>{songs.length} {lang === "en" ? "plays" : "diputar"}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={loadHistory}
              className={`p-2.5 rounded-full transition-all active:scale-90 ${isDark ? "glass-btn" : "glass-btn-light"}`}
            >
              <RefreshCw className={`w-4 h-4 ${textS}`} />
            </button>
            {songs.length > 0 && (
              <button
                onClick={clearHistory}
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-all active:scale-90 ${isDark ? "glass-btn text-white/70" : "glass-btn-light text-black/70"}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
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
            <Clock className={`w-12 h-12 mx-auto mb-3 ${textS}`} />
            <h3 className={`text-xl font-semibold mb-2 ${textP}`}>
              {lang === "en" ? "No plays yet" : "Belum ada riwayat"}
            </h3>
            <p className={`text-sm mb-4 ${textS}`}>
              {lang === "en" ? "Songs you listen to will appear here" : "Lagu yang kamu putar akan muncul di sini"}
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
