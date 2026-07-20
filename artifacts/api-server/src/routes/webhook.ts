import { Router } from "express";
import crypto from "crypto";

const router = Router();

const WEBHOOK_SECRET = process.env.WEBHOOK_SIGNING_SECRET || "";

function verifyWebhook(
  payload: string,
  sigHeader: string,
  msgId: string,
  msgTimestamp: string
): boolean {
  try {
    if (!sigHeader || !msgId || !msgTimestamp || !WEBHOOK_SECRET) return false;

    const rawKey = WEBHOOK_SECRET.startsWith("whsec_")
      ? WEBHOOK_SECRET.slice(6)
      : WEBHOOK_SECRET;
    const secretBytes = Buffer.from(rawKey, "base64");

    const signedContent = `${msgId}.${msgTimestamp}.${payload}`;
    const expectedSig = crypto
      .createHmac("sha256", secretBytes)
      .update(signedContent)
      .digest("base64");

    const signatures = sigHeader.split(" ");
    for (const sig of signatures) {
      const trimmed = sig.trim();
      if (!trimmed.startsWith("v1=")) continue;
      const sigValue = trimmed.slice(3);
      if (
        sigValue.length > 0 &&
        crypto.timingSafeEqual(Buffer.from(sigValue), Buffer.from(expectedSig))
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

router.post("/webhook", (req, res) => {
  const sigHeader = req.headers["svix-signature"] as string;
  const msgId = req.headers["svix-id"] as string;
  const msgTimestamp = req.headers["svix-timestamp"] as string;
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);

  if (!verifyWebhook(rawBody, sigHeader, msgId, msgTimestamp)) {
    console.warn("[Webhook] Invalid signature rejected");
    return res.status(401).json({ success: false, error: "Invalid signature" });
  }

  const event = req.body;
  const eventType = event?.type || "unknown";

  console.log(`[Webhook] Event received: ${eventType}`);

  switch (eventType) {
    case "email.delivered":
      console.log(`[Webhook] Email delivered: ${event?.data?.email_id} -> ${event?.data?.to}`);
      break;
    case "email.bounced":
      console.warn(`[Webhook] Email bounced: ${event?.data?.email_id} -> ${event?.data?.to}`);
      break;
    case "email.complained":
      console.warn(`[Webhook] Email complained: ${event?.data?.email_id} -> ${event?.data?.to}`);
      break;
    case "email.opened":
      console.log(`[Webhook] Email opened: ${event?.data?.email_id}`);
      break;
    case "email.clicked":
      console.log(`[Webhook] Email clicked: ${event?.data?.email_id}`);
      break;
    case "email.sent":
      console.log(`[Webhook] Email sent: ${event?.data?.email_id}`);
      break;
    default:
      console.log(`[Webhook] Unhandled event type: ${eventType}`);
  }

  res.json({ success: true });
});

export default router;
