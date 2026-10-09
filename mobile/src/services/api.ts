import { Category, Expense, AnalyticsData, User } from '../types';

let currentToken: string | null = null;
let API_BASE_URL = 'http://127.0.0.1:8001';

// Offline cache storage
const cache = {
  categories: [] as Category[],
  expenses: [] as Expense[],
  analytics: null as AnalyticsData | null,
};

export const setApiBaseUrl = (url: string) => {
  API_BASE_URL = url;
};

export const setAuthToken = (token: string | null) => {
  currentToken = token;
};

export const getAuthToken = () => currentToken;

const request = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (currentToken) {
    headers['Authorization'] = `Token ${currentToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return {} as T;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      errorData.detail ||
      errorData.error ||
      errorData.message ||
      Object.entries(errorData)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join(' | ') ||
      `Request failed (${response.status})`;
    throw new Error(message);
  }

  return response.json();
};

export const mobileApi = {
  async register(username: string, password: string, email?: string): Promise<{ token: string; user: User }> {
    const res = await request<{ token: string; user: User }>('/api/auth/register/', {
      method: 'POST',
      body: JSON.stringify({ username, password, email }),
    });
    setAuthToken(res.token);
    return res;
  },

  async login(username: string, password: string): Promise<{ token: string; user: User }> {
    const res = await request<{ token: string; user: User }>('/api/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setAuthToken(res.token);
    return res;
  },

  async getCurrentUser(): Promise<User> {
    return request<User>('/api/auth/me/');
  },

  async getCategories(): Promise<Category[]> {
    try {
      const data = await request<Category[]>('/api/categories/');
      cache.categories = data;
      return data;
    } catch (err) {
      if (cache.categories.length > 0) return cache.categories;
      throw err;
    }
  },

  async createCategory(data: { name: string; description?: string; monthly_limit?: string | null }): Promise<Category> {
    return request<Category>('/api/categories/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteCategory(id: number): Promise<void> {
    return request<void>(`/api/categories/${id}/`, {
      method: 'DELETE',
    });
  },

  async getExpenses(params?: { search?: string; category?: number | string; start_date?: string; end_date?: string }): Promise<Expense[]> {
    try {
      const qs = new URLSearchParams();
      if (params?.search) qs.append('search', params.search);
      if (params?.category) qs.append('category', String(params.category));
      if (params?.start_date) qs.append('start_date', params.start_date);
      if (params?.end_date) qs.append('end_date', params.end_date);

      const queryString = qs.toString();
      const data = await request<Expense[]>(`/api/expenses/${queryString ? `?${queryString}` : ''}`);
      cache.expenses = data;
      return data;
    } catch (err) {
      if (cache.expenses.length > 0) return cache.expenses;
      throw err;
    }
  },

  async createExpense(data: {
    title: string;
    amount: string | number;
    currency: string;
    category: number;
    date: string;
    notes?: string;
  }): Promise<Expense> {
    return request<Expense>('/api/expenses/', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        amount: String(data.amount),
        currency: data.currency.toUpperCase(),
      }),
    });
  },

  async deleteExpense(id: number): Promise<void> {
    return request<void>(`/api/expenses/${id}/`, {
      method: 'DELETE',
    });
  },

  async getAnalytics(): Promise<AnalyticsData> {
    try {
      const data = await request<AnalyticsData>('/api/expenses/analytics/');
      cache.analytics = data;
      return data;
    } catch (err) {
      if (cache.analytics) return cache.analytics;
      throw err;
    }
  },
};
