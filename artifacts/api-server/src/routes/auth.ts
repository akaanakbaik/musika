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

function otpEmailHtml(code: string, email: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Musika Verification</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #e0e0e0; }
    .wrapper { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 40px 16px; }
    .card { max-width: 480px; width: 100%; background: #141414; border: 1px solid #2a2a2a; border-radius: 20px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0f2a1a 0%, #0a1a0f 100%); padding: 40px 40px 36px; text-align: center; border-bottom: 1px solid #1a1a1a; }
    .logo-wrap { display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; background: #1a1a1a; border: 2px solid #1DB954; border-radius: 16px; margin-bottom: 20px; }
    .logo-wrap img { width: 40px; height: 40px; }
    .brand { font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
    .brand span { color: #1DB954; }
    .tagline { font-size: 13px; color: #666; margin-top: 6px; letter-spacing: 0.5px; }
    .body { padding: 40px; }
    .greeting { font-size: 15px; color: #888; margin-bottom: 8px; }
    .title { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 20px; }
    .desc { font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 32px; }
    .otp-container { background: #0f0f0f; border: 1px solid #2a2a2a; border-radius: 14px; padding: 28px; text-align: center; margin-bottom: 32px; }
    .otp-label { font-size: 11px; font-weight: 600; color: #555; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 16px; }
    .otp-code { font-size: 44px; font-weight: 900; letter-spacing: 14px; color: #1DB954; font-variant-numeric: tabular-nums; text-indent: 14px; }
    .otp-expiry { margin-top: 14px; font-size: 12px; color: #444; }
    .otp-expiry strong { color: #666; }
    .divider { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
    .divider-line { flex: 1; height: 1px; background: #1f1f1f; }
    .divider-text { font-size: 11px; color: #444; }
    .steps { display: grid; gap: 14px; margin-bottom: 32px; }
    .step { display: flex; gap: 14px; align-items: flex-start; }
    .step-num { min-width: 26px; height: 26px; border-radius: 50%; background: #1DB954; color: #000; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
    .step-text { font-size: 14px; color: #777; line-height: 1.5; }
    .step-text strong { color: #aaa; }
    .footer { padding: 24px 40px; border-top: 1px solid #1a1a1a; text-align: center; }
    .footer-text { font-size: 12px; color: #3a3a3a; line-height: 1.7; }
    .footer-text a { color: #555; text-decoration: none; }
    .security-note { background: #0d1a0d; border: 1px solid #1a2e1a; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px; }
    .security-note p { font-size: 12px; color: #4a7a4a; line-height: 1.5; }
    .security-note strong { color: #5a9a5a; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="logo-wrap">
          <img src="https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png" alt="Musika" />
        </div>
        <div class="brand">musi<span>ka</span></div>
        <div class="tagline">Your music, everywhere</div>
      </div>
      <div class="body">
        <p class="greeting">Hello there 👋</p>
        <h1 class="title">Verify your email address</h1>
        <p class="desc">To complete your Musika registration, enter the 6-digit code below in the app. This code verifies that <strong style="color:#888">${email}</strong> belongs to you.</p>

        <div class="otp-container">
          <div class="otp-label">Your verification code</div>
          <div class="otp-code">${code}</div>
          <div class="otp-expiry">Expires in <strong>10 minutes</strong></div>
        </div>

        <div class="divider">
          <div class="divider-line"></div>
          <div class="divider-text">How to verify</div>
          <div class="divider-line"></div>
        </div>

        <div class="steps">
          <div class="step">
            <div class="step-num">1</div>
            <div class="step-text">Open <strong>Musika</strong> and go to the registration page</div>
          </div>
          <div class="step">
            <div class="step-num">2</div>
            <div class="step-text">Enter the <strong>6-digit code</strong> shown above</div>
          </div>
          <div class="step">
            <div class="step-num">3</div>
            <div class="step-text">Your account will be <strong>verified instantly</strong></div>
          </div>
        </div>

        <div class="security-note">
          <p><strong>🔒 Security note:</strong> If you didn't create a Musika account, you can safely ignore this email. Your email address will not be used.</p>
        </div>
      </div>
      <div class="footer">
        <p class="footer-text">
          This email was sent to ${email}<br />
          © ${new Date().getFullYear()} Musika · <a href="https://musika-one.vercel.app">musika-one.vercel.app</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

router.post("/auth/otp/send", async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ success: false, error: "Valid email required" });
  }

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
      subject: `${code} — Your Musika verification code`,
      html: otpEmailHtml(code, email),
    });

    res.json({ success: true, message: "OTP sent to email" });
  } catch (err: any) {
    await db.end().catch(() => {});
    console.error("OTP send error:", err);
    res.status(500).json({ success: false, error: "Failed to send OTP: " + err.message });
  }
});

router.post("/auth/otp/verify", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ success: false, error: "Email and code required" });
  }

  const db = getDbClient();
  try {
    await db.connect();

    const { rows } = await db.query(
      `SELECT * FROM public.otp_codes WHERE email = $1 AND used = false AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase()]
    );

    if (!rows.length) {
      await db.end();
      return res.status(400).json({ success: false, error: "Code expired or not found. Request a new one." });
    }

    const otpRow = rows[0];

    if (otpRow.attempts >= 5) {
      await db.query(`UPDATE public.otp_codes SET used = true WHERE id = $1`, [otpRow.id]);
      await db.end();
      return res.status(429).json({ success: false, error: "Too many attempts. Request a new code." });
    }

    if (otpRow.code !== code.trim()) {
      await db.query(`UPDATE public.otp_codes SET attempts = attempts + 1 WHERE id = $1`, [otpRow.id]);
      const remaining = 4 - otpRow.attempts;
      await db.end();
      return res.status(400).json({ success: false, error: `Wrong code. ${remaining} attempt${remaining !== 1 ? "s" : ""} left.` });
    }

    await db.query(`UPDATE public.otp_codes SET used = true WHERE id = $1`, [otpRow.id]);
    await db.query(
      `UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now()), confirmation_token = '' WHERE email = $1`,
      [email.toLowerCase()]
    );
    await db.end();

    res.json({ success: true });
  } catch (err: any) {
    await db.end().catch(() => {});
    console.error("OTP verify error:", err);
    res.status(500).json({ success: false, error: "Verification failed: " + err.message });
  }
});

router.post("/auth/otp/resend", async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ success: false, error: "Valid email required" });
  }

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
      subject: `${code} — Your Musika verification code`,
      html: otpEmailHtml(code, email),
    });

    res.json({ success: true, message: "New OTP sent to email" });
  } catch (err: any) {
    await db.end().catch(() => {});
    res.status(500).json({ success: false, error: "Failed to resend: " + err.message });
  }
});

export default router;
