import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createNativeAuthErrorResponse, requireNativeAccessToken } from "@/lib/nativeAuth";

type NativePushRegisterInput = {
  deviceId?: string;
  deviceName?: string | null;
  experienceId?: string | null;
  platform?: string;
  pushToken?: string;
};

const allowedPlatforms = new Set(["android", "ios"]);

export async function POST(req: NextRequest) {
  try {
    const nativeUser = await requireNativeAccessToken(req.headers.get("authorization"));
    const body = (await req.json().catch(() => null)) as NativePushRegisterInput | null;

    const deviceId = body?.deviceId?.trim() ?? "";
    const pushToken = body?.pushToken?.trim() ?? "";
    const platform = body?.platform?.trim().toLowerCase() ?? "";
    const deviceName = body?.deviceName?.trim() || null;
    const experienceId = body?.experienceId?.trim() || null;

    if (!deviceId || !pushToken || !allowedPlatforms.has(platform)) {
      return Response.json(
        {
          success: false,
          error: "Device id, push token, and a valid platform are required."
        },
        { status: 400 }
      );
    }

    // Ensure a recycled Expo token is no longer attached to another device or user.
    await prisma.nativePushDevice.deleteMany({
      where: {
        pushToken,
        NOT: {
          userId: nativeUser.id,
          deviceId
        }
      }
    });

    const device = await prisma.nativePushDevice.upsert({
      where: {
        userId_deviceId: {
          userId: nativeUser.id,
          deviceId
        }
      },
      update: {
        deviceName,
        experienceId,
        lastRegisteredAt: new Date(),
        platform,
        pushToken
      },
      create: {
        userId: nativeUser.id,
        deviceId,
        deviceName,
        experienceId,
        platform,
        pushToken
      },
      select: {
        id: true,
        platform: true,
        pushToken: true,
        lastRegisteredAt: true
      }
    });

    return Response.json({
      success: true,
      device: {
        id: device.id,
        platform: device.platform,
        pushToken: device.pushToken,
        lastRegisteredAt: device.lastRegisteredAt.toISOString()
      }
    });
  } catch (error) {
    return createNativeAuthErrorResponse(error);
  }
}
