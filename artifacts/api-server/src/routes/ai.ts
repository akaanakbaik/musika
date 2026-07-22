import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

// ===== SYSTEM PROMPT =====
// Instructs AI to use clean Markdown formatting (bold, italic, headers, lists)
// without excessive emoji or decorative symbols.
const SYSTEM_PROMPT = `Kamu adalah **Musika AI** — asisten musik pribadi dari aplikasi **Musika**.

TENTANG MUSIKA:
- Musika adalah aplikasi pemutar musik gratis yang mendukung streaming dari YouTube, Spotify, Apple Music, dan SoundCloud.
- Fitur utama: Cari lagu dari 4 sumber, Download lagu, Buat playlist, Favorit, Riwayat putar, Rekomendasi harian.
- Pengguna bisa mendaftar/login dengan email, verifikasi OTP, dan mengelola profil.
- Aplikasi tersedia dalam Bahasa Indonesia dan Inggris.

PANDUAN FORMAT:
1. Gunakan **bold** untuk judul fitur atau kata kunci penting.
2. Gunakan *italic* untuk penekanan ringan.
3. Gunakan # atau ## untuk header jika perlu.
4. Gunakan - untuk daftar.
5. Jangan gunakan simbol berlebihan. Cukup 1-2 emoji relevan per pesan.
6. Gunakan \\n\\n antar paragraf.
7. Jawab dalam Bahasa Indonesia yang ramah dan natural.`;

async function fetchJSON(
  urlOrReq: string | { url: string; body?: any; method?: string; headers?: Record<string, string> },
  timeout = 25000
): Promise<any> {
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
    Accept: "application/json",
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

function buildContextMessage(userMsg: string): string {
  return `SISTEM: ${SYSTEM_PROMPT}\n\nPENGGUNA: ${userMsg}\n\nASISTEN MUSIKA:`;
}

function buildSimplePrompt(userMsg: string): string {
  return encodeURIComponent(
    `Kamu adalah Musika AI — asisten musik personal.\nFITUR: Cari lagu (YouTube, Spotify, Apple Music, SoundCloud), Download MP3, Playlist, Favorit, Riwayat, Rekomendasi.\nGunakan format **bold** untuk judul fitur, *italic* untuk penekanan, - untuk daftar.\nPertanyaan pengguna: ${userMsg}`
  );
}

// ===== CLEAN FORMATTING =====
// Strip excessive decorative symbols while preserving meaningful markdown
function cleanReply(reply: string): string {
  return reply
    // Keep **bold**, *italic*, # headers, - lists, \n
    // Remove 3+ consecutive identical symbols
    .replace(/~{3,}/g, "")
    .replace(/_{3,}/g, "")
    .replace(/`{3,}/g, "")
    .replace(/\*{3,}/g, "**")
    // Squeeze 3+ consecutive emoji into at most 1
    .replace(/([\u{1F000}-\u{1FFFF}])\1{2,}/gu, "$1")
    // Remove trailing/leading whitespace per line
    .split("\n").map((l) => l.trim()).join("\n")
    .trim();
}

// ===== AI CHAT HANDLER =====
async function handleChat(req: Request, res: Response) {
  const { message } = req.method === "POST" ? req.body : (req.query as any);
  if (!message?.trim()) {
    return res.status(400).json({ success: false, error: "Parameter 'message' diperlukan" });
  }

  const msg: string = message.trim();
  let lastError = "";

  // ===== Try AI APIs with fallback chain =====
  const apis = [
    // Primary: prexzyapis copilot-think
    async (): Promise<string> => {
      const d = await fetchJSON({
        url: "https://prexzyapis.com/ai/copilot-think",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { text: buildContextMessage(msg) },
      }, 30000);
      const reply = extractReply(d);
      if (!reply) throw new Error("No reply from prexzy");
      return cleanReply(reply);
    },

    // Fallback 1: cuki gemini
    async (): Promise<string> => {
      const prompt = buildSimplePrompt(msg);
      const d = await fetchJSON(
        `https://api.cuki.biz.id/api/ai/gemini?apikey=cuki-x&prompt=${prompt}`,
        25000
      );
      const reply = extractReply(d);
      if (!reply) throw new Error("No reply from cuki");
      return cleanReply(reply);
    },

    // Fallback 2: zenzxz copilot
    async (): Promise<string> => {
      const contextMsg = buildSimplePrompt(msg);
      const d = await fetchJSON(
        `https://api.zenzxz.my.id/ai/copilot?message=${contextMsg}&model=gpt-5`,
        20000
      );
      const reply = extractReply(d);
      if (!reply) throw new Error("No reply from zenzxz");
      return cleanReply(reply);
    },

    // Fallback 3: cuki deepseek
    async (): Promise<string> => {
      const prompt = buildSimplePrompt(msg);
      const d = await fetchJSON(
        `https://api.cuki.biz.id/api/ai/deepseek?apikey=cuki-x&prompt=${prompt}`,
        25000
      );
      const reply = extractReply(d);
      if (!reply) throw new Error("No reply from cuki deepseek");
      return cleanReply(reply);
    },
  ];

  for (const api of apis) {
    try {
      const reply = await api();
      return res.json({ success: true, reply });
    } catch (err: any) {
      lastError = err.message || "Unknown error";
      console.warn(`[AI] API failed: ${lastError}`);
    }
  }

  // ===== Contextual fallback responses (clean markdown) =====
  const lowerMsg = msg.toLowerCase();
  const errSuffix = lastError ? ` (${lastError})` : "";

  if (lowerMsg.includes("rekomendasi") || lowerMsg.includes("recommend") || lowerMsg.includes("saran")) {
    const genre = lowerMsg.includes("pop") ? "pop"
      : lowerMsg.includes("rock") ? "rock"
      : lowerMsg.includes("jazz") ? "jazz"
      : lowerMsg.includes("hip hop") || lowerMsg.includes("rap") ? "hip hop"
      : lowerMsg.includes("dangdut") || lowerMsg.includes("koplo") ? "dangdut/koplo"
      : lowerMsg.includes("indie") || lowerMsg.includes("indonesia") ? "musik Indonesia"
      : "berbagai genre";
    return res.json({ success: true, reply: `Tentu! Berikut rekomendasi musik **${genre}** yang bisa kamu coba:\n\n- Cari di tab **Cari** dengan kata kunci "${genre}"\n- Pilih sumber favoritmu (YouTube/Spotify/Apple Music/SoundCloud)\n- Cek halaman **Beranda** untuk rekomendasi harian\n\nAda genre spesifik yang kamu suka?` });
  }

  if (lowerMsg.includes("playlist")) {
    return res.json({ success: true, reply: `**Membuat Playlist di Musika:**\n\n1. Buka tab **Perpustakaan**\n2. Tap tombol **+** atau **Buat Playlist**\n3. Beri nama playlist-nya\n4. Cari lagu di tab **Cari**, tap menu pada lagu, pilih **Tambah ke Playlist**\n\nKamu juga bisa mengatur playlist jadi publik atau privat.` });
  }

  if (lowerMsg.includes("download") || lowerMsg.includes("unduh") || lowerMsg.includes("mp3")) {
    return res.json({ success: true, reply: `**Cara Download Lagu di Musika:**\n\n1. Cari lagu yang kamu mau di tab **Cari**\n2. Tap tombol **Download** pada lagu tersebut\n3. Lagu akan tersimpan di tab **Download**\n\nSemua lagu yang sudah di-download bisa diputar secara offline.` });
  }

  if (lowerMsg.includes("favorit") || lowerMsg.includes("favorite")) {
    return res.json({ success: true, reply: `**Fitur Favorit di Musika:**\n\n- Saat memutar lagu, tap ikon **hati** untuk menambahkan ke favorit\n- Semua lagu favorit bisa dilihat di tab **Favorit**\n- Kamu bisa menghapus dari favorit kapan saja` });
  }

  if (lowerMsg.includes("cari") || lowerMsg.includes("search") || lowerMsg.includes("temukan")) {
    return res.json({ success: true, reply: `**Cari Lagu di Musika:**\n\n1. Buka tab **Cari**\n2. Ketik judul lagu, nama artis, atau genre\n3. Pilih sumber: **YouTube**, **Spotify**, **Apple Music**, atau **SoundCloud**\n4. Tap lagu untuk memutar\n\nKamu juga bisa mencari di semua sumber sekaligus.` });
  }

  if (lowerMsg.includes("fitur") || lowerMsg.includes("bisa apa") || lowerMsg.includes("help") || lowerMsg.includes("bantuan")) {
    return res.json({ success: true, reply: `**Yang Bisa Kamu Lakukan di Musika:**\n\n- **Cari Lagu** — YouTube, Spotify, Apple Music, SoundCloud\n- **Download** — Simpan lagu offline\n- **Playlist** — Buat dan kelola playlist sendiri\n- **Favorit** — Tandai lagu kesukaan\n- **Riwayat** — Lihat lagu yang pernah diputar\n- **Rekomendasi** — Temukan musik baru setiap hari\n- **Profil** — Kelola akun dan pengaturan\n\nAda yang ingin kamu coba?` });
  }

  if (lowerMsg.includes("lagu") || lowerMsg.includes("song") || lowerMsg.includes("musik") || lowerMsg.includes("music")) {
    return res.json({ success: true, reply: `Mau cari lagu? Coba buka tab **Cari** dan ketik judul atau artis favoritmu.\n\nKamu bisa memilih sumber dari YouTube, Spotify, Apple Music, atau SoundCloud.\n\nAtau bilang genre/mood yang kamu mau, aku bisa kasih rekomendasi.` });
  }

  if ((lowerMsg.includes("siapa") && (lowerMsg.includes("kamu") || lowerMsg.includes("lu") || lowerMsg.includes("kau"))) || lowerMsg.includes("nama kamu") || lowerMsg.includes("namamu")) {
    return res.json({ success: true, reply: `Halo! Aku **Musika AI**, asisten musik pribadimu di aplikasi Musika.\n\nAku bisa bantu:\n- Mencari lagu dari YouTube, Spotify, Apple Music, SoundCloud\n- Membuat dan mengelola playlist\n- Menambahkan lagu favorit\n- Download lagu\n- Memberi rekomendasi musik\n\nAda yang bisa aku bantu?` });
  }

  if (lowerMsg.includes("apa itu musika") || lowerMsg.includes("musika itu apa") || lowerMsg.includes("tentang musika")) {
    return res.json({ success: true, reply: `**Musika** adalah aplikasi pemutar musik gratis yang memungkinkan kamu:\n\n- Streaming dari **YouTube**, **Spotify**, **Apple Music**, dan **SoundCloud**\n- **Download** lagu untuk didengar offline\n- Buat **Playlist** kustom\n- Tandai **Favorit**\n- Dapatkan **Rekomendasi** harian\n- Riwayat pemutaran\n- Daftar/Login dengan email\n\nSemua gratis! Yuk coba sekarang.` });
  }

  return res.json({ success: true, reply: `Maaf, asisten AI sedang sibuk. Coba lagi dalam beberapa saat.${errSuffix}\n\nSementara itu, kamu bisa:\n- Cari lagu di tab **Cari**\n- Lihat rekomendasi di **Beranda**\n- Kelola **Playlist** di **Perpustakaan**\n\nAtau tanyakan sesuatu yang lain.` });
}

// ===== ROUTES =====
router.get("/ai/chat", handleChat);
router.post("/ai/chat", handleChat);

export default router;
