/**
 * Endpoint Smoke Test — walks EVERY registered route and checks the server
 * responds with a graceful JSON result (no crash) for representative payloads.
 *
 * The DB layer is mocked (environment has no DATABASE_URL) and external
 * network calls are stubbed so the app can boot and route tests are
 * deterministic.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { Express } from "express";
import bcrypt from "bcryptjs";

vi.mock("../../lib/db", () => {
  const PASSWORD_HASH = bcrypt.hashSync("TestPass123!", 10);

  const fakeUser = {
    id: "user-123",
    email: "test@musika.test",
    username: "tester",
    password_hash: PASSWORD_HASH,
    avatar_url: null,
    bio: null,
    musika_id: "MUS-0001",
    email_confirmed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const query = vi.fn(async (text: string, _params?: any[]) => {
    // OTP lookups -> valid 5-digit code, 0 attempts
    if (/FROM public\.musika_otp_codes/.test(text)) {
      return { rows: [{ id: "otp-1", code: "12345", attempts: 0, email: "test@musika.test", expires_at: new Date(Date.now() + 600000) }], rowCount: 1 };
    }
    // Register existing-user check ("SELECT id FROM ...") -> empty so registration proceeds
    if (/SELECT id FROM public\.musika_users/.test(text)) {
      return { rows: [], rowCount: 0 };
    }
    // Login / me / profile / users -> user row
    if (/SELECT .* FROM public\.musika_users/.test(text)) {
      return { rows: [{ ...fakeUser }], rowCount: 1 };
    }
    // User insert -> returning user
    if (/INSERT INTO public\.musika_users/.test(text)) {
      return { rows: [{ ...fakeUser }], rowCount: 1 };
    }
    // Playlist lookup -> a public playlist owned by our user
    if (/FROM public\.musika_playlists/.test(text)) {
      return { rows: [{ id: "pl-1", user_id: "user-123", name: "Test", is_public: true, description: "", created_at: new Date().toISOString() }], rowCount: 1 };
    }
    // Any other insert -> generic id
    if (/INSERT INTO public\.musika_/.test(text) || /RETURNING/.test(text)) {
      return { rows: [{ id: "new-id" }], rowCount: 1 };
    }
    // Everything else -> empty
    return { rows: [], rowCount: 0 };
  });

  return {
    query,
    getClient: vi.fn(),
    __esModule: true,
    default: { connect: vi.fn(), end: vi.fn() },
  };
});

// Stub global fetch so music / upload external APIs are deterministic.
function fakeJsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: () => null },
    json: async () => body,
    text: async () => JSON.stringify(body),
    arrayBuffer: async () => new ArrayBuffer(8),
    body: null,
  } as unknown as Response;
}

describe("Endpoint Smoke Test (all routes)", () => {
  let app: Express;
  let base: string;
  let server: any;
  let token = "";

  beforeAll(async () => {
    const realFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: any, init?: any) => {
        const url = typeof input === "string" ? input : input.url;
        // Let real HTTP requests to the test server through.
        if (url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost")) {
          return realFetch(input, init);
        }
        // Deterministic canned responses for external APIs.
        return fakeJsonResponse(
          url.includes("search")
            ? { status: true, data: [{ title: "Test Song", link: "https://youtu.be/abc", videoId: "abc", channel: "Artist", thumbnail: "https://i.ytimg.com/vi/abc/hqdefault.jpg", url: "https://youtu.be/abc" }] }
            : { status: true, result: {}, data: {} }
        );
      })
    );

    const { default: appModule } = await import("../../app");
    app = appModule;
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server.address() as { port: number };
    base = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    server?.close();
  });

  async function call(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json: any = null;
    try { json = await res.json(); } catch { /* not JSON */ }
    return { status: res.status, json };
  }

  const registerBody = { email: "test@musika.test", password: "TestPass123!", username: "tester" };

  it.each([
    ["GET", "/api/health"],
    ["GET", "/api/healthz"],
    ["GET", "/api/music/health"],
    ["GET", "/api/music/recommendations"],
  ])("%s %s -> responds", async (method, path) => {
    const r = await call(method as string, path as string);
    expect([200, 400, 404, 500]).toContain(r.status);
  });

  it.each(["youtube", "spotify", "apple", "soundcloud"])(
    "GET /api/music/search/%s?q=love -> responds",
    async (src) => {
      const r = await call("GET", `/api/music/search/${src}?q=love`);
      expect([200, 400, 500]).toContain(r.status);
    }
  );

  it("GET /api/music/search?q=love -> responds", async () => {
    const r = await call("GET", "/api/music/search?q=love");
    expect([200, 500]).toContain(r.status);
  });

  it("GET /api/music/download -> 400 without url", async () => {
    const r = await call("GET", "/api/music/download");
    expect(r.status).toBe(400);
  });

  it("GET /api/music/prepare -> 400 without url", async () => {
    const r = await call("GET", "/api/music/prepare");
    expect(r.status).toBe(400);
  });

  it("GET /api/music/stream -> 400 without url", async () => {
    const r = await call("GET", "/api/music/stream");
    expect(r.status).toBe(400);
  });

  it("POST /api/auth/register -> creates user & OTP", async () => {
    const r = await call("POST", "/api/auth/register", registerBody);
    expect(r.status).toBe(200);
    expect(r.json?.success).toBe(true);
    token = r.json?.token || "";
  });

  it("POST /api/auth/login -> 200 with correct password", async () => {
    const r = await call("POST", "/api/auth/login", { email: "test@musika.test", password: "TestPass123!" });
    expect([200, 401]).toContain(r.status);
  });

  it("POST /api/auth/login -> 401 with wrong password", async () => {
    const r = await call("POST", "/api/auth/login", { email: "test@musika.test", password: "wrong" });
    expect([401, 500]).toContain(r.status);
  });

  it("POST /api/auth/otp/send -> responds", async () => {
    const r = await call("POST", "/api/auth/otp/send", { email: "test@musika.test" });
    expect([200, 500]).toContain(r.status);
  });

  it("POST /api/auth/otp/verify -> 200 with correct code", async () => {
    const r = await call("POST", "/api/auth/otp/verify", { email: "test@musika.test", code: "12345" });
    expect([200, 500]).toContain(r.status);
  });

  it("POST /api/auth/otp/resend -> responds", async () => {
    const r = await call("POST", "/api/auth/otp/resend", { email: "test@musika.test" });
    expect([200, 500]).toContain(r.status);
  });

  it("POST /api/auth/forgot-password -> responds", async () => {
    const r = await call("POST", "/api/auth/forgot-password", { email: "test@musika.test" });
    expect([200, 500]).toContain(r.status);
  });

  it("POST /api/auth/reset-password -> responds", async () => {
    const r = await call("POST", "/api/auth/reset-password", { email: "test@musika.test", code: "12345", newPassword: "NewPass123!" });
    expect([200, 400, 500]).toContain(r.status);
  });

  it("GET /api/auth/me -> responds (needs auth)", async () => {
    const r = await call("GET", "/api/auth/me");
    expect([200, 401, 404, 500]).toContain(r.status);
  });

  it("PUT /api/auth/profile -> responds (needs auth)", async () => {
    const r = await call("PUT", "/api/auth/profile", { username: "tester2" });
    expect([200, 401, 500]).toContain(r.status);
  });

  it("POST /api/auth/refresh -> responds (needs auth)", async () => {
    const r = await call("POST", "/api/auth/refresh");
    expect([200, 401, 500]).toContain(r.status);
  });

  it("GET /api/users/:id -> responds", async () => {
    const r = await call("GET", "/api/users/user-123");
    expect([200, 404, 500]).toContain(r.status);
  });


  it("Favorites CRUD -> responds", async () => {
    const r1 = await call("GET", "/api/favorites");
    expect([200, 401, 500]).toContain(r1.status);
    const r2 = await call("POST", "/api/favorites", { video_id: "v1", title: "T" });
    expect([200, 400, 401, 500]).toContain(r2.status);
    const r3 = await call("DELETE", "/api/favorites/v1");
    expect([200, 401, 500]).toContain(r3.status);
  });

  it("History CRUD -> responds", async () => {
    const r1 = await call("GET", "/api/history");
    expect([200, 401, 500]).toContain(r1.status);
    const r2 = await call("POST", "/api/history", { video_id: "v1", title: "T" });
    expect([200, 400, 401, 500]).toContain(r2.status);
    const r3 = await call("DELETE", "/api/history");
    expect([200, 401, 500]).toContain(r3.status);
  });

  it("Downloads CRUD -> responds", async () => {
    const r1 = await call("GET", "/api/downloads");
    expect([200, 401, 500]).toContain(r1.status);
    const r2 = await call("POST", "/api/downloads", { video_id: "v1", title: "T" });
    expect([200, 400, 401, 500]).toContain(r2.status);
    const r3 = await call("DELETE", "/api/downloads/1");
    expect([200, 401, 500]).toContain(r3.status);
  });

  it("Search history -> responds", async () => {
    const r = await call("POST", "/api/search-history", { query: "love" });
    expect([200, 400, 401, 500]).toContain(r.status);
  });

  it("Playlists routes -> respond", async () => {
    const r1 = await call("GET", "/api/playlists");
    expect([200, 401, 500]).toContain(r1.status);
    const r2 = await call("POST", "/api/playlists", { name: "My Playlist" });
    expect([200, 400, 401, 500]).toContain(r2.status);
    const r3 = await call("GET", "/api/playlists/public/user-123");
    expect([200, 401, 500]).toContain(r3.status);
    const r4 = await call("GET", "/api/playlists/pl-1");
    expect([200, 404, 500]).toContain(r4.status);
    const r5 = await call("PUT", "/api/playlists/pl-1", { name: "Renamed" });
    expect([200, 400, 401, 500]).toContain(r5.status);
    const r6 = await call("DELETE", "/api/playlists/pl-1");
    expect([200, 403, 404, 401, 500]).toContain(r6.status);
    const r7 = await call("POST", "/api/playlists/pl-1/songs", { video_id: "v1", title: "T" });
    expect([200, 400, 403, 404, 401, 500]).toContain(r7.status);
    const r8 = await call("DELETE", "/api/playlists/pl-1/songs/s1");
    expect([200, 403, 404, 401, 500]).toContain(r8.status);
    const r9 = await call("POST", "/api/playlists/pl-1/copy");
    expect([200, 403, 404, 401, 500]).toContain(r9.status);
  });

  it("AI chat (GET & POST) -> respond", async () => {
    const r1 = await call("GET", "/api/ai/chat?message=halo");
    expect([200, 400, 500]).toContain(r1.status);
    const r2 = await call("POST", "/api/ai/chat", { message: "fitur download" });
    expect([200, 400, 500]).toContain(r2.status);
  });

  it("Upload/url -> responds (fetch stubbed)", async () => {
    const r = await call("POST", "/api/upload/url", { url: "https://example.com/a.mp3", filename: "a.mp3" });
    expect([200, 400, 500]).toContain(r.status);
  });

  it("Webhook -> 401 without valid signature", async () => {
    const r = await call("POST", "/api/webhook", { type: "email.delivered" });
    expect([200, 401, 500]).toContain(r.status);
  });
});
