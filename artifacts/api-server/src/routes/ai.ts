import { Router, type IRouter } from "express";

const router: IRouter = Router();

async function fetchJSON(urlOrReq: string | { url: string; body?: any; method?: string; headers?: Record<string, string> }, timeout = 25000): Promise<any> {
  let url: string;
  let body: any = undefined;
  let method = "GET";
  let extraHeaders: Record<string, string> = {};

  if (typeof urlOrReq === "string") {
    url = urlOrReq;
  } else {
    url = urlOrReq.url;
    body = urlOrReq.body;
    method = urlOrReq.method || "GET";
    extraHeaders = urlOrReq.headers || {};
  }

  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 musika-ai/3.0",
    "Accept": "application/json",
    ...extraHeaders,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function extractReply(json: any): string | null {
  if (!json) return null;
  const candidates = [
    json?.result?.text,
    json?.result?.message,
    json?.result?.content,
    typeof json?.result === "string" ? json.result : null,
    json?.response?.text,
    json?.response?.content,
    typeof json?.response === "string" ? json.response : null,
    json?.message?.content,
    typeof json?.message === "string" ? json.message : null,
    json?.data?.text,
    typeof json?.data === "string" ? json.data : null,
    json?.answer,
    json?.reply,
    json?.output,
    json?.text,
    json?.content,
    json?.data?.reply,
    json?.choices?.[0]?.message?.content,
    json?.candidates?.[0]?.content,
  ];
  for (const c of candidates) {
    if (c && typeof c === "string" && c.trim().length > 3) return c.trim();
  }
  return null;
}

router.get("/ai/chat", async (req, res) => {
  const { message } = req.query as { message: string };
  if (!message?.trim()) {
    return res.status(400).json({ success: false, error: "message is required" });
  }

  const msg = message.trim();

  // Try multiple AI APIs in order — first working one wins
  const apis = [
    // API 1: prexzyapis copilot-think (primary)
    async () => {
      const d = await fetchJSON({
        url: "https://prexzyapis.com/ai/copilot-think",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { text: msg },
      }, 30000);
      const reply = extractReply(d);
      if (!reply) throw new Error("No reply from prexzyapis");
      return reply;
    },
    // API 2: cuki gemini (fallback)
    async () => {
      const d = await fetchJSON(`https://api.cuki.biz.id/api/ai/gemini?apikey=cuki-x&prompt=${encodeURIComponent(msg)}`, 25000);
      const reply = extractReply(d);
      if (!reply) throw new Error("No reply from cuki");
      return reply;
    },
    // API 3: zenzxz (last resort)
    async () => {
      const contextMsg = encodeURIComponent(
        `Kamu adalah Musika AI — asisten musik personal. Jawab dalam Bahasa Indonesia. Pesan: ${msg}`
      );
      const d = await fetchJSON(`https://api.zenzxz.my.id/ai/copilot?message=${contextMsg}&model=gpt-5`, 20000);
      const reply = extractReply(d);
      if (!reply) throw new Error("No reply from zenzxz");
      return reply;
    },
  ];

  for (const api of apis) {
    try {
      const reply = await api();
      return res.json({ success: true, reply });
    } catch (err: any) {
      console.warn("[AI] API failed:", err.message);
    }
  }

  // All APIs failed — contextual fallback
  const lowerMsg = msg.toLowerCase();
  let fallbackReply: string;

  if (lowerMsg.includes("rekomendasi") || lowerMsg.includes("recommend") || lowerMsg.includes("saran")) {
    fallbackReply = "Untuk rekomendasi musik, coba cari di tab **Cari** dengan kata kunci genre favoritmu! Kamu juga bisa cek rekomendasi di halaman Beranda. 🎵";
  } else if (lowerMsg.includes("playlist")) {
    fallbackReply = "Buat playlist sendiri di tab **Perpustakaan**! Tambahkan lagu dengan menekan tombol ⋯ lalu pilih 'Tambah ke Playlist'. 🎶";
  } else if (lowerMsg.includes("artis") || lowerMsg.includes("artist") || lowerMsg.includes("penyanyi")) {
    fallbackReply = "Cari artis favoritmu di tab **Cari**! Filter berdasarkan Spotify, YouTube, Apple Music, atau SoundCloud. 🎤";
  } else if (lowerMsg.includes("lagu") || lowerMsg.includes("song") || lowerMsg.includes("musik")) {
    fallbackReply = "Cari lagu di tab **Cari**! Masukkan judul lagu atau artis, dan pilih sumber favoritmu. 🌟";
  } else {
    fallbackReply = "Maaf, asisten AI sedang sibuk. Coba lagi dalam beberapa saat. Sementara itu, jelajahi musik di tab **Cari** atau lihat rekomendasi di Beranda! 🎵";
  }

  res.json({ success: true, reply: fallbackReply });
});

export default router;
