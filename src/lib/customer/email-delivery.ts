import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";
import type { SendMailOptions, SentMessageInfo } from "nodemailer";

export const GMAIL_ADDRESS = "larkova.art@gmail.com";
export function customerEmailDeliveryConfig() {
  const provider = process.env.CUSTOMER_EMAIL_PROVIDER || "resend";
  const password = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, "");
  const from =
    provider === "gmail"
      ? `Larkova Art <${GMAIL_ADDRESS}>`
      : process.env.CUSTOMER_EMAIL_FROM || "";
  return {
    provider,
    from,
    password,
    ready:
      provider === "gmail"
        ? /^[a-z]{16}$/i.test(password)
        : provider === "resend" && !!process.env.RESEND_API_KEY && !!from,
  };
}

type Message = { to: string; subject: string; text: string; html: string };
type Dependencies = {
  fetcher?: typeof fetch;
  gmailSend?: (message: SendMailOptions) => Promise<Pick<SentMessageInfo, "accepted" | "rejected">>;
};

export async function sendCustomerEmail(
  message: Message,
  dependencies: Dependencies = {},
) {
  const config = customerEmailDeliveryConfig();
  if (
    !config.ready ||
    !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(message.to) ||
    /[\r\n]/.test(message.subject)
  )
    throw new Error("Customer email is not configured or invalid");

  if (config.provider === "gmail") {
    const transport = dependencies.gmailSend
      ? undefined
      : nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: { user: GMAIL_ADDRESS, pass: config.password },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
          disableFileAccess: true,
          disableUrlAccess: true,
          logger: false,
          debug: false,
        });
    try {
      const send =
        dependencies.gmailSend || transport!.sendMail.bind(transport);
      const result = await send({
        ...message,
        from: config.from,
        replyTo: GMAIL_ADDRESS,
        envelope: { from: GMAIL_ADDRESS, to: [message.to] },
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      if (
        !result.accepted?.some((address: unknown) => address === message.to) ||
        result.rejected?.length
      )
        throw new Error("Not accepted");
    } catch {
      // Never expose provider responses, credentials, message bodies or OTPs.
      // Do not retry or fall back after an uncertain SMTP result.
      throw new Error("Customer email delivery was not accepted");
    } finally {
      transport?.close();
    }
    return;
  }

  try {
    const response = await (dependencies.fetcher || fetch)(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `customer-${randomUUID()}`,
        },
        body: JSON.stringify({
          from: config.from,
          ...message,
          to: [message.to],
        }),
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      },
    );
    if (!response.ok) throw new Error("Not accepted");
  } catch {
    throw new Error("Customer email delivery was not accepted");
  }
}
