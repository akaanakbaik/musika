import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { SongCard } from "@/components/SongCard";
import { searchMusic, type Song, type Source, sourceLabels, sourceIcons } from "@/lib/musicApi";
import { Search, Filter, Loader2, Music, Youtube } from "lucide-react";

const sources: { key: Source; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "🌐" },
  { key: "youtube", label: "YouTube", icon: "🎬" },
  { key: "spotify", label: "Spotify", icon: "🎵" },
  { key: "apple", label: "Apple Music", icon: "🍎" },
  { key: "soundcloud", label: "SoundCloud", icon: "☁️" },
];

export default function SearchResults() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] || "");
  const initialQ = params.get("q") || "";

  const [query, setQuery] = useState(initialQ);
  const [activeSource, setActiveSource] = useState<Source>("all");
  const [results, setResults] = useState<Record<string, Song[]>>({});
  const [loading, setLoading] = useState(false);
  const [inputVal, setInputVal] = useState(initialQ);

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
  };

  const handleSourceChange = (src: Source) => {
    setActiveSource(src);
    if (query) doSearch(query, src);
  };

  const allSongs = Object.values(results).flat();

  return (
    <div className="min-h-screen bg-[#121212] px-4 md:px-8 pb-24 md:pb-8">
      {/* Search bar */}
      <div className="sticky top-0 bg-[#121212]/90 backdrop-blur-md pt-4 pb-3 z-10">
        <form onSubmit={handleSearch} className="relative mb-3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder="Search songs, artists, albums…"
            className="w-full bg-white/10 border border-white/10 rounded-full pl-12 pr-32 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-[#1DB954] focus:bg-white/15 transition-all"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#1DB954] text-black font-bold px-4 py-1.5 rounded-full text-sm hover:bg-[#1ed760] transition-colors"
          >
            Search
          </button>
        </form>

        {/* Source filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {sources.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => handleSourceChange(key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeSource === key
                  ? "bg-white text-black"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {!query ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <Search className="w-16 h-16 text-white/20 mb-4" />
          <h2 className="text-white text-xl font-semibold">Search for music</h2>
          <p className="text-white/40 text-sm mt-2">Find songs from YouTube, Spotify, Apple Music & SoundCloud</p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="w-10 h-10 text-[#1DB954] animate-spin mb-4" />
          <p className="text-white/60">Searching across all sources…</p>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {activeSource === "all" ? (
            Object.entries(results).map(([src, songs]) => {
              if (!songs || songs.length === 0) return null;
              const srcInfo = sourceLabels[src] || { label: src };
              return (
                <div key={src}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">{sourceIcons[src]}</span>
                    <h3 className="text-white text-lg font-bold">{srcInfo.label}</h3>
                    <span className="text-white/40 text-sm">({songs.length} results)</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {songs.map(song => (
                      <SongCard key={`${src}-${song.videoId}`} song={song} queue={songs} />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-white/60 text-sm">{allSongs.length} results for "{query}"</span>
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
