import { createRemoteJWKSet, errors, jwtVerify } from "jose";
import db from "./db";

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export class A2AAuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 503,
  ) {
    super(message);
    this.name = "A2AAuthError";
  }
}

export async function authenticateA2ARequest(request: Request) {
  const audience = process.env.AUTH_GOOGLE_ID;
  if (!audience) {
    throw new A2AAuthError("A2A Google authentication is not configured.", 503);
  }

  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    throw new A2AAuthError("A Google ID token is required in the Bearer authorization header.", 401);
  }

  let googleId: string;
  try {
    const { payload } = await jwtVerify(match[1], googleKeys, {
      algorithms: ["RS256"],
      audience,
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      requiredClaims: ["sub", "exp", "iat", "aud", "iss"],
      maxTokenAge: "1h",
      clockTolerance: 5,
    });
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new A2AAuthError("The Google ID token has no valid subject.", 401);
    }
    googleId = payload.sub;
  } catch (error) {
    if (error instanceof A2AAuthError) throw error;
    if (error instanceof errors.JOSEError) {
      throw new A2AAuthError("The Google ID token is invalid or expired.", 401);
    }
    console.error("Could not verify an A2A Google ID token.", error);
    throw new A2AAuthError("Google token verification is temporarily unavailable.", 503);
  }

  const user = db.prepare("SELECT google_id FROM users WHERE google_id = ?").get(googleId);
  if (!user) {
    throw new A2AAuthError("Sign in to Agent City with this Google account before using A2A.", 403);
  }
  return googleId;
}
