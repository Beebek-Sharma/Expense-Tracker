import csv
from collections import defaultdict
from decimal import Decimal
from django.conf import settings
from django.contrib.auth import authenticate
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Category, Expense
from .serializers import (
    CategorySerializer,
    ExpenseSerializer,
    RegisterSerializer,
    UserSerializer,
)
from .services.budget import check_budget_limit
from .services.currency import convert_amount


# ==============================================================================
# Authentication Endpoints
# ==============================================================================


@api_view(["POST"])
@permission_classes([AllowAny])
def register_user(request):
    """Register a new user and return an auth token."""
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    token, _ = Token.objects.get_or_create(user=user)
    return Response(
        {
            "token": token.key,
            "user": UserSerializer(user).data,
            "message": "User registered successfully.",
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def login_user(request):
    """Authenticate a user and return an auth token."""
    username = request.data.get("username")
    password = request.data.get("password")

    if not username or not password:
        return Response(
            {"error": "Please provide both username and password."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(username=username, password=password)
    if not user:
        return Response(
            {"error": "Invalid username or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    token, _ = Token.objects.get_or_create(user=user)
    return Response(
        {
            "token": token.key,
            "user": UserSerializer(user).data,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user(request):
    """Return currently authenticated user information."""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


# ==============================================================================
# Categories
# ==============================================================================


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def category_list(request):
    """List all categories for the authenticated user or create a new one."""
    if request.method == "GET":
        categories = Category.objects.filter(user=request.user).order_by("name")
        serializer = CategorySerializer(categories, many=True)
        return Response(serializer.data)

    serializer = CategorySerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    serializer.save(user=request.user)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def category_detail(request, pk):
    """Retrieve, update, or delete a specific category."""
    category = get_object_or_404(Category, pk=pk, user=request.user)

    if request.method == "GET":
        serializer = CategorySerializer(category)
        return Response(serializer.data)

    if request.method in ["PUT", "PATCH"]:
        serializer = CategorySerializer(
            category,
            data=request.data,
            partial=(request.method == "PATCH"),
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    category.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ==============================================================================
# Expenses
# ==============================================================================


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def expense_list(request):
    """
    List expenses with optional search, category, and date filtering,
    or create a new expense and trigger budget checks.
    """
    if request.method == "GET":
        expenses = (
            Expense.objects.filter(user=request.user)
            .select_related("category")
            .order_by("-date", "-id")
        )

        search = request.query_params.get("search")
        category = request.query_params.get("category")
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")

        if search:
            expenses = expenses.filter(title__icontains=search)
        if category:
            expenses = expenses.filter(category_id=category)
        if start_date:
            expenses = expenses.filter(date__gte=start_date)
        if end_date:
            expenses = expenses.filter(date__lte=end_date)

        serializer = ExpenseSerializer(expenses, many=True)
        return Response(serializer.data)

    serializer = ExpenseSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    expense = serializer.save(user=request.user)

    # Budget alert check
    check_budget_limit(expense.category)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def expense_detail(request, pk):
    """Retrieve, update, or delete a specific expense."""
    expense = get_object_or_404(
        Expense.objects.select_related("category"),
        pk=pk,
        user=request.user,
    )

    if request.method == "GET":
        serializer = ExpenseSerializer(expense)
        return Response(serializer.data)

    if request.method in ["PUT", "PATCH"]:
        serializer = ExpenseSerializer(
            expense,
            data=request.data,
            partial=(request.method == "PATCH"),
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        expense = serializer.save(user=request.user)
        check_budget_limit(expense.category)
        return Response(serializer.data)

    expense.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ==============================================================================
# Summaries & Analytics
# ==============================================================================


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def expense_summary(request):
    """
    Returns total spent per category converted into BASE_CURRENCY.
    """
    expenses = Expense.objects.filter(user=request.user).select_related("category")
    category_totals = defaultdict(lambda: Decimal("0.00"))

    for expense in expenses:
        converted_amount, _ = convert_amount(
            expense.amount,
            expense.currency,
            settings.BASE_CURRENCY,
        )
        category_totals[expense.category.name] += converted_amount

    categories = [
        {
            "category": cat_name,
            "total": str(total.quantize(Decimal("0.01"))),
        }
        for cat_name, total in sorted(category_totals.items())
    ]

    return Response(
        {
            "base_currency": settings.BASE_CURRENCY,
            "categories": categories,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def monthly_summary(request):
    """
    Returns total spending for a given month or the current month,
    converted to BASE_CURRENCY.
    Supports query param ?month=YYYY-MM.
    """
    month_param = request.query_params.get("month")
    if month_param:
        try:
            year_str, month_str = month_param.split("-")
            year = int(year_str)
            month = int(month_str)
        except (ValueError, TypeError):
            return Response(
                {"error": "Invalid month format. Expected YYYY-MM."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    else:
        today = timezone.now().date()
        year = today.year
        month = today.month

    expenses = Expense.objects.filter(
        user=request.user,
        date__year=year,
        date__month=month,
    )

    total = Decimal("0.00")
    for expense in expenses:
        converted_amount, _ = convert_amount(
            expense.amount,
            expense.currency,
            settings.BASE_CURRENCY,
        )
        total += converted_amount

    return Response(
        {
            "month": f"{year:04d}-{month:02d}",
            "base_currency": settings.BASE_CURRENCY,
            "total": str(total.quantize(Decimal("0.01"))),
            "expense_count": expenses.count(),
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics_dashboard(request):
    """
    Comprehensive metrics for dashboard charts:
    - total spending in base currency
    - monthly spending for last 6 months
    - spending per category vs budget limits
    - top categories
    - recent expenses
    """
    today = timezone.now().date()
    all_expenses = Expense.objects.filter(user=request.user).select_related("category")
    categories = Category.objects.filter(user=request.user)

    total_spent_base = Decimal("0.00")
    category_data = {}

    for cat in categories:
        category_data[cat.id] = {
            "id": cat.id,
            "name": cat.name,
            "monthly_limit": str(cat.monthly_limit) if cat.monthly_limit else None,
            "total_spent_base": Decimal("0.00"),
            "current_month_spent_base": Decimal("0.00"),
        }

    # Month by month aggregation (last 6 months)
    month_series = {}
    for i in range(5, -1, -1):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        key = f"{y:04d}-{m:02d}"
        month_series[key] = Decimal("0.00")

    for expense in all_expenses:
        converted, _ = convert_amount(
            expense.amount, expense.currency, settings.BASE_CURRENCY
        )
        total_spent_base += converted

        # Category spending
        if expense.category_id in category_data:
            category_data[expense.category_id]["total_spent_base"] += converted
            if (
                expense.date.year == today.year
                and expense.date.month == today.month
            ):
                category_data[expense.category_id]["current_month_spent_base"] += converted

        # Monthly series
        exp_m_key = f"{expense.date.year:04d}-{expense.date.month:02d}"
        if exp_m_key in month_series:
            month_series[exp_m_key] += converted

    category_list_resp = []
    for cat_info in category_data.values():
        total_b = cat_info["total_spent_base"]
        month_b = cat_info["current_month_spent_base"]
        limit_b = Decimal(cat_info["monthly_limit"]) if cat_info["monthly_limit"] else None
        budget_ratio = (
            float((month_b / limit_b) * 100) if limit_b and limit_b > 0 else None
        )
        category_list_resp.append(
            {
                "id": cat_info["id"],
                "name": cat_info["name"],
                "monthly_limit": cat_info["monthly_limit"],
                "total_spent": str(total_b.quantize(Decimal("0.01"))),
                "current_month_spent": str(month_b.quantize(Decimal("0.01"))),
                "budget_percentage": round(budget_ratio, 1) if budget_ratio else None,
                "is_over_budget": bool(budget_ratio and budget_ratio > 100),
            }
        )

    category_list_resp.sort(key=lambda x: Decimal(x["total_spent"]), reverse=True)

    monthly_trend = [
        {"month": m, "amount": str(amt.quantize(Decimal("0.01")))}
        for m, amt in sorted(month_series.items())
    ]

    return Response(
        {
            "base_currency": settings.BASE_CURRENCY,
            "total_expenses_count": all_expenses.count(),
            "total_spent_base": str(total_spent_base.quantize(Decimal("0.01"))),
            "categories": category_list_resp,
            "monthly_trends": monthly_trend,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def export_expenses_csv(request):
    """
    Export the user's expenses as a downloadable CSV file.
    """
    expenses = (
        Expense.objects.filter(user=request.user)
        .select_related("category")
        .order_by("-date")
    )

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="expenses.csv"'

    writer = csv.writer(response)
    writer.writerow(["ID", "Title", "Amount", "Currency", "Category", "Date", "Notes"])

    for expense in expenses:
        writer.writerow(
            [
                expense.id,
                expense.title,
                str(expense.amount),
                expense.currency,
                expense.category.name,
                expense.date.isoformat(),
                expense.notes,
            ]
        )

    return response


@api_view(["GET"])
@permission_classes([AllowAny])
def currency_rates(request):
    """
    Return exchange rates relative to USD Base Currency for the frontend tickers & calculators.
    """
    from .services.currency import FALLBACK_USD_RATES, get_exchange_rate

    rates = {}
    for curr in ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "INR", "NPR", "CHF", "CNY"]:
        try:
            rates[curr] = float(get_exchange_rate("USD", curr))
        except Exception:
            rates[curr] = float(FALLBACK_USD_RATES.get(curr, Decimal("1.0")))

    return Response(
        {
            "base": settings.BASE_CURRENCY,
            "rates": rates,
            "provider": "open.er-api.com (cached)",
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def test_alert_dispatch(request):
    """
    Simulate a budget breach webhook dispatch to Discord & Telegram bots.
    """
    category_name = request.data.get("category", "Dining & Groceries")
    spent = request.data.get("spent", "740.00")
    limit = request.data.get("limit", "800.00")

    return Response(
        {
            "event": "BUDGET_THRESHOLD_BREACH",
            "category": category_name,
            "spent": float(spent),
            "limit": float(limit),
            "utilization": "88.0%",
            "severity": "WARNING",
            "dispatched_to": ["telegram:@SpendWiseAlertsBot", "discord:#finance-telemetry"],
            "status": "SENT",
            "timestamp": timezone.now().isoformat(),
        }
    )