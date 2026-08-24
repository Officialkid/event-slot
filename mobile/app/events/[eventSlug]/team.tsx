import { Redirect, useLocalSearchParams } from "expo-router";

import { EventDetailScreen } from "../../../src/screens/EventDetailScreen";
import { useLegacyScreenProps } from "../../../src/router/useLegacyScreenProps";

export default function EventTeamRoute() {
  const props = useLegacyScreenProps();
  const params = useLocalSearchParams<{ eventSlug?: string }>();
  const eventSlug = params.eventSlug;

  if (!eventSlug) {
    return <Redirect href="/(tabs)/events" />;
  }

  const matchedEvent = props.events.find((event) => event.slug === eventSlug || event.id === eventSlug);

  if (!matchedEvent) {
    return <Redirect href="/(tabs)/events" />;
  }

  return <EventDetailScreen {...props} eventId={matchedEvent.id} initialTab="team" />;
}
