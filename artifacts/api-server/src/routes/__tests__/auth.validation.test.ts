import { describe, it, expect } from "vitest";
import {
  generateOTP,
  detectBrowser,
  detectOS,
  maskIP,
} from "../../lib/auth-helpers";

function validateRegisterFields(body: { email?: string; password?: string; username?: string }): string | null {
  const { email, password, username } = body;
  if (!email || !password || !username) return "Email, password, dan username diperlukan";
  if (password.length < 6) return "Password minimal 6 karakter";
  if (username.length < 3) return "Username minimal 3 karakter";
  return null;
}

function validateLoginFields(body: { email?: string; password?: string }): string | null {
  const { email, password } = body;
  if (!email || !password) return "Email dan password diperlukan";
  return null;
}

function validateEmail(email: string): boolean {
  return typeof email === "string" && email.includes("@");
}

describe("Auth Validation", () => {
  describe("validateRegisterFields", () => {
    it("returns error for missing fields", () => {
      expect(validateRegisterFields({})).toBeTruthy();
      expect(validateRegisterFields({ email: "test@test.com" })).toBeTruthy();
      expect(validateRegisterFields({ email: "test@test.com", password: "123456" })).toBeTruthy();
    });

    it("rejects short password", () => {
      const result = validateRegisterFields({
        email: "test@test.com",
        password: "12345",
        username: "testuser",
      });
      expect(result).toBe("Password minimal 6 karakter");
    });

    it("rejects short username", () => {
      const result = validateRegisterFields({
        email: "test@test.com",
        password: "123456",
        username: "ab",
      });
      expect(result).toBe("Username minimal 3 karakter");
    });

    it("returns null for valid fields", () => {
      const result = validateRegisterFields({
        email: "test@test.com",
        password: "123456",
        username: "testuser",
      });
      expect(result).toBeNull();
    });
  });

  describe("validateLoginFields", () => {
    it("returns error for missing fields", () => {
      expect(validateLoginFields({})).toBeTruthy();
      expect(validateLoginFields({ email: "test@test.com" })).toBeTruthy();
    });

    it("returns null for valid fields", () => {
      expect(validateLoginFields({ email: "test@test.com", password: "pass" })).toBeNull();
    });
  });

  describe("validateEmail", () => {
    it("detects valid emails", () => {
      expect(validateEmail("test@test.com")).toBe(true);
      expect(validateEmail("user@domain.co.id")).toBe(true);
    });

    it("detects invalid inputs", () => {
      expect(validateEmail("")).toBe(false);
      expect(validateEmail("notanemail")).toBe(false);
    });
  });

  describe("generateOTP (imported from auth.ts)", () => {
    it("generates 6-digit code", () => {
      const code = generateOTP();
      expect(code).toMatch(/^\d{6}$/);
    });

    it("generates unique codes", () => {
      const codes = new Set(Array.from({ length: 10 }, () => generateOTP()));
      expect(codes.size).toBeGreaterThan(1);
    });
  });

  describe("detectBrowser (imported from auth.ts)", () => {
    it("detects Chrome", () => {
      expect(detectBrowser("Mozilla/5.0 Chrome/120")).toBe("Google Chrome");
    });

    it("detects Firefox", () => {
      expect(detectBrowser("Mozilla/5.0 Firefox/120")).toBe("Mozilla Firefox");
    });

    it("returns Unknown Browser for empty UA", () => {
      expect(detectBrowser("")).toBe("Unknown Browser");
    });
  });

  describe("detectOS (imported from auth.ts)", () => {
    it("detects Windows", () => {
      expect(detectOS("Windows NT 10.0")).toBe("Windows 10/11");
    });

    it("detects Android", () => {
      expect(detectOS("Linux; Android 14")).toBe("Android");
    });

    it("detects iOS", () => {
      expect(detectOS("iPhone; CPU iPhone OS 17")).toBe("iOS");
    });
  });

  describe("maskIP (imported from auth.ts)", () => {
    it("masks IPv4 addresses", () => {
      expect(maskIP("192.168.1.100")).toBe("192.168.1.xxx");
    });

    it("identifies localhost", () => {
      expect(maskIP("127.0.0.1")).toBe("Local Network");
      expect(maskIP("::1")).toBe("Local Network");
    });
  });
});
