'use client';

import { useState, useEffect } from 'react';
import { TripConfiguration } from '@/lib/types';
import { COUNTRIES } from '@/lib/constants';

const CATEGORIES = ['Beg', 'Inter', 'Adv', 'Ski', '8k E'];

interface HeaderProps {
  config: TripConfiguration;
  updateConfig: (updates: Partial<TripConfiguration> | ((prev: TripConfiguration) => Partial<TripConfiguration>)) => void;
  saveTrip: () => Promise<void>;
  saveTripsToHistory: (pax: number, category: string, year?: number, status?: string, country?: string) => Promise<boolean>;
  createNewTrip: () => void;
  isDirty: boolean;
  isNewTrip: boolean;
  saving: boolean;
  isConnected: boolean;
  error: string | null;
  loadedHistoryEntryId?: string;
  loading?: boolean;
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
  loading,
}: HeaderProps) {
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyPax, setHistoryPax] = useState(config.paxMin || 1);
  const [historyCategory, setHistoryCategory] = useState('Beg');
  const [historySaving, setHistorySaving] = useState(false);
  const [historySuccess, setHistorySuccess] = useState(false);
  const [saveWarning, setSaveWarning] = useState(false);
  const currentYear = new Date().getFullYear();
  const [historyYear, setHistoryYear] = useState(currentYear);
  const [historyStatus, setHistoryStatus] = useState<'budgeted' | 'run' | 'scratch' | 'open-enrollment'>('budgeted');
  const [historyCountry, setHistoryCountry] = useState('Other');

  const paxMin = config.paxMin || 1;
  const paxMax = config.paxMax || 16;
  const paxStep = Math.max(1, Math.round(config.paxStep || 1));

  // Reset historyPax when trip's pax range changes
  useEffect(() => {
    setHistoryPax(paxMin);
  }, [paxMin, paxMax, paxStep]);

  // Reset modal fields when a different trip is loaded
  useEffect(() => {
    setHistoryCategory('Beg');
    setHistoryYear(currentYear);
    setHistoryStatus('budgeted');
    setHistoryCountry('Other');
  }, [loadedHistoryEntryId, currentYear]);

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
    const normalizedCountry = COUNTRIES.find(c => c.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
    const success = await saveTripsToHistory(historyPax, historyCategory, historyYear, historyStatus, normalizedCountry);
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
          <p className="text-ag-text-muted mt-1">
            Trip pricing calculator and analysis
          </p>
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

          {/* Trip name input */}
          <input
            type="text"
            value={config.name}
            onChange={(e) => updateConfig({ name: e.target.value })}
            className="w-48"
            placeholder="Trip name"
          />

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
                  <label className="form-label">Status</label>
                  <select value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value as 'budgeted' | 'run' | 'scratch' | 'open-enrollment')} className="w-full">
                    <option value="budgeted">Budgeted</option>
                    <option value="open-enrollment">Open Enrollment</option>
                    <option value="run">Run</option>
                    <option value="scratch">Scratch</option>
                  </select>
                </div>

                <div className="form-group mb-4">
                  <label className="form-label">Country</label>
                  <input
                    type="text"
                    list="country-suggestions"
                    value={historyCountry}
                    onChange={(e) => setHistoryCountry(e.target.value)}
                    onBlur={(e) => {
                      const trimmed = e.target.value.trim();
                      const match = COUNTRIES.find(c => c.toLowerCase() === trimmed.toLowerCase());
                      setHistoryCountry(match ?? trimmed);
                    }}
                    className="w-full"
                    placeholder="Type or select a country"
                  />
                  <datalist id="country-suggestions">
                    {COUNTRIES.map(c => <option key={c} value={c} />)}
                  </datalist>
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
