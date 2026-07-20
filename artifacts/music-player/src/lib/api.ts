/**
 * API Client — menggantikan Supabase client
 * Semua komunikasi database melalui backend API dengan JWT auth
 */

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function getToken(): string | null {
  return localStorage.getItem("musika-token-v3");
}

function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<{ success: boolean; data?: T; error?: string; [key: string]: any }> {
  const { timeoutMs = 15000, ...fetchOptions } = options;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...fetchOptions,
      headers: { ...getAuthHeaders(), ...(fetchOptions.headers as Record<string, string> || {}) },
      signal: controller.signal,
    });
    return await res.json();
  } catch (err: any) {
    if (err.name === "AbortError") throw new Error("Request timeout");
    throw err;
  } finally {
    clearTimeout(tid);
  }
}

// ===== USERS / AUTH (additional endpoints beyond AuthContext) =====

export async function getUserProfile(userId: string) {
  return apiFetch(`/api/users/${userId}`);
}

// ===== FAVORITES =====

export async function getFavorites() {
  const res = await apiFetch<{ video_id: string; title: string; artist: string; thumbnail: string; duration: string; source: string; url: string; liked_at: string }[]>("/api/favorites");
  if (!res.success) throw new Error(res.error || "Failed to load favorites");
  return res.data || [];
}

export async function addFavorite(song: { video_id: string; title: string; artist?: string; thumbnail?: string; duration?: string; source?: string; url?: string }) {
  return apiFetch("/api/favorites", {
    method: "POST",
    body: JSON.stringify(song),
  });
}

export async function removeFavorite(videoId: string) {
  return apiFetch(`/api/favorites/${encodeURIComponent(videoId)}`, { method: "DELETE" });
}

// ===== PLAY HISTORY =====

export async function getHistory() {
  const res = await apiFetch<any[]>("/api/history");
  if (!res.success) throw new Error(res.error || "Failed to load history");
  return res.data || [];
}

export async function addHistory(song: { video_id: string; title: string; artist?: string; thumbnail?: string; duration?: string; source?: string; url?: string }) {
  return apiFetch("/api/history", {
    method: "POST",
    body: JSON.stringify(song),
  });
}

export async function clearHistory() {
  return apiFetch("/api/history", { method: "DELETE" });
}

// ===== PLAYLISTS =====

export async function getPlaylists() {
  const res = await apiFetch<any[]>("/api/playlists");
  if (!res.success) throw new Error(res.error || "Failed to load playlists");
  return res.data || [];
}

export async function getPublicPlaylists(userId: string) {
  const res = await apiFetch<any[]>(`/api/playlists/public/${userId}`);
  if (!res.success) throw new Error(res.error || "Failed to load public playlists");
  return res.data || [];
}

export async function getPlaylist(id: string) {
  return apiFetch<{ playlist: any; songs: any[] }>(`/api/playlists/${id}`);
}

export async function createPlaylist(data: { name: string; description?: string; is_public?: boolean }) {
  return apiFetch("/api/playlists", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePlaylist(id: string, data: { name?: string; description?: string; is_public?: boolean; cover_url?: string }) {
  return apiFetch(`/api/playlists/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deletePlaylist(id: string) {
  return apiFetch(`/api/playlists/${id}`, { method: "DELETE" });
}

// ===== PLAYLIST SONGS =====

export async function addSongToPlaylist(playlistId: string, song: { video_id: string; title: string; artist?: string; thumbnail?: string; duration?: string; source?: string; url?: string }) {
  return apiFetch(`/api/playlists/${playlistId}/songs`, {
    method: "POST",
    body: JSON.stringify(song),
  });
}

export async function removeSongFromPlaylist(playlistId: string, songId: string) {
  return apiFetch(`/api/playlists/${playlistId}/songs/${songId}`, { method: "DELETE" });
}

export async function copyPlaylist(playlistId: string) {
  return apiFetch(`/api/playlists/${playlistId}/copy`, { method: "POST" });
}

// ===== DOWNLOADS =====

export async function getDownloads() {
  const res = await apiFetch<any[]>("/api/downloads");
  if (!res.success) throw new Error(res.error || "Failed to load downloads");
  return res.data || [];
}

export async function addDownload(song: { video_id: string; title: string; artist?: string; thumbnail?: string; duration?: string; source?: string; url?: string; cdn_url?: string }) {
  return apiFetch("/api/downloads", {
    method: "POST",
    body: JSON.stringify(song),
  });
}

export async function deleteDownload(id: string) {
  return apiFetch(`/api/downloads/${id}`, { method: "DELETE" });
}

// ===== SEARCH HISTORY =====

export async function saveSearchQuery(query: string) {
  return apiFetch("/api/search-history", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

// ===== AUTH HELPER (beyond AuthContext) =====

export async function loginUser(email: string, password: string) {
  return apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function registerUser(email: string, password: string, username: string) {
  return apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, username }),
  });
}

export async function getMe() {
  return apiFetch("/api/auth/me");
}
