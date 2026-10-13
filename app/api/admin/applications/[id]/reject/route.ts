import { NextResponse } from "next/server";
import { rejectApplication } from "@/app/actions/applications";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BAD_REQUEST_ERRORS = new Set([
  "Application not found",
  "This application has already been decided",
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ ok: false, error: "Invalid application ID" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }
    const reason = typeof body === "object" && body !== null && "reason" in body
      ? body.reason
      : undefined;
    if (reason !== undefined && reason !== null && typeof reason !== "string") {
      return NextResponse.json({ ok: false, error: "Invalid rejection reason" }, { status: 400 });
    }

    await rejectApplication(id, typeof reason === "string" ? reason : "");
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message === "Not signed in") {
      return NextResponse.json({ ok: false, error: message }, { status: 401 });
    }
    if (message === "Not authorized") {
      return NextResponse.json({ ok: false, error: message }, { status: 403 });
    }
    if (BAD_REQUEST_ERRORS.has(message)) {
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Request failed" }, { status: 500 });
  }
}
