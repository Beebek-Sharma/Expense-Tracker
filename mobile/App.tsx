import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { theme } from './src/theme';
import { mobileApi } from './src/services/api';
import type { Category, Expense, AnalyticsData, User } from './src/types';

type Tab = 'dashboard' | 'expenses' | 'categories' | 'analytics';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [authUsername, setAuthUsername] = useState('demo_user');
  const [authPassword, setAuthPassword] = useState('demopass123');

  // App Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<number | null>(null);

  // Add Expense Modal
  const [addExpenseVisible, setAddExpenseVisible] = useState(false);
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCurrency, setExpCurrency] = useState('USD');
  const [expCategoryId, setExpCategoryId] = useState<number | null>(null);
  const [expNotes, setExpNotes] = useState('');

  // Add Category Modal
  const [addCatVisible, setAddCatVisible] = useState(false);
  const [catName, setCatName] = useState('');
  const [catLimit, setCatLimit] = useState('');

  const colors = theme.dark;

  useEffect(() => {
    // Attempt auto-login with demo user or show login
    handleDemoLogin();
  }, []);

  const handleDemoLogin = async () => {
    try {
      setLoading(true);
      try {
        const res = await mobileApi.login('demo_user', 'demopass123');
        setCurrentUser(res.user);
      } catch {
        const res = await mobileApi.register('demo_user', 'demopass123', 'demo@spendwise.app');
        setCurrentUser(res.user);
      }
      await refreshData();
    } catch {
      setAuthModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSubmit = async () => {
    if (!authUsername || !authPassword) {
      Alert.alert('Error', 'Please enter username and password');
      return;
    }
    try {
      setLoading(true);
      if (isRegister) {
        const res = await mobileApi.register(authUsername, authPassword);
        setCurrentUser(res.user);
      } else {
        const res = await mobileApi.login(authUsername, authPassword);
        setCurrentUser(res.user);
      }
      setAuthModalVisible(false);
      await refreshData();
    } catch (err: any) {
      Alert.alert('Authentication Failed', err.message || 'Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      const [cats, exps, anal] = await Promise.all([
        mobileApi.getCategories().catch(() => []),
        mobileApi.getExpenses().catch(() => []),
        mobileApi.getAnalytics().catch(() => null),
      ]);
      setCategories(cats);
      setExpenses(exps);
      if (anal) setAnalytics(anal);
      if (cats.length > 0 && !expCategoryId) {
        setExpCategoryId(cats[0].id);
      }
    } catch (err) {
      console.warn('Failed to refresh data', err);
    }
  };

  const handleCreateExpense = async () => {
    if (!expTitle.trim() || !expAmount || !expCategoryId) {
      Alert.alert('Validation Error', 'Title, amount, and category are required.');
      return;
    }

    try {
      await mobileApi.createExpense({
        title: expTitle.trim(),
        amount: expAmount,
        currency: expCurrency,
        category: expCategoryId,
        date: new Date().toISOString().split('T')[0],
        notes: expNotes,
      });

      setAddExpenseVisible(false);
      setExpTitle('');
      setExpAmount('');
      setExpNotes('');
      Alert.alert('Success', 'Expense recorded successfully!');
      refreshData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not record expense.');
    }
  };

  const handleCreateCategory = async () => {
    if (!catName.trim()) {
      Alert.alert('Validation Error', 'Category name is required.');
      return;
    }

    try {
      await mobileApi.createCategory({
        name: catName.trim(),
        monthly_limit: catLimit ? catLimit : null,
      });
      setAddCatVisible(false);
      setCatName('');
      setCatLimit('');
      Alert.alert('Success', 'Category created with monthly limit!');
      refreshData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not create category.');
    }
  };

  const handleDeleteExpense = (id: number) => {
    Alert.alert('Delete Expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await mobileApi.deleteExpense(id);
          refreshData();
        },
      },
    ]);
  };

  const baseCurrency = analytics?.base_currency || 'USD';
  const overBudgetCategories = analytics?.categories.filter((c) => c.is_over_budget) || [];

  const filteredExpenses = expenses.filter((e) => {
    const matchSearch = !searchQuery || e.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = filterCategory === null || e.category === filterCategory;
    return matchSearch && matchCat;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar style="light" />

      {/* Mobile App Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.appName, { color: colors.primaryLight }]}>SpendWise</Text>
          <Text style={[styles.userGreeting, { color: colors.textSecondary }]}>
            {currentUser ? `Hi, ${currentUser.username}` : 'Personal Finances'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.currencyBadge, { backgroundColor: colors.primaryGlow }]}>
            <Text style={[styles.currencyText, { color: colors.primaryLight }]}>{baseCurrency}</Text>
          </View>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => setAddExpenseVisible(true)}
            accessibilityLabel="Add expense"
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Budget Alert Banner */}
        {overBudgetCategories.length > 0 && (
          <View style={[styles.alertBanner, { backgroundColor: colors.dangerGlow, borderColor: colors.danger }]}>
            <Text style={[styles.alertTitle, { color: colors.danger }]}>⚠️ Budget Limit Exceeded</Text>
            <Text style={[styles.alertSubtitle, { color: colors.textPrimary }]}>
              {overBudgetCategories[0].name} has spent {overBudgetCategories[0].current_month_spent} /{' '}
              {overBudgetCategories[0].monthly_limit} {baseCurrency}! Bot alert dispatched.
            </Text>
          </View>
        )}

        {/* ============================================================== */}
        {/* TAB: DASHBOARD */}
        {/* ============================================================== */}
        {activeTab === 'dashboard' && (
          <View>
            {/* Total Spending KPI Card */}
            <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>MONTHLY SPENDING (CONVERTED)</Text>
              <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>
                {baseCurrency} {analytics?.total_spent_base || '0.00'}
              </Text>
              <View style={styles.kpiFooter}>
                <Text style={[styles.kpiSub, { color: colors.cyan }]}>
                  {expenses.length} expenses recorded
                </Text>
                <Text style={[styles.kpiSub, { color: colors.success }]}>
                  {categories.length} budget categories
                </Text>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setAddExpenseVisible(true)}
              >
                <Text style={[styles.actionBtnText, { color: colors.primaryLight }]}>+ Record Expense</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setAddCatVisible(true)}
              >
                <Text style={[styles.actionBtnText, { color: colors.cyan }]}>+ New Budget</Text>
              </TouchableOpacity>
            </View>

            {/* Category Budgets Overview */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Category Budgets</Text>
            {categories.map((cat) => {
              const catAnalytics = analytics?.categories.find((c) => c.id === cat.id);
              const spent = catAnalytics ? parseFloat(catAnalytics.current_month_spent) : 0;
              const limit = cat.monthly_limit ? parseFloat(cat.monthly_limit) : 0;
              const ratio = limit > 0 ? (spent / limit) * 100 : 0;
              const isOver = limit > 0 && spent > limit;

              return (
                <View
                  key={cat.id}
                  style={[styles.categoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.catHeader}>
                    <Text style={[styles.catName, { color: colors.textPrimary }]}>{cat.name}</Text>
                    <Text
                      style={[
                        styles.catAmount,
                        { color: isOver ? colors.danger : colors.textPrimary },
                      ]}
                    >
                      {spent.toFixed(2)} {baseCurrency} {limit > 0 ? `/ ${limit.toFixed(2)}` : ''}
                    </Text>
                  </View>
                  {limit > 0 && (
                    <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(ratio, 100)}%`,
                            backgroundColor: isOver ? colors.danger : ratio > 80 ? colors.warning : colors.success,
                          },
                        ]}
                      />
                    </View>
                  )}
                </View>
              );
            })}

            {/* Recent Expenses List */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 24 }]}>
              Recent Transactions
            </Text>
            {expenses.slice(0, 5).map((exp) => (
              <View
                key={exp.id}
                style={[styles.expenseItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View>
                  <Text style={[styles.expTitle, { color: colors.textPrimary }]}>{exp.title}</Text>
                  <Text style={[styles.expMeta, { color: colors.textMuted }]}>
                    {exp.category_name} • {exp.date}
                  </Text>
                </View>
                <View style={styles.expRight}>
                  <Text style={[styles.expAmount, { color: colors.textPrimary }]}>
                    {exp.amount} <Text style={{ color: colors.primaryLight }}>{exp.currency}</Text>
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ============================================================== */}
        {/* TAB: EXPENSES */}
        {/* ============================================================== */}
        {activeTab === 'expenses' && (
          <View>
            <TextInput
              style={[styles.searchInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="Search expenses by title..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            {/* Category Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              <TouchableOpacity
                style={[
                  styles.chip,
                  filterCategory === null && { backgroundColor: colors.primary },
                  { borderColor: colors.border },
                ]}
                onPress={() => setFilterCategory(null)}
              >
                <Text style={styles.chipText}>All</Text>
              </TouchableOpacity>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.chip,
                    filterCategory === c.id && { backgroundColor: colors.primary },
                    { borderColor: colors.border },
                  ]}
                  onPress={() => setFilterCategory(c.id)}
                >
                  <Text style={styles.chipText}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {filteredExpenses.map((exp) => (
              <View
                key={exp.id}
                style={[styles.expenseItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.expTitle, { color: colors.textPrimary }]}>{exp.title}</Text>
                  <Text style={[styles.expMeta, { color: colors.textMuted }]}>
                    {exp.category_name} • {exp.date}
                  </Text>
                  {exp.notes ? (
                    <Text style={[styles.expNotes, { color: colors.textSecondary }]}>{exp.notes}</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={[styles.expAmount, { color: colors.textPrimary }]}>
                    {exp.amount} <Text style={{ color: colors.primaryLight }}>{exp.currency}</Text>
                  </Text>
                  <TouchableOpacity onPress={() => handleDeleteExpense(exp.id)}>
                    <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '600' }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ============================================================== */}
        {/* TAB: CATEGORIES */}
        {/* ============================================================== */}
        {activeTab === 'categories' && (
          <View>
            <TouchableOpacity
              style={[styles.createCatBtn, { backgroundColor: colors.primary }]}
              onPress={() => setAddCatVisible(true)}
            >
              <Text style={styles.createCatBtnText}>+ Create New Category</Text>
            </TouchableOpacity>

            {categories.map((cat) => {
              const catAnalytics = analytics?.categories.find((c) => c.id === cat.id);
              const spent = catAnalytics ? parseFloat(catAnalytics.current_month_spent) : 0;
              const limit = cat.monthly_limit ? parseFloat(cat.monthly_limit) : 0;
              const ratio = limit > 0 ? (spent / limit) * 100 : 0;
              const isOver = limit > 0 && spent > limit;

              return (
                <View
                  key={cat.id}
                  style={[styles.categoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.catHeader}>
                    <View>
                      <Text style={[styles.catName, { color: colors.textPrimary }]}>{cat.name}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                        {cat.description || 'Monthly budget threshold'}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.catAmount,
                        { color: isOver ? colors.danger : colors.textPrimary },
                      ]}
                    >
                      {spent.toFixed(2)} {baseCurrency}
                    </Text>
                  </View>

                  {limit > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(ratio, 100)}%`,
                              backgroundColor: isOver ? colors.danger : ratio > 80 ? colors.warning : colors.success,
                            },
                          ]}
                        />
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                        <Text style={{ fontSize: 11, color: colors.textMuted }}>
                          Limit: {limit.toFixed(2)} {baseCurrency}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: isOver ? colors.danger : colors.success,
                          }}
                        >
                          {ratio.toFixed(0)}% Used
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ============================================================== */}
        {/* TAB: ANALYTICS */}
        {/* ============================================================== */}
        {activeTab === 'analytics' && (
          <View>
            <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>MULTI-CURRENCY SYSTEM</Text>
              <Text style={[styles.kpiValue, { color: colors.primaryLight, fontSize: 20 }]}>
                Live Exchange Rate Conversion
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8 }}>
                Every transaction entered in foreign currencies (EUR, GBP, JPY, NPR, etc.) is seamlessly converted to {baseCurrency} for summary accounting and monthly budget thresholds.
              </Text>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 20 }]}>
              Monthly Spending Trends
            </Text>
            {analytics?.monthly_trends.map((trend) => (
              <View
                key={trend.month}
                style={[
                  styles.expenseItem,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{trend.month}</Text>
                <Text style={{ color: colors.cyan, fontWeight: '700' }}>
                  {trend.amount} {baseCurrency}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Mobile Bottom Tab Navigation */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('dashboard')}
          accessibilityLabel="Dashboard tab"
        >
          <Text style={[styles.tabLabel, activeTab === 'dashboard' && { color: colors.primaryLight, fontWeight: '700' }]}>
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('expenses')}
          accessibilityLabel="Expenses tab"
        >
          <Text style={[styles.tabLabel, activeTab === 'expenses' && { color: colors.primaryLight, fontWeight: '700' }]}>
            Expenses
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('categories')}
          accessibilityLabel="Budgets tab"
        >
          <Text style={[styles.tabLabel, activeTab === 'categories' && { color: colors.primaryLight, fontWeight: '700' }]}>
            Budgets
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('analytics')}
          accessibilityLabel="Analytics tab"
        >
          <Text style={[styles.tabLabel, activeTab === 'analytics' && { color: colors.primaryLight, fontWeight: '700' }]}>
            Analytics
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal: Add Expense */}
      <Modal visible={addExpenseVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Record New Expense</Text>

            <TextInput
              style={[styles.input, { backgroundColor: colors.cardElevated, color: colors.textPrimary }]}
              placeholder="Title (e.g. Flight, Dinner, AWS)"
              placeholderTextColor={colors.textMuted}
              value={expTitle}
              onChangeText={setExpTitle}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                style={[styles.input, { flex: 2, backgroundColor: colors.cardElevated, color: colors.textPrimary }]}
                placeholder="Amount (e.g. 45.00)"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={expAmount}
                onChangeText={setExpAmount}
              />
              <TextInput
                style={[styles.input, { flex: 1, backgroundColor: colors.cardElevated, color: colors.textPrimary }]}
                placeholder="USD"
                placeholderTextColor={colors.textMuted}
                value={expCurrency}
                onChangeText={setExpCurrency}
                autoCapitalize="characters"
              />
            </View>

            {/* Category Select Chips */}
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>Select Category:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.chip,
                    expCategoryId === c.id && { backgroundColor: colors.primary },
                    { borderColor: colors.border },
                  ]}
                  onPress={() => setExpCategoryId(c.id)}
                >
                  <Text style={styles.chipText}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={[styles.input, { backgroundColor: colors.cardElevated, color: colors.textPrimary }]}
              placeholder="Notes (optional)"
              placeholderTextColor={colors.textMuted}
              value={expNotes}
              onChangeText={setExpNotes}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setAddExpenseVisible(false)}>
                <Text style={{ color: colors.textMuted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, { backgroundColor: colors.primary }]}
                onPress={handleCreateExpense}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Save Expense</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Add Category */}
      <Modal visible={addCatVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Create Category Budget</Text>

            <TextInput
              style={[styles.input, { backgroundColor: colors.cardElevated, color: colors.textPrimary }]}
              placeholder="Category Name (e.g. Groceries)"
              placeholderTextColor={colors.textMuted}
              value={catName}
              onChangeText={setCatName}
            />

            <TextInput
              style={[styles.input, { backgroundColor: colors.cardElevated, color: colors.textPrimary }]}
              placeholder="Monthly Budget Limit in USD (e.g. 200.00)"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={catLimit}
              onChangeText={setCatLimit}
            />

            <Text style={{ fontSize: 11, color: colors.warning, marginBottom: 14 }}>
              When expenses exceed this limit, an automated bot alert is dispatched.
            </Text>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setAddCatVisible(false)}>
                <Text style={{ color: colors.textMuted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, { backgroundColor: colors.primary }]}
                onPress={handleCreateCategory}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Create Category</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Auth */}
      <Modal visible={authModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {isRegister ? 'Register Account' : 'Sign In to SpendWise'}
            </Text>

            <TextInput
              style={[styles.input, { backgroundColor: colors.cardElevated, color: colors.textPrimary }]}
              placeholder="Username"
              placeholderTextColor={colors.textMuted}
              value={authUsername}
              onChangeText={setAuthUsername}
            />

            <TextInput
              style={[styles.input, { backgroundColor: colors.cardElevated, color: colors.textPrimary }]}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={authPassword}
              onChangeText={setAuthPassword}
            />

            <TouchableOpacity
              style={[styles.modalConfirm, { backgroundColor: colors.primary, marginTop: 10 }]}
              onPress={handleAuthSubmit}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                {isRegister ? 'Register' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: 16, alignItems: 'center' }}
              onPress={() => setIsRegister(!isRegister)}
            >
              <Text style={{ color: colors.primaryLight, fontSize: 13 }}>
                {isRegister ? 'Already have an account? Sign In' : 'Need an account? Register'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  appName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  userGreeting: {
    fontSize: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  currencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  currencyText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  alertBanner: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  alertSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  kpiCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 30,
    fontWeight: '800',
    marginVertical: 6,
  },
  kpiFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 12,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  categoryCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catName: {
    fontSize: 14,
    fontWeight: '700',
  },
  catAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  expenseItem: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  expMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  expNotes: {
    fontSize: 12,
    marginTop: 4,
  },
  expRight: {
    alignItems: 'flex-end',
  },
  expAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  searchInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    marginBottom: 12,
  },
  chipsScroll: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  createCatBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  createCatBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 8,
  },
  tabItem: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    padding: 22,
    borderRadius: 20,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
    fontSize: 14,
  },
  modalBtns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
  },
  modalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalConfirm: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
});
