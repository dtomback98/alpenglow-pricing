'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { TripConfiguration, HistoricalTrip } from '@/lib/types';
import { DEFAULT_CONFIG } from '@/lib/constants';
import { calculateForPax } from '@/lib/calculations';
import {
  fetchTripConfiguration,
  saveTripConfiguration,
  saveToHistory,
  updateHistoryEntryNumbers,
  isSupabaseConfigured,
} from '@/lib/supabase';

const SESSION_KEY = 'lastLoadedHistoryEntry';

interface UseTripDataReturn {
  config: TripConfiguration;
  setConfig: (config: TripConfiguration) => void;
  updateConfig: (updates: Partial<TripConfiguration> | ((prev: TripConfiguration) => Partial<TripConfiguration>), options?: { silent?: boolean }) => void;
  loadedHistoryEntry: HistoricalTrip | null;
  isNewTrip: boolean;
  loadFromHistory: (entry: HistoricalTrip) => Promise<void>;
  saveTrip: () => Promise<void>;
  saveTripsToHistory: (pax: number, category: string, year?: number, status?: string, country?: string) => Promise<boolean>;
  createNewTrip: () => void;
  syncLoadedTripName: () => Promise<void>;
  isDirty: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  isConnected: boolean;
}

export function useTripData(): UseTripDataReturn {
  const [config, setConfigState] = useState<TripConfiguration>(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
  const [loadedHistoryEntry, setLoadedHistoryEntry] = useState<HistoricalTrip | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const sessionRestored = useRef(false);

  // isNewTrip: true when no history entry has been saved yet for this config
  const isNewTrip = loadedHistoryEntry === null;

  // Check connection on mount; also restore last session trip from sessionStorage
  useEffect(() => {
    const connected = isSupabaseConfigured();
    setIsConnected(connected);

    if (!connected || sessionRestored.current) return;
    sessionRestored.current = true;

    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (!stored) return;
      const entry: HistoricalTrip = JSON.parse(stored);
      if (!entry?.tripConfigId) return;

      setLoading(true);
      fetchTripConfiguration(entry.tripConfigId)
        .then(trip => {
          if (trip) {
            setConfigState({ ...trip, notes: entry.notes ?? trip.notes ?? '' });
            setLoadedHistoryEntry(entry);
            setIsDirty(false);
          } else {
            // Trip deleted — silently clear stale session entry
            sessionStorage.removeItem(SESSION_KEY);
          }
        })
        .catch(() => sessionStorage.removeItem(SESSION_KEY))
        .finally(() => setLoading(false));
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist / clear last loaded entry in sessionStorage whenever it changes
  useEffect(() => {
    if (loadedHistoryEntry) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(loadedHistoryEntry));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, [loadedHistoryEntry]);

  // Update config with partial updates
  // Pass { silent: true } for system-initiated normalizations that should not mark dirty
  const updateConfig = useCallback((
    updates: Partial<TripConfiguration> | ((prev: TripConfiguration) => Partial<TripConfiguration>),
    options?: { silent?: boolean }
  ) => {
    setConfigState(prev => {
      const resolved = typeof updates === 'function' ? updates(prev) : updates;
      return { ...prev, ...resolved };
    });
    if (!options?.silent) setIsDirty(true);
  }, []);

  // Set entire config
  const setConfig = useCallback((newConfig: TripConfiguration) => {
    setConfigState(newConfig);
    setIsDirty(true);
  }, []);

  // Load a trip from a history entry
  const loadFromHistory = useCallback(async (entry: HistoricalTrip) => {
    if (!entry.tripConfigId) {
      setError('This entry has no linked config and cannot be loaded.');
      return;
    }
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const trip = await fetchTripConfiguration(entry.tripConfigId);
      if (trip) {
        // History entry notes may have been edited inline after the last Save —
        // use them as the source of truth so Summary and History tabs start in sync.
        setConfigState({ ...trip, notes: entry.notes ?? trip.notes ?? '' });
        setLoadedHistoryEntry(entry);
        setIsDirty(false);
      } else {
        setError('Trip config not found. It may have been deleted.');
      }
    } catch (err) {
      setError('Failed to load trip');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // Save: overwrites the currently loaded trip config and updates the history entry numbers
  const saveTrip = useCallback(async () => {
    if (saving) return;
    if (!isSupabaseConfigured()) {
      setError('Supabase not configured. Data will not persist.');
      return;
    }
    if (!loadedHistoryEntry) {
      setError('No trip loaded. Use "Save to History" to save this new trip.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const saved = await saveTripConfiguration(config);
      if (!saved) {
        setError('Failed to save trip');
        return;
      }

      // Recalculate at the history entry's pax and update stored numbers + sync name/notes
      const calc = calculateForPax(loadedHistoryEntry.pax, saved);
      await updateHistoryEntryNumbers(loadedHistoryEntry.id, {
        revenue: calc.totalRevenue,
        gross_profit: calc.grossProfit,
        margin: calc.margin,
        price_per_pax: loadedHistoryEntry.pax > 0 ? calc.totalRevenue / loadedHistoryEntry.pax : 0,
        name: saved.name,
        notes: saved.notes || '',
      });

      setConfigState(saved);
      setLoadedHistoryEntry(prev => prev ? { ...prev, name: saved.name, notes: saved.notes || '' } : prev);
      setIsDirty(false);
    } catch (err) {
      setError('Failed to save trip');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [config, loadedHistoryEntry, saving]);

  // Save to History: always creates a brand-new config record + new history entry
  // This is "Save As" — each call produces a fully independent snapshot
  const saveTripsToHistory = useCallback(async (
    pax: number,
    category: string,
    year?: number,
    status?: string,
    country?: string
  ): Promise<boolean> => {
    if (saving) return false;
    if (!isSupabaseConfigured()) {
      setError('Supabase not configured.');
      return false;
    }

    setSaving(true);
    setError(null);

    try {
      // Strip ID to force a fresh insert — each history entry owns its own config
      const configForSave = { ...config, id: undefined };
      const newConfig = await saveTripConfiguration(configForSave);
      if (!newConfig) {
        setError('Failed to create trip config');
        return false;
      }

      const historyEntry = await saveToHistory(newConfig, pax, category, year, status, country);
      if (!historyEntry) {
        setError('Failed to save to history');
        return false;
      }

      setConfigState(newConfig);
      setLoadedHistoryEntry(historyEntry);
      setIsDirty(false);
      return true;
    } catch (err) {
      setError('Failed to save to history');
      console.error(err);
      return false;
    } finally {
      setSaving(false);
    }
  }, [config, saving]);

  // Create a new blank trip
  const createNewTrip = useCallback(() => {
    setConfigState({ ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)), name: 'New Trip' });
    setLoadedHistoryEntry(null);
    setIsDirty(false);
    setError(null);
  }, []);

  // Sync the loaded trip's name from DB (called after a rename on the history tab)
  const syncLoadedTripName = useCallback(async () => {
    if (!loadedHistoryEntry?.tripConfigId) return;
    const trip = await fetchTripConfiguration(loadedHistoryEntry.tripConfigId);
    if (trip) {
      setConfigState(prev => ({ ...prev, name: trip.name }));
      setLoadedHistoryEntry(prev => prev ? { ...prev, name: trip.name } : prev);
    }
  }, [loadedHistoryEntry]);

  return {
    config,
    setConfig,
    updateConfig,
    loadedHistoryEntry,
    isNewTrip,
    loadFromHistory,
    saveTrip,
    saveTripsToHistory,
    createNewTrip,
    syncLoadedTripName,
    isDirty,
    loading,
    saving,
    error,
    isConnected,
  };
}
