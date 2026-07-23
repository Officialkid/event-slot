import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";

import { AppShell } from "./src/AppShell";
import { SignInScreen } from "./src/screens/SignInScreen";
import { AppSession } from "./src/session";
import { ThemeName, createTheme } from "./src/theme";

const demoSession: AppSession = {
  displayName: "EventSlot",
  email: "eventslot.co@gmail.com",
  role: "Super Admin",
  plan: "Pioneer",
  tokenBalance: 5
};

export default function App() {
  const [session, setSession] = useState<AppSession | null>(null);
  const [themeName, setThemeName] = useState<ThemeName>("dark");
  const theme = useMemo(() => createTheme(themeName), [themeName]);

  return (
    <>
      <StatusBar style={themeName === "dark" ? "light" : "dark"} />
      {session ? (
        <AppShell
          session={session}
          theme={theme}
          onSignOut={() => setSession(null)}
          onToggleTheme={() => setThemeName((current) => (current === "dark" ? "light" : "dark"))}
        />
      ) : (
        <SignInScreen
          theme={theme}
          onDemoSignIn={() => setSession(demoSession)}
          onToggleTheme={() => setThemeName((current) => (current === "dark" ? "light" : "dark"))}
        />
      )}
    </>
  );
}

