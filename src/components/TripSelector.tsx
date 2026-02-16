'use client';

import { TripConfiguration } from '@/lib/types';

interface TripSelectorProps {
  trips: TripConfiguration[];
  selectedTripId: string | null;
  selectTrip: (id: string | null) => void;
  createNewTrip: () => void;
  deleteTrip: (id: string) => Promise<void>;
}

export default function TripSelector({
  trips,
  selectedTripId,
  selectTrip,
  createNewTrip,
  deleteTrip,
}: TripSelectorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'new') {
      createNewTrip();
    } else if (value === '') {
      selectTrip(null);
    } else {
      selectTrip(value);
    }
  };

  const handleDelete = () => {
    if (!selectedTripId) return;
    const tripName = trips.find(t => t.id === selectedTripId)?.name || 'this trip';
    if (confirm(`Delete "${tripName}"? This cannot be undone.`)) {
      deleteTrip(selectedTripId);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <select
        value={selectedTripId || ''}
        onChange={handleChange}
        className="w-48"
      >
        <option value="">Select a trip...</option>
        <option value="new">+ New Trip</option>
        {trips.length > 0 && (
          <optgroup label="Saved Trips">
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {selectedTripId && (
        <button
          onClick={handleDelete}
          className="text-ag-text-muted hover:text-ag-danger transition-colors px-1"
          title="Delete trip"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}
    </div>
  );
}
