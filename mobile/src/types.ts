export interface User {
  id: number;
  username: string;
  email: string;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  monthly_limit: string | null;
  expense_count?: number;
}

export interface Expense {
  id: number;
  title: string;
  amount: string;
  currency: string;
  category: number;
  category_name?: string;
  date: string;
  notes: string;
}

export interface AnalyticsData {
  base_currency: string;
  total_expenses_count: number;
  total_spent_base: string;
  categories: {
    id: number;
    name: string;
    monthly_limit: string | null;
    total_spent: string;
    current_month_spent: string;
    budget_percentage: number | null;
    is_over_budget: boolean;
  }[];
  monthly_trends: {
    month: string;
    amount: string;
  }[];
}
