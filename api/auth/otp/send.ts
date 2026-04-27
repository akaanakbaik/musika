/// <reference lib="dom" />
import { Client } from "pg";
import nodemailer from "nodemailer";

export const config = { maxDuration: 30 };

const SUPABASE_DB_URL = "postgresql://postgres.maiivetnuxnrqrnruyes:Akaanakbaik17!@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";
const SMTP_USER = process.env.SMTP_USER || "furinabyaka@gmail.com";
const SMTP_PASS = process.env.SMTP_PASS || "aovwvudbcmvumxou";

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function emailHtml(code: string, email: string) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e0e0e0}.wrap{display:flex;align-items:center;justify-content:center;padding:40px 16px}.card{max-width:480px;width:100%;background:#141414;border:1px solid #2a2a2a;border-radius:20px;overflow:hidden}.hdr{background:linear-gradient(135deg,#0f2a1a,#0a1a0f);padding:40px;text-align:center;border-bottom:1px solid #1a1a1a}.brand{font-size:28px;font-weight:800;color:#fff}.brand span{color:#1DB954}.tag{font-size:13px;color:#666;margin-top:6px}.bod{padding:40px}.ttl{font-size:22px;font-weight:700;color:#fff;margin-bottom:8px}.sub{font-size:14px;color:#666;line-height:1.6;margin-bottom:28px}.otp-box{background:#0f0f0f;border:1px solid #2a2a2a;border-radius:14px;padding:28px;text-align:center;margin-bottom:28px}.lbl{font-size:11px;font-weight:600;color:#555;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px}.code{font-size:44px;font-weight:900;letter-spacing:14px;color:#1DB954;text-indent:14px}.exp{margin-top:12px;font-size:12px;color:#444}.note{background:#0d1a0d;border:1px solid #1a2e1a;border-radius:10px;padding:14px 18px}.note p{font-size:12px;color:#4a7a4a;line-height:1.5}.ftr{padding:24px 40px;border-top:1px solid #1a1a1a;text-align:center}.ftr p{font-size:12px;color:#3a3a3a;line-height:1.7}</style></head><body><div class="wrap"><div class="card"><div class="hdr"><div class="brand">musi<span>ka</span></div><div class="tag">Your music, everywhere</div></div><div class="bod"><div class="ttl">Verify your email address</div><p class="sub">Enter this 6-digit code in Musika to complete your registration. Code sent to <strong style="color:#888">${email}</strong>.</p><div class="otp-box"><div class="lbl">Verification Code</div><div class="code">${code}</div><div class="exp">Expires in <strong style="color:#666">10 minutes</strong></div></div><div class="note"><p><strong style="color:#5a9a5a">🔒</strong> If you didn't create a Musika account, ignore this email.</p></div></div><div class="ftr"><p>Sent to ${email} · © ${year} Musika</p></div></div></div></body></html>`;
}

const transport = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch {} }

  const { email } = body || {};
  if (!email || !email.includes("@")) return res.status(400).json({ success: false, error: "Valid email required" });

  const code = generateOTP();
  const emailLower = email.toLowerCase().trim();

  const db = new Client({ connectionString: SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  try {
    await db.connect();
    await db.query("DELETE FROM public.otp_codes WHERE email = $1 OR expires_at < now()", [emailLower]);
    await db.query(
      "INSERT INTO public.otp_codes (email, code, expires_at) VALUES ($1, $2, now() + interval '10 minutes')",
      [emailLower, code]
    );
    await db.end();

    await transport.sendMail({
      from: `"Musika" <${SMTP_USER}>`,
      to: email,
      subject: `${code} — Your Musika verification code`,
      html: emailHtml(code, email),
    });

    res.json({ success: true, message: "OTP sent to email" });
  } catch (err: any) {
    await db.end().catch(() => {});
    console.error("OTP send error:", err.message);
    res.status(500).json({ success: false, error: "Failed to send: " + err.message });
  }
}
