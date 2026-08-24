import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { offerNextPaidWaitlistSpot } from "@/lib/paidEventWaitlist";
import { purgeUserCache } from "@/lib/cache";
import { createNativeAuthErrorResponse, requireNativeAccessToken } from "@/lib/nativeAuth";
import { resolveTierBadgeFields } from "@/lib/tierPresets";

type NativeTierInput = {
  id?: string;
  name: string;
  presetKey?: string | null;
  priceKes: number;
  capacity: number;
  description?: string | null;
  bundleSize?: number;
};

const defaultTierPalette = {
  badgeColor: "#27272A",
  textColor: "#F4F4F5",
  metallic: false,
  prestige: 0,
  currency: "KES"
} as const;

export async function PATCH(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  try {
    const nativeUser = await requireNativeAccessToken(req.headers.get("authorization"));
    const { slug } = await props.params;

    const event = await prisma.event.findUnique({
      where: { slug },
      include: {
        ticketTiers: {
          orderBy: { sortOrder: "asc" }
        }
      }
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
      return Response.json({ success: false, error: "You do not have access to update these ticket tiers." }, { status: 403 });
    }

    if (!event.isPaid) {
      return Response.json({ success: false, error: "This event is not a paid event." }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as { ticketTiers?: NativeTierInput[] } | null;
    const ticketTiers = body?.ticketTiers ?? [];

    if (!Array.isArray(ticketTiers) || ticketTiers.length === 0) {
      return Response.json({ success: false, error: "At least one ticket tier is required." }, { status: 400 });
    }

    if (ticketTiers.length > 10) {
      return Response.json({ success: false, error: "Maximum 10 ticket tiers allowed." }, { status: 400 });
    }

    for (const tier of ticketTiers) {
      if (!tier.name?.trim() || !tier.priceKes || tier.priceKes < 50 || !tier.capacity || tier.capacity < 1) {
        return Response.json({ success: false, error: "Each tier needs a name, a minimum KSh 50 price, and a capacity." }, { status: 400 });
      }
      if (tier.bundleSize !== undefined && (!Number.isInteger(tier.bundleSize) || tier.bundleSize < 1 || tier.bundleSize > 100)) {
        return Response.json({ success: false, error: "Bundle size must be between 1 and 100." }, { status: 400 });
      }
    }

    const existingById = new Map(event.ticketTiers.map((tier) => [tier.id, tier]));
    const offeredTierIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      const incomingIds = new Set(ticketTiers.map((tier) => tier.id).filter(Boolean) as string[]);

      for (const [index, tier] of ticketTiers.entries()) {
        const resolvedBadge = resolveTierBadgeFields({
          name: tier.name.trim(),
          presetKey: tier.presetKey ?? null
        });

        if (tier.id && existingById.has(tier.id)) {
          const previous = existingById.get(tier.id)!;
          await tx.ticketTier.update({
            where: { id: tier.id },
            data: {
              name: resolvedBadge.name,
              presetKey: resolvedBadge.presetKey,
              badgeColor: resolvedBadge.badgeColor || previous.badgeColor || defaultTierPalette.badgeColor,
              textColor: resolvedBadge.textColor || previous.textColor || defaultTierPalette.textColor,
              metallic: resolvedBadge.metallic,
              prestige: resolvedBadge.prestige,
              priceKes: Number(tier.priceKes),
              currency: previous.currency || defaultTierPalette.currency,
              capacity: Number(tier.capacity),
              description: tier.description?.trim() || null,
              bundleSize: Number(tier.bundleSize || previous.bundleSize || 1),
              sortOrder: index,
              status: "ACTIVE"
            }
          });

          if (tier.capacity > previous.capacity && previous.waitlistCount > 0) {
            offeredTierIds.push(tier.id);
          }
        } else {
          const created = await tx.ticketTier.create({
            data: {
              eventId: event.id,
              name: resolvedBadge.name,
              presetKey: resolvedBadge.presetKey,
              badgeColor: resolvedBadge.badgeColor || defaultTierPalette.badgeColor,
              textColor: resolvedBadge.textColor || defaultTierPalette.textColor,
              metallic: resolvedBadge.metallic,
              prestige: resolvedBadge.prestige,
              priceKes: Number(tier.priceKes),
              currency: defaultTierPalette.currency,
              capacity: Number(tier.capacity),
              description: tier.description?.trim() || null,
              bundleSize: Number(tier.bundleSize || 1),
              sortOrder: index
            },
            select: { id: true }
          });
          offeredTierIds.push(created.id);
        }
      }

      for (const existing of event.ticketTiers) {
        if (!incomingIds.has(existing.id)) {
          if (existing.soldCount > 0 || existing.waitlistCount > 0) {
            await tx.ticketTier.update({
              where: { id: existing.id },
              data: { status: "ARCHIVED" }
            });
          } else {
            await tx.ticketTier.delete({ where: { id: existing.id } });
          }
        }
      }

      await tx.event.update({
        where: { id: event.id },
        data: {
          capacity: ticketTiers.reduce((sum, tier) => sum + Number(tier.capacity || 0), 0),
          ticketPrice: Number(ticketTiers[0].priceKes)
        }
      });
    });

    for (const tierId of offeredTierIds) {
      await offerNextPaidWaitlistSpot(event.id, tierId).catch(() => {});
    }

    const updated = await prisma.ticketTier.findMany({
      where: { eventId: event.id },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        presetKey: true,
        badgeColor: true,
        textColor: true,
        metallic: true,
        prestige: true,
        priceKes: true,
        capacity: true,
        description: true,
        bundleSize: true,
        soldCount: true,
        waitlistCount: true,
        status: true
      }
    });

    if (event.organizerId) {
      purgeUserCache(event.organizerId, event.organizerEmail ?? null);
    }

    return Response.json({
      success: true,
      ticketTiers: updated
    });
  } catch (error) {
    return createNativeAuthErrorResponse(error);
  }
}
