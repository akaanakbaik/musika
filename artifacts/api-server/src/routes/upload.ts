import { Router, type IRouter } from "express";
import multer from "multer";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No file provided" });
  }

  const expire = (req.headers["x-expire"] as string) || "1w";

  try {
    // Build multipart form using Node.js built-in FormData (Node 18+)
    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    formData.append("file", blob, req.file.originalname);

    const response = await fetch("https://api.kabox.my.id/api/upload", {
      method: "POST",
      headers: { "x-expire": expire },
      body: formData,
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Upload API returned ${response.status}: ${errText}`);
    }

    const data = await response.json() as any;
    res.json({
      success: true,
      url: data.url,
      metadata: data.metadata,
      expires_at: data.metadata?.expires_at
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
