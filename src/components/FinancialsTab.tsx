'use client';

import { useState, useEffect } from 'react';
import { useHistoricalData } from '@/hooks/useHistoricalData';
import { CATEGORY_COLORS, CATEGORY_LABELS, STATUS_LABELS, STATUS_BADGE_CLASSES } from '@/lib/constants';
import { formatCurrency, formatPercent, getMarginColor, calculateFinancialBreakdown, calculateForPax } from '@/lib/calculations';
import { PaxCalculation } from '@/lib/types';
import { fetchTripConfigurationsByIds } from '@/lib/supabase';
import { TripConfiguration, FinancialBreakdown } from '@/lib/types';
import { exportFinancialsBreakdown } from '@/lib/excelExport';

const CATEGORIES = ['All', 'Beg', 'Inter', 'Adv', 'Ski', '8k E'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const FINANCIAL_CATEGORIES: { key: keyof FinancialBreakdown; label: string; shortLabel: string }[] = [
  { key: 'tripTravelLogistics',  label: 'Trip Travel / Logistics',        shortLabel: 'Travel & Logistics' },
  { key: 'guideWages',           label: 'Guide Wages',                    shortLabel: 'Guide Wages' },
  { key: 'tripSupplies',         label: 'Trip Supplies',                  shortLabel: 'Trip Supplies' },
  { key: 'commercialLicensing',  label: 'Commercial Use & Licensing Fees', shortLabel: 'Comm. Use & Licensing' },
  { key: 'tripCommunications',   label: 'Trip Communications',            shortLabel: 'Trip Comms' },
  { key: 'otherTripCosts',       label: 'Other Trip Costs',               shortLabel: 'Other Costs' },
];

interface FinancialsTabProps {
  refreshKey?: number;
  expeditions: string[];
  addExpedition: (name: string) => boolean;
}

export default function FinancialsTab({ refreshKey, expeditions, addExpedition }: FinancialsTabProps) {
  const { trips, loading, error, selectedCategory, setSelectedCategory, refresh } = useHistoricalData();
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [showNewExpedition, setShowNewExpedition] = useState(false);
  const [newExpeditionName, setNewExpeditionName] = useState('');
  const [configMap, setConfigMap] = useState<Map<string, TripConfiguration>>(new Map());
  const [configsLoading, setConfigsLoading] = useState(false);
  const [selectedTripIds, setSelectedTripIds] = useState<Set<string>>(new Set());

  // Re-fetch when refreshKey changes (after Save to History)
  useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      refresh();
    }
  }, [refreshKey, refresh]);

  // Hard-exclude 2025 reference trips — financials tab shows current operations only
  const nonRefTrips = trips.filter(t => (t.year || 2025) !== 2025);

  // Fetch trip configs whenever the trips list changes
  useEffect(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const t of nonRefTrips) {
      if (t.tripConfigId && !seen.has(t.tripConfigId)) {
        seen.add(t.tripConfigId);
        ids.push(t.tripConfigId);
      }
    }
    if (ids.length === 0) {
      setConfigMap(new Map());
      return;
    }
    setConfigsLoading(true);
    fetchTripConfigurationsByIds(ids).then(map => {
      setConfigMap(map);
      setConfigsLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips]);

  // Derive sorted country list from non-reference trips for the expedition filter
  const countryMap: Record<string, true> = {};
  for (const t of nonRefTrips) { countryMap[t.country || 'Other'] = true; }
  const availableCountries = Object.keys(countryMap).sort();

  const countryFiltered = selectedCountry
    ? nonRefTrips.filter(t => (t.country || 'Other') === selectedCountry)
    : nonRefTrips;

  // Derive unique years from non-reference trips for the year dropdown
  const yearMap: Record<number, true> = {};
  for (const t of nonRefTrips) { yearMap[t.year || new Date().getFullYear()] = true; }
  const availableYears = Object.keys(yearMap).map(Number).sort((a, b) => b - a);

  // Apply year + status + month filters (category already filtered by the hook)
  const filteredTrips = countryFiltered.filter(t => {
    if (yearFilter !== 'all' && t.year !== Number(yearFilter)) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (monthFilter !== 'all' && (t.month || '') !== monthFilter) return false;
    return true;
  });

  // Clear selection when filters change
  useEffect(() => {
    setSelectedTripIds(new Set());
  }, [yearFilter, statusFilter, monthFilter, selectedCategory, selectedCountry]);

  // Compute financial breakdown for each filtered trip (single calculateForPax call per trip)
  const tripRows = filteredTrips.map(trip => {
    const config = trip.tripConfigId ? configMap.get(trip.tripConfigId) : undefined;
    const calc: PaxCalculation | null = config ? calculateForPax(trip.pax, config) : null;
    const breakdown = calc ? calculateFinancialBreakdown(trip.pax, config!, calc) : null;
    return { trip, breakdown, calc };
  });

  const rowsWithBreakdown = tripRows.filter(r => r.breakdown !== null);

  // Aggregate totals across trips that have breakdown data
  const totals = rowsWithBreakdown.reduce(
    (acc, { trip, breakdown, calc }) => {
      acc.revenue += calc ? calc.totalRevenue : trip.revenue;
      acc.grossProfit += calc ? calc.grossProfit : trip.grossProfit;
      if (breakdown) {
        acc.tripTravelLogistics += breakdown.tripTravelLogistics;
        acc.guideWages += breakdown.guideWages;
        acc.tripSupplies += breakdown.tripSupplies;
        acc.commercialLicensing += breakdown.commercialLicensing;
        acc.tripCommunications += breakdown.tripCommunications;
        acc.otherTripCosts += breakdown.otherTripCosts;
        acc.totalCosts += breakdown.total;
      }
      return acc;
    },
    {
      revenue: 0, grossProfit: 0, totalCosts: 0,
      tripTravelLogistics: 0, guideWages: 0, tripSupplies: 0,
      commercialLicensing: 0, tripCommunications: 0, otherTripCosts: 0,
    }
  );

  const allSelected = tripRows.length > 0 && tripRows.every(r => selectedTripIds.has(r.trip.id));
  const someSelected = tripRows.some(r => selectedTripIds.has(r.trip.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedTripIds(new Set());
    } else {
      setSelectedTripIds(new Set(tripRows.map(r => r.trip.id)));
    }
  };

  const toggleTrip = (id: string) => {
    setSelectedTripIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleExportSelected = () => {
    const selectedRows = tripRows
      .filter(r => selectedTripIds.has(r.trip.id))
      .map(({ trip, breakdown, calc }) => ({
        trip: calc
          ? { ...trip, revenue: calc.totalRevenue, grossProfit: calc.grossProfit, margin: calc.margin }
          : trip,
        breakdown,
      }));
    exportFinancialsBreakdown(selectedRows);
  };

  if (loading || configsLoading) {
    return <div className="text-center text-ag-text-muted py-8">Loading financial data...</div>;
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
              <p className="text-xs text-ag-text-muted">Month</p>
              <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="text-sm">
                <option value="all">All Months</option>
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xs text-ag-text-muted">Status</p>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm">
                <option value="all">All Statuses</option>
                <option value="run">Run</option>
                <option value="actuals">Actuals</option>
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

      {/* Category totals summary */}
      {rowsWithBreakdown.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-1">
            Financial Category Totals
          </h2>
          {rowsWithBreakdown.length < filteredTrips.length && (
            <p className="text-xs text-ag-text-muted mb-4">
              Showing {rowsWithBreakdown.length} of {filteredTrips.length} trips — trips without a linked config are excluded from totals.
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            {FINANCIAL_CATEGORIES.map(({ key, label }) => (
              <div key={key} className="bg-ag-card-lighter rounded-lg p-3">
                <div className="text-xs text-ag-text-muted mb-1 leading-tight">{label}</div>
                <div className="text-lg font-bold text-ag-text">{formatCurrency(totals[key as keyof typeof totals] as number)}</div>
                {totals.totalCosts > 0 && (
                  <div className="text-xs text-ag-text-muted mt-1">
                    {(((totals[key as keyof typeof totals] as number) / totals.totalCosts) * 100).toFixed(1)}% of costs
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="pt-4 border-t border-ag-border grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-ag-text-muted">Total Revenue</div>
              <div className="text-lg font-bold text-ag-text">{formatCurrency(totals.revenue)}</div>
            </div>
            <div>
              <div className="text-xs text-ag-text-muted">Total Costs</div>
              <div className="text-lg font-bold text-ag-text">{formatCurrency(totals.totalCosts)}</div>
            </div>
            <div>
              <div className="text-xs text-ag-text-muted">Gross Profit</div>
              <div className={`text-lg font-bold ${totals.grossProfit >= 0 ? 'text-ag-success' : 'text-ag-danger'}`}>
                {formatCurrency(totals.grossProfit)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Per-trip breakdown table */}
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Cost Breakdown by Trip</h2>
          {selectedTripIds.size > 0 && (
            <button onClick={handleExportSelected} className="btn btn-primary text-sm">
              Export {selectedTripIds.size} Trip{selectedTripIds.size !== 1 ? 's' : ''}
            </button>
          )}
        </div>
        {filteredTrips.length === 0 ? (
          <p className="text-sm text-ag-text-muted">No trips match the current filters.</p>
        ) : (
          <table className="pricing-table history-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={toggleAll}
                    className="cursor-pointer"
                  />
                </th>
                <th>Trip</th>
                <th>Cat</th>
                <th>Year</th>
                <th>Status</th>
                <th>Pax</th>
                <th>Revenue</th>
                {FINANCIAL_CATEGORIES.map(({ key, shortLabel }) => (
                  <th key={key}>{shortLabel}</th>
                ))}
                <th>Total Costs</th>
                <th>Margin</th>
              </tr>
            </thead>
            <tbody>
              {tripRows.map(({ trip, breakdown, calc }) => (
                <tr key={trip.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedTripIds.has(trip.id)}
                      onChange={() => toggleTrip(trip.id)}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="font-medium">{trip.name}</td>
                  <td>
                    {trip.category && (
                      <span
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: `${CATEGORY_COLORS[trip.category] || '#3b82f6'}30`,
                          color: CATEGORY_COLORS[trip.category] || '#3b82f6',
                        }}
                      >
                        {trip.category}
                      </span>
                    )}
                  </td>
                  <td>{trip.year || new Date().getFullYear()}</td>
                  <td>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_BADGE_CLASSES[trip.status || 'budgeted'] || STATUS_BADGE_CLASSES['budgeted']}`}>
                      {STATUS_LABELS[trip.status || 'budgeted'] || 'Budgeted'}
                    </span>
                  </td>
                  <td>{trip.pax}</td>
                  <td className="whitespace-nowrap">{formatCurrency(calc ? calc.totalRevenue : trip.revenue)}</td>
                  {breakdown && calc ? (
                    <>
                      {FINANCIAL_CATEGORIES.map(({ key }) => (
                        <td key={key} className="whitespace-nowrap">{formatCurrency(breakdown[key] as number)}</td>
                      ))}
                      <td className="whitespace-nowrap">{formatCurrency(breakdown.total)}</td>
                    </>
                  ) : (
                    <>
                      <td colSpan={FINANCIAL_CATEGORIES.length} className="text-center text-ag-text-muted text-xs italic">
                        no config data
                      </td>
                      <td className="whitespace-nowrap">{formatCurrency(trip.revenue - trip.grossProfit)}</td>
                    </>
                  )}
                  <td className={`whitespace-nowrap ${getMarginColor(calc ? calc.margin : trip.margin)}`}>{formatPercent(calc ? calc.margin : trip.margin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Category key */}
      <div className="card text-sm text-ag-text-muted space-y-1">
        <div className="font-medium text-ag-text mb-2">Financial Category Definitions</div>
        {FINANCIAL_CATEGORIES.map(({ label, key }) => (
          <div key={key} className="flex gap-2">
            <span className="font-medium text-ag-text">{label}:</span>
            <span>
              {key === 'tripTravelLogistics' && 'Transport (ground, airport, local) · Logistics · Hotels · Guest meals · Single room extras · Extension equivalents'}
              {key === 'guideWages' && 'Staff daily wages · Guide flights · Staff meals · Extension staff'}
              {key === 'tripSupplies' && 'Equipment · Jackets / apparel · Hypoxico'}
              {key === 'commercialLicensing' && 'Permits'}
              {key === 'tripCommunications' && '—'}
              {key === 'otherTripCosts' && 'Contingency · Other costs · Custom costs'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
