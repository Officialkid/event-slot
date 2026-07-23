export type ThemeName = "dark" | "light";

export type AppTheme = ReturnType<typeof createTheme>;

const shared = {
  accent: "#C8F55A",
  accentSoft: "rgba(200, 245, 90, 0.14)",
  success: "#22C55E",
  error: "#FF6B6B"
};

export function createTheme(name: ThemeName) {
  const dark = name === "dark";

  return {
    name,
    colors: {
      ...shared,
      page: dark ? "#050605" : "#F4F3EC",
      surface: dark ? "#101210" : "#FFFFFF",
      elevated: dark ? "#151914" : "#F0F4E8",
      hero: dark ? "#0B120A" : "#FFFFFF",
      nav: dark ? "rgba(10, 10, 10, 0.94)" : "rgba(255, 255, 255, 0.94)",
      activeTab: dark ? "rgba(200, 245, 90, 0.14)" : "rgba(97, 124, 24, 0.1)",
      input: dark ? "#090A09" : "#FFFFFF",
      border: dark ? "rgba(200, 245, 90, 0.18)" : "rgba(10, 10, 10, 0.1)",
      text: dark ? "#F8F8F2" : "#101312",
      secondary: dark ? "#B8BDB5" : "#505851",
      muted: dark ? "#72796F" : "#6A7169",
      greenPanel: dark ? "#17301F" : "#2F774F",
      avatar: dark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.24)"
    }
  };
}

