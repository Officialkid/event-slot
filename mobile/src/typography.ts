import { Platform, TextStyle } from "react-native";

export const fontFamily = {
  body: Platform.select({ ios: "System", android: "sans-serif" }) ?? "System",
  medium: Platform.select({ ios: "System", android: "sans-serif-medium" }) ?? "System",
  display: Platform.select({ ios: "Georgia", android: "serif" }) ?? "serif"
};

export const typeScale = {
  pageTitle: {
    fontFamily: fontFamily.display,
    fontSize: 30,
    fontWeight: "400",
    lineHeight: 36
  } satisfies TextStyle,
  sectionTitle: {
    fontFamily: fontFamily.display,
    fontSize: 22,
    fontWeight: "400",
    lineHeight: 28
  } satisfies TextStyle,
  body: {
    fontFamily: fontFamily.body,
    fontSize: 16,
    lineHeight: 24
  } satisfies TextStyle,
  bodyStrong: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 24
  } satisfies TextStyle,
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2
  } satisfies TextStyle
};
