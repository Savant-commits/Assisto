import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export async function GET() {
  const to = process.env.TEST_EMAIL_RECIPIENT;

  if (!to) {
    const message = "TEST_EMAIL_RECIPIENT is not set";
    console.error("[test-email]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  const subject = "Assisto test email";
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="margin-bottom: 12px;">Assisto test email</h2>
      <p>This is a temporary local-only email test from the Assisto app.</p>
      <p>If you received this, the email sending path is working correctly.</p>
    </div>
  `;

  try {
    console.log(`[test-email] Sending test email to ${to}`);
    const result = await sendEmail({ to, subject, html });
    console.log("[test-email] Email sent successfully:", result);

    return NextResponse.json({
      ok: true,
      to,
      subject,
      messageId: result?.id ?? null,
    });
  } catch (error: any) {
    const message = error?.message || "Unknown error sending test email";
    console.error("[test-email] Email send failed:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
