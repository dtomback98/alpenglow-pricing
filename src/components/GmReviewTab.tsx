'use client';

import { useState, useEffect, useMemo } from 'react';
import { useHistoricalData } from '@/hooks/useHistoricalData';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/lib/constants';
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

interface BudgetBuckets {
  totals: { [key: string]: number };
  lines: { [key: string]: ActualLine[] };
  total: number;           // COGS-only budget total (insurance excluded)
  insuranceExcluded: number;
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
 * - staff meals shown under Trip Travel/Logistics (sheet convention), not Guide Wages
 * - insurance excluded entirely (admin cost — actuals are COGS-only)
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
    tripTravelLogistics: [],
    guideWages: [],
    tripSupplies: [],
    commercialLicensing: [],
    tripCommunications: [],
    otherTripCosts: [],
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

  return { totals, lines, total: breakdown.total - insurance, insuranceExcluded: insurance };
}

// ---------------------------------------------------------------- formatting

const fmtDelta = (v: number) => (
  <span className={v < 0 ? 'text-ag-danger' : 'text-ag-success'}>
    {v < 0 ? `(${formatCurrency(Math.abs(v)).replace('$', '$')})` : formatCurrency(v)}
  </span>
);

const fmtGm = (v: number) => `${(v * 100).toFixed(1)}%`;

const fmtGmDelta = (v: number) => (
  <span className={v < 0 ? 'text-ag-danger' : 'text-ag-success'}>
    {v < 0 ? `(${Math.abs(v * 100).toFixed(1)}%)` : `${(v * 100).toFixed(1)}%`}
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

  useEffect(() => {
    if (refreshKey && refreshKey > 0) refresh();
  }, [refreshKey, refresh]);

  // Load saved budget-link overrides
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

  // Resolve each actual trip to a history trip (override wins; else name match from JSON)
  const linkedTripIds = useMemo(() => {
    const byName = new Map<string, HistoricalTrip>();
    for (const t of historyTrips) byName.set(t.name.trim(), t);
    const map = new Map<string, HistoricalTrip>();
    for (const a of ACTUALS) {
      const overrideId = linkOverrides[a.id];
      if (overrideId === '') continue; // explicitly unlinked
      if (overrideId) {
        const t = historyTrips.find(ht => ht.id === overrideId);
        if (t) { map.set(a.id, t); continue; }
      }
      if (a.budgetTripName) {
        const t = byName.get(a.budgetTripName.trim());
        if (t) map.set(a.id, t);
      }
    }
    return map;
  }, [historyTrips, linkOverrides]);

  // Fetch configs for all linked history trips
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

  // Budget buckets per actual trip
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

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  const sections = SECTION_ORDER
    .map(cat => ({ cat, trips: ACTUALS.filter(a => a.category === cat).sort((a, b) => a.masterRow - b.masterRow) }))
    .filter(s => s.trips.length > 0);

  // Grand totals
  const grand = { revenue: 0, budget: 0, budgetRevenue: 0, actual: 0 };
  for (const a of ACTUALS) {
    grand.revenue += a.revenue || 0;
    grand.actual += a.totalCogs;
    const b = budgets.get(a.id);
    if (b) { grand.budget += b.total; grand.budgetRevenue += a.revenue || 0; }
  }

  if (loading || configsLoading) {
    return <div className="text-center text-ag-text-muted py-8">Loading GM review data...</div>;
  }

  const sortedHistoryTrips = [...historyTrips].sort((x, y) => x.name.localeCompare(y.name));

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">2026 Budget vs. Actuals — Gross Margin Review</h2>
            <p className="text-xs text-ag-text-muted mt-1">
              Actuals from the 2026 reporting sheet (as of Aug 5, 2026) · Budgets computed live from each trip&apos;s linked
              budget in History · Delta = Budgeted − Actual, red = over budget
            </p>
          </div>
          <div className="text-right text-sm">
            <div className="text-ag-text-muted text-xs">Total Actual COGS</div>
            <div className="font-bold text-lg">{formatCurrency(grand.actual)}</div>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="pricing-table">
          <thead>
            <tr>
              <th className="w-8"></th>
              <th>Trip</th>
              <th className="text-center" title="Accounting complete on the reporting sheet">Acct ✓</th>
              <th className="text-right">Revenue</th>
              <th className="text-right">Budgeted</th>
              <th className="text-right">Actuals</th>
              <th className="text-right">Delta</th>
              <th className="text-right" title="(Revenue − Budgeted) / Revenue">Budg. GM</th>
              <th className="text-right" title="(Revenue − Actuals) / Revenue">Actual GM</th>
              <th className="text-right" title="Actual GM − Budgeted GM">GM Δ</th>
            </tr>
          </thead>
          <tbody>
            {sections.map(({ cat, trips: sectionTrips }) => {
              const sec = { revenue: 0, budget: 0, hasBudget: false, actual: 0 };
              for (const a of sectionTrips) {
                sec.revenue += a.revenue || 0;
                sec.actual += a.totalCogs;
                const b = budgets.get(a.id);
                if (b) { sec.budget += b.total; sec.hasBudget = true; }
              }
              const secBudgGm = sec.revenue > 0 && sec.hasBudget ? (sec.revenue - sec.budget) / sec.revenue : null;
              const secActGm = sec.revenue > 0 ? (sec.revenue - sec.actual) / sec.revenue : null;
              return (
                <SectionRows
                  key={cat}
                  cat={cat}
                  trips={sectionTrips}
                  budgets={budgets}
                  linkedTripIds={linkedTripIds}
                  expandedTrips={expandedTrips}
                  expandedCats={expandedCats}
                  onToggleTrip={(id) => toggle(expandedTrips, id, setExpandedTrips)}
                  onToggleCat={(id) => toggle(expandedCats, id, setExpandedCats)}
                  historyTrips={sortedHistoryTrips}
                  linkOverrides={linkOverrides}
                  onLinkChange={saveOverride}
                  sectionTotals={{ ...sec, budgGm: secBudgGm, actGm: secActGm }}
                />
              );
            })}
            {/* Grand total */}
            <tr className="font-bold border-t-2 border-ag-text">
              <td></td>
              <td>Total All Trips</td>
              <td></td>
              <td className="text-right whitespace-nowrap">{formatCurrency(grand.revenue)}</td>
              <td className="text-right whitespace-nowrap">{grand.budget > 0 ? formatCurrency(grand.budget) : '—'}</td>
              <td className="text-right whitespace-nowrap">{formatCurrency(grand.actual)}</td>
              <td className="text-right whitespace-nowrap">{grand.budget > 0 ? fmtDelta(grand.budget - grand.actual) : '—'}</td>
              <td className="text-right">{grand.budgetRevenue > 0 ? fmtGm((grand.budgetRevenue - grand.budget) / grand.budgetRevenue) : '—'}</td>
              <td className="text-right">{grand.revenue > 0 ? fmtGm((grand.revenue - grand.actual) / grand.revenue) : '—'}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card text-sm text-ag-text-muted space-y-1">
        <div className="font-medium text-ag-text mb-2">Notes</div>
        <p>· Actuals are COGS line items from each trip tab&apos;s EXPENSES block on the reporting sheet — admin costs (Insurance, AE Overhead Fee, Gear Replacement) excluded. To match, budget-side insurance is also excluded.</p>
        <p>· QB bucketing verified against the reporting sheet&apos;s own rollup blocks (8 of 9 tie exactly; Aconcagua #3&apos;s sheet block leaves its $11,340 permits unassigned — shown here under Commercial Use so the trip ties to its subtotal).</p>
        <p>· Budget staff meals are shown under Trip Travel/Logistics to match the reporting sheet&apos;s convention for actuals.</p>
        <p>· Budg. GM = (Revenue − Budgeted) / Revenue on the sheet&apos;s actual revenue; GM Δ = Actual GM − Budg. GM (red = margin below budget).</p>
        <p>· Trips with partial accounting (no ✓) overstate Actual GM until all costs land. Everest 2026 is excluded (its reporting tab has a different layout with no Actuals column).</p>
        <p>· Expand a trip to change which budgeted trip it compares against (saved in this browser). Actuals refresh by regenerating actuals-2026.json from the reporting sheet.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- section + trip rows

interface SectionRowsProps {
  cat: string;
  trips: ActualTrip[];
  budgets: Map<string, BudgetBuckets>;
  linkedTripIds: Map<string, HistoricalTrip>;
  expandedTrips: Set<string>;
  expandedCats: Set<string>;
  onToggleTrip: (id: string) => void;
  onToggleCat: (id: string) => void;
  historyTrips: HistoricalTrip[];
  linkOverrides: { [actualId: string]: string };
  onLinkChange: (actualId: string, historyTripId: string) => void;
  sectionTotals: { revenue: number; budget: number; hasBudget: boolean; actual: number; budgGm: number | null; actGm: number | null };
}

function SectionRows({
  cat, trips, budgets, linkedTripIds, expandedTrips, expandedCats,
  onToggleTrip, onToggleCat, historyTrips, linkOverrides, onLinkChange, sectionTotals,
}: SectionRowsProps) {
  const color = CATEGORY_COLORS[cat] || '#3b82f6';
  return (
    <>
      <tr>
        <td colSpan={10} className="pt-5">
          <span className="font-semibold text-base" style={{ color }}>{CATEGORY_LABELS[cat] || cat} Trips</span>
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
            onToggleTrip={onToggleTrip}
            onToggleCat={onToggleCat}
            historyTrips={historyTrips}
            linkOverrides={linkOverrides}
            onLinkChange={onLinkChange}
            budgGm={budgGm}
            actGm={actGm}
          />
        );
      })}
      <tr className="font-semibold border-t border-ag-border">
        <td></td>
        <td>Total {CATEGORY_LABELS[cat] || cat}</td>
        <td></td>
        <td className="text-right whitespace-nowrap">{formatCurrency(sectionTotals.revenue)}</td>
        <td className="text-right whitespace-nowrap">{sectionTotals.hasBudget ? formatCurrency(sectionTotals.budget) : '—'}</td>
        <td className="text-right whitespace-nowrap">{formatCurrency(sectionTotals.actual)}</td>
        <td className="text-right whitespace-nowrap">{sectionTotals.hasBudget ? fmtDelta(sectionTotals.budget - sectionTotals.actual) : '—'}</td>
        <td className="text-right">{sectionTotals.budgGm !== null ? fmtGm(sectionTotals.budgGm) : '—'}</td>
        <td className="text-right">{sectionTotals.actGm !== null ? fmtGm(sectionTotals.actGm) : '—'}</td>
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
  onToggleTrip: (id: string) => void;
  onToggleCat: (id: string) => void;
  historyTrips: HistoricalTrip[];
  linkOverrides: { [actualId: string]: string };
  onLinkChange: (actualId: string, historyTripId: string) => void;
  budgGm: number | null;
  actGm: number | null;
}

function TripRows({
  actual: a, budget: b, linked, isOpen, expandedCats,
  onToggleTrip, onToggleCat, historyTrips, linkOverrides, onLinkChange, budgGm, actGm,
}: TripRowsProps) {
  const overrideValue = linkOverrides[a.id] !== undefined
    ? linkOverrides[a.id]
    : (linked ? linked.id : '');
  return (
    <>
      <tr className="hover:bg-ag-card-lighter/40 cursor-pointer" onClick={() => onToggleTrip(a.id)}>
        <td className="text-ag-text-muted select-none">{isOpen ? '▾' : '▸'}</td>
        <td className="font-medium">{a.masterName}</td>
        <td className="text-center">{a.acctComplete ? '✓' : ''}</td>
        <td className="text-right whitespace-nowrap">{a.revenue !== null ? formatCurrency(a.revenue) : '—'}</td>
        <td className="text-right whitespace-nowrap">{b ? formatCurrency(b.total) : <span className="text-ag-text-muted italic text-xs">no budget linked</span>}</td>
        <td className="text-right whitespace-nowrap">{formatCurrency(a.totalCogs)}</td>
        <td className="text-right whitespace-nowrap">{b ? fmtDelta(b.total - a.totalCogs) : '—'}</td>
        <td className="text-right">{budgGm !== null ? fmtGm(budgGm) : '—'}</td>
        <td className="text-right">{actGm !== null ? fmtGm(actGm) : '—'}</td>
        <td className="text-right">{budgGm !== null && actGm !== null ? fmtGmDelta(actGm - budgGm) : '—'}</td>
      </tr>
      {isOpen && (
        <tr>
          <td></td>
          <td colSpan={9} className="py-2">
            <div className="flex items-center gap-2 text-xs text-ag-text-muted">
              <span>Budget source:</span>
              <select
                value={overrideValue}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onLinkChange(a.id, e.target.value)}
                className="text-xs py-1"
              >
                <option value="">— none —</option>
                {historyTrips.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.pax} pax{t.status ? `, ${t.status}` : ''})
                  </option>
                ))}
              </select>
              {linked && <span>{linked.pax} pax @ saved budget</span>}
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
            onToggleCat={onToggleCat}
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
  onToggleCat: (id: string) => void;
}

function CatRows({ catId, label, actLines, budLines, budTotal, actTotal, hasBudget, catOpen, onToggleCat }: CatRowsProps) {
  return (
    <>
      <tr className="text-sm hover:bg-ag-card-lighter/30 cursor-pointer" onClick={() => onToggleCat(catId)}>
        <td className="text-ag-text-muted select-none text-xs text-right">{catOpen ? '▾' : '▸'}</td>
        <td className="pl-8 text-ag-text">{label}</td>
        <td></td>
        <td></td>
        <td className="text-right whitespace-nowrap">{hasBudget && budTotal !== null ? formatCurrency(budTotal) : ''}</td>
        <td className="text-right whitespace-nowrap">{formatCurrency(actTotal)}</td>
        <td className="text-right whitespace-nowrap">{hasBudget && budTotal !== null ? fmtDelta(budTotal - actTotal) : ''}</td>
        <td colSpan={3}></td>
      </tr>
      {catOpen && budLines.map((l, i) => (
        <tr key={`b${i}`} className="text-xs text-ag-text-muted italic">
          <td></td>
          <td className="pl-14">{l.label}</td>
          <td></td>
          <td></td>
          <td className="text-right whitespace-nowrap">{formatCurrency(l.amount)}</td>
          <td colSpan={5}></td>
        </tr>
      ))}
      {catOpen && actLines.map((l, i) => (
        <tr key={`a${i}`} className="text-xs text-ag-text-muted italic">
          <td></td>
          <td className="pl-14">{l.label}</td>
          <td></td>
          <td></td>
          <td></td>
          <td className="text-right whitespace-nowrap">{formatCurrency(l.amount)}</td>
          <td colSpan={4}></td>
        </tr>
      ))}
    </>
  );
}
