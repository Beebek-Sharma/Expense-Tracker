from decimal import Decimal
from django.conf import settings
from django.utils import timezone

from .currency import convert_amount
from .notifications import send_budget_alert


def check_budget_limit(category):
    today = timezone.now().date()

    expenses = category.expenses.filter(
        date__year=today.year,
        date__month=today.month,
    )

    total = Decimal("0.00")

    for expense in expenses:
        converted_amount, _ = convert_amount(
            expense.amount,
            expense.currency,
            settings.BASE_CURRENCY,
        )

        total += converted_amount

    if (
        category.monthly_limit
        and total > category.monthly_limit
    ):
        send_budget_alert(
            (
                f'⚠️ Budget alert: "{category.name}" '
                f'is over its monthly limit.\n'
                f"Spent {total:.2f} / "
                f"{category.monthly_limit:.2f} "
                f"{settings.BASE_CURRENCY}"
            )
        )