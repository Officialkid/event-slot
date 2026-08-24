import { NativeCommunityBadge, NativeCommunityLeaderboardEntry, NativeCommunityRange, NativeCommunitySnapshot } from "../domain/community";
import { NativeEvent } from "../domain/events";
import { AppSession } from "../session";

export function buildNativeCommunitySnapshot(session: AppSession, events: NativeEvent[]): NativeCommunitySnapshot {
  const organizerTokenBase = Math.max(180, session.tokenBalance);
  const totalAttendees = events.reduce((sum, event) => sum + event.attendees, 0);
  const totalWaitlist = events.reduce((sum, event) => sum + event.waitlist, 0);
  const activeEvents = events.filter((event) => event.status === "Active").length;
  const displaySlug = buildOrganizerProfileSlug(session.displayName);
  const referralCode = `EVS-${displaySlug.slice(0, 4).toUpperCase()}-${(activeEvents + totalWaitlist + 7).toString().padStart(2, "0")}`;
  const referralLink = `${buildOrganizerPublicProfileUrl(session.displayName)}?ref=${referralCode}`;

  const me: NativeCommunityLeaderboardEntry = {
    id: "me",
    name: session.displayName,
    points: organizerTokenBase + totalAttendees * 8 + totalWaitlist * 4 + activeEvents * 25,
    badge: activeEvents >= 3 ? "Community Champion" : activeEvents >= 1 ? "Growth Builder" : "Pioneer",
    highlight: true
  };

  const week = sortLeaderboard([
    me,
    { id: "wk-1", name: "Loise Wangechi", points: me.points + 46, badge: "Hall of Fame" },
    { id: "wk-2", name: "John Kimani Hika", points: Math.max(120, me.points - 18), badge: "Growth Builder" },
    { id: "wk-3", name: "Martha Kendi", points: Math.max(90, me.points - 44), badge: "Pioneer" }
  ]);

  const month = sortLeaderboard([
    { id: "mo-1", name: "Daniel Mwalili", points: me.points + 120, badge: "Hall of Fame" },
    me,
    { id: "mo-2", name: "Sharon Mumo", points: Math.max(160, me.points - 60), badge: "Community Champion" },
    { id: "mo-3", name: "Philip Otieno", points: Math.max(140, me.points - 90), badge: "Growth Builder" }
  ]);

  const all = sortLeaderboard([
    { id: "all-1", name: "Grace Wairimu", points: me.points + 320, badge: "Hall of Fame" },
    { id: "all-2", name: "Brian Kiarie", points: me.points + 120, badge: "Community Champion" },
    me,
    { id: "all-3", name: "Faith Atieno", points: Math.max(240, me.points - 110), badge: "Growth Builder" }
  ]);

  const currentRange: NativeCommunityRange = "week";
  const currentRank = week.findIndex((entry) => entry.highlight) + 1 || 1;

  return {
    referralLink,
    referralCode,
    coinBalance: me.points,
    currentRank,
    currentRange,
    ranges: {
      week,
      month,
      all
    },
    badges: buildBadges(activeEvents, totalAttendees, totalWaitlist)
  };
}

function buildBadges(activeEvents: number, totalAttendees: number, totalWaitlist: number): NativeCommunityBadge[] {
  return [
    {
      id: "pioneer",
      title: "Pioneer",
      description: "Create your first live EventSlot event.",
      unlocked: activeEvents >= 1
    },
    {
      id: "growth-builder",
      title: "Growth Builder",
      description: "Reach 50 confirmed attendees across your events.",
      unlocked: totalAttendees >= 50
    },
    {
      id: "community-champion",
      title: "Community Champion",
      description: "Maintain three active events at the same time.",
      unlocked: activeEvents >= 3
    },
    {
      id: "hall-of-fame",
      title: "Hall of Fame",
      description: "Build sustained demand with 25+ people on the waitlist.",
      unlocked: totalWaitlist >= 25
    }
  ];
}

export function buildOrganizerProfileSlug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "eventslot-organizer"
  );
}

export function buildOrganizerPublicProfileUrl(displayName: string) {
  return `https://www.eventsslot.com/${buildOrganizerProfileSlug(displayName)}`;
}

function sortLeaderboard(entries: NativeCommunityLeaderboardEntry[]) {
  return [...entries].sort((a, b) => b.points - a.points);
}
