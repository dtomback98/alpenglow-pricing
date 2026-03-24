'use client';

import { TabType } from '@/lib/types';

interface TabsProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

const tabs: { id: TabType; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'inputs-core', label: 'Inputs - Core Trip' },
  { id: 'inputs-extension', label: 'Inputs - Extension' },
  { id: 'history', label: 'History' },
  { id: 'financials', label: 'Financials' },
];

export default function Tabs({ activeTab, setActiveTab }: TabsProps) {
  return (
    <nav className="border-b border-ag-border">
      <div className="flex gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
