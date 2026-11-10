import { sameOrigin, session } from "@/lib/auth";
import { customerServer } from "@/lib/customer/server";
import {
  customerEmailLimit,
  customerDailyEmailLimit,
} from "@/lib/customer/mail";
import {
  customerEmailDeliveryConfig,
  GMAIL_ADDRESS,
  sendCustomerEmail,
} from "@/lib/customer/email-delivery";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!sameOrigin(request) || !(await session()))
    return Response.json({ error: "Unauthorized" }, { status: 403, headers });
  const config = customerEmailDeliveryConfig();
  if (config.provider !== "gmail" || !config.ready)
    return Response.json(
      { error: "Save the Gmail app password in Vercel and redeploy first." },
      { status: 503, headers },
    );
  try {
    const service = customerServer();
    await service.ready();
    await customerEmailLimit(
      service.client,
      GMAIL_ADDRESS,
      "gmail-connection-test",
    );
    await customerDailyEmailLimit(service.client);
  } catch {
    return Response.json(
      { error: "Email testing is temporarily unavailable. Try again later." },
      { status: 429, headers },
    );
  }
  try {
    await sendCustomerEmail({
      to: GMAIL_ADDRESS,
      subject: "Larkova Art — Gmail connection test",
      text: "Your Larkova Art website successfully submitted this message through Gmail. Customer account emails use the same sending connection. Please check that this message arrived.",
      html: "<p>Your Larkova Art website successfully submitted this message through Gmail.</p><p>Customer account emails use the same sending connection. Please check that this message arrived.</p>",
    });
    return Response.json(
      {
        message:
          "Gmail accepted the test email. Check larkova.art@gmail.com to confirm arrival.",
      },
      { headers },
    );
  } catch {
    return Response.json(
      {
        error:
          "Gmail did not confirm sending. Check the app password and Google account security alerts before trying again.",
      },
      { status: 502, headers },
    );
  }
}
