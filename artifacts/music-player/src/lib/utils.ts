import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Upgrade YouTube thumbnail URLs to the highest available quality.
 * Falls back gracefully if maxresdefault isn't available (handled via onError in components).
 *
 * Quality ladder (largest first):
 *   maxresdefault → 1280×720
 *   sddefault     → 640×480
 *   hqdefault     → 480×360  (API default)
 *   mqdefault     → 320×180
 *   default       → 120×90
 */
export function getHQThumbnail(url: string): string {
  if (!url) return url;
  // Only touch i.ytimg.com URLs
  if (!url.includes("i.ytimg.com") && !url.includes("img.youtube.com")) return url;

  // Replace any quality tier with maxresdefault for sharpest image
  return url
    .replace(/\/(default|mqdefault|hqdefault|sddefault|0|1|2|3)\.jpg/, "/maxresdefault.jpg")
    .replace(/\/(default|mqdefault|hqdefault|sddefault|0|1|2|3)\.webp/, "/maxresdefault.webp");
}

/**
 * Fallback chain for YouTube thumbnails: try maxresdefault → hqdefault → original.
 * Use as onError handler on <img> elements.
 */
export function onThumbnailError(e: React.SyntheticEvent<HTMLImageElement>, originalUrl: string) {
  const img = e.target as HTMLImageElement;
  const src = img.src;

  if (src.includes("maxresdefault")) {
    // maxresdefault failed → try hqdefault
    img.src = src.replace("/maxresdefault.jpg", "/hqdefault.jpg").replace("/maxresdefault.webp", "/hqdefault.jpg");
  } else if (src.includes("hqdefault") || src.includes("sddefault")) {
    // hqdefault failed → use original
    img.src = originalUrl;
  } else {
    // Final fallback placeholder
    img.src = "https://placehold.co/400x400/1a1a1a/555?text=♪";
  }
}
