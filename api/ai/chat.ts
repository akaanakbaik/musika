export const config = { maxDuration: 30 };

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { message, model = "gpt-5" } = req.query;
  if (!message?.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    const response = await fetch(
      `https://api.zenzxz.my.id/ai/copilot?message=${encodeURIComponent(String(message).trim())}&model=${model}`,
      { headers: { "User-Agent": "musika/1.0" } }
    );

    if (!response.ok) throw new Error(`AI API returned ${response.status}`);
    const json = await response.json();

    if (!json?.status) throw new Error(json?.message || "AI API error");

    const reply = json?.result?.text || json?.result || json?.message || "Sorry, I couldn't process that.";
    res.json({ success: true, reply, model });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
