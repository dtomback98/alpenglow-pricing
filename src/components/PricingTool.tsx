'use client';

import { useState, useEffect } from 'react';
import { TabType, HistoricalTrip } from '@/lib/types';
import { useTripData } from '@/hooks/useTripData';
import { useExpeditions } from '@/hooks/useExpeditions';
import { updateHistoricalTrip } from '@/lib/supabase';
import Header from './Header';
import Tabs from './Tabs';
import SummaryTab from './SummaryTab';
import InputsTab from './InputsTab';
import ExtensionTab from './ExtensionTab';
import HistoryTab from './HistoryTab';
import FinancialsTab from './FinancialsTab';
import GmReviewTab from './GmReviewTab';

export default function PricingTool() {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const tripData = useTripData();

  const ALL_EXTENSION_SECTIONS = ['core', 'discounts', 'singleSupp', 'hotels', 'staff', 'logistics'];
  const [extCollapsedSections, setExtCollapsedSections] = useState<Set<string>>(new Set(ALL_EXTENSION_SECTIONS));
  useEffect(() => {
    setExtCollapsedSections(new Set(ALL_EXTENSION_SECTIONS));
  }, [tripData.config.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const { expeditions, addExpedition } = useExpeditions();

  const handleSaveTrip = async () => {
    await tripData.saveTrip();
    setHistoryRefreshKey(k => k + 1);
  };

  const handleLoadTrip = (trip: HistoricalTrip) => {
    if (tripData.isDirty) {
      const msg = tripData.isNewTrip
        ? "You have unsaved changes. Use 'Save to History' to save this new trip first, or continue and lose your work."
        : "You have unsaved changes. Hit 'Save' to preserve them, or continue and lose your work.";
      if (!confirm(msg)) return;
    }
    tripData.loadFromHistory(trip);
    setActiveTab('summary');
  };

  const handleSaveToHistory = async (pax: number, category: string, year?: number, status?: string, country?: string, month?: string): Promise<boolean> => {
    const success = await tripData.saveTripsToHistory(pax, category, year, status, country, month);
    if (success) {
      setHistoryRefreshKey(k => k + 1);
    }
    return success;
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Header
        config={tripData.config}
        updateConfig={tripData.updateConfig}
        saveTrip={handleSaveTrip}
        saveTripsToHistory={handleSaveToHistory}
        createNewTrip={tripData.createNewTrip}
        isDirty={tripData.isDirty}
        isNewTrip={tripData.isNewTrip}
        saving={tripData.saving}
        isConnected={tripData.isConnected}
        error={tripData.error}
        loadedHistoryEntryId={tripData.loadedHistoryEntry?.id}
        loadedStatus={tripData.loadedHistoryEntry?.status}
        loadedCategory={tripData.loadedHistoryEntry?.category}
        loadedYear={tripData.loadedHistoryEntry?.year}
        loadedCountry={tripData.loadedHistoryEntry?.country}
        loadedMonth={tripData.loadedHistoryEntry?.month}
        loading={tripData.loading}
        expeditions={expeditions}
      />

      <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="mt-6">
        {tripData.loading && (
          <div className="text-center text-ag-text-muted text-sm py-3">Loading trip...</div>
        )}
        {activeTab === 'summary' && (
          <SummaryTab
            config={tripData.config}
            updateConfig={tripData.updateConfig}
            isNewTrip={tripData.isNewTrip}
            onNotesBlur={(notes) => {
              if (tripData.loadedHistoryEntry) {
                updateHistoricalTrip(tripData.loadedHistoryEntry.id, { notes });
              }
            }}
          />
        )}
        {activeTab === 'inputs-core' && (
          <InputsTab
            config={tripData.config}
            updateConfig={tripData.updateConfig}
          />
        )}
        {activeTab === 'inputs-extension' && (
          <ExtensionTab
            config={tripData.config}
            updateConfig={tripData.updateConfig}
            collapsedSections={extCollapsedSections}
            setCollapsedSections={setExtCollapsedSections}
          />
        )}
        {activeTab === 'history' && (
          <HistoryTab
            onLoadTrip={handleLoadTrip}
            refreshKey={historyRefreshKey}
            onTripConfigRenamed={tripData.syncLoadedTripName}
            loadedHistoryEntryId={tripData.loadedHistoryEntry?.id}
            onTripDeleted={(id) => {
              if (tripData.loadedHistoryEntry?.id === id) tripData.createNewTrip();
            }}
            expeditions={expeditions}
            addExpedition={addExpedition}
            onNotesUpdated={(id, notes) => {
              if (id === tripData.loadedHistoryEntry?.id) {
                tripData.updateConfig({ notes }, { silent: true });
              }
            }}
            onEntryUpdated={(id, updates) => {
              if (id === tripData.loadedHistoryEntry?.id) {
                tripData.patchLoadedHistoryEntry(updates);
              }
            }}
          />
        )}
        {activeTab === 'financials' && (
          <FinancialsTab
            refreshKey={historyRefreshKey}
            expeditions={expeditions}
            addExpedition={addExpedition}
          />
        )}
        {activeTab === 'gm-review' && (
          <GmReviewTab refreshKey={historyRefreshKey} />
        )}
      </div>
    </div>
  );
}
