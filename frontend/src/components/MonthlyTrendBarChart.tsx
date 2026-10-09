import React, { useState } from 'react';

interface Props {
  data: { month: string; amount: string }[];
  baseCurrency: string;
}

export const MonthlyTrendBarChart: React.FC<Props> = ({ data, baseCurrency }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Default / fallback 6 months data if not populated yet
  const defaultMonths = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
  const monthMap: Record<string, number> = {};
  data.forEach((d) => {
    monthMap[d.month] = parseFloat(d.amount) || 0;
  });

  const months = defaultMonths.map((m) => {
    const val = monthMap[m] !== undefined ? monthMap[m] : 0;
    const dateObj = new Date(`${m}-01T00:00:00`);
    const label = dateObj.toLocaleDateString('en-US', { month: 'short' });
    return {
      key: m,
      label,
      amount: val,
      isCurrent: m === '2026-06' || m === defaultMonths[defaultMonths.length - 1],
    };
  });

  const maxVal = Math.max(...months.map((m) => m.amount), 5000);
  const totalBurn = months.reduce((acc, m) => acc + m.amount, 0);
  const avgBurn = totalBurn / (months.length || 1);

  return (
    <div className="flex flex-col justify-between h-full">
      {/* Header Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="font-headline-sm text-sm sm:text-base text-primary font-semibold">
            6-Month Spending Trajectory
          </h3>
          <p className="font-caption-code text-[11px] text-on-surface-variant">
            Historical velocity normalized via API analytics (Jan – Jun 2026)
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-caption-code">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-secondary-bright" />
            <span className="text-on-surface-variant">Spend Bar</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-0.5 border-t border-dashed border-tertiary-light" />
            <span className="text-tertiary-light">$5k Limit</span>
          </div>
        </div>
      </div>

      {/* Dynamic Tooltip Bar */}
      <div className="h-6 flex items-center justify-end">
        {hoveredIdx !== null ? (
          <div className="bg-surface-elevated px-2.5 py-0.5 rounded border border-stroke-subtle text-primary font-caption-code text-xs animate-fadeIn">
            Month: <span className="text-secondary-bright font-bold">{months[hoveredIdx].label}</span> • Total:{' '}
            <span className="text-primary font-bold">
              ${months[hoveredIdx].amount.toFixed(2)} {baseCurrency}
            </span>
          </div>
        ) : (
          <div className="text-[11px] font-caption-code text-tertiary">
            Hover over a bar to view detailed metrics
          </div>
        )}
      </div>

      {/* SVG Bar Chart */}
      <div className="relative w-full h-56 pt-2 pb-2">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 600 200">
          {/* Reference Line at $5,000 (Y=35) */}
          <line
            x1="0"
            x2="600"
            y1="35"
            y2="35"
            stroke="#A3A3A3"
            strokeDasharray="4 4"
            strokeOpacity="0.6"
            strokeWidth="1.5"
          />
          <text x="590" y="30" fill="#A3A3A3" fontFamily="Inter" fontSize="10" textAnchor="end">
            $5,000 Limit
          </text>

          {/* Reference Line at $3,750 (Y=85) */}
          <line x1="0" x2="600" y1="85" y2="85" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x="590" y="81" fill="#6A6A6A" fontFamily="Inter" fontSize="9" textAnchor="end">
            $3,750
          </text>

          {/* Reference Line at $2,500 (Y=135) */}
          <line x1="0" x2="600" y1="135" y2="135" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x="590" y="131" fill="#6A6A6A" fontFamily="Inter" fontSize="9" textAnchor="end">
            $2,500
          </text>

          {/* Bars */}
          {months.map((m, idx) => {
            const barWidth = 46;
            const x = 35 + idx * 95;
            // Map amount (0 to maxVal) to height (0 to 140)
            const barHeight = Math.max((m.amount / maxVal) * 140, 10);
            const y = 175 - barHeight;
            const isHovered = hoveredIdx === idx;
            const displayK = m.amount > 0 ? `$${(m.amount / 1000).toFixed(1)}k` : '$0';

            return (
              <g
                key={m.key}
                className="cursor-pointer group"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Bar Rect */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="4"
                  fill={m.isCurrent ? '#3F6E76' : isHovered ? '#3F6E76' : '#181F2E'}
                  stroke={m.isCurrent ? '#5898A3' : 'rgba(255,255,255,0.08)'}
                  strokeWidth="1"
                  className="transition-colors duration-200"
                />
                {/* Month Name */}
                <text
                  x={x + barWidth / 2}
                  y="194"
                  fill={m.isCurrent ? '#5898A3' : '#9ba3b4'}
                  fontFamily="Inter"
                  fontSize={m.isCurrent ? '11' : '10'}
                  fontWeight={m.isCurrent ? 'bold' : 'normal'}
                  textAnchor="middle"
                >
                  {m.label} {m.isCurrent ? '(Now)' : ''}
                </text>
                {/* Amount on top */}
                <text
                  x={x + barWidth / 2}
                  y={y - 8}
                  fill={m.isCurrent ? '#5898A3' : '#9ba3b4'}
                  fontFamily="Inter"
                  fontSize="10"
                  fontWeight={m.isCurrent ? 'bold' : 'normal'}
                  textAnchor="middle"
                >
                  {displayK}
                </text>
              </g>
            );
          })}

          {/* Baseline */}
          <line x1="20" x2="580" y1="176" y2="176" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        </svg>
      </div>

      {/* Burn Footnote */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-stroke-subtle font-caption-code text-xs text-on-surface-variant">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm text-secondary-bright">insights</span>
          <span>
            Average 6-Mo Outflow: <strong className="text-primary">${avgBurn.toFixed(2)} / mo</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-secondary-bright font-semibold">
          <span className="material-symbols-outlined text-sm">savings</span>
          <span>Pacing within $5,000 monthly ceiling</span>
        </div>
      </div>
    </div>
  );
};
