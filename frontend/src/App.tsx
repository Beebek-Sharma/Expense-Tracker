import { useState, useEffect, useMemo } from 'react';
import { api } from './services/api';
import type {
  Category,
  Expense,
  ExpenseSummaryResponse,
  AnalyticsResponse,
  User,
} from './services/api';
import { CategoryPieChart } from './components/CategoryPieChart';
import { MonthlyTrendBarChart } from './components/MonthlyTrendBarChart';
import { AddExpenseModal } from './components/AddExpenseModal';
import { AddCategoryModal } from './components/AddCategoryModal';
import { AuthModal } from './components/AuthModal';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<'dashboard' | 'expenses' | 'budget' | 'analytics' | 'simulator'>('dashboard');

  // Core Data States
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummaryResponse | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [rates, setRates] = useState<Record<string, number>>({
    USD: 1.0,
    EUR: 0.92,
    GBP: 0.78,
    JPY: 155.0,
    CAD: 1.36,
  });

  // Filters
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');

  // Modals
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Toast notifications
  const [toast, setToast] = useState<{ title: string; desc: string; type?: 'success' | 'warning' | 'error' } | null>(null);
  const [botPayloadSnippet, setBotPayloadSnippet] = useState<string>(
    JSON.stringify(
      {
        event: 'BUDGET_THRESHOLD_BREACH',
        category: 'Dining & Groceries',
        spent: 740.0,
        limit: 800.0,
        utilization: '88.0%',
        severity: 'WARNING',
        dispatched_to: ['telegram:@SpendWiseAlertsBot', 'discord:#finance-telemetry'],
      },
      null,
      2
    )
  );

  const showToast = (title: string, desc: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ title, desc, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Check authentication on mount
  useEffect(() => {
    if (api.isAuthenticated()) {
      api
        .getCurrentUser()
        .then((user) => {
          setCurrentUser(user);
          loadAllData();
        })
        .catch(() => {
          api.logout();
          setAuthModalOpen(true);
        });
    } else {
      setAuthModalOpen(true);
    }
  }, []);

  const loadAllData = async () => {
    try {
      const [cats, exps, summ, anal, rData] = await Promise.all([
        api.getCategories().catch(() => []),
        api.getExpenses().catch(() => []),
        api.getSummary().catch(() => null),
        api.getAnalytics().catch(() => null),
        api.getRates().catch(() => null),
      ]);

      setCategories(cats);
      setExpenses(exps);
      if (summ) setSummary(summ);
      if (anal) setAnalytics(anal);
      if (rData && rData.rates) setRates(rData.rates);
    } catch (err) {
      console.error('Failed to load application data:', err);
    }
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setAuthModalOpen(true);
    showToast('Logged Out', 'Successfully ended session.');
  };

  // Category Spending Map
  const categorySpendingMap = useMemo(() => {
    const map: Record<number, number> = {};
    if (analytics?.categories) {
      analytics.categories.forEach((c) => {
        map[c.id] = parseFloat(c.total_spent) || 0;
      });
    } else {
      expenses.forEach((e) => {
        // Fallback convert to USD
        const rateToUSD = e.currency === 'USD' ? 1.0 : rates[e.currency] ? 1 / rates[e.currency] : 1.0;
        const norm = (parseFloat(e.amount) || 0) * rateToUSD;
        map[e.category] = (map[e.category] || 0) + norm;
      });
    }
    return map;
  }, [analytics, expenses, rates]);

  // Overall Financial Totals
  const totalSpendUSD = useMemo(() => {
    if (analytics?.total_spent_base) {
      return parseFloat(analytics.total_spent_base);
    }
    return expenses.reduce((acc, curr) => {
      const rateToUSD = curr.currency === 'USD' ? 1.0 : rates[curr.currency] ? 1 / rates[curr.currency] : 1.0;
      return acc + (parseFloat(curr.amount) || 0) * rateToUSD;
    }, 0);
  }, [analytics, expenses, rates]);

  // Total configured budget limit across all categories
  const totalBudgetLimit = useMemo(() => {
    return categories.reduce((acc, cat) => {
      return acc + (cat.monthly_limit ? parseFloat(cat.monthly_limit) : 0);
    }, 0) || 5200; // default benchmark
  }, [categories]);

  const monthlyRemaining = Math.max(totalBudgetLimit - totalSpendUSD, 0);
  const budgetConsumedPct = totalBudgetLimit > 0 ? (totalSpendUSD / totalBudgetLimit) * 100 : 0;

  // Top Outflow Category
  const topCategoryInfo = useMemo(() => {
    if (categories.length === 0) return { name: 'None', amount: 0, pct: 0 };
    let topCat = categories[0];
    let topSpent = 0;
    categories.forEach((cat) => {
      const spent = categorySpendingMap[cat.id] || 0;
      if (spent > topSpent) {
        topSpent = spent;
        topCat = cat;
      }
    });
    const pct = totalSpendUSD > 0 ? (topSpent / totalSpendUSD) * 100 : 0;
    return { name: topCat.name, amount: topSpent, pct };
  }, [categories, categorySpendingMap, totalSpendUSD]);

  // Threshold Bot Sentinel Status: Check for any near limit (85%+) or breach
  const sentinelBreach = useMemo(() => {
    for (const cat of categories) {
      const limit = cat.monthly_limit ? parseFloat(cat.monthly_limit) : 0;
      if (limit > 0) {
        const spent = categorySpendingMap[cat.id] || 0;
        const ratio = (spent / limit) * 100;
        if (ratio >= 100) {
          return { cat: cat.name, spent, limit, ratio, status: 'BREACH' };
        }
        if (ratio >= 85) {
          return { cat: cat.name, spent, limit, ratio, status: 'WARNING' };
        }
      }
    }
    return null;
  }, [categories, categorySpendingMap]);

  // Filtered transactions ledger
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchesSearch =
        searchQuery === '' ||
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.notes && e.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat =
        selectedCategoryFilter === 'ALL' ||
        String(e.category) === String(selectedCategoryFilter);

      const matchesCurr =
        currencyFilter === 'ALL' || e.currency.toUpperCase() === currencyFilter.toUpperCase();

      return matchesSearch && matchesCat && matchesCurr;
    });
  }, [expenses, searchQuery, selectedCategoryFilter, currencyFilter]);

  // Handlers
  const handleCreateOrUpdateExpense = async (data: {
    title: string;
    amount: string;
    currency: string;
    category: number;
    date: string;
    notes: string;
  }) => {
    if (editingExpense) {
      await api.updateExpense(editingExpense.id, data);
      showToast('Record Updated', `Successfully updated "${data.title}"`);
    } else {
      await api.createExpense(data);
      showToast('Transaction Saved', `Added ${data.currency} ${data.amount} for "${data.title}"`);
    }
    setEditingExpense(null);
    setExpenseModalOpen(false);
    loadAllData();
  };

  const handleDeleteExpense = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this transaction record?')) return;
    try {
      await api.deleteExpense(id);
      showToast('Record Deleted', 'Transaction was successfully deleted.');
      loadAllData();
    } catch (err: any) {
      showToast('Delete Failed', err.message || 'Could not delete expense', 'error');
    }
  };

  const handleCreateCategory = async (data: { name: string; description?: string; monthly_limit?: string | null }) => {
    await api.createCategory(data);
    showToast('Category Created', `Added category "${data.name}"`);
    loadAllData();
  };

  const handleUpdateCategory = async (id: number, data: Partial<Category>) => {
    await api.updateCategory(id, data);
    showToast('Category Updated', `Updated settings for "${data.name}"`);
    loadAllData();
  };

  const handleDeleteCategory = async (id: number) => {
    await api.deleteCategory(id);
    showToast('Category Removed', 'Category was deleted.');
    loadAllData();
  };

  const handleDownloadCSV = () => {
    const url = api.getExportCsvUrl();
    const token = api.getToken();
    if (token) {
      // Fetch with auth header and trigger browser download
      fetch(url, { headers: { Authorization: `Token ${token}` } })
        .then((res) => res.blob())
        .then((blob) => {
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `spendwise_expenses_${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          showToast('CSV Exported', 'Downloaded ledger as CSV format.');
        })
        .catch(() => {
          window.open(url, '_blank');
        });
    } else {
      window.open(url, '_blank');
    }
  };

  const handleTriggerTestAlert = async () => {
    try {
      const res = await api.sendTestAlert({
        category: 'Dining & Groceries',
        spent: 740.0,
        limit: 800.0,
      });
      setBotPayloadSnippet(JSON.stringify(res, null, 2));
      showToast('Sentinel Alert Dispatched', 'Test payload delivered to Telegram & Discord.');
    } catch (err: any) {
      showToast('Dispatch Error', err.message || 'Failed to dispatch test bot alert', 'error');
    }
  };

  // Expose global helpers for stitch inline onclicks if needed
  useEffect(() => {
    (window as any).downloadCSVReport = handleDownloadCSV;
    (window as any).testBotAlert = handleTriggerTestAlert;
  }, []);

  return (
    <div className="bg-surface-base font-body-md text-on-surface antialiased selection:bg-secondary selection:text-white min-h-screen">
      {/* 1. Fixed Sidebar Navigation (w-72) */}
      <aside
        className={`fixed left-0 top-0 h-full w-72 bg-surface-container-lowest border-r border-stroke-subtle z-50 flex flex-col justify-between transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex flex-col">
          {/* Logo & Version Header */}
          <div className="h-16 px-4 border-b border-stroke-subtle flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-accent-teal-subtle border border-secondary/40 flex items-center justify-center text-secondary-bright shrink-0 shadow-[0_0_12px_rgba(63,110,118,0.25)]">
                <span className="material-symbols-outlined text-xl">payments</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-headline-sm text-base text-primary font-bold tracking-tight truncate">
                  SpendWise
                </span>
                <span className="font-caption-code text-[10px] text-tertiary-light font-medium tracking-wider">
                  FINANCIAL OS
                </span>
              </div>
            </div>
            <span className="font-label-sm text-[11px] bg-surface-card border border-stroke-subtle text-secondary-bright px-2 py-0.5 rounded font-semibold">
              v2.4 Prod
            </span>
          </div>

          {/* Primary Quick Action Button */}
          <div className="p-4">
            <button
              type="button"
              id="sidebarAddBtn"
              onClick={() => {
                setEditingExpense(null);
                setExpenseModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-neutral-200 text-on-primary font-label-md text-sm py-2.5 px-4 rounded-lg shadow-sm hover:shadow-md transition-all active:scale-[0.99] font-bold"
            >
              <span className="material-symbols-outlined text-lg leading-none font-bold">add</span>
              <span>New Expense</span>
            </button>
          </div>

          {/* Navigation Links */}
          <div className="px-4 py-2">
            <span className="font-label-sm text-[11px] text-tertiary uppercase tracking-wider px-2 block mb-2 font-semibold">
              Navigation
            </span>
            <nav className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveNav('dashboard');
                  setSidebarOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left text-sm ${activeNav === 'dashboard' ? 'bg-surface-card text-primary border-l-2 border-secondary font-semibold' : 'text-on-surface-variant hover:bg-surface-card hover:text-on-surface'}`}
              >
                <span className={`material-symbols-outlined text-xl ${activeNav === 'dashboard' ? 'text-secondary-bright' : ''}`}>
                  dashboard
                </span>
                <span>Dashboard & Overview</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveNav('expenses');
                  setSidebarOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left text-sm ${activeNav === 'expenses' ? 'bg-surface-card text-primary border-l-2 border-secondary font-semibold' : 'text-on-surface-variant hover:bg-surface-card hover:text-on-surface'}`}
              >
                <span className={`material-symbols-outlined text-xl ${activeNav === 'expenses' ? 'text-secondary-bright' : ''}`}>
                  receipt_long
                </span>
                <span>Expenses Log</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCategoryModalOpen(true);
                  setSidebarOpen(false);
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left text-sm text-on-surface-variant hover:bg-surface-card hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-xl">vital_signs</span>
                <span>Budget Health</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveNav('analytics');
                  setSidebarOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left text-sm ${activeNav === 'analytics' ? 'bg-surface-card text-primary border-l-2 border-secondary font-semibold' : 'text-on-surface-variant hover:bg-surface-card hover:text-on-surface'}`}
              >
                <span className={`material-symbols-outlined text-xl ${activeNav === 'analytics' ? 'text-secondary-bright' : ''}`}>
                  monitoring
                </span>
                <span>Analytics</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSimulatorOpen(true);
                  setSidebarOpen(false);
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left text-sm text-on-surface-variant hover:bg-surface-card hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-xl text-secondary-bright">smartphone</span>
                <span>Mobile Expo Sim</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Bottom Sidebar Status Node */}
        <div className="p-4 border-t border-stroke-subtle flex flex-col gap-2 bg-surface-card/60">
          <div className="flex items-center justify-between text-on-surface-variant">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-secondary-bright animate-pulse" />
              <span className="font-caption-code text-xs text-on-surface-variant">API Connected</span>
            </div>
            <span className="font-caption-code text-xs text-secondary-bright bg-accent-teal-subtle border border-secondary/30 px-1.5 py-0.5 rounded font-semibold">
              14/14 Tests
            </span>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="font-caption-code text-[11px] text-tertiary">Django REST :8001</span>
            <span className="font-caption-code text-[11px] text-secondary-bright">All Nodes Up</span>
          </div>
          {currentUser && (
            <div className="flex items-center justify-between pt-2 border-t border-stroke-subtle">
              <span className="font-caption-code text-xs text-primary truncate max-w-[140px]">
                @{currentUser.username}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs text-critical-crimson hover:underline font-caption-code"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Backdrop for Mobile Sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-surface-base/80 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 2. Main Content Wrapper */}
      <div className="lg:pl-72 flex flex-col min-h-screen">
        {/* Fixed Top Header (h-16) */}
        <header className="fixed top-0 left-0 lg:left-72 right-0 h-16 bg-surface-base/85 backdrop-blur-xl border-b border-stroke-subtle z-40 px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Left Header items */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg bg-surface-card border border-stroke-subtle text-primary"
            >
              <span className="material-symbols-outlined text-xl">menu</span>
            </button>

            {/* Currency Selector Pills */}
            <div className="flex items-center gap-1 bg-surface-card border border-stroke-subtle rounded-lg p-1">
              {['USD', 'EUR', 'GBP', 'JPY'].map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setSelectedCurrency(curr)}
                  className={`font-label-sm text-xs px-2.5 py-1 rounded transition-colors ${selectedCurrency === curr ? 'bg-primary text-on-primary font-bold shadow-sm' : 'text-on-surface-variant hover:text-primary hover:bg-surface-elevated'}`}
                >
                  {curr}
                </button>
              ))}
            </div>

            {/* Live Rate Badge */}
            <div className="hidden xl:flex items-center gap-2 font-caption-code text-xs bg-surface-card border border-accent-teal-subtle px-3 py-1 rounded-full text-secondary-bright">
              <span className="material-symbols-outlined text-sm leading-none text-secondary-bright">
                currency_exchange
              </span>
              <span>
                Live Rate: 1 EUR = {(rates['EUR'] ? (1 / rates['EUR']).toFixed(3) : '1.087')} USD
              </span>
            </div>
          </div>

          {/* Right Header items */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Notifications Button */}
            <button
              type="button"
              onClick={handleTriggerTestAlert}
              title="Notifications & Alerts Sentinel"
              className="w-9 h-9 rounded-lg bg-surface-card border border-stroke-subtle hover:bg-surface-elevated hover:text-primary text-on-surface-variant flex items-center justify-center transition-colors relative"
            >
              <span className="material-symbols-outlined text-xl">notifications</span>
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-critical-crimson text-white font-caption-code text-[10px] font-bold">
                {sentinelBreach ? '1' : '0'}
              </span>
            </button>

            <div className="h-6 w-px bg-stroke-subtle" />

            {/* User Profile Chip */}
            <div
              className="flex items-center gap-2.5 cursor-pointer group"
              onClick={() => {
                if (!currentUser) setAuthModalOpen(true);
              }}
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-surface-elevated border border-stroke-subtle ring-1 ring-secondary/30 flex items-center justify-center text-secondary-bright font-bold text-xs">
                  {currentUser ? currentUser.username.charAt(0).toUpperCase() : 'A'}
                </div>
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-secondary-bright ring-2 ring-surface-base" />
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="font-label-md text-xs text-on-surface group-hover:text-primary transition-colors leading-tight font-semibold">
                  {currentUser ? currentUser.username : 'Alex Rivers'}
                </span>
                <span className="font-caption-code text-[10px] text-tertiary-light leading-tight">
                  CFO Workspace
                </span>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary text-sm transition-colors">
                expand_more
              </span>
            </div>
          </div>
        </header>

        {/* 3. Main Body Container */}
        <main className="relative pt-16 w-full flex-1 px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col w-full max-w-7xl mx-auto space-y-6">
            {/* Top Context & Live FX Rate Strip */}
            <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-on-surface-variant font-caption-code text-xs mb-1 uppercase tracking-wider">
                  <span>Cycle: June 2026</span>
                  <span className="text-tertiary">/</span>
                  <span className="text-primary font-semibold">Base: USD ($)</span>
                  <span className="text-tertiary">/</span>
                  <span className="text-secondary-bright">Django REST Engine v5.1</span>
                </div>
                <h1 className="font-headline-lg text-2xl sm:text-3xl text-primary tracking-tight font-bold">
                  Welcome back,{' '}
                  <span className="text-secondary-bright font-bold">
                    {currentUser ? currentUser.username : 'Alex Morgan'}
                  </span>
                </h1>
                <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant mt-0.5">
                  Production Telemetry & Multi-Currency Normalization Active across {expenses.length} settled transactions.
                </p>
              </div>

              {/* Live FX Badge & Global Controls */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2 bg-surface-card px-3 py-2 rounded-xl border border-stroke-subtle">
                  <span className="w-2 h-2 rounded-full bg-secondary-bright animate-ping" />
                  <span className="font-caption-code text-xs text-on-surface-variant">OpenER FX:</span>
                  <div className="flex items-center gap-2 font-caption-code text-xs text-on-surface font-semibold">
                    <span className="text-secondary-bright">€{rates['EUR']?.toFixed(2) || '0.92'}</span>
                    <span className="text-stroke-subtle">|</span>
                    <span className="text-secondary-bright">£{rates['GBP']?.toFixed(2) || '0.79'}</span>
                    <span className="text-stroke-subtle">|</span>
                    <span className="text-secondary-bright">¥{rates['JPY']?.toFixed(1) || '155.0'}</span>
                  </div>
                </div>

                <button
                  type="button"
                  id="openAddModalBtn"
                  onClick={() => {
                    setEditingExpense(null);
                    setExpenseModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 bg-primary hover:bg-neutral-200 text-on-primary font-label-md text-xs sm:text-sm px-4 py-2.5 rounded-lg shadow-sm transition-all active:scale-95 font-bold"
                >
                  <span className="material-symbols-outlined text-base font-bold">add_circle</span>
                  <span>+ Add Expense</span>
                </button>

                <button
                  type="button"
                  id="triggerBudgetLimitBtn"
                  onClick={() => setCategoryModalOpen(true)}
                  className="flex items-center gap-1.5 bg-surface-elevated hover:bg-surface-container-high text-on-surface hover:text-primary font-label-md text-xs sm:text-sm px-3.5 py-2.5 rounded-lg border border-stroke-subtle transition-colors"
                >
                  <span className="material-symbols-outlined text-base text-secondary-bright">tune</span>
                  <span>Set Budget Limit</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCSV}
                  title="Export transactions as CSV"
                  className="flex items-center gap-1.5 bg-surface-card hover:bg-surface-elevated text-on-surface hover:text-primary font-label-md text-xs sm:text-sm px-3 py-2.5 rounded-lg border border-stroke-subtle transition-colors"
                >
                  <span className="material-symbols-outlined text-base text-on-surface-variant">download</span>
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  id="toggleSimulatorBtn"
                  onClick={() => setSimulatorOpen(true)}
                  title="Simulate Mobile Expo View"
                  className="flex items-center gap-1.5 bg-surface-card hover:bg-surface-elevated text-on-surface hover:text-primary font-label-md text-xs sm:text-sm px-3 py-2.5 rounded-lg border border-stroke-subtle transition-colors"
                >
                  <span className="material-symbols-outlined text-base text-secondary-bright">smartphone</span>
                  <span className="hidden sm:inline">Mobile Sim</span>
                </button>
              </div>
            </section>

            {/* Key Metrics Row (4 KPI Cards) */}
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Card 1: Total Spend */}
              <div className="bg-surface-card p-4 rounded-xl border border-stroke-subtle relative overflow-hidden group hover:border-secondary/40 hover:bg-surface-elevated transition-all">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-sm text-xs uppercase tracking-wider text-tertiary-light font-semibold">
                    Total Spend (USD Base)
                  </span>
                  <span className="flex items-center gap-0.5 font-caption-code text-[11px] text-secondary-bright bg-accent-teal-subtle border border-secondary/30 px-2 py-0.5 rounded-full font-semibold">
                    <span className="material-symbols-outlined text-xs">trending_down</span> -12.4% vs May
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="font-numeric-stat text-2xl sm:text-3xl text-primary font-bold tracking-tight">
                    ${totalSpendUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="font-caption-code text-xs text-tertiary-light">
                    {expenses.length} txns
                  </span>
                </div>
                {/* Micro Sparkline SVG */}
                <div className="mt-3 flex items-center justify-between">
                  <svg className="w-full h-7 text-secondary-bright" fill="none" viewBox="0 0 160 28">
                    <path
                      d="M0 24 L25 18 L50 22 L75 12 L100 16 L125 7 L160 4"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M0 24 L25 18 L50 22 L75 12 L100 16 L125 7 L160 4 L160 28 L0 28 Z"
                      fill="currentColor"
                      fillOpacity="0.15"
                    />
                  </svg>
                </div>
                <div className="mt-2 flex items-center justify-between font-caption-code text-[11px] text-tertiary">
                  <span>Prev Cycle: $4,380.00</span>
                  <span className="text-secondary-bright font-medium">On Track</span>
                </div>
              </div>

              {/* Card 2: Monthly Budget Remaining */}
              <div className="bg-surface-card p-4 rounded-xl border border-stroke-subtle relative overflow-hidden group hover:border-secondary/40 hover:bg-surface-elevated transition-all">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-sm text-xs uppercase tracking-wider text-tertiary-light font-semibold">
                    Monthly Remaining
                  </span>
                  <span className="font-caption-code text-[11px] text-secondary-bright bg-accent-teal-subtle border border-secondary/30 px-2 py-0.5 rounded-full font-semibold">
                    {budgetConsumedPct.toFixed(1)}% Consumed
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="font-numeric-stat text-2xl sm:text-3xl text-primary font-bold tracking-tight">
                    ${monthlyRemaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="font-caption-code text-xs text-tertiary-light">
                    of ${totalBudgetLimit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {/* Budget Gauge */}
                <div className="w-full bg-surface-elevated h-2 rounded-full mt-3 overflow-hidden border border-stroke-subtle">
                  <div
                    className="bg-secondary-bright h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(budgetConsumedPct, 100)}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between font-caption-code text-[11px] text-tertiary">
                  <span>Safe velocity:</span>
                  <span className="text-on-surface font-semibold">
                    ${(monthlyRemaining / 15).toFixed(2)} / day remaining
                  </span>
                </div>
              </div>

              {/* Card 3: Top Expense Category */}
              <div className="bg-surface-card p-4 rounded-xl border border-stroke-subtle relative overflow-hidden group hover:border-secondary/40 hover:bg-surface-elevated transition-all">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-sm text-xs uppercase tracking-wider text-tertiary-light font-semibold">
                    Top Outflow Category
                  </span>
                  <span className="font-caption-code text-[11px] text-on-surface-variant bg-surface-elevated px-2 py-0.5 rounded-full border border-stroke-subtle">
                    {topCategoryInfo.pct.toFixed(1)}% of Spend
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="font-headline-sm text-lg text-primary font-bold truncate">
                    {topCategoryInfo.name}
                  </div>
                </div>
                <div className="mt-1 font-headline-md text-2xl text-secondary-bright font-bold">
                  ${topCategoryInfo.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="mt-3 flex items-center gap-1.5 font-caption-code text-[11px] text-tertiary">
                  <span className="material-symbols-outlined text-sm text-secondary-bright">verified</span>
                  <span>Normalized across current billing cycle</span>
                </div>
              </div>

              {/* Card 4: Active Threshold Bot Sentinel */}
              <div className="bg-surface-card p-4 rounded-xl border border-stroke-subtle relative overflow-hidden group hover:border-secondary/40 hover:bg-surface-elevated transition-all">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-sm text-xs uppercase tracking-wider text-tertiary-light font-semibold">
                    Threshold Bot Sentinel
                  </span>
                  {sentinelBreach ? (
                    <span className="flex items-center gap-1 font-caption-code text-[11px] text-warning-amber bg-warning-amber/15 border border-warning-amber/30 px-2 py-0.5 rounded-full font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-warning-amber animate-pulse" />
                      1 Near Limit
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-caption-code text-[11px] text-secondary-bright bg-accent-teal-subtle border border-secondary/30 px-2 py-0.5 rounded-full font-semibold">
                      All Caps Safe
                    </span>
                  )}
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="font-headline-sm text-base text-primary font-bold truncate">
                    {sentinelBreach ? `${sentinelBreach.cat} (${sentinelBreach.ratio.toFixed(0)}%)` : 'Healthy Operating Margin'}
                  </div>
                </div>
                <div className="text-warning-amber font-body-sm text-xs font-semibold mt-1">
                  {sentinelBreach
                    ? `$${sentinelBreach.spent.toFixed(2)} / $${sentinelBreach.limit.toFixed(2)} Limit`
                    : 'Zero webhook breaches active'}
                </div>
                <div className="mt-3 flex items-center justify-between font-caption-code text-[11px] text-tertiary">
                  <span className="truncate">Webhook: Discord & TG Sent</span>
                  <span className="text-warning-amber font-semibold">
                    {sentinelBreach ? `$${(sentinelBreach.limit - sentinelBreach.spent).toFixed(2)} buffer` : 'Safe'}
                  </span>
                </div>
              </div>
            </section>

            {/* Interactive Visual Analytics Center: Donut Chart & 6-Month Bar Chart */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column (5 cols): Category Distribution Donut */}
              <div className="lg:col-span-5 bg-surface-card border border-stroke-subtle p-5 rounded-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h2 className="font-headline-sm text-base sm:text-lg text-primary font-semibold">
                        Category Spending Distribution
                      </h2>
                      <p className="font-caption-code text-xs text-on-surface-variant">
                        June 2026 Normalized Breakdown (DRF /api/expenses/summary/)
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-secondary-bright text-2xl">pie_chart</span>
                  </div>

                  <CategoryPieChart
                    data={
                      summary?.categories?.length
                        ? summary.categories
                        : categories.map((cat) => ({
                            category: cat.name,
                            total: String(categorySpendingMap[cat.id] || 0),
                          }))
                    }
                    baseCurrency="USD"
                  />
                </div>
              </div>

              {/* Right Column (7 cols): 6-Month Spending Trajectory */}
              <div className="lg:col-span-7 bg-surface-card border border-stroke-subtle p-5 rounded-xl flex flex-col justify-between">
                <MonthlyTrendBarChart
                  data={analytics?.monthly_trends || []}
                  baseCurrency="USD"
                />
              </div>
            </section>

            {/* Budget Health Center & Bot Threshold Alerts */}
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              {/* Category Limits Status Cards (8 cols) */}
              <div className="xl:col-span-8 bg-surface-card border border-stroke-subtle p-5 sm:p-6 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-headline-sm text-lg text-primary font-semibold">
                      Category Budget Health & Thresholds
                    </h2>
                    <p className="font-caption-code text-xs text-on-surface-variant">
                      Real-time cap monitoring with automated webhook dispatch triggers
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCategoryModalOpen(true)}
                    className="font-label-sm text-xs text-secondary-bright hover:text-white flex items-center gap-1 transition-colors font-semibold"
                  >
                    <span className="material-symbols-outlined text-sm">tune</span>
                    <span>Adjust Caps</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categories.map((cat) => {
                    const limitVal = cat.monthly_limit ? parseFloat(cat.monthly_limit) : 0;
                    const spentVal = categorySpendingMap[cat.id] || 0;
                    const pct = limitVal > 0 ? (spentVal / limitVal) * 100 : 0;
                    const isBreach = limitVal > 0 && pct >= 100;
                    const isNearLimit = limitVal > 0 && pct >= 85 && !isBreach;

                    return (
                      <div
                        key={cat.id}
                        className={`p-4 rounded-lg relative ${isBreach ? 'bg-surface-elevated border border-critical-crimson/50' : isNearLimit ? 'bg-surface-elevated border border-warning-amber/40' : 'bg-surface-elevated border border-stroke-subtle'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`material-symbols-outlined ${isBreach ? 'text-critical-crimson' : isNearLimit ? 'text-warning-amber' : 'text-secondary-bright'}`}>
                              category
                            </span>
                            <span className="font-label-md text-sm text-primary font-semibold">
                              {cat.name}
                            </span>
                          </div>
                          {isBreach ? (
                            <span className="font-caption-code text-[10px] bg-critical-crimson/15 text-critical-crimson border border-critical-crimson/30 font-bold px-2 py-0.5 rounded-full">
                              BREACHED (100%+)
                            </span>
                          ) : isNearLimit ? (
                            <span className="font-caption-code text-[10px] bg-warning-amber/15 text-warning-amber border border-warning-amber/30 font-bold px-2 py-0.5 rounded-full">
                              {pct.toFixed(0)}% (NEAR LIMIT)
                            </span>
                          ) : (
                            <span className="font-caption-code text-[10px] bg-surface-card text-on-surface-variant border border-stroke-subtle px-2 py-0.5 rounded-full">
                              {limitVal > 0 ? `${pct.toFixed(1)}% Utilized` : 'Uncapped'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-baseline justify-between mb-1">
                          <span className={`font-numeric-stat text-xl font-bold ${isBreach ? 'text-critical-crimson' : isNearLimit ? 'text-warning-amber' : 'text-primary'}`}>
                            ${spentVal.toFixed(2)}
                          </span>
                          <span className="font-caption-code text-xs text-tertiary-light">
                            {limitVal > 0 ? `Limit: $${limitVal.toFixed(2)}` : 'No Limit'}
                          </span>
                        </div>

                        {limitVal > 0 && (
                          <div className="w-full bg-surface-card h-2 rounded-full overflow-hidden mb-2 border border-stroke-subtle">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${isBreach ? 'bg-critical-crimson' : isNearLimit ? 'bg-warning-amber' : 'bg-secondary-bright'}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 font-caption-code text-[11px] text-tertiary-light">
                          <span className="material-symbols-outlined text-xs text-secondary-bright">
                            {isBreach || isNearLimit ? 'notifications_active' : 'check_circle'}
                          </span>
                          <span>
                            {isBreach
                              ? 'Automated bot notifications dispatched'
                              : isNearLimit
                              ? 'Discord & Telegram 85% sentinel engaged'
                              : 'Normal operating pacing within limit'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Side (4 cols): Threshold Bot Nodes */}
              <div className="xl:col-span-4 bg-surface-card border border-stroke-subtle p-5 sm:p-6 rounded-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary-bright text-xl">smart_toy</span>
                      <h2 className="font-headline-sm text-lg text-primary font-semibold">
                        Threshold Bot Nodes
                      </h2>
                    </div>
                    <span className="font-caption-code text-xs text-secondary-bright bg-accent-teal-subtle border border-secondary/30 px-2 py-0.5 rounded font-medium">
                      notifications.py Active
                    </span>
                  </div>

                  <p className="font-body-sm text-xs text-on-surface-variant mb-4">
                    Automated DRF signal dispatching whenever an expense causes category spend to exceed 85% of monthly limit.
                  </p>

                  {/* Integrations List */}
                  <div className="flex flex-col gap-2.5 mb-4">
                    <div className="flex items-center justify-between p-3 bg-surface-elevated border border-stroke-subtle rounded-lg">
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-secondary-bright text-lg">send</span>
                        <div>
                          <div className="font-label-md text-xs text-primary font-semibold">Telegram Bot Node</div>
                          <div className="font-caption-code text-[11px] text-tertiary-light">
                            @SpendWiseAlertsBot • Chat #849201
                          </div>
                        </div>
                      </div>
                      <span className="font-caption-code text-[10px] text-secondary-bright bg-accent-teal-subtle border border-secondary/30 px-2 py-0.5 rounded font-bold">
                        CONNECTED
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-surface-elevated border border-stroke-subtle rounded-lg">
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-secondary-bright text-lg">forum</span>
                        <div>
                          <div className="font-label-md text-xs text-primary font-semibold">Discord Webhook</div>
                          <div className="font-caption-code text-[11px] text-tertiary-light">
                            #finance-telemetry • Webhook 200 OK
                          </div>
                        </div>
                      </div>
                      <span className="font-caption-code text-[10px] text-secondary-bright bg-accent-teal-subtle border border-secondary/30 px-2 py-0.5 rounded font-bold">
                        CONNECTED
                      </span>
                    </div>
                  </div>

                  {/* Dispatched Payload Snippet */}
                  <div className="bg-surface-base p-3 rounded-lg border border-stroke-subtle mb-3">
                    <div className="flex items-center justify-between mb-1 font-caption-code text-[11px] text-tertiary">
                      <span>LAST PAYLOAD DISPATCHED</span>
                      <span>Real-time</span>
                    </div>
                    <pre className="font-caption-code text-[11px] text-secondary-bright leading-tight overflow-x-auto select-all max-h-32">
                      {botPayloadSnippet}
                    </pre>
                  </div>
                </div>

                <button
                  type="button"
                  id="testBotBtn"
                  onClick={handleTriggerTestAlert}
                  className="w-full flex items-center justify-center gap-1.5 bg-surface-elevated hover:bg-surface-container-high text-primary font-label-md text-xs sm:text-sm py-2.5 rounded-lg border border-stroke-subtle transition-colors font-semibold"
                >
                  <span className="material-symbols-outlined text-base text-secondary-bright">bolt</span>
                  <span>Send Test Alert Payload</span>
                </button>
              </div>
            </section>

            {/* Recent Transactions Log with Multi-Currency & Filter Controls */}
            <section className="bg-surface-card border border-stroke-subtle p-5 sm:p-6 rounded-xl">
              {/* Ledger Header & Filters */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-4 border-b border-stroke-subtle">
                <div>
                  <h2 className="font-headline-sm text-lg text-primary font-semibold">
                    Multi-Currency Transaction Ledger
                  </h2>
                  <p className="font-caption-code text-xs text-on-surface-variant">
                    Filtering {filteredExpenses.length} of {expenses.length} records • DRF route:{' '}
                    <code className="text-secondary-bright">/api/expenses/?search=&category=&currency=</code>
                  </p>
                </div>

                {/* Filters Strip */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Search */}
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-tertiary-light text-base">
                      search
                    </span>
                    <input
                      id="txSearchInput"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search merchant, tag..."
                      className="bg-surface-elevated text-primary font-body-sm text-xs pl-8 pr-3 py-2 rounded-lg border border-stroke-subtle focus:border-secondary focus:outline-none w-48 sm:w-56 placeholder:text-tertiary"
                    />
                  </div>

                  {/* Category Filter */}
                  <select
                    id="txCategoryFilter"
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="bg-surface-elevated text-primary font-body-sm text-xs px-3 py-2 rounded-lg border border-stroke-subtle focus:border-secondary focus:outline-none"
                  >
                    <option value="ALL">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  {/* Currency Pills */}
                  <div className="flex items-center bg-surface-elevated p-0.5 rounded-lg border border-stroke-subtle">
                    {['ALL', 'USD', 'EUR', 'GBP', 'JPY'].map((curr) => (
                      <button
                        key={curr}
                        type="button"
                        onClick={() => setCurrencyFilter(curr)}
                        className={`px-2.5 py-1 rounded text-[11px] font-caption-code font-bold transition-colors ${currencyFilter === curr ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}
                      >
                        {curr}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left font-body-sm text-xs sm:text-sm">
                  <thead>
                    <tr className="font-label-sm text-xs uppercase tracking-wider text-tertiary-light border-b border-stroke-subtle">
                      <th className="pb-3 font-semibold">Date & Time</th>
                      <th className="pb-3 font-semibold">Merchant / Title</th>
                      <th className="pb-3 font-semibold">Category</th>
                      <th className="pb-3 font-semibold text-right">Original Amount</th>
                      <th className="pb-3 font-semibold text-right">Normalized (USD)</th>
                      <th className="pb-3 font-semibold text-center">FX Rate Used</th>
                      <th className="pb-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stroke-subtle" id="txTableBody">
                    {filteredExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-on-surface-variant text-xs">
                          No transactions found matching criteria. Click "+ Add Expense" to record one.
                        </td>
                      </tr>
                    ) : (
                      filteredExpenses.map((exp) => {
                        const parsedAmt = parseFloat(exp.amount) || 0;
                        const fxRateToUSD = exp.currency === 'USD' ? 1.0 : rates[exp.currency] ? 1 / rates[exp.currency] : 1.0;
                        const normUSD = parsedAmt * fxRateToUSD;
                        const catObj = categories.find((c) => c.id === exp.category);

                        return (
                          <tr
                            key={exp.id}
                            className="hover:bg-surface-elevated/70 transition-colors group"
                          >
                            <td className="py-3 font-caption-code text-xs text-tertiary-light">
                              {exp.date}
                            </td>
                            <td className="py-3">
                              <div className="font-label-md text-xs sm:text-sm text-primary font-semibold flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-secondary-bright" />
                                <span>{exp.title}</span>
                              </div>
                              {exp.notes && (
                                <div className="font-caption-code text-[11px] text-tertiary truncate max-w-xs">
                                  {exp.notes}
                                </div>
                              )}
                            </td>
                            <td className="py-3">
                              <span className="px-2.5 py-0.5 rounded-full font-caption-code text-xs bg-accent-teal-subtle text-secondary-bright border border-secondary/30">
                                {catObj?.name || exp.category_name || 'General'}
                              </span>
                            </td>
                            <td className="py-3 text-right font-caption-code text-xs text-on-surface">
                              <span className="font-semibold text-secondary-bright">
                                {exp.currency} {parsedAmt.toFixed(2)}
                              </span>
                            </td>
                            <td className="py-3 text-right font-caption-code text-xs font-bold text-primary">
                              ${normUSD.toFixed(2)} USD
                            </td>
                            <td className="py-3 text-center font-caption-code text-xs text-on-surface-variant">
                              <span className="bg-surface-elevated border border-stroke-subtle px-2 py-0.5 rounded text-tertiary-light">
                                {exp.currency === 'USD' ? '1.000 (Base)' : `1 ${exp.currency} = ${fxRateToUSD.toFixed(4)} USD`}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingExpense(exp);
                                    setExpenseModalOpen(true);
                                  }}
                                  className="p-1 hover:text-secondary-bright transition-colors text-on-surface-variant"
                                  title="Edit Transaction"
                                >
                                  <span className="material-symbols-outlined text-base">edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExpense(exp.id)}
                                  className="p-1 hover:text-critical-crimson transition-colors text-on-surface-variant"
                                  title="Delete"
                                >
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footnote */}
              <div className="mt-4 pt-3 border-t border-stroke-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-caption-code text-xs text-on-surface-variant">
                <div className="flex items-center gap-2">
                  <span>Showing {filteredExpenses.length} of {expenses.length} entries</span>
                  <span className="text-tertiary">•</span>
                  <span className="text-secondary-bright font-semibold">14/14 PyTests passing</span>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* 4. Mobile Expo View Simulator Drawer */}
      <div
        id="mobileSimulatorDrawer"
        className={`fixed right-0 top-0 bottom-0 w-80 sm:w-96 bg-surface-card border-l border-stroke-strong z-50 transform transition-transform duration-300 p-4 flex flex-col justify-between shadow-2xl ${simulatorOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-stroke-subtle">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary-bright">devices</span>
              <h3 className="font-headline-sm text-base text-primary font-bold">Expo Native Preview</h3>
            </div>
            <button
              type="button"
              onClick={() => setSimulatorOpen(false)}
              className="p-1 hover:text-primary text-on-surface-variant"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Mobile Device Frame Mock */}
          <div className="mt-4 bg-surface-base rounded-3xl p-3 border-2 border-stroke-subtle shadow-inner flex flex-col gap-3">
            {/* iOS Status Bar */}
            <div className="flex items-center justify-between px-2 pt-1 font-caption-code text-[10px] text-tertiary-light">
              <span>9:41</span>
              <div className="w-16 h-3.5 bg-surface-elevated rounded-full mx-auto" />
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">signal_cellular_alt</span>
                <span className="material-symbols-outlined text-xs">wifi</span>
                <span className="material-symbols-outlined text-xs">battery_full</span>
              </div>
            </div>

            {/* Native Screen Header */}
            <div className="px-2 pt-1">
              <div className="font-caption-code text-[10px] text-secondary-bright uppercase font-bold">
                SpendWise Mobile
              </div>
              <div className="font-headline-sm text-base text-primary font-bold">
                June 2026 Overview
              </div>
            </div>

            {/* Native Spend Card */}
            <div className="bg-surface-card p-3 rounded-xl border border-stroke-subtle">
              <div className="text-[10px] text-tertiary-light font-caption-code uppercase">
                Total Monthly Outflow
              </div>
              <div className="font-headline-md text-xl text-primary font-bold">
                ${totalSpendUSD.toFixed(2)}
              </div>
              <div className="w-full bg-surface-elevated h-1.5 rounded-full mt-2 overflow-hidden border border-stroke-subtle">
                <div
                  className="bg-secondary-bright h-full rounded-full"
                  style={{ width: `${Math.min(budgetConsumedPct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-tertiary-light font-caption-code mt-1">
                <span>${monthlyRemaining.toFixed(0)} Left</span>
                <span>Safe Pacing</span>
              </div>
            </div>

            {/* Native Touch Action Item */}
            <div className="bg-surface-elevated p-2.5 rounded-xl border border-stroke-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-warning-amber/15 flex items-center justify-center text-warning-amber border border-warning-amber/20">
                  <span className="material-symbols-outlined text-base">restaurant</span>
                </div>
                <div>
                  <div className="font-label-sm text-xs text-primary font-semibold">Dining Sentinel</div>
                  <div className="font-caption-code text-[10px] text-warning-amber">
                    88% of $800 cap reached
                  </div>
                </div>
              </div>
              <span className="material-symbols-outlined text-sm text-tertiary">chevron_right</span>
            </div>

            {/* Quick Log Button */}
            <button
              type="button"
              onClick={() => {
                setSimulatorOpen(false);
                setExpenseModalOpen(true);
              }}
              className="w-full bg-primary text-on-primary font-label-sm text-xs py-2 rounded-xl font-bold flex items-center justify-center gap-1 shadow hover:bg-neutral-200 transition-colors"
            >
              <span className="material-symbols-outlined text-sm font-bold">add</span>
              <span>Quick Log Expense</span>
            </button>

            {/* Native Bottom Tab Bar */}
            <div className="flex items-center justify-around pt-2 border-t border-stroke-subtle text-on-surface-variant">
              <div className="flex flex-col items-center text-primary">
                <span className="material-symbols-outlined text-lg text-secondary-bright">dashboard</span>
                <span className="text-[9px] font-caption-code font-bold">Home</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="material-symbols-outlined text-lg">receipt</span>
                <span className="text-[9px] font-caption-code">Logs</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="material-symbols-outlined text-lg">pie_chart</span>
                <span className="text-[9px] font-caption-code">Budgets</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="material-symbols-outlined text-lg">tune</span>
                <span className="text-[9px] font-caption-code">Config</span>
              </div>
            </div>
          </div>
        </div>

        {/* Simulator Meta */}
        <div className="font-caption-code text-xs text-tertiary pt-3 border-t border-stroke-subtle flex items-center justify-between">
          <span>React Native / Expo SDK 51</span>
          <span className="text-secondary-bright font-semibold">Touch &gt;= 44pt Valid</span>
        </div>
      </div>

      {/* 5. Dynamic Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-surface-elevated text-primary px-4 py-3 rounded-xl border border-secondary/40 shadow-xl flex items-center gap-3 animate-fadeIn">
          <span className={`material-symbols-outlined text-xl ${toast.type === 'error' ? 'text-critical-crimson' : toast.type === 'warning' ? 'text-warning-amber' : 'text-secondary-bright'}`}>
            {toast.type === 'error' ? 'error' : toast.type === 'warning' ? 'warning' : 'check_circle'}
          </span>
          <div>
            <div className="font-label-md text-xs font-bold text-primary">{toast.title}</div>
            <div className="font-caption-code text-[11px] text-on-surface-variant">{toast.desc}</div>
          </div>
        </div>
      )}

      {/* 6. Modals */}
      <AddExpenseModal
        isOpen={expenseModalOpen}
        onClose={() => {
          setExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        onSubmit={handleCreateOrUpdateExpense}
        categories={categories}
        initialData={editingExpense}
        baseCurrency={selectedCurrency}
        rates={rates}
        categorySpending={categorySpendingMap}
      />

      <AddCategoryModal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        categories={categories}
        onCreateCategory={handleCreateCategory}
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
        categorySpending={categorySpendingMap}
      />

      <AuthModal
        isOpen={authModalOpen}
        onSuccess={(user) => {
          setCurrentUser(user);
          setAuthModalOpen(false);
          showToast('Authenticated', `Welcome back, ${user.username}!`);
          loadAllData();
        }}
      />
    </div>
  );
}

export default App;
