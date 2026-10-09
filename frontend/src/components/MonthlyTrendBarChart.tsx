import { useState } from 'react';

interface Props {
  data: { month: string; amount: string }[];
  baseCurrency: string;
}

export const MonthlyTrendBarChart = ({ data, baseCurrency }: Props) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const formatted = data.map((d) => ({
    month: d.month,
    amount: parseFloat(d.amount) || 0,
    label: new Date(`${d.month}-01`).toLocaleString('default', { month: 'short' }),
  }));

  const maxVal = Math.max(...formatted.map((d) => d.amount), 100);

  return (
    <div style={{ width: '100%', height: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          height: '170px',
          paddingBottom: '10px',
          borderBottom: '1px solid var(--border-subtle)',
          gap: '12px',
        }}
      >
        {formatted.map((item, idx) => {
          const heightPct = Math.max((item.amount / maxVal) * 100, 4);
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={item.month}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end',
                position: 'relative',
              }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Tooltip */}
              {isHovered && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-36px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-card)',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 20,
                  }}
                >
                  {baseCurrency} {item.amount.toFixed(2)}
                </div>
              )}

              {/* Bar */}
              <div
                style={{
                  width: '100%',
                  maxWidth: '36px',
                  height: `${heightPct}%`,
                  background: isHovered
                    ? 'linear-gradient(180deg, var(--primary-light) 0%, var(--primary) 100%)'
                    : 'linear-gradient(180deg, hsla(243, 75%, 59%, 0.7) 0%, hsla(243, 75%, 59%, 0.2) 100%)',
                  borderRadius: '6px 6px 2px 2px',
                  transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isHovered ? '0 0 16px var(--primary-glow)' : 'none',
                  cursor: 'pointer',
                  border: '1px solid hsla(243, 85%, 68%, 0.3)',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* X-Axis Month Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', gap: '12px' }}>
        {formatted.map((item, idx) => (
          <div
            key={item.month}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: '12px',
              fontWeight: hoveredIdx === idx ? 700 : 500,
              color: hoveredIdx === idx ? '#fff' : 'var(--text-muted)',
              transition: 'color 150ms ease',
            }}
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
};
