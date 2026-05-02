const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export interface Song {
  videoId: string;
  title: string;
  thumbnail: string;
  duration: string;
  url: string;
  source: "youtube" | "spotify" | "apple" | "soundcloud";
  artist: string;
  album?: string;
  releaseDate?: string;
}

export type Source = "all" | "youtube" | "spotify" | "apple" | "soundcloud";

export interface SearchResults {
  youtube?: Song[];
  spotify?: Song[];
  apple?: Song[];
  soundcloud?: Song[];
}

export interface DownloadResult {
  download_url: string;
  title: string;
  thumbnail: string;
  artist: string;
  album?: string;
  source: string;
}

export interface PrepareResult {
  stream_url: string;
  cdn_url: string | null;
  title: string;
  thumbnail: string;
  artist: string;
  album?: string;
  source: string;
  via_cdn: boolean;
  cached?: boolean;
}

async function fetchWithTimeout(url: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 12000, ...fetchOptions } = options;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } finally {
    clearTimeout(tid);
  }
}

export async function searchMusic(q: string, source: Source = "all"): Promise<SearchResults> {
  const res = await fetchWithTimeout(`${BASE}/api/music/search?q=${encodeURIComponent(q)}&source=${source}`, { timeoutMs: 20000 });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Search failed");
  return data.results as SearchResults;
}

export async function searchSource(q: string, source: "youtube" | "spotify" | "apple" | "soundcloud"): Promise<Song[]> {
  const res = await fetchWithTimeout(`${BASE}/api/music/search?q=${encodeURIComponent(q)}&source=${source}`, { timeoutMs: 20000 });
  const data = await res.json();
  if (!data.success) return [];
  return (data.results?.[source] as Song[]) || [];
}

export async function getRecommendations(): Promise<Song[]> {
  const res = await fetchWithTimeout(`${BASE}/api/music/recommendations`, { timeoutMs: 12000 });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to get recommendations");
  return data.results as Song[];
}

export async function downloadSong(url: string, source: string): Promise<DownloadResult> {
  const res = await fetchWithTimeout(
    `${BASE}/api/music/download?url=${encodeURIComponent(url)}&source=${encodeURIComponent(source)}`,
    { timeoutMs: 30000 }
  );
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Download failed");
  return data as DownloadResult;
}

export async function prepareSong(song: Song, signal?: AbortSignal): Promise<PrepareResult> {
  const params = new URLSearchParams({ url: song.url, source: song.source, videoId: song.videoId });
  const res = await fetch(`${BASE}/api/music/prepare?${params}`, { signal });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Gagal menyiapkan lagu");
  return data as PrepareResult;
}

export async function downloadSongByQuery(q: string, source: string = "spotify"): Promise<DownloadResult> {
  const res = await fetchWithTimeout(
    `${BASE}/api/music/download?q=${encodeURIComponent(q)}&source=${encodeURIComponent(source)}`,
    { timeoutMs: 30000 }
  );
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Download failed");
  return data as DownloadResult;
}

export async function aiChat(message: string): Promise<string> {
  const res = await fetchWithTimeout(`${BASE}/api/ai/chat?message=${encodeURIComponent(message)}`, { timeoutMs: 30000 });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "AI chat failed");
  return data.reply;
}

export const sourceLabels: Record<string, { label: string; color: string; bg: string }> = {
  youtube:    { label: "YouTube",     color: "#FF0000", bg: "bg-red-600"    },
  spotify:    { label: "Spotify",     color: "#1DB954", bg: "bg-green-500"  },
  apple:      { label: "Apple Music", color: "#fc3c44", bg: "bg-rose-500"   },
  soundcloud: { label: "SoundCloud",  color: "#FF5500", bg: "bg-orange-500" }
};

export const sourceIconNames: Record<string, string> = {
  youtube: "youtube", spotify: "spotify", apple: "apple", soundcloud: "soundcloud"
};
