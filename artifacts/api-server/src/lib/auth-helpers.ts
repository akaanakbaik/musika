// Pure helper functions — no DB, no network, no side effects
// Shared between auth.ts routes and unit tests

export function generateOTP(): string {
  // 5-digit code (range 10000-99999) — matches the login/register OTP flow.
  return Math.floor(10000 + Math.random() * 90000).toString();
}

export function detectBrowser(ua: string): string {
  if (!ua) return "Unknown Browser";
  if (ua.includes("Chrome") && !ua.includes("Edg") && !ua.includes("OPR")) return "Google Chrome";
  if (ua.includes("Firefox")) return "Mozilla Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Apple Safari";
  if (ua.includes("Edg")) return "Microsoft Edge";
  if (ua.includes("OPR") || ua.includes("Opera")) return "Opera";
  return "Unknown Browser";
}

export function detectOS(ua: string): string {
  if (!ua) return "Unknown";
  if (ua.includes("Windows NT 10")) return "Windows 10/11";
  if (ua.includes("Windows NT 6.3")) return "Windows 8.1";
  if (ua.includes("Windows NT 6.1")) return "Windows 7";
  if (ua.includes("Mac OS X")) return "macOS";
  if (ua.includes("Linux") && ua.includes("Android")) return "Android";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  return "Unknown OS";
}

export function maskIP(ip: string): string {
  if (!ip || ip === "::1" || ip === "127.0.0.1") return "Local Network";
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":") + ":xxxx";
  return ip;
}
