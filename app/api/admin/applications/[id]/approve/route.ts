import { NextResponse } from "next/server";
import { approveApplication } from "@/app/actions/applications";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BAD_REQUEST_ERRORS = new Set([
  "Application not found",
  "This application has already been decided",
  "Applicant's phone number is not verified.",
  "Call the applicant and record a verified result before approving.",
]);

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ ok: false, error: "Invalid application ID" }, { status: 400 });
    }

    await approveApplication(id);
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
