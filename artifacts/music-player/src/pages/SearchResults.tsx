import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { SongCard } from "@/components/SongCard";
import { searchSource, type Song, type Source, sourceLabels } from "@/lib/musicApi";
import { Search, Music, X, CheckCircle2, Loader2 } from "lucide-react";
import { YouTubeIcon, SpotifyIcon, AppleMusicIcon, SoundCloudIcon, GlobeIcon } from "@/components/SourceIcon";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { t } from "@/lib/i18n";

const SOURCE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  all: GlobeIcon, spotify: SpotifyIcon, youtube: YouTubeIcon, apple: AppleMusicIcon, soundcloud: SoundCloudIcon,
};

const SOURCES_ALL = ["spotify", "youtube", "apple", "soundcloud"] as const;

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

type SourceStatus = "idle" | "loading" | "done" | "error";

interface SearchState {
  results: Record<string, Song[]>;
  statuses: Record<string, SourceStatus>;
  completedCount: number;
  totalSources: number;
}

const SOURCE_ORDER = ["spotify", "youtube", "apple", "soundcloud"];

export default function SearchResults() {
  const [location] = useLocation();
  const { theme, accentColor, lang } = useAppSettings();
  const params = new URLSearchParams(location.split("?")[1] || "");
  const initialQ = params.get("q") || "";

  const [query, setQuery] = useState(initialQ);
  const [activeSource, setActiveSource] = useState<Source>("all");
  const [inputVal, setInputVal] = useState(initialQ);
  const [searchState, setSearchState] = useState<SearchState>({
    results: {},
    statuses: {},
    completedCount: 0,
    totalSources: 0
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<boolean>(false);

  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#121212]" : "bg-[#F5F5F5]";
  const textP = isDark ? "text-white" : "text-[#121212]";
  const textS = isDark ? "text-white/50" : "text-[#121212]/50";
  const inputBg = isDark ? "bg-[#282828] text-white placeholder:text-white/30" : "bg-white text-[#121212] placeholder:text-black/30 border border-black/10";
  const tabActive = isDark ? "text-black" : "text-black";
  const tabInactive = isDark ? "bg-[#282828] text-white/60 hover:bg-[#383838] hover:text-white" : "bg-white/80 text-[#121212]/60 hover:bg-white hover:text-[#121212] border border-black/10";
  const stickyBg = isDark ? "bg-[#121212]/95 border-white/5" : "bg-[#F5F5F5]/95 border-black/5";
  const cardBg = isDark ? "bg-[#1a1a1a] border-white/8" : "bg-white border-black/8";

  const sources: { key: Source; label: string }[] = [
    { key: "all", label: lang === "en" ? "All" : "Semua" },
    { key: "spotify", label: "Spotify" },
    { key: "youtube", label: "YouTube" },
    { key: "apple", label: "Apple Music" },
    { key: "soundcloud", label: "SoundCloud" },
  ];

  const selectedSources = activeSource === "all" ? SOURCES_ALL : [activeSource as typeof SOURCES_ALL[number]];

  const isLoading = Object.values(searchState.statuses).some(s => s === "loading");
  const hasAnyResults = Object.values(searchState.results).some(arr => arr.length > 0);
  const progressPct = searchState.totalSources > 0
    ? Math.round((searchState.completedCount / searchState.totalSources) * 100)
    : 0;

  const doSearch = useCallback(async (q: string, src: Source) => {
    if (!q.trim()) return;
    abortRef.current = true;
    await new Promise(r => setTimeout(r, 10));
    abortRef.current = false;

    const sources = src === "all" ? [...SOURCES_ALL] : [src as typeof SOURCES_ALL[number]];

    saveSearchHistory(q.trim());

    setSearchState({
      results: {},
      statuses: Object.fromEntries(sources.map(s => [s, "loading"])),
      completedCount: 0,
      totalSources: sources.length
    });

    // Launch all searches in parallel, update state as each completes
    sources.forEach(async (source) => {
      try {
        const songs = await searchSource(q.trim(), source);
        if (abortRef.current) return;
        setSearchState(prev => ({
          ...prev,
          results: { ...prev.results, [source]: songs },
          statuses: { ...prev.statuses, [source]: "done" },
          completedCount: prev.completedCount + 1
        }));
      } catch {
        if (abortRef.current) return;
        setSearchState(prev => ({
          ...prev,
          results: { ...prev.results, [source]: [] },
          statuses: { ...prev.statuses, [source]: "error" },
          completedCount: prev.completedCount + 1
        }));
      }
    });
  }, []);

  useEffect(() => {
    if (initialQ) doSearch(initialQ, activeSource);
    return () => { abortRef.current = true; };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    setQuery(inputVal);
    doSearch(inputVal, activeSource);
    inputRef.current?.blur();
  };

  const handleSourceChange = (src: Source) => {
    setActiveSource(src);
    if (query) doSearch(query, src);
  };

  const clearInput = () => { setInputVal(""); inputRef.current?.focus(); };

  const orderedEntries = SOURCE_ORDER
    .filter(src => selectedSources.includes(src as any))
    .map(src => [src, searchState.results[src] || []] as [string, Song[]]);

  const allSongs = orderedEntries.flatMap(([, songs]) => songs);

  return (
    <div className={`min-h-screen ${bg} pb-32 md:pb-8`}>
      {/* Sticky header */}
      <div className={`sticky top-0 ${stickyBg} backdrop-blur-xl pt-3 pb-3 z-10 border-b mb-2`}>
        <div className="px-4 md:px-8">
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
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 font-bold px-4 py-1.5 rounded-full text-sm active:scale-95 transition-all text-black"
              style={{ background: accentColor }}
            >
              {lang === "en" ? "Search" : "Cari"}
            </button>
          </form>

          {/* Source tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {sources.map(({ key, label }) => {
              const IconComp = SOURCE_ICON_MAP[key];
              const active = activeSource === key;
              return (
                <button
                  key={key}
                  onClick={() => handleSourceChange(key)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 active:scale-95 ${active ? tabActive : tabInactive}`}
                  style={active ? { background: accentColor } : {}}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Real-time progress bar */}
        {isLoading && query && (
          <div className="px-4 md:px-8 mt-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: accentColor }} />
                <span className={`text-xs font-medium ${textS}`}>
                  {lang === "en" ? "Searching sources…" : "Mencari dari semua sumber…"}
                </span>
              </div>
              <span className="text-xs font-bold tabular-nums" style={{ color: accentColor }}>
                {progressPct}%
              </span>
            </div>

            {/* Main progress bar */}
            <div className={`h-1 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-black/10"}`}>
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%`, background: accentColor }}
              />
            </div>

            {/* Per-source status pills */}
            <div className="flex gap-2 mt-2 flex-wrap">
              {selectedSources.map(src => {
                const status = searchState.statuses[src];
                const count = searchState.results[src]?.length || 0;
                const srcLabel = sourceLabels[src]?.label || src;
                return (
                  <div key={src} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all duration-300 ${isDark ? "bg-white/5" : "bg-black/5"}`}>
                    {status === "loading" ? (
                      <Loader2 className="w-2.5 h-2.5 animate-spin" style={{ color: sourceLabels[src]?.color }} />
                    ) : status === "done" ? (
                      <CheckCircle2 className="w-2.5 h-2.5" style={{ color: sourceLabels[src]?.color }} />
                    ) : status === "error" ? (
                      <span className="text-red-400 text-[10px]">✗</span>
                    ) : null}
                    <span style={{ color: status === "done" ? sourceLabels[src]?.color : undefined }} className={status === "loading" ? textS : ""}>
                      {srcLabel}{status === "done" ? ` ${count}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="px-4 md:px-8">
        {!query ? (
          <div className="flex flex-col items-center justify-center py-28 text-center px-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 ${isDark ? "bg-white/5" : "bg-black/5"}`}>
              <Search className={`w-9 h-9 ${textS}`} />
            </div>
            <h2 className={`text-xl font-bold mb-2 ${textP}`}>{lang === "en" ? "Find your music" : "Temukan musikmu"}</h2>
            <p className={`text-sm leading-relaxed ${textS}`}>
              {lang === "en" ? "Search across Spotify, YouTube, Apple Music & SoundCloud" : "Cari di Spotify, YouTube, Apple Music & SoundCloud"}
            </p>
          </div>
        ) : (
          <div className="mt-4">
            {activeSource === "all" ? (
              /* All sources: group by source, show as they arrive */
              <div className="space-y-8">
                {orderedEntries.map(([src]) => {
                  const songs = searchState.results[src] || [];
                  const status = searchState.statuses[src];
                  const srcInfo = sourceLabels[src] || { label: src, color: "#888", bg: "" };
                  const IconComp = SOURCE_ICON_MAP[src] || GlobeIcon;

                  if (status === "loading") {
                    return (
                      <div key={src} className="animate-pulse">
                        <div className="flex items-center gap-2 mb-3">
                          <IconComp className="w-5 h-5 opacity-40" />
                          <div className={`h-4 rounded w-24 ${isDark ? "bg-white/10" : "bg-black/10"}`} />
                          <Loader2 className="w-4 h-4 animate-spin ml-1" style={{ color: srcInfo.color, opacity: 0.7 }} />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                          {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className={`rounded-xl overflow-hidden ${isDark ? "bg-white/5" : "bg-black/5"}`}>
                              <div className="aspect-square" />
                              <div className="p-3 space-y-2">
                                <div className={`h-3 rounded w-3/4 ${isDark ? "bg-white/10" : "bg-black/10"}`} />
                                <div className={`h-2.5 rounded w-1/2 ${isDark ? "bg-white/8" : "bg-black/8"}`} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  if (songs.length === 0) return null;

                  return (
                    <div key={src} className="animate-in fade-in duration-300">
                      <div className="flex items-center gap-2 mb-3">
                        <IconComp className="w-5 h-5" style={{ color: srcInfo.color }} />
                        <h3 className={`text-base font-bold ${textP}`}>{srcInfo.label}</h3>
                        <span className={`text-xs ml-1 px-2 py-0.5 rounded-full ${isDark ? "bg-white/8" : "bg-black/8"} ${textS}`}>
                          {songs.length} {lang === "en" ? "results" : "hasil"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {songs.map(song => <SongCard key={`${src}-${song.videoId}`} song={song} queue={songs} />)}
                      </div>
                    </div>
                  );
                })}

                {/* All done and no results */}
                {!isLoading && !hasAnyResults && (
                  <div className="text-center py-20">
                    <Music className={`w-14 h-14 mx-auto mb-4 ${textS}`} />
                    <p className={`font-semibold mb-1 ${textP}`}>{t(lang, "no_results")}</p>
                    <p className={`text-sm ${textS}`}>{lang === "en" ? "Try a different keyword or source" : "Coba kata kunci atau sumber lain"}</p>
                  </div>
                )}
              </div>
            ) : (
              /* Single source: list view */
              <div>
                <div className="flex items-center gap-2 mb-4">
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" style={{ color: accentColor }} />
                      <span className={`text-sm ${textS}`}>{lang === "en" ? "Searching…" : "Mencari…"}</span>
                    </div>
                  ) : (
                    <>
                      <span className={`text-sm ${textS}`}>{allSongs.length} {lang === "en" ? "results for" : "hasil untuk"}</span>
                      <span className={`text-sm font-semibold ${textP}`}>"{query}"</span>
                    </>
                  )}
                </div>

                {allSongs.length > 0 ? (
                  <div className="space-y-1">
                    {allSongs.map((song, i) => (
                      <SongCard key={`${song.videoId}-${i}`} song={song} queue={allSongs} variant="list" index={i} />
                    ))}
                  </div>
                ) : !isLoading ? (
                  <div className="text-center py-20">
                    <Music className={`w-12 h-12 mx-auto mb-3 ${textS}`} />
                    <p className={textS}>
                      {lang === "en" ? `No results for "${query}"` : `Tidak ada hasil untuk "${query}"`}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
