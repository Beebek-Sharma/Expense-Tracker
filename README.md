# SpendWise — Full-Stack Expense & Budget Tracking System

An enterprise-grade, multi-currency personal finance and expense tracking ecosystem built with **Django REST Framework**, **React + Vite + TypeScript (Vanilla CSS Design System)**, and **React Native / Expo (Native Mobile UI)**.

---

## 🌟 Architecture Overview

The system is organized into three production-ready layers:

```
Expense tracker system/
├── backend/                              # Django 5 + Django REST Framework API
│   ├── config/                           # Django project settings & root URLs
│   ├── expenses/                         # Expenses application
│   │   ├── migrations/                   # Database migrations (currencies, budget limits)
│   │   ├── services/                     # Business logic (currency conversion, bot alerts)
│   │   ├── admin.py                      # Enhanced Django administration
│   │   ├── models.py                     # Category & Expense models with user ownership
│   │   ├── serializers.py                # Serializers with full validation
│   │   ├── urls.py                       # RESTful route definitions
│   │   ├── views.py                      # Production views & analytics
│   │   └── tests.py                      # Comprehensive test suite (14/14 passing)
│   ├── postman_collection.json           # Complete API collection with all endpoints
│   └── pyproject.toml / uv.lock          # Dependency management via uv
│
├── frontend/                             # Premium Web Application
│   ├── src/
│   │   ├── components/                   # Interactive charts, modals, simulator
│   │   │   ├── CategoryPieChart.tsx      # SVG Donut Chart with hover slices & legend
│   │   │   ├── MonthlyTrendBarChart.tsx  # SVG 6-Month Spending Trajectory Chart
│   │   │   ├── AddExpenseModal.tsx       # Multi-currency expense modal with live rate preview
│   │   │   ├── AddCategoryModal.tsx      # Budget limit modal with threshold warnings
│   │   │   └── AuthModal.tsx             # Auth modal with 1-click instant demo login
│   │   ├── services/api.ts               # Typed REST API client with token persistence
│   │   ├── index.css                     # Vanilla CSS Design System (Sleek Dark Fintech)
│   │   ├── App.css                       # Layout, responsive grid, mobile simulator styles
│   │   └── App.tsx                       # Dashboard, Log, Budgets, Analytics, Alerts
│   └── package.json
│
└── mobile/                               # Native Mobile Application (Expo / React Native)
    ├── src/
    │   ├── services/api.ts               # Mobile API service with offline cache fallback
    │   ├── theme.ts                      # iOS & Android design tokens (touch target >= 44pt)
    │   └── types.ts                      # Mobile TypeScript data contracts
    ├── App.tsx                           # Native Tab Navigation, budget alerts, offline sync
    └── package.json
```

---

## 🐞 Bugs Found and Fixed (All 5 Resolved)

| # | Bug Name | File / Location | Root Cause | Resolution |
|---|---|---|---|---|
| **1** | **Serializer Field Typo** | `expenses/serializers.py` | `"catgory"` field typo broke serializer validation. | Renamed field to `"category"`. |
| **2** | **Expense Creation Response Typo** | `expenses/views.py` | View returned `serialzer.data` (spelling typo) raising `NameError`. | Corrected to `serializer.data`. |
| **3** | **Date Filter Off-By-One** | `expenses/views.py` | `date__gt=start_date` excluded transactions on the start date itself. | Changed to `date__gte=start_date` for inclusive filtering. |
| **4** | **Missing Aggregate Import** | `expenses/views.py` | View called `Sum("amount")` without importing `Sum` from `django.db.models`. | Added `from django.db.models import Sum`. |
| **5** | **URL Routing Order Conflict** | `expenses/urls.py` | Parameterized path `expenses/<pk>/` was evaluated before `expenses/summary/`, shadowing the summary endpoint. | Reordered summary route before `expenses/<int:pk>/` and typed primary key as integer `<int:pk>`. |

---

## 🚀 Features Implemented

### Required Feature 1: Authentication & User Ownership
- Scoped all categories and expenses strictly to the authenticated user.
- Added Token Authentication and Session Authentication.
- Added `/api/auth/register/`, `/api/auth/login/`, and `/api/auth/me/` for seamless frontend/mobile onboarding.
- Prevented users from accessing or assigning other users' categories.

### Required Feature 2: Currency Conversion
- Multi-currency support added to expenses (`currency` field, default `USD`).
- Real-time exchange rate service supporting free API endpoints (`open.er-api.com`) and key-based providers (`exchangerate-api.com`).
- Integrated in-memory caching (`_RATE_CACHE`) to avoid duplicate HTTP requests.
- Graceful offline fallback exchange rates for resilience without throwing 500 errors.
- Expense summary (`/api/expenses/summary/`) and monthly summary (`/api/expenses/monthly-summary/`) automatically normalize amounts to `BASE_CURRENCY`.

### Required Feature 3: Budget Threshold Bot Alerts
- Added `monthly_limit` to `Category`.
- When an expense pushes that category's month-to-date total spending past its configured threshold, an alert is triggered.
- Multi-channel delivery supported:
  - **Discord Webhook** (`DISCORD_WEBHOOK_URL`)
  - **Telegram Bot** (`BOT_TOKEN`, `BOT_CHAT_ID`)
- Safe execution in `notifications.py` so network interruptions never crash expense creation.

### Optional Features Implemented
1. **Expense Keyword Search & Category Filtering**: `GET /api/expenses/?search=groceries&category=1&start_date=2026-06-01&end_date=2026-06-30`
2. **Monthly Spending Summary**: `GET /api/expenses/monthly-summary/?month=2026-06`
3. **Analytics Dashboard API**: `GET /api/expenses/analytics/` providing 6-month trends and budget utilization percentages.
4. **CSV Export**: `GET /api/expenses/export/` exports user transactions as a standard CSV spreadsheet.

---

## 💻 Frontend Application (Web)

- **Tech Stack**: React 19 + TypeScript + Vite + Vanilla CSS.
- **Design System**: Sleek Dark Fintech aesthetic with glowing borders, glassmorphic cards, custom typography (`Outfit` and `Plus Jakarta Sans`).
- **Interactive SVG Charts**:
  - Interactive Donut Chart with percentage calculation and hover tooltips.
  - 6-Month Spending Trend Bar Chart with animated bars and tooltips.
- **Budget Health Center**: Live progress bars (Normal, Near Limit, Over Budget) with automatic threshold breach alerts.
- **Interactive Mobile Simulator**: Built-in phone simulator tab previewing the mobile touch interface.
- **Instant Demo Access**: 1-click guest login pre-populating sample data.

---

## 📱 Mobile Application (Native Expo / React Native)

- **Tech Stack**: React Native + Expo + TypeScript.
- **Platform Conventions**: Touch targets >= 44pt, safe areas, status bars, and haptic-ready interactions.
- **Bottom Navigation**: Tabs for Overview, Expenses, Budgets, and Analytics.
- **Offline Resilience**: In-memory and cache fallback so the app functions even when network connectivity drops.
- **Quick-Add Modal**: Native bottom modal for recording multi-currency expenses.

---

## 🛠️ How to Run the Entire System

### 1. Run the Backend (Django)
```bash
cd backend
uv sync                                 # Install python dependencies
uv run python manage.py migrate         # Apply SQLite migrations
uv run python manage.py test            # Run all 14 tests (100% pass)
uv run python manage.py runserver 127.0.0.1:8001       # Starts at http://127.0.0.1:8001/
```

### 2. Run the Web Frontend
```bash
cd frontend
npm install
npm run dev                             # Starts at http://127.0.0.1:5173/ (or 5174)
```

### 3. Run the Mobile App
```bash
cd mobile
npm install
npm run start                           # Starts Expo developer menu (scan QR or run on emulator/web)
```

---

## 📬 Postman API Collection

Import `backend/postman_collection.json` into Postman. It includes pre-configured requests with `{{base_url}}` and `{{auth_token}}` variables for:
- User Registration & Login
- Category CRUD & Limits
- Expense CRUD & Filter queries
- Summary & Monthly Summary
- Analytics & CSV Export
