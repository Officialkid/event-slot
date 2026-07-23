import { SendOtpRequest, SignupRequest } from "../api/contracts";
import { eventslotRequest } from "../api/client";
import { AppSession } from "../session";

export const demoSession: AppSession = {
  displayName: "EventSlot",
  email: "eventslot.co@gmail.com",
  role: "Super Admin",
  plan: "Pioneer",
  tokenBalance: 5,
  authMode: "demo"
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

export function getNativeAuthReadinessNote(): string {
  return "Live native organizer sessions need a mobile-safe token endpoint because current protected web routes use NextAuth browser cookies.";
}
