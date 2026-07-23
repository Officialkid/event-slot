import { AppSession } from "../session";
import { AppTheme } from "../theme";
import { AppRoute } from "../tabs";

export type NativeScreenProps = {
  session: AppSession;
  theme: AppTheme;
  navigate: (route: AppRoute) => void;
  onSignOut: () => void;
};

export type EventDetailScreenProps = NativeScreenProps & {
  eventId: string;
};
