'use client';

import { useState, useEffect, useCallback } from 'react';
import { HistoricalTrip } from '@/lib/types';
import { fetchHistoricalTrips, deleteHistoricalTripWithConfig, updateHistoricalTrip, updateTripConfigurationName, updateTripConfigurationNotes, isSupabaseConfigured } from '@/lib/supabase';
import historicalData from '@/lib/historical-data.json';

// Type the imported JSON data
const HISTORICAL_DATA: HistoricalTrip[] = historicalData as HistoricalTrip[];

interface UseHistoricalDataReturn {
  trips: HistoricalTrip[];
  loading: boolean;
  error: string | null;
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  refresh: () => Promise<void>;
  deleteTrip: (id: string) => Promise<boolean>;
  updateTrip: (id: string, updates: { status?: string; notes?: string; name?: string; country?: string; category?: string; year?: number; month?: string | null }) => Promise<boolean>;
}

export function useHistoricalData(): UseHistoricalDataReturn {
  const [trips, setTrips] = useState<HistoricalTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (isSupabaseConfigured()) {
        // Always use Supabase data when configured
        const data = await fetchHistoricalTrips(selectedCategory || undefined);
        setTrips(data);
        return;
      }

      // Fall back to local JSON data
      const filtered = selectedCategory
        ? HISTORICAL_DATA.filter(t => t.category === selectedCategory)
        : HISTORICAL_DATA;
      setTrips(filtered);
    } catch (err) {
      setError('Failed to load historical data');
      console.error(err);
      // Fall back to local data on error
      const filtered = selectedCategory
        ? HISTORICAL_DATA.filter(t => t.category === selectedCategory)
        : HISTORICAL_DATA;
      setTrips(filtered);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const deleteTrip = useCallback(async (id: string): Promise<boolean> => {
    try {
      const trip = trips.find(t => t.id === id);
      const success = await deleteHistoricalTripWithConfig(id, trip?.tripConfigId);
      if (success) {
        await loadData();
      }
      return success;
    } catch (err) {
      console.error('Failed to delete trip:', err);
      setError('Failed to delete trip');
      return false;
    }
  }, [loadData, trips]);

  const updateTrip = useCallback(async (id: string, updates: { status?: string; notes?: string; name?: string; country?: string; category?: string; year?: number; month?: string | null }): Promise<boolean> => {
    try {
      const success = await updateHistoricalTrip(id, updates);
      if (success) {
        const trip = trips.find(t => t.id === id);
        if (updates.name !== undefined && trip?.tripConfigId) {
          await updateTripConfigurationName(trip.tripConfigId, updates.name);
        }
        if (updates.notes !== undefined && trip?.tripConfigId) {
          await updateTripConfigurationNotes(trip.tripConfigId, updates.notes);
        }
        await loadData();
      }
      return success;
    } catch (err) {
      console.error('Failed to update trip:', err);
      setError('Failed to update trip');
      return false;
    }
  }, [loadData, trips]);

  return {
    trips,
    loading,
    error,
    selectedCategory,
    setSelectedCategory,
    refresh: loadData,
    deleteTrip,
    updateTrip,
  };
}
