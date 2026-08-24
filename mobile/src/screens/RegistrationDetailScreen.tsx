import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { EventSlotMessageCard } from "../components/EventSlotMessageCard";
import { NativePublicRegistrationRecord } from "../domain/publicRegistrations";
import { NativeRegistrationWorkspace } from "../domain/registrations";
import { findNativeEventBySlug } from "../services/events";
import { loadPublicRegistrationRecords } from "../services/publicRegistrations";
import {
  buildDemoRegistrationWorkspace,
  buildWorkspaceRegistrationPreview,
  findRegistrationPreview,
  mergeLocalPublicRegistrations
} from "../services/registrations";
import { loadNativeEventWorkspace } from "../services/workspace";
import { TicketCardScreen } from "./TicketCardScreen";
import { RegistrationDetailScreenProps } from "./types";

const emptyWorkspace: NativeRegistrationWorkspace = {
  confirmed: [],
  waitlist: []
};

export function RegistrationDetailScreen({
  eventSlug,
  registrationId,
  theme,
  session,
  navigate,
  events
}: RegistrationDetailScreenProps) {
  const event = findNativeEventBySlug(events, eventSlug);
  const [workspace, setWorkspace] = useState<import("../api/contracts").NativeEventWorkspaceResponse | null>(null);
  const [workspaceStatus, setWorkspaceStatus] = useState<string | null>(null);
  const [localPublicRecords, setLocalPublicRecords] = useState<NativePublicRegistrationRecord[]>([]);

  useEffect(() => {
    let mounted = true;

    if (!event) {
      setWorkspace(null);
      setWorkspaceStatus(null);
      return () => {
        mounted = false;
      };
    }

    loadPublicRegistrationRecords(event.slug)
      .then((records) => {
        if (mounted) {
          setLocalPublicRecords(records);
        }
      })
      .catch(() => {
        if (mounted) {
          setLocalPublicRecords([]);
        }
      });

    if (session.authMode !== "live") {
      setWorkspace(null);
      setWorkspaceStatus(null);
      return () => {
        mounted = false;
      };
    }

    setWorkspace(null);
    setWorkspaceStatus("Loading live attendee detail...");
    loadNativeEventWorkspace(session, event.slug)
      .then((response) => {
        if (!mounted) {
          return;
        }

        setWorkspace(response);
        setWorkspaceStatus("Live attendee detail loaded from EventSlot.");
      })
      .catch((error: unknown) => {
        if (!mounted) {
          return;
        }

        setWorkspaceStatus(error instanceof Error ? error.message : "Could not load the attendee detail.");
      });

    return () => {
      mounted = false;
    };
  }, [event, session]);

  const registrationWorkspace = useMemo(() => {
    if (!event) {
      return emptyWorkspace;
    }

    const baseWorkspace =
      workspace
        ? buildWorkspaceRegistrationPreview(workspace)
        : session.authMode === "demo"
          ? buildDemoRegistrationWorkspace(event)
          : emptyWorkspace;

    return mergeLocalPublicRegistrations(baseWorkspace, localPublicRecords);
  }, [event, localPublicRecords, session.authMode, workspace]);

  const registration = useMemo(
    () => findRegistrationPreview(registrationWorkspace, registrationId),
    [registrationId, registrationWorkspace]
  );

  if (!event) {
    return (
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        <EventSlotMessageCard
          title="Event not found"
          caption="We could not find this event in the current mobile workspace."
          theme={theme}
          tone="input"
        />
      </ScrollView>
    );
  }

  if (registration) {
    return (
      <TicketCardScreen
        event={event}
        registration={registration}
        theme={theme}
        onBackPress={() => navigate({ name: "eventDetail", eventId: event.id })}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <EventSlotMessageCard
        title="Attendee detail unavailable"
        caption={
          workspaceStatus ??
          "This attendee record has not been loaded on this device yet. Sync the event workspace or complete a mobile registration to populate the detail view."
        }
        theme={theme}
        tone="input"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: 16,
    padding: 16,
    paddingBottom: 40
  }
});
