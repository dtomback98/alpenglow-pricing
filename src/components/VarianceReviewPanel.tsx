'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/calculations';

// ---------------------------------------------------------------- types

export interface VarianceFlag {
  id: string;
  round: number;
  flag_code: string;
  actual_trip_id: string;
  trip_name: string;
  bucket: string;
  line_label: string;
  budget: number;
  actual: number;
  delta: number;
  pct: number | null;
  class: string;
  offset_context: string | null;
  verdict: string | null;
  verdict_note: string | null;
  verdict_at: string | null;
}

const VERDICTS: { key: string; label: string; hint: string }[] = [
  { key: 'vendor-issue', label: 'Vendor issue', hint: 'We were charged incorrectly — follow up with the vendor' },
  { key: 'expected', label: 'Expected', hint: 'Real cost change; the budget is stale, not the vendor wrong' },
  { key: 'mapping-error', label: 'Mapping error', hint: 'Actual and budget lines are the same money under different names' },
  { key: 'noise', label: 'Noise', hint: 'Not worth flagging — tune thresholds/rules' },
];

const CLASS_STYLE: { [k: string]: { label: string; cls: string } } = {
  'possible-vendor-issue': { label: 'Possible vendor issue', cls: 'bg-ag-danger/20 text-ag-danger' },
  'unbudgeted-expense': { label: 'Unbudgeted expense', cls: 'bg-ag-accent/20 text-ag-accent' },
  'likely-mapping-internal': { label: 'Likely mis-labeled (internal)', cls: 'bg-ag-card-lighter text-ag-text-muted' },
  'under-budget': { label: 'Under budget', cls: 'bg-ag-card-lighter text-ag-text-muted' },
  'missing-actual': { label: 'Budgeted, no actual', cls: 'bg-ag-card-lighter text-ag-text-muted' },
  'expected-per-feedback': { label: 'Expected (per feedback)', cls: 'bg-ag-success/15 text-ag-success' },
};

const VERDICT_STYLE: { [k: string]: string } = {
  'vendor-issue': 'bg-ag-danger/20 text-ag-danger',
  'expected': 'bg-ag-success/15 text-ag-success',
  'mapping-error': 'bg-ag-accent/15 text-ag-accent',
  'noise': 'bg-ag-card-lighter text-ag-text-muted',
};

const CLASS_ORDER = ['possible-vendor-issue', 'unbudgeted-expense', 'likely-mapping-internal', 'under-budget', 'missing-actual', 'expected-per-feedback'];

// ---------------------------------------------------------------- flag row
// NOTE: defined at module level (not inside the panel component) so React keeps
// a stable component identity across parent re-renders — otherwise the note
// input remounts and drops focus on every keystroke.

function FlagRow({ f, note, onNote, saving, onVerdict, onClear }: {
  f: VarianceFlag;
  note: string;
  onNote: (value: string) => void;
  saving: boolean;
  onVerdict: (verdict: string) => void;
  onClear: () => void;
}) {
  const cs = CLASS_STYLE[f.class] || { label: f.class, cls: 'bg-ag-card-lighter text-ag-text-muted' };
  const fmtPct = f.pct === null ? '—' : `${f.pct >= 0 ? '+' : ''}${(f.pct * 100).toFixed(0)}%`;
  return (
    <div className="border border-ag-border/40 rounded-lg p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-xs text-ag-text-muted">{f.flag_code}</span>
        <span className="font-medium">{f.trip_name}</span>
        <span className="text-ag-text-muted">·</span>
        <span className="text-ag-text-muted">{f.bucket}</span>
        <span className="text-ag-text-muted">/</span>
        <span>{f.line_label}</span>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${cs.cls}`}>{cs.label}</span>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm tabular-nums">
        <span className="text-ag-text-muted">Budget <span className="text-ag-text">{formatCurrency(f.budget)}</span></span>
        <span className="text-ag-text-muted">Actual <span className="text-ag-text">{formatCurrency(f.actual)}</span></span>
        <span className={f.delta > 0 ? 'text-ag-danger' : 'text-ag-success'}>
          {f.delta > 0 ? '+' : '−'}{formatCurrency(Math.abs(f.delta))} ({fmtPct})
        </span>
        {f.offset_context && <span className="text-xs text-ag-text-muted italic">{f.offset_context}</span>}
      </div>
      {f.verdict ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`text-xs px-2 py-0.5 rounded-full ${VERDICT_STYLE[f.verdict] || ''}`}>
            {VERDICTS.find(v => v.key === f.verdict)?.label || f.verdict}
          </span>
          {f.verdict_note && <span className="text-xs text-ag-text-muted">“{f.verdict_note}”</span>}
          <button onClick={onClear} disabled={saving}
            className="text-xs text-ag-text-muted underline ml-auto">un-grade</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {VERDICTS.map(v => (
            <button key={v.key} title={v.hint} disabled={saving}
              onClick={() => onVerdict(v.key)}
              className="text-xs px-2.5 py-1 rounded-full border border-ag-border hover:border-ag-accent hover:text-ag-accent transition-colors">
              {v.label}
            </button>
          ))}
          <input
            type="text"
            placeholder="note (why) — optional but valuable"
            value={note}
            onChange={e => onNote(e.target.value)}
            className="flex-1 min-w-[180px] text-xs bg-transparent border border-ag-border/60 rounded px-2 py-1"
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- component

export default function VarianceReviewPanel() {
  const [flags, setFlags] = useState<VarianceFlag[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [showGraded, setShowGraded] = useState(false);
  const [notes, setNotes] = useState<{ [id: string]: string }>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) { setLoadError('Supabase not configured'); setLoaded(true); return; }
    const { data, error } = await supabase
      .from('variance_flags')
      .select('*')
      .order('round', { ascending: false })
      .order('flag_code', { ascending: true });
    if (error) {
      setLoadError(error.message.includes('variance_flags')
        ? 'variance_flags table not found — run the setup SQL in Supabase first.'
        : `Could not load variance flags: ${error.message}`);
    } else {
      setFlags((data || []) as VarianceFlag[]);
      setLoadError(null);
    }
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveVerdict = async (flag: VarianceFlag, verdict: string) => {
    if (!supabase) return;
    setSaving(flag.id);
    setSaveError(null);
    const note = notes[flag.id] !== undefined ? notes[flag.id] : (flag.verdict_note || '');
    const { data, error } = await supabase
      .from('variance_flags')
      .update({ verdict, verdict_note: note || null, verdict_at: new Date().toISOString() })
      .eq('id', flag.id)
      .select();
    setSaving(null);
    if (error) {
      setSaveError(`Save failed for ${flag.flag_code}: ${error.message}`);
    } else if (!data || data.length === 0) {
      // RLS silently matching 0 rows — surface it instead of pretending success
      setSaveError(`Save failed for ${flag.flag_code}: no rows updated (check the anon UPDATE policy on variance_flags).`);
    } else {
      setFlags(prev => prev.map(f => f.id === flag.id ? (data[0] as VarianceFlag) : f));
    }
  };

  const clearVerdict = async (flag: VarianceFlag) => {
    if (!supabase) return;
    setSaving(flag.id);
    setSaveError(null);
    const { data, error } = await supabase
      .from('variance_flags')
      .update({ verdict: null, verdict_note: null, verdict_at: null })
      .eq('id', flag.id)
      .select();
    setSaving(null);
    if (error || !data || data.length === 0) {
      setSaveError(`Un-grade failed for ${flag.flag_code}: ${error ? error.message : 'no rows updated'}`);
    } else {
      setFlags(prev => prev.map(f => f.id === flag.id ? (data[0] as VarianceFlag) : f));
    }
  };

  if (!loaded) return null;
  if (loadError) {
    return (
      <div className="card border border-ag-border text-sm text-ag-text-muted p-3">
        Variance review: {loadError}
      </div>
    );
  }
  if (flags.length === 0) return null;

  const pending = flags.filter(f => !f.verdict)
    .sort((a, b) => {
      const c = CLASS_ORDER.indexOf(a.class) - CLASS_ORDER.indexOf(b.class);
      if (c) return c;
      // keep counterpart flags on the same trip adjacent (they usually explain each other)
      if (a.class === 'likely-mapping-internal' && a.trip_name !== b.trip_name) {
        return a.trip_name.localeCompare(b.trip_name);
      }
      return Math.abs(b.delta) - Math.abs(a.delta);
    });
  const graded = flags.filter(f => f.verdict);

  const row = (f: VarianceFlag) => (
    <FlagRow
      key={f.id}
      f={f}
      note={notes[f.id] || ''}
      onNote={value => setNotes(prev => ({ ...prev, [f.id]: value }))}
      saving={saving === f.id}
      onVerdict={verdict => saveVerdict(f, verdict)}
      onClear={() => clearVerdict(f)}
    />
  );

  return (
    <div className="card space-y-3">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 text-left">
        <span className="text-sm font-semibold">Variance Review</span>
        {pending.length > 0 ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-ag-accent/20 text-ag-accent">{pending.length} pending</span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-ag-success/15 text-ag-success">all graded</span>
        )}
        <span className="text-xs text-ag-text-muted">{graded.length} graded</span>
        <span className="ml-auto text-ag-text-muted">{open ? '▾' : '▸'}</span>
      </button>
      {saveError && <div className="text-xs text-ag-danger border border-ag-danger rounded p-2">{saveError}</div>}
      {open && (
        <div className="space-y-2">
          <div className="text-xs text-ag-text-muted space-y-1">
            <p>
              Each row is an expense line where actuals differ from budget by more than 15% and $500.
              Read the note, pick a verdict (add a short “why” — it makes the system smarter), and it saves instantly:
            </p>
            <ul className="list-disc pl-5 space-y-0.5">
              <li><span className="text-ag-text">Vendor issue</span> — we were charged incorrectly; follow up with the vendor.</li>
              <li><span className="text-ag-text">Expected</span> — the cost really is different now; the budget is stale, not the vendor wrong.</li>
              <li><span className="text-ag-text">Mapping error</span> — budget and actual are the same money under different labels; not a real variance.</li>
              <li><span className="text-ag-text">Noise</span> — not worth flagging; the system will stop raising it.</li>
            </ul>
            <p>Verdicts feed the next sweep — graded items stop reappearing, and confirmed vendor issues build a price-of-record per vendor.</p>
          </div>
          {pending.map(row)}
          {graded.length > 0 && (
            <>
              <button onClick={() => setShowGraded(!showGraded)} className="text-xs text-ag-text-muted underline">
                {showGraded ? 'hide' : 'show'} {graded.length} graded
              </button>
              {showGraded && graded.map(row)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
