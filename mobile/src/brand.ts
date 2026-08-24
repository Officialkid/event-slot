import { ImageSourcePropType } from "react-native";

export const eventSlotLogo: ImageSourcePropType = require("../assets/icon.png");

export function getTabGlyph(tab: "home" | "events" | "alerts" | "more") {
  switch (tab) {
    case "home":
      return "\u2302";
    case "events":
      return "\u25A6";
    case "alerts":
      return "\u25CB";
    case "more":
    default:
      return "\u22EF";
  }
}
