export const config = { maxDuration: 30 };

function msToTimestamp(ms: number): string {
  if (!ms || ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseAppleArtist(raw: string): string {
  if (!raw) return "Apple Music";
  const parts = raw.split(" · ");
  return parts.length > 1 ? parts.slice(1).join(" · ") : raw;
}

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url, { headers: { "User-Agent": "musika/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function searchYouTube(q: string) {
  const data = await fetchJSON(`https://www.api-junzz.web.id/search/yts?query=${encodeURIComponent(q)}&limit=10`);
  if (!data?.status) throw new Error("YouTube search failed");
  return (data.result || []).slice(0, 10).map((item: any) => ({
    videoId: item.videoId || "",
    title: item.title || "",
    thumbnail: item.thumbnail || (item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : ""),
    duration: item.duration || "0:00",
    url: item.url || (item.videoId ? `https://youtu.be/${item.videoId}` : ""),
    source: "youtube",
    artist: "YouTube"
  }));
}

async function searchSpotify(q: string) {
  const data = await fetchJSON(`https://api.nexray.web.id/search/spotify?q=${encodeURIComponent(q)}`);
  if (!data?.status) throw new Error("Spotify search failed");
  return (data.result || []).slice(0, 20).map((item: any) => ({
    videoId: item.url?.split("/track/")[1]?.split("?")[0] || Math.random().toString(36).slice(2),
    title: item.title || "",
    thumbnail: item.thumbnail || "",
    duration: item.duration || "0:00",
    url: item.url || "",
    source: "spotify",
    artist: item.artist || "Spotify",
    album: item.album || "",
    releaseDate: item.release_date || ""
  }));
}

async function searchAppleMusic(q: string) {
  const data = await fetchJSON(`https://api.cuki.biz.id/api/search/amusic?apikey=cuki-x&query=${encodeURIComponent(q)}&region=id`);
  if (!data?.status) throw new Error("Apple Music search failed");
  return (data.data?.results || []).slice(0, 10).map((item: any) => ({
    videoId: item.link?.match(/i=(\d+)/)?.[1] || Math.random().toString(36).slice(2),
    title: item.title || "",
    thumbnail: item.image || "",
    duration: "0:00",
    url: item.link || "",
    source: "apple",
    artist: parseAppleArtist(item.artist || "")
  }));
}

async function searchSoundCloud(q: string) {
  const data = await fetchJSON(`https://api.cuki.biz.id/api/search/soundcloud?apikey=cuki-x&query=${encodeURIComponent(q)}`);
  if (!data?.status) throw new Error("SoundCloud search failed");
  return (data.data?.results || []).slice(0, 10).map((item: any) => ({
    videoId: item.permalink_url?.split("/").pop() || Math.random().toString(36).slice(2),
    title: item.permalink || item.permalink_url?.split("/").pop() || "",
    thumbnail: item.artwork_url?.replace("-large", "-t300x300") || "",
    duration: item.duration ? msToTimestamp(item.duration) : "0:00",
    url: item.permalink_url || "",
    source: "soundcloud",
    artist: "SoundCloud"
  }));
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { q, source = "all" } = req.query;
  if (!q) return res.status(400).json({ error: "q is required" });

  const selectedSources = source === "all"
    ? ["youtube", "spotify", "apple", "soundcloud"]
    : String(source).split(",").filter(Boolean);

  const searchFns: Record<string, () => Promise<any[]>> = {
    youtube: () => searchYouTube(q),
    spotify: () => searchSpotify(q),
    apple: () => searchAppleMusic(q),
    soundcloud: () => searchSoundCloud(q)
  };

  const results: Record<string, any[]> = {};
  const errors: Record<string, string> = {};

  await Promise.allSettled(
    selectedSources.map(async (src) => {
      if (searchFns[src]) {
        try { results[src] = await searchFns[src](); }
        catch (e: any) { errors[src] = e.message; results[src] = []; }
      }
    })
  );

  res.json({ success: true, results, errors, query: q });
}
