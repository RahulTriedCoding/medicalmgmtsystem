export function extractAuthUserIdFromToken(token?: string | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    const json = Buffer.from(payload, "base64").toString("utf8");
    const parsed = JSON.parse(json) as { sub?: unknown };
    return typeof parsed.sub === "string" ? parsed.sub : null;
  } catch {
    return null;
  }
}
