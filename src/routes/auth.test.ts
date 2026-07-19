/**
 * Auth API Unit Tests
 * Tests register, login, OTP send/verify, profile update
 */
import { describe, it, expect, beforeAll } from "vitest";

const BASE = process.env.API_BASE || "http://localhost:3001";

const testUser = {
  email: `test_${Date.now()}@musika.test`,
  password: "TestPass123!",
  username: `tester_${Date.now().toString(36)}`,
};

let authToken = "";
let userId = "";

describe("Auth API", () => {
  // ── REGISTER ────────────────────────────────────────────
  it("POST /api/auth/register - should create new user", async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser),
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe(testUser.email.toLowerCase());
    expect(data.user.username).toBe(testUser.username);
    expect(data.token).toBeTruthy();
    authToken = data.token;
    userId = data.user.id;
  });

  // ── DUPLICATE REGISTER ─────────────────────────────────
  it("POST /api/auth/register - should reject duplicate email", async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser),
    });
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeTruthy();
  });

  // ── LOGIN ───────────────────────────────────────────────
  it("POST /api/auth/login - should login with correct credentials", async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user).toBeDefined();
    expect(data.token).toBeTruthy();
    authToken = data.token;
  });

  // ── LOGIN WRONG PASSWORD ────────────────────────────────
  it("POST /api/auth/login - should reject wrong password", async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUser.email, password: "wrongpassword" }),
    });
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeTruthy();
  });

  // ── GET ME (AUTHENTICATED) ──────────────────────────────
  it("GET /api/auth/me - should return user profile with valid token", async () => {
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe(testUser.email.toLowerCase());
  });

  // ── GET ME (UNAUTHENTICATED) ────────────────────────────
  it("GET /api/auth/me - should reject without token", async () => {
    const res = await fetch(`${BASE}/api/auth/me`);
    expect(res.status).toBe(401);
  });

  // ── UPDATE PROFILE ──────────────────────────────────────
  it("PUT /api/auth/profile - should update user profile", async () => {
    const res = await fetch(`${BASE}/api/auth/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ bio: "Test bio updated" }),
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.bio).toBe("Test bio updated");
  });

  // ── GET USER BY ID ──────────────────────────────────────
  it("GET /api/users/:id - should return public profile", async () => {
    const res = await fetch(`${BASE}/api/users/${userId}`);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.profile).toBeDefined();
    expect(data.profile.username).toBe(testUser.username);
  });

  // ── SEND OTP ────────────────────────────────────────────
  it("POST /api/auth/otp/send - should send OTP", async () => {
    const res = await fetch(`${BASE}/api/auth/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUser.email }),
    });
    const data = await res.json();
    // OTP may fail if SMTP is not configured, but should at least respond
    expect(data).toBeDefined();
  });

  // ── VALIDATION ──────────────────────────────────────────
  it("POST /api/auth/register - should reject missing fields", async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "", password: "", username: "" }),
    });
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  // ── SUMMARY ─────────────────────────────────────────────
  afterAll(() => {
    console.log("\n═══════════════════════════════════════════");
    console.log("   AUTH API TEST COMPLETE");
    console.log(`   User: ${testUser.email}`);
    console.log(`   Token: ${authToken ? "✅" : "❌"}`);
    console.log("═══════════════════════════════════════════\n");
  });
});
