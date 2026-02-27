'use client';

import { useState, useEffect } from 'react';
import { TabType } from '@/lib/types';
import { useTripData } from '@/hooks/useTripData';
import Header from './Header';
import Tabs from './Tabs';
import SummaryTab from './SummaryTab';
import InputsTab from './InputsTab';
import ExtensionTab from './ExtensionTab';
import HistoryTab from './HistoryTab';

export default function PricingTool() {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const tripData = useTripData();

  // Auto-select number input text on focus so typing replaces the value instead of appending to it
  useEffect(() => {
    const handler = (e: FocusEvent) => {
      const el = e.target as HTMLInputElement;
      if (el.tagName === 'INPUT' && el.type === 'number') {
        el.select();
      }
    };
    document.addEventListener('focusin', handler);
    return () => document.removeEventListener('focusin', handler);
  }, []);

  const handleLoadTrip = (tripConfigId: string) => {
    tripData.selectTrip(tripConfigId);
    setActiveTab('summary');
  };

  const handleSaveToHistory = async (pax: number, category: string, year?: number, status?: string): Promise<boolean> => {
    const success = await tripData.saveTripsToHistory(pax, category, year, status);
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
        trips={tripData.trips}
        selectedTripId={tripData.selectedTripId}
        selectTrip={tripData.selectTrip}
        saveTrip={tripData.saveTrip}
        saveTripsToHistory={handleSaveToHistory}
        createNewTrip={tripData.createNewTrip}
        deleteTrip={tripData.deleteTrip}
        saving={tripData.saving}
        isConnected={tripData.isConnected}
        error={tripData.error}
      />

      <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="mt-6">
        {activeTab === 'summary' && (
          <SummaryTab config={tripData.config} />
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
          <HistoryTab onLoadTrip={handleLoadTrip} refreshKey={historyRefreshKey} />
        )}
      </div>
    </div>
  );
}
