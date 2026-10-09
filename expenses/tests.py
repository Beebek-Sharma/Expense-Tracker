from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import Category, Expense


class AuthenticationTests(APITestCase):
    def test_categories_require_authentication(self):
        response = self.client.get("/api/categories/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_expenses_require_authentication(self):
        response = self.client.get("/api/expenses/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_registration(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "newuser",
                "email": "new@example.com",
                "password": "strongpassword123",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"]["username"], "newuser")

    def test_user_login(self):
        User.objects.create_user(username="testlogin", password="mypassword")
        response = self.client.post(
            "/api/auth/login/",
            {
                "username": "testlogin",
                "password": "mypassword",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)


class OwnershipAndCRUDTests(APITestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(username="user1", password="pass123")
        self.user2 = User.objects.create_user(username="user2", password="pass123")
        self.token = Token.objects.create(user=self.user1)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        self.category1 = Category.objects.create(
            user=self.user1, name="Food", monthly_limit=Decimal("200.00")
        )
        self.category2 = Category.objects.create(
            user=self.user2, name="Travel", monthly_limit=Decimal("500.00")
        )

    def test_user_only_sees_own_categories(self):
        response = self.client.get("/api/categories/")
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Food")

    def test_created_category_belongs_to_user(self):
        response = self.client.post(
            "/api/categories/",
            {"name": "Bills", "description": "Utilities", "monthly_limit": "150.00"},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        cat = Category.objects.get(name="Bills")
        self.assertEqual(cat.user, self.user1)

    def test_user_cannot_create_duplicate_category(self):
        response = self.client.post(
            "/api/categories/",
            {"name": "Food"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_and_list_expense(self):
        response = self.client.post(
            "/api/expenses/",
            {
                "title": "Groceries",
                "amount": "50.00",
                "currency": "USD",
                "category": self.category1.id,
                "date": "2026-06-01",
                "notes": "Weekly groceries",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Groceries")
        self.assertEqual(response.data["category_name"], "Food")

        list_resp = self.client.get("/api/expenses/")
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_resp.data), 1)

    def test_expense_validation_prevents_negative_amount(self):
        response = self.client.post(
            "/api/expenses/",
            {
                "title": "Negative",
                "amount": "-20.00",
                "currency": "USD",
                "category": self.category1.id,
                "date": "2026-06-01",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_assign_another_users_category(self):
        response = self.client.post(
            "/api/expenses/",
            {
                "title": "Hack",
                "amount": "20.00",
                "currency": "USD",
                "category": self.category2.id,  # belongs to user2
                "date": "2026-06-01",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_search_and_filtering(self):
        Expense.objects.create(
            user=self.user1,
            title="Burger King",
            amount=Decimal("15.00"),
            currency="USD",
            category=self.category1,
            date="2026-06-02",
        )
        Expense.objects.create(
            user=self.user1,
            title="Coffee Shop",
            amount=Decimal("5.00"),
            currency="USD",
            category=self.category1,
            date="2026-06-05",
        )

        search_resp = self.client.get("/api/expenses/?search=burger")
        self.assertEqual(len(search_resp.data), 1)
        self.assertEqual(search_resp.data[0]["title"], "Burger King")

        date_resp = self.client.get(
            "/api/expenses/?start_date=2026-06-05&end_date=2026-06-06"
        )
        self.assertEqual(len(date_resp.data), 1)
        self.assertEqual(date_resp.data[0]["title"], "Coffee Shop")


class CurrencyAndBudgetAlertTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="fin_user", password="secure")
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.token.key}")

        self.category = Category.objects.create(
            user=self.user, name="Dining", monthly_limit=Decimal("100.00")
        )

    @patch("expenses.views.check_budget_limit")
    def test_budget_alert_called_on_expense_create(self, mock_check_limit):
        response = self.client.post(
            "/api/expenses/",
            {
                "title": "Fine Dining",
                "amount": "120.00",
                "currency": "USD",
                "category": self.category.id,
                "date": timezone.now().date().isoformat(),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(mock_check_limit.called)

    def test_expense_summary_and_monthly_summary(self):
        today = timezone.now().date()
        Expense.objects.create(
            user=self.user,
            title="Lunch",
            amount=Decimal("25.00"),
            currency="USD",
            category=self.category,
            date=today,
        )
        Expense.objects.create(
            user=self.user,
            title="Dinner",
            amount=Decimal("35.00"),
            currency="USD",
            category=self.category,
            date=today,
        )

        # Summary per category
        summary_resp = self.client.get("/api/expenses/summary/")
        self.assertEqual(summary_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(summary_resp.data["base_currency"], "USD")
        self.assertEqual(summary_resp.data["categories"][0]["category"], "Dining")
        self.assertEqual(summary_resp.data["categories"][0]["total"], "60.00")

        # Monthly summary
        month_resp = self.client.get("/api/expenses/monthly-summary/")
        self.assertEqual(month_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(month_resp.data["total"], "60.00")

    def test_analytics_and_csv_export(self):
        today = timezone.now().date()
        Expense.objects.create(
            user=self.user,
            title="Breakfast",
            amount=Decimal("10.00"),
            currency="USD",
            category=self.category,
            date=today,
        )

        analytics_resp = self.client.get("/api/expenses/analytics/")
        self.assertEqual(analytics_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(analytics_resp.data["total_expenses_count"], 1)

        csv_resp = self.client.get("/api/expenses/export/")
        self.assertEqual(csv_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(csv_resp["Content-Type"], "text/csv")
        self.assertIn("Breakfast", csv_resp.content.decode("utf-8"))