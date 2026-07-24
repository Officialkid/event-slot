import { AppSession } from "../session";
import { refreshNativeSession, toAppSession } from "./auth";
import { loadNativeStorageValue, removeNativeStorageValue, saveNativeStorageValue } from "./nativeStorage";

const sessionStorageKey = "eventslot.native.session";

export async function loadStoredSession(): Promise<AppSession | null> {
  return loadNativeStorageValue<AppSession>(sessionStorageKey, { sensitive: true });
}

export async function saveStoredSession(session: AppSession): Promise<void> {
  await saveNativeStorageValue(sessionStorageKey, session, { sensitive: true });
}

export async function clearStoredSession(): Promise<void> {
  await removeNativeStorageValue(sessionStorageKey, { sensitive: true });
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
  return "Native session restore now uses the shared storage adapter with SecureStore for access and refresh tokens; Android device QA and logout/account-deletion cleanup still need final proof.";
}
