import { useState } from 'react';
import { X, DollarSign, Globe } from 'lucide-react';
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
  baseCurrency: string;
}

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR', 'NPR', 'CHF', 'CNY'];

export const AddExpenseModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSubmit,
  categories,
  initialData,
  baseCurrency,
}) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [amount, setAmount] = useState(initialData?.amount || '');
  const [currency, setCurrency] = useState(initialData?.currency || baseCurrency);
  const [categoryId, setCategoryId] = useState<number | string>(
    initialData?.category || (categories[0]?.id || '')
  );
  const [date, setDate] = useState(
    initialData?.date || new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide an expense title.');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }
    if (!categoryId) {
      setError('Please select a category.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit({
        title,
        amount,
        currency,
        category: Number(categoryId),
        date,
        notes,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} id="add-expense-modal-backdrop">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} id="add-expense-modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'hsla(243, 75%, 59%, 0.15)',
                color: 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DollarSign size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>
                {initialData ? 'Edit Expense' : 'Record New Expense'}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Multi-currency enabled with automatic exchange rates
              </p>
            </div>
          </div>
          <button
            className="btn-icon"
            onClick={onClose}
            id="close-expense-modal-btn"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'hsla(350, 89%, 60%, 0.15)',
              border: '1px solid hsla(350, 89%, 60%, 0.3)',
              color: 'var(--danger)',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} id="expense-form">
          <div className="form-group">
            <label className="form-label" htmlFor="expense-title-input">
              Expense Title *
            </label>
            <input
              id="expense-title-input"
              className="form-input"
              type="text"
              placeholder="e.g. Flight to Berlin, Groceries, AWS Server"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="expense-amount-input">
                Amount *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="expense-amount-input"
                  className="form-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="expense-currency-select">
                Currency *
              </label>
              <select
                id="expense-currency-select"
                className="form-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {currency !== baseCurrency && amount && (
            <div
              style={{
                fontSize: '12px',
                color: 'var(--cyan)',
                background: 'hsla(186, 92%, 48%, 0.1)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Globe size={14} />
              <span>
                Will be converted to {baseCurrency} at live exchange rate on summary reports.
              </span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="expense-category-select">
                Category *
              </label>
              <select
                id="expense-category-select"
                className="form-select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                {categories.length === 0 && <option value="">No categories available</option>}
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} {cat.monthly_limit ? `(Limit: $${cat.monthly_limit})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="expense-date-input">
                Date *
              </label>
              <input
                id="expense-date-input"
                className="form-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="expense-notes-input">
              Notes & Reference (Optional)
            </label>
            <textarea
              id="expense-notes-input"
              className="form-textarea"
              placeholder="Add details, invoice numbers, or payment notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              id="cancel-expense-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              id="submit-expense-btn"
            >
              {loading ? 'Saving...' : initialData ? 'Update Expense' : 'Record Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
