from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase
from rest_framework import status

from .models import Category

class AuthenticationTests(APITestCase):

    def test_categories_require_authentication(self):
        response = self.client.get("/api/categories/")

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED
        )

class OwnershipTests(APITestCase):

    def setUp(self):
        self.user1 = User.objects.create_user(
            username="user1",
            password="pass123"
        )

        self.user2 = User.objects.create_user(
            username="user2",
            password="pass123"
        )

        self.token = Token.objects.create(
            user=self.user1
        )

        self.client.credentials(
            HTTP_AUTHORIZATION=f"Token {self.token.key}"
        )

    def test_user_only_sees_own_categories(self):

        Category.objects.create(
            user=self.user1,
            name="Food"
        )

        Category.objects.create(
            user=self.user2,
            name="Travel"
        )

        response = self.client.get(
            "/api/categories/"
        )

        self.assertEqual(
            len(response.data),
            1
        )

        self.assertEqual(
            response.data[0]["name"],
            "Food"
        )

    def test_created_category_belongs_to_user(self):

        response = self.client.post(
            "/api/categories/",
            {
                "name": "Bills",
                "description": ""
            }
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED
        )

        category = Category.objects.get(
            name="Bills"
        )

        self.assertEqual(
            category.user,
            self.user1
        )