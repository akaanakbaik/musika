import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/ai/chat", async (req, res) => {
  const { message, model = "gpt-5" } = req.query as { message: string; model?: string };
  if (!message?.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    const response = await fetch(
      `https://api.zenzxz.my.id/ai/copilot?message=${encodeURIComponent(message.trim())}&model=${model}`,
      {
        headers: { "User-Agent": "musika/1.0" },
        signal: AbortSignal.timeout(30000)
      }
    );

    if (!response.ok) {
      throw new Error(`AI API returned ${response.status}`);
    }

    const json = await response.json();

    if (!json?.status) {
      throw new Error(json?.message || "AI API returned error");
    }

    const reply =
      json?.result?.text ||
      json?.result ||
      json?.message ||
      json?.response ||
      json?.data ||
      "Sorry, I couldn't process that.";

    res.json({ success: true, reply, model });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
