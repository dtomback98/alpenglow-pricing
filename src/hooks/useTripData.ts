'use client';

import { useState, useEffect, useCallback } from 'react';
import { TripConfiguration } from '@/lib/types';
import { DEFAULT_CONFIG } from '@/lib/constants';
import {
  fetchTripConfigurations,
  fetchTripConfiguration,
  saveTripConfiguration,
  deleteTripConfiguration,
  saveToHistory,
  isSupabaseConfigured,
} from '@/lib/supabase';

interface UseTripDataReturn {
  config: TripConfiguration;
  setConfig: (config: TripConfiguration) => void;
  updateConfig: (updates: Partial<TripConfiguration> | ((prev: TripConfiguration) => Partial<TripConfiguration>)) => void;
  trips: TripConfiguration[];
  selectedTripId: string | null;
  selectTrip: (id: string | null) => void;
  saveTrip: () => Promise<void>;
  saveTripsToHistory: (pax: number, category: string, year?: number, status?: string) => Promise<boolean>;
  deleteTrip: (id: string) => Promise<void>;
  createNewTrip: () => void;
  loading: boolean;
  saving: boolean;
  error: string | null;
  isConnected: boolean;
}

export function useTripData(): UseTripDataReturn {
  const [config, setConfigState] = useState<TripConfiguration>(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
  const [trips, setTrips] = useState<TripConfiguration[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Load trips on mount
  useEffect(() => {
    const loadTrips = async () => {
      if (!isSupabaseConfigured()) {
        setIsConnected(false);
        setLoading(false);
        return;
      }

      setIsConnected(true);
      setLoading(true);
      setError(null);

      try {
        const loadedTrips = await fetchTripConfigurations();
        setTrips(loadedTrips);

        // If we have trips, select the most recent one
        if (loadedTrips.length > 0) {
          const mostRecent = loadedTrips[0];
          setSelectedTripId(mostRecent.id || null);
          setConfigState(mostRecent);
        }
      } catch (err) {
        setError('Failed to load trips');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadTrips();
  }, []);

  // Update config with partial updates (accepts object or function for latest-state reads)
  const updateConfig = useCallback((updates: Partial<TripConfiguration> | ((prev: TripConfiguration) => Partial<TripConfiguration>)) => {
    setConfigState(prev => {
      const resolved = typeof updates === 'function' ? updates(prev) : updates;
      return { ...prev, ...resolved };
    });
  }, []);

  // Set entire config
  const setConfig = useCallback((newConfig: TripConfiguration) => {
    setConfigState(newConfig);
  }, []);

  // Select a trip
  const selectTrip = useCallback(async (id: string | null) => {
    if (id === null) {
      setSelectedTripId(null);
      setConfigState(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
      return;
    }

    if (!isSupabaseConfigured()) return;

    setLoading(true);
    try {
      const trip = await fetchTripConfiguration(id);
      if (trip) {
        setSelectedTripId(id);
        setConfigState(trip);
      } else {
        setError('Trip not found. It may have been deleted.');
      }
    } catch (err) {
      setError('Failed to load trip');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save current trip
  const saveTrip = useCallback(async () => {
    if (saving) return;
    if (!isSupabaseConfigured()) {
      setError('Supabase not configured. Data will not persist.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const configToSave = selectedTripId
        ? { ...config, id: selectedTripId }
        : config;

      const saved = await saveTripConfiguration(configToSave);

      if (saved) {
        setSelectedTripId(saved.id || null);
        setConfigState(saved);

        // Refresh trips list
        const updatedTrips = await fetchTripConfigurations();
        setTrips(updatedTrips);
      } else {
        setError('Failed to save trip');
      }
    } catch (err) {
      setError('Failed to save trip');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [config, selectedTripId, saving]);

  // Save current trip to history at a specific pax level
  const saveTripsToHistory = useCallback(async (pax: number, category: string, year?: number, status?: string): Promise<boolean> => {
    if (saving) return false;
    if (!isSupabaseConfigured()) {
      setError('Supabase not configured.');
      return false;
    }

    setSaving(true);
    setError(null);

    try {
      // Always save the trip config first to ensure latest changes are persisted
      const configToSave = selectedTripId
        ? { ...config, id: selectedTripId }
        : config;

      const saved = await saveTripConfiguration(configToSave);
      if (!saved) {
        setError('Failed to save trip before adding to history');
        return false;
      }
      setSelectedTripId(saved.id || null);
      setConfigState(saved);

      const updatedTrips = await fetchTripConfigurations();
      setTrips(updatedTrips);

      const success = await saveToHistory(saved, pax, category, year, status);
      if (!success) {
        setError('Failed to save to history');
        return false;
      }
      return true;
    } catch (err) {
      setError('Failed to save to history');
      console.error(err);
      return false;
    } finally {
      setSaving(false);
    }
  }, [config, selectedTripId, saving]);

  // Delete a trip
  const deleteTrip = useCallback(async (id: string) => {
    if (!isSupabaseConfigured()) return;

    try {
      const success = await deleteTripConfiguration(id);
      if (success) {
        // Refresh trips list
        const updatedTrips = await fetchTripConfigurations();
        setTrips(updatedTrips);

        // If we deleted the selected trip, reset to default
        if (selectedTripId === id) {
          setSelectedTripId(null);
          setConfigState(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
        }
      }
    } catch (err) {
      setError('Failed to delete trip');
      console.error(err);
    }
  }, [selectedTripId]);

  // Create a new trip
  const createNewTrip = useCallback(() => {
    setSelectedTripId(null);
    setConfigState({ ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)), name: 'New Trip' });
  }, []);

  return {
    config,
    setConfig,
    updateConfig,
    trips,
    selectedTripId,
    selectTrip,
    saveTrip,
    saveTripsToHistory,
    deleteTrip,
    createNewTrip,
    loading,
    saving,
    error,
    isConnected,
  };
}
