/// <reference lib="dom" />
export const config = { maxDuration: 30 };

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url, { headers: { "User-Agent": "musika/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default async function handler(_req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const queries = [
    "top hits 2024", "viral songs trending", "best pop 2024", "trending music",
    "Billboard hot 100", "lofi hip hop chill beats", "best rnb 2024", "indie pop hits",
    "summer hits", "top spotify songs 2024"
  ];
  const q = queries[Math.floor(Math.random() * queries.length)];

  try {
    const data = await fetchJSON(`https://www.api-junzz.web.id/search/yts?query=${encodeURIComponent(q)}&limit=10`);
    if (!data?.status) throw new Error("YouTube search failed");
    const results = (data.result || []).slice(0, 10).map((item: any) => ({
      videoId: item.videoId || "",
      title: item.title || "",
      thumbnail: item.thumbnail || (item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : ""),
      duration: item.duration || "0:00",
      url: item.url || (item.videoId ? `https://youtu.be/${item.videoId}` : ""),
      source: "youtube",
      artist: "YouTube"
    }));
    res.json({ success: true, results, query: q });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
