from django.urls import path
from . import views

urlpatterns = [
    # Auth endpoints
    path("auth/register/", views.register_user, name="auth-register"),
    path("auth/login/", views.login_user, name="auth-login"),
    path("auth/me/", views.current_user, name="auth-me"),

    # Category endpoints
    path("categories/", views.category_list, name="category-list"),
    path("categories/<int:pk>/", views.category_detail, name="category-detail"),

    # Expense report & analytics endpoints (must precede <int:pk>)
    path("expenses/summary/", views.expense_summary, name="expense-summary"),
    path("expenses/monthly-summary/", views.monthly_summary, name="monthly-summary"),
    path("expenses/analytics/", views.analytics_dashboard, name="analytics-dashboard"),
    path("expenses/export/", views.export_expenses_csv, name="export-expenses-csv"),
    path("expenses/rates/", views.currency_rates, name="currency-rates"),
    path("expenses/test-alert/", views.test_alert_dispatch, name="test-alert"),

    # Expense CRUD endpoints
    path("expenses/", views.expense_list, name="expense-list"),
    path("expenses/<int:pk>/", views.expense_detail, name="expense-detail"),
]
