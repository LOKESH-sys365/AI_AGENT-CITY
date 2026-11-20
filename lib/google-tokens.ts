import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import db from "./db";

function encryptionKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required to protect Google Calendar credentials.");
  return createHash("sha256").update(secret).digest();
}

export function saveGoogleRefreshToken(googleId: string, refreshToken: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(refreshToken, "utf8"), cipher.final()]);
  const value = [iv.toString("hex"), cipher.getAuthTag().toString("hex"), encrypted.toString("hex")].join(":");

  db.prepare(`
    INSERT INTO google_credentials (google_id, encrypted_refresh_token, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(google_id) DO UPDATE SET
      encrypted_refresh_token = excluded.encrypted_refresh_token,
      updated_at = CURRENT_TIMESTAMP
  `).run(googleId, value);
}

function getGoogleRefreshToken(googleId: string) {
  const row = db
    .prepare("SELECT encrypted_refresh_token FROM google_credentials WHERE google_id = ?")
    .get(googleId) as { encrypted_refresh_token: string } | undefined;
  if (!row) {
    throw new Error("Google Calendar is not connected. Sign out and sign in again to grant Calendar access.");
  }

  const [ivHex, tagHex, encryptedHex] = row.encrypted_refresh_token.split(":");
  if (!ivHex || !tagHex || !encryptedHex) throw new Error("Stored Google Calendar credentials are invalid.");

  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Could not decrypt Google Calendar credentials. Check AUTH_SECRET and sign in again.");
  }
}

export async function getGoogleAccessToken(googleId: string) {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are required for Calendar access.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: getGoogleRefreshToken(googleId),
      grant_type: "refresh_token",
    }),
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error_description" in payload &&
      typeof payload.error_description === "string"
        ? payload.error_description
        : `Google token refresh failed (${response.status}).`;
    throw new Error(message);
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("access_token" in payload) ||
    typeof payload.access_token !== "string"
  ) {
    throw new Error("Google returned an invalid token response.");
  }

  if ("refresh_token" in payload && typeof payload.refresh_token === "string") {
    saveGoogleRefreshToken(googleId, payload.refresh_token);
  }
  return payload.access_token;
}
