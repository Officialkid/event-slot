import { AppSession } from "../session";
import { AppTheme } from "../theme";
import { AppRoute } from "../tabs";
import { NativeEvent } from "../domain/events";

export type NativeScreenProps = {
  session: AppSession;
  theme: AppTheme;
  navigate: (route: AppRoute) => void;
  onSignOut: () => void;
  events: NativeEvent[];
  eventsLoading: boolean;
  eventsError: string | null;
  refreshEvents: () => void;
};

export type EventDetailScreenProps = NativeScreenProps & {
  eventId: string;
};
