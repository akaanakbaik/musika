import app from "./app";
import { logger } from "./lib/logger";

// Export app for Vercel serverless function
export default app;

// Only call listen() when NOT on Vercel (local/self-hosted)
if (!process.env.VERCEL) {
  const rawPort = process.env["PORT"];

  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
} else {
  logger.info({ vercel: true }, "Running on Vercel serverless");
}
