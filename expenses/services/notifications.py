import requests

from django.conf import settings


def send_budget_alert(message):
    if not settings.DISCORD_WEBHOOK_URL:
        return

    requests.post(
        settings.DISCORD_WEBHOOK_URL,
        json={
            "content": message,
        },
        timeout=10,
    )