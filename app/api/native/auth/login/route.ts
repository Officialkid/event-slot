import { loginNativeUser, createNativeAuthErrorResponse } from "@/lib/nativeAuth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const session = await loginNativeUser({
      email: String(body?.email ?? ""),
      otp: typeof body?.otp === "string" ? body.otp : undefined,
      password: typeof body?.password === "string" ? body.password : undefined
    });

    return Response.json(session);
  } catch (error) {
    return createNativeAuthErrorResponse(error);
  }
}
