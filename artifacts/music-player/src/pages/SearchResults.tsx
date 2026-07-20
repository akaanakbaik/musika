import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { SongCard } from "@/components/SongCard";
import { searchSource, type Song, type Source, sourceLabels } from "@/lib/musicApi";
import { Search, Music, X, CheckCircle2, Loader2, Users, UserCircle2, Copy, CheckCheck, Calendar } from "lucide-react";
import { YouTubeIcon, SpotifyIcon, AppleMusicIcon, SoundCloudIcon, GlobeIcon } from "@/components/SourceIcon";
import { useAppSettings } from "@/lib/AppSettingsContext";
import { t } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import UserProfileModal from "@/components/UserProfileModal";

const SOURCE_ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
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
type TabMode = Source | "users";

interface SearchState {
  results: Record<string, Song[]>;
  statuses: Record<string, SourceStatus>;
  completedCount: number;
  totalSources: number;
}

interface UserResult {
  id: string;
  username: string;
  bio: string;
  avatar_url: string;
  created_at: string;
  musika_id?: string;
}

const SOURCE_ORDER = ["spotify", "youtube", "apple", "soundcloud"];

export default function SearchResults() {
  const [location] = useLocation();
  const { theme, accentColor, lang } = useAppSettings();
  const params = new URLSearchParams(location.split("?")[1] || "");
  const initialQ = params.get("q") || "";
  const initialTab = params.get("tab") as TabMode | null;

  const [query, setQuery] = useState(initialQ);
  const [activeTab, setActiveTab] = useState<TabMode>(initialTab || "all");
  const [inputVal, setInputVal] = useState(initialQ);
  const [searchState, setSearchState] = useState<SearchState>({
    results: {}, statuses: {}, completedCount: 0, totalSources: 0
  });
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<boolean>(false);

  const isDark = theme === "dark";
  const bg = isDark ? "bg-[#121212]" : "bg-[#F5F5F5]";
  const textP = isDark ? "text-white" : "text-[#121212]";
  const textS = isDark ? "text-white/50" : "text-[#121212]/50";
  const inputBg = isDark ? "glass-input text-white placeholder:text-white/35" : "glass-input-light text-[#121212] placeholder:text-black/30";
  const tabInactive = isDark ? "glass-btn text-white/60 hover:text-white" : "glass-btn-light text-[#121212]/60 hover:text-[#121212]";
  const stickyBg = isDark ? "bg-[#121212]/80 border-white/5 backdrop-blur-xl" : "bg-[#F5F5F5]/80 border-black/5 backdrop-blur-xl";
  const card = isDark ? "bg-[#1a1a1a] border-white/8" : "bg-white border-black/8";

  const looksLikeId = (q: string) => /^#?[A-Z2-9]{7}$/i.test(q.replace(/^#/, "").trim());

  const musicSources: { key: TabMode; label: string }[] = [
    { key: "all", label: lang === "en" ? "All" : "Semua" },
    { key: "spotify", label: "Spotify" },
    { key: "youtube", label: "YouTube" },
    { key: "apple", label: "Apple Music" },
    { key: "soundcloud", label: "SoundCloud" },
    { key: "users", label: lang === "en" ? "Users" : "Pengguna" },
  ];

  const selectedSources = activeTab === "all" ? SOURCES_ALL : activeTab !== "users" ? [activeTab as typeof SOURCES_ALL[number]] : [];
  const isLoading = Object.values(searchState.statuses).some(s => s === "loading");
  const hasAnyResults = Object.values(searchState.results).some(arr => arr.length > 0);
  const progressPct = searchState.totalSources > 0
    ? Math.round((searchState.completedCount / searchState.totalSources) * 100) : 0;

  const doSearch = useCallback(async (q: string, tab: TabMode) => {
    if (!q.trim()) return;
    if (tab === "users") { doUserSearch(q); return; }

    // Always search users in parallel when searching music (show above results)
    doUserSearch(q);

    abortRef.current = true;
    await new Promise(r => setTimeout(r, 10));
    abortRef.current = false;

    const sources = tab === "all" ? [...SOURCES_ALL] : [tab as typeof SOURCES_ALL[number]];
    saveSearchHistory(q.trim());

    setSearchState({
      results: {},
      statuses: Object.fromEntries(sources.map(s => [s, "loading"])),
      completedCount: 0, totalSources: sources.length
    });

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

  async function doUserSearch(q: string) {
    setUserLoading(true);
    setUserResults([]);
    const clean = q.replace(/^#/, "").trim();
    try {
      let data: UserResult[] = [];
      if (looksLikeId(clean)) {
        const { data: byId } = await supabase
          .from("user_profiles")
          .select("id, username, bio, avatar_url, created_at, musika_id")
          .ilike("musika_id", clean.toUpperCase())
          .limit(5);
        if (byId?.length) data = byId as UserResult[];
      }
      if (data.length < 20) {
        const { data: byName } = await supabase
          .from("user_profiles")
          .select("id, username, bio, avatar_url, created_at, musika_id")
          .ilike("username", `%${clean}%`)
          .order("created_at", { ascending: true }) // FYP: older members first
          .limit(20);
        if (byName) {
          const existingIds = new Set(data.map(u => u.id));
          data = [...data, ...(byName as UserResult[]).filter(u => !existingIds.has(u.id))];
        }
      }
      // Sort: exact match first, then by join date ascending (FYP)
      data.sort((a, b) => {
        const aExact = (a.username || "").toLowerCase() === clean.toLowerCase() ? -1 : 0;
        const bExact = (b.username || "").toLowerCase() === clean.toLowerCase() ? -1 : 0;
        if (aExact !== bExact) return aExact - bExact;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      setUserResults(data);
    } catch { setUserResults([]); }
    setUserLoading(false);
  }

  useEffect(() => {
    if (initialQ) {
      if (looksLikeId(initialQ) && !initialTab) {
        setActiveTab("users");
        doSearch(initialQ, "users");
      } else {
        doSearch(initialQ, (initialTab || "all") as TabMode);
      }
    }
    return () => { abortRef.current = true; };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    setQuery(inputVal);
    doSearch(inputVal, activeTab);
    inputRef.current?.blur();
  };

  const handleTabChange = (tab: TabMode) => {
    setActiveTab(tab);
    if (query) doSearch(query, tab);
  };

  const clearInput = () => { setInputVal(""); inputRef.current?.focus(); };

  function copyId(id: string) {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

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
              placeholder={activeTab === "users"
                ? (lang === "en" ? "Search users by name or #ID…" : "Cari pengguna dengan nama atau #ID…")
                : t(lang, "search_placeholder")}
              className={`w-full ${inputBg} rounded-full pl-11 pr-24 py-3 text-sm outline-none transition-all`}
            />
            {inputVal && (
              <button type="button" onClick={clearInput} className={`absolute right-20 top-1/2 -translate-y-1/2 ${textS}`}>
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

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {musicSources.map(({ key, label }) => {
              const active = activeTab === key;
              const IconComp = key === "users" ? Users : (SOURCE_ICON_MAP[key as string] || GlobeIcon);
              return (
                <button
                  key={key}
                  onClick={() => handleTabChange(key)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 active:scale-95 ${active ? "text-black" : tabInactive}`}
                  style={active ? { background: accentColor } : {}}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {isLoading && query && activeTab !== "users" && (
          <div className="px-4 md:px-8 mt-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: accentColor }} />
                <span className={`text-xs font-medium ${textS}`}>
                  {lang === "en" ? "Searching sources…" : "Mencari dari semua sumber…"}
                </span>
              </div>
              <span className="text-xs font-bold tabular-nums" style={{ color: accentColor }}>{progressPct}%</span>
            </div>
            <div className={`h-1 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-black/10"}`}>
              <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPct}%`, background: accentColor }} />
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {selectedSources.map(src => {
                const status = searchState.statuses[src];
                const count = searchState.results[src]?.length || 0;
                const srcLabel = sourceLabels[src]?.label || src;
                return (
                  <div key={src} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${isDark ? "bg-white/5" : "bg-black/5"}`}>
                    {status === "loading" ? <Loader2 className="w-2.5 h-2.5 animate-spin" style={{ color: sourceLabels[src]?.color }} />
                      : status === "done" ? <CheckCircle2 className="w-2.5 h-2.5" style={{ color: sourceLabels[src]?.color }} />
                      : status === "error" ? <span className="text-red-400 text-[10px]">✗</span>
                      : null}
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

      {/* Content */}
      <div className="px-4 md:px-8">
        {!query ? (
          <div className="flex flex-col items-center justify-center py-28 text-center px-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-5 ${isDark ? "bg-white/5" : "bg-black/5"}`}>
              {activeTab === "users" ? <Users className={`w-9 h-9 ${textS}`} /> : <Search className={`w-9 h-9 ${textS}`} />}
            </div>
            <h2 className={`text-xl font-bold mb-2 ${textP}`}>
              {activeTab === "users" ? (lang === "en" ? "Find users" : "Cari pengguna") : (lang === "en" ? "Find your music" : "Temukan musikmu")}
            </h2>
            <p className={`text-sm leading-relaxed ${textS}`}>
              {activeTab === "users"
                ? (lang === "en" ? "Search by username or Musika ID (#XXXXXXX)" : "Cari berdasarkan nama atau Musika ID (#XXXXXXX)")
                : (lang === "en" ? "Search across Spotify, YouTube, Apple Music & SoundCloud" : "Cari di Spotify, YouTube, Apple Music & SoundCloud")
              }
            </p>
          </div>
        ) : activeTab === "users" ? (
          <div className="mt-4">
            {userLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: accentColor }} />
                <p className={`text-sm ${textS}`}>{lang === "en" ? "Searching users…" : "Mencari pengguna…"}</p>
              </div>
            ) : userResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <UserCircle2 className={`w-14 h-14 ${textS}`} />
                <p className={`font-semibold ${textP}`}>{lang === "en" ? "No users found" : "Pengguna tidak ditemukan"}</p>
                <p className={`text-sm ${textS}`}>{lang === "en" ? "Try a different name or Musika ID" : "Coba nama atau Musika ID yang berbeda"}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className={`text-sm ${textS} mb-2`}>
                  {userResults.length} {lang === "en" ? "users found" : "pengguna ditemukan"}
                </p>
                {userResults.map(user => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border ${card} ${isDark ? "hover:bg-white/5" : "hover:bg-black/3"} transition-all active:scale-[0.98] text-left`}
                  >
                    <div className="flex-shrink-0">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} className="w-14 h-14 rounded-full object-cover border-2" style={{ borderColor: accentColor }} alt={user.username} />
                      ) : (
                        <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black text-black" style={{ background: accentColor }}>
                          {(user.username || "?")[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-base truncate ${textP}`}>{user.username || "Pengguna"}</p>
                      {user.musika_id && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] font-mono font-bold tracking-widest px-2 py-0.5 rounded" style={{ background: `${accentColor}18`, color: accentColor }}>
                            #{user.musika_id}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); copyId(user.musika_id!); }}
                            className={`p-0.5 ${textS}`}
                          >
                            {copiedId === user.musika_id
                              ? <CheckCheck className="w-3 h-3" style={{ color: accentColor }} />
                              : <Copy className="w-3 h-3" />
                            }
                          </button>
                        </div>
                      )}
                      {user.bio && <p className={`text-xs mt-1 line-clamp-1 ${textS} italic`}>"{user.bio}"</p>}
                      <div className="flex items-center gap-1 mt-1">
                        <Calendar className={`w-3 h-3 ${textS}`} />
                        <span className={`text-[10px] ${textS}`}>
                          {new Date(user.created_at).toLocaleDateString("id-ID", { year: "numeric", month: "long" })}
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${isDark ? "bg-white/8 text-white/50" : "bg-black/8 text-black/50"}`}>
                      Profil →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4">
            {activeTab === "all" ? (
              <div className="space-y-8">
                {/* User results shown ABOVE music when found */}
                {userResults.length > 0 && !userLoading && (
                  <div className="animate-in fade-in duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5" style={{ color: accentColor }} />
                        <h3 className={`text-base font-bold ${textP}`}>{lang === "en" ? "Users" : "Pengguna"}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? "bg-white/8" : "bg-black/8"} ${textS}`}>{userResults.length}</span>
                      </div>
                      {userResults.length > 5 && (
                        <button
                          onClick={() => { setActiveTab("users"); }}
                          className="text-xs font-semibold px-3 py-1 rounded-full transition-all active:scale-95"
                          style={{ background: `${accentColor}20`, color: accentColor }}
                        >
                          {lang === "en" ? `All ${userResults.length} users →` : `Lihat ${userResults.length} pengguna →`}
                        </button>
                      )}
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {userResults.slice(0, 5).map(u => (
                        <button
                          key={u.id}
                          onClick={() => setSelectedUserId(u.id)}
                          className={`flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl border ${card} ${isDark ? "hover:bg-white/5" : "hover:bg-black/3"} transition-all active:scale-95 w-24`}
                        >
                          {u.avatar_url ? (
                            <img src={u.avatar_url} className="w-12 h-12 rounded-full object-cover border-2" style={{ borderColor: accentColor }} alt={u.username} />
                          ) : (
                            <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-black text-black" style={{ background: accentColor }}>
                              {(u.username || "?")[0].toUpperCase()}
                            </div>
                          )}
                          <div className="text-center w-full">
                            <p className={`text-xs font-semibold truncate ${textP}`}>{u.username || "User"}</p>
                            {u.musika_id && <p className="text-[9px] font-mono" style={{ color: accentColor }}>#{u.musika_id}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {orderedEntries.map(([src]) => {
                  const songs = searchState.results[src] || [];
                  const status = searchState.statuses[src];
                  const srcInfo = sourceLabels[src] || { label: src, color: "#888" };
                  const IconComp = SOURCE_ICON_MAP[src] || GlobeIcon;

                  if (status === "loading") return (
                    <div key={src} className="animate-pulse">
                      <div className="flex items-center gap-2 mb-3">
                        <IconComp className="w-5 h-5 opacity-40" />
                        <div className={`h-4 rounded w-24 ${isDark ? "bg-white/10" : "bg-black/10"}`} />
                        <Loader2 className="w-4 h-4 animate-spin ml-1" style={{ color: srcInfo.color, opacity: 0.7 }} />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {[1,2,3,4,5].map(i => (
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
                {!isLoading && !hasAnyResults && (
                  <div className="text-center py-20">
                    <Music className={`w-14 h-14 mx-auto mb-4 ${textS}`} />
                    <p className={`font-semibold mb-1 ${textP}`}>{t(lang, "no_results")}</p>
                    <p className={`text-sm ${textS}`}>{lang === "en" ? "Try a different keyword or source" : "Coba kata kunci atau sumber lain"}</p>
                  </div>
                )}
              </div>
            ) : (
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
                    {allSongs.map((song, i) => <SongCard key={`${song.videoId}-${i}`} song={song} queue={allSongs} variant="list" index={i} />)}
                  </div>
                ) : !isLoading ? (
                  <div className="text-center py-20">
                    <Music className={`w-12 h-12 mx-auto mb-3 ${textS}`} />
                    <p className={textS}>{lang === "en" ? `No results for "${query}"` : `Tidak ada hasil untuk "${query}"`}</p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedUserId && (
        <UserProfileModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
    </div>
  );
}
