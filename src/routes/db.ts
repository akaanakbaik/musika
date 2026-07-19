import { Router } from "express";
import { query } from "../lib/db";
import { authMiddleware, optionalAuth } from "../middlewares/auth";

const router = Router();

// ===== FAVORITES =====

// Get user's favorites
router.get("/favorites", authMiddleware, async (req, res) => {
  try {
    const result = await query(
      "SELECT * FROM public.musika_favorites WHERE user_id = $1 ORDER BY liked_at DESC",
      [req.user!.userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add to favorites
router.post("/favorites", authMiddleware, async (req, res) => {
  const { video_id, title, artist, thumbnail, duration, source, url } = req.body;
  if (!video_id || !title) return res.status(400).json({ success: false, error: "video_id dan title diperlukan" });

  try {
    const result = await query(
      `INSERT INTO public.musika_favorites (user_id, video_id, title, artist, thumbnail, duration, source, url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, video_id) DO NOTHING
       RETURNING *`,
      [req.user!.userId, video_id, title, artist || "", thumbnail || "", duration || "0:00", source || "youtube", url || ""]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Remove from favorites
router.delete("/favorites/:videoId", authMiddleware, async (req, res) => {
  try {
    await query(
      "DELETE FROM public.musika_favorites WHERE user_id = $1 AND video_id = $2",
      [req.user!.userId, req.params.videoId]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== PLAY HISTORY =====

// Get user's play history
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const result = await query(
      "SELECT * FROM public.musika_play_history WHERE user_id = $1 ORDER BY played_at DESC LIMIT 100",
      [req.user!.userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add to play history
router.post("/history", authMiddleware, async (req, res) => {
  const { video_id, title, artist, thumbnail, duration, source, url } = req.body;
  if (!video_id || !title) return res.status(400).json({ success: false, error: "video_id dan title diperlukan" });

  try {
    await query(
      `INSERT INTO public.musika_play_history (user_id, video_id, title, artist, thumbnail, duration, source, url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [req.user!.userId, video_id, title, artist || "", thumbnail || "", duration || "0:00", source || "youtube", url || ""]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clear play history
router.delete("/history", authMiddleware, async (req, res) => {
  try {
    await query("DELETE FROM public.musika_play_history WHERE user_id = $1", [req.user!.userId]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== PLAYLISTS =====

// Get user's playlists
router.get("/playlists", authMiddleware, async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, 
        COALESCE(json_agg(json_build_object('count', ps.song_count, 'thumbnail', ps.song_thumbnail)) FILTER (WHERE ps.playlist_id IS NOT NULL), '[]') as playlist_songs
       FROM public.musika_playlists p
       LEFT JOIN (
         SELECT playlist_id, COUNT(*) as song_count, MAX(thumbnail) as song_thumbnail
         FROM public.musika_playlist_songs
         GROUP BY playlist_id
       ) ps ON p.id = ps.playlist_id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [req.user!.userId]
    );

    const playlists = result.rows.map((p: any) => {
      const songs = p.playlist_songs || [];
      return {
        ...p,
        song_count: songs[0]?.count || 0,
        cover_thumbs: songs.map((s: any) => s.thumbnail).filter(Boolean).slice(0, 4),
      };
    });

    res.json({ success: true, data: playlists });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get public playlists for a user
router.get("/playlists/public/:userId", async (req, res) => {
  try {
    const result = await query(
      `SELECT p.id, p.name, p.description, p.cover_url, p.created_at,
        COALESCE(ps.song_count, 0) as song_count
       FROM public.musika_playlists p
       LEFT JOIN (
         SELECT playlist_id, COUNT(*) as song_count
         FROM public.musika_playlist_songs
         GROUP BY playlist_id
       ) ps ON p.id = ps.playlist_id
       WHERE p.user_id = $1 AND p.is_public = true
       ORDER BY p.created_at DESC
       LIMIT 20`,
      [req.params.userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single playlist by ID
router.get("/playlists/:id", optionalAuth, async (req, res) => {
  try {
    const result = await query("SELECT * FROM public.musika_playlists WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Playlist not found" });
    }

    const pl = result.rows[0];
    // Check access: must be public or owned by current user
    if (!pl.is_public && (!req.user || req.user.userId !== pl.user_id)) {
      return res.status(404).json({ success: false, error: "Playlist not found" });
    }

    // Get owner info
    const owner = await query("SELECT username, avatar_url FROM public.musika_users WHERE id = $1", [pl.user_id]);

    // Get songs
    const songs = await query(
      "SELECT * FROM public.musika_playlist_songs WHERE playlist_id = $1 ORDER BY added_at ASC",
      [req.params.id]
    );

    res.json({
      success: true,
      playlist: {
        ...pl,
        owner_username: owner.rows[0]?.username,
        owner_avatar: owner.rows[0]?.avatar_url,
      },
      songs: songs.rows,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create playlist
router.post("/playlists", authMiddleware, async (req, res) => {
  const { name, description, is_public } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, error: "Nama playlist diperlukan" });

  try {
    const result = await query(
      `INSERT INTO public.musika_playlists (user_id, name, description, is_public)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user!.userId, name.trim(), (description || "").trim(), is_public || false]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update playlist
router.put("/playlists/:id", authMiddleware, async (req, res) => {
  const { name, description, is_public, cover_url } = req.body;

  try {
    // Verify ownership
    const check = await query("SELECT user_id FROM public.musika_playlists WHERE id = $1", [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ success: false, error: "Playlist not found" });
    if (check.rows[0].user_id !== req.user!.userId) return res.status(403).json({ success: false, error: "Forbidden" });

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); params.push(name); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); params.push(description); }
    if (is_public !== undefined) { updates.push(`is_public = $${idx++}`); params.push(is_public); }
    if (cover_url !== undefined) { updates.push(`cover_url = $${idx++}`); params.push(cover_url); }

    if (updates.length === 0) return res.status(400).json({ success: false, error: "No fields to update" });

    params.push(req.params.id);
    const result = await query(
      `UPDATE public.musika_playlists SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
      params
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete playlist
router.delete("/playlists/:id", authMiddleware, async (req, res) => {
  try {
    const check = await query("SELECT user_id FROM public.musika_playlists WHERE id = $1", [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ success: false, error: "Playlist not found" });
    if (check.rows[0].user_id !== req.user!.userId) return res.status(403).json({ success: false, error: "Forbidden" });

    // Delete songs first, then playlist
    await query("DELETE FROM public.musika_playlist_songs WHERE playlist_id = $1", [req.params.id]);
    await query("DELETE FROM public.musika_playlists WHERE id = $1", [req.params.id]);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== PLAYLIST SONGS =====

// Add song to playlist
router.post("/playlists/:id/songs", authMiddleware, async (req, res) => {
  const { video_id, title, artist, thumbnail, duration, source, url } = req.body;
  if (!video_id || !title) return res.status(400).json({ success: false, error: "video_id dan title diperlukan" });

  try {
    // Verify ownership
    const check = await query("SELECT user_id FROM public.musika_playlists WHERE id = $1", [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ success: false, error: "Playlist not found" });
    if (check.rows[0].user_id !== req.user!.userId) return res.status(403).json({ success: false, error: "Forbidden" });

    const result = await query(
      `INSERT INTO public.musika_playlist_songs (playlist_id, video_id, title, artist, thumbnail, duration, source, url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.params.id, video_id, title, artist || "", thumbnail || "", duration || "0:00", source || "youtube", url || ""]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Remove song from playlist
router.delete("/playlists/:playlistId/songs/:songId", authMiddleware, async (req, res) => {
  try {
    const check = await query("SELECT user_id FROM public.musika_playlists WHERE id = $1", [req.params.playlistId]);
    if (check.rows.length === 0) return res.status(404).json({ success: false, error: "Playlist not found" });
    if (check.rows[0].user_id !== req.user!.userId) return res.status(403).json({ success: false, error: "Forbidden" });

    await query("DELETE FROM public.musika_playlist_songs WHERE id = $1 AND playlist_id = $2",
      [req.params.songId, req.params.playlistId]);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Copy playlist (public → user's library)
router.post("/playlists/:id/copy", authMiddleware, async (req, res) => {
  try {
    // Get original playlist
    const pl = await query("SELECT * FROM public.musika_playlists WHERE id = $1 AND is_public = true", [req.params.id]);
    if (pl.rows.length === 0) return res.status(404).json({ success: false, error: "Playlist tidak ditemukan" });

    const original = pl.rows[0];

    // Create new playlist
    const newPl = await query(
      `INSERT INTO public.musika_playlists (user_id, name, description) VALUES ($1, $2, $3) RETURNING *`,
      [req.user!.userId, original.name + " (Salinan)", original.description || ""]
    );

    // Copy songs
    const songs = await query(
      "SELECT video_id, title, artist, thumbnail, duration, source, url FROM public.musika_playlist_songs WHERE playlist_id = $1",
      [req.params.id]
    );

    for (const song of songs.rows) {
      await query(
        `INSERT INTO public.musika_playlist_songs (playlist_id, video_id, title, artist, thumbnail, duration, source, url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [newPl.rows[0].id, song.video_id, song.title, song.artist, song.thumbnail, song.duration, song.source, song.url]
      );
    }

    res.json({ success: true, data: newPl.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== USER DOWNLOADS =====

// Get user's downloads
router.get("/downloads", authMiddleware, async (req, res) => {
  try {
    const result = await query(
      "SELECT * FROM public.musika_user_downloads WHERE user_id = $1 ORDER BY downloaded_at DESC LIMIT 200",
      [req.user!.userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add download
router.post("/downloads", authMiddleware, async (req, res) => {
  const { video_id, title, artist, thumbnail, duration, source, url, cdn_url } = req.body;
  if (!video_id || !title) return res.status(400).json({ success: false, error: "video_id dan title diperlukan" });

  try {
    await query(
      `INSERT INTO public.musika_user_downloads (user_id, video_id, title, artist, thumbnail, duration, source, url, cdn_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, video_id) DO UPDATE SET cdn_url = EXCLUDED.cdn_url, downloaded_at = now()
       RETURNING *`,
      [req.user!.userId, video_id, title, artist || "", thumbnail || "", duration || "0:00", source || "youtube", url || "", cdn_url || null]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete download
router.delete("/downloads/:id", authMiddleware, async (req, res) => {
  try {
    await query("DELETE FROM public.musika_user_downloads WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user!.userId]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== SEARCH HISTORY =====

router.post("/search-history", authMiddleware, async (req, res) => {
  const { query: searchQuery } = req.body;
  if (!searchQuery) return res.status(400).json({ success: false, error: "Query diperlukan" });

  try {
    await query(
      "INSERT INTO public.musika_search_history (user_id, query) VALUES ($1, $2)",
      [req.user!.userId, searchQuery]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
