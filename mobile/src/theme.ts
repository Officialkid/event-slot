export type ThemeName = "dark";

export type AppTheme = ReturnType<typeof createTheme>;
import { getEventSlotTheme } from "../../lib/eventslot-theme";

export function createTheme(name: ThemeName = "dark") {
  const palette = getEventSlotTheme(name);

  return {
    name,
    colors: {
      accent: palette.accent,
      accentSoft: palette.accentSoft,
      success: palette.success,
      error: palette.error,
      page: palette.page,
      surface: palette.surface,
      elevated: palette.elevated,
      hero: palette.hero,
      nav: palette.nav,
      activeTab: palette.activeTab,
      input: palette.input,
      border: palette.border,
      text: palette.text,
      secondary: palette.secondary,
      muted: palette.muted,
      greenPanel: palette.greenPanel,
      avatar: palette.avatar
    }
  };
}
