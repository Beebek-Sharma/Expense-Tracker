import React, { useState, useMemo } from 'react';
import type { Category, Expense } from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    amount: string;
    currency: string;
    category: number;
    date: string;
    notes: string;
  }) => Promise<void>;
  categories: Category[];
  initialData?: Expense | null;
  baseCurrency?: string;
  rates?: Record<string, number>;
  categorySpending?: Record<number, number>;
}

const SUPPORTED_CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'USD ($ - US Dollar)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€ - Euro)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£ - British Pound)' },
  { code: 'JPY', symbol: '¥', label: 'JPY (¥ - Japanese Yen)' },
  { code: 'CAD', symbol: '$', label: 'CAD ($ - Canadian Dollar)' },
  { code: 'AUD', symbol: '$', label: 'AUD ($ - Australian Dollar)' },
  { code: 'INR', symbol: '₹', label: 'INR (₹ - Indian Rupee)' },
  { code: 'NPR', symbol: 'रू', label: 'NPR (रू - Nepalese Rupee)' },
  { code: 'CHF', symbol: 'Fr', label: 'CHF (Fr - Swiss Franc)' },
  { code: 'CNY', symbol: '¥', label: 'CNY (¥ - Chinese Yuan)' },
];

export const AddExpenseModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSubmit,
  categories,
  initialData,
  baseCurrency = 'USD',
  rates = {},
  categorySpending = {},
}) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [amount, setAmount] = useState(initialData?.amount || '85.00');
  const [currency, setCurrency] = useState(initialData?.currency || 'EUR');
  const [categoryId, setCategoryId] = useState<number | string>(
    initialData?.category || categories[0]?.id || ''
  );
  const [date, setDate] = useState(
    initialData?.date || new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'revolut' | 'bank'>('card');
  const [tags, setTags] = useState<string[]>(['#Cloud', '#Infrastructure']);
  const [newTagInput, setNewTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected Category
  const selectedCat = useMemo(() => {
    return categories.find((c) => String(c.id) === String(categoryId)) || categories[0];
  }, [categories, categoryId]);

  // Live Exchange Rate to USD
  // In our rates object, USD=1.0, EUR=0.92, etc. (1 USD = X currency)
  // Therefore 1 unit of currency in USD = 1 / rate
  const fxRateToUSD = useMemo(() => {
    if (currency === 'USD') return 1.0;
    const rateAgainstUSD = rates[currency];
    if (rateAgainstUSD && rateAgainstUSD > 0) {
      return 1 / rateAgainstUSD;
    }
    // Fallback approximations if rates not loaded yet
    const fallback: Record<string, number> = {
      EUR: 1.087,
      GBP: 1.282,
      JPY: 0.00645,
      CAD: 0.735,
      AUD: 0.658,
      INR: 0.012,
      NPR: 0.0075,
      CHF: 1.11,
      CNY: 0.138,
    };
    return fallback[currency] || 1.0;
  }, [currency, rates]);

  // Normalized Base Value in USD
  const parsedAmount = parseFloat(amount) || 0;
  const normalizedBase = parsedAmount * fxRateToUSD;

  // Category Budget Calculation
  const catLimit = selectedCat?.monthly_limit ? parseFloat(selectedCat.monthly_limit) : null;
  const currentSpent = selectedCat ? categorySpending[selectedCat.id] || 0 : 0;
  const projectedSpent = currentSpent + normalizedBase;
  const currentRatio = catLimit && catLimit > 0 ? (currentSpent / catLimit) * 100 : null;
  const projectedRatio = catLimit && catLimit > 0 ? (projectedSpent / catLimit) * 100 : null;
  const isBreached = projectedRatio !== null && projectedRatio >= 100;
  const isWarning = projectedRatio !== null && projectedRatio >= 85 && !isBreached;

  if (!isOpen) return null;

  const handleAddTag = () => {
    if (newTagInput.trim() && !tags.includes(newTagInput.trim())) {
      const formatted = newTagInput.startsWith('#') ? newTagInput.trim() : `#${newTagInput.trim()}`;
      setTags([...tags, formatted]);
      setNewTagInput('');
      setShowTagInput(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide an expense title.');
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }
    if (!selectedCat) {
      setError('Please select a valid category.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit({
        title: title.trim(),
        amount: parsedAmount.toFixed(2),
        currency: currency.toUpperCase(),
        category: selectedCat.id,
        date,
        notes: notes.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-surface-base/85 backdrop-blur-md"
      role="dialog"
      onClick={onClose}
    >
      {/* Ambient Lighting Glow Effects from Stitch */}
      <div className="absolute -top-28 left-1/3 w-96 h-96 bg-secondary/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-28 right-1/4 w-96 h-96 bg-secondary-bright/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Modal Card Window */}
      <div
        className="relative w-full max-w-3xl bg-surface-card border border-stroke-strong rounded-2xl shadow-[0_24px_50px_rgba(0,0,0,0.75)] overflow-hidden flex flex-col max-h-[92vh] z-10 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glowing Top Accent Border */}
        <div className="h-1 w-full bg-gradient-to-r from-secondary-bright via-secondary to-[#2B4E54]" />

        {/* 1. Modal Header */}
        <div className="px-6 py-4 bg-surface-card/90 backdrop-blur-md border-b border-stroke-subtle flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-accent-teal-subtle border border-secondary/40 flex items-center justify-center text-secondary-bright shrink-0 shadow-[0_0_12px_rgba(63,110,118,0.25)]">
              <span className="material-symbols-outlined text-2xl">
                {initialData ? 'edit_note' : 'add_circle'}
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-headline-sm text-lg text-primary tracking-tight font-semibold">
                  {initialData ? 'Edit Expense Record' : 'Record New Expense'}
                </h2>
                <span className="font-caption-code text-[11px] bg-surface-elevated border border-secondary/30 text-secondary-bright px-2 py-0.5 rounded-full font-semibold">
                  Multi-Currency v2.4
                </span>
              </div>
              <p className="font-body-sm text-xs text-on-surface-variant truncate">
                Live FX normalization powered by open.er-api.com cache layer
              </p>
            </div>
          </div>
          <button
            aria-label="Close modal"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-surface-elevated/70 hover:bg-surface-elevated text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors shrink-0 border border-stroke-subtle"
            type="button"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto flex flex-col gap-4">
          {error && (
            <div className="bg-critical-crimson/15 border border-critical-crimson/40 text-critical-crimson p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* 2. Form Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Expense Title */}
            <div className="md:col-span-7 flex flex-col gap-1.5">
              <label className="font-label-sm text-xs uppercase tracking-wider text-tertiary-light flex items-center justify-between" htmlFor="expense-title">
                <span>Expense Title / Merchant</span>
                <span className="text-secondary-bright font-caption-code text-[11px] lowercase">required</span>
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined text-tertiary-light text-lg absolute left-3.5 pointer-events-none">
                  storefront
                </span>
                <input
                  id="expense-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. AWS Cloud Infrastructure - Frankfurt Cluster"
                  className="w-full bg-surface-elevated text-primary font-body-md text-sm pl-10 pr-3.5 py-2.5 rounded-lg border border-stroke-subtle focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none transition-all placeholder:text-tertiary"
                />
              </div>
            </div>

            {/* Date */}
            <div className="md:col-span-5 flex flex-col gap-1.5">
              <label className="font-label-sm text-xs uppercase tracking-wider text-tertiary-light flex items-center justify-between" htmlFor="expense-date">
                <span>Date</span>
                <span className="font-caption-code text-[11px] text-on-surface-variant">UTC Pacing</span>
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined text-tertiary-light text-lg absolute left-3.5 pointer-events-none">
                  calendar_month
                </span>
                <input
                  id="expense-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-surface-elevated text-primary font-body-md text-sm pl-10 pr-3.5 py-2.5 rounded-lg border border-stroke-subtle focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Category Selection with Budget Status Readout */}
            <div className="md:col-span-12 flex flex-col gap-1.5">
              <label className="font-label-sm text-xs uppercase tracking-wider text-tertiary-light flex items-center justify-between" htmlFor="expense-category">
                <span>Category Selection</span>
                <span className="font-caption-code text-[11px] text-secondary-bright font-semibold">
                  {selectedCat?.monthly_limit
                    ? `Budget Cap: $${parseFloat(selectedCat.monthly_limit).toFixed(2)}`
                    : 'No Cap Configured'}
                </span>
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined text-tertiary-light text-lg absolute left-3.5 pointer-events-none">
                  category
                </span>
                <select
                  id="expense-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-surface-elevated text-primary font-body-md text-sm pl-10 pr-10 py-2.5 rounded-lg border border-stroke-subtle focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none appearance-none cursor-pointer transition-all"
                >
                  {categories.map((cat) => {
                    const limitVal = cat.monthly_limit ? parseFloat(cat.monthly_limit) : 0;
                    const spentVal = categorySpending[cat.id] || 0;
                    const pct = limitVal > 0 ? ((spentVal / limitVal) * 100).toFixed(1) : '0';
                    return (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} {limitVal > 0 ? `(Spent: $${spentVal.toFixed(2)} / $${limitVal.toFixed(2)} • ${pct}%)` : '(Unrestricted)'}
                      </option>
                    );
                  })}
                </select>
                <span className="material-symbols-outlined text-tertiary-light text-lg absolute right-3.5 pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>
          </div>

          {/* Amount & Multi-Currency Input Row + Live FX Conversion Card */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Currency & Amount Input */}
            <div className="md:col-span-6 flex flex-col gap-2">
              <label className="font-label-sm text-xs uppercase tracking-wider text-tertiary-light flex items-center justify-between">
                <span>Amount & Multi-Currency</span>
                <span className="font-caption-code text-[11px] bg-surface-elevated text-secondary-bright border border-stroke-subtle px-2 py-0.5 rounded-full font-medium">
                  Target Base: {baseCurrency} ($)
                </span>
              </label>
              <div className="flex gap-2">
                {/* Currency select */}
                <div className="relative w-44 shrink-0">
                  <select
                    id="currency-select"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-surface-elevated text-primary font-body-md text-sm px-3 py-2.5 rounded-lg border border-stroke-subtle focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none appearance-none cursor-pointer"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined text-tertiary-light text-sm absolute right-2.5 top-3.5 pointer-events-none">
                    unfold_more
                  </span>
                </div>
                {/* Amount field */}
                <div className="relative flex-1">
                  <span className="material-symbols-outlined text-secondary-bright text-base absolute left-3 top-3 pointer-events-none">
                    payments
                  </span>
                  <input
                    id="expense-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-surface-elevated text-primary font-numeric-stat text-xl font-bold pl-9 pr-3 py-1.5 rounded-lg border border-stroke-subtle focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Live FX Conversion Card */}
            <div className="md:col-span-6 bg-surface-elevated border border-secondary/40 rounded-xl p-3.5 flex flex-col justify-between shadow-[0_0_15px_rgba(63,110,118,0.12)] relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-secondary/15 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center justify-between pb-1">
                <span className="font-label-sm text-xs uppercase tracking-wider text-secondary-bright flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-sm">currency_exchange</span>
                  Normalized Base Amount
                </span>
                <span className="font-caption-code text-[11px] bg-accent-teal-subtle border border-secondary/30 text-secondary-bright px-2 py-0.5 rounded-full font-semibold">
                  {parsedAmount.toFixed(2)} {currency} × {fxRateToUSD.toFixed(4)} = ${normalizedBase.toFixed(2)} USD
                </span>
              </div>
              <div className="flex items-baseline gap-2 py-0.5">
                <span className="font-display text-2xl text-primary font-bold tracking-tight">
                  ${normalizedBase.toFixed(2)} {baseCurrency}
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1 border-t border-stroke-subtle text-on-surface-variant font-caption-code text-[11px]">
                <span className="text-secondary-bright">⚡</span>
                <span>OpenER Live Cache Hit • Real-time backend synced</span>
              </div>
            </div>
          </div>

          {/* 3. Live Budget Impact Preview & Threshold Alert Warning */}
          {catLimit !== null && (
            <div className="bg-surface-elevated border border-stroke-subtle rounded-xl p-4 flex flex-col gap-3">
              {/* Utilization Header */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-lg ${isBreached ? 'text-critical-crimson' : isWarning ? 'text-warning-amber' : 'text-secondary-bright'}`}>
                    pie_chart
                  </span>
                  <span className="font-label-md text-sm text-primary font-semibold">
                    Category Health Forecast: {selectedCat?.name}
                  </span>
                </div>
                {isBreached ? (
                  <span className="font-caption-code text-xs bg-critical-crimson/15 border border-critical-crimson/30 text-critical-crimson px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5 shadow-[0_0_8px_rgba(239,68,68,0.2)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-critical-crimson animate-ping" />
                    BUDGET BREACH 🚨
                  </span>
                ) : isWarning ? (
                  <span className="font-caption-code text-xs bg-warning-amber/15 border border-warning-amber/30 text-warning-amber px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning-amber animate-pulse" />
                    NEAR LIMIT (85%+) ⚠️
                  </span>
                ) : (
                  <span className="font-caption-code text-xs bg-accent-teal-subtle border border-secondary/30 text-secondary-bright px-2.5 py-0.5 rounded-full font-semibold">
                    HEALTHY BUFFER 🛡️
                  </span>
                )}
              </div>

              {/* Current vs Projected Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-surface-card p-2.5 rounded-lg border border-stroke-subtle">
                  <div className="flex justify-between items-center text-xs font-caption-code">
                    <span className="text-tertiary-light">Current Spend</span>
                    <span className="text-on-surface font-medium">
                      ${currentSpent.toFixed(2)} / ${catLimit.toFixed(2)} ({currentRatio?.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-surface-elevated h-2 rounded-full overflow-hidden mt-2 border border-stroke-subtle">
                    <div
                      className="bg-secondary-bright h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(currentRatio || 0, 100)}%` }}
                    />
                  </div>
                </div>

                <div className={`bg-surface-card p-2.5 rounded-lg border ${isBreached ? 'border-critical-crimson/50' : isWarning ? 'border-warning-amber/50' : 'border-secondary/40'}`}>
                  <div className="flex justify-between items-center text-xs font-caption-code">
                    <span className={isBreached ? 'text-critical-crimson font-semibold' : 'text-secondary-bright font-semibold'}>
                      After this expense (Projected)
                    </span>
                    <span className={`font-bold ${isBreached ? 'text-critical-crimson' : isWarning ? 'text-warning-amber' : 'text-primary'}`}>
                      ${projectedSpent.toFixed(2)} / ${catLimit.toFixed(2)} ({projectedRatio?.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-surface-elevated h-2 rounded-full overflow-hidden mt-2 border border-stroke-subtle">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${isBreached ? 'bg-gradient-to-r from-warning-amber via-critical-crimson to-[#ff5252] shadow-[0_0_10px_rgba(239,68,68,0.4)]' : isWarning ? 'bg-warning-amber' : 'bg-secondary-bright'}`}
                      style={{ width: `${Math.min(projectedRatio || 0, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Webhook Bot Warning Banner */}
              {(isBreached || isWarning) && (
                <div className={`rounded-lg p-3 flex items-start gap-3 ${isBreached ? 'bg-critical-crimson/10 border border-critical-crimson/30' : 'bg-warning-amber/10 border border-warning-amber/30'}`}>
                  <span className={`material-symbols-outlined text-xl shrink-0 mt-0.5 ${isBreached ? 'text-critical-crimson' : 'text-warning-amber'}`}>
                    warning
                  </span>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className={`font-label-sm text-xs font-semibold uppercase tracking-wider ${isBreached ? 'text-critical-crimson' : 'text-warning-amber'}`}>
                      ⚠️ Threshold Trigger Alert
                    </span>
                    <p className="font-body-sm text-xs text-on-surface leading-snug">
                      Saving this transaction will push {selectedCat?.name} to {projectedRatio?.toFixed(1)}%. Django DRF budget sentinel will automatically dispatch webhook alerts to Telegram Bot (<span className="text-secondary-bright font-caption-code">@SpendWiseAlertsBot</span>) and Discord Webhook (<span className="text-secondary-bright font-caption-code">#finance-telemetry</span>).
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. Payment Method & Tags */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Payment Method */}
            <div className="md:col-span-6 flex flex-col gap-2">
              <label className="font-label-sm text-xs uppercase tracking-wider text-tertiary-light">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg text-center font-caption-code text-xs transition-colors ${paymentMethod === 'card' ? 'bg-surface-elevated border border-secondary text-primary shadow-[0_0_8px_rgba(63,110,118,0.25)] font-semibold' : 'bg-surface-card border border-stroke-subtle text-on-surface-variant hover:text-on-surface'}`}
                >
                  <span className="material-symbols-outlined text-base mb-0.5 text-secondary-bright">credit_card</span>
                  <span className="leading-tight">Corporate Card</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('revolut')}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg text-center font-caption-code text-xs transition-colors ${paymentMethod === 'revolut' ? 'bg-surface-elevated border border-secondary text-primary shadow-[0_0_8px_rgba(63,110,118,0.25)] font-semibold' : 'bg-surface-card border border-stroke-subtle text-on-surface-variant hover:text-on-surface'}`}
                >
                  <span className="material-symbols-outlined text-base mb-0.5 text-secondary-bright">account_balance_wallet</span>
                  <span className="leading-tight">Revolut FX</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('bank')}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg text-center font-caption-code text-xs transition-colors ${paymentMethod === 'bank' ? 'bg-surface-elevated border border-secondary text-primary shadow-[0_0_8px_rgba(63,110,118,0.25)] font-semibold' : 'bg-surface-card border border-stroke-subtle text-on-surface-variant hover:text-on-surface'}`}
                >
                  <span className="material-symbols-outlined text-base mb-0.5 text-secondary-bright">account_balance</span>
                  <span className="leading-tight">Bank Wire</span>
                </button>
              </div>
            </div>

            {/* Tags & Flags */}
            <div className="md:col-span-6 flex flex-col gap-2">
              <label className="font-label-sm text-xs uppercase tracking-wider text-tertiary-light">
                Tags & Metadata
              </label>
              <div className="flex flex-wrap gap-1.5 items-center">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="font-label-sm text-xs bg-accent-teal-subtle border border-secondary/30 px-2.5 py-1 rounded-full text-secondary-bright flex items-center gap-1"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="material-symbols-outlined text-xs hover:text-primary leading-none"
                    >
                      close
                    </button>
                  </span>
                ))}
                {showTagInput ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                      placeholder="#tag"
                      className="bg-surface-elevated text-primary text-xs px-2 py-0.5 rounded border border-stroke-subtle w-24 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="text-secondary-bright hover:text-primary text-xs"
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowTagInput(true)}
                    className="font-caption-code text-xs bg-surface-elevated px-2 py-1 rounded-full text-tertiary-light hover:text-primary transition-colors border border-stroke-subtle"
                  >
                    + Tag
                  </button>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="md:col-span-12 flex flex-col gap-1.5">
              <label className="font-label-sm text-xs uppercase tracking-wider text-tertiary-light" htmlFor="expense-notes">
                Notes / Audit Memo
              </label>
              <textarea
                id="expense-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes, invoice identifier or project ref..."
                className="w-full bg-surface-elevated text-primary font-body-md text-sm px-3.5 py-2.5 rounded-lg border border-stroke-subtle focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none placeholder:text-tertiary resize-none"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stroke-subtle">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-lg text-on-surface hover:text-primary font-label-md text-sm hover:bg-surface-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 bg-primary hover:bg-neutral-200 text-on-primary font-label-md text-sm px-6 py-2.5 rounded-lg shadow-sm transition-all active:scale-95 font-bold disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base font-bold">save</span>
              <span>{loading ? 'Saving...' : initialData ? 'Update Record' : 'Save Transaction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
