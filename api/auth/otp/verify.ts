/// <reference lib="dom" />
import { Client } from "pg";

export const config = { maxDuration: 30 };

const SUPABASE_DB_URL = "postgresql://postgres.maiivetnuxnrqrnruyes:Akaanakbaik17!@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch {} }

  const { email, code } = body || {};
  if (!email || !code) return res.status(400).json({ success: false, error: "Email and code required" });

  const emailLower = email.toLowerCase().trim();
  const codeClean = String(code).trim();

  const db = new Client({ connectionString: SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  try {
    await db.connect();

    const { rows } = await db.query(
      "SELECT * FROM public.otp_codes WHERE email = $1 AND used = false AND expires_at > now() ORDER BY created_at DESC LIMIT 1",
      [emailLower]
    );

    if (!rows.length) {
      await db.end();
      return res.status(400).json({ success: false, error: "Code expired or not found. Request a new one." });
    }

    const row = rows[0];

    if (row.attempts >= 5) {
      await db.query("UPDATE public.otp_codes SET used = true WHERE id = $1", [row.id]);
      await db.end();
      return res.status(429).json({ success: false, error: "Too many attempts. Request a new code." });
    }

    if (row.code !== codeClean) {
      await db.query("UPDATE public.otp_codes SET attempts = attempts + 1 WHERE id = $1", [row.id]);
      const remaining = 4 - row.attempts;
      await db.end();
      return res.status(400).json({ success: false, error: `Wrong code. ${remaining} attempt${remaining !== 1 ? "s" : ""} left.` });
    }

    await db.query("UPDATE public.otp_codes SET used = true WHERE id = $1", [row.id]);
    await db.query(
      "UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now()), confirmation_token = '' WHERE email = $1",
      [emailLower]
    );
    await db.end();

    res.json({ success: true });
  } catch (err: any) {
    await db.end().catch(() => {});
    console.error("OTP verify error:", err.message);
    res.status(500).json({ success: false, error: "Verification failed: " + err.message });
  }
}
