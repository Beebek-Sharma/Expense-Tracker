import { useState } from 'react';

interface CategoryShare {
  name: string;
  total: number;
  color: string;
  percentage: number;
}

interface Props {
  data: { category: string; total: string }[];
  baseCurrency: string;
}

const PALETTE = [
  'hsl(243, 75%, 59%)', // Indigo
  'hsl(186, 92%, 48%)', // Cyan
  'hsl(152, 76%, 42%)', // Emerald
  'hsl(38, 92%, 50%)',  // Amber
  'hsl(350, 89%, 60%)', // Rose
  'hsl(280, 80%, 60%)', // Violet
  'hsl(200, 90%, 55%)', // Sky
  'hsl(25, 95%, 55%)',  // Orange
];

export const CategoryPieChart = ({ data, baseCurrency }: Props) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const numericData = data
    .map((item, idx) => ({
      name: item.category,
      total: parseFloat(item.total) || 0,
      color: PALETTE[idx % PALETTE.length],
    }))
    .filter((d) => d.total > 0);

  const grandTotal = numericData.reduce((acc, curr) => acc + curr.total, 0);

  const processedData: CategoryShare[] = numericData.map((d) => ({
    ...d,
    percentage: grandTotal > 0 ? (d.total / grandTotal) * 100 : 0,
  }));

  if (processedData.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
        <p>No category expense data recorded yet.</p>
        <span style={{ fontSize: '12px' }}>Add expenses to see category breakdown.</span>
      </div>
    );
  }

  // Generate SVG Donut paths
  let accumulatedAngle = 0;
  const radius = 80;
  const strokeWidth = 28;
  const center = 100;
  const circumference = 2 * Math.PI * radius;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: 200, height: 200, flexShrink: 0 }}>
        <svg width="200" height="200" viewBox="0 0 200 200">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="hsla(220, 30%, 20%, 0.4)"
            strokeWidth={strokeWidth}
          />
          {processedData.map((slice, idx) => {
            const strokeDasharray = `${(slice.percentage / 100) * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedAngle;
            accumulatedAngle += (slice.percentage / 100) * circumference;

            const isHovered = hoveredIdx === idx;

            return (
              <circle
                key={slice.name}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                style={{
                  transition: 'all 200ms ease',
                  cursor: 'pointer',
                  filter: isHovered ? `drop-shadow(0 0 8px ${slice.color})` : 'none',
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>

        {/* Center Label */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {hoveredIdx !== null ? processedData[hoveredIdx].name : 'Total Spent'}
          </span>
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-heading)' }}>
            {hoveredIdx !== null
              ? `${processedData[hoveredIdx].percentage.toFixed(1)}%`
              : `${baseCurrency} ${grandTotal.toFixed(2)}`}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {processedData.map((item, idx) => (
          <div
            key={item.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              background: hoveredIdx === idx ? 'var(--bg-elevated)' : 'transparent',
              cursor: 'pointer',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: item.color,
                }}
              />
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                {item.name}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff', fontFamily: 'var(--font-mono)' }}>
                {item.total.toFixed(2)}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                ({item.percentage.toFixed(0)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
