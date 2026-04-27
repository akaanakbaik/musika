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

export async function searchMusic(q: string, source: Source = "all"): Promise<SearchResults> {
  const res = await fetch(`${BASE}/api/music/search?q=${encodeURIComponent(q)}&source=${source}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Search failed");
  return data.results as SearchResults;
}

export async function getRecommendations(): Promise<Song[]> {
  const res = await fetch(`${BASE}/api/music/recommendations`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to get recommendations");
  return data.results as Song[];
}

export async function downloadSong(url: string, source: string): Promise<DownloadResult> {
  const res = await fetch(
    `${BASE}/api/music/download?url=${encodeURIComponent(url)}&source=${encodeURIComponent(source)}`
  );
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Download failed");
  return data as DownloadResult;
}

export async function downloadSongByQuery(q: string, source: string = "spotify"): Promise<DownloadResult> {
  const res = await fetch(
    `${BASE}/api/music/download?q=${encodeURIComponent(q)}&source=${encodeURIComponent(source)}`
  );
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Download failed");
  return data as DownloadResult;
}

export async function aiChat(message: string): Promise<string> {
  const res = await fetch(`${BASE}/api/ai/chat?message=${encodeURIComponent(message)}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "AI chat failed");
  return data.reply;
}

export const sourceLabels: Record<string, { label: string; color: string; bg: string }> = {
  youtube: { label: "YouTube", color: "#FF0000", bg: "bg-red-600" },
  spotify: { label: "Spotify", color: "#1DB954", bg: "bg-green-500" },
  apple: { label: "Apple Music", color: "#fc3c44", bg: "bg-rose-500" },
  soundcloud: { label: "SoundCloud", color: "#FF5500", bg: "bg-orange-500" }
};

export const sourceIconNames: Record<string, string> = {
  youtube: "youtube",
  spotify: "spotify",
  apple: "apple",
  soundcloud: "soundcloud"
};
