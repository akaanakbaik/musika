export const config = { maxDuration: 30 };

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url, { headers: { "User-Agent": "musika/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { url, source = "youtube", q } = req.query;

  try {
    let downloadUrl = "", title = "", thumbnail = "", artist = "", album = "";

    if (source === "youtube" && url) {
      const data = await fetchJSON(`https://apii.kelvdra.my.id/api/download/ytmp3?url=${encodeURIComponent(url)}&bitrate=128&apikey=akaanakbaik`);
      if (!data?.status) throw new Error("YouTube download failed");
      downloadUrl = data.download?.url || "";
      title = data.metadata?.title || "";
      thumbnail = data.metadata?.thumbnail || data.metadata?.image || "";
      artist = data.metadata?.author?.name || "";
    } else if (source === "spotify" && url) {
      const data = await fetchJSON(`https://api.nexray.web.id/downloader/spotify?url=${encodeURIComponent(url)}`);
      if (!data?.status) throw new Error("Spotify download failed");
      downloadUrl = data.result?.url || "";
      title = data.result?.title || "";
      artist = data.result?.artist || "";
    } else if (source === "spotify" && q) {
      const data = await fetchJSON(`https://api.nexray.web.id/downloader/spotifyplay?q=${encodeURIComponent(q)}`);
      if (!data?.status) throw new Error("Spotify play download failed");
      downloadUrl = data.result?.download_url || "";
      title = data.result?.title || "";
      thumbnail = data.result?.thumbnail || "";
      artist = data.result?.artist || "";
      album = data.result?.album || "";
    } else if (source === "apple" && url) {
      const data = await fetchJSON(`https://api.cuki.biz.id/api/downloader/musicapple?apikey=cuki-x&url=${encodeURIComponent(url)}`);
      if (!data?.success) throw new Error("Apple Music download failed");
      downloadUrl = data.data?.preview || data.data?.url || "";
      title = data.data?.title || "";
      thumbnail = data.data?.cover || "";
      artist = data.data?.artist || "";
      album = data.data?.album || "";
    } else if (source === "soundcloud" && url) {
      const data = await fetchJSON(`https://api.cuki.biz.id/api/downloader/soundcloud?apikey=cuki-x&url=${encodeURIComponent(url)}`);
      if (!data?.success) throw new Error("SoundCloud download failed");
      downloadUrl = data.data?.url || "";
      title = data.data?.title || "";
      thumbnail = data.data?.thumbnail || "";
      artist = data.data?.user || "";
    } else {
      return res.status(400).json({ success: false, error: "url or q is required" });
    }

    if (!downloadUrl) {
      return res.status(404).json({ success: false, error: "No download URL found" });
    }

    res.json({ success: true, download_url: downloadUrl, title, thumbnail, artist, album, source });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
