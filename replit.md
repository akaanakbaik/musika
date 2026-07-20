# Musika - Spotify-like Music Player PWA

## Project Overview
Full-featured music player PWA built with React + Vite + Express + Supabase.

## Architecture

### Frontend (`artifacts/music-player`)
- **Framework**: React 19 + Vite 7
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI + shadcn/ui
- **Routing**: Wouter
- **State**: React Context (AuthContext, PlayerContext)
- **Database client**: Supabase JS

### Backend (`artifacts/api-server`)
- **Framework**: Express 5
- **Build**: esbuild
- **Database**: PostgreSQL (Supabase)

### Shared Libraries (`lib/`)
- `api-client-react`: Generated API client
- `api-spec`: OpenAPI specification
- `api-zod`: Zod schemas
- `db`: Drizzle ORM schema + client

## Key Features
- **Multi-source search**: YouTube, Spotify, Apple Music, SoundCloud
- **Auth**: Supabase email + OTP verification
- **Player**: Full-featured with queue, shuffle, repeat, Media Session API
- **PWA**: Service worker, offline support, installable
- **AI Chat**: GPT-5 via api.zenzxz.my.id/ai/copilot with persistent localStorage sessions
- **Playlists/Favorites/History**: Synced to Supabase DB
- **CDN Upload**: kabox API via multer
- **Theme System**: Dark/Light mode via AppSettingsContext (localStorage key: `musika-settings-v1`)
- **Accent Colors**: Preset + custom hex color support (#1DB954, #FF0000, #FF4E6B, #FF5500)
- **Bilingual i18n**: Full Indonesian/English translations via `src/lib/i18n.ts`
- **Search History**: Saves to localStorage key `musika-search-history` on each search
- **Mobile Header**: Logo + brand left, circular user avatar right (UserDashboard slide-over)
- **User Dashboard**: Account settings, history sub-panels, app settings with theme/language/accent
- **Security**: helmet headers + express-rate-limit (200/min global, 20/15min auth)

## Environment Variables
Set in Replit environment and `.env` files:
- `SUPABASE_URL` / `VITE_SUPABASE_URL`
- `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`

## Supabase Database
- URL: https://maiivetnuxnrqrnruyes.supabase.co
- Tables: user_profiles, playlists, playlist_songs, favorites, play_history, search_history, user_downloads
- RLS policies + auto-profile-create trigger

## API Routes
All mounted at `/api` on the API server:
- `GET /api/music/search?q=&source=` - Multi-source search
- `GET /api/music/download?url=&source=` - Download audio
- `GET /api/music/stream?url=` - Stream proxy
- `GET /api/music/recommendations` - Trending recommendations
- `GET /api/ai/chat?message=` - AI chat (GPT-5)
- `POST /api/upload` - CDN upload to kabox

## Music APIs
- YouTube: api.junzz.web.id (fallback: apii.kelvdra.my.id)
- Spotify: api.nexray.web.id
- Apple/SoundCloud: api.cuki.biz.id (apikey=cuki-x)

## External Services
- **GitHub**: akaanakbaik/musika
- **Vercel**: musika-one.vercel.app (production)
- **Supabase**: maiivetnuxnrqrnruyes.supabase.co

## Development Setup
```bash
pnpm install          # Install all workspace packages
pnpm run dev          # Start all workflows
```

## Vite Proxy (Development)
The music-player Vite dev server proxies `/api/*` to the API server on port 8080.

## Monorepo Structure
```
artifacts/
  music-player/    # React + Vite frontend
  api-server/      # Express 5 backend
  mockup-sandbox/  # Canvas/design sandbox
lib/
  api-client-react/
  api-spec/
  api-zod/
  db/
```
