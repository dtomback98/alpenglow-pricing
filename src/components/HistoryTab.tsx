'use client';

import { useState, useEffect } from 'react';
import { useHistoricalData } from '@/hooks/useHistoricalData';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/lib/constants';
import { formatCurrency, formatPercent, getMarginColor } from '@/lib/calculations';
import { exportHistoricalTrips } from '@/lib/excelExport';
import { HistoricalTrip } from '@/lib/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const CATEGORIES = ['All', 'Beg', 'Inter', 'Adv', 'Ski', '8k E'];

interface HistoryTabProps {
  onLoadTrip?: (tripConfigId: string) => void;
  refreshKey?: number;
}

function TripTable({ trips, title, onLoadTrip, onDeleteTrip }: { trips: HistoricalTrip[]; title: string; onLoadTrip?: (id: string) => void; onDeleteTrip?: (id: string) => void }) {
  if (trips.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        <p className="text-sm text-ag-text-muted">No trips to display.</p>
      </div>
    );
  }

  const hasActions = onLoadTrip || onDeleteTrip;

  return (
    <div className="card overflow-x-auto">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <table className="pricing-table">
        <thead>
          <tr>
            <th>Trip</th>
            <th>Cat</th>
            <th>Pax</th>
            <th>$/Pax</th>
            <th>Revenue</th>
            <th>Profit</th>
            <th>Margin</th>
            <th>Notes</th>
            {hasActions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {trips.map((trip) => (
            <tr key={trip.id}>
              <td className="font-medium">{trip.name}</td>
              <td>
                {trip.category && (
                  <span
                    className="px-2 py-1 rounded text-xs font-medium"
                    style={{ backgroundColor: `${CATEGORY_COLORS[trip.category] || '#3b82f6'}30`, color: CATEGORY_COLORS[trip.category] || '#3b82f6' }}
                  >
                    {trip.category}
                  </span>
                )}
              </td>
              <td>{trip.pax}</td>
              <td>{formatCurrency(trip.pricePerPax)}</td>
              <td>{formatCurrency(trip.revenue)}</td>
              <td className={trip.grossProfit >= 0 ? 'text-ag-success' : 'text-ag-danger'}>
                {formatCurrency(trip.grossProfit)}
              </td>
              <td className={getMarginColor(trip.margin)}>{formatPercent(trip.margin)}</td>
              <td className="text-sm text-ag-text-muted" style={{ minWidth: '200px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{trip.notes}</td>
              {hasActions && (
                <td>
                  <div className="flex gap-1">
                    {onLoadTrip && trip.tripConfigId && (
                      <button
                        onClick={() => onLoadTrip(trip.tripConfigId!)}
                        className="btn btn-secondary text-xs"
                      >
                        Load
                      </button>
                    )}
                    {onDeleteTrip && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${trip.name}" from history?`)) {
                            onDeleteTrip(trip.id);
                          }
                        }}
                        className="btn btn-danger text-xs"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function HistoryTab({ onLoadTrip, refreshKey }: HistoryTabProps) {
  const { trips, loading, selectedCategory, setSelectedCategory, deleteTrip, refresh } = useHistoricalData();

  // Re-fetch when refreshKey changes (e.g. after Save to History)
  useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      refresh();
    }
  }, [refreshKey, refresh]);
  const currentYear = new Date().getFullYear();
  const [chartYearFilter, setChartYearFilter] = useState<string>('all');
  const [statsYearFilter, setStatsYearFilter] = useState<string>('all');

  const trips2025 = trips.filter(t => (t.year || 2025) === 2025);
  const tripsCurrentYear = trips.filter(t => t.year === currentYear);

  const getFilteredTrips = (filter: string) =>
    filter === '2025' ? trips2025
    : filter === String(currentYear) ? tripsCurrentYear
    : trips;

  const statsTrips = getFilteredTrips(statsYearFilter);
  const chartTrips = getFilteredTrips(chartYearFilter);

  const chartData = chartTrips.map(trip => ({
    name: trip.name,
    margin: trip.margin,
    grossProfit: trip.grossProfit,
    category: trip.category,
  }));

  const avgMargin = statsTrips.length > 0
    ? statsTrips.reduce((sum, t) => sum + t.margin, 0) / statsTrips.length
    : 0;

  if (loading) {
    return <div className="text-center text-ag-text-muted py-8">Loading historical data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Category filter */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Filter by Category</h2>
          <button
            onClick={() => exportHistoricalTrips(
              trips,
              statsYearFilter === 'all' ? 'all_years' : statsYearFilter,
              selectedCategory || 'all_categories'
            )}
            className="btn btn-secondary text-sm"
          >
            Export to Excel
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const isActive = cat === 'All' ? selectedCategory === null : selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === 'All' ? null : cat)}
                className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                style={isActive && cat !== 'All' ? { backgroundColor: CATEGORY_COLORS[cat] } : undefined}
              >
                {CATEGORY_LABELS[cat] || cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary stats */}
      <div className="card mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Summary Statistics</h2>
          <select
            value={statsYearFilter}
            onChange={(e) => setStatsYearFilter(e.target.value)}
            className="text-sm"
          >
            <option value="all">All Years</option>
            <option value="2025">2025 Only</option>
            <option value={String(currentYear)}>{currentYear} Only</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-sm text-ag-text-muted mb-1">Total Trips</div>
          <div className="text-2xl font-bold text-ag-text">{statsTrips.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-ag-text-muted mb-1">Total Revenue</div>
          <div className="text-2xl font-bold text-ag-text">
            {formatCurrency(statsTrips.reduce((sum, t) => sum + t.revenue, 0))}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-ag-text-muted mb-1">Total Profit</div>
          <div className={`text-2xl font-bold ${statsTrips.reduce((sum, t) => sum + t.grossProfit, 0) >= 0 ? 'text-ag-success' : 'text-ag-danger'}`}>
            {formatCurrency(statsTrips.reduce((sum, t) => sum + t.grossProfit, 0))}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-ag-text-muted mb-1">Average Margin</div>
          <div className={`text-2xl font-bold ${getMarginColor(avgMargin)}`}>
            {formatPercent(avgMargin)}
          </div>
        </div>
      </div>

      {/* Margin chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Margin by Trip</h2>
          <select
            value={chartYearFilter}
            onChange={(e) => setChartYearFilter(e.target.value)}
            className="text-sm"
          >
            <option value="all">All Years</option>
            <option value="2025">2025 Only</option>
            <option value={String(currentYear)}>{currentYear} Only</option>
          </select>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
              />
              <YAxis
                tick={{ fill: '#94a3b8' }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#f8fafc' }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Margin']}
              />
              <Bar dataKey="margin" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category] || '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Current Year Trip Performance */}
      <TripTable trips={tripsCurrentYear} title={`${currentYear} Trip Performance`} onLoadTrip={onLoadTrip} onDeleteTrip={deleteTrip} />

      {/* 2025 Trip Performance */}
      <TripTable trips={trips2025} title="2025 Trip Performance" />

      {/* Target margins footer */}
      <div className="card text-center text-sm">
        <span className="text-ag-text-muted">MWP Target Margins: </span>
        <span className="text-ag-success">Beg/Trek 40-45%</span>
        <span className="text-ag-text-muted"> &bull; </span>
        <span className="text-blue-400">Inter 35-40%</span>
        <span className="text-ag-text-muted"> &bull; </span>
        <span className="text-ag-warning">Adv 38-42%</span>
        <span className="text-ag-text-muted"> &bull; </span>
        <span className="text-cyan-400">Ski 40-50%</span>
        <span className="text-ag-text-muted"> &bull; </span>
        <span className="text-ag-danger">8K 32-38%</span>
      </div>
    </div>
  );
}
