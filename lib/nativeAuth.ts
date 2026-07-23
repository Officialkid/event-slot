import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/isAdmin";
import { normalizePlanKey } from "@/lib/effectivePlanPolicy";
import {
  clearFailedLoginAttempts,
  getLoginSecuritySnapshot,
  recordFailedLoginAttempt,
  waitForLoginBackoff
} from "@/lib/authSecurity";
import { issueOtpForEmail, normalizeEmailForOtp, verifyOtpForEmail } from "@/lib/emailOtp";

const accessTokenTtlSeconds = 60 * 15;
const refreshTokenTtlSeconds = 60 * 60 * 24 * 30;

type NativeTokenType = "access" | "refresh";

type NativeTokenPayload = {
  sub: string;
  email: string | null;
  type: NativeTokenType;
  iat: number;
  exp: number;
};

export type NativeAuthenticatedUser = {
  id: string;
  email: string | null;
  displayName: string;
  role: string;
  plan: string;
  tokenBalance: number;
};

export type NativeSessionBundle = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: NativeAuthenticatedUser;
};

export type NativeLoginInput = {
  email: string;
  password?: string;
  otp?: string;
};

export async function loginNativeUser(input: NativeLoginInput): Promise<NativeSessionBundle> {
  const normalizedEmail = normalizeEmailForOtp(input.email);
  if (!normalizedEmail || !input.password) {
    throw new NativeAuthError("Email and password are required.", 400, "MISSING_CREDENTIALS");
  }

  const security = await getLoginSecuritySnapshot(normalizedEmail);
  if (security.lockedUntil && security.lockedUntil.getTime() > Date.now()) {
    throw new NativeAuthError("This account is temporarily locked. Try again later.", 423, "ACCOUNT_LOCKED");
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
      suspended: true,
      twoFactorEnabled: true,
      otpRequired: true,
      emailVerified: true,
      plan: true,
      isAdmin: true,
      tokenBalance: { select: { balance: true } }
    }
  });

  if (!user || !user.password) {
    const failed = await recordFailedLoginAttempt(normalizedEmail);
    await waitForLoginBackoff(failed.failedAttempts);
    throw new NativeAuthError("Invalid email or password.", failed.lockedUntil ? 423 : 401, failed.lockedUntil ? "ACCOUNT_LOCKED" : "INVALID_CREDENTIALS");
  }

  if (user.suspended) {
    throw new NativeAuthError("This account is suspended.", 403, "ACCOUNT_SUSPENDED");
  }

  const validPassword = await bcrypt.compare(input.password, user.password);
  if (!validPassword) {
    const failed = await recordFailedLoginAttempt(normalizedEmail);
    await waitForLoginBackoff(failed.failedAttempts);
    throw new NativeAuthError("Invalid email or password.", failed.lockedUntil ? 423 : 401, failed.lockedUntil ? "ACCOUNT_LOCKED" : "INVALID_CREDENTIALS");
  }

  await clearFailedLoginAttempts(normalizedEmail);

  const requiresOtp = Boolean(user.twoFactorEnabled || user.otpRequired);
  const submittedOtp = input.otp?.trim() ?? "";

  if (requiresOtp && !submittedOtp) {
    await issueOtpForEmail(normalizedEmail);
    throw new NativeAuthError("A verification code has been sent to your email.", 401, "OTP_REQUIRED");
  }

  if (requiresOtp && submittedOtp) {
    const verifiedOtp = await verifyOtpForEmail(normalizedEmail, submittedOtp);
    if (!verifiedOtp) {
      throw new NativeAuthError("Invalid verification code.", 401, "INVALID_OTP");
    }

    if (user.otpRequired || !user.emailVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: user.emailVerified ?? new Date(),
          otpRequired: false
        }
      });
    }
  }

  return createNativeSessionBundle({
    id: user.id,
    email: user.email,
    displayName: user.name?.trim() || "EventSlot Organizer",
    role: user.isAdmin || isAdminEmail(user.email) ? "Super Admin" : "Organizer",
    plan: normalizePlanKey(user.plan),
    tokenBalance: user.tokenBalance?.balance ?? 0
  });
}

export async function refreshNativeUserSession(refreshToken: string): Promise<NativeSessionBundle> {
  const payload = verifyNativeToken(refreshToken, "refresh");
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      suspended: true,
      plan: true,
      isAdmin: true,
      tokenBalance: { select: { balance: true } }
    }
  });

  if (!user || user.suspended) {
    throw new NativeAuthError("Session can no longer be refreshed.", 401, "REFRESH_DENIED");
  }

  return createNativeSessionBundle({
    id: user.id,
    email: user.email,
    displayName: user.name?.trim() || "EventSlot Organizer",
    role: user.isAdmin || isAdminEmail(user.email) ? "Super Admin" : "Organizer",
    plan: normalizePlanKey(user.plan),
    tokenBalance: user.tokenBalance?.balance ?? 0
  });
}

export async function requireNativeAccessToken(authorizationHeader: string | null): Promise<NativeAuthenticatedUser> {
  const token = parseBearerToken(authorizationHeader);
  if (!token) {
    throw new NativeAuthError("Missing bearer token.", 401, "MISSING_BEARER_TOKEN");
  }

  const payload = verifyNativeToken(token, "access");
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      suspended: true,
      plan: true,
      isAdmin: true,
      tokenBalance: { select: { balance: true } }
    }
  });

  if (!user || user.suspended) {
    throw new NativeAuthError("Unauthorized.", 401, "UNAUTHORIZED");
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.name?.trim() || "EventSlot Organizer",
    role: user.isAdmin || isAdminEmail(user.email) ? "Super Admin" : "Organizer",
    plan: normalizePlanKey(user.plan),
    tokenBalance: user.tokenBalance?.balance ?? 0
  };
}

export function createNativeAuthErrorResponse(error: unknown) {
  if (error instanceof NativeAuthError) {
    return Response.json(
      {
        success: false,
        error: error.message,
        code: error.code
      },
      { status: error.status }
    );
  }

  return Response.json({ success: false, error: "Native authentication failed." }, { status: 500 });
}

class NativeAuthError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
    this.name = "NativeAuthError";
  }
}

function createNativeSessionBundle(user: NativeAuthenticatedUser): NativeSessionBundle {
  const accessToken = signNativeToken(user, "access", accessTokenTtlSeconds);
  const refreshToken = signNativeToken(user, "refresh", refreshTokenTtlSeconds);
  const expiresAt = new Date(Date.now() + accessTokenTtlSeconds * 1000).toISOString();

  return {
    accessToken,
    expiresAt,
    refreshToken,
    user
  };
}

function signNativeToken(user: NativeAuthenticatedUser, type: NativeTokenType, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: NativeTokenPayload = {
    email: user.email,
    exp: now + ttlSeconds,
    iat: now,
    sub: user.id,
    type
  };

  const encodedHeader = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyNativeToken(token: string, expectedType: NativeTokenType): NativeTokenPayload {
  const [encodedHeader, encodedPayload, signature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !signature) {
    throw new NativeAuthError("Invalid token.", 401, "INVALID_TOKEN");
  }

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);
  if (!timingSafeEqual(signature, expectedSignature)) {
    throw new NativeAuthError("Invalid token signature.", 401, "INVALID_TOKEN_SIGNATURE");
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as NativeTokenPayload;
  if (payload.type !== expectedType) {
    throw new NativeAuthError("Wrong token type.", 401, "WRONG_TOKEN_TYPE");
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new NativeAuthError("Token has expired.", 401, "TOKEN_EXPIRED");
  }

  return payload;
}

function parseBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length).trim() || null;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getNativeTokenSecret()).update(value).digest("base64url");
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function getNativeTokenSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new NativeAuthError("Native auth secret is not configured.", 500, "NATIVE_AUTH_SECRET_MISSING");
  }

  return secret;
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
