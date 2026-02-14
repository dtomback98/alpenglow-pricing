'use client';

import { TripConfiguration } from '@/lib/types';

interface TripSelectorProps {
  trips: TripConfiguration[];
  selectedTripId: string | null;
  selectTrip: (id: string | null) => void;
  createNewTrip: () => void;
}

export default function TripSelector({
  trips,
  selectedTripId,
  selectTrip,
  createNewTrip,
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

  return (
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
  );
}
