'use client';

import { useState, useEffect, useCallback } from 'react';
import { HistoricalTrip } from '@/lib/types';
import { fetchHistoricalTrips, deleteHistoricalTrip, isSupabaseConfigured } from '@/lib/supabase';
import historicalData from '@/lib/historical-data.json';

// Type the imported JSON data
const HISTORICAL_DATA: HistoricalTrip[] = historicalData as HistoricalTrip[];

interface UseHistoricalDataReturn {
  trips: HistoricalTrip[];
  loading: boolean;
  error: string | null;
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  categories: string[];
  refresh: () => Promise<void>;
  deleteTrip: (id: string) => Promise<boolean>;
}

export function useHistoricalData(): UseHistoricalDataReturn {
  const [trips, setTrips] = useState<HistoricalTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Get unique categories from the data
  const categories = Array.from(new Set(HISTORICAL_DATA.map(t => t.category))).sort();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (isSupabaseConfigured()) {
        // Try to load from Supabase first
        const data = await fetchHistoricalTrips(selectedCategory || undefined);
        if (data.length > 0) {
          setTrips(data);
          return;
        }
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
    const success = await deleteHistoricalTrip(id);
    if (success) {
      await loadData();
    }
    return success;
  }, [loadData]);

  return {
    trips,
    loading,
    error,
    selectedCategory,
    setSelectedCategory,
    categories,
    refresh: loadData,
    deleteTrip,
  };
}
