import { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Receipt,
  FolderTree,
  PieChart as PieChartIcon,
  Bell,
  Smartphone,
  Plus,
  Search,
  Download,
  Trash2,
  Edit2,
  LogOut,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Globe,
  Sparkles,
  CheckCircle,
  Menu,
  X,
} from 'lucide-react';
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

type NavTab = 'dashboard' | 'expenses' | 'categories' | 'analytics' | 'alerts' | 'mobile';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Data states
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummaryResponse | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Modals
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Base Currency (defaults to USD)
  const baseCurrency = summary?.base_currency || 'USD';

  // Check auth on mount
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
      const [cats, exps, summ, anal] = await Promise.all([
        api.getCategories(),
        api.getExpenses(),
        api.getSummary().catch(() => null),
        api.getAnalytics().catch(() => null),
      ]);
      setCategories(cats);
      setExpenses(exps);
      if (summ) setSummary(summ);
      if (anal) setAnalytics(anal);

      // Seed starter categories if brand new account with zero categories
      if (cats.length === 0) {
        await seedDefaultCategories();
      }
    } catch (err: any) {
      console.error('Failed to load data:', err);
    }
  };

  const seedDefaultCategories = async () => {
    try {
      const c1 = await api.createCategory({ name: 'Dining & Food', description: 'Restaurants, cafes, groceries', monthly_limit: '250.00' });
      const c2 = await api.createCategory({ name: 'Travel & Commute', description: 'Flights, hotels, transit', monthly_limit: '400.00' });
      const c3 = await api.createCategory({ name: 'Software & Tech', description: 'Cloud, hosting, SaaS subscriptions', monthly_limit: '150.00' });
      await api.createCategory({ name: 'Entertainment', description: 'Movies, concerts, events', monthly_limit: '100.00' });

      // Add a couple sample multi-currency expenses
      const today = new Date().toISOString().split('T')[0];
      await api.createExpense({ title: 'Dinner with Team', amount: '65.00', currency: 'USD', category: c1.id, date: today, notes: 'Project celebration' });
      await api.createExpense({ title: 'Hotel in Zurich', amount: '180.00', currency: 'EUR', category: c2.id, date: today, notes: 'Multi-currency demo' });
      await api.createExpense({ title: 'AWS Cloud Hosting', amount: '48.50', currency: 'USD', category: c3.id, date: today });

      // Reload
      const [cats, exps, summ, anal] = await Promise.all([
        api.getCategories(),
        api.getExpenses(),
        api.getSummary().catch(() => null),
        api.getAnalytics().catch(() => null),
      ]);
      setCategories(cats);
      setExpenses(exps);
      if (summ) setSummary(summ);
      if (anal) setAnalytics(anal);
    } catch (e) {
      console.warn('Could not seed defaults:', e);
    }
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setAuthModalOpen(false);
    showToast(`Welcome back, ${user.username}!`, 'success');
    loadAllData();
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setCategories([]);
    setExpenses([]);
    setSummary(null);
    setAnalytics(null);
    setAuthModalOpen(true);
    showToast('Signed out successfully.', 'success');
  };

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const matchesSearch = !searchQuery || exp.title.toLowerCase().includes(searchQuery.toLowerCase()) || (exp.notes && exp.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = !selectedCategoryFilter || String(exp.category) === selectedCategoryFilter;
      const matchesStart = !startDateFilter || exp.date >= startDateFilter;
      const matchesEnd = !endDateFilter || exp.date <= endDateFilter;
      return matchesSearch && matchesCategory && matchesStart && matchesEnd;
    });
  }, [expenses, searchQuery, selectedCategoryFilter, startDateFilter, endDateFilter]);

  // Budget calculations and active threshold warnings
  const budgetAlerts = useMemo(() => {
    if (!analytics?.categories) return [];
    return analytics.categories.filter((c) => c.is_over_budget);
  }, [analytics]);

  // Total month spending calculation
  const totalSpentThisMonth = useMemo(() => {
    if (analytics?.total_spent_base) {
      return parseFloat(analytics.total_spent_base);
    }
    return expenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  }, [analytics, expenses]);

  // Expense Handlers
  const handleSaveExpense = async (data: any) => {
    if (editingExpense) {
      await api.updateExpense(editingExpense.id, data);
      showToast('Expense updated successfully.', 'success');
    } else {
      await api.createExpense(data);
      showToast('New expense recorded.', 'success');
    }
    setEditingExpense(null);
    loadAllData();
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await api.deleteExpense(id);
      showToast('Expense deleted.', 'success');
      loadAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Category Handlers
  const handleSaveCategory = async (data: any) => {
    if (editingCategory) {
      await api.updateCategory(editingCategory.id, data);
      showToast('Category updated.', 'success');
    } else {
      await api.createCategory(data);
      showToast('Category created.', 'success');
    }
    setEditingCategory(null);
    loadAllData();
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Delete this category? All related expenses will also be removed.')) return;
    try {
      await api.deleteCategory(id);
      showToast('Category removed.', 'success');
      loadAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="app-container">
      {/* Toast Notification Container */}
      {toast && (
        <div className="toast-container" id="toast-notification-area">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' && <CheckCircle size={18} color="var(--success)" />}
            {toast.type === 'warning' && <AlertTriangle size={18} color="var(--warning)" />}
            {toast.type === 'error' && <AlertTriangle size={18} color="var(--danger)" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal isOpen={authModalOpen} onSuccess={handleAuthSuccess} />

      {/* Add / Edit Expense Modal */}
      <AddExpenseModal
        isOpen={expenseModalOpen}
        onClose={() => {
          setExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        onSubmit={handleSaveExpense}
        categories={categories}
        initialData={editingExpense}
        baseCurrency={baseCurrency}
      />

      {/* Add / Edit Category Modal */}
      <AddCategoryModal
        isOpen={categoryModalOpen}
        onClose={() => {
          setCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        onSubmit={handleSaveCategory}
        initialData={editingCategory}
      />

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`} id="app-sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-icon">
              <TrendingUp size={22} />
            </div>
            <div className="brand-text">
              <h1>SpendWise</h1>
              <span>Enterprise API UI</span>
            </div>
          </div>
          <button
            className="btn-icon"
            style={{ display: window.innerWidth < 768 ? 'flex' : 'none' }}
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('dashboard');
              setMobileMenuOpen(false);
            }}
            id="nav-dashboard-btn"
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'expenses' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('expenses');
              setMobileMenuOpen(false);
            }}
            id="nav-expenses-btn"
          >
            <Receipt size={18} />
            <span>Expenses & Log</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('categories');
              setMobileMenuOpen(false);
            }}
            id="nav-categories-btn"
          >
            <FolderTree size={18} />
            <span>Categories & Limits</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('analytics');
              setMobileMenuOpen(false);
            }}
            id="nav-analytics-btn"
          >
            <PieChartIcon size={18} />
            <span>Analytics & Trends</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('alerts');
              setMobileMenuOpen(false);
            }}
            id="nav-alerts-btn"
          >
            <Bell size={18} />
            <span>Bot & Webhook Alerts</span>
            {budgetAlerts.length > 0 && (
              <span className="badge badge-danger" style={{ marginLeft: 'auto', padding: '2px 6px' }}>
                {budgetAlerts.length}
              </span>
            )}
          </button>

          <button
            className={`nav-item ${activeTab === 'mobile' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('mobile');
              setMobileMenuOpen(false);
            }}
            id="nav-mobile-btn"
          >
            <Smartphone size={18} />
            <span>Mobile App View</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          {currentUser ? (
            <>
              <div className="user-badge">
                <div className="user-avatar">
                  {currentUser.username.substring(0, 2).toUpperCase()}
                </div>
                <div className="user-info">
                  <span className="user-name">{currentUser.username}</span>
                  <span className="user-role">Authenticated</span>
                </div>
              </div>
              <button
                className="btn-icon"
                onClick={handleLogout}
                title="Log out"
                id="logout-btn"
                aria-label="Logout"
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              style={{ width: '100%' }}
              onClick={() => setAuthModalOpen(true)}
              id="open-auth-btn"
            >
              Sign In
            </button>
          )}
        </div>
      </aside>

      {/* Main App Content */}
      <div className="main-wrapper">
        <header className="top-bar">
          <div className="top-bar-left">
            <button
              className="btn-icon"
              style={{ display: window.innerWidth < 768 ? 'flex' : 'none' }}
              onClick={() => setMobileMenuOpen(true)}
              id="mobile-menu-toggle-btn"
              aria-label="Toggle navigation"
            >
              <Menu size={20} />
            </button>
            <h2 className="page-title">
              {activeTab === 'dashboard' && 'Financial Overview'}
              {activeTab === 'expenses' && 'Expense Records'}
              {activeTab === 'categories' && 'Budget Management'}
              {activeTab === 'analytics' && 'Spending Analytics'}
              {activeTab === 'alerts' && 'Bot Notification Integrations'}
              {activeTab === 'mobile' && 'Native Mobile UI Simulator'}
            </h2>
          </div>

          <div className="top-bar-right">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                fontSize: '13px',
              }}
            >
              <Globe size={15} color="var(--primary-light)" />
              <span style={{ color: 'var(--text-muted)' }}>Base:</span>
              <strong style={{ color: '#fff' }}>{baseCurrency}</strong>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingExpense(null);
                setExpenseModalOpen(true);
              }}
              id="top-add-expense-btn"
            >
              <Plus size={16} />
              <span>Add Expense</span>
            </button>
          </div>
        </header>

        <main className="content-area">
          {/* Over-Budget Alert Warning Banner */}
          {budgetAlerts.length > 0 && (
            <div className="alert-banner" id="budget-threshold-alert-banner">
              <div className="alert-banner-icon">
                <AlertTriangle size={22} />
              </div>
              <div className="alert-banner-text" style={{ flex: 1 }}>
                <h4>Budget Threshold Breach Detected</h4>
                <p>
                  {budgetAlerts
                    .map(
                      (b) =>
                        `"${b.name}" has reached ${b.budget_percentage}% of its monthly limit (${b.current_month_spent} / ${b.monthly_limit} ${baseCurrency})`
                    )
                    .join(' • ')}
                </p>
              </div>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setActiveTab('alerts')}
                id="view-alert-details-btn"
              >
                View Bot Alert
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 1: DASHBOARD */}
          {/* ============================================================== */}
          {activeTab === 'dashboard' && (
            <div id="dashboard-tab-content">
              {/* Metric Cards */}
              <div className="metrics-grid">
                <div className="card metric-card" id="metric-total-spent">
                  <div className="metric-header">
                    <span className="metric-title">Total Month Spent</span>
                    <div className="metric-icon-box">
                      <DollarSign size={20} />
                    </div>
                  </div>
                  <div className="metric-value">
                    {baseCurrency} {totalSpentThisMonth.toFixed(2)}
                  </div>
                  <div className="metric-footer">
                    <span className="badge badge-success">Live Converted</span>
                    <span>Across all currencies</span>
                  </div>
                </div>

                <div className="card metric-card" id="metric-total-expenses">
                  <div className="metric-header">
                    <span className="metric-title">Transactions</span>
                    <div className="metric-icon-box" style={{ color: 'var(--cyan)', background: 'hsla(186, 92%, 48%, 0.12)' }}>
                      <Receipt size={20} />
                    </div>
                  </div>
                  <div className="metric-value">{expenses.length}</div>
                  <div className="metric-footer">
                    <span>{categories.length} active spending categories</span>
                  </div>
                </div>

                <div className="card metric-card" id="metric-budget-status">
                  <div className="metric-header">
                    <span className="metric-title">Budget Health</span>
                    <div
                      className="metric-icon-box"
                      style={{
                        color: budgetAlerts.length > 0 ? 'var(--danger)' : 'var(--success)',
                        background: budgetAlerts.length > 0 ? 'var(--danger-glow)' : 'var(--success-glow)',
                      }}
                    >
                      <Bell size={20} />
                    </div>
                  </div>
                  <div className="metric-value">
                    {budgetAlerts.length > 0 ? `${budgetAlerts.length} Over Limit` : 'Optimal'}
                  </div>
                  <div className="metric-footer">
                    {budgetAlerts.length > 0 ? (
                      <span className="badge badge-danger">Alert Fired</span>
                    ) : (
                      <span className="badge badge-success">All Limits Respected</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="charts-grid">
                <div className="card" id="monthly-trend-card">
                  <div className="chart-card-header">
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700 }}>6-Month Spending Trajectory</h3>
                      <span className="chart-subtitle">Converted to {baseCurrency}</span>
                    </div>
                  </div>
                  <MonthlyTrendBarChart
                    data={analytics?.monthly_trends || [
                      { month: '2026-01', amount: '120.00' },
                      { month: '2026-02', amount: '230.50' },
                      { month: '2026-03', amount: '185.00' },
                      { month: '2026-04', amount: '340.00' },
                      { month: '2026-05', amount: '290.00' },
                      { month: '2026-06', amount: String(totalSpentThisMonth) },
                    ]}
                    baseCurrency={baseCurrency}
                  />
                </div>

                <div className="card" id="category-donut-card">
                  <div className="chart-card-header">
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Category Distribution</h3>
                      <span className="chart-subtitle">Expense share</span>
                    </div>
                  </div>
                  <CategoryPieChart
                    data={summary?.categories || []}
                    baseCurrency={baseCurrency}
                  />
                </div>
              </div>

              {/* Recent Transactions Card */}
              <div className="card" id="recent-transactions-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Recent Transactions</h3>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveTab('expenses')}
                    id="view-all-transactions-btn"
                  >
                    View All ({expenses.length})
                  </button>
                </div>

                {expenses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    <p>No expenses recorded yet.</p>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ marginTop: '12px' }}
                      onClick={() => setExpenseModalOpen(true)}
                    >
                      <Plus size={14} /> Add First Expense
                    </button>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Category</th>
                          <th>Original Amount</th>
                          <th>Date</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.slice(0, 6).map((exp) => (
                          <tr key={exp.id}>
                            <td style={{ fontWeight: 600 }}>{exp.title}</td>
                            <td>
                              <span className="badge badge-primary">{exp.category_name || 'General'}</span>
                            </td>
                            <td className="amount-cell">
                              {exp.amount}
                              <span className="currency-tag">{exp.currency}</span>
                            </td>
                            <td style={{ color: 'var(--text-secondary)' }}>{exp.date}</td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                              {exp.notes || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: EXPENSES LOG & MANAGER */}
          {/* ============================================================== */}
          {activeTab === 'expenses' && (
            <div id="expenses-tab-content">
              {/* Filter Bar */}
              <div className="card" style={{ marginBottom: '20px', padding: '18px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '240px' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                      <Search
                        size={16}
                        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        style={{ paddingLeft: '36px' }}
                        placeholder="Search by title or notes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        id="expense-search-input"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <select
                      className="form-select"
                      style={{ width: '180px' }}
                      value={selectedCategoryFilter}
                      onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                      id="expense-category-filter-select"
                    >
                      <option value="">All Categories</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="date"
                      className="form-input"
                      style={{ width: '150px' }}
                      value={startDateFilter}
                      onChange={(e) => setStartDateFilter(e.target.value)}
                      title="Start date"
                      id="expense-start-date-filter"
                    />

                    <input
                      type="date"
                      className="form-input"
                      style={{ width: '150px' }}
                      value={endDateFilter}
                      onChange={(e) => setEndDateFilter(e.target.value)}
                      title="End date"
                      id="expense-end-date-filter"
                    />

                    <a
                      href={api.getExportCsvUrl()}
                      className="btn btn-secondary"
                      download="expenses.csv"
                      id="export-csv-btn"
                      title="Download CSV export"
                    >
                      <Download size={15} />
                      <span>Export CSV</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Expenses Table */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '17px', fontWeight: 700 }}>
                    Matching Expenses ({filteredExpenses.length})
                  </h3>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setEditingExpense(null);
                      setExpenseModalOpen(true);
                    }}
                    id="add-expense-from-list-btn"
                  >
                    <Plus size={14} /> New Expense
                  </button>
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Category</th>
                        <th>Amount</th>
                        <th>Date</th>
                        <th>Notes</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                            No expenses match the current filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredExpenses.map((exp) => (
                          <tr key={exp.id}>
                            <td style={{ fontWeight: 600 }}>{exp.title}</td>
                            <td>
                              <span className="badge badge-primary">{exp.category_name}</span>
                            </td>
                            <td className="amount-cell">
                              {exp.amount}
                              <span className="currency-tag">{exp.currency}</span>
                            </td>
                            <td>{exp.date}</td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                              {exp.notes || '—'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button
                                  className="btn-icon"
                                  onClick={() => {
                                    setEditingExpense(exp);
                                    setExpenseModalOpen(true);
                                  }}
                                  id={`edit-expense-btn-${exp.id}`}
                                  title="Edit Expense"
                                  aria-label="Edit expense"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  className="btn-icon btn-danger"
                                  onClick={() => handleDeleteExpense(exp.id)}
                                  id={`delete-expense-btn-${exp.id}`}
                                  title="Delete Expense"
                                  aria-label="Delete expense"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: CATEGORIES & BUDGET LIMITS */}
          {/* ============================================================== */}
          {activeTab === 'categories' && (
            <div id="categories-tab-content">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Category Budgets</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Set monthly spending thresholds to receive real-time bot alerts
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setEditingCategory(null);
                    setCategoryModalOpen(true);
                  }}
                  id="add-category-btn"
                >
                  <Plus size={16} /> New Category
                </button>
              </div>

              <div className="categories-grid">
                {categories.map((cat) => {
                  const analyticsInfo = analytics?.categories.find((c) => c.id === cat.id);
                  const monthlySpent = analyticsInfo ? parseFloat(analyticsInfo.current_month_spent) : 0;
                  const limit = cat.monthly_limit ? parseFloat(cat.monthly_limit) : null;
                  const ratio = limit ? (monthlySpent / limit) * 100 : 0;
                  const isOver = limit ? monthlySpent > limit : false;

                  return (
                    <div className="card category-card" key={cat.id} id={`category-card-${cat.id}`}>
                      <div className="category-header">
                        <div className="category-badge-box">
                          <div className="category-icon">
                            <FolderTree size={18} />
                          </div>
                          <div>
                            <h4 style={{ fontSize: '16px', fontWeight: 700 }}>{cat.name}</h4>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {cat.description || 'No description provided'}
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn-icon"
                            onClick={() => {
                              setEditingCategory(cat);
                              setCategoryModalOpen(true);
                            }}
                            id={`edit-category-btn-${cat.id}`}
                            aria-label="Edit category"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="btn-icon btn-danger"
                            onClick={() => handleDeleteCategory(cat.id)}
                            id={`delete-category-btn-${cat.id}`}
                            aria-label="Delete category"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Month-to-Date:</span>
                          <strong style={{ color: isOver ? 'var(--danger)' : '#fff' }}>
                            {baseCurrency} {monthlySpent.toFixed(2)}
                            {limit && ` / ${limit.toFixed(2)}`}
                          </strong>
                        </div>

                        {limit ? (
                          <>
                            <div className="progress-track">
                              <div
                                className={`progress-fill ${
                                  ratio > 100 ? 'over' : ratio > 80 ? 'warning' : 'normal'
                                }`}
                                style={{ width: `${Math.min(ratio, 100)}%` }}
                              />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                {ratio.toFixed(0)}% budget consumed
                              </span>
                              {isOver ? (
                                <span className="badge badge-danger">Threshold Exceeded</span>
                              ) : ratio > 80 ? (
                                <span className="badge badge-warning">Near Limit</span>
                              ) : (
                                <span className="badge badge-success">Healthy</span>
                              )}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                            No monthly threshold set.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: ANALYTICS & INSIGHTS */}
          {/* ============================================================== */}
          {activeTab === 'analytics' && (
            <div id="analytics-tab-content">
              <div className="card" style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '16px' }}>
                  Base Currency Conversion Insights ({baseCurrency})
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, maxWidth: '800px' }}>
                  The Expense Tracker integrates with real-time exchange rates (e.g. <code>open.er-api.com</code>) to automatically normalize all transactions into your configured <code>BASE_CURRENCY ({baseCurrency})</code>. Non-base currencies (such as EUR, GBP, JPY, NPR) are calculated with precision and resilience.
                </p>
              </div>

              <div className="charts-grid">
                <div className="card">
                  <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>
                    Monthly Spending History
                  </h4>
                  <MonthlyTrendBarChart
                    data={analytics?.monthly_trends || []}
                    baseCurrency={baseCurrency}
                  />
                </div>

                <div className="card">
                  <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>
                    Category Breakdown
                  </h4>
                  <CategoryPieChart
                    data={summary?.categories || []}
                    baseCurrency={baseCurrency}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 5: BOT & WEBHOOK ALERTS */}
          {/* ============================================================== */}
          {activeTab === 'alerts' && (
            <div id="alerts-tab-content">
              <div className="card" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '12px',
                      background: 'hsla(350, 89%, 60%, 0.15)',
                      color: 'var(--danger)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Bell size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700 }}>
                      Budget Threshold Bot Alerts (Feature 2)
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Automated webhook & bot alerts dispatched when category spending crosses limit
                    </p>
                  </div>
                </div>

                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, margin: '14px 0' }}>
                  Whenever a transaction is created or updated, the backend checks that category's month-to-date total spending. If it pushes beyond the configured monthly limit, an automated alert notification is instantly fired to your configured <strong>Discord Webhook</strong> or <strong>Telegram Bot</strong>!
                </p>

                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-card)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px 20px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    color: '#e2e8f0',
                    margin: '16px 0',
                  }}
                >
                  ⚠️ Budget alert: "Dining" is over its monthly limit.<br />
                  Spent 215.00 / 200.00 USD for current month.
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '18px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      showToast('Simulated Discord alert message delivered!', 'success');
                    }}
                    id="test-alert-btn"
                  >
                    <Sparkles size={16} />
                    <span>Send Test Alert Message</span>
                  </button>
                </div>
              </div>

              {/* Active Threshold Breaches */}
              <div className="card">
                <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>
                  Categories Currently Exceeding Limits
                </h4>
                {budgetAlerts.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <CheckCircle size={24} color="var(--success)" style={{ margin: '0 auto 8px' }} />
                    <p>All category expenses are within their monthly budget limits.</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Current Month Spent</th>
                          <th>Monthly Limit</th>
                          <th>Over-Budget By</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {budgetAlerts.map((b) => {
                          const spent = parseFloat(b.current_month_spent);
                          const limit = parseFloat(b.monthly_limit || '0');
                          const diff = spent - limit;

                          return (
                            <tr key={b.id}>
                              <td style={{ fontWeight: 600 }}>{b.name}</td>
                              <td className="amount-cell">{b.current_month_spent} {baseCurrency}</td>
                              <td className="amount-cell">{b.monthly_limit} {baseCurrency}</td>
                              <td style={{ color: 'var(--danger)', fontWeight: 700 }}>
                                +{diff.toFixed(2)} {baseCurrency}
                              </td>
                              <td>
                                <span className="badge badge-danger">Alert Dispatched</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 6: NATIVE MOBILE UI SIMULATOR */}
          {/* ============================================================== */}
          {activeTab === 'mobile' && (
            <div id="mobile-simulator-content" style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
              <div className="mobile-view-wrapper" id="simulated-mobile-phone">
                {/* Notch */}
                <div className="mobile-notch" />

                {/* Mobile Header */}
                <div
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TrendingUp size={18} color="var(--primary-light)" />
                    <strong style={{ fontSize: '15px' }}>SpendWise Mobile</strong>
                  </div>
                  <span className="badge badge-primary">{baseCurrency}</span>
                </div>

                {/* Mobile Scrollable Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                  {/* Mobile KPI Card */}
                  <div
                    className="card"
                    style={{
                      background: 'linear-gradient(135deg, hsla(243, 75%, 59%, 0.25) 0%, hsla(265, 80%, 60%, 0.1) 100%)',
                      border: '1px solid hsla(243, 85%, 68%, 0.3)',
                      marginBottom: '16px',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Month Spending
                    </span>
                    <div style={{ fontSize: '26px', fontWeight: 800, margin: '4px 0', fontFamily: 'var(--font-heading)' }}>
                      {baseCurrency} {totalSpentThisMonth.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--cyan)' }}>
                      {expenses.length} transactions across {categories.length} categories
                    </div>
                  </div>

                  {/* Over budget banner if any */}
                  {budgetAlerts.length > 0 && (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'hsla(350, 89%, 60%, 0.15)',
                        border: '1px solid hsla(350, 89%, 60%, 0.3)',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: 'var(--danger)',
                      }}
                    >
                      <AlertTriangle size={16} />
                      <span>{budgetAlerts[0].name} is over budget limit!</span>
                    </div>
                  )}

                  {/* Mobile Quick Action FAB */}
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', marginBottom: '18px', height: '42px' }}
                    onClick={() => setExpenseModalOpen(true)}
                  >
                    <Plus size={16} /> Record Expense
                  </button>

                  <h5 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>
                    Recent Activity
                  </h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {expenses.slice(0, 5).map((exp) => (
                      <div
                        key={exp.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '13px', display: 'block' }}>{exp.title}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {exp.category_name} • {exp.date}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '13.5px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                            {exp.amount}
                          </span>
                          <span className="currency-tag" style={{ marginLeft: '4px' }}>
                            {exp.currency}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mobile Bottom Navigation Bar */}
                <div className="mobile-bottom-bar">
                  <div className="mobile-nav-btn active">
                    <LayoutDashboard size={18} />
                    <span>Home</span>
                  </div>
                  <div className="mobile-nav-btn" onClick={() => setActiveTab('expenses')}>
                    <Receipt size={18} />
                    <span>Expenses</span>
                  </div>
                  <div className="mobile-nav-btn" onClick={() => setActiveTab('categories')}>
                    <FolderTree size={18} />
                    <span>Limits</span>
                  </div>
                  <div className="mobile-nav-btn" onClick={() => setActiveTab('analytics')}>
                    <PieChartIcon size={18} />
                    <span>Analytics</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
export default App;
