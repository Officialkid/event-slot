export async function POST() {
  return Response.json({
    success: true,
    message: "Native logout accepted. Stateless refresh-token revocation is still a production gate."
  });
}
