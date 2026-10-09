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

export interface CategorySummary {
  category: string;
  total: string;
}

export interface ExpenseSummaryResponse {
  base_currency: string;
  categories: CategorySummary[];
}

export interface MonthlySummaryResponse {
  month: string;
  base_currency: string;
  total: string;
  expense_count: number;
}

export interface AnalyticsResponse {
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

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001';

export function formatErrorMessage(errorData: any, status: number): string {
  if (!errorData) return `Request failed (HTTP ${status})`;
  if (typeof errorData === 'string') return errorData;

  // Handle { error: "..." } or { error: { message: "...", ... } }
  if (errorData.error) {
    if (typeof errorData.error === 'string') return errorData.error;
    if (typeof errorData.error === 'object') {
      if (typeof errorData.error.message === 'string') return errorData.error.message;
      if (typeof errorData.error.detail === 'string') return errorData.error.detail;
      return JSON.stringify(errorData.error);
    }
  }

  // Handle standard DRF { detail: "..." }
  if (typeof errorData.detail === 'string') return errorData.detail;
  if (typeof errorData.message === 'string') return errorData.message;

  // Handle DRF validation errors dict: { username: ["This field is required."], ... }
  if (typeof errorData === 'object' && errorData !== null) {
    const entries = Object.entries(errorData);
    if (entries.length > 0) {
      return entries
        .map(([key, val]) => {
          if (Array.isArray(val)) {
            const items = val.map((item) =>
              typeof item === 'object' && item !== null
                ? (item as any).message || JSON.stringify(item)
                : String(item)
            );
            return `${key}: ${items.join(', ')}`;
          }
          if (typeof val === 'object' && val !== null) {
            return `${key}: ${(val as any).message || (val as any).detail || JSON.stringify(val)}`;
          }
          return `${key}: ${String(val)}`;
        })
        .join(' | ');
    }
  }

  return `Request failed with status ${status}`;
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('spendwise_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('spendwise_token', token);
    } else {
      localStorage.removeItem('spendwise_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Token ${this.token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (networkErr: any) {
      throw new Error(
        `Unable to connect to backend server at ${API_BASE_URL}. Please ensure the server is running.`
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = formatErrorMessage(errorData, response.status);
      throw new Error(message);
    }

    return response.json();
  }

  // --- Auth Endpoints ---
  async register(username: string, email: string, password: string) {
    const res = await this.request<{ token: string; user: User }>('/api/auth/register/', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
    this.setToken(res.token);
    return res;
  }

  async login(username: string, password: string) {
    const res = await this.request<{ token: string; user: User }>('/api/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(res.token);
    return res;
  }

  logout() {
    this.setToken(null);
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/api/auth/me/');
  }

  // --- Categories Endpoints ---
  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>('/api/categories/');
  }

  async createCategory(data: { name: string; description?: string; monthly_limit?: string | null }): Promise<Category> {
    return this.request<Category>('/api/categories/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: number, data: Partial<Category>): Promise<Category> {
    return this.request<Category>(`/api/categories/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: number): Promise<void> {
    return this.request<void>(`/api/categories/${id}/`, {
      method: 'DELETE',
    });
  }

  // --- Expenses Endpoints ---
  async getExpenses(params?: { search?: string; category?: number | string; start_date?: string; end_date?: string }): Promise<Expense[]> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.category) query.append('category', String(params.category));
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);

    const qs = query.toString();
    return this.request<Expense[]>(`/api/expenses/${qs ? `?${qs}` : ''}`);
  }

  async createExpense(data: {
    title: string;
    amount: string | number;
    currency: string;
    category: number;
    date: string;
    notes?: string;
  }): Promise<Expense> {
    return this.request<Expense>('/api/expenses/', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        amount: String(data.amount),
        currency: data.currency.toUpperCase(),
      }),
    });
  }

  async updateExpense(id: number, data: Partial<Expense>): Promise<Expense> {
    return this.request<Expense>(`/api/expenses/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteExpense(id: number): Promise<void> {
    return this.request<void>(`/api/expenses/${id}/`, {
      method: 'DELETE',
    });
  }

  // --- Analytics & Summaries ---
  async getSummary(): Promise<ExpenseSummaryResponse> {
    return this.request<ExpenseSummaryResponse>('/api/expenses/summary/');
  }

  async getMonthlySummary(month?: string): Promise<MonthlySummaryResponse> {
    const qs = month ? `?month=${month}` : '';
    return this.request<MonthlySummaryResponse>(`/api/expenses/monthly-summary/${qs}`);
  }

  async getAnalytics(): Promise<AnalyticsResponse> {
    return this.request<AnalyticsResponse>('/api/expenses/analytics/');
  }

  getExportCsvUrl(): string {
    return `${API_BASE_URL}/api/expenses/export/`;
  }

  async getRates(): Promise<{ base: string; rates: Record<string, number>; provider: string }> {
    return this.request<{ base: string; rates: Record<string, number>; provider: string }>('/api/expenses/rates/');
  }

  async sendTestAlert(data?: { category?: string; spent?: string | number; limit?: string | number }): Promise<{
    event: string;
    category: string;
    spent: number;
    limit: number;
    utilization: string;
    severity: string;
    dispatched_to: string[];
    status: string;
    timestamp: string;
  }> {
    return this.request('/api/expenses/test-alert/', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }
}

export const api = new ApiService();
