'use client';

import { useState, useEffect } from 'react';
import { useHistoricalData } from '@/hooks/useHistoricalData';
import { CATEGORY_COLORS, CATEGORY_LABELS, STATUS_ORDER, STATUS_LABELS, STATUS_BADGE_CLASSES } from '@/lib/constants';
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
                <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_BADGE_CLASSES[trip.status || 'budgeted'] || STATUS_BADGE_CLASSES['budgeted']}`}>
                  {STATUS_LABELS[trip.status || 'budgeted'] || 'Budgeted'}
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
                    {onUpdateTrip && (
                      <select
                        value={trip.status || 'budgeted'}
                        onChange={async (e) => {
                          await onUpdateTrip(trip.id, { status: e.target.value });
                        }}
                        className="text-xs"
                      >
                        <option value="budgeted">Budgeted</option>
                        <option value="open-enrollment">Open Enrollment</option>
                        <option value="run">Run</option>
                        <option value="scratch">Scratch</option>
                      </select>
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
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  // Derive sorted country list from loaded trips
  const countryMap: Record<string, true> = {};
  for (const t of trips) { countryMap[t.country || 'Other'] = true; }
  const availableCountries = Object.keys(countryMap).sort();

  const countryFiltered = selectedCountry ? trips.filter(t => (t.country || 'Other') === selectedCountry) : trips;

  // Derive unique years from all trips for the year dropdown
  const yearMap: Record<number, true> = {};
  for (const t of trips) { yearMap[t.year || 2025] = true; }
  const availableYears = Object.keys(yearMap).map(Number).sort((a, b) => b - a);

  const matchesYear = (t: HistoricalTrip) => {
    if (yearFilter === 'all') return true;
    if (yearFilter === '2025') return (t.year || 2025) === 2025;
    return t.year === Number(yearFilter);
  };
  const matchesStatus = (t: HistoricalTrip) => statusFilter === 'all' || t.status === statusFilter;

  const filteredTrips = countryFiltered.filter(t => matchesYear(t) && matchesStatus(t));

  // Group filtered trips by year + status for dynamic table sections
  const groupMap: Record<string, HistoricalTrip[]> = {};
  for (const t of filteredTrips) {
    const key = `${t.year || 2025}|${t.status || 'budgeted'}`;
    if (!groupMap[key]) groupMap[key] = [];
    groupMap[key].push(t);
  }
  const tripGroups = Object.entries(groupMap)
    .map(([key, groupTrips]) => {
      const [yearStr, status] = key.split('|');
      const sorted = [...groupTrips].sort((a, b) => a.name.localeCompare(b.name));
      return { year: Number(yearStr), status, trips: sorted };
    })
    .sort((a, b) => b.year - a.year || STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  const chartData = filteredTrips.map(trip => ({
    name: trip.name,
    margin: trip.margin,
    grossProfit: trip.grossProfit,
    category: trip.category,
  }));

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
      {/* Filters */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Filters</h2>
          <button
            onClick={() => exportHistoricalTrips(
              filteredTrips,
              yearFilter === 'all' ? 'all_years' : yearFilter,
              selectedCategory || 'all_categories',
              statusFilter === 'all' ? undefined : statusFilter
            )}
            className="btn btn-secondary text-sm"
          >
            Export to Excel
          </button>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <p className="text-xs text-ag-text-muted">Year</p>
              <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="text-sm">
                <option value="all">All Years</option>
                {availableYears.map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xs text-ag-text-muted">Status</p>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm">
                <option value="all">All Statuses</option>
                <option value="run">Run</option>
                <option value="open-enrollment">Open Enrollment</option>
                <option value="budgeted">Budgeted</option>
                <option value="scratch">Scratch</option>
              </select>
            </div>
          </div>
          <div>
            <p className="text-xs text-ag-text-muted mb-2">Category</p>
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
          {availableCountries.length > 0 && (
            <div>
              <p className="text-xs text-ag-text-muted mb-2">Country</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCountry(null)}
                  className={`btn ${selectedCountry === null ? 'btn-primary' : 'btn-secondary'}`}
                >
                  All
                </button>
                {availableCountries.map((country) => (
                  <button
                    key={country}
                    onClick={() => setSelectedCountry(country)}
                    className={`btn ${selectedCountry === country ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {country}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Margin chart */}
      <div className="card">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Margin by Trip</h2>
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

      {/* Dynamic trip tables — one per year+status group */}
      {tripGroups.length === 0 ? (
        <div className="card text-center text-ag-text-muted py-8 text-sm">
          No trips match the current filters.
        </div>
      ) : tripGroups.map(({ year, status, trips: groupTrips }) => {
        const isEditable = year >= currentYear;
        return (
          <TripTable
            key={`${year}-${status}`}
            trips={groupTrips}
            title={`${year} — ${STATUS_LABELS[status] || status}`}
            onLoadTrip={isEditable ? onLoadTrip : undefined}
            onDeleteTrip={isEditable ? deleteTrip : undefined}
            onUpdateTrip={isEditable ? updateTrip : undefined}
          />
        );
      })}

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
