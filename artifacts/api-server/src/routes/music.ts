import { Router, type IRouter } from "express";

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

async function fetchJSON(url: string, timeout = 20000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 musika/1.0" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

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

// ===== YOUTUBE SEARCH =====
async function searchYouTube(q: string): Promise<Song[]> {
  const data = await fetchJSON(
    `https://www.api-junzz.web.id/search/yts?query=${encodeURIComponent(q)}&limit=10`
  );
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

// ===== SPOTIFY SEARCH =====
async function searchSpotify(q: string): Promise<Song[]> {
  const data = await fetchJSON(
    `https://api.nexray.web.id/search/spotify?q=${encodeURIComponent(q)}`
  );
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

// ===== APPLE MUSIC SEARCH =====
async function searchAppleMusic(q: string): Promise<Song[]> {
  const data = await fetchJSON(
    `https://api.cuki.biz.id/api/search/amusic?apikey=cuki-x&query=${encodeURIComponent(q)}&region=id`
  );
  if (!data?.status) throw new Error("Apple Music search failed");
  return (data.data?.results || []).slice(0, 10).map((item: any) => ({
    videoId: item.link?.split("/song/")[1]?.split("?")[0] ||
      item.link?.match(/i=(\d+)/)?.[1] ||
      Math.random().toString(36).slice(2),
    title: item.title || "",
    thumbnail: item.image || "",
    duration: "0:00",
    url: item.link || "",
    source: "apple",
    artist: parseAppleArtist(item.artist || "")
  }));
}

// ===== SOUNDCLOUD SEARCH =====
async function searchSoundCloud(q: string): Promise<Song[]> {
  const data = await fetchJSON(
    `https://api.cuki.biz.id/api/search/soundcloud?apikey=cuki-x&query=${encodeURIComponent(q)}`
  );
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

// ===== MULTI-SOURCE SEARCH =====
router.get("/music/search", async (req, res) => {
  const { q, source = "all" } = req.query as { q: string; source?: string };
  if (!q) return res.status(400).json({ error: "q is required" });

  const selectedSources = source === "all"
    ? ["youtube", "spotify", "apple", "soundcloud"]
    : source.split(",").filter(Boolean);

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

  res.json({ success: true, results, errors, query: q });
});

// ===== DOWNLOAD / GET PLAY URL =====
router.get("/music/download", async (req, res) => {
  const { url, source = "youtube", q } = req.query as {
    url?: string;
    source?: string;
    q?: string;
  };

  try {
    let downloadUrl = "";
    let title = "";
    let thumbnail = "";
    let artist = "";
    let album = "";

    if (source === "youtube" && url) {
      // Only use kelvdra (junzz downloader times out)
      const data = await fetchJSON(
        `https://apii.kelvdra.my.id/api/download/ytmp3?url=${encodeURIComponent(url)}&bitrate=128&apikey=akaanakbaik`
      );
      if (!data?.status) throw new Error("YouTube download failed");
      downloadUrl = data.download?.url || "";
      title = data.metadata?.title || "";
      thumbnail = data.metadata?.thumbnail || data.metadata?.image || "";
      artist = data.metadata?.author?.name || "";
    } else if (source === "spotify" && url) {
      // Spotify URL → download
      const data = await fetchJSON(
        `https://api.nexray.web.id/downloader/spotify?url=${encodeURIComponent(url)}`
      );
      if (!data?.status) throw new Error("Spotify download failed");
      downloadUrl = data.result?.url || "";
      title = data.result?.title || "";
      artist = data.result?.artist || "";
    } else if (source === "spotify" && q) {
      // Spotify query → search + download in one call
      const data = await fetchJSON(
        `https://api.nexray.web.id/downloader/spotifyplay?q=${encodeURIComponent(q)}`
      );
      if (!data?.status) throw new Error("Spotify play download failed");
      downloadUrl = data.result?.download_url || "";
      title = data.result?.title || "";
      thumbnail = data.result?.thumbnail || "";
      artist = data.result?.artist || "";
      album = data.result?.album || "";
    } else if (source === "apple" && url) {
      // Apple Music URL → download/preview
      const data = await fetchJSON(
        `https://api.cuki.biz.id/api/downloader/musicapple?apikey=cuki-x&url=${encodeURIComponent(url)}`
      );
      if (!data?.success) throw new Error("Apple Music download failed");
      // preview = 30s preview AAC, url = apple music link — use preview for playback
      downloadUrl = data.data?.preview || data.data?.url || "";
      title = data.data?.title || "";
      thumbnail = data.data?.cover || "";
      artist = data.data?.artist || "";
      album = data.data?.album || "";
    } else if (source === "soundcloud" && url) {
      const data = await fetchJSON(
        `https://api.cuki.biz.id/api/downloader/soundcloud?apikey=cuki-x&url=${encodeURIComponent(url)}`
      );
      if (!data?.success) throw new Error("SoundCloud download failed");
      downloadUrl = data.data?.url || "";
      title = data.data?.title || "";
      thumbnail = data.data?.thumbnail || "";
      artist = data.data?.user || "";
    } else {
      return res.status(400).json({ success: false, error: "url or q is required" });
    }

    if (!downloadUrl) {
      return res.status(404).json({
        success: false,
        error: "No download URL found. Try again or use a different source."
      });
    }

    res.json({ success: true, download_url: downloadUrl, title, thumbnail, artist, album, source });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== STREAM PROXY =====
router.get("/music/stream", async (req, res) => {
  const { url } = req.query as { url: string };
  if (!url) return res.status(400).json({ error: "url is required" });

  try {
    const decodedUrl = decodeURIComponent(url);
    const upstream = await fetch(decodedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Range": req.headers.range || ""
      }
    });

    if (!upstream.ok || !upstream.body) {
      return res.status(502).json({ error: "Could not fetch audio stream" });
    }

    const contentType = upstream.headers.get("content-type") || "audio/mpeg";
    const contentLength = upstream.headers.get("content-length");
    const acceptRanges = upstream.headers.get("accept-ranges");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=3600");
    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);
    res.status(upstream.status);

    const reader = upstream.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); break; }
        if (!res.write(value)) {
          await new Promise(r => res.once("drain", r));
        }
      }
    };
    await pump();
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ===== RECOMMENDATIONS (trending YouTube) =====
router.get("/music/recommendations", async (_req, res) => {
  const queries = [
    "top hits 2024", "viral songs trending", "best pop 2024", "trending music",
    "Billboard hot 100", "lofi hip hop chill beats", "best rnb 2024", "indie pop hits",
    "summer hits", "top spotify songs 2024"
  ];
  const q = queries[Math.floor(Math.random() * queries.length)];
  try {
    const results = await searchYouTube(q);
    res.json({ success: true, results, query: q });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
