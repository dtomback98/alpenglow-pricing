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

function TripTable({ trips, title, onLoadTrip, onDeleteTrip, onUpdateTrip }: {
  trips: HistoricalTrip[];
  title: string;
  onLoadTrip?: (id: string) => void;
  onDeleteTrip?: (id: string) => void;
  onUpdateTrip?: (id: string, updates: { status?: string; notes?: string }) => Promise<boolean>;
}) {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');

  if (trips.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        <p className="text-sm text-ag-text-muted">No trips to display.</p>
      </div>
    );
  }

  const hasActions = onLoadTrip || onDeleteTrip || onUpdateTrip;

  return (
    <div className="card overflow-x-auto">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <table className="pricing-table">
        <thead>
          <tr>
            <th>Trip</th>
            <th>Cat</th>
            <th>Status</th>
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
              <td>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  trip.status === 'run' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {trip.status === 'run' ? 'Run' : 'Budgeted'}
                </span>
              </td>
              <td>{trip.pax}</td>
              <td>{formatCurrency(trip.pricePerPax)}</td>
              <td>{formatCurrency(trip.revenue)}</td>
              <td className={trip.grossProfit >= 0 ? 'text-ag-success' : 'text-ag-danger'}>
                {formatCurrency(trip.grossProfit)}
              </td>
              <td className={getMarginColor(trip.margin)}>{formatPercent(trip.margin)}</td>
              <td style={{ minWidth: '200px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                {editingNoteId === trip.id ? (
                  <div className="flex flex-col gap-1">
                    <textarea
                      value={editNoteText}
                      onChange={(e) => setEditNoteText(e.target.value)}
                      className="w-full text-sm p-1"
                      rows={2}
                    />
                    <div className="flex gap-1">
                      <button className="btn btn-primary text-xs" onClick={async () => {
                        if (onUpdateTrip) {
                          await onUpdateTrip(trip.id, { notes: editNoteText });
                        }
                        setEditingNoteId(null);
                      }}>Save</button>
                      <button className="btn btn-secondary text-xs" onClick={() => setEditingNoteId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-1">
                    <span className="text-sm text-ag-text-muted">{trip.notes || '\u2014'}</span>
                    {onUpdateTrip && (
                      <button className="btn btn-secondary text-xs shrink-0" onClick={() => {
                        setEditingNoteId(trip.id);
                        setEditNoteText(trip.notes || '');
                      }}>Edit</button>
                    )}
                  </div>
                )}
              </td>
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
                    {onUpdateTrip && trip.status === 'budgeted' && (
                      <button
                        onClick={async () => {
                          await onUpdateTrip(trip.id, { status: 'run' });
                        }}
                        className="btn btn-secondary text-xs"
                      >
                        Mark Run
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
  const { trips, loading, error, selectedCategory, setSelectedCategory, deleteTrip, updateTrip, refresh } = useHistoricalData();

  // Re-fetch when refreshKey changes (e.g. after Save to History)
  useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      refresh();
    }
  }, [refreshKey, refresh]);
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const [chartYearFilter, setChartYearFilter] = useState<string>('all');
  const [statsYearFilter, setStatsYearFilter] = useState<string>('all');

  const trips2025 = trips.filter(t => (t.year || 2025) === 2025);
  const tripsCurrentYear = trips.filter(t => t.year === currentYear);
  const tripsCurrentYearRun = tripsCurrentYear.filter(t => t.status === 'run');
  const tripsCurrentYearBudgeted = tripsCurrentYear.filter(t => t.status !== 'run');
  const tripsNextYear = trips.filter(t => t.year === nextYear);

  const getFilteredTrips = (filter: string) =>
    filter === '2025' ? trips2025
    : filter === String(currentYear) ? tripsCurrentYear
    : filter === `${currentYear}-run` ? tripsCurrentYearRun
    : filter === `${currentYear}-budgeted` ? tripsCurrentYearBudgeted
    : filter === String(nextYear) ? tripsNextYear
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
      {error && (
        <div className="card border border-ag-danger text-ag-danger text-sm p-3">
          {error} — showing cached data.
        </div>
      )}
      {/* Category filter */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Filter by Category</h2>
          <button
            onClick={() => exportHistoricalTrips(
              statsTrips,
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
            <option value={String(currentYear)}>{currentYear} — All</option>
            <option value={`${currentYear}-run`}>{currentYear} — Trips Run</option>
            <option value={`${currentYear}-budgeted`}>{currentYear} — Budgeted</option>
            <option value={String(nextYear)}>{nextYear} Only</option>
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
            <option value={String(currentYear)}>{currentYear} — All</option>
            <option value={`${currentYear}-run`}>{currentYear} — Trips Run</option>
            <option value={`${currentYear}-budgeted`}>{currentYear} — Budgeted</option>
            <option value={String(nextYear)}>{nextYear} Only</option>
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

      {/* Next Year Trip Performance */}
      {tripsNextYear.length > 0 && (
        <TripTable trips={tripsNextYear} title={`${nextYear} Budgeted Trips`} onLoadTrip={onLoadTrip} onDeleteTrip={deleteTrip} onUpdateTrip={updateTrip} />
      )}

      {/* Current Year Trips Run */}
      <TripTable trips={tripsCurrentYearRun} title={`${currentYear} Trips Run`} onLoadTrip={onLoadTrip} onDeleteTrip={deleteTrip} onUpdateTrip={updateTrip} />

      {/* Current Year Budgeted Trips */}
      <TripTable trips={tripsCurrentYearBudgeted} title={`${currentYear} Budgeted Trips`} onLoadTrip={onLoadTrip} onDeleteTrip={deleteTrip} onUpdateTrip={updateTrip} />

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
