'use client';

import { useState, useEffect } from 'react';
import { TripConfiguration } from '@/lib/types';
import TripSelector from './TripSelector';

const CATEGORIES = ['Beg', 'Inter', 'Adv', 'Ski', '8k E'];
const COUNTRIES = ['Antarctica', 'Argentina', 'Bolivia', 'Canada', 'Chile', 'Ecuador', 'Japan', 'Kyrgyzstan', 'Mexico', 'Nepal', 'Peru', 'Tanzania', 'Other'];

interface HeaderProps {
  config: TripConfiguration;
  updateConfig: (updates: Partial<TripConfiguration> | ((prev: TripConfiguration) => Partial<TripConfiguration>)) => void;
  trips: TripConfiguration[];
  selectedTripId: string | null;
  selectTrip: (id: string | null) => void;
  saveTrip: () => Promise<void>;
  saveTripsToHistory: (pax: number, category: string, year?: number, status?: string, country?: string) => Promise<boolean>;
  createNewTrip: () => void;
  deleteTrip: (id: string) => Promise<void>;
  saving: boolean;
  isConnected: boolean;
  error: string | null;
}

export default function Header({
  config,
  updateConfig,
  trips,
  selectedTripId,
  selectTrip,
  saveTrip,
  saveTripsToHistory,
  createNewTrip,
  deleteTrip,
  saving,
  isConnected,
  error,
}: HeaderProps) {
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyPax, setHistoryPax] = useState(config.paxMin || 1);
  const [historyCategory, setHistoryCategory] = useState('Beg');
  const [historySaving, setHistorySaving] = useState(false);
  const [historySuccess, setHistorySuccess] = useState(false);
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
  const paxOptions: number[] = [];
  for (let p = paxMin; p <= paxMax; p += paxStep) {
    paxOptions.push(p);
  }

  const handleSaveToHistory = async () => {
    if (!paxOptions.includes(historyPax)) return; // guard against invalid pax range state
    setHistorySaving(true);
    setHistorySuccess(false);
    const success = await saveTripsToHistory(historyPax, historyCategory, historyYear, historyStatus, historyCountry);
    setHistorySaving(false);
    if (success) {
      setHistorySuccess(true);
      setTimeout(() => {
        setShowHistoryModal(false);
        setHistorySuccess(false);
      }, 1500);
    }
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
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-ag-success' : 'bg-ag-warning'
              }`}
            />
            <span className="text-sm text-ag-text-muted">
              {isConnected ? 'Connected' : 'Local Mode'}
            </span>
          </div>

          {/* Trip selector */}
          <TripSelector
            trips={trips}
            selectedTripId={selectedTripId}
            selectTrip={selectTrip}
            createNewTrip={createNewTrip}
            deleteTrip={deleteTrip}
          />

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
            onClick={saveTrip}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? 'Saving...' : 'Save'}
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

                <div className="form-group mb-3">
                  <label className="form-label">Pax Size</label>
                  <select
                    value={historyPax}
                    onChange={(e) => setHistoryPax(Number(e.target.value))}
                    className="w-full"
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
                    disabled={historySaving}
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

      {/* Error message */}
      {error && (
        <div className="mt-4 p-3 bg-ag-danger/20 border border-ag-danger rounded text-sm text-ag-danger">
          {error}
        </div>
      )}
    </header>
  );
}
