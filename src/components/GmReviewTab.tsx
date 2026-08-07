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

// Ordered keyword rules pairing actual line labels to budget lines within a
// bucket. First pattern that matches (and whose target budget line exists for
// the trip) wins. Only the label's prefix (before " - ") is tested — the note
// after the dash is free text and matching on it force-fits mixed expenses.
const LINE_RULES: { [bucket: string]: { pattern: RegExp; target: string }[] } = {
  tripTravelLogistics: [
    { pattern: /airfare|flight/, target: 'Guide flights' },
    { pattern: /hotel|lodg|hostal|hacienda|hosteria|refug|accommodat/, target: 'Hotels' },
    { pattern: /staff meal|guide meal/, target: 'Staff meals' },
    { pattern: /meal|food|grocer|restaurant/, target: 'Meals' },
    { pattern: /transport|vehicle|driver|shuttle/, target: 'Transport' },
    { pattern: /single/, target: 'Single rooms' },
    { pattern: /logistic|travel|expedition/, target: 'Logistics' },
  ],
  guideWages: [
    { pattern: /\bext\b|extension/, target: 'Ext. staff' },
    { pattern: /[\s\S]*/, target: 'Staff wages' },
  ],
  tripSupplies: [
    { pattern: /jacket|apparel|parka/, target: 'Jackets / apparel' },
    { pattern: /hypoxico|altitude tent/, target: 'Hypoxico' },
    { pattern: /equipment|gear/, target: 'Equipment' },
  ],
  commercialLicensing: [
    { pattern: /[\s\S]*/, target: 'Permits' },
  ],
  tripCommunications: [],
  otherTripCosts: [
    { pattern: /contingen/, target: 'Contingency' },
    { pattern: /other|general|misc/, target: 'Other costs' },
  ],
};

const GENERIC_WORDS = new Set(['trip', 'trips', 'cost', 'costs', 'other', 'guide', 'guides', 'expense', 'expenses', 'invoice', 'fees']);

/** Pair actual lines to budget lines within one QB bucket. */
function pairLines(bucketKey: string, budLines: ActualLine[], actLines: ActualLine[]) {
  const budLabels = new Set(budLines.map(l => l.label));
  const matched = new Map<string, ActualLine[]>();
  const unmatched: ActualLine[] = [];
  const rules = LINE_RULES[bucketKey] || [];
  for (const al of actLines) {
    const primary = al.label.toLowerCase().split(' - ')[0];
    let target: string | null = null;
    for (const r of rules) {
      if (r.pattern.test(primary) && budLabels.has(r.target)) { target = r.target; break; }
    }
    // custom budget lines (Other Trip Costs): pair on a shared distinctive word
    if (!target && bucketKey === 'otherTripCosts') {
      const at = new Set(primary.replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !GENERIC_WORDS.has(w)));
      for (const bl of budLines) {
        const bt = bl.label.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !GENERIC_WORDS.has(w));
        if (bt.some(w => at.has(w))) { target = bl.label; break; }
      }
    }
    if (target) {
      const arr = matched.get(target) || [];
      arr.push(al);
      matched.set(target, arr);
    } else {
      unmatched.push(al);
    }
  }
  return { matched, unmatched };
}

const SECTION_ORDER = ['Beg', 'Inter', 'Adv', 'Ski', '8k E'];
const LINKS_STORAGE_KEY = 'gm-review-budget-links';
const ACCT_STORAGE_KEY = 'gm-review-acct-overrides';
const NUM = 'text-right whitespace-nowrap tabular-nums';
const GRP = NUM + ' border-l border-ag-border/40';

interface BudgetBuckets {
  totals: { [key: string]: number };
  lines: { [key: string]: ActualLine[] };
  total: number;           // COGS-only budget total (insurance excluded)
  revenue: number;         // forecasted revenue at the linked trip's pax
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

  return { totals, lines, total: breakdown.total - insurance, revenue: calc.totalRevenue };
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

// ---------------------------------------------------------------- column headers

function HeaderRows() {
  return (
    <>
      <tr>
        <th className="w-6 sticky top-0 z-20" rowSpan={2}></th>
        <th className="sticky top-0 z-20 !py-1.5" rowSpan={2}>Trip</th>
        <th className="text-center whitespace-nowrap sticky top-0 z-20 !py-1.5" rowSpan={2} title="Accounting complete on the reporting sheet">✓</th>
        <th colSpan={2} className="sticky top-0 z-20 !py-1 h-6 border-l border-ag-border/40">
          <div className="mx-4 border-b border-ag-text-muted/50 pb-0.5 text-center text-[10px] font-bold tracking-[0.15em] text-ag-text">Revenue</div>
        </th>
        <th colSpan={3} className="sticky top-0 z-20 !py-1 h-6 border-l border-ag-border/40">
          <div className="mx-4 border-b border-ag-text-muted/50 pb-0.5 text-center text-[10px] font-bold tracking-[0.15em] text-ag-text">COGS</div>
        </th>
        <th colSpan={3} className="sticky top-0 z-20 !py-1 h-6 border-l border-ag-border/40">
          <div className="mx-4 border-b border-ag-text-muted/50 pb-0.5 text-center text-[10px] font-bold tracking-[0.15em] text-ag-text">Gross Margin</div>
        </th>
      </tr>
      <tr>
        <th className={`${GRP} sticky top-6 z-20 !py-1 text-[11px]`} title="The linked budget's own forecast revenue at its saved pax">Budgeted</th>
        <th className={`${NUM} sticky top-6 z-20 !py-1 text-[11px]`} title="Booked revenue from the reporting sheet">Actuals</th>
        <th className={`${GRP} sticky top-6 z-20 !py-1 text-[11px]`}>Budgeted</th>
        <th className={`${NUM} sticky top-6 z-20 !py-1 text-[11px]`}>Actuals</th>
        <th className={`${NUM} sticky top-6 z-20 !py-1 text-[11px]`} title="Budgeted − Actuals; red = over budget">Delta</th>
        <th className={`${GRP} sticky top-6 z-20 !py-1 text-[11px]`} title="(Budgeted Revenue − Budgeted COGS) / Budgeted Revenue — the original forecast at the linked trip's pax">Budgeted</th>
        <th className={`${NUM} sticky top-6 z-20 !py-1 text-[11px]`} title="(Actual Revenue − Actual COGS) / Actual Revenue">Actuals</th>
        <th className={`${NUM} sticky top-6 z-20 !py-1 text-[11px]`} title="Actual GM − Budgeted GM">Delta</th>
      </tr>
    </>
  );
}

// ---------------------------------------------------------------- component

export default function GmReviewTab({ refreshKey }: { refreshKey?: number }) {
  const { trips: historyTrips, loading, refresh } = useHistoricalData();
  const [configMap, setConfigMap] = useState<Map<string, TripConfiguration>>(new Map());
  const [configsLoading, setConfigsLoading] = useState(false);
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [linkOverrides, setLinkOverrides] = useState<{ [actualId: string]: string }>({});
  const [acctOverrides, setAcctOverrides] = useState<{ [actualId: string]: boolean }>({});
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [acctFilter, setAcctFilter] = useState<string>('all');

  useEffect(() => {
    if (refreshKey && refreshKey > 0) refresh();
  }, [refreshKey, refresh]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LINKS_STORAGE_KEY);
      if (saved) setLinkOverrides(JSON.parse(saved));
      const savedAcct = localStorage.getItem(ACCT_STORAGE_KEY);
      if (savedAcct) setAcctOverrides(JSON.parse(savedAcct));
    } catch { /* ignore */ }
  }, []);

  /** Effective accounting-complete: manual override here wins over the sheet. */
  const effAcct = (a: ActualTrip) => acctOverrides[a.id] !== undefined ? acctOverrides[a.id] : a.acctComplete;

  const toggleAcct = (id: string) => {
    setAcctOverrides(prev => {
      const sheetVal = ACTUALS.find(a => a.id === id)?.acctComplete ?? false;
      const cur = prev[id] !== undefined ? prev[id] : sheetVal;
      const next = { ...prev, [id]: !cur };
      if (next[id] === sheetVal) delete next[id]; // back in agreement with the sheet — drop the override
      try { localStorage.setItem(ACCT_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

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
    if (acctFilter === 'complete' && !effAcct(a)) return false;
    if (acctFilter === 'incomplete' && effAcct(a)) return false;
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
    if (b) { totals.budget += b.total; totals.budgetRevenue += b.revenue; totals.linked += 1; }
  }

  // Like-for-like comparison totals for the total rows: only trips that have BOTH a
  // linked budget and recorded actual revenue, so Budgeted and Actual sum over the
  // same set (the summary cards above keep the portfolio-wide totals).
  const cmp = { revB: 0, revA: 0, cogsB: 0, cogsA: 0, n: 0 };
  for (const a of filtered) {
    const b = budgets.get(a.id);
    if (!b || a.revenue === null) continue;
    cmp.revB += b.revenue; cmp.revA += a.revenue;
    cmp.cogsB += b.total;  cmp.cogsA += a.totalCogs;
    cmp.n += 1;
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
            <div className="flex items-center gap-3">
              <p className="text-xs text-ag-text-muted">Accounting</p>
              <select value={acctFilter} onChange={(e) => setAcctFilter(e.target.value)} className="text-sm">
                <option value="all">All Trips</option>
                <option value="complete">Complete ✓</option>
                <option value="incomplete">In Progress</option>
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
      <div className="card overflow-x-auto lg:overflow-visible">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold">Budget vs. Actuals by Trip</h2>
          <p className="text-xs text-ag-text-muted">Click a trip for QB categories · click a category for line items</p>
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-ag-text-muted py-4">No trips match the current filters.</p>
        ) : (
          <table className="pricing-table [&_td]:!py-2.5">
            <thead>
              <HeaderRows />
            </thead>
            <tbody>
              {sections.map(({ cat, trips: sectionTrips }) => {
                const color = CATEGORY_COLORS[cat] || '#3b82f6';
                // Like-for-like: only trips with BOTH a linked budget and recorded actual revenue.
                const sec = { revB: 0, revA: 0, cogsB: 0, cogsA: 0, n: 0 };
                for (const a of sectionTrips) {
                  const b = budgets.get(a.id);
                  if (!b || a.revenue === null) continue;
                  sec.revB += b.revenue; sec.revA += a.revenue;
                  sec.cogsB += b.total;  sec.cogsA += a.totalCogs;
                  sec.n += 1;
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
                    acctOverrides={acctOverrides}
                    onToggleAcct={toggleAcct}
                  />
                );
              })}
              {sections.length > 1 && (
                <tr className="font-bold bg-ag-accent/10">
                  <td className="border-t-2 border-ag-accent"></td>
                  <td className="border-t-2 border-ag-accent pt-3">
                    Total All Trips
                    <span
                      className="text-ag-text-muted font-normal cursor-help"
                      title="Total rows include only trips that have BOTH a linked budget and recorded actuals, so Budgeted and Actual are summed over the same set (a true like-for-like). Unlinked trips are left out here — the summary cards above hold the portfolio totals for every trip."
                    >&nbsp;†</span>
                  </td>
                  <td className="border-t-2 border-ag-accent"></td>
                  <td className={`${GRP} border-t-2 border-ag-accent pt-3`}>{cmp.n > 0 ? formatCurrency(cmp.revB) : '—'}</td>
                  <td className={`${NUM} border-t-2 border-ag-accent pt-3`}>{cmp.n > 0 ? formatCurrency(cmp.revA) : '—'}</td>
                  <td className={`${GRP} border-t-2 border-ag-accent pt-3`}>{cmp.n > 0 ? formatCurrency(cmp.cogsB) : '—'}</td>
                  <td className={`${NUM} border-t-2 border-ag-accent pt-3`}>{cmp.n > 0 ? formatCurrency(cmp.cogsA) : '—'}</td>
                  <td className={`${NUM} border-t-2 border-ag-accent pt-3`}>{cmp.n > 0 ? fmtDelta(cmp.cogsB - cmp.cogsA) : '—'}</td>
                  <td className={`${GRP} border-t-2 border-ag-accent pt-3`}>{cmp.revB > 0 ? fmtGm((cmp.revB - cmp.cogsB) / cmp.revB) : '—'}</td>
                  <td className={`${NUM} border-t-2 border-ag-accent pt-3`}>{cmp.revA > 0 ? fmtGm((cmp.revA - cmp.cogsA) / cmp.revA) : '—'}</td>
                  <td className="border-t-2 border-ag-accent"></td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Notes */}
      <div className="card text-sm text-ag-text-muted space-y-1">
        <div className="font-medium text-ag-text mb-2">Notes</div>
        <p>· <span className="text-ag-text">†</span> Total rows (each section and Total All Trips) include only trips that have both a linked budget and recorded actuals, so Budgeted and Actual are summed over the same trips — a true like-for-like comparison. Unlinked trips are excluded from the totals (they still appear as their own rows); the summary cards at the top are portfolio totals across every filtered trip.</p>
        <p>· Actuals are COGS line items from each trip tab&apos;s EXPENSES block on the reporting sheet — admin costs (Insurance, AE Overhead Fee, Gear Replacement) excluded. To match, budget-side insurance is also excluded.</p>
        <p>· QB bucketing verified against the reporting sheet&apos;s own rollup blocks (8 of 9 tie exactly; Aconcagua #3&apos;s sheet block leaves its $11,340 permits unassigned — shown here under Commercial Use so the trip ties to its subtotal).</p>
        <p>· Budget staff meals are shown under Trip Travel/Logistics to match the reporting sheet&apos;s convention for actuals.</p>
        <p>· Budgeted GM uses the budget&apos;s own forecasted revenue at the linked pax — not the sheet&apos;s actual revenue — so scope added after budgeting (e.g. a Hypoxico sold later, raising both revenue and cost) doesn&apos;t distort the original forecast. Expand a trip to see budgeted vs actual revenue side by side. GM Δ = Actual GM − Budgeted GM.</p>
        <p>· The ✓ column is clickable — toggle accounting complete here without waiting for the reporting sheet (saved in this browser; a small * marks values that differ from the sheet).</p>
        <p>· Trips with partial accounting (no ✓) overstate Actual GM until all costs land. Everest 2026 is excluded (its reporting tab has a different layout with no Actuals column).</p>
        <p>· Invoices are matched to budget lines only on clear label evidence (wages → Staff wages, lodging → Hotels, &quot;Client Jacket&quot; → Jackets / apparel). An ambiguous invoice stays on its own row marked &quot;(unmatched)&quot; rather than being force-fit — it may correspond to costs budgeted under a different line. When a category has no budget detail to pair against, or its whole budget is a single line (e.g. Guide Wages), expanding it just lists the invoices.</p>
        <p>· One-sided rows — budget lines with no invoices yet, and unmatched invoices — have dimmed deltas since they aren&apos;t a like-for-like comparison. Line deltas still add up to the category delta, and categories to the trip.</p>
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
  sec: { revB: number; revA: number; cogsB: number; cogsA: number; n: number };
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
  acctOverrides: { [actualId: string]: boolean };
  onToggleAcct: (actualId: string) => void;
}

function SectionBlock({
  cat, color, trips, sec, budgets, linkedTripIds, expandedTrips, expandedCats,
  toggleTrip, toggleCat, historyTrips, guessedIds, linkOverrides, onLinkChange,
  acctOverrides, onToggleAcct,
}: SectionBlockProps) {
  return (
    <>
      <tr>
        <td colSpan={11} className="pt-5 pb-1 border-b-0">
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
        const budgGm = b && b.revenue > 0 ? (b.revenue - b.total) / b.revenue : null;
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
            acctOverrides={acctOverrides}
            onToggleAcct={onToggleAcct}
            budgGm={budgGm}
            actGm={actGm}
          />
        );
      })}
      <tr className="font-bold bg-ag-card-lighter/60">
        <td className="border-t-2 border-ag-border"></td>
        <td className="border-t-2 border-ag-border uppercase text-xs tracking-wider" style={{ color }}>
          Total {CATEGORY_LABELS[cat] || cat}
        </td>
        <td className="border-t-2 border-ag-border"></td>
        <td className={`${GRP} border-t-2 border-ag-border`}>{sec.n > 0 ? formatCurrency(sec.revB) : '—'}</td>
        <td className={`${NUM} border-t-2 border-ag-border`}>{sec.n > 0 ? formatCurrency(sec.revA) : '—'}</td>
        <td className={`${GRP} border-t-2 border-ag-border`}>{sec.n > 0 ? formatCurrency(sec.cogsB) : '—'}</td>
        <td className={`${NUM} border-t-2 border-ag-border`}>{sec.n > 0 ? formatCurrency(sec.cogsA) : '—'}</td>
        <td className={`${NUM} border-t-2 border-ag-border`}>{sec.n > 0 ? fmtDelta(sec.cogsB - sec.cogsA) : '—'}</td>
        <td className={`${GRP} border-t-2 border-ag-border`}>{sec.revB > 0 ? fmtGm((sec.revB - sec.cogsB) / sec.revB) : '—'}</td>
        <td className={`${NUM} border-t-2 border-ag-border`}>{sec.revA > 0 ? fmtGm((sec.revA - sec.cogsA) / sec.revA) : '—'}</td>
        <td className="border-t-2 border-ag-border"></td>
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
  acctOverrides: { [actualId: string]: boolean };
  onToggleAcct: (actualId: string) => void;
  budgGm: number | null;
  actGm: number | null;
}

function TripRows({
  actual: a, budget: b, linked, isOpen, expandedCats,
  toggleTrip, toggleCat, historyTrips, isGuessed, linkOverrides, onLinkChange,
  acctOverrides, onToggleAcct, budgGm, actGm,
}: TripRowsProps) {
  const overrideValue = linkOverrides[a.id] !== undefined
    ? linkOverrides[a.id]
    : (linked ? linked.id : '');
  const acct = acctOverrides[a.id] !== undefined ? acctOverrides[a.id] : a.acctComplete;
  const acctOverridden = acctOverrides[a.id] !== undefined;
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
        <td
          className="text-center select-none cursor-pointer hover:bg-ag-card-lighter/50"
          onClick={(e) => { e.stopPropagation(); onToggleAcct(a.id); }}
          title={`Accounting ${acct ? 'complete' : 'in progress'} — click to toggle${acctOverridden ? ` (set here; reporting sheet says ${a.acctComplete ? 'complete' : 'in progress'})` : ''}`}
        >
          {acct
            ? <span className="text-ag-success">✓</span>
            : <span className="text-ag-text-muted opacity-30">○</span>}
          {acctOverridden && <span className="text-ag-accent text-[9px] align-top ml-0.5">*</span>}
        </td>
        <td className={GRP}>{b ? formatCurrency(b.revenue) : <span className="text-ag-text-muted italic text-xs whitespace-nowrap">—</span>}</td>
        <td className={NUM}>{a.revenue !== null ? formatCurrency(a.revenue) : '—'}</td>
        <td className={GRP}>{b ? formatCurrency(b.total) : <span className="text-ag-text-muted italic text-xs whitespace-nowrap">{linked && !linked.tripConfigId ? 'budget missing config' : 'no budget linked'}</span>}</td>
        <td className={NUM}>{formatCurrency(a.totalCogs)}</td>
        <td className={NUM}>{b ? fmtDelta(b.total - a.totalCogs) : '—'}</td>
        <td className={GRP}>{budgGm !== null ? fmtGm(budgGm) : '—'}</td>
        <td className={NUM}>{actGm !== null ? fmtGm(actGm) : '—'}</td>
        <td className={NUM}>{budgGm !== null && actGm !== null ? fmtGmDelta(actGm - budgGm) : '—'}</td>
      </tr>
      {isOpen && (
        <tr className="bg-ag-card-lighter/10">
          <td></td>
          <td colSpan={10} className="py-2" onClick={(e) => e.stopPropagation()}>
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
              {linked && !linked.tripConfigId && (
                <span className="text-ag-danger">· ⚠ no pricing config attached — open this budget on the History tab and re-save, or its budget columns stay blank</span>
              )}
              {b && (
                <span title="The budget's own forecasted revenue vs the reporting sheet's actual revenue. A gap usually means scope changed after budgeting (e.g. an add-on sold later).">
                  · budgeted revenue {formatCurrency(b.revenue)}{a.revenue !== null ? <> vs actual {formatCurrency(a.revenue)}</> : null}
                </span>
              )}
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
            bucketKey={key}
            label={label}
            actLines={act ? act.lines : []}
            budLines={b ? b.lines[key] || [] : []}
            budTotal={budTotal}
            actTotal={actTotal}
            hasBudget={Boolean(b)}
            catOpen={catOpen}
            toggleCat={toggleCat}
            expandedCats={expandedCats}
          />
        );
      })}
    </>
  );
}

interface CatRowsProps {
  catId: string;
  bucketKey: string;
  label: string;
  actLines: ActualLine[];
  budLines: ActualLine[];
  budTotal: number | null;
  actTotal: number;
  hasBudget: boolean;
  catOpen: boolean;
  toggleCat: (id: string) => void;
  expandedCats: Set<string>;
}

/** Indented actual-detail row (no delta — the roll-up row above carries it). */
function DetailRow({ line, indent }: { line: ActualLine; indent: string }) {
  return (
    <tr className="text-[11px] text-ag-text-muted bg-ag-card-lighter/5">
      <td></td>
      <td className={`${indent} italic opacity-80`}>
        <span className="mr-2 opacity-60 select-none">└</span>
        <span title={line.label}>{line.label}</span>
      </td>
      <td></td>
      <td></td>
      <td></td>
      <td className="border-l border-ag-border/40"></td>
      <td className={`${NUM} italic opacity-80`}>{formatCurrency(line.amount)}</td>
      <td></td>
      <td className="border-l border-ag-border/40" colSpan={3}></td>
    </tr>
  );
}

function CatRows({ catId, bucketKey, label, actLines, budLines, budTotal, actTotal, hasBudget, catOpen, toggleCat, expandedCats }: CatRowsProps) {
  const { matched, unmatched } = catOpen
    ? pairLines(bucketKey, budLines, actLines)
    : { matched: new Map<string, ActualLine[]>(), unmatched: [] as ActualLine[] };
  // Flat mode: no budget detail to pair against (no budget linked, or this
  // category's budget has no component lines) — or a single budget line that
  // covers every invoice (e.g. Guide Wages → Staff wages). Either way the
  // category row already carries the whole comparison, so expanding goes
  // straight to the invoice list with no intermediate rows or tags.
  const flatMode = catOpen && (
    budLines.length === 0 ||
    (budLines.length === 1 && unmatched.length === 0 && actLines.length > 0)
  );
  const seenLabels = new Set<string>();
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
        <td></td>
        <td className={GRP}>{hasBudget && budTotal !== null ? formatCurrency(budTotal) : ''}</td>
        <td className={NUM}>{formatCurrency(actTotal)}</td>
        <td className={NUM}>{hasBudget && budTotal !== null ? fmtDelta(budTotal - actTotal) : ''}</td>
        <td className="border-l border-ag-border/40" colSpan={3}></td>
      </tr>
      {flatMode && actLines.map((l, i) => (
        <DetailRow key={`d${i}`} line={l} indent="pl-14" />
      ))}
      {catOpen && !flatMode && budLines.map((bl, i) => {
        // guard against duplicate budget labels: matched invoices attach only once
        const acts = seenLabels.has(bl.label) ? [] : (matched.get(bl.label) || []);
        seenLabels.add(bl.label);
        const actSum = acts.reduce((s, l) => s + l.amount, 0);
        const lineId = `${catId}|${bl.label}`;
        return (
          <BudgetLineRows
            key={`b${i}`}
            budLine={bl}
            acts={acts}
            actSum={actSum}
            open={expandedCats.has(lineId)}
            onToggle={acts.length > 1 ? () => toggleCat(lineId) : undefined}
          />
        );
      })}
      {catOpen && !flatMode && unmatched.map((l, i) => (
        <tr key={`u${i}`} className="text-xs text-ag-text-muted bg-ag-card-lighter/5">
          <td></td>
          <td className="pl-14 italic">
            <span className="inline-block w-4"></span>
            <span title={l.label}>{l.label}</span>
            <span className="not-italic opacity-60 ml-2" title={UNMATCHED_HINT}>(unmatched)</span>
          </td>
          <td></td>
          <td></td>
          <td></td>
          <td className={`${GRP} opacity-60`}>—</td>
          <td className={`${NUM} italic`}>{formatCurrency(l.amount)}</td>
          <td className={NUM}><span className="opacity-60">{fmtDelta(-l.amount)}</span></td>
          <td className="border-l border-ag-border/40" colSpan={3}></td>
        </tr>
      ))}
    </>
  );
}

const UNMATCHED_HINT = 'Not confidently matched to a specific budget line — may correspond to costs budgeted under a different line, so no like-for-like comparison is shown.';

/** One budget line paired with its matched actual lines. Expandable when several actuals roll up into it. */
function BudgetLineRows({ budLine, acts, actSum, open, onToggle }: {
  budLine: ActualLine; acts: ActualLine[]; actSum: number; open: boolean; onToggle?: () => void;
}) {
  const expandable = Boolean(onToggle);
  // Echo the invoice label only when it says more than the budget line already does
  const echo = acts.length === 1
    && acts[0].label.trim().toLowerCase() !== budLine.label.trim().toLowerCase();
  const oneSided = acts.length === 0;
  return (
    <>
      <tr
        className={`text-xs text-ag-text-muted bg-ag-card-lighter/5 ${expandable ? 'cursor-pointer hover:bg-ag-card-lighter/20' : ''}`}
        onClick={onToggle}
      >
        <td></td>
        <td className="pl-14">
          {expandable
            ? <span className="text-ag-accent text-[9px] mr-2 select-none inline-block w-2">{open ? '▼' : '▶'}</span>
            : <span className="inline-block w-4"></span>}
          {budLine.label}
          {echo && (
            <span className="italic opacity-60 ml-2 inline-block max-w-[260px] truncate align-bottom" title={acts[0].label}>
              · {acts[0].label}
            </span>
          )}
          {expandable && (
            <span className="italic opacity-60 ml-2">· {acts.length} items</span>
          )}
          {oneSided && (
            <span className="italic opacity-60 ml-2" title="Budgeted, but no invoice matched to this line yet.">· no invoices yet</span>
          )}
        </td>
        <td></td>
        <td></td>
        <td></td>
        <td className={GRP}>{formatCurrency(budLine.amount)}</td>
        <td className={NUM}>{acts.length > 0 ? formatCurrency(actSum) : <span className="opacity-60">—</span>}</td>
        <td className={NUM}>{oneSided
          ? <span className="opacity-60">{fmtDelta(budLine.amount)}</span>
          : fmtDelta(budLine.amount - actSum)}</td>
        <td className="border-l border-ag-border/40" colSpan={3}></td>
      </tr>
      {expandable && open && acts.map((al, j) => (
        <DetailRow key={`s${j}`} line={al} indent="pl-20" />
      ))}
    </>
  );
}
