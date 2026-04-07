'use client';

import { useState } from 'react';
import { TabType, HistoricalTrip } from '@/lib/types';
import { useTripData } from '@/hooks/useTripData';
import Header from './Header';
import Tabs from './Tabs';
import SummaryTab from './SummaryTab';
import InputsTab from './InputsTab';
import ExtensionTab from './ExtensionTab';
import HistoryTab from './HistoryTab';
import FinancialsTab from './FinancialsTab';

export default function PricingTool() {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const tripData = useTripData();

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

  const handleSaveToHistory = async (pax: number, category: string, year?: number, status?: string, country?: string): Promise<boolean> => {
    const success = await tripData.saveTripsToHistory(pax, category, year, status, country);
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
      />

      <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="mt-6">
        {activeTab === 'summary' && (
          <SummaryTab config={tripData.config} updateConfig={tripData.updateConfig} isNewTrip={tripData.isNewTrip} />
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
          />
        )}
        {activeTab === 'financials' && (
          <FinancialsTab refreshKey={historyRefreshKey} />
        )}
      </div>
    </div>
  );
}
