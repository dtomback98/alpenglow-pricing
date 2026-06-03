'use client';

import { useState, useEffect } from 'react';
import { TripConfiguration } from '@/lib/types';
import { STATUS_LABELS, STATUS_BADGE_CLASSES } from '@/lib/constants';

const CATEGORIES = ['Beg', 'Inter', 'Adv', 'Ski', '8k E'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface HeaderProps {
  config: TripConfiguration;
  updateConfig: (updates: Partial<TripConfiguration> | ((prev: TripConfiguration) => Partial<TripConfiguration>)) => void;
  saveTrip: () => Promise<void>;
  saveTripsToHistory: (pax: number, category: string, year?: number, status?: string, country?: string, month?: string) => Promise<boolean>;
  createNewTrip: () => void;
  isDirty: boolean;
  isNewTrip: boolean;
  saving: boolean;
  isConnected: boolean;
  error: string | null;
  loadedHistoryEntryId?: string;
  loadedStatus?: string;
  loadedCategory?: string;
  loadedYear?: number;
  loadedCountry?: string;
  loadedMonth?: string;
  loading?: boolean;
  expeditions: string[];
}

export default function Header({
  config,
  updateConfig,
  saveTrip,
  saveTripsToHistory,
  createNewTrip,
  isDirty,
  isNewTrip,
  saving,
  isConnected,
  error,
  loadedHistoryEntryId,
  loadedStatus,
  loadedCategory,
  loadedYear,
  loadedCountry,
  loadedMonth,
  loading,
  expeditions,
}: HeaderProps) {
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyPax, setHistoryPax] = useState(config.paxMin || 1);
  const [historyCategory, setHistoryCategory] = useState('Beg');
  const [historySaving, setHistorySaving] = useState(false);
  const [historySuccess, setHistorySuccess] = useState(false);
  const [saveWarning, setSaveWarning] = useState(false);
  const currentYear = new Date().getFullYear();
  const [historyYear, setHistoryYear] = useState(currentYear);
  const [historyStatus, setHistoryStatus] = useState<'budgeted' | 'run' | 'actuals' | 'scratch' | 'open-enrollment' | 'for-review'>('budgeted');
  const [historyCountry, setHistoryCountry] = useState('Other');
  const [historyMonth, setHistoryMonth] = useState('');

  const paxMin = config.paxMin || 1;
  const paxMax = config.paxMax || 16;
  const paxStep = Math.max(1, Math.round(config.paxStep || 1));

  // Reset historyPax when trip's pax range changes
  useEffect(() => {
    setHistoryPax(paxMin);
  }, [paxMin, paxMax, paxStep]);

  // Sync modal fields when a different trip is loaded (or after Save to History creates a new entry)
  useEffect(() => {
    if (loadedHistoryEntryId) {
      setHistoryCategory(loadedCategory ?? 'Beg');
      setHistoryYear(loadedYear ?? currentYear);
      setHistoryStatus((loadedStatus as typeof historyStatus) ?? 'budgeted');
      setHistoryCountry(loadedCountry ?? 'Other');
      setHistoryMonth(loadedMonth ?? '');
    } else {
      setHistoryCategory('Beg');
      setHistoryYear(currentYear);
      setHistoryStatus('budgeted');
      setHistoryCountry('Other');
      setHistoryMonth('');
    }
  }, [loadedHistoryEntryId, loadedCategory, loadedYear, loadedStatus, loadedCountry, loadedMonth, currentYear]);

  // Clear save warning when isDirty or isNewTrip changes
  useEffect(() => {
    setSaveWarning(false);
  }, [isDirty, isNewTrip]);

  const paxOptions: number[] = [];
  for (let p = paxMin; p <= paxMax; p += paxStep) {
    paxOptions.push(p);
  }

  const handleSaveClick = () => {
    if (isNewTrip) {
      setSaveWarning(true);
      return;
    }
    saveTrip();
  };

  const handleSaveToHistory = async () => {
    if (paxOptions.length === 0) return;
    if (!paxOptions.includes(historyPax)) return;
    setHistorySaving(true);
    setHistorySuccess(false);
    const trimmed = historyCountry.trim();
    const normalizedCountry = expeditions.find(c => c.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
    const success = await saveTripsToHistory(historyPax, historyCategory, historyYear, historyStatus, normalizedCountry, historyMonth || undefined);
    setHistorySaving(false);
    if (success) {
      setHistorySuccess(true);
      setTimeout(() => {
        setShowHistoryModal(false);
        setHistorySuccess(false);
      }, 1500);
    }
  };

  const dirtyWarning = isNewTrip
    ? "You have unsaved changes. Use 'Save to History' to save this new trip, or continue and lose your work."
    : "You have unsaved changes. Hit 'Save' to update this trip or 'Save to History' to create a new version — continue and lose your work?";

  const guardedCreateNewTrip = () => {
    if (isDirty && !confirm(dirtyWarning)) return;
    createNewTrip();
  };

  return (
    <header className="card mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ag-text">
            Alpenglow Pricing Tool
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Connection status */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-ag-success' : 'bg-ag-warning'}`} />
            <span className="text-sm text-ag-text-muted">
              {isConnected ? 'Connected' : 'Local Mode'}
            </span>
          </div>

          {/* New Trip button */}
          <button
            onClick={guardedCreateNewTrip}
            disabled={saving}
            className="btn btn-secondary"
          >
            + New Trip
          </button>

          {/* Trip name input + metadata */}
          <div className="relative">
            <input
              type="text"
              value={config.name}
              onChange={(e) => updateConfig({ name: e.target.value })}
              className="w-80 text-sm"
              placeholder="Trip name"
            />
            {loadedHistoryEntryId && (loadedCategory || loadedStatus || loadedYear) && (
              <p className="absolute top-full left-0 mt-0.5 text-xs text-ag-text-muted px-1 whitespace-nowrap">
                {[loadedCategory, loadedYear, STATUS_LABELS[loadedStatus ?? ''] ?? loadedStatus].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          {/* Save button */}
          <button
            onClick={handleSaveClick}
            disabled={saving}
            className={`btn ${isDirty && !isNewTrip ? 'btn-primary ring-2 ring-ag-accent ring-offset-2 ring-offset-ag-bg' : 'btn-secondary'}`}
          >
            {saving ? 'Saving...' : isDirty && !isNewTrip ? 'Save*' : 'Save'}
          </button>

          {/* Save to History button */}
          <div className="relative">
            <button
              onClick={() => setShowHistoryModal(!showHistoryModal)}
              disabled={saving}
              className="btn btn-secondary"
            >
              Save to History
            </button>

            {showHistoryModal && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-ag-card border border-ag-border rounded-lg shadow-lg p-4 z-50">
                <h3 className="text-sm font-semibold text-ag-text mb-3">Save to {historyYear} History</h3>

                {paxOptions.length === 0 && (
                  <div className="mb-3 p-2 bg-ag-danger/20 border border-ag-danger rounded text-xs text-ag-danger">
                    Invalid pax range — Min Pax must be less than or equal to Max Pax before saving.
                  </div>
                )}

                <div className="form-group mb-3">
                  <label className="form-label">Pax Size</label>
                  <select
                    value={historyPax}
                    onChange={(e) => setHistoryPax(Number(e.target.value))}
                    className="w-full"
                    disabled={paxOptions.length === 0}
                  >
                    {paxOptions.map(p => (
                      <option key={p} value={p}>{p} pax</option>
                    ))}
                  </select>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Category</label>
                  <select
                    value={historyCategory}
                    onChange={(e) => setHistoryCategory(e.target.value)}
                    className="w-full"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Year</label>
                  <select value={historyYear} onChange={(e) => setHistoryYear(Number(e.target.value))} className="w-full">
                    <option value={currentYear}>{currentYear}</option>
                    <option value={currentYear + 1}>{currentYear + 1}</option>
                  </select>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Month</label>
                  <select value={historyMonth} onChange={(e) => setHistoryMonth(e.target.value)} className="w-full">
                    <option value="">N/A</option>
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Status</label>
                  <select value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value as 'budgeted' | 'run' | 'actuals' | 'scratch' | 'open-enrollment' | 'for-review')} className="w-full">
                    <option value="budgeted">Budgeted</option>
                    <option value="open-enrollment">Open Enrollment</option>
                    <option value="for-review">For Review</option>
                    <option value="run">Run</option>
                    <option value="actuals">Actuals</option>
                    <option value="scratch">Scratch</option>
                  </select>
                </div>

                <div className="form-group mb-4">
                  <label className="form-label">Expedition</label>
                  <select
                    value={historyCountry}
                    onChange={(e) => setHistoryCountry(e.target.value)}
                    className="w-full"
                  >
                    {expeditions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveToHistory}
                    disabled={historySaving || paxOptions.length === 0}
                    className="btn btn-primary flex-1"
                  >
                    {historySaving ? 'Saving...' : historySuccess ? 'Saved!' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save warning for new trips */}
      {saveWarning && (
        <div className="mt-3 p-3 bg-ag-warning/20 border border-ag-warning rounded text-sm text-ag-warning">
          No trip loaded — use <strong>Save to History</strong> to save this new trip, or load an existing trip from the History tab.
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-4 p-3 bg-ag-danger/20 border border-ag-danger rounded text-sm text-ag-danger">
          {error}
        </div>
      )}
    </header>
  );
}
