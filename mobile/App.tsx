import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "./src/AppShell";
import { SignInScreen } from "./src/screens/SignInScreen";
import { AppSession } from "./src/session";
import { demoSession } from "./src/services/auth";
import { loadNativePreferences, saveThemePreference } from "./src/services/preferences";
import { ThemeName, createTheme } from "./src/theme";

export default function App() {
  const [session, setSession] = useState<AppSession | null>(null);
  const [themeName, setThemeName] = useState<ThemeName>("dark");
  const theme = useMemo(() => createTheme(themeName), [themeName]);

  useEffect(() => {
    loadNativePreferences()
      .then((preferences) => setThemeName(preferences.themeName))
      .catch(() => setThemeName("dark"));
  }, []);

  const toggleTheme = () => {
    const nextThemeName = themeName === "dark" ? "light" : "dark";
    setThemeName(nextThemeName);
    saveThemePreference(nextThemeName).catch(() => {});
  };

  return (
    <>
      <StatusBar style={themeName === "dark" ? "light" : "dark"} />
      {session ? (
        <AppShell
          session={session}
          theme={theme}
          onSignOut={() => setSession(null)}
          onToggleTheme={toggleTheme}
        />
      ) : (
        <SignInScreen
          theme={theme}
          onDemoSignIn={() => setSession(demoSession)}
          onToggleTheme={toggleTheme}
        />
      )}
    </>
  );
}
