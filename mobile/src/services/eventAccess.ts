import { NativeEventAccessSummary, NativeVerifierInviteAction } from "../domain/eventAccess";
import { NativeEvent } from "../domain/events";

export function getEventAccessSummary(event: NativeEvent): NativeEventAccessSummary {
  if (event.role === "Team") {
    return {
      role: "team",
      title: "Team workspace access",
      caption: "You can support this event without owning or deleting it.",
      capabilities: ["view-event", "manage-registrations", "verify-tickets", "export-data"]
    };
  }

  return {
    role: "owner",
    title: "Owner workspace access",
    caption: "You can manage the event, invite verifiers, review attendees, and prepare exports.",
    capabilities: ["view-event", "manage-registrations", "verify-tickets", "export-data", "invite-verifiers", "edit-event"]
  };
}

export function buildVerifierInviteAction(event: NativeEvent): NativeVerifierInviteAction {
  return {
    title: "Verifier access code",
    caption: "Share this code with gate staff so they can verify tickets without becoming organisers.",
    shareLabel: `Verify ${event.title} with code ${event.verifierCode}`,
    verifierCode: event.verifierCode
  };
}

export function formatCapabilityLabel(capability: NativeEventAccessSummary["capabilities"][number]) {
  const labels: Record<NativeEventAccessSummary["capabilities"][number], string> = {
    "view-event": "View event",
    "manage-registrations": "Registrations",
    "verify-tickets": "Verify",
    "export-data": "Exports",
    "invite-verifiers": "Invite verifiers",
    "edit-event": "Edit"
  };

  return labels[capability];
}
