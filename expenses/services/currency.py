from decimal import Decimal
import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# Fallback conversion rates relative to USD (1 USD = X currency)
FALLBACK_USD_RATES = {
    "USD": Decimal("1.0"),
    "EUR": Decimal("0.92"),
    "GBP": Decimal("0.78"),
    "JPY": Decimal("155.0"),
    "CAD": Decimal("1.36"),
    "AUD": Decimal("1.52"),
    "INR": Decimal("83.5"),
    "NPR": Decimal("133.6"),
    "CHF": Decimal("0.90"),
    "CNY": Decimal("7.24"),
}

# Cache structure: {(from_curr, to_curr): rate}
_RATE_CACHE = {}


def get_exchange_rate(from_currency: str, to_currency: str) -> Decimal:
    """
    Fetch exchange rate from from_currency to to_currency.
    Uses in-memory caching and fallback rates on network/API failure.
    """
    from_currency = (from_currency or "USD").upper()
    to_currency = (to_currency or "USD").upper()

    if from_currency == to_currency:
        return Decimal("1.0")

    cache_key = (from_currency, to_currency)
    if cache_key in _RATE_CACHE:
        return _RATE_CACHE[cache_key]

    rate = None

    # Try fetching from configured exchange rate API
    try:
        api_url = getattr(settings, "EXCHANGE_RATE_API_URL", "")
        api_key = getattr(settings, "EXCHANGE_RATE_API_KEY", "")

        if api_key and api_url:
            url = f"{api_url.rstrip('/')}/{api_key}/latest/{from_currency}"
        elif api_url:
            url = f"{api_url.rstrip('/')}/{from_currency}"
        else:
            url = f"https://open.er-api.com/v6/latest/{from_currency}"

        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            rates = data.get("conversion_rates") or data.get("rates")
            if rates and to_currency in rates:
                rate = Decimal(str(rates[to_currency]))
    except Exception as exc:
        logger.warning(
            "Could not fetch online exchange rate (%s -> %s): %s. Using fallback.",
            from_currency,
            to_currency,
            exc,
        )

    # Fallback rate calculation if external API fails or is unavailable
    if rate is None:
        from_usd_rate = FALLBACK_USD_RATES.get(from_currency, Decimal("1.0"))
        to_usd_rate = FALLBACK_USD_RATES.get(to_currency, Decimal("1.0"))
        # 1 from_currency in USD is (1 / from_usd_rate), then in to_currency is * to_usd_rate
        rate = (Decimal("1.0") / from_usd_rate) * to_usd_rate

    _RATE_CACHE[cache_key] = rate
    return rate


def convert_amount(amount: Decimal, from_currency: str, to_currency: str):
    """
    Convert an amount from from_currency to to_currency.
    Returns (converted_amount, exchange_rate).
    """
    rate = get_exchange_rate(from_currency, to_currency)
    return amount * rate, rate