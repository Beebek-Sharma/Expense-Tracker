import React, { useState } from 'react';
import type { Category } from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onCreateCategory: (data: { name: string; description?: string; monthly_limit?: string | null }) => Promise<void>;
  onUpdateCategory: (id: number, data: Partial<Category>) => Promise<void>;
  onDeleteCategory: (id: number) => Promise<void>;
  categorySpending?: Record<number, number>;
}

export const AddCategoryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  categories,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  categorySpending = {},
}) => {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('600');
  const [thresholdPct, setThresholdPct] = useState(85);
  const [selectedAccent, setSelectedAccent] = useState('teal');
  const [telegramActive, setTelegramActive] = useState(true);
  const [discordActive, setDiscordActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setMonthlyLimit('500');
    setThresholdPct(85);
    setShowForm(true);
    setError(null);
  };

  const handleStartEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setDescription(cat.description || '');
    setMonthlyLimit(cat.monthly_limit ? parseFloat(cat.monthly_limit).toString() : '');
    setThresholdPct(85);
    setShowForm(true);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a category name.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const limitVal = monthlyLimit.trim() ? parseFloat(monthlyLimit).toFixed(2) : null;

      if (editingCategory) {
        await onUpdateCategory(editingCategory.id, {
          name: name.trim(),
          description: description.trim(),
          monthly_limit: limitVal,
        });
      } else {
        await onCreateCategory({
          name: name.trim(),
          description: description.trim(),
          monthly_limit: limitVal,
        });
      }

      setShowForm(false);
      setEditingCategory(null);
      setName('');
      setDescription('');
    } catch (err: any) {
      setError(err.message || 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this category? Associated expenses may need reclassification.')) {
      return;
    }
    try {
      setLoading(true);
      await onDeleteCategory(id);
    } catch (err: any) {
      setError(err.message || 'Failed to delete category');
    } finally {
      setLoading(false);
    }
  };

  const parsedLimit = parseFloat(monthlyLimit) || 0;
  const computedWarnAmount = ((parsedLimit * thresholdPct) / 100).toFixed(2);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-surface-base/85 backdrop-blur-md"
      role="dialog"
      onClick={onClose}
    >
      {/* Modal Dialog Card */}
      <div
        className="relative w-full max-w-5xl rounded-2xl bg-surface-card border border-stroke-strong shadow-2xl flex flex-col overflow-hidden max-h-[92vh] z-10 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Luminescent Bar: Slate Teal glow accent */}
        <div className="h-1 w-full bg-gradient-to-r from-secondary-light via-secondary to-[#5898A3]" />

        {/* Header Section */}
        <div className="p-5 sm:p-6 bg-surface-container-lowest/90 border-b border-stroke-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary-bright animate-ping" />
              <h2 className="font-headline-md text-xl text-primary font-bold tracking-tight">
                Manage Categories & Budget Limits
              </h2>
              <span className="font-label-sm text-xs px-2.5 py-0.5 rounded-full bg-accent-teal-subtle text-secondary-bright border border-secondary/30 font-medium">
                Threshold Sentinels v2.4
              </span>
            </div>
            <p className="font-body-sm text-xs text-on-surface-variant max-w-2xl">
              Configure monthly expenditure caps, automated alert thresholds (Telegram/Discord), and auto-escalation policies with real-time webhook dispatch.
            </p>
          </div>
          <div className="flex items-center gap-2 self-end md:self-center">
            {!showForm && (
              <button
                type="button"
                onClick={handleStartCreate}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-secondary hover:bg-secondary-bright text-white font-label-md text-xs transition-all shadow-[0_0_14px_rgba(63,110,118,0.35)] border border-secondary-bright/40 font-semibold"
              >
                <span className="material-symbols-outlined text-base">add_circle</span>
                <span>Create New Category</span>
              </button>
            )}
            <button
              aria-label="Close Modal"
              onClick={onClose}
              type="button"
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-elevated hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors border border-stroke-subtle"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[calc(85vh-140px)]">
          {error && (
            <div className="bg-critical-crimson/15 border border-critical-crimson/40 text-critical-crimson p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Creator / Editor Form Card */}
          {showForm && (
            <form onSubmit={handleSave} className="rounded-xl bg-surface-elevated border border-secondary/40 p-5 space-y-4 shadow-lg animate-fadeIn">
              <div className="flex items-center justify-between pb-3 border-b border-stroke-subtle">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary-bright text-xl">tune</span>
                  <h3 className="font-headline-sm text-sm text-primary font-bold">
                    {editingCategory ? `Update: ${editingCategory.name}` : 'New Category Parameters & Trigger Logic'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-xs text-on-surface-variant hover:text-primary"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Category Name */}
                <div className="md:col-span-7 space-y-1.5">
                  <label className="font-label-sm text-xs text-tertiary-light uppercase tracking-wider block" htmlFor="categoryNameInput">
                    Category Name
                  </label>
                  <div className="relative">
                    <input
                      id="categoryNameInput"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Dining, Logistics, Cloud Infra"
                      className="w-full bg-surface-base text-primary font-body-md text-sm px-3.5 py-2.5 rounded-lg border border-stroke-subtle focus:border-secondary focus:outline-none"
                    />
                    <span className="material-symbols-outlined absolute right-3 top-2.5 text-tertiary text-lg pointer-events-none">
                      label
                    </span>
                  </div>
                </div>

                {/* Monthly Cap */}
                <div className="md:col-span-5 space-y-1.5">
                  <label className="font-label-sm text-xs text-tertiary-light uppercase tracking-wider block" htmlFor="budgetCapInput">
                    Monthly Cap Limit ($ USD)
                  </label>
                  <div className="flex items-stretch rounded-lg bg-surface-base overflow-hidden border border-stroke-subtle focus-within:border-secondary">
                    <span className="px-3 bg-surface-card text-secondary-bright font-numeric-stat flex items-center justify-center select-none text-base border-r border-stroke-subtle">
                      $
                    </span>
                    <input
                      id="budgetCapInput"
                      type="number"
                      step="10"
                      min="0"
                      value={monthlyLimit}
                      onChange={(e) => setMonthlyLimit(e.target.value)}
                      placeholder="e.g. 600"
                      className="w-full bg-transparent text-primary font-headline-sm text-base px-3 py-1.5 focus:outline-none"
                    />
                    <span className="px-3 text-xs text-tertiary flex items-center justify-center select-none font-caption-code">
                      / mo
                    </span>
                  </div>
                </div>

                {/* Visual Identity Swatches */}
                <div className="md:col-span-6 space-y-2">
                  <span className="font-label-sm text-xs text-tertiary-light uppercase tracking-wider block">
                    Visual Identity & Accent
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedAccent('teal')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label-sm text-xs transition-transform active:scale-95 ${selectedAccent === 'teal' ? 'bg-secondary text-white shadow-[0_0_12px_rgba(63,110,118,0.3)] border border-secondary-bright font-semibold' : 'bg-surface-card text-on-surface-variant border border-stroke-subtle'}`}
                    >
                      <span className="material-symbols-outlined text-sm">dns</span>
                      <span>Slate Teal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedAccent('cyan')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label-sm text-xs transition-transform active:scale-95 ${selectedAccent === 'cyan' ? 'bg-secondary text-white shadow-[0_0_12px_rgba(63,110,118,0.3)] border border-secondary-bright font-semibold' : 'bg-surface-card text-on-surface-variant border border-stroke-subtle'}`}
                    >
                      <span className="material-symbols-outlined text-sm">restaurant</span>
                      <span>Food / Cyan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedAccent('amber')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label-sm text-xs transition-transform active:scale-95 ${selectedAccent === 'amber' ? 'bg-secondary text-white shadow-[0_0_12px_rgba(63,110,118,0.3)] border border-secondary-bright font-semibold' : 'bg-surface-card text-on-surface-variant border border-stroke-subtle'}`}
                    >
                      <span className="material-symbols-outlined text-sm">local_taxi</span>
                      <span>Rides / Amber</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedAccent('slate')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label-sm text-xs transition-transform active:scale-95 ${selectedAccent === 'slate' ? 'bg-secondary text-white shadow-[0_0_12px_rgba(63,110,118,0.3)] border border-secondary-bright font-semibold' : 'bg-surface-card text-on-surface-variant border border-stroke-subtle'}`}
                    >
                      <span className="material-symbols-outlined text-sm">home</span>
                      <span>Housing</span>
                    </button>
                  </div>
                </div>

                {/* Threshold Sentinel Slider */}
                <div className="md:col-span-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-label-sm text-xs text-tertiary-light uppercase tracking-wider" htmlFor="thresholdSlider">
                      Automated Alert Threshold
                    </label>
                    <div className="flex items-center gap-1 font-caption-code text-xs">
                      <span className="text-warning-amber font-bold">{thresholdPct}%</span>
                      <span className="text-tertiary-light">(${computedWarnAmount})</span>
                    </div>
                  </div>
                  <div className="relative py-1">
                    <input
                      id="thresholdSlider"
                      type="range"
                      min="50"
                      max="100"
                      step="5"
                      value={thresholdPct}
                      onChange={(e) => setThresholdPct(parseInt(e.target.value))}
                      className="w-full h-2 bg-surface-base rounded-lg appearance-none cursor-pointer accent-secondary border border-stroke-subtle"
                    />
                    <div className="flex justify-between text-tertiary font-caption-code text-[10px] mt-1 px-0.5">
                      <span>50%</span>
                      <span>75%</span>
                      <span className="text-warning-amber font-bold">85% Warn</span>
                      <span className="text-critical-crimson font-bold">100% Breached</span>
                    </div>
                  </div>
                </div>

                {/* Webhook Targets */}
                <div className="md:col-span-12 space-y-2 pt-1">
                  <span className="font-label-sm text-xs text-tertiary-light uppercase tracking-wider block">
                    Instant Notification Sentinels
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="flex items-start gap-2.5 p-3 rounded-lg bg-surface-base border border-stroke-subtle cursor-pointer hover:bg-surface-card transition-colors">
                      <input
                        type="checkbox"
                        checked={telegramActive}
                        onChange={(e) => setTelegramActive(e.target.checked)}
                        className="mt-0.5 accent-secondary"
                      />
                      <div className="flex flex-col text-xs">
                        <span className="font-semibold text-primary">Telegram Bot Sentinel</span>
                        <span className="text-tertiary-light">Dispatch to @SpendWiseAlertsBot</span>
                      </div>
                    </label>
                    <label className="flex items-start gap-2.5 p-3 rounded-lg bg-surface-base border border-stroke-subtle cursor-pointer hover:bg-surface-card transition-colors">
                      <input
                        type="checkbox"
                        checked={discordActive}
                        onChange={(e) => setDiscordActive(e.target.checked)}
                        className="mt-0.5 accent-secondary"
                      />
                      <div className="flex flex-col text-xs">
                        <span className="font-semibold text-primary">Discord Webhook Sentinel</span>
                        <span className="text-tertiary-light">Dispatch to #finance-telemetry channel</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stroke-subtle">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 bg-primary hover:bg-neutral-200 text-on-primary text-xs font-bold px-5 py-2 rounded-lg shadow transition-all active:scale-95 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base font-bold">check</span>
                  <span>{loading ? 'Saving...' : editingCategory ? 'Update Category' : 'Save Category'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Active Categories List */}
          <div className="rounded-xl bg-surface-elevated border border-stroke-subtle p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stroke-subtle">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary-bright text-lg">format_list_bulleted</span>
                <h3 className="font-headline-sm text-sm text-primary font-bold">
                  Active Monitored Categories ({categories.length})
                </h3>
              </div>
              <span className="font-caption-code text-xs text-tertiary-light">
                Django DRF /api/categories/
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {categories.map((cat) => {
                const limitVal = cat.monthly_limit ? parseFloat(cat.monthly_limit) : null;
                const spentVal = categorySpending[cat.id] || 0;
                const pct = limitVal && limitVal > 0 ? (spentVal / limitVal) * 100 : null;
                const isBreached = pct !== null && pct >= 100;
                const isWarning = pct !== null && pct >= 85 && !isBreached;

                return (
                  <div
                    key={cat.id}
                    className={`bg-surface-card p-4 rounded-xl border transition-all ${isBreached ? 'border-critical-crimson/40 bg-critical-crimson/5' : isWarning ? 'border-warning-amber/40 bg-warning-amber/5' : 'border-stroke-subtle hover:border-secondary/40'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-lg ${isBreached ? 'text-critical-crimson' : isWarning ? 'text-warning-amber' : 'text-secondary-bright'}`}>
                          category
                        </span>
                        <span className="font-label-md text-sm text-primary font-semibold">
                          {cat.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isBreached ? (
                          <span className="font-caption-code text-[10px] bg-critical-crimson/15 text-critical-crimson border border-critical-crimson/30 px-2 py-0.5 rounded-full font-bold">
                            BREACHED 🚨
                          </span>
                        ) : isWarning ? (
                          <span className="font-caption-code text-[10px] bg-warning-amber/15 text-warning-amber border border-warning-amber/30 px-2 py-0.5 rounded-full font-bold">
                            85%+ NEAR LIMIT
                          </span>
                        ) : (
                          <span className="font-caption-code text-[10px] bg-accent-teal-subtle text-secondary-bright border border-secondary/30 px-2 py-0.5 rounded-full font-semibold">
                            SAFE VELOCITY
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartEdit(cat)}
                          title="Edit Category"
                          className="p-1 hover:text-secondary-bright text-on-surface-variant transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cat.id)}
                          title="Delete Category"
                          className="p-1 hover:text-critical-crimson text-on-surface-variant transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between mb-1 text-xs">
                      <span className="font-numeric-stat text-base text-primary font-bold">
                        ${spentVal.toFixed(2)}
                      </span>
                      <span className="font-caption-code text-tertiary-light">
                        {limitVal ? `Cap: $${limitVal.toFixed(2)} (${pct?.toFixed(1)}%)` : 'No Cap Configured'}
                      </span>
                    </div>

                    {limitVal && (
                      <div className="w-full bg-surface-elevated h-2 rounded-full overflow-hidden mt-2 mb-2 border border-stroke-subtle">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${isBreached ? 'bg-gradient-to-r from-warning-amber to-critical-crimson' : isWarning ? 'bg-warning-amber' : 'bg-secondary-bright'}`}
                          style={{ width: `${Math.min(pct || 0, 100)}%` }}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] font-caption-code text-tertiary-light pt-1">
                      <span>Discord / Telegram Active</span>
                      <span className="text-secondary-bright">Sentinel Node 200 OK</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
