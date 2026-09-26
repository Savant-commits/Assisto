import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const { data, error } = await resend.emails.send({
    from: "Assisto <onboarding@resend.dev>", // switch to a verified domain sender later
    to,
    subject,
    html,
  });

  if (error) {
    console.error("Resend send failed:", error);
    throw new Error(error.message);
  }

  return data;
}