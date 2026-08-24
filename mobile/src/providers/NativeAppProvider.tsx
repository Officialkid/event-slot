import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { AppSession } from "../session";
import { listNativeEvents } from "../services/events";
import { prepareNativePushRegistration, registerPushToken } from "../services/notifications";
import { loadNativePreferences, saveOnboardingCompletion } from "../services/preferences";
import { cleanupNativeSession } from "../services/sessionCleanup";
import { restoreStoredSession, saveStoredSession } from "../services/sessionStore";
import { ThemeName, createTheme } from "../theme";
import { NativeEvent } from "../domain/events";

type NativeAppContextValue = {
  bootLoading: boolean;
  events: NativeEvent[];
  eventsError: string | null;
  eventsLoading: boolean;
  finishOnboarding: () => void;
  onboardingCompleted: boolean;
  onboardingStep: number;
  refreshEvents: () => void;
  session: AppSession | null;
  setOnboardingStep: (value: number) => void;
  signIn: (session: AppSession) => void;
  signOut: () => void;
  theme: ReturnType<typeof createTheme>;
};

const NativeAppContext = createContext<NativeAppContextValue | null>(null);

export function NativeAppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [events, setEvents] = useState<NativeEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const pushRegistrationAttemptRef = useRef<string | null>(null);
  const themeName: ThemeName = "dark";
  const theme = useMemo(() => createTheme(themeName), [themeName]);

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([loadNativePreferences(), restoreStoredSession()]).then(([preferencesResult, sessionResult]) => {
      if (!mounted) {
        return;
      }

      if (preferencesResult.status === "fulfilled") {
        setOnboardingCompleted(preferencesResult.value.onboardingCompleted);
      }

      if (sessionResult.status === "fulfilled" && sessionResult.value) {
        setSession(sessionResult.value);
      }

      setTimeout(() => {
        if (mounted) {
          setBootLoading(false);
        }
      }, 1200);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const refreshEvents = useCallback(() => {
    if (!session) {
      setEvents([]);
      setEventsError(null);
      setEventsLoading(false);
      return;
    }

    setEventsLoading(true);
    setEventsError(null);

    listNativeEvents(session)
      .then((nextEvents) => {
        setEvents(nextEvents);
      })
      .catch((error: unknown) => {
        setEventsError(error instanceof Error ? error.message : "Could not load events.");
      })
      .finally(() => {
        setEventsLoading(false);
      });
  }, [session]);

  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  useEffect(() => {
    if (!session) {
      pushRegistrationAttemptRef.current = null;
      return;
    }

    const attemptKey = session.accessToken ?? session.refreshToken ?? session.email;
    if (pushRegistrationAttemptRef.current === attemptKey) {
      return;
    }

    pushRegistrationAttemptRef.current = attemptKey;

    let cancelled = false;

    (async () => {
      const prepared = await prepareNativePushRegistration(session);
      if (cancelled || prepared.status !== "registered-local") {
        return;
      }

      await registerPushToken(prepared.registration, session);
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [session]);

  const signIn = useCallback((nextSession: AppSession) => {
    saveStoredSession(nextSession).catch(() => {});
    setSession(nextSession);
  }, []);

  const signOut = useCallback(() => {
    cleanupNativeSession(session).catch(() => {});
    setSession(null);
    setEvents([]);
    setEventsError(null);
  }, [session]);

  const finishOnboarding = useCallback(() => {
    setOnboardingCompleted(true);
    saveOnboardingCompletion(true).catch(() => {});
  }, []);

  const value = useMemo<NativeAppContextValue>(
    () => ({
      bootLoading,
      events,
      eventsError,
      eventsLoading,
      finishOnboarding,
      onboardingCompleted,
      onboardingStep,
      refreshEvents,
      session,
      setOnboardingStep,
      signIn,
      signOut,
      theme
    }),
    [
      bootLoading,
      events,
      eventsError,
      eventsLoading,
      finishOnboarding,
      onboardingCompleted,
      onboardingStep,
      refreshEvents,
      session,
      signIn,
      signOut,
      theme
    ]
  );

  return <NativeAppContext.Provider value={value}>{children}</NativeAppContext.Provider>;
}

export function useNativeApp() {
  const context = useContext(NativeAppContext);

  if (!context) {
    throw new Error("useNativeApp must be used inside NativeAppProvider.");
  }

  return context;
}
