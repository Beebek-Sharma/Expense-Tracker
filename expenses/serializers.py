from decimal import Decimal
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Category, Expense


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ["id", "username", "email", "password"]

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )
        return user


class CategorySerializer(serializers.ModelSerializer):
    expense_count = serializers.IntegerField(source="expenses.count", read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name", "description", "monthly_limit", "expense_count"]

    def validate_monthly_limit(self, value):
        if value is not None and value < Decimal("0.00"):
            raise serializers.ValidationError("Monthly limit cannot be negative.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        name = attrs.get("name")
        if request and hasattr(request, "user") and name:
            qs = Category.objects.filter(user=request.user, name__iexact=name)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"name": "A category with this name already exists for your account."}
                )
        return attrs


class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source="category.name")

    class Meta:
        model = Expense
        fields = [
            "id",
            "title",
            "amount",
            "currency",
            "category",
            "category_name",
            "date",
            "notes",
        ]

    def validate_amount(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value

    def validate_currency(self, value):
        if not value or len(value) != 3:
            raise serializers.ValidationError("Currency must be a 3-letter ISO code.")
        return value.upper()

    def validate_category(self, value):
        # Validate that category belongs to the current user
        request = self.context.get("request")
        if request and hasattr(request, "user") and value.user != request.user:
            raise serializers.ValidationError("Category does not belong to you.")
        return value
