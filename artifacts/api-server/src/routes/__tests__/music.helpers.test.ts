import { describe, it, expect } from "vitest";
import {
  msToTimestamp,
  secToTimestamp,
  extractArtistFromTitle,
  cleanTitle,
} from "../music";

describe("msToTimestamp", () => {
  it("converts milliseconds to MM:SS format", () => {
    expect(msToTimestamp(0)).toBe("0:00");
    expect(msToTimestamp(1000)).toBe("0:01");
    expect(msToTimestamp(60000)).toBe("1:00");
    expect(msToTimestamp(90000)).toBe("1:30");
    expect(msToTimestamp(3600000)).toBe("1:00:00");
    expect(msToTimestamp(3661000)).toBe("1:01:01");
  });

  it("handles null/undefined/negative values", () => {
    expect(msToTimestamp(null as any)).toBe("0:00");
    expect(msToTimestamp(-1)).toBe("0:00");
  });
});

describe("secToTimestamp", () => {
  it("converts seconds to MM:SS format", () => {
    expect(secToTimestamp(0)).toBe("0:00");
    expect(secToTimestamp(60)).toBe("1:00");
    expect(secToTimestamp(90)).toBe("1:30");
    expect(secToTimestamp(3661)).toBe("1:01:01");
  });
});

describe("extractArtistFromTitle", () => {
  it("extracts artist from 'Artist - Title' format", () => {
    expect(extractArtistFromTitle("Tulus - Monokrom")).toBe("Tulus");
    expect(extractArtistFromTitle("Eminem – Lose Yourself")).toBe("Eminem");
    expect(extractArtistFromTitle("Feast — Suara Dalam Kepala")).toBe("Feast");
  });

  it("returns 'YouTube' for unknown format", () => {
    expect(extractArtistFromTitle("Just a Single Title")).toBe("YouTube");
    expect(extractArtistFromTitle("")).toBe("YouTube");
  });
});

describe("cleanTitle", () => {
  it("removes official/Lyric/MV markers", () => {
    expect(cleanTitle("Song Title (Official Video)")).toBe("Song Title");
    expect(cleanTitle("Song Title (Official Lyric Video)")).toBe("Song Title");
    expect(cleanTitle("Song Title [Official Audio]")).toBe("Song Title");
    expect(cleanTitle("Song Title (Audio)")).toBe("Song Title");
    expect(cleanTitle("Song Title (Music Video)")).toBe("Song Title");
    expect(cleanTitle("Song Title (MV)")).toBe("Song Title");
  });

  it("trims whitespace after removal", () => {
    expect(cleanTitle("  Title  (Official Video)  ")).toBe("Title");
  });

  it("returns unchanged title when no markers", () => {
    expect(cleanTitle("Original Song Title")).toBe("Original Song Title");
  });
});
