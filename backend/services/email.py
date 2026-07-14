import asyncio
import json
import urllib.error
import urllib.request

from backend.app.config import get_settings

settings = get_settings()

BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email"


class EmailDeliveryError(RuntimeError):
    pass


def email_enabled() -> bool:
    return bool(settings.brevo_api_key and settings.brevo_sender_email)


def _post_brevo(payload: dict) -> dict:
    request = urllib.request.Request(
        BREVO_SEND_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "accept": "application/json",
            "api-key": settings.brevo_api_key or "",
            "content-type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise EmailDeliveryError(
            f"Brevo email failed ({error.code}): {detail}"
        ) from error
    except urllib.error.URLError as error:
        raise EmailDeliveryError(
            f"Brevo email failed: {error.reason}"
        ) from error


async def send_email(
    *,
    to_email: str,
    to_name: str | None,
    subject: str,
    text: str,
    html: str,
) -> dict:
    if not email_enabled():
        print("")
        print("Email delivery skipped: BREVO_API_KEY/BREVO_SENDER_EMAIL not set")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(text)
        print("")
        return {"status": "skipped"}

    payload = {
        "sender": {
            "email": settings.brevo_sender_email,
            "name": settings.brevo_sender_name,
        },
        "replyTo": {
            "email": settings.brevo_sender_email,
            "name": settings.brevo_sender_name,
        },
        "to": [
            {
                "email": to_email,
                **({"name": to_name} if to_name else {}),
            }
        ],
        "subject": subject,
        "textContent": text,
        "htmlContent": html,
    }

    return await asyncio.to_thread(_post_brevo, payload)
