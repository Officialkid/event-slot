import { NotificationsScreen } from "../../src/screens/NotificationsScreen";
import { useLegacyScreenProps } from "../../src/router/useLegacyScreenProps";

export default function NotificationsRoute() {
  const props = useLegacyScreenProps();

  return <NotificationsScreen {...props} />;
}
