/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║          MUSIKA — API CONFIGURATION FILE                        ║
 * ║                                                                  ║
 * ║  Cara mengganti API:                                             ║
 * ║  1. Edit nilai BASE_URL atau endpoint spesifik di bawah          ║
 * ║  2. Simpan file — perubahan langsung berlaku tanpa build ulang   ║
 * ║  3. Untuk source musik, ganti nilai di MUSIC_SOURCES             ║
 * ║  4. Untuk backend API, ganti BACKEND_BASE_URL                   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ─── BACKEND API BASE URL ─────────────────────────────────────────────────────
// Dev: otomatis menggunakan BASE_URL dari Vite (proxy ke api-server lokal)
// Prod: menggunakan musika-api.replit.app (dikonfigurasi via vercel.json rewrite)
// Untuk ganti ke backend lain: ubah nilai PROD_API_BASE di bawah
export const PROD_API_BASE = "https://musika-api.replit.app";
export const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// Helper untuk membuat URL API (pakai ini di semua fetch)
export const api = (path: string) => `${API_BASE}${path}`;

// ─── MUSIC SEARCH ENDPOINTS ───────────────────────────────────────────────────
// Endpoint pencarian musik dari backend
// Cara ganti: ubah SEARCH_PATH ke endpoint search mu yang baru
export const ENDPOINTS = {
  search:          "/api/music/search",          // GET ?q=...&source=...
  recommendations: "/api/music/recommendations", // GET — trending/rekomendasi
  download:        "/api/music/download",        // GET ?url=...&source=...
  stream:          "/api/music/stream",          // GET ?url=...&source=...
  prepare:         "/api/music/prepare",         // GET ?url=...&source=...&videoId=...
  upload:          "/api/upload",                // POST multipart/form-data
  aiChat:          "/api/ai/chat",               // POST JSON { messages, lang }
  authOtpSend:     "/api/auth/otp/send",         // POST { email }
  authOtpVerify:   "/api/auth/otp/verify",       // POST { email, code }
  authOtpResend:   "/api/auth/otp/resend",       // POST { email }
};

// ─── MUSIK SOURCE PRIORITY ORDER ─────────────────────────────────────────────
// Urutan source ditampilkan di hasil pencarian (kiri ke kanan, atas ke bawah)
// Cara ganti urutan: ubah array di bawah
export const SOURCE_ORDER = ["spotify", "youtube", "apple", "soundcloud"] as const;
export type MusicSource = typeof SOURCE_ORDER[number];
export type SourceAll = "all";

// ─── SOURCE DISPLAY LABELS & COLORS ──────────────────────────────────────────
// Cara ganti label source: edit record di bawah
export const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  spotify:    { label: "Spotify",      color: "#1DB954", bg: "bg-[#1DB954]" },
  youtube:    { label: "YouTube",      color: "#FF0000", bg: "bg-[#FF0000]" },
  apple:      { label: "Apple Music",  color: "#FA243C", bg: "bg-[#FA243C]" },
  soundcloud: { label: "SoundCloud",   color: "#FF5500", bg: "bg-[#FF5500]" },
};

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
// Kredensial Supabase diambil dari environment variables Vite
// Cara ganti: set env vars VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
export const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string;
export const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// ─── CDN / AVATAR STORAGE ────────────────────────────────────────────────────
// Bucket Supabase Storage untuk avatar user
// Cara ganti: ubah AVATAR_BUCKET ke nama bucket baru kamu
export const AVATAR_BUCKET = "avatars";
export const AVATAR_MAX_SIZE_MB = 10; // Maksimum ukuran foto profil (MB)

// ─── AI CHAT ─────────────────────────────────────────────────────────────────
// Model AI yang digunakan untuk fitur Musika AI Chat
// Cara ganti model: ubah AI_MODEL ke model lain (e.g. "gpt-4o")
export const AI_MODEL    = "gemini-2.0-flash-lite";
export const AI_PROVIDER = "google"; // "google" | "openai" | "anthropic"

// ─── PWA / APP ───────────────────────────────────────────────────────────────
export const APP_NAME    = "Musika";
export const APP_VERSION = "2.2.0";
export const APP_GITHUB  = "https://github.com/akaanakbaik/musika";
export const APP_VERCEL  = "https://musika-one.vercel.app";

// ─── PLAYLIST SHARING ────────────────────────────────────────────────────────
// Base URL untuk share link playlist
// Cara ganti: ubah ke domain deploy kamu
export const PLAYLIST_SHARE_BASE = typeof window !== "undefined"
  ? window.location.origin
  : APP_VERCEL;

export function getPlaylistShareUrl(playlistId: string) {
  return `${PLAYLIST_SHARE_BASE}/playlist/${playlistId}`;
}
