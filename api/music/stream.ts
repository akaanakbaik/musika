/// <reference lib="dom" />
export const config = { maxDuration: 60 };

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { url } = req.query;
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
}
