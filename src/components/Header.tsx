'use client';

import { TripConfiguration } from '@/lib/types';
import TripSelector from './TripSelector';

interface HeaderProps {
  config: TripConfiguration;
  updateConfig: (updates: Partial<TripConfiguration>) => void;
  trips: TripConfiguration[];
  selectedTripId: string | null;
  selectTrip: (id: string | null) => void;
  saveTrip: () => Promise<void>;
  createNewTrip: () => void;
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
  createNewTrip,
  saving,
  isConnected,
  error,
}: HeaderProps) {
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
