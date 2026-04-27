import { Router, type IRouter, type Request, type Response } from "express";
import type { IncomingMessage } from "http";
import https from "https";
import http from "http";

const router: IRouter = Router();

export interface Song {
  videoId: string;
  title: string;
  thumbnail: string;
  duration: string;
  url: string;
  source: string;
  artist: string;
  album?: string;
  releaseDate?: string;
}

// ===== IN-MEMORY CACHE (TTL-based) =====
interface CacheEntry { data: any; expires: number; }
const searchCache = new Map<string, CacheEntry>();
const downloadCache = new Map<string, CacheEntry>();

function cacheGet(map: Map<string, CacheEntry>, key: string): any | null {
  const entry = map.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { map.delete(key); return null; }
  return entry.data;
}
function cacheSet(map: Map<string, CacheEntry>, key: string, data: any, ttlMs: number) {
  // Keep cache size reasonable
  if (map.size > 200) {
    const oldestKey = map.keys().next().value;
    if (oldestKey) map.delete(oldestKey);
  }
  map.set(key, { data, expires: Date.now() + ttlMs });
}

// ===== HTTP FETCH WITH TIMEOUT & RETRY =====
async function fetchJSON(url: string, timeoutMs = 15000, retries = 1): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8"
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      clearTimeout(timer);
      return await res.json();
    } catch (err: any) {
      clearTimeout(timer);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

// ===== HELPERS =====
function msToTimestamp(ms: number): string {
  if (!ms || ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function secToTimestamp(sec: number): string {
  return msToTimestamp(sec * 1000);
}

function extractArtistFromTitle(title: string): string {
  // Try "Artist - Title" format
  const match = title.match(/^(.+?)\s*[-–—]\s*.+/);
  if (match && match[1].length < 60) return match[1].trim();
  return "YouTube";
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s*\(Official.*?\)/gi, "")
    .replace(/\s*\[Official.*?\]/gi, "")
    .replace(/\s*\(Lyric.*?\)/gi, "")
    .replace(/\s*\[Lyric.*?\]/gi, "")
    .replace(/\s*\(Audio.*?\)/gi, "")
    .replace(/\s*\(Music Video\)/gi, "")
    .replace(/\s*\(MV\)/gi, "")
    .trim();
}

// ===== CDN UPLOAD (async, non-blocking) =====
const cdnCache = new Map<string, string>(); // originalUrl → CDN URL

async function uploadToCDN(audioUrl: string, slug: string): Promise<string> {
  const cached = cdnCache.get(audioUrl);
  if (cached) return cached;

  try {
    // Download the audio
    const res = await fetch(audioUrl, {
      headers: { "User-Agent": "Mozilla/5.0 musika/1.0", "Range": "bytes=0-" },
      signal: AbortSignal.timeout(45000)
    });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 1000) throw new Error("File too small");

    const contentType = res.headers.get("content-type") || "audio/mpeg";
    const ext = contentType.includes("aac") ? "aac" : "mp3";

    // Upload to kabox CDN
    const form = new FormData();
    const blob = new Blob([buffer], { type: contentType });
    form.append("file", blob, `${slug.slice(0, 40)}.${ext}`);

    const upload = await fetch("https://api.kabox.my.id/api/upload", {
      method: "POST",
      headers: { "x-expire": "8h" },
      body: form,
      signal: AbortSignal.timeout(60000)
    });

    if (!upload.ok) throw new Error(`CDN upload failed: ${upload.status}`);
    const uploadData = await upload.json();
    const cdnUrl = uploadData?.url || uploadData?.data?.url;

    if (cdnUrl && typeof cdnUrl === "string" && cdnUrl.startsWith("http")) {
      cdnCache.set(audioUrl, cdnUrl);
      // Clear old cache entries
      if (cdnCache.size > 100) {
        const firstKey = cdnCache.keys().next().value;
        if (firstKey) cdnCache.delete(firstKey);
      }
      return cdnUrl;
    }
    throw new Error("No CDN URL in response");
  } catch (err) {
    console.warn("[CDN] Upload failed:", err);
    return audioUrl; // Fallback to original URL
  }
}

// ===== YOUTUBE SEARCH =====
async function searchYouTube(q: string): Promise<Song[]> {
  const cacheKey = `yt:${q}`;
  const cached = cacheGet(searchCache, cacheKey);
  if (cached) return cached;

  const apis = [
    // API 1: junzz
    async () => {
      const d = await fetchJSON(`https://www.api-junzz.web.id/search/yts?query=${encodeURIComponent(q)}&limit=15`);
      if (!d?.status && !d?.result) throw new Error("Invalid response");
      return (d.result || []).slice(0, 15).map((item: any) => {
        const title = cleanTitle(item.title || "");
        return {
          videoId: item.videoId || "",
          title,
          thumbnail: item.thumbnail || (item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : ""),
          duration: item.duration || "0:00",
          url: item.url || (item.videoId ? `https://youtu.be/${item.videoId}` : ""),
          source: "youtube",
          artist: item.channel || extractArtistFromTitle(title)
        };
      });
    },
    // API 2: nexray
    async () => {
      const d = await fetchJSON(`https://api.nexray.web.id/search/yt?q=${encodeURIComponent(q)}&limit=15`);
      if (!d?.status) throw new Error("Invalid response");
      return (d.result || []).slice(0, 15).map((item: any) => {
        const title = cleanTitle(item.title || "");
        return {
          videoId: item.id || item.videoId || "",
          title,
          thumbnail: item.thumbnail || (item.id ? `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg` : ""),
          duration: item.duration ? (typeof item.duration === "number" ? secToTimestamp(item.duration) : item.duration) : "0:00",
          url: item.url || (item.id ? `https://youtu.be/${item.id}` : ""),
          source: "youtube",
          artist: item.channel?.name || item.channel || extractArtistFromTitle(title)
        };
      });
    },
    // API 3: cuki
    async () => {
      const d = await fetchJSON(`https://api.cuki.biz.id/api/search/youtube?apikey=cuki-x&query=${encodeURIComponent(q)}&limit=15`);
      if (!d?.status && !d?.data) throw new Error("Invalid response");
      return ((d.data?.results || d.result || d.results || []).slice(0, 15)).map((item: any) => {
        const title = cleanTitle(item.title || "");
        const vid = item.videoId || item.id || "";
        return {
          videoId: vid,
          title,
          thumbnail: item.thumbnail || (vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : ""),
          duration: item.duration || "0:00",
          url: item.url || (vid ? `https://youtu.be/${vid}` : ""),
          source: "youtube",
          artist: item.channel || extractArtistFromTitle(title)
        };
      });
    }
  ];

  let results: Song[] = [];
  for (const api of apis) {
    try {
      results = await api();
      if (results.length > 0) break;
    } catch (err) {
      console.warn("[YT Search] API failed, trying next:", err);
    }
  }

  // Filter out songs without a valid videoId/url
  results = results.filter(s => s.videoId && s.title);

  if (results.length > 0) {
    cacheSet(searchCache, cacheKey, results, 10 * 60 * 1000); // 10 min
  }
  return results;
}

// ===== YOUTUBE DOWNLOAD =====
async function downloadYouTube(url: string): Promise<{ downloadUrl: string; title: string; thumbnail: string; artist: string }> {
  const cacheKey = `ytdl:${url}`;
  const cached = cacheGet(downloadCache, cacheKey);
  if (cached) return cached;

  const apis = [
    // API 1: kelvdra (primary)
    async () => {
      const d = await fetchJSON(`https://apii.kelvdra.my.id/api/download/ytmp3?url=${encodeURIComponent(url)}&bitrate=128&apikey=akaanakbaik`, 25000);
      if (!d?.status || !d?.download?.url) throw new Error("No download URL");
      return {
        downloadUrl: d.download.url,
        title: cleanTitle(d.metadata?.title || ""),
        thumbnail: d.metadata?.thumbnail || d.metadata?.image || "",
        artist: d.metadata?.author?.name || d.metadata?.channel || ""
      };
    },
    // API 2: nexray
    async () => {
      const d = await fetchJSON(`https://api.nexray.web.id/downloader/ytmp3?url=${encodeURIComponent(url)}`, 25000);
      if (!d?.status || !d?.result?.url) throw new Error("No download URL");
      return {
        downloadUrl: d.result.url,
        title: cleanTitle(d.result?.title || ""),
        thumbnail: d.result?.thumbnail || "",
        artist: d.result?.channel || ""
      };
    },
    // API 3: cuki
    async () => {
      const d = await fetchJSON(`https://api.cuki.biz.id/api/downloader/youtube?apikey=cuki-x&url=${encodeURIComponent(url)}`, 25000);
      if (!d?.status && !d?.success) throw new Error("Failed");
      const result = d?.data || d?.result;
      if (!result?.url) throw new Error("No download URL");
      return {
        downloadUrl: result.url,
        title: cleanTitle(result.title || ""),
        thumbnail: result.thumbnail || "",
        artist: result.channel || result.artist || ""
      };
    }
  ];

  for (const api of apis) {
    try {
      const result = await api();
      if (result.downloadUrl) {
        // Upload to CDN asynchronously (non-blocking)
        const videoId = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1] || Date.now().toString();
        uploadToCDN(result.downloadUrl, videoId).then(cdnUrl => {
          if (cdnUrl !== result.downloadUrl) {
            // Update cache with CDN URL
            cacheSet(downloadCache, cacheKey, { ...result, downloadUrl: cdnUrl }, 7 * 60 * 60 * 1000);
          }
        }).catch(() => {});

        cacheSet(downloadCache, cacheKey, result, 5 * 60 * 60 * 1000); // 5h
        return result;
      }
    } catch (err) {
      console.warn("[YT Download] API failed, trying next:", err);
    }
  }
  throw new Error("Semua API YouTube download gagal. Coba lagi.");
}

// ===== SPOTIFY SEARCH =====
async function searchSpotify(q: string): Promise<Song[]> {
  const cacheKey = `sp:${q}`;
  const cached = cacheGet(searchCache, cacheKey);
  if (cached) return cached;

  const apis = [
    async () => {
      const d = await fetchJSON(`https://api.nexray.web.id/search/spotify?q=${encodeURIComponent(q)}&limit=20`);
      if (!d?.status) throw new Error("Failed");
      return (d.result || []).slice(0, 20).map((item: any) => ({
        videoId: item.url?.split("/track/")[1]?.split("?")[0] || item.id || Math.random().toString(36).slice(2),
        title: item.title || item.name || "",
        thumbnail: item.thumbnail || item.image || item.cover || "",
        duration: item.duration || "0:00",
        url: item.url || "",
        source: "spotify",
        artist: item.artist || item.artists?.[0] || "Spotify",
        album: item.album || "",
        releaseDate: item.release_date || ""
      }));
    },
    async () => {
      const d = await fetchJSON(`https://api.cuki.biz.id/api/search/spotify?apikey=cuki-x&query=${encodeURIComponent(q)}&limit=20`);
      if (!d?.status && !d?.data) throw new Error("Failed");
      return ((d.data?.results || d.result || []).slice(0, 20)).map((item: any) => ({
        videoId: item.url?.split("/track/")[1]?.split("?")[0] || Math.random().toString(36).slice(2),
        title: item.title || item.name || "",
        thumbnail: item.thumbnail || item.image || "",
        duration: item.duration || "0:00",
        url: item.url || item.link || "",
        source: "spotify",
        artist: item.artist || item.artists || "Spotify",
        album: item.album || ""
      }));
    }
  ];

  let results: Song[] = [];
  for (const api of apis) {
    try {
      results = await api();
      if (results.length > 0) break;
    } catch (err) {
      console.warn("[Spotify Search] API failed:", err);
    }
  }

  results = results.filter(s => s.title && s.url);
  if (results.length > 0) cacheSet(searchCache, cacheKey, results, 15 * 60 * 1000);
  return results;
}

// ===== SPOTIFY DOWNLOAD =====
async function downloadSpotify(url: string): Promise<{ downloadUrl: string; title: string; thumbnail: string; artist: string; album: string }> {
  const cacheKey = `spdl:${url}`;
  const cached = cacheGet(downloadCache, cacheKey);
  if (cached) return cached;

  const apis = [
    async () => {
      const d = await fetchJSON(`https://api.nexray.web.id/downloader/spotify?url=${encodeURIComponent(url)}`, 30000);
      if (!d?.status || !d?.result?.url) throw new Error("No URL");
      return {
        downloadUrl: d.result.url,
        title: d.result.title || "",
        thumbnail: d.result.thumbnail || d.result.image || "",
        artist: d.result.artist || "",
        album: d.result.album || ""
      };
    },
    async () => {
      const d = await fetchJSON(`https://api.cuki.biz.id/api/downloader/spotify?apikey=cuki-x&url=${encodeURIComponent(url)}`, 30000);
      if ((!d?.status && !d?.success) || !d?.data?.url) throw new Error("No URL");
      return {
        downloadUrl: d.data.url,
        title: d.data.title || "",
        thumbnail: d.data.thumbnail || d.data.image || "",
        artist: d.data.artist || d.data.artists || "",
        album: d.data.album || ""
      };
    }
  ];

  for (const api of apis) {
    try {
      const result = await api();
      if (result.downloadUrl) {
        // Async CDN upload
        const trackId = url.split("/track/")[1]?.split("?")[0] || Date.now().toString();
        uploadToCDN(result.downloadUrl, `sp-${trackId}`).then(cdnUrl => {
          if (cdnUrl !== result.downloadUrl) {
            cacheSet(downloadCache, cacheKey, { ...result, downloadUrl: cdnUrl }, 7 * 60 * 60 * 1000);
          }
        }).catch(() => {});
        cacheSet(downloadCache, cacheKey, result, 5 * 60 * 60 * 1000);
        return result;
      }
    } catch (err) {
      console.warn("[Spotify DL] API failed:", err);
    }
  }
  throw new Error("Download Spotify gagal. Coba lagi.");
}

// ===== APPLE MUSIC SEARCH =====
async function searchAppleMusic(q: string): Promise<Song[]> {
  const cacheKey = `am:${q}`;
  const cached = cacheGet(searchCache, cacheKey);
  if (cached) return cached;

  const apis = [
    async () => {
      const d = await fetchJSON(`https://api.cuki.biz.id/api/search/amusic?apikey=cuki-x&query=${encodeURIComponent(q)}&region=id&limit=20`);
      if (!d?.status && !d?.data) throw new Error("Failed");
      return ((d.data?.results || d.result || []).slice(0, 20)).map((item: any) => {
        const artistRaw = item.artist || "";
        const parts = artistRaw.split(" · ");
        const artist = parts.length > 1 ? parts.slice(1).join(" · ") : artistRaw;
        const songId = item.link?.split("/song/")[1]?.split("?")[0] ||
          item.link?.match(/i=(\d+)/)?.[1] ||
          item.id || Math.random().toString(36).slice(2);
        return {
          videoId: songId,
          title: item.title || item.name || "",
          thumbnail: item.image || item.thumbnail || "",
          duration: item.duration ? msToTimestamp(item.duration) : "0:00",
          url: item.link || item.url || "",
          source: "apple",
          artist: artist || "Apple Music",
          album: item.album || ""
        };
      });
    },
    // iTunes Search API as fallback
    async () => {
      const d = await fetchJSON(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=15&country=id`);
      return (d.results || []).slice(0, 15).map((item: any) => ({
        videoId: String(item.trackId || Math.random().toString(36).slice(2)),
        title: item.trackName || "",
        thumbnail: item.artworkUrl100?.replace("100x100", "300x300") || "",
        duration: item.trackTimeMillis ? msToTimestamp(item.trackTimeMillis) : "0:00",
        url: item.trackViewUrl || "",
        source: "apple",
        artist: item.artistName || "Apple Music",
        album: item.collectionName || ""
      }));
    }
  ];

  let results: Song[] = [];
  for (const api of apis) {
    try {
      results = await api();
      if (results.length > 0) break;
    } catch (err) {
      console.warn("[Apple Search] API failed:", err);
    }
  }

  results = results.filter(s => s.title && s.url);
  if (results.length > 0) cacheSet(searchCache, cacheKey, results, 15 * 60 * 1000);
  return results;
}

// ===== APPLE MUSIC DOWNLOAD =====
async function downloadAppleMusic(url: string): Promise<{ downloadUrl: string; title: string; thumbnail: string; artist: string; album: string }> {
  const cacheKey = `amdl:${url}`;
  const cached = cacheGet(downloadCache, cacheKey);
  if (cached) return cached;

  // Try downloading via cuki
  const d = await fetchJSON(`https://api.cuki.biz.id/api/downloader/musicapple?apikey=cuki-x&url=${encodeURIComponent(url)}`, 25000);
  if (!d?.success && !d?.status) throw new Error("Apple Music download failed");
  const data = d.data || d.result;
  const downloadUrl = data?.preview || data?.url || data?.download_url;
  if (!downloadUrl) throw new Error("No playable URL found");

  const result = {
    downloadUrl,
    title: data.title || data.name || "",
    thumbnail: data.cover || data.thumbnail || data.image || "",
    artist: data.artist || data.artists || "Apple Music",
    album: data.album || ""
  };

  cacheSet(downloadCache, cacheKey, result, 6 * 60 * 60 * 1000);
  return result;
}

// ===== SOUNDCLOUD SEARCH =====
async function searchSoundCloud(q: string): Promise<Song[]> {
  const cacheKey = `sc:${q}`;
  const cached = cacheGet(searchCache, cacheKey);
  if (cached) return cached;

  const apis = [
    async () => {
      const d = await fetchJSON(`https://api.cuki.biz.id/api/search/soundcloud?apikey=cuki-x&query=${encodeURIComponent(q)}&limit=15`);
      if (!d?.status && !d?.data) throw new Error("Failed");
      return ((d.data?.results || d.result || []).slice(0, 15)).map((item: any) => {
        const scId = item.id || item.permalink_url?.split("/").filter(Boolean).pop() || Math.random().toString(36).slice(2);
        // API returns: permalink (title), artwork_url, permalink_url, duration, genre
        // user field is sometimes absent
        const title = item.title || item.permalink || item.permalink_url?.split("/").pop()?.replace(/-/g, " ") || "";
        const artist = item.user?.username || item.user || item.username ||
          item.permalink_url?.split("/").filter(Boolean)[1] || "SoundCloud";
        return {
          videoId: String(scId),
          title,
          thumbnail: item.artwork_url?.replace("-large", "-t300x300") || item.thumbnail || "",
          duration: item.duration ? msToTimestamp(item.duration) : item.full_duration ? msToTimestamp(item.full_duration) : "0:00",
          url: item.permalink_url || item.url || "",
          source: "soundcloud",
          artist
        };
      });
    }
  ];

  let results: Song[] = [];
  for (const api of apis) {
    try {
      results = await api();
      if (results.length > 0) break;
    } catch (err) {
      console.warn("[SC Search] API failed:", err);
    }
  }

  results = results.filter(s => s.title && s.url);
  if (results.length > 0) cacheSet(searchCache, cacheKey, results, 15 * 60 * 1000);
  return results;
}

// ===== SOUNDCLOUD DOWNLOAD =====
async function downloadSoundCloud(url: string): Promise<{ downloadUrl: string; title: string; thumbnail: string; artist: string }> {
  const cacheKey = `scdl:${url}`;
  const cached = cacheGet(downloadCache, cacheKey);
  if (cached) return cached;

  const d = await fetchJSON(`https://api.cuki.biz.id/api/downloader/soundcloud?apikey=cuki-x&url=${encodeURIComponent(url)}`, 25000);
  if (!d?.success && !d?.status) throw new Error("SoundCloud download failed");
  const data = d.data || d.result;
  const downloadUrl = data?.url || data?.download_url;
  if (!downloadUrl) throw new Error("No download URL");

  const result = {
    downloadUrl,
    title: data.title || "",
    thumbnail: data.thumbnail || data.artwork_url || "",
    artist: data.user || data.artist || "SoundCloud"
  };

  // Async CDN upload
  uploadToCDN(downloadUrl, `sc-${Date.now()}`).then(cdnUrl => {
    if (cdnUrl !== downloadUrl) cacheSet(downloadCache, cacheKey, { ...result, downloadUrl: cdnUrl }, 7 * 60 * 60 * 1000);
  }).catch(() => {});

  cacheSet(downloadCache, cacheKey, result, 6 * 60 * 60 * 1000);
  return result;
}

// ===== SEARCH ROUTE (all sources) =====
router.get("/music/search", async (req: Request, res: Response) => {
  const { q, source = "all" } = req.query as { q: string; source?: string };
  if (!q?.trim()) return res.status(400).json({ success: false, error: "q is required" });

  const selectedSources = source === "all"
    ? ["youtube", "spotify", "apple", "soundcloud"]
    : source.split(",").map(s => s.trim()).filter(Boolean);

  const searchFns: Record<string, () => Promise<Song[]>> = {
    youtube: () => searchYouTube(q),
    spotify: () => searchSpotify(q),
    apple: () => searchAppleMusic(q),
    soundcloud: () => searchSoundCloud(q)
  };

  const results: Record<string, Song[]> = {};
  const errors: Record<string, string> = {};

  await Promise.allSettled(
    selectedSources.map(async (src) => {
      if (searchFns[src]) {
        try {
          results[src] = await searchFns[src]();
        } catch (e: any) {
          errors[src] = e.message;
          results[src] = [];
        }
      }
    })
  );

  const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
  res.json({ success: true, results, errors, query: q, total: totalResults });
});

// ===== PER-SOURCE SEARCH (for real-time progress) =====
router.get("/music/search/:source", async (req: Request, res: Response) => {
  const { source } = req.params;
  const { q } = req.query as { q: string };
  if (!q?.trim()) return res.status(400).json({ success: false, error: "q is required" });

  const searchFns: Record<string, () => Promise<Song[]>> = {
    youtube: () => searchYouTube(q),
    spotify: () => searchSpotify(q),
    apple: () => searchAppleMusic(q),
    soundcloud: () => searchSoundCloud(q)
  };

  if (!searchFns[source]) {
    return res.status(400).json({ success: false, error: `Unknown source: ${source}` });
  }

  try {
    const results = await searchFns[source]();
    res.json({ success: true, source, results, query: q });
  } catch (e: any) {
    res.json({ success: false, source, results: [], error: e.message, query: q });
  }
});

// ===== DOWNLOAD / PLAY URL =====
router.get("/music/download", async (req: Request, res: Response) => {
  const { url, source = "youtube", q } = req.query as { url?: string; source?: string; q?: string };

  try {
    let downloadUrl = "";
    let title = "";
    let thumbnail = "";
    let artist = "";
    let album = "";

    if (source === "youtube" && url) {
      const r = await downloadYouTube(url);
      downloadUrl = r.downloadUrl;
      title = r.title;
      thumbnail = r.thumbnail;
      artist = r.artist;
    } else if (source === "spotify" && url) {
      const r = await downloadSpotify(url);
      downloadUrl = r.downloadUrl;
      title = r.title;
      thumbnail = r.thumbnail;
      artist = r.artist;
      album = r.album;
    } else if (source === "spotify" && q) {
      // Search + download in one
      const d = await fetchJSON(`https://api.nexray.web.id/downloader/spotifyplay?q=${encodeURIComponent(q)}`, 30000);
      if (d?.status && d?.result?.download_url) {
        downloadUrl = d.result.download_url;
        title = d.result.title || "";
        thumbnail = d.result.thumbnail || "";
        artist = d.result.artist || "";
        album = d.result.album || "";
      } else {
        throw new Error("Spotify play download failed");
      }
    } else if (source === "apple" && url) {
      const r = await downloadAppleMusic(url);
      downloadUrl = r.downloadUrl;
      title = r.title;
      thumbnail = r.thumbnail;
      artist = r.artist;
      album = r.album;
    } else if (source === "soundcloud" && url) {
      const r = await downloadSoundCloud(url);
      downloadUrl = r.downloadUrl;
      title = r.title;
      thumbnail = r.thumbnail;
      artist = r.artist;
    } else {
      return res.status(400).json({ success: false, error: "URL atau query diperlukan" });
    }

    if (!downloadUrl) {
      return res.status(404).json({ success: false, error: "Tidak ada URL audio yang ditemukan. Coba lagi." });
    }

    res.json({ success: true, download_url: downloadUrl, title, thumbnail, artist, album, source });
  } catch (err: any) {
    console.error(`[Download] ${source} error:`, err.message);
    res.status(500).json({ success: false, error: err.message || "Download gagal" });
  }
});

// ===== PREPARE ENDPOINT (CDN-first playback pipeline) =====
// Per-song TTL cache for prepared play URLs
interface PrepareEntry { streamUrl: string; cdnUrl: string | null; expires: number; }
const prepareCache = new Map<string, PrepareEntry>();

router.get("/music/prepare", async (req: Request, res: Response) => {
  const { url, source = "youtube", videoId } = req.query as { url?: string; source?: string; videoId?: string };
  if (!url) return res.status(400).json({ success: false, error: "url is required" });

  const cacheKey = `${source}:${videoId || url}`;

  // Return cached entry if still valid
  const cached = prepareCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) {
    return res.json({ success: true, stream_url: cached.streamUrl, cdn_url: cached.cdnUrl, cached: true });
  }

  try {
    // Step 1: Get raw audio URL based on source
    let rawUrl = "";
    let title = "";
    let thumbnail = "";
    let artist = "";
    let album = "";

    if (source === "youtube") {
      const r = await downloadYouTube(url);
      rawUrl = r.downloadUrl; title = r.title; thumbnail = r.thumbnail; artist = r.artist;
    } else if (source === "spotify") {
      const r = await downloadSpotify(url);
      rawUrl = r.downloadUrl; title = r.title; thumbnail = r.thumbnail; artist = r.artist; album = r.album;
    } else if (source === "apple") {
      const r = await downloadAppleMusic(url);
      rawUrl = r.downloadUrl; title = r.title; thumbnail = r.thumbnail; artist = r.artist; album = r.album;
    } else if (source === "soundcloud") {
      const r = await downloadSoundCloud(url);
      rawUrl = r.downloadUrl; title = r.title; thumbnail = r.thumbnail; artist = r.artist;
    } else {
      return res.status(400).json({ success: false, error: `Unknown source: ${source}` });
    }

    if (!rawUrl) throw new Error("Could not get audio URL from source");

    // Step 2: Build stream proxy URL (always available, no CORS issues)
    // NOTE: rawUrl is already decoded by Express query parsing — do NOT double-decode
    const streamUrl = `/api/music/stream?url=${encodeURIComponent(rawUrl)}`;

    // Step 3: Check if CDN URL already cached from a previous background upload
    const existingCdn = cdnCache.get(rawUrl);

    // Step 4: Trigger CDN upload in background (non-blocking)
    // This warms the cache so the NEXT play of this song uses CDN directly
    if (!existingCdn) {
      const slug = (videoId || `${source}-${Date.now()}`).replace(/[^a-z0-9]/gi, "-").slice(0, 40);
      uploadToCDN(rawUrl, slug).catch(() => {});
    }

    // Step 5: Cache the prepare result
    const entry: PrepareEntry = {
      streamUrl,
      cdnUrl: existingCdn || null,
      expires: Date.now() + 5 * 60 * 60 * 1000 // 5h
    };
    if (prepareCache.size > 100) {
      const oldKey = prepareCache.keys().next().value;
      if (oldKey) prepareCache.delete(oldKey);
    }
    prepareCache.set(cacheKey, entry);

    return res.json({
      success: true,
      stream_url: streamUrl,
      cdn_url: existingCdn || null,
      title, artist, thumbnail, album, source,
      via_cdn: !!existingCdn
    });

  } catch (err: any) {
    console.error(`[Prepare] ${source} error:`, err.message);
    res.status(500).json({ success: false, error: err.message || "Gagal menyiapkan lagu" });
  }
});

// ===== STREAM PROXY (fixed: no double decodeURIComponent, always sets Accept-Ranges) =====
router.get("/music/stream", async (req: Request, res: Response) => {
  const { url } = req.query as { url: string };
  if (!url) return res.status(400).json({ error: "url is required" });

  try {
    // IMPORTANT: Express already URL-decodes req.query values once.
    // Do NOT call decodeURIComponent(url) again — that would double-decode
    // (turning %20 → space, breaking the upstream URL).
    const targetUrl = url;
    const rangeHeader = req.headers.range;

    const upstreamHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,*/*;q=0.5",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
      "Referer": "https://www.youtube.com/"
    };
    if (rangeHeader) upstreamHeaders["Range"] = rangeHeader;

    const upstream = await fetch(targetUrl, {
      headers: upstreamHeaders,
      signal: AbortSignal.timeout(30000)
    });

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(502).json({ error: `Upstream ${upstream.status}: ${upstream.statusText}` });
    }

    if (!upstream.body) {
      return res.status(502).json({ error: "No upstream body" });
    }

    const contentType = upstream.headers.get("content-type") || "audio/mpeg";
    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");

    // Always expose range support for seekable audio
    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
    res.setHeader("Cache-Control", "public, max-age=14400");
    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (contentRange) res.setHeader("Content-Range", contentRange);
    else if (rangeHeader && contentLength) {
      // Build content-range if upstream didn't send one
      const total = parseInt(contentLength);
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1]);
        const end = match[2] ? parseInt(match[2]) : total - 1;
        res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
      }
    }

    res.status(upstream.status === 206 ? 206 : 200);

    const reader = upstream.body.getReader();
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); break; }
          const ok = res.write(value);
          if (!ok) await new Promise<void>(r => res.once("drain", r));
        }
      } catch {
        try { reader.cancel(); } catch {}
        if (!res.writableEnded) res.end();
      }
    };

    req.on("close", () => { try { reader.cancel(); } catch {} });
    req.on("aborted", () => { try { reader.cancel(); } catch {} });

    await pump();
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ error: err.message || "Stream failed" });
    else res.end();
  }
});

// ===== RECOMMENDATIONS =====
router.get("/music/recommendations", async (_req: Request, res: Response) => {
  const cacheKey = "recs";
  const cached = cacheGet(searchCache, cacheKey);
  if (cached) return res.json({ success: true, results: cached, cached: true });

  const queries = [
    "top hits 2025 Indonesia", "viral songs 2025", "Billboard Hot 100 2025",
    "trending music now", "best pop 2025", "lagu hits Indonesia 2025",
    "k-pop hits 2025", "lo-fi beats chill", "top spotify 2025",
    "best r&b soul 2025"
  ];
  const q = queries[Math.floor(Math.random() * queries.length)];

  try {
    const results = await searchYouTube(q);
    if (results.length > 0) {
      cacheSet(searchCache, cacheKey, results, 30 * 60 * 1000); // 30 min
    }
    res.json({ success: true, results, query: q });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
