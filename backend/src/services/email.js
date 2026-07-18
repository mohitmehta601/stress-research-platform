import { settings } from "../config/settings.js";

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

export function emailEnabled() {
  return Boolean(settings.brevoApiKey && settings.brevoSenderEmail);
}

export async function sendEmail({ toEmail, toName, subject, text, html }) {
  if (!emailEnabled()) {
    console.log("");
    console.log("Email delivery skipped: BREVO_API_KEY/BREVO_SENDER_EMAIL not set");
    console.log(`To: ${toEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(text);
    console.log("");
    return { status: "skipped" };
  }

  if (settings.brevoApiKey.startsWith("xsmtpsib-")) {
    const error = new Error(
      "BREVO_API_KEY is an SMTP key. Use a Brevo REST API key for transactional email delivery."
    );
    error.status = 500;
    error.detail = error.message;
    throw error;
  }

  const response = await fetch(BREVO_SEND_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": settings.brevoApiKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      sender: { email: settings.brevoSenderEmail, name: settings.brevoSenderName },
      replyTo: { email: settings.brevoSenderEmail, name: settings.brevoSenderName },
      to: [{ email: toEmail, ...(toName ? { name: toName } : {}) }],
      subject,
      textContent: text,
      htmlContent: html
    })
  });
  if (!response.ok) throw new Error(`Brevo email failed (${response.status}): ${await response.text()}`);
  return response.json().catch(() => ({}));
}
