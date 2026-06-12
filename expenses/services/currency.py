from decimal import Decimal

import requests
from django.conf import settings


def get_exchange_rate(
    from_currency,
    to_currency,
):
    if from_currency == to_currency:
        return Decimal("1.0")

    response = requests.get(
        f"{settings.EXCHANGE_RATE_API_URL}/"
        f"{settings.EXCHANGE_RATE_API_KEY}/"
        f"latest/{from_currency}",
        timeout=10,
    )

    response.raise_for_status()

    data = response.json()

    if data["result"] != "success":
        raise ValueError(
            f"Exchange API error: {data}"
        )

    return Decimal(
        str(data["conversion_rates"][to_currency])
    )


def convert_amount(
    amount,
    from_currency,
    to_currency,
):
    rate = get_exchange_rate(
        from_currency,
        to_currency,
    )

    return amount * rate, rate