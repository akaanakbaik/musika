import crypto from "crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import { query } from "../lib/db";
import { signToken, authMiddleware } from "../middlewares/auth";
import {
  detectBrowser,
  detectOS,
  maskIP,
} from "../lib/auth-helpers";

const router = Router();

// ===== BRANDING =====
const LOGO_URL = "https://raw.githubusercontent.com/IzukaDev0/My-cdn/main/Izuka-/2026-07-20_1784547746489_musika-new-logo.png";

// ===== RESEND CONFIGURATION (Primary) =====
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
let resendClient: Resend | null = null;
let resendFromEmail = process.env.RESEND_FROM_EMAIL || "";

if (RESEND_API_KEY) {
  try {
    resendClient = new Resend(RESEND_API_KEY);
    const domain = process.env.RESEND_DOMAIN || "akadev.me";
    resendFromEmail = process.env.RESEND_FROM_EMAIL || `musika@${domain}`;
    console.log(`[Auth] ✓ Resend SDK ready (from: ${resendFromEmail})`);
  } catch (err: any) {
    console.warn("[Auth] ⚠ Resend init error:", err.message);
  }
}

// ===== OPTIMAL SMTP CONFIGURATION (Fallback) =====
const SMTP = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_SECURE === "true" || false,
  user: process.env.SMTP_USER || "",
  pass: process.env.SMTP_PASS || "",
  fromName: process.env.SMTP_FROM_NAME || "Musika",
  fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "musika@akadev.me",
  maxRetries: parseInt(process.env.SMTP_MAX_RETRIES || "3", 10),
  rateLimitPerMinute: parseInt(process.env.SMTP_RATE_LIMIT || "10", 10),
};

// Auto-detect providers
if (RESEND_API_KEY) {
  console.log("[Auth] ✓ Resend API configured as primary email sender");
}
if (!process.env.SMTP_HOST && !process.env.SMTP_USER) {
  if (!RESEND_API_KEY) {
    console.log("[Auth] ⚠ No email provider configured. Set RESEND_API_KEY or SMTP_USER/SMTP_HOST.");
  }
} else {
  if (SMTP.host === "smtp.gmail.com") {
    console.log(`[Auth] SMTP fallback: Gmail (${SMTP.user.slice(0, 3)}***)`);
  } else if (SMTP.host?.includes("sendgrid")) {
    console.log(`[Auth] SMTP fallback: SendGrid (${SMTP.host})`);
  } else if (SMTP.host?.includes("mailgun")) {
    console.log(`[Auth] SMTP fallback: Mailgun (${SMTP.host})`);
  } else if (SMTP.host?.includes("resend")) {
    console.log(`[Auth] SMTP fallback: Resend (smtp.resend.com:${SMTP.port})`);
  } else {
    console.log(`[Auth] SMTP fallback: Custom (${SMTP.host}:${SMTP.port})`);
  }
}

// ===== NODEMAILER SMTP TRANSPORTER (Fallback) =====
let transporter: nodemailer.Transporter | null = null;
const emailQueue: Array<{ mail: nodemailer.SendMailOptions; retries: number }> = [];
let isProcessing = false;

if (SMTP.user && SMTP.pass) {
  try {
    transporter = nodemailer.createTransport({
      host: SMTP.host,
      port: SMTP.port,
      secure: SMTP.secure,
      auth: { user: SMTP.user, pass: SMTP.pass },
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
      rateDelta: 1000,
      rateLimit: 5,
      tls: {
        rejectUnauthorized: false,
        ciphers: "SSLv3",
      },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });

    // Verify connection (non-blocking)
    transporter.verify().then(() => {
      console.log("[Auth] ✓ SMTP connection verified successfully");
    }).catch((err) => {
      console.warn("[Auth] ⚠ SMTP verification failed (emails will queue):", err.message);
    });

    // Graceful pool cleanup on shutdown
    process.once("SIGTERM", () => {
      transporter?.close();
    });
    process.once("SIGINT", () => {
      transporter?.close();
    });
  } catch (err: any) {
    console.warn("[Auth] ⚠ SMTP init error:", err.message);
  }
}

// Graceful fallback transporter
function getTransporter(): nodemailer.Transporter {
  return transporter || ({
    sendMail: async () => {
      console.warn("[Auth] SMTP not configured — email not sent");
      return { accepted: [], rejected: [], messageId: "mock", envelope: { from: "", to: [] } };
    }
  } as unknown as nodemailer.Transporter);
}

// Email queue processor (retry with exponential backoff)
// ===== UNIFIED SEND EMAIL (Resend SDK → Nodemailer SMTP fallback) =====
async function sendEmail(options: { to: string; subject: string; html: string; text: string }): Promise<any> {
  // Primary: Try Resend SDK
  if (resendClient) {
    try {
      const from = `"Musika" <${resendFromEmail}>`;
      const { data, error } = await resendClient.emails.send({
        from,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      if (error) throw new Error(error.message || "Resend API error");
      return data;
    } catch (err: any) {
      console.warn(`[Auth] ⚠ Resend SDK failed, falling back to SMTP:`, err.message);
    }
  }

  // Fallback: Queue to nodemailer SMTP
  if (transporter) {
    const mailOptions: nodemailer.SendMailOptions = {
      from: `"${SMTP.fromName}" <${SMTP.fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };
    emailQueue.push({ mail: mailOptions, retries: 0 });
    if (!isProcessing) processEmailQueue();
    return { queued: true };
  }

  console.warn("[Auth] ⚠ No email provider available. Email NOT sent:", options.subject.slice(0, 50));
  return { failed: true };
}

async function processEmailQueue() {
  if (isProcessing || emailQueue.length === 0) return;
  isProcessing = true;

  while (emailQueue.length > 0) {
    const item = emailQueue.shift();
    if (!item) continue;

    try {
      await getTransporter().sendMail(item.mail);
    } catch (err: any) {
      if (item.retries < SMTP.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, item.retries), 30000);
        console.warn(`[Auth] Email SMTP failed (attempt ${item.retries + 1}/${SMTP.maxRetries}), retrying in ${delay}ms:`, err.message);
        await new Promise(r => setTimeout(r, delay));
        emailQueue.push({ mail: item.mail, retries: item.retries + 1 });
      } else {
        console.error("[Auth] Email SMTP failed after max retries:", err.message);
      }
    }
  }

  isProcessing = false;
}

// Generate 5-digit OTP
function generateOTP(): string {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

function detectDevice(ua: string): string {
  if (!ua) return "Unknown Device";
  if (ua.includes("iPhone")) return "iPhone";
  if (ua.includes("iPad")) return "iPad";
  if (ua.includes("Android") && ua.includes("Mobile")) return "Android Phone";
  if (ua.includes("Android")) return "Android Tablet";
  if (ua.includes("Windows")) return "Windows PC";
  if (ua.includes("Mac OS X") && !ua.includes("iPhone") && !ua.includes("iPad")) return "Mac";
  if (ua.includes("Linux")) return "Linux Desktop";
  return "Unknown Device";
}

function formatTime(date: Date, tz = "Asia/Jakarta"): string {
  return date.toLocaleString("id-ID", {
    timeZone: tz, weekday: "long", year: "numeric", month: "long",
    day: "numeric", hour: "2-digit", minute: "2-digit",
  }) + " WIB";
}

// ===== EMAIL STYLES =====
const EMAIL_STYLES = `
body{margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
.wrapper{max-width:560px;margin:0 auto;padding:32px 16px}
.card{background:#141414;border:1px solid #2a2a2a;border-radius:24px;overflow:hidden}
.header{background:linear-gradient(135deg,#0d2818,#081a0e);padding:36px 40px;text-align:center}
.logo{font-size:30px;font-weight:900;color:#ffffff;letter-spacing:-0.5px}
.logo span{color:#1DB954}
.content{padding:36px 40px}
h1{font-size:22px;font-weight:700;color:#ffffff;margin:0 0 12px 0;line-height:1.3}
p{font-size:14px;color:#9ca3af;line-height:1.7;margin:0 0 24px 0}
strong{color:#d1d5db}
.code-box{background:#0d0d0d;border:1px solid #2a2a2a;border-radius:16px;padding:28px;text-align:center;margin-bottom:24px}
.code{font-size:40px;font-weight:900;letter-spacing:12px;color:#1DB954;font-variant-numeric:tabular-nums;font-family:ui-monospace,monospace}
.expiry{font-size:12px;color:#525252;margin-top:12px}
.divider{height:1px;background:#2a2a2a;margin:24px 0}
.info-box{background:#0d0d0d;border:1px solid #2a2a2a;border-radius:12px;padding:20px;margin-bottom:24px}
.info-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:13px}
.info-label{color:#6b7280}
.info-value{color:#e5e7eb;font-weight:500}
.badge{display:inline-flex;align-items:center;gap:6px;background:#0d2818;border:1px solid #1DB95444;border-radius:8px;padding:10px 16px;font-size:13px;color:#1DB954;margin-bottom:24px}
.footer{padding:24px 40px;border-top:1px solid #2a2a2a;text-align:center}
.footer-text{font-size:11px;color:#525252;margin:0;line-height:1.6}
.btn{display:inline-block;background:#1DB954;color:#000000;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;margin:16px 0 0 0}
.btn:hover{background:#1ed760}
.highlight{color:#1DB954;font-weight:600}
`;

// ===== OTP EMAIL =====
function otpEmailHtml(code: string, email: string): string {
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Verifikasi Musika</title><style>${EMAIL_STYLES}</style></head><body><div class="wrapper"><div class="card"><div class="header"><img src="${LOGO_URL}" alt="Musika" width="64" height="64" style="display:block;margin:0 auto 10px auto;border-radius:16px"/><div class="logo">musi<span>ka</span></div></div><div class="content"><h1>Verifikasi alamat email</h1><p>Masukkan kode 5 digit di bawah ini di aplikasi <strong>Musika</strong> untuk memverifikasi <span class="highlight">${email}</span>.</p><div class="code-box"><div class="code">${code}</div><div class="expiry"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-right:4px"><circle cx="7" cy="7" r="6" stroke="#1DB954" stroke-width="1.5"/><path d="M7 4v3.5L9.5 9" stroke="#1DB954" stroke-width="1.5" stroke-linecap="round"/></svg> Kode berlaku <strong>5 menit</strong> &bull; Jangan bagikan kode ini ke siapa pun</div></div><div class="badge"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-right:4px"><rect x="3.5" y="6" width="7" height="6" rx="1" stroke="#1DB954" stroke-width="1.5"/><path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="#1DB954" stroke-width="1.5" stroke-linecap="round"/></svg> Aman — Kode ini hanya untuk verifikasi akun Musika kamu</div><p style="font-size:12px;color:#525252">Jika kamu tidak meminta kode ini, abaikan email ini. <br>Tidak perlu merespon email ini.</p></div><div class="footer"><p class="footer-text">© ${new Date().getFullYear()} Musika &bull; Email ini dikirim ke ${email}</p></div></div></div></body></html>`;
}

// ===== WELCOME EMAIL =====
function welcomeEmailHtml(email: string, username: string, ip: string, browser: string): string {
  const time = formatTime(new Date());
  const maskedIp = maskIP(ip);
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Selamat Datang!</title><style>${EMAIL_STYLES}</style></head><body><div class="wrapper"><div class="card"><div class="header"><img src="${LOGO_URL}" alt="Musika" width="64" height="64" style="display:block;margin:0 auto 10px auto;border-radius:16px"/><div class="logo">musi<span>ka</span></div></div><div class="content"><h1>Selamat bergabung, ${username}! <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-left:4px"><path d="M9 1l1.5 5 5 .5-3.8 3.2L13 15l-4-2.5L5 15l1.3-5.3L2.5 6.5l5-.5L9 1z" fill="#1DB954"/></svg></h1><p>Akun <strong>Musika</strong> kamu berhasil dibuat. Kamu sekarang bisa menikmati jutaan lagu dari berbagai sumber secara gratis.</p><div class="info-box"><div class="info-row"><span class="info-label">Akun</span><span class="info-value">${email}</span></div><div class="info-row"><span class="info-label">Waktu</span><span class="info-value">${time}</span></div>            <div class="info-row"><span class="info-label">Perangkat</span><span class="info-value">Web Browser</span></div><div class="info-row"><span class="info-label">Browser</span><span class="info-value">${browser}</span></div><div class="info-row"><span class="info-label">IP</span><span class="info-value">${maskedIp}</span></div></div><div class="badge"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-right:4px"><circle cx="8" cy="8" r="7" stroke="#1DB954" stroke-width="1.5"/><path d="M5 8.5l2 2 4-4" stroke="#1DB954" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Akun terverifikasi — Kamu bisa langsung menggunakan Musika</div></div><div class="footer"><p class="footer-text">© ${new Date().getFullYear()} Musika &bull; Email ini dikirim ke ${email}</p></div></div></div></body></html>`;
}

// ===== LOGIN NOTIFICATION EMAIL =====
function loginNotifHtml(email: string, username: string, ip: string, device: string, browser: string, os: string): string {
  const time = formatTime(new Date());
  const maskedIp = maskIP(ip);
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Login Baru</title><style>${EMAIL_STYLES}</style></head><body><div class="wrapper"><div class="card"><div class="header"><img src="${LOGO_URL}" alt="Musika" width="64" height="64" style="display:block;margin:0 auto 10px auto;border-radius:16px"/><div class="logo">musi<span>ka</span></div></div><div class="content"><h1>Login baru terdeteksi</h1><p>Ada login baru ke akun <strong>Musika</strong> kamu (<span class="highlight">${email}</span>). Berikut detailnya:</p><div class="info-box"><div class="info-row"><span class="info-label">Waktu</span><span class="info-value">${time}</span></div>            <div class="info-row"><span class="info-label">Perangkat</span><span class="info-value">Web Browser</span></div><div class="info-row"><span class="info-label">Sistem Operasi</span><span class="info-value">${os}</span></div><div class="info-row"><span class="info-label">Browser</span><span class="info-value">${browser}</span></div><div class="info-row"><span class="info-label">IP</span><span class="info-value">${maskedIp}</span></div></div><div class="badge"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-right:4px"><circle cx="8" cy="8" r="7" stroke="#1DB954" stroke-width="1.5"/><path d="M5 8.5l2 2 4-4" stroke="#1DB954" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Jika ini kamu, tidak perlu khawatir</div><p style="font-size:12px;color:#525252">Jika ini bukan kamu, segera ganti password melalui halaman Profile di aplikasi Musika.</p></div><div class="footer"><p class="footer-text">© ${new Date().getFullYear()} Musika &bull; Email ini dikirim ke ${email}</p></div></div></div></body></html>`;
}

// ===== PASSWORD RESET EMAIL =====
function resetPasswordHtml(email: string, code: string): string {
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Reset Password</title><style>${EMAIL_STYLES}</style></head><body><div class="wrapper"><div class="card"><div class="header"><img src="${LOGO_URL}" alt="Musika" width="64" height="64" style="display:block;margin:0 auto 10px auto;border-radius:16px"/><div class="logo">musi<span>ka</span></div></div><div class="content"><h1>Atur ulang password</h1><p>Kami menerima permintaan reset password untuk akun <strong>Musika</strong> (<span class="highlight">${email}</span>). Gunakan kode berikut:</p><div class="code-box"><div class="code">${code}</div><div class="expiry"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-right:4px"><circle cx="7" cy="7" r="6" stroke="#1DB954" stroke-width="1.5"/><path d="M7 4v3.5L9.5 9" stroke="#1DB954" stroke-width="1.5" stroke-linecap="round"/></svg> Kode berlaku <strong>5 menit</strong></div></div><p style="font-size:14px;color:#6b7280">Masukkan kode ini di aplikasi Musika untuk melanjutkan proses reset password.</p><div class="divider"></div><p style="font-size:12px;color:#525252">Jika kamu tidak meminta reset password, abaikan email ini.<br>Akun kamu tetap aman.</p></div><div class="footer"><p class="footer-text">© ${new Date().getFullYear()} Musika &bull; Email ini dikirim ke ${email}</p></div></div></div></body></html>`;
}

function plainTextFallback(subject: string, body: string): string {
  return `${subject}\n\n${body}\n\n— Musika`;
}

// ===== REGISTER =====
router.post("/auth/register", async (req, res) => {
  const { email, password, username } = req.body;
  if (!email || !password || !username) {
    return res.status(400).json({ success: false, error: "Email, password, dan username diperlukan" });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, error: "Password minimal 6 karakter" });
  }
  if (username.length < 3) {
    return res.status(400).json({ success: false, error: "Username minimal 3 karakter" });
  }

  try {
    const existing = await query("SELECT id FROM public.musika_users WHERE email = $1 OR username = $2", [email.toLowerCase(), username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: "Email atau username sudah terdaftar" });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO public.musika_users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, email, username, musika_id, created_at`,
      [email.toLowerCase(), username, hash]
    );

    const user = result.rows[0];
    const token = signToken({ userId: user.id, email: user.email, username: user.username });

    // Generate & send OTP
    const code = generateOTP();
    await query(
      `INSERT INTO public.musika_otp_codes (email, code, expires_at) VALUES ($1, $2, now() + interval '5 minutes')`,
      [email.toLowerCase(), code]
    );

    sendEmail({
      to: email,
      subject: `${code} — Kode verifikasi email Musika`,
      html: otpEmailHtml(code, email),
      text: plainTextFallback("Kode verifikasi Musika", `Kode OTP kamu: ${code}\n\nBerlaku 5 menit. Jangan bagikan kode ini ke siapa pun.`),
    });

    res.json({
      success: true,
      user: { id: user.id, email: user.email, username: user.username, musika_id: user.musika_id },
      token,
      needsOtp: true,
      message: "Kode verifikasi telah dikirim ke email",
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== LOGIN =====
router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: "Email dan password diperlukan" });
  }

  try {
    const result = await query(
      "SELECT id, email, username, password_hash, avatar_url, bio, musika_id, email_confirmed_at FROM public.musika_users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: "Email atau password salah" });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: "Email atau password salah" });
    }

    const token = signToken({ userId: user.id, email: user.email, username: user.username });

    // Send login notification (async) — only if email confirmed
    if (user.email_confirmed_at) {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "";
      const ua = req.headers["user-agent"] || "";
      const device = detectDevice(ua);
      const browser = detectBrowser(ua);
      const os = detectOS(ua);
      sendEmail({
        to: email,
        subject: `Login baru ke akun Musika — ${device}`,
        html: loginNotifHtml(email, user.username, ip, device, browser, os),
        text: plainTextFallback("Notifikasi Login Musika",
          `Ada login baru ke akun Musika kamu.\n\nPerangkat: ${device}\nBrowser: ${browser}\nWaktu: ${formatTime(new Date())}\n\nJika ini bukan kamu, segera ganti password.`),
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id, email: user.email, username: user.username,
        avatar_url: user.avatar_url, bio: user.bio,
        musika_id: user.musika_id,
        email_confirmed_at: user.email_confirmed_at,
      },
      token,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== GET SESSION =====
router.get("/auth/me", authMiddleware, async (req, res) => {
  try {
    const result = await query(
      "SELECT id, email, username, avatar_url, bio, musika_id, email_confirmed_at, created_at FROM public.musika_users WHERE id = $1",
      [req.user!.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    res.json({ success: true, user: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== UPDATE PROFILE =====
router.put("/auth/profile", authMiddleware, async (req, res) => {
  const { username, bio, avatar_url } = req.body;
  try {
    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (username !== undefined) { updates.push(`username = $${idx++}`); params.push(username); }
    if (bio !== undefined) { updates.push(`bio = $${idx++}`); params.push(bio); }
    if (avatar_url !== undefined) { updates.push(`avatar_url = $${idx++}`); params.push(avatar_url); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: "No fields to update" });
    }

    updates.push(`updated_at = now()`);
    params.push(req.user!.userId);

    await query(`UPDATE public.musika_users SET ${updates.join(", ")} WHERE id = $${idx}`, params);

    const profileUpdates: string[] = [];
    const profileParams: any[] = [];
    let pidx = 1;
    if (username !== undefined) { profileUpdates.push(`username = $${pidx++}`); profileParams.push(username); }
    if (bio !== undefined) { profileUpdates.push(`bio = $${pidx++}`); profileParams.push(bio); }
    if (avatar_url !== undefined) { profileUpdates.push(`avatar_url = $${pidx++}`); profileParams.push(avatar_url); }

    if (profileUpdates.length > 0) {
      profileUpdates.push(`updated_at = now()`);
      profileParams.push(req.user!.userId);
      await query(`UPDATE public.musika_user_profiles SET ${profileUpdates.join(", ")} WHERE id = $${pidx}`, profileParams);
    }

    const result = await query(
      "SELECT id, email, username, avatar_url, bio, musika_id, email_confirmed_at FROM public.musika_users WHERE id = $1",
      [req.user!.userId]
    );

    res.json({ success: true, user: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== SEND OTP =====
router.post("/auth/otp/send", async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@")) return res.status(400).json({ success: false, error: "Email valid diperlukan" });

  const code = generateOTP();
  try {
    await query(`DELETE FROM public.musika_otp_codes WHERE email = $1 OR expires_at < now()`, [email.toLowerCase()]);
    await query(
      `INSERT INTO public.musika_otp_codes (email, code, expires_at) VALUES ($1, $2, now() + interval '5 minutes')`,
      [email.toLowerCase(), code]
    );

    sendEmail({
      to: email,
      subject: `${code} — Kode verifikasi email Musika`,
      html: otpEmailHtml(code, email),
      text: plainTextFallback("Kode verifikasi Musika", `Kode OTP kamu: ${code}\n\nBerlaku 5 menit.`),
    });

    res.json({ success: true, message: "Kode verifikasi telah dikirim ke email" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Gagal mengirim kode: " + err.message });
  }
});

// ===== VERIFY OTP =====
router.post("/auth/otp/verify", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ success: false, error: "Email dan kode diperlukan" });

  try {
    const { rows } = await query(
      `SELECT * FROM public.musika_otp_codes WHERE email = $1 AND used = false AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase()]
    );

    if (!rows.length) {
      return res.status(400).json({ success: false, error: "Kode tidak valid atau kedaluwarsa. Silakan minta kode baru." });
    }

    const otpRow = rows[0];

    if (otpRow.attempts >= 5) {
      await query(`UPDATE public.musika_otp_codes SET used = true WHERE id = $1`, [otpRow.id]);
      return res.status(429).json({ success: false, error: "Terlalu banyak percobaan. Silakan minta kode baru." });
    }

    const submittedCode = String(code ?? "").trim();
    const storedCode = String(otpRow.code);
    if (!submittedCode || storedCode.length !== submittedCode.length ||
        !crypto.timingSafeEqual(Buffer.from(storedCode), Buffer.from(submittedCode))) {
      await query(`UPDATE public.musika_otp_codes SET attempts = attempts + 1 WHERE id = $1`, [otpRow.id]);
      const remaining = 4 - otpRow.attempts;
      return res.status(400).json({ success: false, error: `Kode salah. Sisa ${remaining} percobaan.` });
    }

    await query(`UPDATE public.musika_otp_codes SET used = true WHERE id = $1`, [otpRow.id]);
    await query(`UPDATE public.musika_users SET email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = $1`, [email.toLowerCase()]);

    // Send welcome email (async)
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "";
    const ua = req.headers["user-agent"] || "";
    const device = detectDevice(ua);
    const browser = detectBrowser(ua);
    const userResult = await query("SELECT username FROM public.musika_users WHERE email = $1", [email.toLowerCase()]);
    const username = userResult.rows[0]?.username || email.split("@")[0];

    sendEmail({
      to: email,
      subject: `Selamat bergabung di Musika, ${username}!`,
      html: welcomeEmailHtml(email, username, ip, browser),
      text: plainTextFallback("Selamat bergabung di Musika!",
        `Hai ${username},\n\nAkun Musika kamu berhasil diverifikasi.\n\nSekarang kamu bisa mencari dan menikmati jutaan lagu!`),
    });

    res.json({ success: true, message: "Email berhasil diverifikasi. Selamat datang di Musika!" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Verifikasi gagal: " + err.message });
  }
});

// ===== RESEND OTP =====
router.post("/auth/otp/resend", async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@")) return res.status(400).json({ success: false, error: "Email valid diperlukan" });

  const code = generateOTP();
  try {
    await query(`DELETE FROM public.musika_otp_codes WHERE email = $1 OR expires_at < now()`, [email.toLowerCase()]);
    await query(
      `INSERT INTO public.musika_otp_codes (email, code, expires_at) VALUES ($1, $2, now() + interval '5 minutes')`,
      [email.toLowerCase(), code]
    );

    sendEmail({
      to: email,
      subject: `${code} — Kode verifikasi baru Musika`,
      html: otpEmailHtml(code, email),
      text: plainTextFallback("Kode verifikasi baru", `Kode OTP baru kamu: ${code}\n\nBerlaku 5 menit.`),
    });

    res.json({ success: true, message: "Kode baru telah dikirim ke email" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Gagal mengirim ulang: " + err.message });
  }
});

// ===== FORGOT PASSWORD (request reset) =====
router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@")) return res.status(400).json({ success: false, error: "Email valid diperlukan" });

  const code = generateOTP();
  try {
    // Check if user exists (don't reveal for security)
    const userCheck = await query("SELECT id FROM public.musika_users WHERE email = $1", [email.toLowerCase()]);
    if (userCheck.rows.length === 0) {
      return res.json({ success: true, message: "Jika email terdaftar, kode reset akan dikirim" });
    }

    await query(`DELETE FROM public.musika_otp_codes WHERE email = $1 OR expires_at < now()`, [email.toLowerCase()]);
    await query(
      `INSERT INTO public.musika_otp_codes (email, code, expires_at) VALUES ($1, $2, now() + interval '5 minutes')`,
      [email.toLowerCase(), code]
    );

    sendEmail({
      to: email,
      subject: `${code} — Kode reset password Musika`,
      html: resetPasswordHtml(email, code),
      text: plainTextFallback("Reset Password Musika",
        `Kode reset password kamu: ${code}\n\nBerlaku 5 menit.\nJika kamu tidak meminta reset, abaikan email ini.`),
    });

    res.json({ success: true, message: "Jika email terdaftar, kode reset akan dikirim" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Gagal memproses: " + err.message });
  }
});

// ===== RESET PASSWORD (with code) =====
router.post("/auth/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ success: false, error: "Email, kode, dan password baru diperlukan" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, error: "Password minimal 6 karakter" });
  }

  try {
    const { rows } = await query(
      `SELECT * FROM public.musika_otp_codes WHERE email = $1 AND used = false AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase()]
    );

    if (!rows.length) {
      return res.status(400).json({ success: false, error: "Kode tidak valid atau kedaluwarsa" });
    }

    const otpRow = rows[0];
    const submittedCode = String(code ?? "").trim();
    const storedCode = String(otpRow.code);
    if (!submittedCode || storedCode.length !== submittedCode.length ||
        !crypto.timingSafeEqual(Buffer.from(storedCode), Buffer.from(submittedCode))) {
      await query(`UPDATE public.musika_otp_codes SET attempts = attempts + 1 WHERE id = $1`, [otpRow.id]);
      return res.status(400).json({ success: false, error: "Kode yang dimasukkan salah" });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await query(`UPDATE public.musika_users SET password_hash = $1, updated_at = now() WHERE email = $2`, [hash, email.toLowerCase()]);
    await query(`UPDATE public.musika_otp_codes SET used = true WHERE id = $1`, [otpRow.id]);

    res.json({ success: true, message: "Password berhasil diubah. Silakan login dengan password baru." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Gagal reset password: " + err.message });
  }
});

// ===== REFRESH TOKEN =====
router.post("/auth/refresh", authMiddleware, async (req, res) => {
  try {
    const freshToken = signToken({
      userId: req.user!.userId,
      email: req.user!.email,
      username: req.user!.username
    });
    res.json({ success: true, token: freshToken });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== GET PUBLIC USER PROFILE =====
router.get("/users/:id", async (req, res) => {
  try {
    const result = await query(
      "SELECT id, username, bio, avatar_url, musika_id, created_at FROM public.musika_users WHERE id = $1",
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    res.json({ success: true, profile: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
