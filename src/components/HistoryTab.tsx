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
  onLoadTrip?: (trip: HistoricalTrip) => void;
  refreshKey?: number;
  onTripConfigRenamed?: () => void;
  loadedHistoryEntryId?: string;
  onTripDeleted?: (id: string) => void;
  expeditions: string[];
  addExpedition: (name: string) => boolean;
  onNotesUpdated?: (id: string, notes: string) => void;
}

function TripTable({ trips, title, onLoadTrip, onDeleteTrip, onUpdateTrip, onTripConfigRenamed, loadedHistoryEntryId, onTripDeleted, expeditions, onNotesUpdated }: {
  trips: HistoricalTrip[];
  title: string;
  onLoadTrip?: (trip: HistoricalTrip) => void;
  onDeleteTrip?: (id: string) => Promise<boolean>;
  onUpdateTrip?: (id: string, updates: { status?: string; notes?: string; name?: string; country?: string }) => Promise<boolean>;
  onTripConfigRenamed?: () => void;
  loadedHistoryEntryId?: string;
  onTripDeleted?: (id: string) => void;
  expeditions: string[];
  onNotesUpdated?: (id: string, notes: string) => void;
}) {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNameText, setEditNameText] = useState('');

  if (trips.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        <p className="text-sm text-ag-text-muted">No trips to display.</p>
      </div>
    );
  }

  const hasActions = !!(onLoadTrip || onDeleteTrip);

  return (
    <div className="card overflow-x-auto">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <table className="pricing-table history-table">
        <thead>
          <tr>
            <th>Trip</th>
            <th>Cat</th>
            <th>Status</th>
            <th>Expedition</th>
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
            <tr key={trip.id} className={trip.id === loadedHistoryEntryId ? 'bg-ag-accent/10' : ''}>

              {/* Trip name — click to edit */}
              <td className="font-medium" style={{ maxWidth: '160px' }}>
                {editingNameId === trip.id ? (
                  <input
                    type="text"
                    value={editNameText}
                    autoFocus
                    onChange={(e) => setEditNameText(e.target.value)}
                    onBlur={async () => {
                      const trimmed = editNameText.trim();
                      if (trimmed && trimmed !== trip.name && onUpdateTrip) {
                        await onUpdateTrip(trip.id, { name: trimmed });
                        onTripConfigRenamed?.();
                      }
                      setEditingNameId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') setEditingNameId(null);
                    }}
                    className="w-full"
                  />
                ) : (
                  <span
                    className={`block overflow-hidden text-ellipsis whitespace-nowrap ${onUpdateTrip ? 'cursor-pointer hover:text-ag-accent' : ''}`}
                    title={trip.name}
                    onClick={() => {
                      if (onUpdateTrip) {
                        setEditingNameId(trip.id);
                        setEditNameText(trip.name);
                      }
                    }}
                  >
                    {trip.name}
                  </span>
                )}
              </td>

              {/* Category badge */}
              <td className="whitespace-nowrap">
                {trip.category && (
                  <span
                    className="px-1.5 py-0.5 rounded text-xs font-medium"
                    style={{ backgroundColor: `${CATEGORY_COLORS[trip.category] || '#3b82f6'}30`, color: CATEGORY_COLORS[trip.category] || '#3b82f6' }}
                  >
                    {trip.category}
                  </span>
                )}
              </td>

              {/* Status — inline select for editable rows, badge for readonly */}
              <td className="whitespace-nowrap">
                {onUpdateTrip ? (
                  <select
                    value={trip.status || 'budgeted'}
                    onChange={async (e) => { await onUpdateTrip(trip.id, { status: e.target.value }); }}
                  >
                    <option value="budgeted">Budgeted</option>
                    <option value="open-enrollment">Open Enrollment</option>
                    <option value="for-review">For Review</option>
                    <option value="run">Run</option>
                    <option value="scratch">Scratch</option>
                  </select>
                ) : (
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_BADGE_CLASSES[trip.status || 'budgeted'] || STATUS_BADGE_CLASSES['budgeted']}`}>
                    {STATUS_LABELS[trip.status || 'budgeted'] || 'Budgeted'}
                  </span>
                )}
              </td>

              {/* Country — inline select for editable rows, text for readonly */}
              <td className="whitespace-nowrap">
                {onUpdateTrip ? (
                  <select
                    value={trip.country || 'Other'}
                    onChange={async (e) => { await onUpdateTrip(trip.id, { country: e.target.value }); }}
                  >
                    {expeditions.map(c => <option key={c} value={c}>{c}</option>)}
                    {trip.country && !expeditions.includes(trip.country) && (
                      <option key={trip.country} value={trip.country}>{trip.country}</option>
                    )}
                  </select>
                ) : (
                  <span className="text-ag-text-muted">{trip.country || 'Other'}</span>
                )}
              </td>

              <td className="whitespace-nowrap">{trip.pax}</td>
              <td className="whitespace-nowrap">{formatCurrency(trip.pricePerPax)}</td>
              <td className="whitespace-nowrap">{formatCurrency(trip.revenue)}</td>
              <td className={`whitespace-nowrap ${trip.grossProfit >= 0 ? 'text-ag-success' : 'text-ag-danger'}`}>
                {formatCurrency(trip.grossProfit)}
              </td>
              <td className={`whitespace-nowrap ${getMarginColor(trip.margin)}`}>{formatPercent(trip.margin)}</td>

              {/* Notes — click to edit, truncated display */}
              <td style={{ minWidth: '100px', maxWidth: '200px' }}>
                {editingNoteId === trip.id ? (
                  <div className="flex flex-col gap-1">
                    <textarea
                      value={editNoteText}
                      autoFocus
                      onChange={(e) => setEditNoteText(e.target.value)}
                      className="w-full p-1"
                      rows={2}
                    />
                    <div className="flex gap-1">
                      <button className="btn btn-primary text-xs py-0.5 px-2" onClick={async () => {
                        if (onUpdateTrip) await onUpdateTrip(trip.id, { notes: editNoteText });
                        onNotesUpdated?.(trip.id, editNoteText);
                        setEditingNoteId(null);
                      }}>Save</button>
                      <button className="btn btn-secondary text-xs py-0.5 px-2" onClick={() => setEditingNoteId(null)}>×</button>
                    </div>
                  </div>
                ) : (
                  <span
                    className={`text-ag-text-muted ${onUpdateTrip ? 'cursor-pointer hover:text-ag-accent' : ''}`}
                    title={trip.notes || undefined}
                    onClick={() => {
                      if (onUpdateTrip) {
                        setEditingNoteId(trip.id);
                        setEditNoteText(trip.notes || '');
                      }
                    }}
                    style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}
                  >
                    {trip.notes
                      ? (trip.notes.length > 55 ? trip.notes.slice(0, 55) + '…' : trip.notes)
                      : (onUpdateTrip ? <span className="text-ag-border italic">add note</span> : '—')}
                  </span>
                )}
              </td>

              {/* Actions — Load + Delete only */}
              {hasActions && (
                <td className="whitespace-nowrap">
                  <div className="flex gap-1">
                    {onLoadTrip && trip.tripConfigId && (
                      <button onClick={() => onLoadTrip(trip)} className="btn btn-secondary text-xs py-0.5 px-2">
                        Load
                      </button>
                    )}
                    {onDeleteTrip && (
                      <button
                        onClick={async () => {
                          if (confirm(`Delete "${trip.name}" from history?`)) {
                            const success = await onDeleteTrip(trip.id);
                            if (success) onTripDeleted?.(trip.id);
                          }
                        }}
                        className="btn btn-danger text-xs py-0.5 px-2"
                      >
                        Del
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

export default function HistoryTab({ onLoadTrip, refreshKey, onTripConfigRenamed, loadedHistoryEntryId, onTripDeleted, expeditions, addExpedition, onNotesUpdated }: HistoryTabProps) {
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
  const [showNewExpedition, setShowNewExpedition] = useState(false);
  const [newExpeditionName, setNewExpeditionName] = useState('');

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
                <option value="for-review">For Review</option>
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
              <p className="text-xs text-ag-text-muted mb-2">Expedition</p>
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
                {showNewExpedition ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newExpeditionName}
                      autoFocus
                      onChange={(e) => setNewExpeditionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const added = addExpedition(newExpeditionName);
                          if (added) setSelectedCountry(newExpeditionName.trim());
                          setShowNewExpedition(false);
                          setNewExpeditionName('');
                        }
                        if (e.key === 'Escape') {
                          setShowNewExpedition(false);
                          setNewExpeditionName('');
                        }
                      }}
                      placeholder="Expedition name"
                      className="text-sm w-36"
                    />
                    <button
                      className="btn btn-primary text-xs py-0.5 px-2"
                      onClick={() => {
                        const added = addExpedition(newExpeditionName);
                        if (added) setSelectedCountry(newExpeditionName.trim());
                        setShowNewExpedition(false);
                        setNewExpeditionName('');
                      }}
                    >
                      Add
                    </button>
                    <button
                      className="btn btn-secondary text-xs py-0.5 px-2"
                      onClick={() => { setShowNewExpedition(false); setNewExpeditionName(''); }}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewExpedition(true)}
                    className="btn btn-secondary text-xs"
                  >
                    + New Expedition
                  </button>
                )}
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
            onTripConfigRenamed={isEditable ? onTripConfigRenamed : undefined}
            loadedHistoryEntryId={loadedHistoryEntryId}
            onTripDeleted={isEditable ? onTripDeleted : undefined}
            expeditions={expeditions}
            onNotesUpdated={onNotesUpdated}
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
