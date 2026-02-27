'use client';

import { PaxCalculation } from '@/lib/types';
import { CHART_COLORS } from '@/lib/constants';
import { formatCurrency } from '@/lib/calculations';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface RevenueVsCostsChartProps {
  calculations: PaxCalculation[];
}

export default function RevenueVsCostsChart({ calculations }: RevenueVsCostsChartProps) {
  const data = calculations.map((calc) => ({
    pax: `${calc.pax} pax`,
    Revenue: calc.totalRevenue,
    Costs: calc.totalCosts,
    Profit: calc.grossProfit,
  }));

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
          <XAxis
            dataKey="pax"
            tick={{ fill: '#94a3b8' }}
          />
          <YAxis
            tick={{ fill: '#94a3b8' }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#f8fafc' }}
            formatter={(value: number) => formatCurrency(value)}
          />
          <Legend
            wrapperStyle={{ color: '#f8fafc' }}
          />
          <Bar
            dataKey="Revenue"
            fill={CHART_COLORS.revenue}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="Costs"
            fill={CHART_COLORS.costs}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="Profit"
            fill={CHART_COLORS.profit}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
