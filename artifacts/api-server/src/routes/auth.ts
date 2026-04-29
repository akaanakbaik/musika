import { Router } from "express";
import nodemailer from "nodemailer";
import pkg from "pg";
const { Client } = pkg;

const router = Router();

const DB_URL =
  process.env.SUPABASE_DB_URL ||
  "postgresql://postgres.maiivetnuxnrqrnruyes:Akaanakbaik17!@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

const SMTP_USER = process.env.SMTP_USER || "furinabyaka@gmail.com";
const SMTP_PASS = process.env.SMTP_PASS || "aovwvudbcmvumxou";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

function getDbClient() {
  return new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function detectBrowser(ua: string): string {
  if (!ua) return "Browser tidak diketahui";
  if (ua.includes("Chrome") && !ua.includes("Edg") && !ua.includes("OPR")) return "Google Chrome";
  if (ua.includes("Firefox")) return "Mozilla Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Apple Safari";
  if (ua.includes("Edg")) return "Microsoft Edge";
  if (ua.includes("OPR") || ua.includes("Opera")) return "Opera";
  if (ua.includes("SamsungBrowser")) return "Samsung Internet";
  return "Browser tidak diketahui";
}

function detectDevice(ua: string): string {
  if (!ua) return "Perangkat tidak diketahui";
  if (ua.includes("iPhone")) return "iPhone";
  if (ua.includes("iPad")) return "iPad";
  if (ua.includes("Android") && ua.includes("Mobile")) return "Android (HP)";
  if (ua.includes("Android")) return "Android (Tablet)";
  if (ua.includes("Windows")) return "Windows PC";
  if (ua.includes("Mac OS X") && !ua.includes("iPhone") && !ua.includes("iPad")) return "Mac";
  if (ua.includes("Linux")) return "Linux";
  return "Perangkat tidak diketahui";
}

function formatTime(date: Date, tz = "Asia/Jakarta"): string {
  return date.toLocaleString("id-ID", {
    timeZone: tz, weekday: "long", year: "numeric", month: "long",
    day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"
  }) + " WIB";
}

/* ─────────────── OTP email template ─────────────────── */
function otpEmailHtml(code: string, email: string) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verifikasi Musika</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#0a0a0a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#e0e0e0; }
    .wrapper { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:40px 16px; }
    .card { max-width:480px; width:100%; background:#141414; border:1px solid #2a2a2a; border-radius:20px; overflow:hidden; }
    .header { background:linear-gradient(135deg,#0f2a1a 0%,#0a1a0f 100%); padding:40px 40px 36px; text-align:center; border-bottom:1px solid #1a1a1a; }
    .logo-wrap { display:inline-flex; align-items:center; justify-content:center; width:64px; height:64px; background:#1a1a1a; border:2px solid #1DB954; border-radius:16px; margin-bottom:20px; }
    .logo-wrap img { width:40px; height:40px; }
    .brand { font-size:28px; font-weight:800; color:#ffffff; letter-spacing:-0.5px; }
    .brand span { color:#1DB954; }
    .tagline { font-size:13px; color:#666; margin-top:6px; letter-spacing:0.5px; }
    .body { padding:40px; }
    .greeting { font-size:15px; color:#888; margin-bottom:8px; }
    .title { font-size:22px; font-weight:700; color:#fff; margin-bottom:20px; }
    .desc { font-size:14px; color:#666; line-height:1.6; margin-bottom:32px; }
    .otp-container { background:#0f0f0f; border:1px solid #2a2a2a; border-radius:14px; padding:28px; text-align:center; margin-bottom:32px; }
    .otp-label { font-size:11px; font-weight:600; color:#555; letter-spacing:2px; text-transform:uppercase; margin-bottom:16px; }
    .otp-code { font-size:44px; font-weight:900; letter-spacing:14px; color:#1DB954; font-variant-numeric:tabular-nums; text-indent:14px; }
    .otp-expiry { margin-top:14px; font-size:12px; color:#444; }
    .otp-expiry strong { color:#666; }
    .divider { display:flex; align-items:center; gap:12px; margin-bottom:24px; }
    .divider-line { flex:1; height:1px; background:#1f1f1f; }
    .divider-text { font-size:11px; color:#444; }
    .steps { display:grid; gap:14px; margin-bottom:32px; }
    .step { display:flex; gap:14px; align-items:flex-start; }
    .step-num { min-width:26px; height:26px; border-radius:50%; background:#1DB954; color:#000; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; margin-top:1px; }
    .step-text { font-size:14px; color:#777; line-height:1.5; }
    .step-text strong { color:#aaa; }
    .footer { padding:24px 40px; border-top:1px solid #1a1a1a; text-align:center; }
    .footer-text { font-size:12px; color:#3a3a3a; line-height:1.7; }
    .footer-text a { color:#555; text-decoration:none; }
    .security-note { background:#0d1a0d; border:1px solid #1a2e1a; border-radius:10px; padding:14px 18px; margin-bottom:24px; }
    .security-note p { font-size:12px; color:#4a7a4a; line-height:1.5; }
    .security-note strong { color:#5a9a5a; }
  </style>
</head>
<body>
  <div class="wrapper"><div class="card">
    <div class="header">
      <div class="logo-wrap"><img src="https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png" alt="Musika" /></div>
      <div class="brand">musi<span>ka</span></div>
      <div class="tagline">Musikmu, di mana saja</div>
    </div>
    <div class="body">
      <p class="greeting">Halo! 👋</p>
      <h1 class="title">Verifikasi alamat emailmu</h1>
      <p class="desc">Untuk menyelesaikan pendaftaran di Musika, masukkan kode 6 digit di bawah ini di dalam aplikasi. Kode ini memverifikasi bahwa <strong style="color:#888">${email}</strong> adalah milikmu.</p>
      <div class="otp-container">
        <div class="otp-label">Kode verifikasimu</div>
        <div class="otp-code">${code}</div>
        <div class="otp-expiry">Berlaku selama <strong>10 menit</strong></div>
      </div>
      <div class="divider"><div class="divider-line"></div><div class="divider-text">Cara verifikasi</div><div class="divider-line"></div></div>
      <div class="steps">
        <div class="step"><div class="step-num">1</div><div class="step-text">Buka <strong>Musika</strong> dan pergi ke halaman pendaftaran</div></div>
        <div class="step"><div class="step-num">2</div><div class="step-text">Masukkan <strong>kode 6 digit</strong> di atas</div></div>
        <div class="step"><div class="step-num">3</div><div class="step-text">Akunmu akan <strong>langsung terverifikasi</strong></div></div>
      </div>
      <div class="security-note"><p><strong>🔒 Catatan keamanan:</strong> Jika kamu tidak membuat akun Musika, kamu bisa mengabaikan email ini dengan aman. Alamat emailmu tidak akan digunakan.</p></div>
    </div>
    <div class="footer"><p class="footer-text">Email ini dikirim ke ${email}<br />© ${new Date().getFullYear()} Musika · <a href="https://musika-one.vercel.app">musika-one.vercel.app</a></p></div>
  </div></div>
</body>
</html>`;
}

/* ─────────────── Welcome email template ──────────────── */
function welcomeEmailHtml(email: string, username: string, ip: string, device: string, browser: string) {
  const time = formatTime(new Date());
  const displayName = username || email.split("@")[0];
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Selamat Datang di Musika</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#0a0a0a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#e0e0e0; }
    .wrapper { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:40px 16px; }
    .card { max-width:480px; width:100%; background:#141414; border:1px solid #2a2a2a; border-radius:20px; overflow:hidden; }
    .hero { background:linear-gradient(135deg,#0f2a1a 0%,#0a1a0f 100%); padding:48px 40px; text-align:center; }
    .emoji { font-size:48px; margin-bottom:16px; display:block; }
    .logo-wrap { display:inline-flex; align-items:center; justify-content:center; width:64px; height:64px; background:#1a1a1a; border:2px solid #1DB954; border-radius:16px; margin-bottom:16px; }
    .logo-wrap img { width:40px; height:40px; }
    .brand { font-size:28px; font-weight:800; color:#fff; }
    .brand span { color:#1DB954; }
    .body { padding:40px; }
    h1 { font-size:24px; font-weight:700; color:#fff; margin-bottom:12px; }
    .subtitle { font-size:14px; color:#666; line-height:1.6; margin-bottom:28px; }
    .welcome-box { background:linear-gradient(135deg,#0f2a1a,#0d1f15); border:1px solid #1a3a22; border-radius:14px; padding:24px; margin-bottom:24px; text-align:center; }
    .welcome-box .name { font-size:20px; font-weight:800; color:#1DB954; margin-bottom:4px; }
    .welcome-box .sub { font-size:13px; color:#4a8a5a; }
    .features { display:grid; gap:12px; margin-bottom:28px; }
    .feature { display:flex; align-items:center; gap:14px; padding:14px; background:#1a1a1a; border-radius:12px; }
    .feature-icon { font-size:20px; }
    .feature-text { font-size:13px; color:#888; }
    .feature-text strong { color:#bbb; display:block; margin-bottom:2px; }
    .cta { display:block; background:#1DB954; color:#000; font-size:14px; font-weight:700; text-align:center; padding:16px; border-radius:12px; text-decoration:none; margin-bottom:24px; }
    .info-box { background:#111; border:1px solid #1f1f1f; border-radius:12px; padding:16px 20px; margin-bottom:24px; }
    .info-title { font-size:11px; color:#444; font-weight:600; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:12px; }
    .info-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
    .info-row:last-child { margin-bottom:0; }
    .info-label { font-size:12px; color:#555; }
    .info-value { font-size:12px; color:#888; font-weight:500; }
    .footer { padding:24px 40px; border-top:1px solid #1a1a1a; text-align:center; }
    .footer-text { font-size:11px; color:#333; line-height:1.8; }
    .footer-text a { color:#444; }
  </style>
</head>
<body>
  <div class="wrapper"><div class="card">
    <div class="hero">
      <div class="logo-wrap"><img src="https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png" alt="Musika" /></div>
      <div class="brand">musi<span>ka</span></div>
    </div>
    <div class="body">
      <h1>🎉 Selamat bergabung!</h1>
      <p class="subtitle">Akun Musika kamu berhasil dibuat. Kini kamu bisa menikmati jutaan lagu dari berbagai sumber, semuanya gratis.</p>
      <div class="welcome-box">
        <div class="name">Hai, ${displayName}! 👋</div>
        <div class="sub">Selamat datang di komunitas Musika</div>
      </div>
      <div class="features">
        <div class="feature"><span class="feature-icon">🎵</span><div class="feature-text"><strong>Multi-source streaming</strong>YouTube, Spotify, Apple Music & SoundCloud</div></div>
        <div class="feature"><span class="feature-icon">🤖</span><div class="feature-text"><strong>Musika AI</strong>Asisten musik personal berbasis AI</div></div>
        <div class="feature"><span class="feature-icon">📱</span><div class="feature-text"><strong>PWA & Offline</strong>Unduh dan putar offline kapan saja</div></div>
        <div class="feature"><span class="feature-icon">📋</span><div class="feature-text"><strong>Playlist & Library</strong>Buat dan kelola koleksi musikmu</div></div>
      </div>
      <a href="https://musika-one.vercel.app" class="cta">Mulai Dengarkan Sekarang →</a>
      <div class="info-box">
        <div class="info-title">Detail Pendaftaran</div>
        <div class="info-row"><span class="info-label">Email</span><span class="info-value">${email}</span></div>
        <div class="info-row"><span class="info-label">Waktu</span><span class="info-value">${time}</span></div>
        <div class="info-row"><span class="info-label">IP Address</span><span class="info-value">${ip}</span></div>
        <div class="info-row"><span class="info-label">Perangkat</span><span class="info-value">${device}</span></div>
        <div class="info-row"><span class="info-label">Browser</span><span class="info-value">${browser}</span></div>
      </div>
      <p style="font-size:12px;color:#444;line-height:1.6">Jika kamu tidak mendaftar di Musika, abaikan email ini. Tidak ada yang bisa mengakses akunmu tanpa verifikasi.</p>
    </div>
    <div class="footer"><p class="footer-text">Email ini dikirim ke ${email}<br />© ${new Date().getFullYear()} Musika · <a href="https://musika-one.vercel.app">musika-one.vercel.app</a></p></div>
  </div></div>
</body>
</html>`;
}

/* ─────────────── Login notification email ────────────── */
function loginNotifHtml(email: string, username: string, ip: string, device: string, browser: string) {
  const time = formatTime(new Date());
  const displayName = username || email.split("@")[0];
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Login Musika</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#0a0a0a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#e0e0e0; }
    .wrapper { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:40px 16px; }
    .card { max-width:480px; width:100%; background:#141414; border:1px solid #2a2a2a; border-radius:20px; overflow:hidden; }
    .header { background:linear-gradient(135deg,#1a1a2e,#0a0a1a); padding:40px; text-align:center; border-bottom:1px solid #1f1f1f; }
    .logo-wrap { display:inline-flex; align-items:center; justify-content:center; width:56px; height:56px; background:#1a1a1a; border:2px solid #1DB954; border-radius:14px; margin-bottom:14px; }
    .logo-wrap img { width:34px; height:34px; }
    .brand { font-size:22px; font-weight:800; color:#fff; }
    .brand span { color:#1DB954; }
    .body { padding:36px; }
    .alert-icon { font-size:40px; text-align:center; margin-bottom:16px; }
    h1 { font-size:22px; font-weight:700; color:#fff; margin-bottom:10px; }
    .sub { font-size:14px; color:#666; line-height:1.6; margin-bottom:24px; }
    .login-box { background:#0f1f1a; border:1px solid #1a3a2a; border-radius:14px; padding:20px 24px; margin-bottom:24px; }
    .login-row { display:flex; justify-content:space-between; align-items:flex-start; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05); }
    .login-row:last-child { border-bottom:none; padding-bottom:0; }
    .login-label { font-size:12px; color:#4a7a5a; font-weight:600; }
    .login-value { font-size:13px; color:#ccc; font-weight:500; text-align:right; max-width:60%; }
    .safe-badge { display:inline-flex; align-items:center; gap:8px; background:#0d2a1a; border:1px solid #1DB954; border-radius:10px; padding:10px 16px; margin-bottom:20px; font-size:13px; color:#1DB954; font-weight:600; }
    .not-you { background:#1a0f0f; border:1px solid #3a1a1a; border-radius:12px; padding:16px; text-align:center; }
    .not-you p { font-size:12px; color:#885555; line-height:1.6; }
    .not-you a { color:#cc6666; font-weight:600; text-decoration:none; }
    .footer { padding:20px 36px; border-top:1px solid #1a1a1a; text-align:center; }
    .footer p { font-size:11px; color:#333; line-height:1.8; }
    .footer a { color:#444; }
  </style>
</head>
<body>
  <div class="wrapper"><div class="card">
    <div class="header">
      <div class="logo-wrap"><img src="https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png" alt="Musika" /></div>
      <div class="brand">musi<span>ka</span></div>
    </div>
    <div class="body">
      <div class="alert-icon">🎵</div>
      <h1>Selamat datang kembali, ${displayName}!</h1>
      <p class="sub">Kami mendeteksi login baru ke akun Musika kamu. Berikut detail sesinya:</p>
      <div class="login-box">
        <div class="login-row"><span class="login-label">Waktu</span><span class="login-value">${time}</span></div>
        <div class="login-row"><span class="login-label">IP Address</span><span class="login-value">${ip}</span></div>
        <div class="login-row"><span class="login-label">Perangkat</span><span class="login-value">${device}</span></div>
        <div class="login-row"><span class="login-label">Browser</span><span class="login-value">${browser}</span></div>
        <div class="login-row"><span class="login-label">Email</span><span class="login-value">${email}</span></div>
      </div>
      <div class="safe-badge">✅ Ini adalah kamu? Tidak perlu khawatir, semuanya aman.</div>
      <div class="not-you">
        <p>Bukan kamu yang login? <a href="https://musika-one.vercel.app">Segera amankan akunmu</a> dengan mengubah kata sandi atau menghubungi dukungan kami.</p>
      </div>
    </div>
    <div class="footer"><p>Email ini dikirim ke ${email}<br />© ${new Date().getFullYear()} Musika · <a href="https://musika-one.vercel.app">musika-one.vercel.app</a></p></div>
  </div></div>
</body>
</html>`;
}

/* ─────────────── Routes ──────────────────────────────── */
router.post("/auth/otp/send", async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@")) return res.status(400).json({ success: false, error: "Email valid diperlukan" });

  const code = generateOTP();
  const db = getDbClient();

  try {
    await db.connect();
    await db.query(`DELETE FROM public.otp_codes WHERE email = $1 OR expires_at < now()`, [email.toLowerCase()]);
    await db.query(
      `INSERT INTO public.otp_codes (email, code, expires_at) VALUES ($1, $2, now() + interval '10 minutes')`,
      [email.toLowerCase(), code]
    );
    await db.end();

    await transporter.sendMail({
      from: `"Musika" <${SMTP_USER}>`,
      to: email,
      subject: `${code} — Kode verifikasi Musika kamu`,
      html: otpEmailHtml(code, email),
    });

    res.json({ success: true, message: "OTP telah dikirim ke email" });
  } catch (err: any) {
    await db.end().catch(() => {});
    res.status(500).json({ success: false, error: "Gagal mengirim OTP: " + err.message });
  }
});

router.post("/auth/otp/verify", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ success: false, error: "Email dan kode diperlukan" });

  const db = getDbClient();
  try {
    await db.connect();

    const { rows } = await db.query(
      `SELECT * FROM public.otp_codes WHERE email = $1 AND used = false AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase()]
    );

    if (!rows.length) {
      await db.end();
      return res.status(400).json({ success: false, error: "Kode kedaluwarsa atau tidak ditemukan. Minta kode baru." });
    }

    const otpRow = rows[0];

    if (otpRow.attempts >= 5) {
      await db.query(`UPDATE public.otp_codes SET used = true WHERE id = $1`, [otpRow.id]);
      await db.end();
      return res.status(429).json({ success: false, error: "Terlalu banyak percobaan. Minta kode baru." });
    }

    if (otpRow.code !== code.trim()) {
      await db.query(`UPDATE public.otp_codes SET attempts = attempts + 1 WHERE id = $1`, [otpRow.id]);
      const remaining = 4 - otpRow.attempts;
      await db.end();
      return res.status(400).json({ success: false, error: `Kode salah. Sisa ${remaining} percobaan.` });
    }

    // Check if this is first time verification (new user)
    const { rows: userRows } = await db.query(
      `SELECT email_confirmed_at FROM auth.users WHERE email = $1`,
      [email.toLowerCase()]
    );
    const isNewUser = userRows.length > 0 && !userRows[0].email_confirmed_at;

    await db.query(`UPDATE public.otp_codes SET used = true WHERE id = $1`, [otpRow.id]);
    await db.query(
      `UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now()), confirmation_token = '' WHERE email = $1`,
      [email.toLowerCase()]
    );
    await db.end();

    // Send welcome email for new users (async, don't block response)
    if (isNewUser) {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "Tidak diketahui";
      const ua = req.headers["user-agent"] || "";
      const device = detectDevice(ua);
      const browser = detectBrowser(ua);
      transporter.sendMail({
        from: `"Musika" <${SMTP_USER}>`,
        to: email,
        subject: `🎵 Selamat bergabung di Musika, ${email.split("@")[0]}!`,
        html: welcomeEmailHtml(email, email.split("@")[0], ip, device, browser),
      }).catch(err => console.error("Welcome email error:", err));
    }

    res.json({ success: true, isNewUser });
  } catch (err: any) {
    await db.end().catch(() => {});
    res.status(500).json({ success: false, error: "Verifikasi gagal: " + err.message });
  }
});

router.post("/auth/otp/resend", async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@")) return res.status(400).json({ success: false, error: "Email valid diperlukan" });

  const code = generateOTP();
  const db = getDbClient();

  try {
    await db.connect();
    await db.query(`DELETE FROM public.otp_codes WHERE email = $1 OR expires_at < now()`, [email.toLowerCase()]);
    await db.query(
      `INSERT INTO public.otp_codes (email, code, expires_at) VALUES ($1, $2, now() + interval '10 minutes')`,
      [email.toLowerCase(), code]
    );
    await db.end();

    await transporter.sendMail({
      from: `"Musika" <${SMTP_USER}>`,
      to: email,
      subject: `${code} — Kode verifikasi Musika baru`,
      html: otpEmailHtml(code, email),
    });

    res.json({ success: true, message: "OTP baru telah dikirim" });
  } catch (err: any) {
    await db.end().catch(() => {});
    res.status(500).json({ success: false, error: "Gagal mengirim ulang: " + err.message });
  }
});

/* ─── Send login notification email ───────────────────── */
router.post("/auth/send-login-notif", async (req, res) => {
  const { email, username } = req.body;
  if (!email) return res.status(400).json({ success: false, error: "Email diperlukan" });

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "Tidak diketahui";
  const ua = req.headers["user-agent"] || "";
  const device = detectDevice(ua);
  const browser = detectBrowser(ua);

  try {
    await transporter.sendMail({
      from: `"Musika Security" <${SMTP_USER}>`,
      to: email,
      subject: `🔐 Login baru ke akun Musika kamu`,
      html: loginNotifHtml(email, username || email.split("@")[0], ip, device, browser),
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
