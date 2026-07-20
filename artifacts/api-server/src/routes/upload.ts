import { Router, type IRouter } from "express";
import multer from "multer";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB max

const MAX_SIZE = 5 * 1024 * 1024; // 5MB max (CDN serverless limit)
const CDN_UPLOAD_URL = "https://cdn.izukaprivate.my.id/upload";
const CDN_BASE_URL = "https://cdn.izukaprivate.my.id/cdn";

async function safeCDNUpload(buffer: Buffer, filename: string, maxRetries = 3): Promise<string> {
  if (buffer.length > MAX_SIZE) {
    throw new Error(`File terlalu besar: ${(buffer.length / 1024 / 1024).toFixed(1)}MB (maks ${MAX_SIZE / 1024 / 1024}MB)`);
  }

  for (let i = 1; i <= maxRetries; i++) {
    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(buffer)], { type: "application/octet-stream" });
      formData.append("file", blob, filename);

      const response = await fetch(CDN_UPLOAD_URL, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(120000),
      });

      const data: any = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

      const fn = data.url?.split("/").pop();
      if (!fn) throw new Error("No filename in CDN response");
      return `${CDN_BASE_URL}/${fn}`;
    } catch (err: any) {
      if (i === maxRetries) throw err;
      console.warn(`[CDN] Upload attempt ${i} failed: ${err.message}, retrying in ${i}s...`);
      await new Promise(r => setTimeout(r, 1000 * i));
    }
  }

  throw new Error("All CDN upload attempts failed");
}

router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No file provided" });
  }

  try {
    const cdnUrl = await safeCDNUpload(req.file.buffer, req.file.originalname);
    res.json({ success: true, url: cdnUrl, filename: req.file.originalname, size: req.file.size });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Direct upload to CDN from URL (for audio files)
router.post("/upload/url", async (req, res) => {
  const { url, filename } = req.body as { url?: string; filename?: string };
  if (!url) return res.status(400).json({ success: false, error: "url is required" });

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    const name = filename || url.split("/").pop() || "file.bin";

    const cdnUrl = await safeCDNUpload(buffer, name);
    res.json({ success: true, url: cdnUrl, original_url: url });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
