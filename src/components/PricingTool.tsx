'use client';

import { useState } from 'react';
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
  const tripData = useTripData();

  const handleLoadTrip = (tripConfigId: string) => {
    tripData.selectTrip(tripConfigId);
    setActiveTab('summary');
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
        saveTripsToHistory={tripData.saveTripsToHistory}
        createNewTrip={tripData.createNewTrip}
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
          <HistoryTab onLoadTrip={handleLoadTrip} />
        )}
      </div>
    </div>
  );
}
