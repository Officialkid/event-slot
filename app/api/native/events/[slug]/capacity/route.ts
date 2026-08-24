import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { generateConfirmationCode } from "@/lib/confirmationCode";
import { purgeUserCache } from "@/lib/cache";
import { createNativeAuthErrorResponse, requireNativeAccessToken } from "@/lib/nativeAuth";

export async function PATCH(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  try {
    const nativeUser = await requireNativeAccessToken(req.headers.get("authorization"));
    const { slug } = await props.params;
    const body = (await req.json()) as { newCapacity?: unknown };
    const newCapacity = typeof body.newCapacity === "number" ? body.newCapacity : Number.NaN;

    const event = await prisma.event.findUnique({
      where: { slug }
    });

    if (!event) {
      return Response.json({ success: false, error: "Event not found." }, { status: 404 });
    }

    const ownsEvent = event.organizerId === nativeUser.id || (!!nativeUser.email && event.organizerEmail === nativeUser.email);
    const teamAccess = ownsEvent
      ? null
      : await prisma.teamMemberEvent.findFirst({
          where: {
            eventId: event.id,
            teamMember: {
              memberId: nativeUser.id,
              status: "accepted"
            }
          },
          select: { id: true }
        });

    if (!ownsEvent && !teamAccess) {
      return Response.json({ success: false, error: "You do not have access to update this event capacity." }, { status: 403 });
    }

    if (!Number.isInteger(newCapacity) || newCapacity <= 0) {
      return Response.json({ success: false, error: "Invalid new capacity." }, { status: 400 });
    }

    if (event.isPaid) {
      return Response.json(
        {
          success: false,
          error: "Paid-event capacity changes are managed per ticket tier. Use the web ticket tiers editor for now."
        },
        { status: 400 }
      );
    }

    if (event.capacity !== null && newCapacity === event.capacity) {
      return Response.json({ success: false, error: "Capacity is already set to that number." }, { status: 400 });
    }

    if (newCapacity < event.confirmedCount) {
      return Response.json(
        {
          success: false,
          error: `Capacity cannot be lower than the ${event.confirmedCount} people already confirmed.`
        },
        { status: 400 }
      );
    }

    const addedSlots =
      event.capacity === null ? Math.max(0, newCapacity - event.confirmedCount) : Math.max(0, newCapacity - event.capacity);

    if (event.capacity !== null && newCapacity < event.capacity) {
      const updatedEvent = await prisma.event.update({
        where: { id: event.id },
        data: { capacity: newCapacity },
        select: {
          capacity: true,
          confirmedCount: true,
          waitlistCount: true
        }
      });

      if (event.organizerId) {
        purgeUserCache(event.organizerId, event.organizerEmail ?? null);
      }

      return Response.json({
        success: true,
        promoted: 0,
        newConfirmedCount: updatedEvent.confirmedCount,
        newWaitlistCount: updatedEvent.waitlistCount,
        remainingSlots: Math.max(0, newCapacity - updatedEvent.confirmedCount),
        capacity: updatedEvent.capacity
      });
    }

    if (addedSlots <= 0) {
      return Response.json({ success: false, error: "Capacity update did not create any new slots." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const waitlistToPromote = await tx.registration.findMany({
        where: { eventId: event.id, status: "waitlist" },
        orderBy: { waitlistPosition: "asc" },
        take: Math.min(addedSlots, event.waitlistCount),
        select: { id: true }
      });

      const promoted = waitlistToPromote.length;

      await Promise.all(
        waitlistToPromote.map((item) =>
          tx.registration.update({
            where: { id: item.id },
            data: { status: "confirmed", waitlistPosition: null, confirmationCode: generateConfirmationCode() }
          })
        )
      );

      const updatedEvent = await tx.event.update({
        where: { id: event.id },
        data: {
          capacity: newCapacity,
          confirmedCount: { increment: promoted },
          waitlistCount: { increment: promoted * -1 }
        },
        select: {
          capacity: true,
          confirmedCount: true,
          waitlistCount: true
        }
      });

      return {
        promoted,
        newConfirmedCount: updatedEvent.confirmedCount,
        newWaitlistCount: updatedEvent.waitlistCount,
        remainingSlots: Math.max(0, newCapacity - updatedEvent.confirmedCount),
        capacity: updatedEvent.capacity
      };
    });

    if (result.promoted > 0 && event.organizerId) {
      await createNotification({
        userId: event.organizerId,
        type: "EVENT",
        title: "Waitlist Promotion",
        message: `${result.promoted} ${result.promoted === 1 ? "person was" : "people were"} moved from the waitlist to confirmed for "${event.title}".`,
        link: `/dashboard/events/${slug}`
      }).catch(() => {});
    }

    if (event.organizerId) {
      purgeUserCache(event.organizerId, event.organizerEmail ?? null);
    }

    return Response.json({
      success: true,
      promoted: result.promoted,
      newConfirmedCount: result.newConfirmedCount,
      newWaitlistCount: result.newWaitlistCount,
      remainingSlots: result.remainingSlots,
      capacity: result.capacity
    });
  } catch (error) {
    return createNativeAuthErrorResponse(error);
  }
}
