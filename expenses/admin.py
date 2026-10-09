from django.contrib import admin
from .models import Category, Expense


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "monthly_limit", "user")
    list_filter = ("user",)
    search_fields = ("name", "description", "user__username")


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "amount",
        "currency",
        "category",
        "date",
        "user",
    )
    list_filter = ("currency", "date", "category", "user")
    search_fields = ("title", "notes", "user__username", "category__name")
    date_hierarchy = "date"