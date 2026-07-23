import { AppSession } from "../session";
import { refreshNativeSession, toAppSession } from "./auth";

let cachedSession: AppSession | null = null;

export async function loadStoredSession(): Promise<AppSession | null> {
  return cachedSession;
}

export async function saveStoredSession(session: AppSession): Promise<void> {
  cachedSession = session;
}

export async function clearStoredSession(): Promise<void> {
  cachedSession = null;
}

export function isSessionExpired(session: AppSession, now = new Date()): boolean {
  if (!session.expiresAt) {
    return false;
  }

  const expiresAt = new Date(session.expiresAt).getTime();
  if (Number.isNaN(expiresAt)) {
    return true;
  }

  const refreshGraceMs = 30_000;
  return expiresAt - refreshGraceMs <= now.getTime();
}

export async function restoreStoredSession(): Promise<AppSession | null> {
  const session = await loadStoredSession();
  if (!session) {
    return null;
  }

  if (!isSessionExpired(session)) {
    return session;
  }

  if (session.authMode !== "live" || !session.refreshToken) {
    await clearStoredSession();
    return null;
  }

  const refreshedSession = toAppSession(
    await refreshNativeSession({
      refreshToken: session.refreshToken
    })
  );
  await saveStoredSession(refreshedSession);
  return refreshedSession;
}

export function getSessionStorageReadinessMessage(): string {
  return "Native session restore is scaffolded, but it is memory-backed until SecureStore or AsyncStorage is installed and reviewed for token safety.";
}
