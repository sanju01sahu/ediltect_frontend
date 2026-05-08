import { AuthSession, JwtPayload } from "@/types/api";

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLength);
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    return window.atob(padded);
  }
  return Buffer.from(padded, "base64").toString("utf-8");
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = base64UrlDecode(parts[1]);
    return JSON.parse(payload) as JwtPayload;
  } catch {
    return null;
  }
}

export function getSessionFromAccessToken(token: string | undefined): AuthSession | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload?.userId || !payload?.role) return null;
  if (payload.exp && Date.now() >= payload.exp * 1000) return null;

  return {
    userId: payload.userId,
    role: payload.role,
  };
}
