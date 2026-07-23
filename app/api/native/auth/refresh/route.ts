import { refreshNativeUserSession, createNativeAuthErrorResponse } from "@/lib/nativeAuth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : "";
    const session = await refreshNativeUserSession(refreshToken);

    return Response.json(session);
  } catch (error) {
    return createNativeAuthErrorResponse(error);
  }
}
