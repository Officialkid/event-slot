import { AppSession } from "../session";
import { logoutNativeOrganizer } from "./auth";
import { clearStoredSession } from "./sessionStore";

export type NativeLogoutCleanupResult = {
  localSessionCleared: boolean;
  serverLogoutAttempted: boolean;
  serverLogoutSucceeded: boolean;
  message: string;
};

export async function cleanupNativeSession(session: AppSession | null): Promise<NativeLogoutCleanupResult> {
  let serverLogoutAttempted = false;
  let serverLogoutSucceeded = false;
  let serverLogoutError: string | null = null;

  if (session?.authMode === "live" && (session.accessToken || session.refreshToken)) {
    serverLogoutAttempted = true;
    try {
      await logoutNativeOrganizer(
        {
          refreshToken: session.refreshToken
        },
        session.accessToken
      );
      serverLogoutSucceeded = true;
    } catch (error) {
      serverLogoutError = error instanceof Error ? error.message : "Native server logout failed.";
    }
  }

  await clearStoredSession();

  return {
    localSessionCleared: true,
    serverLogoutAttempted,
    serverLogoutSucceeded,
    message: buildCleanupMessage(serverLogoutAttempted, serverLogoutSucceeded, serverLogoutError)
  };
}

export function getNativeLogoutCleanupReadinessMessage(): string {
  return "Native sign-out now attempts bearer-token logout for live sessions and always clears SecureStore locally; backend refresh-token revocation and push-token cleanup still need server-side proof.";
}

function buildCleanupMessage(
  serverLogoutAttempted: boolean,
  serverLogoutSucceeded: boolean,
  serverLogoutError: string | null
): string {
  if (!serverLogoutAttempted) {
    return "Local native session cleared from this device.";
  }

  if (serverLogoutSucceeded) {
    return "Native server logout completed and local session was cleared.";
  }

  return `Local native session was cleared after server logout could not be confirmed: ${serverLogoutError ?? "unknown error"}`;
}
