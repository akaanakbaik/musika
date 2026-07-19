import { Router } from "express";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { query } from "../lib/db";
import { signToken, authMiddleware } from "../middlewares/auth";

const router = Router();

const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";

if (!SMTP_USER || !SMTP_PASS) {
  console.warn("[Auth] SMTP credentials not set. Email features (OTP, notifications) will fail.");
}

let transporter: any = {
  sendMail: async () => {
    console.warn("[Auth] SMTP not configured, email not sent");
    return { accepted: [], rejected: [], messageId: "", envelope: { from: "", to: [] } };
  }
};

try {
  if (SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
} catch (err) {
  console.warn("[Auth] SMTP init failed:", err);
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

// ===== OTP Email Template =====
function otpEmailHtml(code: string, email: string) {
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Verifikasi Musika</title><style>body{background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e0e0e0;margin:0;padding:40px 16px}.card{max-width:480px;margin:0 auto;background:#141414;border:1px solid #2a2a2a;border-radius:20px;overflow:hidden}.header{background:linear-gradient(135deg,#0f2a1a,#0a1a0f);padding:40px;text-align:center}.brand{font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px}.brand span{color:#1DB954}.body{padding:40px}.title{font-size:22px;font-weight:700;color:#fff;margin-bottom:20px}.desc{font-size:14px;color:#666;line-height:1.6;margin-bottom:32px}.otp-box{background:#0f0f0f;border:1px solid #2a2a2a;border-radius:14px;padding:28px;text-align:center;margin-bottom:32px}.otp-code{font-size:44px;font-weight:900;letter-spacing:14px;color:#1DB954;font-variant-numeric:tabular-nums}.otp-expiry{font-size:12px;color:#444;margin-top:14px}.footer{text-align:center;padding:24px 40px;border-top:1px solid #1a1a1a;font-size:12px;color:#3a3a3a}</style></head><body><div class="card"><div class="header"><div class="brand">musi<span>ka</span></div></div><div class="body"><h1 class="title">Verifikasi alamat emailmu</h1><p class="desc">Masukkan kode 6 digit di bawah ini di aplikasi Musika untuk memverifikasi <strong style="color:#888">${email}</strong>.</p><div class="otp-box"><div class="otp-code">${code}</div><div class="otp-expiry">Berlaku selama <strong>10 menit</strong></div></div></div><div class="footer">Email ini dikirim ke ${email}</div></div></body></html>`;
}

function welcomeEmailHtml(email: string, username: string, ip: string, device: string, browser: string) {
  const time = formatTime(new Date());
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Selamat Datang di Musika</title><style>body{background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e0e0e0;margin:0;padding:40px 16px}.card{max-width:480px;margin:0 auto;background:#141414;border:1px solid #2a2a2a;border-radius:20px}.hero{background:linear-gradient(135deg,#0f2a1a,#0a1a0f);padding:48px 40px;text-align:center}.brand{font-size:28px;font-weight:800;color:#fff}.brand span{color:#1DB954}.body{padding:40px}h1{font-size:24px;color:#fff}.subtitle{font-size:14px;color:#666;margin-bottom:28px}.welcome-box{background:linear-gradient(135deg,#0f2a1a,#0d1f15);border:1px solid #1a3a22;border-radius:14px;padding:24px;margin-bottom:24px;text-align:center}.name{font-size:20px;font-weight:800;color:#1DB954}.info-box{background:#111;border:1px solid #1f1f1f;border-radius:12px;padding:16px 20px;margin-bottom:24px}.info-row{display:flex;justify-content:space-between;margin-bottom:8px;font-size:12px;color:#888}.footer{padding:24px 40px;border-top:1px solid #1a1a1a;text-align:center;font-size:11px;color:#333}</style></head><body><div class="card"><div class="hero"><div class="brand">musi<span>ka</span></div></div><div class="body"><h1>🎉 Selamat bergabung!</h1><p class="subtitle">Akun Musika kamu berhasil dibuat. Kini kamu bisa menikmati jutaan lagu dari berbagai sumber, gratis!</p><div class="welcome-box"><div class="name">Hai, ${username}! 👋</div></div><div class="info-box"><div class="info-row"><span>Email</span><span>${email}</span></div><div class="info-row"><span>Waktu</span><span>${time}</span></div><div class="info-row"><span>Perangkat</span><span>${device}</span></div><div class="info-row"><span>Browser</span><span>${browser}</span></div></div></div><div class="footer">Email ini dikirim ke ${email}</div></div></body></html>`;
}

function loginNotifHtml(email: string, username: string, ip: string, device: string, browser: string) {
  const time = formatTime(new Date());
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Login Musika</title><style>body{background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e0e0e0;margin:0;padding:40px 16px}.card{max-width:480px;margin:0 auto;background:#141414;border:1px solid #2a2a2a;border-radius:20px}.hero{background:linear-gradient(135deg,#1a1a2e,#0a0a1a);padding:40px;text-align:center}.brand{font-size:22px;font-weight:800;color:#fff}.brand span{color:#1DB954}.body{padding:36px}h1{font-size:22px;color:#fff;margin-bottom:10px}.sub{font-size:14px;color:#666;margin-bottom:24px}.login-box{background:#0f1f1a;border:1px solid #1a3a2a;border-radius:14px;padding:20px 24px;margin-bottom:24px}.login-row{display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;color:#ccc}.safe-badge{display:flex;align-items:center;gap:8px;background:#0d2a1a;border:1px solid #1DB954;border-radius:10px;padding:10px 16px;margin-bottom:20px;font-size:13px;color:#1DB954}</style></head><body><div class="card"><div class="hero"><div class="brand">musi<span>ka</span></div></div><div class="body"><h1>🎵 Selamat datang kembali, ${username}!</h1><p class="sub">Kami mendeteksi login baru ke akun Musika kamu:</p><div class="login-box"><div class="login-row"><span>Waktu</span><span>${time}</span></div><div class="login-row"><span>Perangkat</span><span>${device}</span></div><div class="login-row"><span>Browser</span><span>${browser}</span></div></div><div class="safe-badge">✅ Ini adalah kamu? Aman.</div></div><div class="footer">Email ini dikirim ke ${email}</div></div></body></html>`;
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

  try {
    // Check if email exists
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

    // Send OTP for email verification
    const code = generateOTP();
    await query(
      `INSERT INTO public.musika_otp_codes (email, code, expires_at) VALUES ($1, $2, now() + interval '10 minutes')`,
      [email.toLowerCase(), code]
    );

    // Send OTP email (don't block)
    transporter.sendMail({
      from: `"Musika" <${SMTP_USER}>`,
      to: email,
      subject: `${code} — Kode verifikasi Musika kamu`,
      html: otpEmailHtml(code, email),
    }).catch(e => console.error("OTP email error:", e));

    res.json({
      success: true,
      user: { id: user.id, email: user.email, username: user.username, musika_id: user.musika_id },
      token,
      needsOtp: true,
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

    // Send login notification (async)
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "";
    const ua = req.headers["user-agent"] || "";
    const device = detectDevice(ua);
    const browser = detectBrowser(ua);
    transporter.sendMail({
      from: `"Musika Security" <${SMTP_USER}>`,
      to: email,
      subject: `🔐 Login baru ke akun Musika kamu`,
      html: loginNotifHtml(email, user.username, ip, device, browser),
    }).catch(() => {});

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

// ===== GET SESSION / PROFILE =====
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

    await query(
      `UPDATE public.musika_users SET ${updates.join(", ")} WHERE id = $${idx}`,
      params
    );

    // Also update user_profiles
    const profileUpdates: string[] = [];
    const profileParams: any[] = [];
    let pidx = 1;
    if (username !== undefined) { profileUpdates.push(`username = $${pidx++}`); profileParams.push(username); }
    if (bio !== undefined) { profileUpdates.push(`bio = $${pidx++}`); profileParams.push(bio); }
    if (avatar_url !== undefined) { profileUpdates.push(`avatar_url = $${pidx++}`); profileParams.push(avatar_url); }

    if (profileUpdates.length > 0) {
      profileUpdates.push(`updated_at = now()`);
      profileParams.push(req.user!.userId);
      await query(
        `UPDATE public.musika_user_profiles SET ${profileUpdates.join(", ")} WHERE id = $${pidx}`,
        profileParams
      );
    }

    // Return updated user
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
      `INSERT INTO public.musika_otp_codes (email, code, expires_at) VALUES ($1, $2, now() + interval '10 minutes')`,
      [email.toLowerCase(), code]
    );

    await transporter.sendMail({
      from: `"Musika" <${SMTP_USER}>`,
      to: email,
      subject: `${code} — Kode verifikasi Musika kamu`,
      html: otpEmailHtml(code, email),
    });

    res.json({ success: true, message: "OTP telah dikirim ke email" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Gagal mengirim OTP: " + err.message });
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
      return res.status(400).json({ success: false, error: "Kode kedaluwarsa atau tidak ditemukan. Minta kode baru." });
    }

    const otpRow = rows[0];

    if (otpRow.attempts >= 5) {
      await query(`UPDATE public.musika_otp_codes SET used = true WHERE id = $1`, [otpRow.id]);
      return res.status(429).json({ success: false, error: "Terlalu banyak percobaan. Minta kode baru." });
    }

    if (otpRow.code !== code.trim()) {
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
    transporter.sendMail({
      from: `"Musika" <${SMTP_USER}>`,
      to: email,
      subject: `🎵 Selamat bergabung di Musika, ${username}!`,
      html: welcomeEmailHtml(email, username, ip, device, browser),
    }).catch(() => {});

    res.json({ success: true, isNewUser: true });
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
      `INSERT INTO public.musika_otp_codes (email, code, expires_at) VALUES ($1, $2, now() + interval '10 minutes')`,
      [email.toLowerCase(), code]
    );

    await transporter.sendMail({
      from: `"Musika" <${SMTP_USER}>`,
      to: email,
      subject: `${code} — Kode verifikasi Musika baru`,
      html: otpEmailHtml(code, email),
    });

    res.json({ success: true, message: "OTP baru telah dikirim" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Gagal mengirim ulang: " + err.message });
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
