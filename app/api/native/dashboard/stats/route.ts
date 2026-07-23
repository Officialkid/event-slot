import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireNativeAccessToken, createNativeAuthErrorResponse } from "@/lib/nativeAuth";

export async function GET(req: NextRequest) {
  try {
    const nativeUser = await requireNativeAccessToken(req.headers.get("authorization"));
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const memberships = await prisma.teamMember.findMany({
      where: {
        memberId: nativeUser.id,
        status: "accepted"
      },
      select: {
        eventAccess: { select: { eventId: true } }
      }
    });
    const teamEventIds = memberships.flatMap((membership) => membership.eventAccess.map((access) => access.eventId));

    const organizerFilter = {
      OR: [
        { organizerId: nativeUser.id },
        ...(nativeUser.email ? [{ organizerEmail: nativeUser.email }] : []),
        ...(teamEventIds.length > 0 ? [{ id: { in: teamEventIds } }] : [])
      ]
    };

    const [
      totalEvents,
      activeEvents,
      totals,
      eventsThisMonth,
      eventsClosingThisWeek,
      waitlistEventCount,
      registrationsThisMonth,
      registrationsLastMonth,
      totalViews,
      nearCapacityCandidates,
      upcomingCandidates,
      recentRegs
    ] = await Promise.all([
      prisma.event.count({ where: organizerFilter }),
      prisma.event.count({
        where: {
          AND: [organizerFilter, { archived: false }, { OR: [{ deadline: null }, { deadline: { gt: now } }] }]
        }
      }),
      prisma.event.aggregate({
        where: organizerFilter,
        _sum: { confirmedCount: true, waitlistCount: true }
      }),
      prisma.event.count({ where: { AND: [organizerFilter, { createdAt: { gte: monthStart } }] } }),
      prisma.event.count({ where: { AND: [organizerFilter, { deadline: { gt: now, lte: weekAhead } }] } }),
      prisma.event.count({ where: { AND: [organizerFilter, { waitlistCount: { gt: 0 } }] } }),
      prisma.registration.count({
        where: {
          event: organizerFilter,
          status: "confirmed",
          submittedAt: { gte: monthStart }
        }
      }),
      prisma.registration.count({
        where: {
          event: organizerFilter,
          status: "confirmed",
          submittedAt: { gte: lastMonthStart, lt: monthStart }
        }
      }),
      prisma.eventView.count({ where: { event: organizerFilter } }),
      prisma.event.findMany({
        where: {
          AND: [
            organizerFilter,
            { status: "active" },
            { capacity: { gt: 0 } },
            { OR: [{ deadline: null }, { deadline: { gt: now } }] }
          ]
        },
        select: { capacity: true, confirmedCount: true, dashboardToken: true, slug: true, title: true },
        take: 50
      }),
      prisma.event.findMany({
        where: {
          AND: [
            organizerFilter,
            { OR: [{ eventDate: { gt: now } }, { AND: [{ eventDate: null }, { deadline: { gt: now } }] }] }
          ]
        },
        select: { capacity: true, confirmedCount: true, deadline: true, eventDate: true, slug: true, title: true },
        take: 10
      }),
      prisma.registration.findMany({
        where: {
          event: organizerFilter,
          submittedAt: { gte: sevenDaysAgo }
        },
        select: {
          answers: true,
          event: { select: { slug: true, title: true } },
          id: true,
          submittedAt: true
        },
        orderBy: { submittedAt: "desc" },
        take: 5
      })
    ]);

    const totalRegistrations = totals._sum.confirmedCount ?? 0;
    const totalWaitlisted = totals._sum.waitlistCount ?? 0;
    const conversionRate = totalViews > 0 ? Math.round((totalRegistrations / totalViews) * 100) : 0;

    const eventsNearCapacity = nearCapacityCandidates
      .filter((event) => !!event.capacity && event.confirmedCount / event.capacity >= 0.8)
      .map((event) => ({
        capacity: event.capacity as number,
        confirmedCount: event.confirmedCount,
        dashboardToken: event.dashboardToken,
        slug: event.slug,
        title: event.title
      }))
      .sort((a, b) => b.confirmedCount / b.capacity - a.confirmedCount / a.capacity);

    const upcomingEvents = upcomingCandidates
      .map((event) => ({
        capacity: event.capacity,
        confirmedCount: event.confirmedCount,
        deadline: event.deadline?.toISOString() ?? null,
        eventDate: event.eventDate?.toISOString() ?? null,
        slug: event.slug,
        sortDate: event.eventDate ?? event.deadline,
        title: event.title
      }))
      .filter((event): event is typeof event & { sortDate: Date } => !!event.sortDate)
      .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
      .slice(0, 3)
      .map(({ sortDate, ...event }) => {
        void sortDate;
        return event;
      });

    const recentActivity = recentRegs.map((registration) => {
      const answers = Array.isArray(registration.answers)
        ? (registration.answers as Array<{ value?: unknown }>)
        : [];
      return {
        eventSlug: registration.event.slug,
        eventTitle: registration.event.title,
        id: registration.id,
        name: String(answers[0]?.value || "Someone"),
        submittedAt: registration.submittedAt.toISOString()
      };
    });

    return Response.json({
      activeEvents,
      conversionRate,
      eventsClosingThisWeek,
      eventsNearCapacity,
      eventsThisMonth,
      recentActivity,
      registrationsLastMonth,
      registrationsThisMonth,
      totalEvents,
      totalRegistrations,
      totalWaitlisted,
      upcomingEvents,
      waitlistEventCount
    });
  } catch (error) {
    return createNativeAuthErrorResponse(error);
  }
}
