import {
  NativeLoginRequest,
  NativeLogoutRequest,
  NativeRefreshRequest,
  NativeSessionResponse,
  SendOtpRequest,
  SignupRequest
} from "../api/contracts";
import { eventslotRequest } from "../api/client";
import { nativeConfig } from "../config";
import { AppSession } from "../session";

export const demoSession: AppSession = {
  displayName: "EventSlot",
  email: "eventslot.co@gmail.com",
  role: "Super Admin",
  plan: "Pioneer",
  tokenBalance: 5,
  authMode: nativeConfig.authMode
};

export async function requestOrganizerOtp(input: SendOtpRequest): Promise<void> {
  await eventslotRequest("/api/auth/send-otp", {
    method: "POST",
    body: input
  });
}

export async function signupOrganizer(input: SignupRequest): Promise<void> {
  await eventslotRequest("/api/auth/signup", {
    method: "POST",
    body: input
  });
}

export async function loginNativeOrganizer(input: NativeLoginRequest): Promise<NativeSessionResponse> {
  return eventslotRequest<NativeSessionResponse>("/api/native/auth/login", {
    method: "POST",
    body: input
  });
}

export async function refreshNativeSession(input: NativeRefreshRequest): Promise<NativeSessionResponse> {
  return eventslotRequest<NativeSessionResponse>("/api/native/auth/refresh", {
    method: "POST",
    body: input
  });
}

export async function logoutNativeOrganizer(input: NativeLogoutRequest, accessToken?: string): Promise<void> {
  await eventslotRequest("/api/native/auth/logout", {
    method: "POST",
    body: input,
    token: accessToken
  });
}

export function toAppSession(nativeSession: NativeSessionResponse): AppSession {
  return {
    accessToken: nativeSession.accessToken,
    authMode: "live",
    displayName: nativeSession.user.displayName,
    email: nativeSession.user.email,
    expiresAt: nativeSession.expiresAt,
    plan: nativeSession.user.plan,
    refreshToken: nativeSession.refreshToken,
    role: nativeSession.user.role,
    tokenBalance: nativeSession.user.tokenBalance
  };
}

export function getNativeAuthReadinessNote(): string {
  return "Live native organizer sign-in is wired to bearer-token endpoints, secure token storage is available, and sign-out now attempts native logout before clearing local session data. Production refresh-token revocation still needs backend proof before release.";
}

export function getNativeAuthReadinessItems(): string[] {
  const apiHost = nativeConfig.apiBaseUrl.replace(/^https?:\/\//, "");

  return [
    `API host: ${apiHost}`,
    nativeConfig.authMode === "live" ? "Live organizer auth enabled" : "Safe demo shell enabled",
    "Session tokens use secure native storage",
    "Logout clears local session and calls live logout when available"
  ];
}
