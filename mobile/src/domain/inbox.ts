import { AppRoute } from "../tabs";

export type NativeInboxItem = {
  id: string;
  title: string;
  body: string;
  ageLabel: string;
  unread: boolean;
  route: AppRoute;
  tone: "accent" | "success" | "warning" | "muted";
  category: "registrations" | "waitlist" | "capacity" | "payments" | "insights" | "team";
};
