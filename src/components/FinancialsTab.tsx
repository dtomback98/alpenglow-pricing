'use client';

import { useState, useEffect } from 'react';
import { useHistoricalData } from '@/hooks/useHistoricalData';
import { CATEGORY_COLORS, CATEGORY_LABELS, STATUS_LABELS, STATUS_BADGE_CLASSES } from '@/lib/constants';
import { formatCurrency, formatPercent, getMarginColor, calculateFinancialBreakdown } from '@/lib/calculations';
import { fetchTripConfigurationsByIds } from '@/lib/supabase';
import { TripConfiguration, FinancialBreakdown } from '@/lib/types';

const CATEGORIES = ['All', 'Beg', 'Inter', 'Adv', 'Ski', '8k E'];

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
}

export default function FinancialsTab({ refreshKey }: FinancialsTabProps) {
  const { trips, loading, error, selectedCategory, setSelectedCategory, refresh } = useHistoricalData();
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [configMap, setConfigMap] = useState<Map<string, TripConfiguration>>(new Map());
  const [configsLoading, setConfigsLoading] = useState(false);

  const currentYear = new Date().getFullYear();

  // Re-fetch when refreshKey changes (after Save to History)
  useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      refresh();
    }
  }, [refreshKey, refresh]);

  // Fetch trip configs whenever the trips list changes
  useEffect(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const t of trips) {
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
  }, [trips]);

  // Derive unique years from loaded trips for the year dropdown
  const yearMap: Record<number, true> = {};
  for (const t of trips) { yearMap[t.year || 2025] = true; }
  const availableYears = Object.keys(yearMap).map(Number).sort((a, b) => b - a);

  // Apply year + status filters (category already filtered by the hook)
  const filteredTrips = trips.filter(t => {
    if (yearFilter !== 'all') {
      if (yearFilter === '2025' ? (t.year || 2025) !== 2025 : t.year !== Number(yearFilter)) return false;
    }
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    return true;
  });

  // Compute financial breakdown for each filtered trip
  const tripRows = filteredTrips.map(trip => {
    const config = trip.tripConfigId ? configMap.get(trip.tripConfigId) : undefined;
    const breakdown = config ? calculateFinancialBreakdown(trip.pax, config) : null;
    return { trip, breakdown };
  });

  const rowsWithBreakdown = tripRows.filter(r => r.breakdown !== null);

  // Aggregate totals across trips that have breakdown data
  const totals = rowsWithBreakdown.reduce(
    (acc, { trip, breakdown }) => {
      acc.revenue += trip.revenue;
      acc.grossProfit += trip.grossProfit;
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
        <h2 className="text-lg font-semibold mb-4">Filters</h2>
        <div className="flex flex-wrap items-center gap-4">
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
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="text-sm"
          >
            <option value="all">All Years</option>
            {availableYears.map(y => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="run">Run</option>
            <option value="open-enrollment">Open Enrollment</option>
            <option value="budgeted">Budgeted</option>
            <option value="scratch">Scratch</option>
          </select>
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
              <div key={key} className="bg-ag-surface rounded-lg p-3">
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
        <h2 className="text-lg font-semibold mb-4">Cost Breakdown by Trip</h2>
        {filteredTrips.length === 0 ? (
          <p className="text-sm text-ag-text-muted">No trips match the current filters.</p>
        ) : (
          <table className="pricing-table">
            <thead>
              <tr>
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
              {tripRows.map(({ trip, breakdown }) => (
                <tr key={trip.id}>
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
                  <td>{trip.year || 2025}</td>
                  <td>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_BADGE_CLASSES[trip.status || 'budgeted'] || STATUS_BADGE_CLASSES['budgeted']}`}>
                      {STATUS_LABELS[trip.status || 'budgeted'] || 'Budgeted'}
                    </span>
                  </td>
                  <td>{trip.pax}</td>
                  <td>{formatCurrency(trip.revenue)}</td>
                  {breakdown ? (
                    <>
                      {FINANCIAL_CATEGORIES.map(({ key }) => (
                        <td key={key}>{formatCurrency(breakdown[key] as number)}</td>
                      ))}
                      <td>{formatCurrency(breakdown.total)}</td>
                    </>
                  ) : (
                    <>
                      <td colSpan={FINANCIAL_CATEGORIES.length} className="text-center text-ag-text-muted text-xs italic">
                        no config data
                      </td>
                      <td>{formatCurrency(trip.revenue - trip.grossProfit)}</td>
                    </>
                  )}
                  <td className={getMarginColor(trip.margin)}>{formatPercent(trip.margin)}</td>
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
              {key === 'otherTripCosts' && 'Insurance · Contingency · Other costs · Custom costs'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
