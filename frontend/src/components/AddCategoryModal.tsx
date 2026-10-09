import React, { useState } from 'react';
import { X, FolderPlus, Bell } from 'lucide-react';
import type { Category } from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string; monthly_limit?: string | null }) => Promise<void>;
  initialData?: Category | null;
}

export const AddCategoryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [monthlyLimit, setMonthlyLimit] = useState(initialData?.monthly_limit || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a category name.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        monthly_limit: monthlyLimit ? String(monthlyLimit) : null,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} id="add-category-modal-backdrop">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} id="add-category-modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                background: 'hsla(186, 92%, 48%, 0.15)',
                color: 'var(--cyan)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FolderPlus size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>
                {initialData ? 'Edit Category' : 'Create Category'}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Organize expenses and configure monthly spending limits
              </p>
            </div>
          </div>
          <button
            className="btn-icon"
            onClick={onClose}
            id="close-category-modal-btn"
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

        <form onSubmit={handleSubmit} id="category-form">
          <div className="form-group">
            <label className="form-label" htmlFor="category-name-input">
              Category Name *
            </label>
            <input
              id="category-name-input"
              className="form-input"
              type="text"
              placeholder="e.g. Dining, Travel, Subscriptions, Utilities"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="category-description-input">
              Description (Optional)
            </label>
            <input
              id="category-description-input"
              className="form-input"
              type="text"
              placeholder="e.g. Restaurants, cafes, and takeout"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="category-limit-input">
              Monthly Budget Limit (Optional)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="category-limit-input"
                className="form-input"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 250.00"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
              />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '6px',
                fontSize: '12px',
                color: 'var(--warning)',
              }}
            >
              <Bell size={13} />
              <span>
                Crossing this threshold will trigger a bot alert (Feature 2).
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              id="cancel-category-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              id="submit-category-btn"
            >
              {loading ? 'Saving...' : initialData ? 'Update Category' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
