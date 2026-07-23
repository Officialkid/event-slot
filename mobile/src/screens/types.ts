import { AppSession } from "../session";
import { AppTheme } from "../theme";
import { TabKey } from "../tabs";

export type NativeScreenProps = {
  session: AppSession;
  theme: AppTheme;
  navigate: (tab: TabKey) => void;
  onSignOut: () => void;
};

