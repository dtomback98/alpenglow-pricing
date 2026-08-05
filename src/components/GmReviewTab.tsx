'use client';

import { useState, useEffect, useMemo } from 'react';
import { useHistoricalData } from '@/hooks/useHistoricalData';
import { CATEGORY_COLORS, CATEGORY_LABELS, MONTHS, MONTH_ORDER } from '@/lib/constants';
import { formatCurrency, calculateForPax, calculateFinancialBreakdown } from '@/lib/calculations';
import { fetchTripConfigurationsByIds } from '@/lib/supabase';
import { TripConfiguration, HistoricalTrip, PaxCalculation } from '@/lib/types';
import actualsData from '@/lib/actuals-2026.json';

// ---------------------------------------------------------------- types

interface ActualLine { label: string; amount: number }
interface ActualBucket { total: number; lines: ActualLine[] }
interface ActualTrip {
  id: string;
  masterName: string;
  category: string;          // Beg | Inter | Adv | Ski | 8k E
  year: number;
  month: string | null;
  acctComplete: boolean;
  revenue: number | null;    // gross revenue from reporting sheet Master tab
  totalCogs: number;
  budgetTripName: string | null;
  masterRow: number;
  buckets: { [key: string]: ActualBucket };
}

const ACTUALS: ActualTrip[] = actualsData as unknown as ActualTrip[];

const BUCKET_ORDER: { key: string; label: string }[] = [
  { key: 'tripTravelLogistics', label: 'Trip Travel / Logistics' },
  { key: 'guideWages', label: 'Guide Wages' },
  { key: 'tripSupplies', label: 'Trip Supplies' },
  { key: 'commercialLicensing', label: 'Commercial Use & Licensing Fees' },
  { key: 'tripCommunications', label: 'Trip Communications' },
  { key: 'otherTripCosts', label: 'Other Trip Costs' },
];

const SECTION_ORDER = ['Beg', 'Inter', 'Adv', 'Ski', '8k E'];
const LINKS_STORAGE_KEY = 'gm-review-budget-links';
const NUM = 'text-right whitespace-nowrap tabular-nums';

interface BudgetBuckets {
  totals: { [key: string]: number };
  lines: { [key: string]: ActualLine[] };
  total: number;           // COGS-only budget total (insurance excluded)
}

// ---------------------------------------------------------------- budget helpers

/** Trip-specific item amount — mirrors calculateFinancialBreakdown's calcTsItem. */
function tsItemAmount(
  item: { amount: number; perPax: boolean; percentOfRevenue?: boolean; active?: boolean; minPax?: number | null; maxPax?: number | null } | undefined,
  pax: number,
  totalRevenue: number,
  isBands: boolean,
): number {
  if (!item || item.active === false) return 0;
  if (isBands) {
    const inRange = (item.minPax == null || pax >= item.minPax) && (item.maxPax == null || pax <= item.maxPax);
    if (!inRange) return 0;
  }
  if (item.percentOfRevenue) return item.amount * totalRevenue;
  return item.perPax ? item.amount * pax : item.amount;
}

/**
 * Budget bucketed to match the reporting-sheet conventions used for actuals:
 * staff meals under Trip Travel/Logistics, insurance excluded (COGS-only).
 */
function computeBudgetBuckets(pax: number, config: TripConfiguration, calc: PaxCalculation): BudgetBuckets {
  const breakdown = calculateFinancialBreakdown(pax, config, calc);
  const inflation = Math.max(0, 1 + (config.inflationRate || 0));
  const ts = config.tripSpecific;
  const tsOn = ts.enabled !== false;
  const isBands = ts.mode === 'bands';
  const insurance = tsOn ? tsItemAmount(ts.insurance, pax, calc.totalRevenue, isBands) * inflation : 0;

  const totals: { [key: string]: number } = {
    tripTravelLogistics: breakdown.tripTravelLogistics + calc.staffMealsCost,
    guideWages: breakdown.guideWages - calc.staffMealsCost,
    tripSupplies: breakdown.tripSupplies,
    commercialLicensing: breakdown.commercialLicensing,
    tripCommunications: breakdown.tripCommunications,
    otherTripCosts: breakdown.otherTripCosts - insurance,
  };

  const lines: { [key: string]: ActualLine[] } = {
    tripTravelLogistics: [], guideWages: [], tripSupplies: [],
    commercialLicensing: [], tripCommunications: [], otherTripCosts: [],
  };
  const push = (key: string, label: string, amount: number) => {
    if (amount !== 0) lines[key].push({ label, amount });
  };

  push('tripTravelLogistics', 'Logistics', calc.logisticsCost);
  push('tripTravelLogistics', 'Hotels', calc.hotelsCost);
  push('tripTravelLogistics', 'Meals', calc.mealsCost);
  push('tripTravelLogistics', 'Transport', calc.transportCost);
  push('tripTravelLogistics', 'Single rooms', calc.singleRoomCost);
  push('tripTravelLogistics', 'Guide flights', calc.guideFlightsCost);
  push('tripTravelLogistics', 'Staff meals', calc.staffMealsCost);
  push('tripTravelLogistics', 'Ext. logistics', calc.extensionLogisticsCost);
  push('tripTravelLogistics', 'Ext. hotels', calc.extensionHotelsCost);
  push('tripTravelLogistics', 'Ext. meals', calc.extensionMealsCost);
  push('tripTravelLogistics', 'Ext. single rooms', calc.extensionSingleRoomCost);
  push('guideWages', 'Staff wages', calc.staffCost);
  push('guideWages', 'Ext. staff', calc.extensionStaffCost);

  if (tsOn) {
    push('tripSupplies', 'Equipment', tsItemAmount(ts.equipment, pax, calc.totalRevenue, isBands) * inflation);
    push('tripSupplies', 'Jackets / apparel', tsItemAmount(ts.jacketsApparel, pax, calc.totalRevenue, isBands) * inflation);
    push('tripSupplies', 'Hypoxico', tsItemAmount(ts.hypoxico, pax, calc.totalRevenue, isBands) * inflation);
    push('commercialLicensing', 'Permits', tsItemAmount(ts.permits, pax, calc.totalRevenue, isBands) * inflation);
    push('otherTripCosts', 'Contingency', tsItemAmount(ts.contingency, pax, calc.totalRevenue, isBands) * inflation);
    push('otherTripCosts', 'Other costs', tsItemAmount(ts.otherCosts, pax, calc.totalRevenue, isBands) * inflation);
    for (const cc of ts.customCosts || []) {
      if (isBands) {
        const inRange = (cc.minPax == null || pax >= cc.minPax) && (cc.maxPax == null || pax <= cc.maxPax);
        if (!inRange) continue;
      }
      push('otherTripCosts', cc.label || 'Custom cost', (cc.perPax ? cc.amount * pax : cc.amount) * inflation);
    }
  }

  return { totals, lines, total: breakdown.total - insurance };
}

// ---------------------------------------------------------------- formatting

const fmtDelta = (v: number) => (
  <span className={v < 0 ? 'text-ag-danger' : 'text-ag-success'}>
    {v < 0 ? `(${formatCurrency(Math.abs(v))})` : formatCurrency(v)}
  </span>
);
const fmtGm = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtGmDelta = (v: number) => (
  <span className={v < 0 ? 'text-ag-danger' : 'text-ag-success'}>
    {v < 0 ? `(${Math.abs(v * 100).toFixed(1)}%)` : `+${(v * 100).toFixed(1)}%`}
  </span>
);

// ---------------------------------------------------------------- component

export default function GmReviewTab({ refreshKey }: { refreshKey?: number }) {
  const { trips: historyTrips, loading, refresh } = useHistoricalData();
  const [configMap, setConfigMap] = useState<Map<string, TripConfiguration>>(new Map());
  const [configsLoading, setConfigsLoading] = useState(false);
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [linkOverrides, setLinkOverrides] = useState<{ [actualId: string]: string }>({});
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    if (refreshKey && refreshKey > 0) refresh();
  }, [refreshKey, refresh]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LINKS_STORAGE_KEY);
      if (saved) setLinkOverrides(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const saveOverride = (actualId: string, historyTripId: string) => {
    setLinkOverrides(prev => {
      const next = { ...prev, [actualId]: historyTripId };
      try { localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // ---- filters
  const availableYears = Array.from(new Set(ACTUALS.map(a => a.year))).sort((a, b) => b - a);
  const availableMonths = MONTHS.filter(m => ACTUALS.some(a => a.month === m));
  const hasNoMonth = ACTUALS.some(a => !a.month);

  const filtered = ACTUALS.filter(a => {
    if (yearFilter !== 'all' && a.year !== Number(yearFilter)) return false;
    if (monthFilter !== 'all') {
      if (monthFilter === 'none' ? a.month !== null : a.month !== monthFilter) return false;
    }
    if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
    return true;
  });

  // ---- budget resolution: override → saved name match → best-guess among Run trips
  const { map: linkedTripIds, guessed: guessedIds } = useMemo(() => {
    const byName = new Map<string, HistoricalTrip>();
    for (const t of historyTrips) byName.set(t.name.trim(), t);
    const runOnly = historyTrips.filter(t => t.status === 'run');
    const STOP = new Set(['private', 'pvt', 'the', 'and', 'trip', 'open', 'day', 'pax', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 'october', 'november', 'december']);
    const tokens = (s: string) => new Set(
      s.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w))
    );
    const map = new Map<string, HistoricalTrip>();
    const guessed = new Set<string>();
    for (const a of ACTUALS) {
      const overrideId = linkOverrides[a.id];
      if (overrideId === '') continue; // explicitly unlinked
      if (overrideId) {
        const t = historyTrips.find(ht => ht.id === overrideId);
        if (t) { map.set(a.id, t); continue; }
      }
      if (a.budgetTripName) {
        const t = byName.get(a.budgetTripName.trim());
        if (t) { map.set(a.id, t); continue; }
      }
      // best guess: needs at least 2 shared meaningful name words with a Run-status trip
      const at = tokens(a.masterName);
      let best: HistoricalTrip | null = null;
      let bestScore = 1;
      for (const t of runOnly) {
        let score = 0;
        tokens(t.name).forEach(w => { if (at.has(w)) score += 1; });
        if (score > bestScore) { best = t; bestScore = score; }
      }
      if (best) { map.set(a.id, best); guessed.add(a.id); }
    }
    return { map, guessed };
  }, [historyTrips, linkOverrides]);

  useEffect(() => {
    const ids = Array.from(new Set(
      Array.from(linkedTripIds.values())
        .map(t => t.tripConfigId)
        .filter((id): id is string => Boolean(id))
    ));
    if (ids.length === 0) { setConfigMap(new Map()); return; }
    setConfigsLoading(true);
    fetchTripConfigurationsByIds(ids).then(map => {
      setConfigMap(map);
      setConfigsLoading(false);
    });
  }, [linkedTripIds]);

  const budgets = useMemo(() => {
    const map = new Map<string, BudgetBuckets>();
    linkedTripIds.forEach((histTrip, actualId) => {
      const config = histTrip.tripConfigId ? configMap.get(histTrip.tripConfigId) : undefined;
      if (!config) return;
      const calc = calculateForPax(histTrip.pax, config);
      map.set(actualId, computeBudgetBuckets(histTrip.pax, config, calc));
    });
    return map;
  }, [linkedTripIds, configMap]);

  // ---- expand helpers
  const allExpanded = filtered.length > 0 && filtered.every(a => expandedTrips.has(a.id));
  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedTrips(new Set());
      setExpandedCats(new Set());
    } else {
      setExpandedTrips(new Set(filtered.map(a => a.id)));
    }
  };
  const toggleTrip = (id: string) => setExpandedTrips(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleCat = (id: string) => setExpandedCats(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // ---- totals for filtered set
  const sections = SECTION_ORDER
    .map(cat => ({ cat, trips: filtered.filter(a => a.category === cat).sort((a, b) => a.masterRow - b.masterRow) }))
    .filter(s => s.trips.length > 0);

  const totals = { revenue: 0, budget: 0, budgetRevenue: 0, actual: 0, linked: 0 };
  for (const a of filtered) {
    totals.revenue += a.revenue || 0;
    totals.actual += a.totalCogs;
    const b = budgets.get(a.id);
    if (b) { totals.budget += b.total; totals.budgetRevenue += a.revenue || 0; totals.linked += 1; }
  }

  if (loading || configsLoading) {
    return <div className="text-center text-ag-text-muted py-8">Loading GM review data...</div>;
  }

  const runTrips = historyTrips
    .filter(t => t.status === 'run')
    .sort((x, y) => x.name.localeCompare(y.name));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <p className="text-xs text-ag-text-muted">Year</p>
              <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="text-sm">
                <option value="all">All Years</option>
                {availableYears.map(y => <option key={y} value={String(y)}>{y}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xs text-ag-text-muted">Month</p>
              <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="text-sm">
                <option value="all">All Months</option>
                {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                {hasNoMonth && <option value="none">No date set</option>}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xs text-ag-text-muted">Category</p>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="text-sm">
                <option value="all">All Categories</option>
                {SECTION_ORDER.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
              </select>
            </div>
          </div>
          <button onClick={toggleExpandAll} className="btn btn-secondary text-sm">
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-ag-card rounded-lg p-4 border border-ag-border">
          <div className="text-xs text-ag-text-muted mb-1">Revenue</div>
          <div className="text-xl font-bold tabular-nums">{formatCurrency(totals.revenue)}</div>
          <div className="text-xs text-ag-text-muted mt-1">{filtered.length} trip{filtered.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="bg-ag-card rounded-lg p-4 border border-ag-border">
          <div className="text-xs text-ag-text-muted mb-1">Budgeted COGS</div>
          <div className="text-xl font-bold tabular-nums">{totals.linked > 0 ? formatCurrency(totals.budget) : '—'}</div>
          <div className="text-xs text-ag-text-muted mt-1">{totals.linked} of {filtered.length} linked</div>
        </div>
        <div className="bg-ag-card rounded-lg p-4 border border-ag-border">
          <div className="text-xs text-ag-text-muted mb-1">Actual COGS</div>
          <div className="text-xl font-bold tabular-nums">{formatCurrency(totals.actual)}</div>
          <div className="text-xs text-ag-text-muted mt-1">from reporting sheet</div>
        </div>
        <div className="bg-ag-card rounded-lg p-4 border border-ag-border">
          <div className="text-xs text-ag-text-muted mb-1">Delta (linked trips)</div>
          <div className="text-xl font-bold tabular-nums">
            {totals.linked > 0
              ? fmtDelta(totals.budget - filtered.reduce((s, a) => s + (budgets.get(a.id) ? a.totalCogs : 0), 0))
              : '—'}
          </div>
          <div className="text-xs text-ag-text-muted mt-1">budget − actual</div>
        </div>
        <div className="bg-ag-card rounded-lg p-4 border border-ag-border">
          <div className="text-xs text-ag-text-muted mb-1">Actual GM</div>
          <div className="text-xl font-bold tabular-nums">
            {totals.revenue > 0 ? fmtGm((totals.revenue - totals.actual) / totals.revenue) : '—'}
          </div>
          <div className="text-xs text-ag-text-muted mt-1">on filtered trips</div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold">Budget vs. Actuals by Trip</h2>
          <p className="text-xs text-ag-text-muted">Click a trip for QB categories · click a category for line items</p>
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-ag-text-muted py-4">No trips match the current filters.</p>
        ) : (
          <table className="pricing-table">
            <thead>
              <tr>
                <th className="w-6"></th>
                <th>Trip</th>
                <th className="text-center whitespace-nowrap" title="Accounting complete on the reporting sheet">Acct ✓</th>
                <th className={NUM}>Revenue</th>
                <th className={NUM}>Budgeted</th>
                <th className={NUM}>Actuals</th>
                <th className={NUM}>Delta</th>
                <th className={NUM} title="(Revenue − Budgeted) / Revenue">Budg. GM</th>
                <th className={NUM} title="(Revenue − Actuals) / Revenue">Act. GM</th>
                <th className={NUM} title="Actual GM − Budgeted GM">GM Δ</th>
              </tr>
            </thead>
            <tbody>
              {sections.map(({ cat, trips: sectionTrips }) => {
                const color = CATEGORY_COLORS[cat] || '#3b82f6';
                const sec = { revenue: 0, budget: 0, hasBudget: false, actual: 0, actualLinked: 0 };
                for (const a of sectionTrips) {
                  sec.revenue += a.revenue || 0;
                  sec.actual += a.totalCogs;
                  const b = budgets.get(a.id);
                  if (b) { sec.budget += b.total; sec.hasBudget = true; sec.actualLinked += a.totalCogs; }
                }
                return (
                  <SectionBlock
                    key={cat}
                    cat={cat}
                    color={color}
                    trips={sectionTrips}
                    sec={sec}
                    budgets={budgets}
                    linkedTripIds={linkedTripIds}
                    expandedTrips={expandedTrips}
                    expandedCats={expandedCats}
                    toggleTrip={toggleTrip}
                    toggleCat={toggleCat}
                    historyTrips={runTrips}
                    guessedIds={guessedIds}
                    linkOverrides={linkOverrides}
                    onLinkChange={saveOverride}
                  />
                );
              })}
              {sections.length > 1 && (
                <tr className="font-bold">
                  <td className="border-t-2 border-ag-text-muted"></td>
                  <td className="border-t-2 border-ag-text-muted pt-3">Total All Trips</td>
                  <td className="border-t-2 border-ag-text-muted"></td>
                  <td className={`${NUM} border-t-2 border-ag-text-muted pt-3`}>{formatCurrency(totals.revenue)}</td>
                  <td className={`${NUM} border-t-2 border-ag-text-muted pt-3`}>{totals.linked > 0 ? formatCurrency(totals.budget) : '—'}</td>
                  <td className={`${NUM} border-t-2 border-ag-text-muted pt-3`}>{formatCurrency(totals.actual)}</td>
                  <td className={`${NUM} border-t-2 border-ag-text-muted pt-3`}>
                    {totals.linked > 0
                      ? fmtDelta(totals.budget - filtered.reduce((s, a) => s + (budgets.get(a.id) ? a.totalCogs : 0), 0))
                      : '—'}
                  </td>
                  <td className={`${NUM} border-t-2 border-ag-text-muted pt-3`}>{totals.budgetRevenue > 0 ? fmtGm((totals.budgetRevenue - totals.budget) / totals.budgetRevenue) : '—'}</td>
                  <td className={`${NUM} border-t-2 border-ag-text-muted pt-3`}>{totals.revenue > 0 ? fmtGm((totals.revenue - totals.actual) / totals.revenue) : '—'}</td>
                  <td className="border-t-2 border-ag-text-muted"></td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Notes */}
      <div className="card text-sm text-ag-text-muted space-y-1">
        <div className="font-medium text-ag-text mb-2">Notes</div>
        <p>· Actuals are COGS line items from each trip tab&apos;s EXPENSES block on the reporting sheet — admin costs (Insurance, AE Overhead Fee, Gear Replacement) excluded. To match, budget-side insurance is also excluded.</p>
        <p>· QB bucketing verified against the reporting sheet&apos;s own rollup blocks (8 of 9 tie exactly; Aconcagua #3&apos;s sheet block leaves its $11,340 permits unassigned — shown here under Commercial Use so the trip ties to its subtotal).</p>
        <p>· Budget staff meals are shown under Trip Travel/Logistics to match the reporting sheet&apos;s convention for actuals.</p>
        <p>· Budg. GM = (Revenue − Budgeted) / Revenue on the sheet&apos;s actual revenue; GM Δ = Actual GM − Budg. GM (red = margin below budget).</p>
        <p>· Trips with partial accounting (no ✓) overstate Actual GM until all costs land. Everest 2026 is excluded (its reporting tab has a different layout with no Actuals column).</p>
        <p>· Expand a trip to change which budgeted trip it compares against (Run-status trips only; auto-matched guesses are flagged; your picks save in this browser). Actuals refresh by regenerating actuals-2026.json from the reporting sheet.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- section + trip rows

interface SectionBlockProps {
  cat: string;
  color: string;
  trips: ActualTrip[];
  sec: { revenue: number; budget: number; hasBudget: boolean; actual: number; actualLinked: number };
  budgets: Map<string, BudgetBuckets>;
  linkedTripIds: Map<string, HistoricalTrip>;
  expandedTrips: Set<string>;
  expandedCats: Set<string>;
  toggleTrip: (id: string) => void;
  toggleCat: (id: string) => void;
  historyTrips: HistoricalTrip[];
  guessedIds: Set<string>;
  linkOverrides: { [actualId: string]: string };
  onLinkChange: (actualId: string, historyTripId: string) => void;
}

function SectionBlock({
  cat, color, trips, sec, budgets, linkedTripIds, expandedTrips, expandedCats,
  toggleTrip, toggleCat, historyTrips, guessedIds, linkOverrides, onLinkChange,
}: SectionBlockProps) {
  return (
    <>
      <tr>
        <td colSpan={10} className="pt-6 pb-1 border-b-0">
          <span
            className="inline-block text-xs font-bold uppercase tracking-widest px-2 py-1 rounded"
            style={{ color, backgroundColor: `${color}1a` }}
          >
            {CATEGORY_LABELS[cat] || cat}
          </span>
        </td>
      </tr>
      {trips.map(a => {
        const b = budgets.get(a.id);
        const linked = linkedTripIds.get(a.id);
        const isOpen = expandedTrips.has(a.id);
        const rev = a.revenue;
        const budgGm = rev && b ? (rev - b.total) / rev : null;
        const actGm = rev ? (rev - a.totalCogs) / rev : null;
        return (
          <TripRows
            key={a.id}
            actual={a}
            budget={b}
            linked={linked}
            isOpen={isOpen}
            expandedCats={expandedCats}
            toggleTrip={toggleTrip}
            toggleCat={toggleCat}
            historyTrips={historyTrips}
            isGuessed={guessedIds.has(a.id)}
            linkOverrides={linkOverrides}
            onLinkChange={onLinkChange}
            budgGm={budgGm}
            actGm={actGm}
          />
        );
      })}
      <tr className="font-semibold bg-ag-card-lighter/20">
        <td></td>
        <td>Total {CATEGORY_LABELS[cat] || cat}</td>
        <td></td>
        <td className={NUM}>{formatCurrency(sec.revenue)}</td>
        <td className={NUM}>{sec.hasBudget ? formatCurrency(sec.budget) : '—'}</td>
        <td className={NUM}>{formatCurrency(sec.actual)}</td>
        <td className={NUM}>{sec.hasBudget ? fmtDelta(sec.budget - sec.actualLinked) : '—'}</td>
        <td className={NUM}>{sec.revenue > 0 && sec.hasBudget ? fmtGm((sec.revenue - sec.budget) / sec.revenue) : '—'}</td>
        <td className={NUM}>{sec.revenue > 0 ? fmtGm((sec.revenue - sec.actual) / sec.revenue) : '—'}</td>
        <td></td>
      </tr>
    </>
  );
}

interface TripRowsProps {
  actual: ActualTrip;
  budget?: BudgetBuckets;
  linked?: HistoricalTrip;
  isOpen: boolean;
  expandedCats: Set<string>;
  toggleTrip: (id: string) => void;
  toggleCat: (id: string) => void;
  historyTrips: HistoricalTrip[];
  isGuessed: boolean;
  linkOverrides: { [actualId: string]: string };
  onLinkChange: (actualId: string, historyTripId: string) => void;
  budgGm: number | null;
  actGm: number | null;
}

function TripRows({
  actual: a, budget: b, linked, isOpen, expandedCats,
  toggleTrip, toggleCat, historyTrips, isGuessed, linkOverrides, onLinkChange, budgGm, actGm,
}: TripRowsProps) {
  const overrideValue = linkOverrides[a.id] !== undefined
    ? linkOverrides[a.id]
    : (linked ? linked.id : '');
  return (
    <>
      <tr
        className={`cursor-pointer hover:bg-ag-card-lighter/40 ${isOpen ? 'bg-ag-card-lighter/30' : ''}`}
        onClick={() => toggleTrip(a.id)}
      >
        <td className="text-ag-accent select-none text-xs">{isOpen ? '▼' : '▶'}</td>
        <td className="font-medium">
          {a.masterName}
          {a.month && <span className="text-xs text-ag-text-muted ml-2">{a.month} {a.year}</span>}
        </td>
        <td className="text-center text-ag-success">{a.acctComplete ? '✓' : ''}</td>
        <td className={NUM}>{a.revenue !== null ? formatCurrency(a.revenue) : '—'}</td>
        <td className={NUM}>{b ? formatCurrency(b.total) : <span className="text-ag-text-muted italic text-xs whitespace-nowrap">no budget linked</span>}</td>
        <td className={NUM}>{formatCurrency(a.totalCogs)}</td>
        <td className={NUM}>{b ? fmtDelta(b.total - a.totalCogs) : '—'}</td>
        <td className={NUM}>{budgGm !== null ? fmtGm(budgGm) : '—'}</td>
        <td className={NUM}>{actGm !== null ? fmtGm(actGm) : '—'}</td>
        <td className={NUM}>{budgGm !== null && actGm !== null ? fmtGmDelta(actGm - budgGm) : '—'}</td>
      </tr>
      {isOpen && (
        <tr className="bg-ag-card-lighter/10">
          <td></td>
          <td colSpan={9} className="py-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-xs text-ag-text-muted">
              <span>Budget source:</span>
              <select
                value={overrideValue}
                onChange={(e) => onLinkChange(a.id, e.target.value)}
                className="text-xs py-1"
              >
                <option value="">— none —</option>
                {(linked && !historyTrips.some(t => t.id === linked.id) ? [linked, ...historyTrips] : historyTrips).map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.pax} pax)
                  </option>
                ))}
              </select>
              {linked && <span>· computed at {linked.pax} pax</span>}
              {isGuessed && <span className="text-ag-accent">· auto-matched — confirm or change</span>}
            </div>
          </td>
        </tr>
      )}
      {isOpen && BUCKET_ORDER.map(({ key, label }) => {
        const act = a.buckets[key];
        const budTotal = b ? b.totals[key] || 0 : null;
        const actTotal = act ? act.total : 0;
        if (!act && (budTotal === null || budTotal === 0)) return null;
        const catId = `${a.id}:${key}`;
        const catOpen = expandedCats.has(catId);
        return (
          <CatRows
            key={catId}
            catId={catId}
            label={label}
            actLines={act ? act.lines : []}
            budLines={b ? b.lines[key] || [] : []}
            budTotal={budTotal}
            actTotal={actTotal}
            hasBudget={Boolean(b)}
            catOpen={catOpen}
            toggleCat={toggleCat}
          />
        );
      })}
    </>
  );
}

interface CatRowsProps {
  catId: string;
  label: string;
  actLines: ActualLine[];
  budLines: ActualLine[];
  budTotal: number | null;
  actTotal: number;
  hasBudget: boolean;
  catOpen: boolean;
  toggleCat: (id: string) => void;
}

function CatRows({ catId, label, actLines, budLines, budTotal, actTotal, hasBudget, catOpen, toggleCat }: CatRowsProps) {
  return (
    <>
      <tr
        className="text-sm cursor-pointer bg-ag-card-lighter/10 hover:bg-ag-card-lighter/30"
        onClick={() => toggleCat(catId)}
      >
        <td></td>
        <td className="pl-6">
          <span className="text-ag-accent text-[10px] mr-2 select-none">{catOpen ? '▼' : '▶'}</span>
          {label}
        </td>
        <td></td>
        <td></td>
        <td className={NUM}>{hasBudget && budTotal !== null ? formatCurrency(budTotal) : ''}</td>
        <td className={NUM}>{formatCurrency(actTotal)}</td>
        <td className={NUM}>{hasBudget && budTotal !== null ? fmtDelta(budTotal - actTotal) : ''}</td>
        <td colSpan={3}></td>
      </tr>
      {catOpen && budLines.map((l, i) => (
        <tr key={`b${i}`} className="text-xs text-ag-text-muted bg-ag-card-lighter/5">
          <td></td>
          <td className="pl-14 italic">{l.label} <span className="not-italic opacity-60">(budget)</span></td>
          <td></td>
          <td></td>
          <td className={`${NUM} italic`}>{formatCurrency(l.amount)}</td>
          <td colSpan={5}></td>
        </tr>
      ))}
      {catOpen && actLines.map((l, i) => (
        <tr key={`a${i}`} className="text-xs text-ag-text-muted bg-ag-card-lighter/5">
          <td></td>
          <td className="pl-14 italic">{l.label}</td>
          <td></td>
          <td></td>
          <td></td>
          <td className={`${NUM} italic`}>{formatCurrency(l.amount)}</td>
          <td colSpan={4}></td>
        </tr>
      ))}
    </>
  );
}
