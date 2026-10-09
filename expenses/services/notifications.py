import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def send_budget_alert(message: str):
    """
    Deliver budget threshold alerts to configured channels (Discord webhook or Telegram bot).
    Fails safely without breaking expense creation.
    """
    logger.info("Budget Alert Triggered: %s", message)

    # 1. Discord Webhook
    discord_url = getattr(settings, "DISCORD_WEBHOOK_URL", None)
    if discord_url:
        try:
            requests.post(
                discord_url,
                json={"content": message},
                timeout=5,
            )
        except Exception as exc:
            logger.warning("Failed to send alert to Discord: %s", exc)

    # 2. Telegram Bot
    bot_token = getattr(settings, "BOT_TOKEN", None)
    bot_chat_id = getattr(settings, "BOT_CHAT_ID", None)
    if bot_token and bot_chat_id:
        try:
            telegram_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            requests.post(
                telegram_url,
                json={
                    "chat_id": bot_chat_id,
                    "text": message,
                    "parse_mode": "Markdown",
                },
                timeout=5,
            )
        except Exception as exc:
            logger.warning("Failed to send alert to Telegram: %s", exc)