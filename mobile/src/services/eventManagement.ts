import {
  NativeArchiveEventRequest,
  NativeArchiveEventResponse,
  NativeCapacityUpdateRequest,
  NativeCapacityUpdateResponse,
  NativeDuplicateEventResponse,
  NativeTicketTierUpdateRequest,
  NativeTicketTierUpdateResponse,
  NativeEventWorkspaceResponse,
  NativeEventSettingsUpdateRequest,
  NativeEventSettingsUpdateResponse
} from "../api/contracts";
import { eventslotRequest } from "../api/client";
import { NativeEvent } from "../domain/events";
import { NativeEventSettingsDraft, NativeEventTeamMember } from "../domain/eventManagement";
import { AppSession } from "../session";
import { loadNativeStorageValue, saveNativeStorageValue } from "./nativeStorage";

const eventSettingsStorageKey = "eventslot.native.event-settings";
const eventTeamStorageKey = "eventslot.native.event-team";

export async function loadNativeEventSettingsDraft(
  event: NativeEvent,
  workspace?: NativeEventWorkspaceResponse | null
): Promise<NativeEventSettingsDraft> {
  const drafts = (await loadNativeStorageValue<Record<string, NativeEventSettingsDraft>>(eventSettingsStorageKey)) ?? {};
  return (
    drafts[event.slug] ?? {
      eventSlug: event.slug,
      title: event.title,
      eventType: event.eventType ?? "physical",
      capacity: event.capacity > 0 ? String(event.capacity) : "",
      description: event.description ?? "",
      location: workspace?.event.location ?? (event.venue === "Venue not set" ? "" : event.venue),
      mapDirectionsUrl: workspace?.event.mapDirectionsUrl ?? event.mapDirectionsUrl ?? "",
      entryFeeLabel: event.entryFeeLabel ?? "",
      deadline: workspace?.event.deadline ?? "",
      eventDate: workspace?.event.eventDate ?? "",
      eventEndAt: workspace?.event.eventEndAt ?? "",
      joinOpensAt: workspace?.event.joinOpensAt ?? "",
      showRemainingSpots: event.showRemainingSpots !== false,
      attendeeConsentEnabled: event.attendeeConsentEnabled ?? false,
      attendeeConsentText: event.attendeeConsentText ?? "",
      communityLink: event.communityLink ?? "",
      whatsappNumber: event.whatsappNumber ?? "",
      contactMode: event.contactMode ?? "WHATSAPP",
      ticketTiers: (event.ticketTiers ?? []).map((tier) => ({ ...tier })),
      feedbackEnabled: false,
      archived: event.status === "Closed",
      deleted: false,
      updatedAt: new Date().toISOString()
    }
  );
}

export async function saveNativeEventSettingsDraft(draft: NativeEventSettingsDraft): Promise<NativeEventSettingsDraft> {
  const drafts = (await loadNativeStorageValue<Record<string, NativeEventSettingsDraft>>(eventSettingsStorageKey)) ?? {};
  const nextDraft = {
    ...draft,
    updatedAt: new Date().toISOString()
  };
  await saveNativeStorageValue(eventSettingsStorageKey, {
    ...drafts,
    [draft.eventSlug]: nextDraft
  });
  return nextDraft;
}

export type SaveNativeEventSettingsResult = {
  draft: NativeEventSettingsDraft;
  mode: "live" | "local";
  message: string;
};

export type NativeEventActionResult = {
  draft: NativeEventSettingsDraft;
  mode: "live" | "local";
  message: string;
};

export type NativeDuplicateEventResult = NativeEventActionResult & {
  duplicatedEvent?: {
    id: string;
    slug: string;
    title: string;
  };
};

export type NativeCapacityUpdateResult = NativeEventActionResult & {
  promoted?: number;
  remainingSlots?: number;
};

export type NativeTicketTierUpdateResult = NativeEventActionResult & {
  promotedTierCount?: number;
};

export async function persistNativeEventSettingsDraft(
  session: AppSession,
  draft: NativeEventSettingsDraft
): Promise<SaveNativeEventSettingsResult> {
  const locallySavedDraft = await saveNativeEventSettingsDraft(draft);

  if (session.authMode !== "live" || !session.accessToken) {
    return {
      draft: locallySavedDraft,
      mode: "local",
      message: `Saved local event settings on ${new Date(locallySavedDraft.updatedAt).toLocaleString()}.`
    };
  }

  const request: NativeEventSettingsUpdateRequest = {
    title: draft.title.trim(),
    eventType: draft.eventType,
    description: draft.description.trim() || undefined,
    location: draft.location.trim() || undefined,
    mapDirectionsUrl: draft.mapDirectionsUrl.trim() || undefined,
    entryFeeLabel: draft.entryFeeLabel.trim() || undefined,
    deadline: draft.deadline.trim() || undefined,
    eventDate: draft.eventDate.trim() || undefined,
    eventEndAt: draft.eventEndAt.trim() || undefined,
    joinOpensAt: draft.joinOpensAt.trim() || undefined,
    showRemainingSpots: draft.showRemainingSpots,
    attendeeConsentEnabled: draft.attendeeConsentEnabled,
    attendeeConsentText: draft.attendeeConsentEnabled ? draft.attendeeConsentText.trim() : undefined,
    communityLink: draft.communityLink.trim() || undefined,
    whatsappNumber: draft.whatsappNumber.trim() || undefined,
    contactMode: draft.contactMode
  };

  try {
    const response = await eventslotRequest<NativeEventSettingsUpdateResponse>(
      `/api/native/events/${encodeURIComponent(draft.eventSlug)}/settings`,
      {
        method: "PATCH",
        body: request,
        token: session.accessToken
      }
    );

    const syncedDraft = await saveNativeEventSettingsDraft({
      ...locallySavedDraft,
      title: response.event.title,
      eventType: response.event.eventType,
      description: response.event.description ?? "",
      location: response.event.location ?? "",
      mapDirectionsUrl: response.event.mapDirectionsUrl ?? "",
      entryFeeLabel: response.event.entryFeeLabel ?? "",
      deadline: response.event.deadline ?? "",
      eventDate: response.event.eventDate ?? "",
      eventEndAt: response.event.eventEndAt ?? "",
      joinOpensAt: response.event.joinOpensAt ?? "",
      showRemainingSpots: response.event.showRemainingSpots,
      attendeeConsentEnabled: response.event.attendeeConsentEnabled,
      attendeeConsentText: response.event.attendeeConsentText ?? "",
      communityLink: response.event.communityLink ?? "",
      whatsappNumber: response.event.whatsappNumber ?? "",
      contactMode: response.event.contactMode
    });

    return {
      draft: syncedDraft,
      mode: "live",
      message: "Saved live event settings for title, schedule, location, attendee spots, consent, community link, and organizer contact."
    };
  } catch (error) {
    return {
      draft: locallySavedDraft,
      mode: "local",
      message:
        error instanceof Error
          ? `${error.message} Saved the settings locally on this device while live sync is unavailable.`
          : "Saved the settings locally on this device while live sync is unavailable."
    };
  }
}

export async function persistNativeArchiveToggle(
  session: AppSession,
  draft: NativeEventSettingsDraft
): Promise<NativeEventActionResult> {
  const nextArchivedValue = !draft.archived;
  const locallySavedDraft = await saveNativeEventSettingsDraft({
    ...draft,
    archived: nextArchivedValue
  });

  if (session.authMode !== "live" || !session.accessToken) {
    return {
      draft: locallySavedDraft,
      mode: "local",
      message: nextArchivedValue ? "Marked this event as archived locally." : "Restored this event from the local archive state."
    };
  }

  const request: NativeArchiveEventRequest = {
    action: "archive",
    archived: nextArchivedValue
  };

  try {
    const response = await eventslotRequest<NativeArchiveEventResponse>(
      `/api/native/events/${encodeURIComponent(draft.eventSlug)}`,
      {
        method: "PATCH",
        body: request,
        token: session.accessToken
      }
    );

    const syncedDraft = await saveNativeEventSettingsDraft({
      ...locallySavedDraft,
      archived: response.event.archived
    });

    return {
      draft: syncedDraft,
      mode: "live",
      message: response.event.archived ? "Archived this event live from mobile." : "Restored this event live from mobile."
    };
  } catch (error) {
    return {
      draft: locallySavedDraft,
      mode: "local",
      message:
        error instanceof Error
          ? `${error.message} Kept the archive change locally on this device.`
          : "Kept the archive change locally on this device."
    };
  }
}

export async function persistNativeCapacityUpdate(
  session: AppSession,
  draft: NativeEventSettingsDraft
): Promise<NativeCapacityUpdateResult> {
  const locallySavedDraft = await saveNativeEventSettingsDraft(draft);
  const parsedCapacity = Number.parseInt(draft.capacity.trim(), 10);

  if (!draft.capacity.trim() || Number.isNaN(parsedCapacity) || parsedCapacity <= 0) {
    return {
      draft: locallySavedDraft,
      mode: "local",
      message: "Enter a valid capacity greater than zero before saving."
    };
  }

  if (session.authMode !== "live" || !session.accessToken) {
    return {
      draft: locallySavedDraft,
      mode: "local",
      message: "Saved the capacity locally on this device. Sign in with a live session to update EventSlot."
    };
  }

  const request: NativeCapacityUpdateRequest = {
    newCapacity: parsedCapacity
  };

  try {
    const response = await eventslotRequest<NativeCapacityUpdateResponse>(
      `/api/native/events/${encodeURIComponent(draft.eventSlug)}/capacity`,
      {
        method: "PATCH",
        body: request,
        token: session.accessToken
      }
    );

    const syncedDraft = await saveNativeEventSettingsDraft({
      ...locallySavedDraft,
      capacity: response.capacity ? String(response.capacity) : locallySavedDraft.capacity
    });

    return {
      draft: syncedDraft,
      mode: "live",
      message:
        response.promoted > 0
          ? `Capacity updated live. ${response.promoted} waitlisted attendee${response.promoted === 1 ? "" : "s"} moved into confirmed.`
          : "Capacity updated live from mobile.",
      promoted: response.promoted,
      remainingSlots: response.remainingSlots
    };
  } catch (error) {
    return {
      draft: locallySavedDraft,
      mode: "local",
      message:
        error instanceof Error
          ? `${error.message} Kept the capacity change locally on this device.`
          : "Kept the capacity change locally on this device."
    };
  }
}

export async function persistNativeTicketTierUpdate(
  session: AppSession,
  draft: NativeEventSettingsDraft
): Promise<NativeTicketTierUpdateResult> {
  const locallySavedDraft = await saveNativeEventSettingsDraft(draft);
  const normalizedTiers = draft.ticketTiers
    .filter((tier) => tier.name.trim() || tier.price.trim() || tier.capacity.trim())
    .map((tier) => ({
      id: tier.id.startsWith("new-tier-") ? undefined : tier.id,
      name: tier.name.trim(),
      presetKey: tier.presetKey ?? null,
      priceKes: Number.parseInt(tier.price.replace(/[^0-9]/g, ""), 10),
      capacity: Number.parseInt(tier.capacity.replace(/[^0-9]/g, ""), 10),
      description: tier.description?.trim() || null,
      bundleSize: Number.parseInt((tier.bundleSize ?? "").replace(/[^0-9]/g, ""), 10) || 1
    }));

  if (normalizedTiers.length === 0) {
    return {
      draft: locallySavedDraft,
      mode: "local",
      message: "Add at least one paid ticket tier before saving."
    };
  }

  const invalidTier = normalizedTiers.find(
    (tier) =>
      !tier.name ||
      !tier.priceKes ||
      tier.priceKes < 50 ||
      !tier.capacity ||
      tier.capacity < 1 ||
      !tier.bundleSize ||
      tier.bundleSize < 1 ||
      tier.bundleSize > 100
  );
  if (invalidTier) {
    return {
      draft: locallySavedDraft,
      mode: "local",
      message: "Each tier needs a name, a price of at least KSh 50, a capacity, and a bundle size between 1 and 100."
    };
  }

  if (session.authMode !== "live" || !session.accessToken) {
    return {
      draft: locallySavedDraft,
      mode: "local",
      message: "Saved ticket tier changes locally on this device. Sign in live to update EventSlot."
    };
  }

  const request: NativeTicketTierUpdateRequest = {
    ticketTiers: normalizedTiers
  };

  try {
    const response = await eventslotRequest<NativeTicketTierUpdateResponse>(
      `/api/native/events/${encodeURIComponent(draft.eventSlug)}/ticket-tiers`,
      {
        method: "PATCH",
        body: request,
        token: session.accessToken
      }
    );

    const syncedDraft = await saveNativeEventSettingsDraft({
      ...locallySavedDraft,
      ticketTiers: response.ticketTiers.map((tier) => ({
        id: tier.id,
        name: tier.name,
        presetKey: tier.presetKey ?? undefined,
        badgeColor: tier.badgeColor ?? undefined,
        textColor: tier.textColor ?? undefined,
        metallic: tier.metallic ?? undefined,
        prestige: tier.prestige ?? undefined,
        price: String(tier.priceKes),
        capacity: String(tier.capacity),
        description: tier.description ?? undefined,
        bundleSize: tier.bundleSize ? String(tier.bundleSize) : undefined,
        soldCount: tier.soldCount,
        waitlistCount: tier.waitlistCount,
        status: tier.status
      })),
      capacity: String(response.ticketTiers.reduce((sum, tier) => sum + tier.capacity, 0))
    });

    const promotedTierCount = response.ticketTiers.filter((tier) => tier.waitlistCount > 0).length;

    return {
      draft: syncedDraft,
      mode: "live",
      message: "Saved paid ticket tiers live from mobile.",
      promotedTierCount
    };
  } catch (error) {
    return {
      draft: locallySavedDraft,
      mode: "local",
      message:
        error instanceof Error
          ? `${error.message} Kept the ticket-tier changes locally on this device.`
          : "Kept the ticket-tier changes locally on this device."
    };
  }
}

export async function persistNativeDeleteToggle(
  session: AppSession,
  draft: NativeEventSettingsDraft
): Promise<NativeEventActionResult> {
  const nextDeletedValue = !draft.deleted;
  const locallySavedDraft = await saveNativeEventSettingsDraft({
    ...draft,
    deleted: nextDeletedValue
  });

  if (!nextDeletedValue) {
    return {
      draft: locallySavedDraft,
      mode: "local",
      message: "Removed the local delete flag for this event."
    };
  }

  if (session.authMode !== "live" || !session.accessToken) {
    return {
      draft: locallySavedDraft,
      mode: "local",
      message: "Flagged this event for deletion locally."
    };
  }

  try {
    await eventslotRequest<{ success: true }>(`/api/native/events/${encodeURIComponent(draft.eventSlug)}`, {
      method: "DELETE",
      token: session.accessToken
    });

    return {
      draft: locallySavedDraft,
      mode: "live",
      message: "Deleted this event live from mobile."
    };
  } catch (error) {
    return {
      draft: locallySavedDraft,
      mode: "local",
      message:
        error instanceof Error
          ? `${error.message} Kept the delete flag locally on this device.`
          : "Kept the delete flag locally on this device."
    };
  }
}

export async function persistNativeEventDuplicate(
  session: AppSession,
  draft: NativeEventSettingsDraft
): Promise<NativeDuplicateEventResult> {
  const locallySavedDraft = await saveNativeEventSettingsDraft({
    ...draft,
    duplicatedAt: new Date().toISOString()
  });

  if (session.authMode !== "live" || !session.accessToken) {
    return {
      draft: locallySavedDraft,
      mode: "local",
      message: "Marked this event as duplicated in the local mobile workspace."
    };
  }

  try {
    const response = await eventslotRequest<NativeDuplicateEventResponse>(
      `/api/native/events/${encodeURIComponent(draft.eventSlug)}/duplicate`,
      {
        method: "POST",
        token: session.accessToken
      }
    );

    return {
      draft: locallySavedDraft,
      duplicatedEvent: response.event,
      mode: "live",
      message: `Created a live duplicate: ${response.event.title}.`
    };
  } catch (error) {
    return {
      draft: locallySavedDraft,
      mode: "local",
      message:
        error instanceof Error
          ? `${error.message} Kept the duplicate marker locally on this device.`
          : "Kept the duplicate marker locally on this device."
    };
  }
}

export async function loadNativeEventTeamMembers(event: NativeEvent): Promise<NativeEventTeamMember[]> {
  const teamByEvent = (await loadNativeStorageValue<Record<string, NativeEventTeamMember[]>>(eventTeamStorageKey)) ?? {};
  return (
    teamByEvent[event.slug] ??
    [
      {
        id: `${event.slug}-owner`,
        email: "owner@eventsslot.com",
        role: "Editor",
        status: "Active",
        addedAt: new Date().toISOString()
      }
    ]
  );
}

export async function saveNativeEventTeamMembers(eventSlug: string, members: NativeEventTeamMember[]): Promise<NativeEventTeamMember[]> {
  const teamByEvent = (await loadNativeStorageValue<Record<string, NativeEventTeamMember[]>>(eventTeamStorageKey)) ?? {};
  await saveNativeStorageValue(eventTeamStorageKey, {
    ...teamByEvent,
    [eventSlug]: members
  });
  return members;
}

export function getNativeEventManagementReadinessMessage(): string {
  return "Event settings drafts always save locally, and live mode can now sync title, schedule, location, capacity, attendee spots, consent, community link, and organizer contact details.";
}
