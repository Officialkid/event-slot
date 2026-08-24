import { EventsScreen } from "../../src/screens/EventsScreen";
import { useLegacyScreenProps } from "../../src/router/useLegacyScreenProps";

export default function EventsRoute() {
  const props = useLegacyScreenProps();

  return <EventsScreen {...props} />;
}
