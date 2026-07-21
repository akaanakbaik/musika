# MUSIKA

<p align="center">
  <img src="https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png" width="120" height="120" alt="MUSIKA Logo">
</p>

<p align="center">
  <strong>🎵 Native Android Music Player — Multi-Source, Smart, and Beautiful</strong>
</p>

<p align="center">
  <a href="https://github.com/akaanakbaik/musika-apk/releases/latest">
    <img src="https://img.shields.io/badge/Download-APK-brightgreen?logo=github" alt="Download">
  </a>
  <a href="https://api-server-flax-xi.vercel.app/api/health">
    <img src="https://img.shields.io/badge/API-Online-success?logo=vercel" alt="API Status">
  </a>
  <img src="https://img.shields.io/badge/Flutter-3.29-blue?logo=flutter" alt="Flutter">
  <img src="https://img.shields.io/badge/Platform-Android-brightgreen?logo=android" alt="Android">
</p>

---

## 📱 Fitur Lengkap

| Fitur | Status | Endpoint |
|-------|--------|----------|
| 🔍 **Multi-Source Search** | ✅ | `/api/music/search?q=&source=all` |
| ▶️ **Play Music** | ✅ | `/api/music/prepare?url=&source=` |
| ⬇️ **Download Musik** | ✅ | `/api/music/download?url=&source=` |
| ❤️ **Favorites** | ✅ | `/api/favorites` |
| 📂 **Playlists** | ✅ | `/api/playlists` |
| 📜 **History** | ✅ | `/api/history` |
| 🤖 **AI Chat** | ✅ | `/api/ai/chat` |
| 👤 **Auth (Login/Register)** | ✅ | `/api/auth/*` |

## 🎯 Cara Download APK

### Oppo A58 / Device Modern (arm64-v8a)
[⬇️ Download MUSIKA v1.0.2 (13.7 MB)](https://github.com/akaanakbaik/musika-apk/releases/latest)

### Semua Device
Buka → [github.com/akaanakbaik/musika-apk/releases](https://github.com/akaanakbaik/musika-apk/releases)

<details>
<summary>📋 Panduan Install APK</summary>

1. Download file `.apk` dari link di atas
2. Buka file di perangkat Android
3. Izinkan **"Install from unknown sources"** jika diminta
4. Buka aplikasi **MUSIKA**
5. Selesai! 🎉

> ⚠️ Android mungkin menampilkan peringatan "Unrecognized app" — ini normal untuk APK yang di-sideload. Tap **"Install anyway"** untuk melanjutkan.
</details>

## 🏗️ Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| **Mobile App** | Flutter 3.29+ (Dart) |
| **Backend API** | Bun + Express 5 (TypeScript) |
| **Database** | NeonDB (PostgreSQL) |
| **Email** | Resend |
| **Deployment** | Vercel (serverless) |
| **CDN** | izukaprivate (upload, max 5MB) |

## 🔌 Backend API

**Base URL:** `https://api-server-flax-xi.vercel.app`

### Endpoints Detail

#### Health Check
```bash
curl https://api-server-flax-xi.vercel.app/api/health
# → {"status":"ok","uptime":"Xs"}
```

#### Search Music (Multi-Source)
```bash
curl "https://api-server-flax-xi.vercel.app/api/music/search?q=lagu+indonesia&source=all"
```

#### Search Per Source
```bash
curl "https://api-server-flax-xi.vercel.app/api/music/search/youtube?q=lagu"
curl "https://api-server-flax-xi.vercel.app/api/music/search/spotify?q=lagu"
curl "https://api-server-flax-xi.vercel.app/api/music/search/apple?q=lagu"
curl "https://api-server-flax-xi.vercel.app/api/music/search/soundcloud?q=lagu"
```

#### Play Music (Stream)
```bash
curl "https://api-server-flax-xi.vercel.app/api/music/prepare?url=YOUTUBE_URL&source=youtube"
```

#### Download Music
```bash
curl "https://api-server-flax-xi.vercel.app/api/music/download?url=YOUTUBE_URL&source=youtube"
```

#### Recommendations
```bash
curl "https://api-server-flax-xi.vercel.app/api/music/recommendations"
```

#### Authentication
```bash
# Register
curl -X POST "https://api-server-flax-xi.vercel.app/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@email.com","password":"password123","username":"user123"}'

# Login
curl -X POST "https://api-server-flax-xi.vercel.app/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@email.com","password":"password123"}'
```

## 📦 Source Code

### Backend (Repo: `akaanakbaik/musika`)
```bash
git clone https://github.com/akaanakbaik/musika.git
cd musika/artifacts/api-server
bun install
bun run dev
```

### Flutter App (Repo: `akaanakbaik/musika-apk`)
```bash
git clone https://github.com/akaanakbaik/musika-apk.git
cd musika-apk
flutter pub get
flutter build apk --release --split-per-abi
```

## 📊 Rilis APK

| Versi | Tanggal | Ukuran | Catatan |
|-------|---------|--------|---------|
| v1.0.2 | 21 Jul 2026 | 13.7 MB | ✅ Fix: fallback recommendations, CI matrix build |
| v1.0.1 | 19 Jul 2026 | 12.8 MB | Fix: widget tests, analyzer warnings |
| v1.0.0 | 19 Jul 2026 | 13.0 MB | ✨ Rilis perdana |

## 🔐 Izin Aplikasi

MUSIKA membutuhkan izin berikut untuk berfungsi optimal:

| Izin | Kegunaan |
|------|----------|
| INTERNET | Streaming & download musik |
| FOREGROUND_SERVICE | Putar musik di latar belakang |
| POST_NOTIFICATIONS | Kontrol pemutaran dari notifikasi |
| READ/WRITE_EXTERNAL_STORAGE | Simpan musik offline |
| ACCESS_NETWORK_STATE | Deteksi koneksi internet |

---

<p align="center">
  <strong>MUSIKA</strong> — Made with ❤️<br>
  📧 musika@akadev.me
</p>
