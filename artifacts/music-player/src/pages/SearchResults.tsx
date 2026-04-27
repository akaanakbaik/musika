import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { SongCard } from "@/components/SongCard";
import { searchMusic, type Song, type Source, sourceLabels } from "@/lib/musicApi";
import { Search, Loader2, Music, X } from "lucide-react";
import { YouTubeIcon, SpotifyIcon, AppleMusicIcon, SoundCloudIcon, GlobeIcon } from "@/components/SourceIcon";

const SOURCE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  all: GlobeIcon,
  spotify: SpotifyIcon,
  youtube: YouTubeIcon,
  apple: AppleMusicIcon,
  soundcloud: SoundCloudIcon,
};

const sources: { key: Source; label: string }[] = [
  { key: "all", label: "All" },
  { key: "spotify", label: "Spotify" },
  { key: "youtube", label: "YouTube" },
  { key: "apple", label: "Apple Music" },
  { key: "soundcloud", label: "SoundCloud" },
];

const SOURCE_ORDER = ["spotify", "youtube", "apple", "soundcloud"];

export default function SearchResults() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] || "");
  const initialQ = params.get("q") || "";

  const [query, setQuery] = useState(initialQ);
  const [activeSource, setActiveSource] = useState<Source>("all");
  const [results, setResults] = useState<Record<string, Song[]>>({});
  const [loading, setLoading] = useState(false);
  const [inputVal, setInputVal] = useState(initialQ);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (q: string, src: Source) => {
    if (!q.trim()) return;
    setLoading(true);
    setResults({});
    try {
      const data = await searchMusic(q.trim(), src);
      setResults(data as Record<string, Song[]>);
    } catch {
      setResults({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQ) doSearch(initialQ, activeSource);
  }, []);

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

  const clearInput = () => {
    setInputVal("");
    inputRef.current?.focus();
  };

  const allSongs = Object.values(results).flat();

  const orderedEntries = SOURCE_ORDER
    .map(src => [src, results[src] || []] as [string, Song[]])
    .filter(([, songs]) => songs.length > 0);

  return (
    <div className="min-h-screen bg-[#121212] px-4 md:px-8 pb-32 md:pb-8">
      {/* Sticky search header */}
      <div className="sticky top-0 bg-[#121212]/95 backdrop-blur-xl pt-4 pb-3 z-10 border-b border-white/5 mb-2">
        <form onSubmit={handleSearch} className="relative mb-3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
          <input
            ref={inputRef}
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder="Songs, artists, albums..."
            className="w-full bg-[#282828] border border-transparent rounded-full pl-11 pr-24 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#1DB954]/50 focus:bg-[#303030] transition-all"
          />
          {inputVal && (
            <button
              type="button"
              onClick={clearInput}
              className="absolute right-20 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#1DB954] text-black font-bold px-4 py-1.5 rounded-full text-sm hover:bg-[#1ed760] active:scale-95 transition-all"
          >
            Search
          </button>
        </form>

        {/* Source filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {sources.map(({ key, label }) => {
            const IconComp = SOURCE_ICON_MAP[key];
            const active = activeSource === key;
            return (
              <button
                key={key}
                onClick={() => handleSourceChange(key)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 active:scale-95 ${
                  active
                    ? "bg-white text-black shadow-lg"
                    : "bg-[#282828] text-white/60 hover:bg-[#383838] hover:text-white"
                }`}
              >
                <IconComp className={`w-3.5 h-3.5 ${active ? "text-black" : ""}`} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {!query ? (
        <div className="flex flex-col items-center justify-center py-28 text-center px-6">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-5">
            <Search className="w-9 h-9 text-white/20" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Find your music</h2>
          <p className="text-white/40 text-sm leading-relaxed">Search across Spotify, YouTube,<br />Apple Music & SoundCloud</p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-28">
          <div className="relative mb-5">
            <Loader2 className="w-10 h-10 text-[#1DB954] animate-spin" />
          </div>
          <p className="text-white font-semibold mb-1">Searching...</p>
          <p className="text-white/40 text-sm">Scanning all music sources</p>
        </div>
      ) : (
        <div className="mt-4 space-y-8">
          {activeSource === "all" ? (
            orderedEntries.length === 0 ? (
              <div className="text-center py-20">
                <Music className="w-14 h-14 text-white/20 mx-auto mb-4" />
                <p className="text-white font-semibold mb-1">No results found</p>
                <p className="text-white/40 text-sm">Try a different keyword or source</p>
              </div>
            ) : (
              orderedEntries.map(([src, songs]) => {
                const srcInfo = sourceLabels[src] || { label: src };
                const IconComp = SOURCE_ICON_MAP[src] || GlobeIcon;
                return (
                  <div key={src}>
                    <div className="flex items-center gap-2 mb-3">
                      <IconComp className="w-5 h-5" style={{ color: sourceLabels[src]?.color || "#fff" }} />
                      <h3 className="text-white text-base font-bold">{srcInfo.label}</h3>
                      <span className="text-white/30 text-xs ml-1">{songs.length} results</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {songs.map(song => (
                        <SongCard key={`${src}-${song.videoId}`} song={song} queue={songs} />
                      ))}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-white/50 text-sm">{allSongs.length} results for</span>
                <span className="text-white text-sm font-semibold">"{query}"</span>
              </div>
              {allSongs.length > 0 ? (
                <div className="space-y-1">
                  {allSongs.map((song, i) => (
                    <SongCard key={`${song.videoId}-${i}`} song={song} queue={allSongs} variant="list" index={i} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <Music className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <p className="text-white/50">No results found for "{query}"</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
