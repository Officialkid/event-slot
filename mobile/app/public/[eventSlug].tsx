import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { EventSlotMessageCard } from "../../src/components/EventSlotMessageCard";
import { demoEvents } from "../../src/data/demo";
import { useNativeApp } from "../../src/providers/NativeAppProvider";
import { PublicEventScreen } from "../../src/screens/PublicEventScreen";
import { NativeEvent } from "../../src/domain/events";
import { loadNativeEventWorkspace, loadNativePublicEvent, mergeNativeEventWorkspace } from "../../src/services/workspace";

export default function PublicEventRoute() {
  const { events, session, theme } = useNativeApp();
  const params = useLocalSearchParams<{ eventSlug?: string }>();
  const eventSlug = params.eventSlug ?? "";
  const [resolvedEvent, setResolvedEvent] = useState<NativeEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const baseEvent = eventSlug
      ? events.find((item) => item.slug === eventSlug) ?? demoEvents.find((item) => item.slug === eventSlug) ?? null
      : null;

    setResolvedEvent(baseEvent);
    setLoading(true);

    const loadEvent = async () => {
      try {
        const publicEvent = await loadNativePublicEvent(eventSlug);
        if (mounted) {
          setResolvedEvent(publicEvent);
        }

        if (session?.authMode === "live") {
          try {
            const workspace = await loadNativeEventWorkspace(session, eventSlug);
            if (mounted) {
              setResolvedEvent((current) => mergeNativeEventWorkspace(current ?? publicEvent, workspace));
            }
          } catch {
            // Public loading already succeeded; workspace enrichment is best effort.
          }
        }
      } catch {
        if (!baseEvent) {
          if (mounted) {
            setResolvedEvent(null);
          }
          return;
        }

        if (session?.authMode === "live") {
          try {
            const workspace = await loadNativeEventWorkspace(session, eventSlug);
            if (mounted) {
              setResolvedEvent(mergeNativeEventWorkspace(baseEvent, workspace));
            }
          } catch {
            // Keep cached or demo event when live workspace enrichment is unavailable.
          }
        } else if (mounted) {
          setResolvedEvent(baseEvent);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (!eventSlug) {
      setLoading(false);
    } else {
      void loadEvent();
    }

    return () => {
      mounted = false;
    };
  }, [eventSlug, events, session]);

  if (!eventSlug) {
    return <Redirect href="/" />;
  }

  if (loading && !resolvedEvent) {
    return <EventSlotMessageCard title="Loading event" caption="Preparing the public registration view." theme={theme} />;
  }

  if (!resolvedEvent) {
    return <Redirect href="/" />;
  }

  return <PublicEventScreen event={resolvedEvent} theme={theme} />;
}
