/**
 * Automatic vendor-variance sweep.
 *
 * Runs in the GM Review tab every time actuals are pulled from the reporting
 * sheet: compares each trip's actual expense lines to its budget lines, flags
 * big gaps, explains them, and syncs the result into the `variance_flags`
 * table that the Variance Review panel reads.
 *
 * Port of variance_sweep.py (Round 1, 2026-08-07). Budgets use CANONICAL links
 * only (pinned links → saved budget name → best guess) — never a viewer's
 * browser-saved link picks — so every browser computes the same flags.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { HistoricalTrip } from './types';
import rulesData from './variance-rules.json';

export interface SweepLine { label: string; amount: number }
export interface SweepTrip {
  id: string;
  masterName: string;
  acctComplete: boolean;
  totalCogs: number;
  buckets: { [key: string]: { total: number; lines: SweepLine[] } };
}
export interface SweepBudget {
  lines: { [key: string]: SweepLine[] };
  total: number;
}

interface Rule { trip_pattern?: string; line_pattern?: string; note?: string; source?: string }
interface Alias { actual_pattern: string; budget_target: string; bucket?: string | null }
interface Rules {
  thresholds: { pct: number; abs: number; offset_tol: number; trip_total_ok: number };
  pinned_links: { [actualId: string]: string };
  aliases: Alias[];
  expected_variances: Rule[];
  suppressions: Rule[];
}
export const VARIANCE_RULES = rulesData as unknown as Rules;

export const CLEARED_CLASS = 'cleared-by-data';

export interface ComputedFlag {
  tripId: string;
  trip: string;
  kind: 'variance' | 'missing-actual' | 'unbudgeted';
  bucket: string;           // display label, e.g. "Trip Travel / Logistics"
  line: string;
  budget: number;
  actual: number;
  delta: number;
  pct: number | null;
  cls: string;
  note: string;
  pairKey?: string;
}

const LINE_RULES: { [bucket: string]: [RegExp, string][] } = {
  tripTravelLogistics: [
    [/airfare|flight/, 'Guide flights'],
    [/hotel|lodg|hostal|hacienda|hosteria|refug|accommodat/, 'Hotels'],
    [/staff meal|guide meal/, 'Staff meals'],
    [/meal|food|grocer|restaurant/, 'Meals'],
    [/transport|vehicle|driver|shuttle/, 'Transport'],
    [/single/, 'Single rooms'],
    [/logistic|travel|expedition/, 'Logistics'],
  ],
  guideWages: [
    [/\bext\b|extension/, 'Ext. staff'],
    [/[\s\S]*/, 'Staff wages'],
  ],
  tripSupplies: [
    [/jacket|apparel|parka/, 'Jackets / apparel'],
    [/hypoxico|altitude tent/, 'Hypoxico'],
    [/equipment|gear/, 'Equipment'],
  ],
  commercialLicensing: [[/[\s\S]*/, 'Permits']],
  tripCommunications: [],
  otherTripCosts: [
    [/contingen/, 'Contingency'],
    [/other|general|misc/, 'Other costs'],
  ],
};
const GENERIC = new Set(['trip', 'trips', 'cost', 'costs', 'other', 'guide', 'guides', 'expense', 'expenses', 'invoice', 'fees']);
const BUCKET_LABEL: [string, string][] = [
  ['tripTravelLogistics', 'Trip Travel / Logistics'],
  ['guideWages', 'Guide Wages'],
  ['tripSupplies', 'Trip Supplies'],
  ['commercialLicensing', 'Commercial Use & Licensing'],
  ['tripCommunications', 'Trip Communications'],
  ['otherTripCosts', 'Other Trip Costs'],
];

const money = (n: number) => Math.round(n).toLocaleString('en-US');
const words = (s: string) => s.replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !GENERIC.has(w));

function pairLines(bucket: string, budLines: SweepLine[], actLines: SweepLine[], aliases: Alias[]) {
  const budLabels = new Set(budLines.map(l => l.label));
  const matched = new Map<string, SweepLine[]>();
  const unmatched: SweepLine[] = [];
  for (const al of actLines) {
    const primary = al.label.toLowerCase().split(' - ')[0];
    let target: string | null = null;
    for (const a of aliases) {
      if ((a.bucket == null || a.bucket === bucket) && new RegExp(a.actual_pattern).test(primary) && budLabels.has(a.budget_target)) {
        target = a.budget_target; break;
      }
    }
    if (!target) {
      for (const [pat, tgt] of LINE_RULES[bucket] || []) {
        if (pat.test(primary) && budLabels.has(tgt)) { target = tgt; break; }
      }
    }
    if (!target && bucket === 'otherTripCosts') {
      const at = new Set(words(primary));
      for (const bl of budLines) {
        if (words(bl.label.toLowerCase()).some(w => at.has(w))) { target = bl.label; break; }
      }
    }
    if (target) matched.set(target, [...(matched.get(target) || []), al]);
    else unmatched.push(al);
  }
  return { matched, unmatched };
}

/** Canonical budget link for each trip (same for every viewer). */
export function canonicalLinks(trips: { id: string; masterName: string; budgetTripName: string | null }[], history: HistoricalTrip[]) {
  const byName = new Map<string, HistoricalTrip>();
  for (const t of history) byName.set(t.name.trim(), t);
  const runOnly = history.filter(t => t.status === 'run');
  const STOP = new Set(['private', 'pvt', 'the', 'and', 'trip', 'open', 'day', 'pax', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 'october', 'november', 'december']);
  const tokens = (s: string) => new Set(s.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)));
  const out = new Map<string, HistoricalTrip>();
  for (const a of trips) {
    const pin = VARIANCE_RULES.pinned_links[a.id];
    if (pin) {
      const t = history.find(h => h.id.startsWith(pin));
      if (t) { out.set(a.id, t); continue; }
    }
    if (a.budgetTripName) {
      const t = byName.get(a.budgetTripName.trim());
      if (t) { out.set(a.id, t); continue; }
    }
    const at = tokens(a.masterName);
    let best: HistoricalTrip | null = null;
    let bestScore = 1;
    for (const t of runOnly) {
      let score = 0;
      tokens(t.name).forEach(w => { if (at.has(w)) score += 1; });
      if (score > bestScore) { best = t; bestScore = score; }
    }
    if (best) out.set(a.id, best);
  }
  return out;
}

/** Compute flags for every trip that has a budget. */
export function runVarianceSweep(trips: SweepTrip[], budgets: Map<string, SweepBudget>, rules: Rules = VARIANCE_RULES): ComputedFlag[] {
  const { pct: PCT, abs: ABS, offset_tol: TOL, trip_total_ok: TOTAL_OK } = rules.thresholds;
  const all: ComputedFlag[] = [];

  for (const t of trips) {
    const bud = budgets.get(t.id);
    if (!bud) continue;
    const acct = t.acctComplete;
    const flags: (ComputedFlag & { note?: string })[] = [];
    const tripDelta = bud.total ? (t.totalCogs - bud.total) / bud.total : null;
    const zeroBud: [string, string, number][] = [];

    for (const [bucket, blabel] of BUCKET_LABEL) {
      const budLines = bud.lines[bucket] || [];
      const actLines = t.buckets[bucket]?.lines || [];
      const { matched, unmatched } = pairLines(bucket, budLines, actLines, rules.aliases);
      for (const bl of budLines) {
        const aLines = matched.get(bl.label) || [];
        if (aLines.length === 0) zeroBud.push([blabel, bl.label, bl.amount]);
        const a = aLines.reduce((s, x) => s + x.amount, 0);
        const d = a - bl.amount;
        if (aLines.length === 0) {
          if (acct && bl.amount >= ABS) {
            flags.push({ tripId: t.id, trip: t.masterName, kind: 'missing-actual', bucket: blabel, line: bl.label,
              budget: bl.amount, actual: 0, delta: -bl.amount, pct: -1, cls: '', note: '' });
          }
          continue;
        }
        if (bl.amount > 0 && Math.abs(d) >= ABS && Math.abs(d) / bl.amount >= PCT) {
          if (d < 0 && !acct) continue; // under-budget while accounting incomplete = noise
          flags.push({ tripId: t.id, trip: t.masterName, kind: 'variance', bucket: blabel, line: bl.label,
            budget: bl.amount, actual: a, delta: d, pct: d / bl.amount, cls: '', note: '' });
        }
      }
      for (const ul of unmatched) {
        if (ul.amount >= ABS) {
          flags.push({ tripId: t.id, trip: t.masterName, kind: 'unbudgeted', bucket: blabel, line: ul.label,
            budget: 0, actual: ul.amount, delta: ul.amount, pct: null, cls: '', note: '' });
        }
      }
    }

    const overs = flags.filter(f => f.delta > 0);
    const unders = flags.filter(f => f.delta < 0);
    overs.forEach(o => { o.cls = o.kind === 'variance' ? 'possible-vendor-issue' : 'unbudgeted-expense'; });
    unders.forEach(u => { u.cls = u.kind === 'variance' ? 'under-budget' : 'missing-actual'; });

    // offsetting over/under pair on the same trip -> likely one cost under two labels
    const used = new Set<number>();
    for (const o of overs) {
      for (let i = 0; i < unders.length; i++) {
        if (used.has(i)) continue;
        const u = unders[i];
        const a = Math.abs(o.delta), b = Math.abs(u.delta);
        if (a && b && Math.abs(a - b) / Math.max(a, b) <= TOL) {
          o.cls = u.cls = 'likely-mapping-internal';
          const weak = Math.abs(a - b) / Math.max(a, b) > 0.2 ? ' Weak match — grade with skepticism.' : '';
          const shared = `'${o.line}' is $${money(o.delta)} over/unbudgeted while '${u.line}' shows $${money(Math.abs(u.delta))} unspent on the same trip — likely the same money under two labels.${weak}`;
          o.note = u.note = shared;
          o.pairKey = u.pairKey = `${t.id}|${o.line}|${u.line}`;
          used.add(i);
          break;
        }
      }
    }
    // over that matches an unspent sibling budget line -> invoice probably covers both
    for (const o of overs) {
      if (o.cls !== 'possible-vendor-issue') continue;
      for (const [blabel, lbl, amt] of zeroBud) {
        const gap = Math.abs(o.delta - amt) / Math.max(o.delta, amt);
        if (amt >= ABS && gap <= TOL) {
          o.cls = 'likely-mapping-internal';
          const weak = gap > 0.2 ? ' Weak match — grade with skepticism.' : '';
          o.note = `The invoice likely also covers the '${lbl}' budget (${blabel}, $${money(amt)}), which shows no actuals — combined, budget and actual would be close.${weak}`;
          break;
        }
      }
    }

    for (const f of flags) {
      if (tripDelta !== null && Math.abs(tripDelta) <= TOTAL_OK && (f.cls === 'possible-vendor-issue' || f.cls === 'under-budget')) {
        f.cls = 'likely-mapping-internal';
        if (!f.note) f.note = `Whole-trip COGS is within ${Math.round(Math.abs(tripDelta) * 100)}% of budget — this line's variance is offset elsewhere, so it's likely spend bucketed differently than budgeted, not extra money out the door.`;
      }
      if (f.kind === 'missing-actual' && !f.note) {
        f.note = `Trip is marked accounting-complete but this $${money(f.budget)} budget shows no spend — could be real savings or an unrecorded expense.`;
      }
      if (f.cls === 'possible-vendor-issue' && !f.note) {
        const p = Math.round((f.pct || 0) * 100);
        f.note = `Actual is ${p >= 0 ? '+' : ''}${p}% (${f.delta >= 0 ? '+' : '-'}$${money(Math.abs(f.delta))}) vs budget with no offsetting variance elsewhere on this trip — check the vendor invoice against what was agreed.`;
      }
      if (f.cls === 'under-budget' && !f.note) {
        f.note = `Spent $${money(Math.abs(f.delta))} (${Math.round(Math.abs(f.pct || 0) * 100)}%) less than budgeted on an accounting-complete trip — real savings, or a cost recorded under a different line or not yet entered.`;
      }
      if (f.cls === 'unbudgeted-expense' && !f.note) {
        f.note = `A $${money(f.actual)} expense with no budget line on this trip and nothing offsetting it — check whether it was expected/authorized.`;
      }
    }

    for (const f of flags) {
      const hit = (r: Rule) => new RegExp(r.trip_pattern || '.', 'i').test(f.trip) && new RegExp(r.line_pattern || '.', 'i').test(f.line);
      if (rules.suppressions.some(hit)) continue;
      const exp = rules.expected_variances.find(hit);
      if (exp) { f.cls = 'expected-per-feedback'; f.note = `${f.note} Expected per earlier feedback: ${exp.note || ''}`.trim(); }
      all.push(f);
    }
  }
  return all;
}

// ---------------------------------------------------------------- sync to variance_flags

interface FlagRow {
  id: string; round: number; flag_code: string; actual_trip_id: string; trip_name: string;
  bucket: string; line_label: string; budget: number; actual: number; delta: number; pct: number | null;
  class: string; offset_context: string | null; paired_with: string | null;
  verdict: string | null; created_at: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number | null) => (n === null ? null : Math.round(n * 10000) / 10000);
const keyOf = (tripId: string, bucket: string, line: string) => `${tripId}|${bucket}|${line}`;
const changed = (a: number | null, b: number | null, tol: number) => (a === null || b === null ? a !== b : Math.abs(a - b) > tol);

export interface SyncResult { inserted: number; updated: number; cleared: number; error?: string }

/**
 * Bring variance_flags in line with the flags computed from current data.
 *  - New flag → inserted under a new round (R<n>-01…).
 *  - Pending flag whose numbers/explanation moved → updated in place.
 *  - Pending flag no longer triggered → marked cleared-by-data (kept for history; DELETE is blocked).
 *  - Graded flag → never touched; re-raised as a new flag only if its amounts changed by > $1.
 * Only trips in `sweptTripIds` (trips that had a budget this run) can have flags cleared.
 */
export async function syncVarianceFlags(
  supabase: SupabaseClient,
  flags: ComputedFlag[],
  sweptTripIds: Set<string>,
): Promise<SyncResult> {
  const res: SyncResult = { inserted: 0, updated: 0, cleared: 0 };
  const { data, error } = await supabase.from('variance_flags').select('*');
  if (error) return { ...res, error: error.message };
  const rows = (data || []) as FlagRow[];

  // latest row per key
  const latest = new Map<string, FlagRow>();
  for (const r of rows) {
    const k = keyOf(r.actual_trip_id, r.bucket, r.line_label);
    const cur = latest.get(k);
    if (!cur || r.round > cur.round || (r.round === cur.round && r.created_at > cur.created_at)) latest.set(k, r);
  }

  const today = new Date().toISOString().slice(0, 10);
  const round = rows.reduce((m, r) => Math.max(m, r.round), 0) + 1;
  let seq = 0;
  const codeFor = new Map<ComputedFlag, string>();
  const inserts: ComputedFlag[] = [];
  const updates: { row: FlagRow; f: ComputedFlag }[] = [];
  const reflagNote = new Map<ComputedFlag, string>();

  for (const f of flags) {
    const row = latest.get(keyOf(f.tripId, f.bucket, f.line));
    if (!row) { inserts.push(f); continue; }
    if (row.verdict) {
      if (changed(row.actual, f.actual, 1) || changed(row.budget, f.budget, 1)) {
        inserts.push(f);
        reflagNote.set(f, ` Re-raised: amounts changed since ${row.flag_code} was graded "${row.verdict}" (was budget $${money(row.budget)} / actual $${money(row.actual)}).`);
      }
      continue;
    }
    codeFor.set(f, row.flag_code);
    updates.push({ row, f });
  }
  for (const f of inserts) codeFor.set(f, `R${round}-${String(++seq).padStart(2, '0')}`);

  // counterpart codes via pairKey
  const pairOf = (f: ComputedFlag) => {
    if (!f.pairKey) return null;
    const other = flags.find(g => g !== f && g.pairKey === f.pairKey);
    return other ? codeFor.get(other) || null : null;
  };

  const payload = (f: ComputedFlag) => ({
    actual_trip_id: f.tripId, trip_name: f.trip, bucket: f.bucket, line_label: f.line,
    budget: r2(f.budget), actual: r2(f.actual), delta: r2(f.delta), pct: r4(f.pct),
    class: f.cls, offset_context: f.note + (reflagNote.get(f) || ''), paired_with: pairOf(f),
  });

  if (inserts.length) {
    const body = inserts.map(f => ({ ...payload(f), round, flag_code: codeFor.get(f) }));
    const { data: ins, error: insErr } = await supabase.from('variance_flags').insert(body).select('id');
    if (insErr) return { ...res, error: `insert failed: ${insErr.message}` };
    res.inserted = ins?.length || 0;
  }

  for (const { row, f } of updates) {
    const p = payload(f);
    const numbersMoved = changed(row.budget, p.budget, 0.01) || changed(row.actual, p.actual, 0.01);
    const differs = numbersMoved || row.class !== p.class || (row.paired_with || null) !== p.paired_with || row.trip_name !== p.trip_name;
    if (!differs) continue;
    // Keep an existing hand-edited explanation unless the numbers or classification actually changed.
    const body: Partial<typeof p> = { ...p };
    if (!numbersMoved && row.class === p.class && row.offset_context) delete body.offset_context;
    if (!numbersMoved) { delete body.budget; delete body.actual; delete body.delta; delete body.pct; }
    const { data: upd, error: updErr } = await supabase.from('variance_flags').update(body).eq('id', row.id).is('verdict', null).select('id');
    if (updErr) return { ...res, error: `update ${row.flag_code} failed: ${updErr.message}` };
    res.updated += upd?.length || 0;
  }

  const stillFlagged = new Set(flags.map(f => keyOf(f.tripId, f.bucket, f.line)));
  for (const [k, row] of Array.from(latest.entries())) {
    if (row.verdict || row.class === CLEARED_CLASS || stillFlagged.has(k) || !sweptTripIds.has(row.actual_trip_id)) continue;
    const { data: clr, error: clrErr } = await supabase.from('variance_flags')
      .update({ class: CLEARED_CLASS, paired_with: null,
        offset_context: `No longer flagged as of ${today} — updated reporting-sheet numbers (last seen: budget $${money(row.budget)} / actual $${money(row.actual)}) bring this line within threshold or it was re-labeled.` })
      .eq('id', row.id).is('verdict', null).select('id');
    if (clrErr) return { ...res, error: `clear ${row.flag_code} failed: ${clrErr.message}` };
    res.cleared += clr?.length || 0;
  }
  return res;
}
