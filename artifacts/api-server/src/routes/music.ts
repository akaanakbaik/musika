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
  if (map.size > 200) {
    const oldestKey = map.keys().next().value;
    if (oldestKey) map.delete(oldestKey);
  }
  map.set(key, { data, expires: Date.now() + ttlMs });
}

// ===== FALLBACK SONG DATA (when APIs fail) =====
const fallbackSongs: Song[] = [
  { videoId: "dQw4w9WgXcQ", title: "Never Gonna Give You Up", thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", duration: "3:32", url: "https://youtu.be/dQw4w9WgXcQ", source: "youtube", artist: "Rick Astley" },
  { videoId: "9bZkp7q19f0", title: "Gangnam Style", thumbnail: "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg", duration: "4:13", url: "https://youtu.be/9bZkp7q19f0", source: "youtube", artist: "PSY" },
  { videoId: "kJQP7kiw5Fk", title: "Despacito", thumbnail: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg", duration: "4:42", url: "https://youtu.be/kJQP7kiw5Fk", source: "youtube", artist: "Luis Fonsi ft. Daddy Yankee" },
  { videoId: "JGwWNGJdvx8", title: "Shape of You", thumbnail: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg", duration: "4:24", url: "https://youtu.be/JGwWNGJdvx8", source: "youtube", artist: "Ed Sheeran" },
  { videoId: "OPf0YbXqDm0", title: "Uptown Funk", thumbnail: "https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg", duration: "4:30", url: "https://youtu.be/OPf0YbXqDm0", source: "youtube", artist: "Mark Ronson ft. Bruno Mars" },
  { videoId: "RgKAFK5djSk", title: "See You Again", thumbnail: "https://i.ytimg.com/vi/RgKAFK5djSk/hqdefault.jpg", duration: "4:40", url: "https://youtu.be/RgKAFK5djSk", source: "youtube", artist: "Wiz Khalifa ft. Charlie Puth" },
  { videoId: "lp-EO5I60KA", title: "Yeah!", thumbnail: "https://i.ytimg.com/vi/lp-EO5I60KA/hqdefault.jpg", duration: "4:10", url: "https://youtu.be/lp-EO5I60KA", source: "youtube", artist: "Usher ft. Lil Jon, Ludacris" },
  { videoId: "60ItHLz5WEA", title: "Faded", thumbnail: "https://i.ytimg.com/vi/60ItHLz5WEA/hqdefault.jpg", duration: "3:32", url: "https://youtu.be/60ItHLz5WEA", source: "youtube", artist: "Alan Walker" },
  { videoId: "YQHsXMglC9A", title: "Adele - Hello", thumbnail: "https://i.ytimg.com/vi/YQHsXMglC9A/hqdefault.jpg", duration: "4:55", url: "https://youtu.be/YQHsXMglC9A", source: "youtube", artist: "Adele" },
  { videoId: "hT_nvWreIhg", title: "One Dance", thumbnail: "https://i.ytimg.com/vi/hT_nvWreIhg/hqdefault.jpg", duration: "2:54", url: "https://youtu.be/hT_nvWreIhg", source: "youtube", artist: "Drake" },
  { videoId: "fRh_vgS2dFE", title: "7 Rings", thumbnail: "https://i.ytimg.com/vi/fRh_vgS2dFE/hqdefault.jpg", duration: "2:58", url: "https://youtu.be/fRh_vgS2dFE", source: "youtube", artist: "Ariana Grande" },
  { videoId: "2Vv-BfVoq4g", title: "Perfect", thumbnail: "https://i.ytimg.com/vi/2Vv-BfVoq4g/hqdefault.jpg", duration: "4:23", url: "https://youtu.be/2Vv-BfVoq4g", source: "youtube", artist: "Ed Sheeran" },
  { videoId: "09R8_2nJtjg", title: "Sugar", thumbnail: "https://i.ytimg.com/vi/09R8_2nJtjg/hqdefault.jpg", duration: "4:20", url: "https://youtu.be/09R8_2nJtjg", source: "youtube", artist: "Maroon 5" },
  { videoId: "HP-MbfHFUqs", title: "Someone Like You", thumbnail: "https://i.ytimg.com/vi/HP-MbfHFUqs/hqdefault.jpg", duration: "4:47", url: "https://youtu.be/HP-MbfHFUqs", source: "youtube", artist: "Adele" },
  { videoId: "CevxZvSJLk8", title: "Roar", thumbnail: "https://i.ytimg.com/vi/CevxZvSJLk8/hqdefault.jpg", duration: "4:30", url: "https://youtu.be/CevxZvSJLk8", source: "youtube", artist: "Katy Perry" },
];

function getFallbackSongs(count: number = 10): Song[] {
  const shuffled = [...fallbackSongs].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// ===== HTTP FETCH WITH TIMEOUT & RETRY =====
async function fetchJSON(url: string, timeoutMs = 15000, retriesOrOpts: number | Record<string, any> = 1): Promise<any> {
  const opts = typeof retriesOrOpts === "object" ? retriesOrOpts : null;
  const retries = typeof retriesOrOpts === "number" ? retriesOrOpts : 1;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const fetchOptions: any = {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8"
        }
      };

      if (opts) {
        if (opts.method) fetchOptions.method = opts.method;
        if (opts.body) fetchOptions.body = opts.body;
        if (opts.headers) {
          fetchOptions.headers = { ...fetchOptions.headers, ...opts.headers };
        }
      }

      const res = await fetch(url, fetchOptions);
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
export function msToTimestamp(ms: number): string {
  if (!ms || ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function secToTimestamp(sec: number): string {
  return msToTimestamp(sec * 1000);
}

export function extractArtistFromTitle(title: string): string {
  const match = title.match(/^(.+?)\s*[-–—]\s*.+/);
  if (match && match[1].length < 60) return match[1].trim();
  return "YouTube";
}

export function cleanTitle(title: string): string {
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
const cdnCache = new Map<string, string>();
const CDN_MAX_SIZE = 5 * 1024 * 1024;

async function uploadToCDN(audioUrl: string, slug: string): Promise<string> {
  const cached = cdnCache.get(audioUrl);
  if (cached) return cached;
  try {
    const headRes = await fetch(audioUrl, { method: "HEAD", signal: AbortSignal.timeout(10000) });
    const contentLength = parseInt(headRes.headers.get("content-length") || "0");
    if (contentLength > CDN_MAX_SIZE) {
      console.warn(`[CDN] File too large (${(contentLength/1024/1024).toFixed(1)}MB > 5MB), skipping`);
      return audioUrl;
    }
    const res = await fetch(audioUrl, {
      headers: { "User-Agent": "Mozilla/5.0 musika/1.0", "Range": "bytes=0-" },
      signal: AbortSignal.timeout(45000)
    });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 1000) throw new Error("File too small");
    if (buffer.byteLength > CDN_MAX_SIZE) throw new Error(`File exceeds limit (${(buffer.byteLength/1024/1024).toFixed(1)}MB > 5MB)`);
    const contentType = res.headers.get("content-type") || "audio/mpeg";
    const ext = contentType.includes("aac") ? "aac" : "mp3";
    const form = new FormData();
    const blob = new Blob([buffer], { type: contentType });
    form.append("file", blob, `${slug.slice(0, 40)}.${ext}`);
    const upload = await fetch("https://cdn.izukaprivate.my.id/upload", {
      method: "POST", body: form, signal: AbortSignal.timeout(120000)
    });
    if (!upload.ok) {
      const errText = await upload.text();
      throw new Error(`CDN upload failed: ${upload.status} ${errText}`);
    }
    const uploadData: any = await upload.json();
    const fn = uploadData?.url?.split("/").pop();
    const cdnUrl = fn ? `https://cdn.izukaprivate.my.id/cdn/${fn}` : null;
    if (cdnUrl && typeof cdnUrl === "string" && cdnUrl.startsWith("http")) {
      cdnCache.set(audioUrl, cdnUrl);
      if (cdnCache.size > 100) {
        const firstKey = cdnCache.keys().next().value;
        if (firstKey) cdnCache.delete(firstKey);
      }
      return cdnUrl;
    }
    throw new Error("No CDN URL in response");
  } catch (err) {
    console.warn("[CDN] Upload failed:", err);
    return audioUrl;
  }
}

// ===== YOUTUBE SEARCH =====
async function searchYouTube(q: string): Promise<Song[]> {
  const cacheKey = `yt:${q}`;
  const cached = cacheGet(searchCache, cacheKey);
  if (cached) return cached;

  const apis = [
    async () => {
      const d = await fetchJSON(`https://prexzyapis.com/search/youtube`, 15000, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q })
      });
      if (d?.status && d?.data) {
        const items = Array.isArray(d.data) ? d.data : [];
        return items.slice(0, 15).map((item: any) => ({
          videoId: item.link?.match(/v=([A-Za-z0-9_-]{11})/)?.[1] || item.link?.match(/youtu\.be\/([A-Za-z0-9_-]{11})/)?.[1] || "",
          title: cleanTitle(item.title || ""),
          thumbnail: item.imageUrl || "",
          duration: item.duration || "0:00",
          url: item.link || "",
          source: "youtube",
          artist: item.channel || extractArtistFromTitle(item.title || "")
        }));
      }
      throw new Error("Invalid prexzyapis YT response");
    },
    async () => {
      const d = await fetchJSON(`https://api.cuki.biz.id/api/search/youtube?apikey=cuki-x&query=${encodeURIComponent(q)}&limit=15`);
      if (!d?.status && !d?.data) throw new Error("Invalid response");
      return ((d.data?.results || d.result || d.results || []).slice(0, 15)).map((item: any) => ({
        videoId: item.videoId || item.id || "",
        title: cleanTitle(item.title || ""),
        thumbnail: item.thumbnail || (item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : ""),
        duration: item.duration || "0:00",
        url: item.url || (item.videoId ? `https://youtu.be/${item.videoId}` : ""),
        source: "youtube",
        artist: item.channel || extractArtistFromTitle(item.title || "")
      }));
    },
    async () => {
      const d = await fetchJSON(`https://www.api-junzz.web.id/search/yts?query=${encodeURIComponent(q)}&limit=15`);
      if (!d?.status && !d?.result) throw new Error("Invalid response");
      return (d.result || []).slice(0, 15).map((item: any) => ({
        videoId: item.videoId || "",
        title: cleanTitle(item.title || ""),
        thumbnail: item.thumbnail || (item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : ""),
        duration: item.duration || "0:00",
        url: item.url || (item.videoId ? `https://youtu.be/${item.videoId}` : ""),
        source: "youtube",
        artist: item.channel || extractArtistFromTitle(item.title || "")
      }));
    },
    async () => {
      const d = await fetchJSON(`https://api.nexray.web.id/search/yt?q=${encodeURIComponent(q)}&limit=15`);
      if (!d?.status) throw new Error("Invalid response");
      return (d.result || []).slice(0, 15).map((item: any) => ({
        videoId: item.id || item.videoId || "",
        title: cleanTitle(item.title || ""),
        thumbnail: item.thumbnail || (item.id ? `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg` : ""),
        duration: item.duration ? (typeof item.duration === "number" ? secToTimestamp(item.duration) : item.duration) : "0:00",
        url: item.url || (item.id ? `https://youtu.be/${item.id}` : ""),
        source: "youtube",
        artist: item.channel?.name || item.channel || extractArtistFromTitle(item.title || "")
      }));
    }
  ];

  for (const api of apis) {
    try {
      const results = await api();
      if (results.length > 0) {
        const filtered = results.filter((s: Song) => s.videoId && s.title);
        if (filtered.length > 0) {
          cacheSet(searchCache, cacheKey, filtered, 10 * 60 * 1000);
          return filtered;
        }
      }
    } catch (err) {
      console.warn(`[YT Search] API failed:`, (err as Error).message);
    }
  }
  return [];
}

// ===== YOUTUBE DOWNLOAD =====
async function downloadYouTube(url: string): Promise<{ downloadUrl: string; title: string; thumbnail: string; artist: string }> {
  const cacheKey = `ytdl:${url}`;
  const cached = cacheGet(downloadCache, cacheKey);
  if (cached) return cached;

  const apis = [
    async () => {
      const d = await fetchJSON(`https://api.nexray.web.id/downloader/ytmp3?url=${encodeURIComponent(url)}`, 25000);
      if (!d?.status || !d?.result?.url) throw new Error("No download URL");
      return { downloadUrl: d.result.url, title: cleanTitle(d.result?.title || ""), thumbnail: d.result?.thumbnail || "", artist: d.result?.channel || "" };
    },
    async () => {
      const d = await fetchJSON(`https://api.cuki.biz.id/api/downloader/ytmp3?apikey=cuki-x&url=${encodeURIComponent(url)}&quality=192`, 30000);
      if (!d?.success && !d?.status) throw new Error("Failed");
      const metadata = d?.data?.metadata || {};
      const audio = d?.data?.audio || d?.data || {};
      const dlUrl = audio?.download?.downloadUrl || audio?.url || audio?.download_url || "";
      if (!dlUrl) throw new Error("No download URL");
      return { downloadUrl: dlUrl, title: cleanTitle(metadata.title || audio.title || ""), thumbnail: metadata.thumbnail || audio.thumbnail || "", artist: metadata.channel || audio.channel || extractArtistFromTitle(metadata.title || "") };
    },
    async () => {
      const d = await fetchJSON(`https://apii.kelvdra.my.id/api/download/ytmp3?url=${encodeURIComponent(url)}&bitrate=128&apikey=akaanakbaik`, 25000);
      if (!d?.status || !d?.download?.url) throw new Error("No download URL");
      return { downloadUrl: d.download.url, title: cleanTitle(d.metadata?.title || ""), thumbnail: d.metadata?.thumbnail || d.metadata?.image || "", artist: d.metadata?.author?.name || d.metadata?.channel || "" };
    }
  ];

  for (const api of apis) {
    try {
      const result = await api();
      if (result.downloadUrl) {
        cacheSet(downloadCache, cacheKey, result, 5 * 60 * 60 * 1000);
        const videoId = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1] || Date.now().toString();
        uploadToCDN(result.downloadUrl, videoId).catch(() => {});
        return result;
      }
    } catch (err) {
      console.warn(`[YT Download] API failed:`, (err as Error).message);
    }
  }
  throw new Error("Download YouTube gagal. Coba lagi.");
}

// ===== SPOTIFY SEARCH =====
async function searchSpotify(q: string): Promise<Song[]> {
  const cacheKey = `sp:${q}`;
  const cached = cacheGet(searchCache, cacheKey);
  if (cached) return cached;

  const apis = [
    async () => {
      const d = await fetchJSON(`https://api.xrizal.my.id/api/search/spotify-search?query=${encodeURIComponent(q)}`, 15000);
      if (d?.status && d?.result) {
        return (d.result as any[]).slice(0, 20).map((item: any) => ({
          videoId: item.url?.split("/track/")[1]?.split("?")[0] || Math.random().toString(36).slice(2),
          title: item.title || "", thumbnail: item.thumb || item.image || "",
          duration: item.duration || "0:00", url: item.url || "", source: "spotify",
          artist: item.artist || "Spotify", album: "", releaseDate: ""
        }));
      }
      throw new Error("Invalid response from xrizal");
    },
    async () => {
      const d = await fetchJSON(`https://api.nexray.web.id/search/spotify?q=${encodeURIComponent(q)}&limit=20`);
      if (!d?.status) throw new Error("Failed");
      return (d.result || []).slice(0, 20).map((item: any) => ({
        videoId: item.url?.split("/track/")[1]?.split("?")[0] || item.id || Math.random().toString(36).slice(2),
        title: item.title || item.name || "", thumbnail: item.thumbnail || item.image || item.cover || "",
        duration: item.duration || "0:00", url: item.url || "", source: "spotify",
        artist: item.artist || item.artists?.[0] || "Spotify", album: item.album || "", releaseDate: item.release_date || ""
      }));
    },
    async () => {
      const d = await fetchJSON(`https://api.cuki.biz.id/api/search/spotify?apikey=cuki-x&query=${encodeURIComponent(q)}&limit=20`);
      if (!d?.status && !d?.data) throw new Error("Failed");
      return ((d.data?.results || d.result || []).slice(0, 20)).map((item: any) => ({
        videoId: item.url?.split("/track/")[1]?.split("?")[0] || Math.random().toString(36).slice(2),
        title: item.title || item.name || "", thumbnail: item.thumbnail || item.image || "",
        duration: item.duration || "0:00", url: item.url || item.link || "", source: "spotify",
        artist: item.artist || item.artists || "Spotify", album: item.album || ""
      }));
    }
  ];

  for (const api of apis) {
    try {
      const results = await api();
      if (results.length > 0) {
        const filtered = results.filter((s: Song) => s.title && s.url);
        if (filtered.length > 0) { cacheSet(searchCache, cacheKey, filtered, 15 * 60 * 1000); return filtered; }
      }
    } catch (err) { console.warn(`[Spotify Search] API failed:`, (err as Error).message); }
  }
  return [];
}

// ===== SPOTIFY DOWNLOAD =====
async function downloadSpotify(url: string): Promise<{ downloadUrl: string; title: string; thumbnail: string; artist: string; album: string }> {
  const cacheKey = `spdl:${url}`;
  const cached = cacheGet(downloadCache, cacheKey);
  if (cached) return cached;

  const apis = [
    async () => {
      const d = await fetchJSON(`https://api.mifinfinity.my.id/api/downloader/Spotifydl?url=${encodeURIComponent(url)}`, 30000);
      if (d?.data?.url || d?.result?.url || d?.url) {
        const data = d.data || d.result || d;
        return { downloadUrl: data.url || data.download_url || "", title: data.title || data.name || "", thumbnail: data.thumbnail || data.image || data.cover || "", artist: data.artist || data.artists || "", album: data.album || "" };
      }
      throw new Error("No download URL");
    },
    async () => {
      const d = await fetchJSON(`https://api.nexray.web.id/downloader/spotify?url=${encodeURIComponent(url)}`, 30000);
      if (!d?.status || !d?.result?.url) throw new Error("No URL");
      return { downloadUrl: d.result.url, title: d.result.title || "", thumbnail: d.result.thumbnail || d.result.image || "", artist: d.result.artist || "", album: d.result.album || "" };
    },
    async () => {
      const d = await fetchJSON(`https://api.cuki.biz.id/api/downloader/spotify?apikey=cuki-x&url=${encodeURIComponent(url)}`, 30000);
      if ((!d?.status && !d?.success) || !d?.data?.url) throw new Error("No URL");
      return { downloadUrl: d.data.url, title: d.data.title || "", thumbnail: d.data.thumbnail || d.data.image || "", artist: d.data.artist || d.data.artists || "", album: d.data.album || "" };
    }
  ];

  for (const api of apis) {
    try {
      const result = await api();
      if (result.downloadUrl) {
        cacheSet(downloadCache, cacheKey, result, 5 * 60 * 60 * 1000);
        const trackId = url.split("/track/")[1]?.split("?")[0] || Date.now().toString();
        uploadToCDN(result.downloadUrl, `sp-${trackId}`).catch(() => {});
        return result;
      }
    } catch (err) { console.warn(`[Spotify DL] API failed:`, (err as Error).message); }
  }
  throw new Error("Download Spotify gagal.");
}

// ===== APPLE MUSIC SEARCH =====
async function searchAppleMusic(q: string): Promise<Song[]> {
  const cacheKey = `am:${q}`;
  const cached = cacheGet(searchCache, cacheKey);
  if (cached) return cached;

  const apis = [
    async () => {
      const d = await fetchJSON(`https://api.siputzx.my.id/api/s/applemusic?query=${encodeURIComponent(q)}&region=id`, 15000);
      if (d?.status && d?.data) {
        const items = Array.isArray(d.data) ? d.data : [];
        return items.slice(0, 20).map((item: any) => {
          const songId = item.link?.split("/song/")[1]?.split("?")[0] || item.link?.match(/i=(\d+)/)?.[1] || String(Math.random()).slice(2);
          const artistRaw = item.artist || "";
          const parts = artistRaw.split(" · ");
          const artist = parts.length > 1 ? parts[1] : (parts[0] !== "Song" ? parts[0] : "Apple Music");
          return { videoId: songId, title: item.title || "", thumbnail: item.image || "", duration: "0:00", url: item.link || "", source: "apple", artist: artist || "Apple Music", album: "" };
        });
      }
      throw new Error("Invalid siputzx response");
    },
    async () => {
      const d = await fetchJSON(`https://prexzyapis.com/search/applemusic`, 15000, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q })
      });
      if (d?.data || d?.result || d?.results) {
        const items = d.data?.data || d.data || d.result || d.results || [];
        return (Array.isArray(items) ? items : []).slice(0, 20).map((item: any) => ({
          videoId: item.id || Math.random().toString(36).slice(2), title: item.title || item.name || "",
          thumbnail: item.thumbnail || item.image || item.artwork || "", duration: item.duration || "0:00",
          url: item.url || item.link || "", source: "apple", artist: item.artist || item.artists || "Apple Music", album: item.album || ""
        }));
      }
      throw new Error("Invalid prexzyapis response");
    },
    async () => {
      const d = await fetchJSON(`https://api.cuki.biz.id/api/search/amusic?apikey=cuki-x&query=${encodeURIComponent(q)}&region=id&limit=20`);
      if (!d?.status && !d?.data) throw new Error("Failed");
      return ((d.data?.results || d.result || []).slice(0, 20)).map((item: any) => ({
        videoId: item.link?.split("/song/")[1]?.split("?")[0] || item.link?.match(/i=(\d+)/)?.[1] || item.id || Math.random().toString(36).slice(2),
        title: item.title || item.name || "", thumbnail: item.image || item.thumbnail || "",
        duration: item.duration ? msToTimestamp(item.duration) : "0:00",
        url: item.link || item.url || "", source: "apple", artist: (item.artist || "").split(" · ").slice(1).join(" · ") || "Apple Music", album: item.album || ""
      }));
    },
    async () => {
      const d = await fetchJSON(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=15&country=id`);
      return (d.results || []).slice(0, 15).map((item: any) => ({
        videoId: String(item.trackId || Math.random().toString(36).slice(2)), title: item.trackName || "",
        thumbnail: item.artworkUrl100?.replace("100x100", "300x300") || "", duration: item.trackTimeMillis ? msToTimestamp(item.trackTimeMillis) : "0:00",
        url: item.trackViewUrl || "", source: "apple", artist: item.artistName || "Apple Music", album: item.collectionName || ""
      }));
    }
  ];

  for (const api of apis) {
    try {
      const results = await api();
      if (results.length > 0) {
        const filtered = results.filter((s: Song) => s.title && s.url);
        if (filtered.length > 0) { cacheSet(searchCache, cacheKey, filtered, 15 * 60 * 1000); return filtered; }
      }
    } catch (err) { console.warn(`[Apple Search] API failed:`, (err as Error).message); }
  }
  return [];
}

async function downloadAppleMusic(url: string): Promise<{ downloadUrl: string; title: string; thumbnail: string; artist: string; album: string }> {
  const cacheKey = `amdl:${url}`;
  const cached = cacheGet(downloadCache, cacheKey);
  if (cached) return cached;
  const d = await fetchJSON(`https://api.cuki.biz.id/api/downloader/musicapple?apikey=cuki-x&url=${encodeURIComponent(url)}`, 25000);
  if (!d?.success && !d?.status) throw new Error("Apple Music download failed");
  const data = d.data || d.result;
  const downloadUrl = data?.preview || data?.url || data?.download_url;
  if (!downloadUrl) throw new Error("No playable URL found");
  const result = { downloadUrl, title: data.title || data.name || "", thumbnail: data.cover || data.thumbnail || data.image || "", artist: data.artist || data.artists || "Apple Music", album: data.album || "" };
  cacheSet(downloadCache, cacheKey, result, 6 * 60 * 60 * 1000);
  return result;
}

async function searchSoundCloud(q: string): Promise<Song[]> {
  const cacheKey = `sc:${q}`;
  const cached = cacheGet(searchCache, cacheKey);
  if (cached) return cached;

  const apis = [
    async () => {
      const d = await fetchJSON(`https://api.siputzx.my.id/api/s/soundcloud?query=${encodeURIComponent(q)}`, 15000);
      if (d?.status && d?.data) {
        const items = Array.isArray(d.data) ? d.data : [];
        return items.slice(0, 15).map((item: any) => ({
          videoId: String(item.permalink || item.permalink_url?.split("/").filter(Boolean).pop() || Math.random().toString(36).slice(2)),
          title: item.permalink?.replace(/-/g, " ") || "",
          thumbnail: item.artwork_url?.replace("-large", "-t300x300") || "",
          duration: item.duration ? msToTimestamp(item.duration) : "0:00",
          url: item.permalink_url || "", source: "soundcloud",
          artist: item.permalink_url?.split("/").filter(Boolean)[1] || "SoundCloud"
        }));
      }
      throw new Error("Invalid siputzx SC response");
    },
    async () => {
      const d = await fetchJSON(`https://api.cuki.biz.id/api/search/soundcloud?apikey=cuki-x&query=${encodeURIComponent(q)}&limit=15`);
      if (!d?.status && !d?.data) throw new Error("Failed");
      return ((d.data?.results || d.result || []).slice(0, 15)).map((item: any) => ({
        videoId: String(item.id || item.permalink_url?.split("/").filter(Boolean).pop() || Math.random().toString(36).slice(2)),
        title: item.title || item.permalink || item.permalink_url?.split("/").pop()?.replace(/-/g, " ") || "",
        thumbnail: item.artwork_url?.replace("-large", "-t300x300") || item.thumbnail || "",
        duration: item.duration ? msToTimestamp(item.duration) : item.full_duration ? msToTimestamp(item.full_duration) : "0:00",
        url: item.permalink_url || item.url || "", source: "soundcloud",
        artist: item.user?.username || item.user || item.username || item.permalink_url?.split("/").filter(Boolean)[1] || "SoundCloud"
      }));
    }
  ];

  for (const api of apis) {
    try {
      const results = await api();
      if (results.length > 0) {
        const filtered = results.filter((s: Song) => s.title && s.url);
        if (filtered.length > 0) { cacheSet(searchCache, cacheKey, filtered, 15 * 60 * 1000); return filtered; }
      }
    } catch (err) { console.warn(`[SC Search] API failed:`, (err as Error).message); }
  }
  return [];
}

async function downloadSoundCloud(url: string): Promise<{ downloadUrl: string; title: string; thumbnail: string; artist: string }> {
  const cacheKey = `scdl:${url}`;
  const cached = cacheGet(downloadCache, cacheKey);
  if (cached) return cached;
  try {
    const d = await fetchJSON(`https://prexzyapis.com/download/soundcloud`, 25000, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url })
    });
    if (d?.data?.url || d?.result?.url || d?.url) {
      const data = d.data || d.result || d;
      if (data.url) {
        const result = { downloadUrl: data.url, title: data.title || "", thumbnail: data.thumbnail || data.artwork_url || "", artist: data.user || data.artist || "SoundCloud" };
        cacheSet(downloadCache, cacheKey, result, 6 * 60 * 60 * 1000);
        return result;
      }
    }
  } catch { /* fall through */ }
  const d = await fetchJSON(`https://api.cuki.biz.id/api/downloader/soundcloud?apikey=cuki-x&url=${encodeURIComponent(url)}`, 25000);
  if (!d?.success && !d?.status) throw new Error("SoundCloud download failed");
  const data = d.data || d.result;
  const downloadUrl = data?.url || data?.download_url;
  if (!downloadUrl) throw new Error("No download URL");
  const result = { downloadUrl, title: data.title || "", thumbnail: data.thumbnail || data.artwork_url || "", artist: data.user || data.artist || "SoundCloud" };
  cacheSet(downloadCache, cacheKey, result, 6 * 60 * 60 * 1000);
  uploadToCDN(downloadUrl, `sc-${Date.now()}`).catch(() => {});
  return result;
}

// ===== RECOMMENDATIONS =====
const recQueries = [
  "top hits 2025", "viral songs", "trending music", "lagu hits Indonesia",
  "best pop songs", "k-pop hits", "lo-fi beats", "rock classics",
  "chill vibes", "acoustic covers", "indonesian pop", "jazz relaxation",
  "hip hop 2025", "electronic dance", "rnb soul"
];

router.get("/music/recommendations", async (req: Request, res: Response) => {
  const cacheKey = "recs";
  const cached = cacheGet(searchCache, cacheKey);
  if (cached) return res.json({ success: true, results: cached, source: "cache" });

  try {
    const query = recQueries[Math.floor(Math.random() * recQueries.length)];
    console.log(`[Recommendations] Searching: "${query}"`);
    const results = await searchYouTube(query);
    if (results.length > 0) {
      cacheSet(searchCache, cacheKey, results, 30 * 60 * 1000);
      return res.json({ success: true, results, source: query });
    }
    // If no results, try Spotify as fallback
    const spotifyResults = await searchSpotify(query);
    if (spotifyResults.length > 0) {
      cacheSet(searchCache, cacheKey, spotifyResults, 30 * 60 * 1000);
      return res.json({ success: true, results: spotifyResults, source: query });
    }
    // Ultimate fallback: return hardcoded songs
    console.warn("[Recommendations] All APIs failed, using fallback data");
    const fallback = getFallbackSongs(12);
    return res.json({ success: true, results: fallback, source: "fallback" });
  } catch (err: any) {
    console.error("[Recommendations] Error:", err.message);
    // Always return fallback data to prevent app from breaking
    return res.json({ success: true, results: getFallbackSongs(12), source: "fallback" });
  }
});

// ===== SEARCH ROUTE =====
router.get("/music/search", async (req: Request, res: Response) => {
  const { q, source = "all" } = req.query as { q: string; source?: string };
  if (!q?.trim()) return res.status(400).json({ success: false, error: "q is required" });

  const results: Record<string, Song[]> = {};
  const sources = source === "all"
    ? ["youtube", "spotify", "apple", "soundcloud"]
    : source.split(",").map((s: string) => s.trim()).filter(Boolean);
  
  const fetchers: Record<string, () => Promise<Song[]>> = {
    youtube: () => searchYouTube(q), spotify: () => searchSpotify(q),
    apple: () => searchAppleMusic(q), soundcloud: () => searchSoundCloud(q)
  };

  const fns = fetchers as Record<string, () => Promise<Song[]>>;
  for (let i = 0; i < sources.length; i++) {
    const src: string = sources[i];
    const fn = fns[src as string];
    if (fn) {
      try { results[src as string] = await fn(); }
      catch { results[src as string] = []; }
    }
  }

  const totalResults = Object.values(results).reduce((sum: number, arr: Song[]) => sum + arr.length, 0);
  res.json({ success: true, results, query: q, total: totalResults });
});

router.get("/music/search/:source", async (req: Request, res: Response) => {
  const source: string = req.params.source as string;
  const { q } = req.query as { q: string };
  if (!q?.trim()) return res.status(400).json({ success: false, error: "q is required" });

  const searchFns: Record<string, () => Promise<Song[]>> = {
    youtube: () => searchYouTube(q), spotify: () => searchSpotify(q),
    apple: () => searchAppleMusic(q), soundcloud: () => searchSoundCloud(q)
  };

  const fn = (searchFns as any)[source];
  if (!fn) return res.status(400).json({ success: false, error: `Unknown source: ${source}` });

  try {
    const results = await fn();
    res.json({ success: true, source, results, query: q });
  } catch (e: any) {
    res.json({ success: false, source, results: [], error: e.message, query: q });
  }
});

// ===== DOWNLOAD =====
router.get("/music/download", async (req: Request, res: Response) => {
  const { url, source = "youtube", q } = req.query as { url?: string; source?: string; q?: string };
  try {
    let downloadUrl = "", title = "", thumbnail = "", artist = "", album = "";

    if (source === "youtube" && url) {
      const r = await downloadYouTube(url);
      downloadUrl = r.downloadUrl; title = r.title; thumbnail = r.thumbnail; artist = r.artist;
    } else if (source === "spotify" && url) {
      const r = await downloadSpotify(url);
      downloadUrl = r.downloadUrl; title = r.title; thumbnail = r.thumbnail; artist = r.artist; album = r.album;
    } else if (source === "apple" && url) {
      const r = await downloadAppleMusic(url);
      downloadUrl = r.downloadUrl; title = r.title; thumbnail = r.thumbnail; artist = r.artist; album = r.album;
    } else if (source === "soundcloud" && url) {
      const r = await downloadSoundCloud(url);
      downloadUrl = r.downloadUrl; title = r.title; thumbnail = r.thumbnail; artist = r.artist;
    } else {
      return res.status(400).json({ success: false, error: "URL diperlukan" });
    }

    if (!downloadUrl) return res.status(404).json({ success: false, error: "Tidak ada URL audio ditemukan" });
    res.json({ success: true, download_url: downloadUrl, title, thumbnail, artist, album, source });
  } catch (err: any) {
    console.error(`[Download] ${source} error:`, err.message);
    res.status(500).json({ success: false, error: err.message || "Download gagal" });
  }
});

// ===== PREPARE =====
interface PrepareEntry { streamUrl: string; cdnUrl: string | null; expires: number; }
const prepareCache = new Map<string, PrepareEntry>();

router.get("/music/prepare", async (req: Request, res: Response) => {
  const { url, source = "youtube", videoId } = req.query as { url?: string; source?: string; videoId?: string };
  if (!url) return res.status(400).json({ success: false, error: "url is required" });

  const cacheKey = `${source}:${videoId || url}`;
  const cached = prepareCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) {
    return res.json({ success: true, stream_url: cached.streamUrl, cdn_url: cached.cdnUrl, cached: true });
  }

  try {
    let rawUrl = "", title = "", thumbnail = "", artist = "", album = "";

    if (source === "youtube") { const r = await downloadYouTube(url); rawUrl = r.downloadUrl; title = r.title; thumbnail = r.thumbnail; artist = r.artist; }
    else if (source === "spotify") { const r = await downloadSpotify(url); rawUrl = r.downloadUrl; title = r.title; thumbnail = r.thumbnail; artist = r.artist; album = r.album; }
    else if (source === "apple") { const r = await downloadAppleMusic(url); rawUrl = r.downloadUrl; title = r.title; thumbnail = r.thumbnail; artist = r.artist; album = r.album; }
    else if (source === "soundcloud") { const r = await downloadSoundCloud(url); rawUrl = r.downloadUrl; title = r.title; thumbnail = r.thumbnail; artist = r.artist; }
    else return res.status(400).json({ success: false, error: `Unknown source: ${source}` });

    if (!rawUrl) throw new Error("Could not get audio URL from source");

    const streamUrl = `/api/music/stream?url=${encodeURIComponent(rawUrl)}`;
    const existingCdn = cdnCache.get(rawUrl);

    if (!existingCdn) {
      const slug = (videoId || `${source}-${Date.now()}`).replace(/[^a-z0-9]/gi, "-").slice(0, 40);
      uploadToCDN(rawUrl, slug).catch(() => {});
    }

    const entry: PrepareEntry = { streamUrl, cdnUrl: existingCdn || null, expires: Date.now() + 5 * 60 * 60 * 1000 };
    if (prepareCache.size > 100) { const oldKey = prepareCache.keys().next().value; if (oldKey) prepareCache.delete(oldKey); }
    prepareCache.set(cacheKey, entry);

    return res.json({ success: true, stream_url: streamUrl, cdn_url: existingCdn || null, title, artist, thumbnail, album, source, via_cdn: !!existingCdn });
  } catch (err: any) {
    console.error(`[Prepare] ${source} error:`, err.message);
    res.status(500).json({ success: false, error: err.message || "Gagal menyiapkan lagu" });
  }
});

// ===== STREAM PROXY =====
router.get("/music/stream", async (req: Request, res: Response) => {
  const { url } = req.query as { url: string };
  if (!url) return res.status(400).json({ error: "url is required" });

  try {
    const targetUrl = url;
    const rangeHeader = req.headers.range;
    const upstreamHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
      "Accept": "audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,*/*;q=0.5",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
      "Referer": "https://www.youtube.com/"
    };
    if (rangeHeader) upstreamHeaders["Range"] = rangeHeader;

    const upstream = await fetch(targetUrl, { headers: upstreamHeaders, signal: AbortSignal.timeout(30000) });
    if (!upstream.ok && upstream.status !== 206) return res.status(502).json({ error: `Upstream ${upstream.status}: ${upstream.statusText}` });
    if (!upstream.body) return res.status(502).json({ error: "No upstream body" });

    const contentType = upstream.headers.get("content-type") || "audio/mpeg";
    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Range");
    res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");

    if (contentRange) {
      res.status(206);
      res.setHeader("Content-Range", contentRange);
    } else {
      res.status(200);
    }
    if (contentLength) res.setHeader("Content-Length", contentLength);

    // Pipe the response body directly for streaming
    if (typeof (upstream.body as any).pipe === 'function') {
      (upstream.body as any).pipe(res);
    } else {
      const reader = upstream.body.getReader();
      const processStream = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); return; }
          res.write(Buffer.from(value));
        }
      };
      processStream().catch((err: any) => {
        console.error("[Stream] Error:", err.message);
        if (!res.headersSent) res.end();
      });
    }
  } catch (err: any) {
    console.error("[Stream] Error:", err.message);
    if (!res.headersSent) res.status(502).json({ error: "Stream failed" });
    else res.end();
  }
});

router.get("/music/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", uptime: `${Math.floor(process.uptime())}s` });
});

export default router;
