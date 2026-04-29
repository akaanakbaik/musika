import { Router, type IRouter } from "express";

const router: IRouter = Router();

async function fetchAI(url: string, timeout = 20000): Promise<any> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 musika-ai/2.0",
      "Accept": "application/json"
    },
    signal: AbortSignal.timeout(timeout)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function extractReply(json: any): string | null {
  if (!json) return null;
  // zenzxz format: { status: true, result: { text: "..." } }
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
  const encoded = encodeURIComponent(msg);

  // Full message with music context for APIs that support it
  const contextMsg = encodeURIComponent(
    `Kamu adalah Musika AI — asisten musik personal AI yang ramah, cerdas, dan berpengetahuan luas. ` +
    `WAJIB selalu menjawab dalam Bahasa Indonesia yang natural, santai, dan mudah dipahami, apapun bahasa yang digunakan user. ` +
    `Bidang keahlianmu: rekomendasi lagu berdasarkan mood/genre/aktivitas, info artis & album, lirik & makna lagu, sejarah musik, genre musik dunia & Indonesia, K-pop, pop, rock, jazz, lo-fi, EDM, dangdut, dll. ` +
    `Fitur Musika yang bisa kamu jelaskan: pencarian multi-sumber (YouTube/Spotify/Apple Music/SoundCloud), playlist, unduhan offline, sleep timer, AI chat, tema. ` +
    `Gaya menjawab: gunakan emoji secukupnya, berikan daftar rekomendasi yang spesifik dengan nama artis & judul lagu, buat jawaban menarik tapi tetap padat. ` +
    `Jika pertanyaan di luar topik musik & Musika, arahkan dengan ramah ke topik musik sambil tetap membantu. ` +
    `Pesan user: ${msg}`
  );

  // Try multiple AI APIs in order — first working one wins
  const apis = [
    // Primary: zenzxz gpt-5 (confirmed working)
    async () => {
      const d = await fetchAI(`https://api.zenzxz.my.id/ai/copilot?message=${contextMsg}&model=gpt-5`);
      if (!d?.status) throw new Error("API returned status=false");
      const reply = extractReply(d);
      if (!reply) throw new Error("No reply text");
      return reply;
    },
    // Fallback 1: zenzxz default model
    async () => {
      const d = await fetchAI(`https://api.zenzxz.my.id/ai/copilot?message=${contextMsg}&model=default`);
      if (!d?.status) throw new Error("API returned status=false");
      const reply = extractReply(d);
      if (!reply) throw new Error("No reply text");
      return reply;
    },
    // Fallback 2: zenzxz think-deeper
    async () => {
      const d = await fetchAI(`https://api.zenzxz.my.id/ai/copilot?message=${encoded}&model=think-deeper`, 30000);
      if (!d?.status) throw new Error("API returned status=false");
      const reply = extractReply(d);
      if (!reply) throw new Error("No reply text");
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

  // All APIs failed — helpful fallback based on message content
  const lowerMsg = msg.toLowerCase();
  let fallbackReply: string;

  if (lowerMsg.includes("rekomendasi") || lowerMsg.includes("recommend") || lowerMsg.includes("saran")) {
    fallbackReply = "Untuk rekomendasi musik yang keren, coba cari di tab **Cari** dengan kata kunci genre favoritmu — contoh: 'lo-fi', 'pop Indonesia', 'K-pop viral', atau 'jazz relax'. Kamu juga bisa cek rekomendasi di halaman Beranda! 🎵";
  } else if (lowerMsg.includes("playlist")) {
    fallbackReply = "Kamu bisa membuat playlist sendiri di tab **Perpustakaan**! Tambahkan lagu favorit dengan menekan tombol ⋯ pada lagu manapun lalu pilih 'Tambah ke Playlist'. 🎶";
  } else if (lowerMsg.includes("artis") || lowerMsg.includes("artist")) {
    fallbackReply = "Cari artis favoritmu di tab **Cari**! Kamu bisa filter berdasarkan Spotify, YouTube, Apple Music, atau SoundCloud untuk hasil yang lebih spesifik. 🎤";
  } else {
    fallbackReply = "Maaf, asisten AI sedang sibuk. Sila coba lagi dalam beberapa saat. Sementara itu, jelajahi musik di tab **Cari** atau lihat **Rekomendasi** di Beranda! 🎵";
  }

  res.json({ success: true, reply: fallbackReply });
});

export default router;
