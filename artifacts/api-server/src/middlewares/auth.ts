import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const isProduction = process.env.NODE_ENV === "production";

if (!JWT_SECRET) {
  if (isProduction) {
    throw new Error(
      "[Auth] FATAL: JWT_SECRET is required in production. Set JWT_SECRET to a random 32+ char string (e.g. `openssl rand -base64 32`).",
    );
  }
  console.warn("[Auth] WARNING: JWT_SECRET environment variable not set!");
  console.warn("[Auth] Using INSECURE default fallback. Set JWT_SECRET to a random 32+ char string in production.");
  console.warn("[Auth] Example: export JWT_SECRET=$(openssl rand -base64 32)");
}

// Dev/test-only fallback. Never used in production (see guard above).
const JWT_SECRET_FALLBACK = JWT_SECRET || "musika-dev-jwt-secret---change-me";
const JWT_EXPIRES = "30d";

export interface JwtPayload {
  userId: string;
  email: string;
  username: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET_FALLBACK, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET_FALLBACK) as JwtPayload;
  } catch {
    return null;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, error: "Invalid or expired token" });
  }

  req.user = payload;
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload) req.user = payload;
  }
  next();
}
