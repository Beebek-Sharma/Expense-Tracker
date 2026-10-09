import React, { useState } from 'react';

interface Props {
  data: { category: string; total: string }[];
  baseCurrency: string;
}

const STITCH_PALETTE = [
  '#3F6E76', // Slate Teal Primary
  '#F59E0B', // Amber Warning
  '#5898A3', // Bright Teal
  '#9fcfd7', // Light Teal
  '#6A6A6A', // Slate Neutral
  '#EF4444', // Crimson
  '#8B5CF6', // Purple
  '#10B981', // Emerald
];

export const CategoryPieChart: React.FC<Props> = ({ data, baseCurrency }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const numericData = data
    .map((item, idx) => ({
      name: item.category,
      total: parseFloat(item.total) || 0,
      color: STITCH_PALETTE[idx % STITCH_PALETTE.length],
    }))
    .filter((d) => d.total > 0);

  const grandTotal = numericData.reduce((acc, curr) => acc + curr.total, 0);

  const processedData = numericData.map((d) => ({
    ...d,
    percentage: grandTotal > 0 ? (d.total / grandTotal) * 100 : 0,
  }));

  if (processedData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-on-surface-variant font-caption-code text-xs">
        <span className="material-symbols-outlined text-3xl text-tertiary mb-2">pie_chart</span>
        <p>No category expenses recorded yet.</p>
        <span className="text-tertiary">Log an expense to see normalized distribution.</span>
      </div>
    );
  }

  // SVG Donut geometry
  const radius = 38;
  const circumference = 2 * Math.PI * radius; // ~238.76

  // Precompute segment offsets purely
  const segments = processedData.map((slice, idx, arr) => {
    const strokeDashLength = (slice.percentage / 100) * circumference;
    const strokeDashoffset = -arr.slice(0, idx).reduce((sum, s) => sum + (s.percentage / 100) * circumference, 0);
    return {
      ...slice,
      strokeDashLength,
      strokeDashoffset,
    };
  });

  return (
    <div className="flex flex-col justify-between h-full">
      {/* SVG Donut Chart Container */}
      <div className="relative flex items-center justify-center my-4">
        <svg className="w-48 h-48 sm:w-52 sm:h-52 transform -rotate-90" viewBox="0 0 100 100">
          {/* Background Ring */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="12"
          />
          {/* Colored Segments */}
          {segments.map((slice, idx) => {
            const isHovered = hoveredIdx === idx;

            return (
              <circle
                key={slice.name}
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={isHovered ? 14 : 12}
                strokeDasharray={`${slice.strokeDashLength.toFixed(2)} ${circumference.toFixed(2)}`}
                strokeDashoffset={slice.strokeDashoffset.toFixed(2)}
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>

        {/* Center Hole Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="font-caption-code text-[11px] text-tertiary-light uppercase">Total Outflow</span>
          <span className="font-headline-md text-xl sm:text-2xl font-bold text-primary">
            {baseCurrency === 'USD' ? '$' : `${baseCurrency} `}
            {grandTotal >= 1000 ? grandTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : grandTotal.toFixed(2)}
          </span>
          <span className="font-caption-code text-[11px] text-secondary-bright">
            {processedData.length} {processedData.length === 1 ? 'Category' : 'Categories'}
          </span>
        </div>
      </div>

      {/* Donut Legend */}
      <div className="flex flex-col gap-1.5 mt-2 pt-3 border-t border-stroke-subtle font-body-sm text-xs">
        {processedData.slice(0, 5).map((slice, idx) => (
          <div
            key={slice.name}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            className={`flex items-center justify-between p-1.5 rounded transition-colors cursor-pointer ${hoveredIdx === idx ? 'bg-surface-elevated text-primary' : 'hover:bg-surface-elevated/60 text-on-surface'}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: slice.color }}
              />
              <span className="truncate">{slice.name}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-caption-code text-[11px] text-tertiary-light">
                {slice.percentage.toFixed(0)}%
              </span>
              <span className="font-caption-code text-xs font-bold text-primary">
                ${slice.total.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
