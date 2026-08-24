/** @jest-environment node */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/native/push/register/route";

const mockRequireNativeAccessToken = jest.fn();
const mockDeleteMany = jest.fn();
const mockUpsert = jest.fn();

jest.mock("@/lib/nativeAuth", () => ({
  createNativeAuthErrorResponse: jest.fn((error: unknown) =>
    Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Native authentication failed."
      },
      { status: 401 }
    )
  ),
  requireNativeAccessToken: (...args: unknown[]) => mockRequireNativeAccessToken(...args)
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    nativePushDevice: {
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args)
    }
  }
}));

describe("POST /api/native/push/register", () => {
  beforeEach(() => {
    mockRequireNativeAccessToken.mockReset();
    mockDeleteMany.mockReset();
    mockUpsert.mockReset();

    mockRequireNativeAccessToken.mockResolvedValue({
      id: "user-1",
      email: "organizer@eventslot.test"
    });
    mockDeleteMany.mockResolvedValue({ count: 0 });
  });

  it("rejects invalid payloads", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/native/push/register", {
        method: "POST",
        body: JSON.stringify({
          deviceId: "device-1",
          platform: "web"
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("registers a native push device for the authenticated user", async () => {
    mockUpsert.mockResolvedValue({
      id: "push-1",
      platform: "android",
      pushToken: "ExponentPushToken[test]",
      lastRegisteredAt: new Date("2026-07-27T09:30:00.000Z")
    });

    const response = await POST(
      new NextRequest("http://localhost/api/native/push/register", {
        method: "POST",
        body: JSON.stringify({
          deviceId: "device-1",
          deviceName: "Pixel 8",
          experienceId: "@eventslot/mobile",
          platform: "android",
          pushToken: "ExponentPushToken[test]"
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: {
        pushToken: "ExponentPushToken[test]",
        NOT: {
          userId: "user-1",
          deviceId: "device-1"
        }
      }
    });
    expect(mockUpsert).toHaveBeenCalledWith({
      where: {
        userId_deviceId: {
          userId: "user-1",
          deviceId: "device-1"
        }
      },
      update: expect.objectContaining({
        deviceName: "Pixel 8",
        experienceId: "@eventslot/mobile",
        platform: "android",
        pushToken: "ExponentPushToken[test]"
      }),
      create: {
        userId: "user-1",
        deviceId: "device-1",
        deviceName: "Pixel 8",
        experienceId: "@eventslot/mobile",
        platform: "android",
        pushToken: "ExponentPushToken[test]"
      },
      select: {
        id: true,
        platform: true,
        pushToken: true,
        lastRegisteredAt: true
      }
    });
    expect(body).toEqual({
      success: true,
      device: {
        id: "push-1",
        platform: "android",
        pushToken: "ExponentPushToken[test]",
        lastRegisteredAt: "2026-07-27T09:30:00.000Z"
      }
    });
  });

  it("returns auth errors through the shared native auth handler", async () => {
    mockRequireNativeAccessToken.mockRejectedValue(new Error("Missing bearer token."));

    const response = await POST(
      new NextRequest("http://localhost/api/native/push/register", {
        method: "POST",
        body: JSON.stringify({
          deviceId: "device-1",
          platform: "android",
          pushToken: "ExponentPushToken[test]"
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      success: false,
      error: "Missing bearer token."
    });
  });
});
