# Musika Backend API

Musika is a music streaming platform backend API built with Express + TypeScript.

## Tech Stack

- **Runtime:** Node.js 22
- **Framework:** Express 5
- **Language:** TypeScript
- **Database:** PostgreSQL (NeonDB)
- **Email:** Resend + Nodemailer
- **Deployment:** Vercel

## API Endpoints

### Health
- `GET /api/health` — Server status

### Authentication
- `POST /api/auth/register` — Register new user
- `POST /api/auth/login` — Login user
- `POST /api/auth/refresh` — Refresh JWT token
- `GET /api/auth/me` — Get current user session
- `PUT /api/auth/profile` — Update profile
- `POST /api/auth/otp/send` — Send OTP code
- `POST /api/auth/otp/verify` — Verify OTP code
- `POST /api/auth/forgot-password` — Request password reset
- `POST /api/auth/reset-password` — Reset password with code

### Music
- `GET /api/search/spotify?q=<query>` — Search Spotify
- `GET /api/search/youtube?q=<query>` — Search YouTube
- `GET /api/search/applemusic?q=<query>` — Search Apple Music
- `GET /api/search/soundcloud?q=<query>` — Search SoundCloud

### Other
- `POST /api/webhook` — Resend email webhook
- `POST /api/upload` — File upload
- `POST /api/ai/chat` — AI Chat

## Deployment

```bash
vercel --prod
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing key |
| `RESEND_API_KEY` | Resend email API key |
| `RESEND_DOMAIN` | Email sending domain |
| `RESEND_FROM_EMAIL` | From address for emails |
| `WEBHOOK_SIGNING_SECRET` | Webhook verification secret |

---

📱 **[Download Musika APK](https://github.com/akaanakbaik/musika-apk/releases)**

📧 Contact: musika@akadev.me
