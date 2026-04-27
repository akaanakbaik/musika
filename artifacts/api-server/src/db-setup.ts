import pkg from 'pg';
const { Client } = pkg;

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres.maiivetnuxnrqrnruyes:Akaanakbaik17!@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres';

const SQL = `
-- User profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Playlists
CREATE TABLE IF NOT EXISTS public.playlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  cover_url TEXT DEFAULT '',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Playlist songs
CREATE TABLE IF NOT EXISTS public.playlist_songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID REFERENCES public.playlists(id) ON DELETE CASCADE NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  thumbnail TEXT NOT NULL,
  duration TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'youtube',
  url TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT now()
);

-- Favorites
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
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

-- Play history
CREATE TABLE IF NOT EXISTS public.play_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  thumbnail TEXT NOT NULL,
  duration TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'youtube',
  url TEXT NOT NULL,
  played_at TIMESTAMPTZ DEFAULT now()
);

-- Search history
CREATE TABLE IF NOT EXISTS public.search_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  query TEXT NOT NULL,
  searched_at TIMESTAMPTZ DEFAULT now()
);

-- User downloads (offline PWA)
CREATE TABLE IF NOT EXISTS public.user_downloads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
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

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_downloads ENABLE ROW LEVEL SECURITY;

-- RLS Policies (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='profiles_all' AND tablename='user_profiles') THEN
    CREATE POLICY "profiles_all" ON public.user_profiles FOR ALL USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='playlists_all' AND tablename='playlists') THEN
    CREATE POLICY "playlists_all" ON public.playlists FOR ALL USING (auth.uid() = user_id OR is_public = true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='playlist_songs_all' AND tablename='playlist_songs') THEN
    CREATE POLICY "playlist_songs_all" ON public.playlist_songs FOR ALL USING (
      EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND (p.user_id = auth.uid() OR p.is_public))
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='favorites_all' AND tablename='favorites') THEN
    CREATE POLICY "favorites_all" ON public.favorites FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='history_all' AND tablename='play_history') THEN
    CREATE POLICY "history_all" ON public.play_history FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='search_hist_all' AND tablename='search_history') THEN
    CREATE POLICY "search_hist_all" ON public.search_history FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='downloads_all' AND tablename='user_downloads') THEN
    CREATE POLICY "downloads_all" ON public.user_downloads FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`;

async function setup() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ Connected to Supabase PostgreSQL');
    await client.query(SQL);
    console.log('✓ Schema created successfully');
  } catch (err) {
    console.error('✗ Error:', err);
  } finally {
    await client.end();
  }
}

setup();
