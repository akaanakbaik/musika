import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { SongCard } from "@/components/SongCard";
import { searchMusic, type Song, type Source, sourceLabels } from "@/lib/musicApi";
import { Search, Loader2, Music, X } from "lucide-react";
import { YouTubeIcon, SpotifyIcon, AppleMusicIcon, SoundCloudIcon, GlobeIcon } from "@/components/SourceIcon";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { t } from "@/lib/i18n";

const SOURCE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  all: GlobeIcon, spotify: SpotifyIcon, youtube: YouTubeIcon, apple: AppleMusicIcon, soundcloud: SoundCloudIcon,
};

const SOURCE_ORDER = ["spotify", "youtube", "apple", "soundcloud"];

const SEARCH_HISTORY_KEY = "musika-search-history";

function saveSearchHistory(q: string) {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    const history: string[] = raw ? JSON.parse(raw) : [];
    const filtered = history.filter(h => h !== q);
    filtered.unshift(q);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered.slice(0, 20)));
  } catch {}
}

export default function SearchResults() {
  const [location] = useLocation();
  const { theme, accentColor, lang } = useAppSettings();
  const params = new URLSearchParams(location.split("?")[1] || "");
  const initialQ = params.get("q") || "";

  const [query, setQuery] = useState(initialQ);
  const [activeSource, setActiveSource] = useState<Source>("all");
  const [results, setResults] = useState<Record<string, Song[]>>({});
  const [loading, setLoading] = useState(false);
  const [inputVal, setInputVal] = useState(initialQ);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#121212]" : "bg-[#F5F5F5]";
  const textP = isDark ? "text-white" : "text-[#121212]";
  const textS = isDark ? "text-white/50" : "text-[#121212]/50";
  const inputBg = isDark ? "bg-[#282828] text-white placeholder:text-white/30" : "bg-white text-[#121212] placeholder:text-black/30 border border-black/10";
  const tabActive = isDark ? "bg-white text-black" : "text-black";
  const tabInactive = isDark ? "bg-[#282828] text-white/60 hover:bg-[#383838] hover:text-white" : "bg-white/80 text-[#121212]/60 hover:bg-white hover:text-[#121212] border border-black/10";
  const stickyBg = isDark ? "bg-[#121212]/95 border-white/5" : "bg-[#F5F5F5]/95 border-black/5";

  const sources: { key: Source; label: string }[] = [
    { key: "all", label: lang === "en" ? "All" : "Semua" },
    { key: "spotify", label: "Spotify" },
    { key: "youtube", label: "YouTube" },
    { key: "apple", label: "Apple Music" },
    { key: "soundcloud", label: "SoundCloud" },
  ];

  const doSearch = useCallback(async (q: string, src: Source) => {
    if (!q.trim()) return;
    setLoading(true);
    setResults({});
    saveSearchHistory(q.trim());
    try {
      const data = await searchMusic(q.trim(), src);
      setResults(data as Record<string, Song[]>);
    } catch { setResults({}); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (initialQ) doSearch(initialQ, activeSource); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(inputVal);
    doSearch(inputVal, activeSource);
    inputRef.current?.blur();
  };

  const handleSourceChange = (src: Source) => {
    setActiveSource(src);
    if (query) doSearch(query, src);
  };

  const clearInput = () => { setInputVal(""); inputRef.current?.focus(); };

  const allSongs = Object.values(results).flat();
  const orderedEntries = SOURCE_ORDER.map(src => [src, results[src] || []] as [string, Song[]]).filter(([, songs]) => songs.length > 0);

  return (
    <div className={`min-h-screen ${bg} px-4 md:px-8 pb-32 md:pb-8`}>
      <div className={`sticky top-0 ${stickyBg} backdrop-blur-xl pt-3 pb-3 z-10 border-b mb-2`}>
        <form onSubmit={handleSearch} className="relative mb-3">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${textS} pointer-events-none`} />
          <input
            ref={inputRef}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder={t(lang, "search_placeholder")}
            className={`w-full ${inputBg} rounded-full pl-11 pr-24 py-3 text-sm outline-none transition-all`}
          />
          {inputVal && (
            <button type="button" onClick={clearInput} className={`absolute right-20 top-1/2 -translate-y-1/2 ${textS} hover:opacity-100 transition-opacity`}>
              <X className="w-4 h-4" />
            </button>
          )}
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 font-bold px-4 py-1.5 rounded-full text-sm active:scale-95 transition-all text-black" style={{ background: accentColor }}>
            {lang === "en" ? "Search" : "Cari"}
          </button>
        </form>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {sources.map(({ key, label }) => {
            const IconComp = SOURCE_ICON_MAP[key];
            const active = activeSource === key;
            return (
              <button key={key} onClick={() => handleSourceChange(key)} className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 active:scale-95 ${active ? tabActive : tabInactive}`} style={active ? { background: accentColor } : {}}>
                <IconComp className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!query ? (
        <div className="flex flex-col items-center justify-center py-28 text-center px-6">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 ${isDark ? "bg-white/5" : "bg-black/5"}`}>
            <Search className={`w-9 h-9 ${textS}`} />
          </div>
          <h2 className={`text-xl font-bold mb-2 ${textP}`}>{lang === "en" ? "Find your music" : "Temukan musikmu"}</h2>
          <p className={`text-sm leading-relaxed ${textS}`}>{lang === "en" ? "Search across Spotify, YouTube, Apple Music & SoundCloud" : "Cari di Spotify, YouTube, Apple Music & SoundCloud"}</p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-28">
          <Loader2 className="w-10 h-10 animate-spin mb-5" style={{ color: accentColor }} />
          <p className={`font-semibold mb-1 ${textP}`}>{lang === "en" ? "Searching…" : "Mencari…"}</p>
          <p className={`text-sm ${textS}`}>{lang === "en" ? "Scanning all music sources" : "Memindai semua sumber musik"}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-8">
          {activeSource === "all" ? (
            orderedEntries.length === 0 ? (
              <div className="text-center py-20">
                <Music className={`w-14 h-14 mx-auto mb-4 ${textS}`} />
                <p className={`font-semibold mb-1 ${textP}`}>{t(lang, "no_results")}</p>
                <p className={`text-sm ${textS}`}>{lang === "en" ? "Try a different keyword or source" : "Coba kata kunci atau sumber lain"}</p>
              </div>
            ) : (
              orderedEntries.map(([src, songs]) => {
                const srcInfo = sourceLabels[src] || { label: src };
                const IconComp = SOURCE_ICON_MAP[src] || GlobeIcon;
                return (
                  <div key={src}>
                    <div className="flex items-center gap-2 mb-3">
                      <IconComp className="w-5 h-5" style={{ color: sourceLabels[src]?.color || "#fff" }} />
                      <h3 className={`text-base font-bold ${textP}`}>{srcInfo.label}</h3>
                      <span className={`text-xs ml-1 ${textS}`}>{songs.length} {lang === "en" ? "results" : "hasil"}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {songs.map(song => <SongCard key={`${src}-${song.videoId}`} song={song} queue={songs} />)}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-sm ${textS}`}>{allSongs.length} {lang === "en" ? "results for" : "hasil untuk"}</span>
                <span className={`text-sm font-semibold ${textP}`}>"{query}"</span>
              </div>
              {allSongs.length > 0 ? (
                <div className="space-y-1">
                  {allSongs.map((song, i) => <SongCard key={`${song.videoId}-${i}`} song={song} queue={allSongs} variant="list" index={i} />)}
                </div>
              ) : (
                <div className="text-center py-20">
                  <Music className={`w-12 h-12 mx-auto mb-3 ${textS}`} />
                  <p className={textS}>{lang === "en" ? `No results for "${query}"` : `Tidak ada hasil untuk "${query}"`}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
