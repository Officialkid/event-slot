import { ReactNode } from "react";
import { StyleProp, ViewStyle } from "react-native";

import { AppTheme } from "../theme";
import { EventSlotPanel } from "./EventSlotPanel";
import { EventSlotSectionHeading } from "./EventSlotSectionHeading";

type EventSlotSectionCardProps = {
  title: string;
  theme: AppTheme;
  children: ReactNode;
  caption?: string;
  tone?: "surface" | "hero" | "input";
  style?: StyleProp<ViewStyle>;
};

export function EventSlotSectionCard({
  title,
  theme,
  children,
  caption,
  tone = "surface",
  style
}: EventSlotSectionCardProps) {
  return (
    <EventSlotPanel theme={theme} tone={tone} style={style}>
      <EventSlotSectionHeading title={title} caption={caption} theme={theme} />
      {children}
    </EventSlotPanel>
  );
}
