/**
 * Bridge between the GM Review and the guide invoice portal (bridge-v1.sql).
 *
 *  - gm_trip_budgets: written here after every variance check — one row per
 *    budget-linked trip (upsert on actual_trip_id, never deleted). The portal
 *    flags guide-wage invoices against these, but only for `pinned` / `named`
 *    links; `fuzzy` rows are ignored by the portal.
 *  - portal_wage_flags: written by the portal (one row per admin verdict on a
 *    guide-wage flag). Read here and shown next to the matching trip as
 *    evidence when reviewing Guide Wages budgets.
 *
 * Actuals never flow through this bridge — the reporting sheet stays the only
 * source of actuals for the GM Review.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LinkMethod } from './varianceSweep';

export interface BudgetSnapshot {
  actual_trip_id: string;
  master_name: string;
  link_method: LinkMethod;
  budget_name: string;
  pax: number;
  guide_wages_budget: number;
  buckets: { [bucketKey: string]: number };
  computed_at: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function makeSnapshot(
  trip: { id: string; masterName: string },
  link: { method: LinkMethod; name: string; pax: number },
  totals: { [bucketKey: string]: number },
  computedAt: string,
): BudgetSnapshot {
  const buckets: { [k: string]: number } = {};
  Object.entries(totals).forEach(([k, v]) => { buckets[k] = r2(v || 0); });
  return {
    actual_trip_id: trip.id,
    master_name: trip.masterName,
    link_method: link.method,
    budget_name: link.name,
    pax: link.pax,
    guide_wages_budget: buckets.guideWages ?? 0,
    buckets,
    computed_at: computedAt,
  };
}

export interface SnapshotResult { written: number; byMethod: { [m in LinkMethod]: number }; error?: string }

export async function writeBudgetSnapshots(supabase: SupabaseClient, rows: BudgetSnapshot[]): Promise<SnapshotResult> {
  const byMethod = { pinned: 0, named: 0, fuzzy: 0 } as { [m in LinkMethod]: number };
  rows.forEach(r => { byMethod[r.link_method] += 1; });
  if (rows.length === 0) return { written: 0, byMethod };
  const { data, error } = await supabase
    .from('gm_trip_budgets')
    .upsert(rows, { onConflict: 'actual_trip_id' })
    .select('actual_trip_id');
  if (error) return { written: 0, byMethod, error: error.message };
  // RLS can silently return zero rows on a blocked write — report that as a failure.
  if (!data || data.length === 0) return { written: 0, byMethod, error: 'no rows written (check gm_trip_budgets insert/update policy)' };
  return { written: data.length, byMethod };
}

/** One admin verdict from the invoice portal. Columns read defensively. */
export interface PortalWageFlag {
  id: string;
  actual_trip_id: string | null;
  trip_name: string | null;
  portal_trip_name: string | null;
  budget: number | null;
  wages_to_date: number | null;
  delta: number | null;
  verdict: string | null;
  verdict_note: string | null;
  verdict_by: string | null;
  created_at: string | null;
}

export async function fetchPortalWageFlags(supabase: SupabaseClient): Promise<{ rows: PortalWageFlag[]; error?: string }> {
  const { data, error } = await supabase.from('portal_wage_flags').select('*').order('created_at', { ascending: false });
  if (error) return { rows: [], error: error.message };
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
  return {
    rows: (data || []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      actual_trip_id: (r.actual_trip_id as string) ?? null,
      trip_name: (r.trip_name as string) ?? null,
      portal_trip_name: (r.portal_trip_name as string) ?? null,
      budget: num(r.budget),
      wages_to_date: num(r.wages_to_date),
      delta: num(r.delta),
      verdict: (r.verdict as string) ?? null,
      verdict_note: (r.verdict_note as string) ?? null,
      verdict_by: (r.verdict_by as string) ?? null,
      created_at: (r.created_at as string) ?? null,
    })),
  };
}

/** What each portal verdict means for the Guide Wages budget (from the bridge brief). */
export const PORTAL_VERDICT_HINT: { [v: string]: string } = {
  expected: 'Guide Wages budget may be too low — raise it or add an expected_variances rule if this repeats.',
  'mapping-error': 'Trip link is wrong — fix the pinned link.',
  'vendor-issue': 'Real overbilling — leave the budget alone.',
  noise: 'Nothing to learn.',
};

export const normVerdict = (v: string | null) => (v || '').toLowerCase().replace(/[\s_]+/g, '-');
