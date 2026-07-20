-- ===== PERFORMANCE INDEXES FOR MUSIKA =====
-- Run this on NeonDB to optimize query performance
-- All tables now have indexes on frequently queried columns

-- Users table: optimize login, profile lookup, share links
CREATE INDEX IF NOT EXISTS idx_musika_users_email ON public.musika_users(email);
CREATE INDEX IF NOT EXISTS idx_musika_users_username ON public.musika_users(username);
CREATE INDEX IF NOT EXISTS idx_musika_users_musika_id ON public.musika_users(musika_id);
CREATE INDEX IF NOT EXISTS idx_musika_users_created_at ON public.musika_users(created_at);

-- Playlists: optimize user playlist listing
CREATE INDEX IF NOT EXISTS idx_musika_playlists_user_id ON public.musika_playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_musika_playlists_created_at ON public.musika_playlists(created_at);

-- Playlist songs: optimize playlist content loading
CREATE INDEX IF NOT EXISTS idx_musika_playlist_songs_playlist ON public.musika_playlist_songs(playlist_id);

-- Favorites: optimize user favorites listing
CREATE INDEX IF NOT EXISTS idx_musika_favorites_user_id ON public.musika_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_musika_favorites_liked_at ON public.musika_favorites(liked_at);

-- Play history: optimize user history listing + date sorting
CREATE INDEX IF NOT EXISTS idx_musika_play_history_user_id ON public.musika_play_history(user_id);
CREATE INDEX IF NOT EXISTS idx_musika_play_history_played_at ON public.musika_play_history(played_at);

-- Search history: optimize user search history listing
CREATE INDEX IF NOT EXISTS idx_musika_search_history_user_id ON public.musika_search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_musika_search_history_searched_at ON public.musika_search_history(searched_at);

-- Downloads: optimize user downloads listing
CREATE INDEX IF NOT EXISTS idx_musika_downloads_user_id ON public.musika_user_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_musika_downloads_downloaded_at ON public.musika_user_downloads(downloaded_at);

-- ===== VERIFICATION QUERY =====
-- Run this to confirm all indexes exist:
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE schemaname = 'public' AND tablename LIKE 'musika_%'
-- ORDER BY tablename, indexname;
