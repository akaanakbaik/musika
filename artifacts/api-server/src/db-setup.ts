/**
 * Database schema setup for NeonDB
 * All tables use musika_ prefix to match route expectations
 */
import pkg from 'pg';
const { Client } = pkg;

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_mqNkoeJlS6Z9@ep-crimson-rice-aehes3mk-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const SQL = `
-- ===== MUSIKA USERS =====
CREATE TABLE IF NOT EXISTS public.musika_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  musika_id TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  email_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== OTP CODES =====
CREATE TABLE IF NOT EXISTS public.musika_otp_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_musika_otp_codes_email ON public.musika_otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_musika_otp_codes_expires ON public.musika_otp_codes(expires_at);

-- ===== USER PROFILES =====
CREATE TABLE IF NOT EXISTS public.musika_user_profiles (
  id UUID REFERENCES public.musika_users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== PLAYLISTS =====
CREATE TABLE IF NOT EXISTS public.musika_playlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.musika_users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  cover_url TEXT DEFAULT '',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===== PLAYLIST SONGS =====
CREATE TABLE IF NOT EXISTS public.musika_playlist_songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID REFERENCES public.musika_playlists(id) ON DELETE CASCADE NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  thumbnail TEXT NOT NULL,
  duration TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'youtube',
  url TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT now()
);

-- ===== FAVORITES =====
CREATE TABLE IF NOT EXISTS public.musika_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.musika_users(id) ON DELETE CASCADE NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  thumbnail TEXT NOT NULL,
  duration TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'youtube',
  url TEXT NOT NULL,
  liked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, video_id)
);

-- ===== PLAY HISTORY =====
CREATE TABLE IF NOT EXISTS public.musika_play_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.musika_users(id) ON DELETE CASCADE NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  thumbnail TEXT NOT NULL,
  duration TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'youtube',
  url TEXT NOT NULL,
  played_at TIMESTAMPTZ DEFAULT now()
);

-- ===== SEARCH HISTORY =====
CREATE TABLE IF NOT EXISTS public.musika_search_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.musika_users(id) ON DELETE CASCADE NOT NULL,
  query TEXT NOT NULL,
  searched_at TIMESTAMPTZ DEFAULT now()
);

-- ===== USER DOWNLOADS =====
CREATE TABLE IF NOT EXISTS public.musika_user_downloads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.musika_users(id) ON DELETE CASCADE NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  thumbnail TEXT NOT NULL,
  duration TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'youtube',
  url TEXT NOT NULL,
  cdn_url TEXT,
  file_size_mb NUMERIC,
  downloaded_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, video_id)
);

-- Auto-create profile on user insert
CREATE OR REPLACE FUNCTION public.musika_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.musika_user_profiles (id, username, bio, avatar_url)
  VALUES (NEW.id, NEW.username, NEW.bio, NEW.avatar_url)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_musika_user_created ON public.musika_users;
CREATE TRIGGER on_musika_user_created
  AFTER INSERT ON public.musika_users
  FOR EACH ROW EXECUTE FUNCTION public.musika_handle_new_user();
`;

async function setup() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ Connected to NeonDB PostgreSQL');
    await client.query(SQL);
    console.log('✓ Schema with musika_ prefix created successfully');
  } catch (err) {
    console.error('✗ Error:', err);
    throw err;
  } finally {
    await client.end();
  }
}

setup();
