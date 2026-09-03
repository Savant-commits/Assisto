import { NextResponse } from "next/server";
import { approveApplication } from "@/app/actions/applications";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await approveApplication(params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}
