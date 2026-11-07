import { checkPassword, login, logout, sameOrigin } from "@/lib/auth";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  try {
    const { password } = await request.json();
    if (
      typeof password !== "string" ||
      password.length > 512 ||
      !checkPassword(password)
    )
      return Response.json(
        { error: "Sign-in unavailable or password incorrect." },
        { status: 401 },
      );
    await login();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  await logout();
  return Response.json({ ok: true });
}
