import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface Song {
  videoId: string;
  title: string;
  thumbnail: string;
  duration: string;
  url: string;
  source: string;
  author: { name: string };
}

async function fetchJSON(url: string, timeout = 15000): Promise<any> {
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

function parseYTDuration(duration: any): string {
  if (typeof duration === "string") return duration;
  if (duration?.text) return duration.text;
  if (typeof duration === "number") {
    const m = Math.floor(duration / 60);
    const s = Math.floor(duration % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  return "0:00";
}

function parseMsDuration(ms: number): string {
  if (!ms) return "0:00";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ===== MULTI-SOURCE SEARCH =====
router.get("/music/search", async (req, res) => {
  const { q, source = "all" } = req.query as { q: string; source?: string };
  if (!q) return res.status(400).json({ error: "q is required" });

  const selectedSources = source === "all"
    ? ["youtube", "spotify", "apple", "soundcloud"]
    : source.split(",").filter(Boolean);

  const searchFns: Record<string, () => Promise<Song[]>> = {
    youtube: async () => {
      const data = await fetchJSON(`https://api.junzz.web.id/search/yts?q=${encodeURIComponent(q)}`);
      return (data?.result || data?.data || []).slice(0, 7).map((item: any) => ({
        videoId: item.videoId || item.id || "",
        title: item.title || "",
        thumbnail: item.thumbnail?.url || item.thumbnail ||
          (item.videoId ? `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg` : ""),
        duration: parseYTDuration(item.duration),
        url: item.url || (item.videoId ? `https://www.youtube.com/watch?v=${item.videoId}` : ""),
        source: "youtube",
        author: { name: item.channel?.name || item.author?.name || item.author || "YouTube" }
      }));
    },
    spotify: async () => {
      const data = await fetchJSON(`https://api.nexray.web.id/search/spotify?q=${encodeURIComponent(q)}`);
      const items = data?.result?.tracks?.items || data?.result || data?.tracks?.items || [];
      return items.slice(0, 10).map((item: any) => ({
        videoId: item.id || Math.random().toString(36).slice(2),
        title: item.name || item.title || "",
        thumbnail: item.album?.images?.[0]?.url || item.image || item.thumbnail || "",
        duration: parseMsDuration(item.duration_ms),
        url: item.external_urls?.spotify || item.url || "",
        source: "spotify",
        author: { name: item.artists?.map((a: any) => a.name).join(", ") || item.artist || "Spotify" }
      }));
    },
    apple: async () => {
      const data = await fetchJSON(`https://api.cuki.biz.id/api/search/amusic?apikey=cuki-x&query=${encodeURIComponent(q)}&region=id`);
      return (data?.result || data?.data || []).slice(0, 7).map((item: any) => ({
        videoId: String(item.id || item.trackId || Math.random().toString(36).slice(2)),
        title: item.name || item.trackName || item.title || "",
        thumbnail: item.artworkUrl100 || item.artwork?.url?.replace("{w}x{h}", "300x300") ||
          item.artworkUrl60 || "",
        duration: parseMsDuration(item.durationInMillis),
        url: item.url || item.trackViewUrl || "",
        source: "apple",
        author: { name: item.artistName || item.artist || "Apple Music" }
      }));
    },
    soundcloud: async () => {
      const data = await fetchJSON(`https://api.cuki.biz.id/api/search/soundcloud?apikey=cuki-x&query=${encodeURIComponent(q)}`);
      return (data?.result || data?.data || []).slice(0, 6).map((item: any) => ({
        videoId: String(item.id || Math.random().toString(36).slice(2)),
        title: item.title || "",
        thumbnail: item.artwork_url?.replace("-large", "-t300x300") || item.thumbnail || "",
        duration: item.duration ? parseMsDuration(item.duration) : "0:00",
        url: item.permalink_url || item.url || "",
        source: "soundcloud",
        author: { name: item.user?.username || item.artist || "SoundCloud" }
      }));
    }
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

// ===== DOWNLOAD =====
router.get("/music/download", async (req, res) => {
  const { url, source = "youtube", q } = req.query as { url?: string; source?: string; q?: string };

  try {
    let downloadUrl = "";
    let title = "";
    let thumbnail = "";
    let artist = "";

    if (source === "youtube" && url) {
      try {
        const data = await fetchJSON(`https://api.junzz.web.id/download/ytmp3?url=${encodeURIComponent(url)}`);
        downloadUrl = data?.result?.url || data?.download?.url || data?.url || "";
        title = data?.result?.title || data?.title || "";
        thumbnail = data?.result?.thumbnail || data?.thumbnail || "";
        artist = data?.result?.author || "";
      } catch {
        const data = await fetchJSON(`https://apii.kelvdra.my.id/api/download/ytmp3?url=${encodeURIComponent(url)}&bitrate=128&apikey=akaanakbaik`);
        downloadUrl = data?.result?.url || data?.url || data?.download?.url || "";
        title = data?.result?.title || data?.title || "";
        thumbnail = data?.result?.image || data?.thumbnail || "";
        artist = data?.result?.channel || "";
      }
    } else if (source === "spotify" && url) {
      const data = await fetchJSON(`https://api.nexray.web.id/downloader/spotify?url=${encodeURIComponent(url)}`);
      downloadUrl = data?.result?.download_url || data?.download_url || data?.result?.url || data?.url || "";
      title = data?.result?.title || data?.title || "";
      thumbnail = data?.result?.cover || data?.result?.thumbnail || data?.thumbnail || "";
      artist = data?.result?.artist || "";
    } else if (source === "spotify" && q) {
      const data = await fetchJSON(`https://api.nexray.web.id/downloader/spotifyplay?q=${encodeURIComponent(q)}`);
      downloadUrl = data?.result?.download_url || data?.download_url || data?.result?.url || "";
      title = data?.result?.title || data?.title || "";
      thumbnail = data?.result?.cover || "";
      artist = data?.result?.artist || "";
    } else if (source === "apple" && url) {
      const data = await fetchJSON(`https://api.cuki.biz.id/api/downloader/musicapple?apikey=cuki-x&url=${encodeURIComponent(url)}`);
      downloadUrl = data?.result?.download || data?.result?.url || data?.download_url || data?.url || "";
      title = data?.result?.title || data?.title || "";
      thumbnail = data?.result?.thumbnail || data?.thumbnail || "";
      artist = data?.result?.artist || "";
    } else if (source === "soundcloud" && url) {
      const data = await fetchJSON(`https://api.cuki.biz.id/api/downloader/soundcloud?apikey=cuki-x&url=${encodeURIComponent(url)}`);
      downloadUrl = data?.result?.download || data?.result?.url || data?.download_url || data?.url || "";
      title = data?.result?.title || data?.title || "";
      thumbnail = data?.result?.thumbnail || data?.thumbnail || "";
      artist = data?.result?.artist || data?.result?.author || "";
    } else {
      return res.status(400).json({ success: false, error: "url or q is required" });
    }

    if (!downloadUrl) {
      return res.status(404).json({ success: false, error: "No download URL found. Try again or use a different source." });
    }

    res.json({ success: true, download_url: downloadUrl, title, thumbnail, artist, source });
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

// ===== RECOMMENDATIONS =====
router.get("/music/recommendations", async (_req, res) => {
  const queries = [
    "top hits 2024", "viral songs 2024", "best pop music", "trending music now",
    "Billboard hot 100", "lofi hip hop chill", "best rnb 2024", "indie pop 2024",
    "summer hits 2024", "top spotify songs"
  ];
  const q = queries[Math.floor(Math.random() * queries.length)];
  try {
    const data = await fetchJSON(`https://api.junzz.web.id/search/yts?q=${encodeURIComponent(q)}`);
    const results = (data?.result || data?.data || []).slice(0, 10).map((item: any) => ({
      videoId: item.videoId || item.id || "",
      title: item.title || "",
      thumbnail: item.thumbnail?.url || item.thumbnail ||
        (item.videoId ? `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg` : ""),
      duration: parseYTDuration(item.duration),
      url: item.url || (item.videoId ? `https://www.youtube.com/watch?v=${item.videoId}` : ""),
      source: "youtube",
      author: { name: item.channel?.name || item.author || "Unknown" }
    }));
    res.json({ success: true, results, query: q });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
