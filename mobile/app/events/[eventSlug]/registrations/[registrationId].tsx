import { Redirect, useLocalSearchParams } from "expo-router";

import { useLegacyScreenProps } from "../../../../src/router/useLegacyScreenProps";
import { TicketCardScreen } from "../../../../src/screens/TicketCardScreen";
import { buildDemoRegistrationWorkspace, buildWorkspaceRegistrationPreview, findRegistrationPreview, mergeLocalPublicRegistrations } from "../../../../src/services/registrations";
import { loadPublicRegistrationRecords } from "../../../../src/services/publicRegistrations";
import { useEffect, useState } from "react";
import { loadNativeEventWorkspace } from "../../../../src/services/workspace";
import { NativeRegistrationWorkspace } from "../../../../src/domain/registrations";
import { EventSlotMessageCard } from "../../../../src/components/EventSlotMessageCard";
import { View } from "react-native";

export default function RegistrationDetailRoute() {
  const props = useLegacyScreenProps();
  const params = useLocalSearchParams<{ eventSlug?: string; registrationId?: string }>();
  const eventSlug = params.eventSlug;
  const registrationId = params.registrationId;
  const [workspace, setWorkspace] = useState<NativeRegistrationWorkspace | null>(null);

  const matchedEvent = props.events.find((event) => event.slug === eventSlug || event.id === eventSlug);

  useEffect(() => {
    let mounted = true;

    if (!matchedEvent) {
      return () => {
        mounted = false;
      };
    }

    Promise.all([
      matchedEvent && props.session.authMode === "live"
        ? loadNativeEventWorkspace(props.session, matchedEvent.slug).then((result) => buildWorkspaceRegistrationPreview(result)).catch(() => buildDemoRegistrationWorkspace(matchedEvent))
        : Promise.resolve(buildDemoRegistrationWorkspace(matchedEvent)),
      loadPublicRegistrationRecords(matchedEvent.slug)
    ]).then(([baseWorkspace, localRecords]) => {
      if (mounted) {
        setWorkspace(mergeLocalPublicRegistrations(baseWorkspace, localRecords));
      }
    });

    return () => {
      mounted = false;
    };
  }, [matchedEvent, props.session]);

  if (!eventSlug || !registrationId || !matchedEvent) {
    return <Redirect href="/(tabs)/events" />;
  }

  if (!workspace) {
    return (
      <View style={{ flex: 1, backgroundColor: props.theme.colors.page, padding: 16 }}>
        <EventSlotMessageCard title="Loading attendee" caption="Preparing the attendee ticket card." theme={props.theme} />
      </View>
    );
  }

  const registration = findRegistrationPreview(workspace, registrationId);

  if (!registration) {
    return <Redirect href={{ pathname: "/events/[eventSlug]/confirmed", params: { eventSlug: matchedEvent.slug } }} />;
  }

  return (
    <TicketCardScreen
      event={matchedEvent}
      registration={registration}
      theme={props.theme}
      onBackPress={() => props.navigate({ name: "eventDetail", eventId: matchedEvent.id })}
    />
  );
}
