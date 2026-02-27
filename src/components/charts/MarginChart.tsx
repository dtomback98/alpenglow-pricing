'use client';

import { PaxCalculation } from '@/lib/types';
import { CHART_COLORS } from '@/lib/constants';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface MarginChartProps {
  calculations: PaxCalculation[];
}

export default function MarginChart({ calculations }: MarginChartProps) {
  const data = calculations.map((calc) => ({
    pax: `${calc.pax} pax`,
    Margin: calc.margin,
    'Per Pax Profit': calc.perPaxProfit,
  }));

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
          <XAxis
            dataKey="pax"
            tick={{ fill: '#94a3b8' }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#94a3b8' }}
            tickFormatter={(value) => `${value}%`}
            domain={['auto', 'auto']}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: '#94a3b8' }}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#f8fafc' }}
            formatter={(value: number, name: string) => {
              if (name === 'Margin') {
                return [`${value.toFixed(1)}%`, name];
              }
              return [`$${value.toFixed(0)}`, name];
            }}
          />
          <ReferenceLine
            yAxisId="left"
            y={40}
            stroke="#22c55e"
            strokeDasharray="3 3"
            label={{ value: '40% target', fill: '#22c55e', fontSize: 12 }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="Margin"
            stroke={CHART_COLORS.margin}
            strokeWidth={3}
            dot={{ fill: CHART_COLORS.margin, strokeWidth: 2, r: 5 }}
            activeDot={{ r: 8 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="Per Pax Profit"
            stroke={CHART_COLORS.profit}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: CHART_COLORS.profit, strokeWidth: 2, r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
