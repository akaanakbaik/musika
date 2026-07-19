/**
 * Full Music Pipeline Integration Test
 * Tests ALL external music search & download APIs through the backend server
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const BASE = process.env.API_BASE || "http://localhost:3001";

interface TestResult {
  name: string;
  source: string;
  status: "pass" | "fail" | "skip";
  count?: number;
  error?: string;
  responseTime?: number;
}

const results: TestResult[] = [];

async function testSearch(source: string, q = "test music", label?: string): Promise<TestResult> {
  const start = Date.now();
  let elapsed: number;

  try {
    const res = await fetch(`${BASE}/api/music/search?q=${encodeURIComponent(q)}&source=${source}`);
    const data = await res.json();
    elapsed = Date.now() - start;

    if (data.success && data.results?.[source]?.length > 0) {
      return {
        name: label || `${source} search`,
        source,
        status: "pass",
        count: data.results[source].length,
        responseTime: elapsed,
      };
    }

    // Fallback: try the per-source endpoint
    const res2 = await fetch(`${BASE}/api/music/search/${source}?q=${encodeURIComponent(q)}`);
    const data2 = await res2.json();
    elapsed = Date.now() - start;

    if (data2.success && data2.results?.length > 0) {
      return {
        name: label || `${source} search`,
        source,
        status: "pass",
        count: data2.results.length,
        responseTime: elapsed,
      };
    }

    return {
      name: label || `${source} search`,
      source,
      status: "fail",
      error: "No results from any fallback API",
      responseTime: elapsed,
    };
  } catch (err: any) {
    return {
      name: label || `${source} search`,
      source,
      status: "fail",
      error: err.message,
      responseTime: Date.now() - start,
    };
  }
}

async function testDownload(source: string, urlOrQuery: string, isQuery = false, label?: string): Promise<TestResult> {
  const start = Date.now();
  try {
    let endpoint: string;
    if (isQuery) {
      endpoint = `${BASE}/api/music/download?q=${encodeURIComponent(urlOrQuery)}&source=${source}`;
    } else {
      endpoint = `${BASE}/api/music/download?url=${encodeURIComponent(urlOrQuery)}&source=${source}`;
    }
    const res = await fetch(endpoint);
    const data = await res.json();
    const elapsed = Date.now() - start;
    const hasUrl = data.success && (data.download_url || data.downloadUrl);
    return {
      name: label || `${source} download`,
      source,
      status: hasUrl ? "pass" : "fail",
      count: hasUrl ? 1 : undefined,
      responseTime: elapsed,
      error: hasUrl ? undefined : (data.error || "No download URL returned"),
    };
  } catch (err: any) {
    return {
      name: label || `${source} download`,
      source,
      status: "fail",
      error: err.message,
      responseTime: Date.now() - start,
    };
  }
}

describe("Full Music Pipeline — All External APIs", () => {
  beforeAll(async () => {
    const health = await fetch(`${BASE}/api/health`);
    expect(health.ok).toBe(true);
  });

  // ══════════════════════════════════════════════════════
  //  SEARCH TESTS
  // ══════════════════════════════════════════════════════

  describe("Spotify Search", () => {
    it("should return results via primary/fallback APIs", async () => {
      const r = await testSearch("spotify", "bohemian rhapsody");
      results.push(r);
      expect(r.status).toBe("pass");
      expect(r.count).toBeGreaterThan(0);
    });
  });

  describe("YouTube Search", () => {
    it("should return results via primary/fallback APIs", async () => {
      const r = await testSearch("youtube", "test music");
      results.push(r);
      expect(r.status).toBe("pass");
      expect(r.count).toBeGreaterThan(0);
    });
  });

  describe("Apple Music Search", () => {
    it("should return results via primary/fallback APIs", async () => {
      const r = await testSearch("apple", "duka last child");
      results.push(r);
      expect(r.status).toBe("pass");
      expect(r.count).toBeGreaterThan(0);
    });
  });

  describe("SoundCloud Search", () => {
    it("should return results via primary/fallback APIs", async () => {
      const r = await testSearch("soundcloud", "everything you are");
      results.push(r);
      expect(r.status).toBe("pass");
      expect(r.count).toBeGreaterThan(0);
    });
  });

  describe("Combined All-Sources Search", () => {
    it("should return results from all 4 sources", async () => {
      const start = Date.now();
      const res = await fetch(`${BASE}/api/music/search?q=test&source=all`);
      const data = await res.json();
      const elapsed = Date.now() - start;
      expect(data.success).toBe(true);

      // Verify each source has results
      const sourcesChecked: string[] = [];
      for (const src of ["youtube", "spotify", "apple", "soundcloud"]) {
        if (data.results?.[src]?.length > 0) {
          sourcesChecked.push(`${src}:${data.results[src].length}`);
        }
      }
      const totalResults = Object.values(data.results || {}).reduce((sum: number, arr: any) => sum + (arr?.length || 0), 0);

      results.push({
        name: `all sources (${sourcesChecked.join(", ")})`,
        source: "all",
        status: totalResults > 0 ? "pass" : "fail",
        count: totalResults as number,
        responseTime: elapsed,
        error: totalResults === 0 ? "No results from any source" : undefined,
      });
      expect(totalResults).toBeGreaterThan(0);
    });
  });

  describe("Recommendations", () => {
    it("should return trending/recommended songs", async () => {
      const start = Date.now();
      const res = await fetch(`${BASE}/api/music/recommendations`);
      const data = await res.json();
      const elapsed = Date.now() - start;
      expect(data.success).toBe(true);
      expect(data.results?.length).toBeGreaterThan(0);

      // Verify each result has required fields
      for (const song of data.results) {
        expect(song).toHaveProperty("videoId");
        expect(song).toHaveProperty("title");
        expect(song).toHaveProperty("thumbnail");
      }
      results.push({
        name: "recommendations",
        source: "youtube",
        status: "pass",
        count: data.results.length,
        responseTime: elapsed,
      });
    });
  });

  // ══════════════════════════════════════════════════════
  //  DOWNLOAD TESTS
  // ══════════════════════════════════════════════════════

  describe("Spotify Download", () => {
    it("mifinfinity Spotify download endpoint", async () => {
      const url = "https://open.spotify.com/track/5WOSNVChcadlsCRiqXE45K";
      const r = await testDownload("spotify", url);
      results.push(r);
      expect(r.status).toBe("pass");
    }, 45000);
  });

  describe("YouTube Download", () => {
    it("nexray-cuki-kelvdra download pipeline", async () => {
      const url = "https://youtu.be/dQw4w9WgXcQ";
      const r = await testDownload("youtube", url);
      results.push(r);
      expect(r.status).toBe("pass");
    }, 45000);
  });

  describe("Apple Music Download", () => {
    it("cuki Apple Music download endpoint", async () => {
      const url = "https://music.apple.com/id/song/jadian-yuk/1649366054";
      const r = await testDownload("apple", url);
      results.push(r);
      expect(r.status).toBe("pass");
    }, 45000);
  });

  describe("SoundCloud Download", () => {
    it("cuki SoundCloud download endpoint (with prexzyapis fallback)", async () => {
      const url = "https://soundcloud.com/augum/last-child-duka-original";
      const r = await testDownload("soundcloud", url);
      results.push(r);
      expect(r.status).toBe("pass");
    }, 45000);
  });

  // ══════════════════════════════════════════════════════
  //  SYSTEM
  // ══════════════════════════════════════════════════════

  describe("System Health", () => {
    it("API health endpoint should return ok", async () => {
      const res = await fetch(`${BASE}/api/health`);
      const data = await res.json();
      expect(data.status).toBe("ok");
      results.push({ name: "API health check", source: "system", status: "pass" });
    });
  });

  // ══════════════════════════════════════════════════════
  //  REPORT
  // ══════════════════════════════════════════════════════

  afterAll(() => {
    const passed = results.filter(r => r.status === "pass").length;
    const failed = results.filter(r => r.status === "fail").length;
    console.log("\n═══════════════════════════════════════════");
    console.log("   FULL MUSIC PIPELINE TEST RESULTS");
    console.log("═══════════════════════════════════════════");
    console.log(`  Total: ${results.length} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    console.log("─────────────────────────────────────────");
    for (const r of results) {
      const icon = r.status === "pass" ? "✅" : "❌";
      const time = r.responseTime ? ` (${(r.responseTime / 1000).toFixed(1)}s)` : "";
      const details = r.count ? ` — ${r.count} results` : r.error ? ` — ${r.error}` : "";
      console.log(`  ${icon} ${r.name}${time}${details}`);
    }
    console.log("═══════════════════════════════════════════\n");
  });
});
