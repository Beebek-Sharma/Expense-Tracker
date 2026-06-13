from rest_framework import status
from rest_framework.decorators import api_view,permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from .models import Category, Expense
from .serializers import CategorySerializer, ExpenseSerializer
from collections import defaultdict
from decimal import Decimal
from django.conf import settings

from .services.currency import convert_amount
from .services.budget import check_budget_limit


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def category_list(request):
    if request.method == "GET":
        categories = Category.objects.filter(user=request.user)
        serializer = CategorySerializer(categories, many=True)
        return Response(serializer.data)

    serializer = CategorySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(user=request.user)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def expense_list(request):
    if request.method == "GET":
        expenses = Expense.objects.filter(user=request.user)

        search = request.query_params.get("search")
        category = request.query_params.get("category")

        if search:
            expenses = expenses.filter(
                title__icontains=search
            )

        if category:
            expenses = expenses.filter(
                category_id=category
            )

        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")

        if start_date:
            expenses = expenses.filter(date__gte=start_date)
        if end_date:
            expenses = expenses.filter(date__lte=end_date)

        serializer = ExpenseSerializer(expenses, many=True)
        return Response(serializer.data)

    serializer = ExpenseSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    expense = serializer.save(
        user=request.user
    )
   

    check_budget_limit(
        expense.category
    )
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def expense_detail(request, pk):
    expense = get_object_or_404(
            Expense,
            pk=pk,
            user=request.user,
            )

    if request.method == "GET":
        serializer = ExpenseSerializer(expense)
        return Response(serializer.data)

    if request.method == "PUT":
        serializer = ExpenseSerializer(expense, data=request.data)
        serializer.is_valid(raise_exception=True)
        expense = serializer.save(
            user=request.user
        )

        check_budget_limit(
            expense.category
        )
        return Response(serializer.data)

    expense.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def expense_summary(request):
    expenses = Expense.objects.filter(
        user=request.user
    )

    category_totals = defaultdict(
        lambda: Decimal("0.00")
    )

    for expense in expenses:
        converted_amount, _ = convert_amount(
            expense.amount,
            expense.currency,
            settings.BASE_CURRENCY,
        )

        category_totals[
            expense.category.name
        ] += converted_amount

    categories = []

    for category, total in category_totals.items():
        categories.append(
            {
                "category": category,
                "total": str(
                    total.quantize(
                        Decimal("0.01")
                    )
                ),
            }
        )

    categories.sort(
        key=lambda item: item["category"]
    )

    return Response(
        {
            "base_currency":
                settings.BASE_CURRENCY,
            "categories": categories,
        }
    )