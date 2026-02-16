'use client';

import { useState, useEffect } from 'react';
import { TripConfiguration, StaffMember, TripSpecificCost } from '@/lib/types';

interface InputsTabProps {
  config: TripConfiguration;
  updateConfig: (updates: Partial<TripConfiguration>) => void;
}

type NestedConfigKey = 'extension' | 'hotelsMeals' | 'logistics' | 'staffConfig' | 'transportConfig' | 'tripSpecific' | 'singleSupplement';

const TRIP_SPECIFIC_FIELDS: { key: keyof Omit<TripConfiguration['tripSpecific'], 'enabled'>; label: string }[] = [
  { key: 'permits', label: 'Permits' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'jacketsApparel', label: 'Jackets & Apparel' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'contingency', label: 'Contingency' },
  { key: 'hypoxico', label: 'Hypoxico' },
  { key: 'otherCosts', label: 'Other Costs' },
];

export default function InputsTab({ config, updateConfig }: InputsTabProps) {
  const updateNestedConfig = <K extends NestedConfigKey>(
    key: K,
    updates: Partial<TripConfiguration[K]>
  ) => {
    const currentValue = config[key];
    updateConfig({
      [key]: { ...currentValue, ...updates },
    } as Partial<TripConfiguration>);
  };

  const updateTripSpecificCost = (
    field: keyof Omit<TripConfiguration['tripSpecific'], 'enabled'>,
    updates: Partial<TripSpecificCost>
  ) => {
    const currentCost = config.tripSpecific[field] as TripSpecificCost;
    updateNestedConfig('tripSpecific', {
      [field]: { ...currentCost, ...updates },
    });
  };

  const paxMin = config.paxMin || 1;
  const paxMax = config.paxMax || 16;
  const paxStep = Math.max(1, Math.round(config.paxStep || 1));

  const paxCounts: number[] = [];
  for (let p = paxMin; p <= paxMax; p += paxStep) {
    paxCounts.push(p);
  }

  const [selectedStaffPax, setSelectedStaffPax] = useState(paxMin);
  useEffect(() => { setSelectedStaffPax(paxMin); }, [paxMin]);

  // Auto-sync staff days with tripDays when not using custom days
  useEffect(() => {
    if (!config.staffConfig.useCustomStaffDays && config.staffConfig.enabled !== false) {
      const newStaffByPax: { [pax: number]: StaffMember[] } = {};
      let changed = false;
      for (const [pax, staff] of Object.entries(config.staffConfig.staffByPax)) {
        newStaffByPax[Number(pax)] = (staff as StaffMember[]).map(s => {
          if (s.days !== config.tripDays) changed = true;
          return { ...s, days: config.tripDays };
        });
      }
      if (changed) {
        updateConfig({ staffConfig: { ...config.staffConfig, staffByPax: newStaffByPax } });
      }
    }
  }, [config.tripDays, config.staffConfig.useCustomStaffDays]);
  const discountsPerPax = config.uiPreferences?.discountsPerPax ?? false;
  const singleSuppPerPax = config.uiPreferences?.singleSuppPerPax ?? false;
  const transportPerPax = config.uiPreferences?.transportPerPax ?? false;
  const setDiscountsPerPax = (val: boolean) => updateConfig({ uiPreferences: { ...config.uiPreferences, discountsPerPax: val } });
  const setSingleSuppPerPax = (val: boolean) => updateConfig({ uiPreferences: { ...config.uiPreferences, singleSuppPerPax: val } });
  const setTransportPerPax = (val: boolean) => updateConfig({ uiPreferences: { ...config.uiPreferences, transportPerPax: val } });


  const effectiveStaffPax = paxCounts.includes(selectedStaffPax) ? selectedStaffPax : paxCounts[0] || 1;

  const currentStaff = config.staffConfig.staffByPax[effectiveStaffPax] || [
    { role: 'Lead Guide', dailyRate: 400, days: config.tripDays, quantity: 1 },
  ];

  const updateStaffMember = (index: number, updates: Partial<StaffMember>) => {
    const newStaff = [...currentStaff];
    newStaff[index] = { ...newStaff[index], ...updates };
    updateNestedConfig('staffConfig', {
      staffByPax: { ...config.staffConfig.staffByPax, [effectiveStaffPax]: newStaff },
    });
  };

  const addStaffMember = () => {
    const newStaff = [
      ...currentStaff,
      { role: 'New Role', dailyRate: 200, days: config.tripDays, quantity: 1 },
    ];
    updateNestedConfig('staffConfig', {
      staffByPax: { ...config.staffConfig.staffByPax, [effectiveStaffPax]: newStaff },
    });
  };

  const removeStaffMember = (index: number) => {
    const newStaff = currentStaff.filter((_, i) => i !== index);
    updateNestedConfig('staffConfig', {
      staffByPax: { ...config.staffConfig.staffByPax, [effectiveStaffPax]: newStaff },
    });
  };

  const copyStaffToAll = () => {
    const newStaffByPax: { [pax: number]: StaffMember[] } = {};
    for (const p of paxCounts) {
      newStaffByPax[p] = currentStaff.map(s => ({ ...s }));
    }
    updateNestedConfig('staffConfig', { staffByPax: newStaffByPax });
  };

  const applyToAllPax = (current: { [pax: number]: number } | undefined, fallback: number) => {
    const baseVal = current?.[paxCounts[0]] ?? fallback;
    const newCounts: { [pax: number]: number } = {};
    for (const p of paxCounts) newCounts[p] = baseVal;
    return newCounts;
  };

  return (
    <div className="space-y-6">
      {/* Core Trip Details */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Core Trip Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="form-group">
            <label className="form-label">Trip Price ($)</label>
            <p className="text-xs text-ag-text-muted mb-1">Per person for entire trip</p>
            <input type="number" value={config.tripPrice} onChange={(e) => updateConfig({ tripPrice: Number(e.target.value) })} className="w-full" />
          </div>
          <div className="form-group">
            <label className="form-label">Trip Days</label>
            <input type="number" value={config.tripDays} onChange={(e) => updateConfig({ tripDays: Number(e.target.value) })} className="w-full" />
          </div>
          <div className="form-group">
            <label className="form-label">Trip Nights</label>
            <input type="number" value={config.tripNights} onChange={(e) => updateConfig({ tripNights: Number(e.target.value) })} className="w-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-ag-border">
          <div className="form-group">
            <label className="form-label">Min Pax</label>
            <input type="number" min="1" value={paxMin} onChange={(e) => updateConfig({ paxMin: Math.max(1, Number(e.target.value)) })} className="w-full" />
          </div>
          <div className="form-group">
            <label className="form-label">Max Pax</label>
            <input type="number" min="1" value={paxMax} onChange={(e) => updateConfig({ paxMax: Math.max(paxMin, Number(e.target.value)) })} className="w-full" />
          </div>
          <div className="form-group">
            <label className="form-label">Pax Step</label>
            <input type="number" min="1" value={paxStep} onChange={(e) => updateConfig({ paxStep: Math.max(1, Number(e.target.value)) })} className="w-full" />
          </div>
        </div>
      </div>

      {/* Discounts */}
      <div className={`card ${config.discountsEnabled === false ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Discounts</h2>
          <div className="flex gap-2">
            {config.discountsEnabled !== false && (
              <button onClick={() => setDiscountsPerPax(!discountsPerPax)} className={`btn text-xs ${discountsPerPax ? 'btn-primary' : 'btn-secondary'}`}>
                {discountsPerPax ? 'Per Pax Mode' : 'Simple Mode'}
              </button>
            )}
            <button onClick={() => updateConfig({ discountsEnabled: config.discountsEnabled === false })} className={`btn text-xs ${config.discountsEnabled === false ? 'btn-danger' : 'btn-primary'}`}>
              {config.discountsEnabled === false ? 'Inactive' : 'Active'}
            </button>
          </div>
        </div>
        {config.discountsEnabled === false ? (
          <p className="text-sm text-ag-text-muted">Section disabled — discounts will not be applied to calculations.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Early Bird Discount ($)</label>
                <p className="text-xs text-ag-text-muted mb-1">Amount discounted per early bird guest</p>
                <input type="number" value={config.earlyBirdDiscount} onChange={(e) => updateConfig({ earlyBirdDiscount: Number(e.target.value) })} className="w-full" />
              </div>
              <div className="form-group">
                <label className="form-label">Loyalty Discount Rate (%)</label>
                <p className="text-xs text-ag-text-muted mb-1">% discount on trip price per loyalty guest</p>
                <input type="number" step="0.01" value={config.loyaltyDiscountRate * 100} onChange={(e) => updateConfig({ loyaltyDiscountRate: Number(e.target.value) / 100 })} className="w-full" />
              </div>
            </div>
            {!discountsPerPax ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-ag-border">
                <div className="form-group">
                  <label className="form-label">Early Bird Count</label>
                  <p className="text-xs text-ag-text-muted mb-1">Same count applied to all group sizes</p>
                  <input type="number" min="0" value={config.earlyBirdCountByPax?.[paxCounts[0]] || 0} onChange={(e) => { updateConfig({ earlyBirdCountByPax: applyToAllPax(undefined, Number(e.target.value)) }); }} className="w-full" />
                </div>
                <div className="form-group">
                  <label className="form-label">Loyalty Count</label>
                  <p className="text-xs text-ag-text-muted mb-1">Same count applied to all group sizes</p>
                  <input type="number" min="0" value={config.loyaltyCountByPax?.[paxCounts[0]] || 0} onChange={(e) => { updateConfig({ loyaltyCountByPax: applyToAllPax(undefined, Number(e.target.value)) }); }} className="w-full" />
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4 pt-4 border-t border-ag-border">
                  <div className="flex items-center justify-between mb-2">
                    <label className="form-label mb-0">Early Bird Count by Pax</label>
                    <button onClick={() => updateConfig({ earlyBirdCountByPax: applyToAllPax(config.earlyBirdCountByPax, 0) })} className="btn btn-secondary text-xs">Apply First to All</button>
                  </div>
                  <p className="text-xs text-ag-text-muted mb-2">How many guests get the early bird discount at each group size</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                    {paxCounts.map((p) => (
                      <div key={p} className="form-group">
                        <label className="form-label text-center">{p} pax</label>
                        <input type="number" min="0" value={config.earlyBirdCountByPax?.[p] || 0} onChange={(e) => updateConfig({ earlyBirdCountByPax: { ...config.earlyBirdCountByPax, [p]: Number(e.target.value) } })} className="w-full text-center" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-ag-border">
                  <div className="flex items-center justify-between mb-2">
                    <label className="form-label mb-0">Loyalty Count by Pax</label>
                    <button onClick={() => updateConfig({ loyaltyCountByPax: applyToAllPax(config.loyaltyCountByPax, 0) })} className="btn btn-secondary text-xs">Apply First to All</button>
                  </div>
                  <p className="text-xs text-ag-text-muted mb-2">How many guests get the loyalty discount at each group size</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                    {paxCounts.map((p) => (
                      <div key={p} className="form-group">
                        <label className="form-label text-center">{p} pax</label>
                        <input type="number" min="0" value={config.loyaltyCountByPax?.[p] || 0} onChange={(e) => updateConfig({ loyaltyCountByPax: { ...config.loyaltyCountByPax, [p]: Number(e.target.value) } })} className="w-full text-center" />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Single Supplement */}
      <div className={`card ${config.singleSupplement.enabled === false ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Single Supplement</h2>
          <div className="flex gap-2">
            {config.singleSupplement.enabled !== false && (
              <button onClick={() => setSingleSuppPerPax(!singleSuppPerPax)} className={`btn text-xs ${singleSuppPerPax ? 'btn-primary' : 'btn-secondary'}`}>
                {singleSuppPerPax ? 'Per Pax Mode' : 'Simple Mode'}
              </button>
            )}
            <button onClick={() => updateNestedConfig('singleSupplement', { enabled: config.singleSupplement.enabled === false })} className={`btn text-xs ${config.singleSupplement.enabled === false ? 'btn-danger' : 'btn-primary'}`}>
              {config.singleSupplement.enabled === false ? 'Inactive' : 'Active'}
            </button>
          </div>
        </div>
        {config.singleSupplement.enabled === false ? (
          <p className="text-sm text-ag-text-muted">Section disabled — single supplement will not be applied to calculations.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Single Supplement Price ($)</label>
                <p className="text-xs text-ag-text-muted mb-1">Amount charged to guest</p>
                <input type="number" value={config.singleSupplement.singleSupplement} onChange={(e) => updateNestedConfig('singleSupplement', { singleSupplement: Number(e.target.value) })} className="w-full" />
              </div>
              <div className="form-group">
                <label className="form-label">Single Room Extra Cost ($)</label>
                <p className="text-xs text-ag-text-muted mb-1">Extra cost per night for single room</p>
                <input type="number" value={config.singleSupplement.singleRoomExtra} onChange={(e) => updateNestedConfig('singleSupplement', { singleRoomExtra: Number(e.target.value) })} className="w-full" />
              </div>
            </div>
            {!singleSuppPerPax ? (
              <div className="mt-4 pt-4 border-t border-ag-border">
                <div className="form-group w-48">
                  <label className="form-label">Number of Guests</label>
                  <p className="text-xs text-ag-text-muted mb-1">Same count applied to all group sizes</p>
                  <input type="number" min="0" value={config.singleSupplement.countByPax?.[paxCounts[0]] ?? 0} onChange={(e) => { const val = Number(e.target.value); const c: { [k: number]: number } = {}; for (const p of paxCounts) c[p] = val; updateNestedConfig('singleSupplement', { countByPax: c }); }} className="w-full" />
                </div>
              </div>
            ) : (
              <div className="mt-4 pt-4 border-t border-ag-border">
                <div className="flex items-center justify-between mb-2">
                  <label className="form-label mb-0">Single Supplement Guests by Pax</label>
                  <button onClick={() => { const c: { [k: number]: number } = {}; const b = config.singleSupplement.countByPax?.[paxCounts[0]] ?? 0; for (const p of paxCounts) c[p] = b; updateNestedConfig('singleSupplement', { countByPax: c }); }} className="btn btn-secondary text-xs">Apply First to All</button>
                </div>
                <p className="text-xs text-ag-text-muted mb-2">How many guests take the single supplement at each group size</p>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                  {paxCounts.map((p) => (
                    <div key={p} className="form-group">
                      <label className="form-label text-center">{p} pax</label>
                      <input type="number" min="0" value={config.singleSupplement.countByPax?.[p] ?? 0} onChange={(e) => updateNestedConfig('singleSupplement', { countByPax: { ...config.singleSupplement.countByPax, [p]: Number(e.target.value) } })} className="w-full text-center" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Hotels & Meals */}
      <div className={`card ${config.hotelsMeals.enabled === false ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Hotels & Meals</h2>
          <button onClick={() => updateNestedConfig('hotelsMeals', { enabled: config.hotelsMeals.enabled === false })} className={`btn text-xs ${config.hotelsMeals.enabled === false ? 'btn-danger' : 'btn-primary'}`}>
            {config.hotelsMeals.enabled === false ? 'Inactive' : 'Active'}
          </button>
        </div>
        {config.hotelsMeals.enabled === false ? (
          <p className="text-sm text-ag-text-muted">Section disabled — hotels & meals will not be applied to calculations.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="form-group">
              <label className="form-label">Hotel Cost ($)</label>
              <p className="text-xs text-ag-text-muted mb-1">Per pax, per night</p>
              <input type="number" value={config.hotelsMeals.hotelCostPerNight} onChange={(e) => updateNestedConfig('hotelsMeals', { hotelCostPerNight: Number(e.target.value) })} className="w-full" />
            </div>
            <div className="form-group">
              <label className="form-label">Lunch Cost ($)</label>
              <p className="text-xs text-ag-text-muted mb-1">Per pax, per day</p>
              <input type="number" value={config.hotelsMeals.lunchCostPerDay} onChange={(e) => updateNestedConfig('hotelsMeals', { lunchCostPerDay: Number(e.target.value) })} className="w-full" />
            </div>
            <div className="form-group">
              <label className="form-label">Dinner Cost ($)</label>
              <p className="text-xs text-ag-text-muted mb-1">Per pax, per night</p>
              <input type="number" value={config.hotelsMeals.dinnerCostPerNight} onChange={(e) => updateNestedConfig('hotelsMeals', { dinnerCostPerNight: Number(e.target.value) })} className="w-full" />
            </div>
            <div className="form-group">
              <label className="form-label">Additional Meal Costs ($)</label>
              <p className="text-xs text-ag-text-muted mb-1">Flat total for entire trip</p>
              <input type="number" value={config.hotelsMeals.additionalMealCosts} onChange={(e) => updateNestedConfig('hotelsMeals', { additionalMealCosts: Number(e.target.value) })} className="w-full" />
            </div>
          </div>
        )}
      </div>

      {/* Staff Configuration */}
      <div className={`card ${config.staffConfig.enabled === false ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Staff Configuration</h2>
          <div className="flex gap-2">
            {config.staffConfig.enabled !== false && (
              <button
                onClick={() => updateNestedConfig('staffConfig', { useCustomStaffDays: !config.staffConfig.useCustomStaffDays })}
                className={`btn text-xs ${config.staffConfig.useCustomStaffDays ? 'btn-primary' : 'btn-secondary'}`}
              >
                {config.staffConfig.useCustomStaffDays ? 'Custom Days' : 'Trip Days'}
              </button>
            )}
            <button onClick={() => updateNestedConfig('staffConfig', { enabled: config.staffConfig.enabled === false })} className={`btn text-xs ${config.staffConfig.enabled === false ? 'btn-danger' : 'btn-primary'}`}>
              {config.staffConfig.enabled === false ? 'Inactive' : 'Active'}
            </button>
          </div>
        </div>
        {config.staffConfig.enabled === false ? (
          <p className="text-sm text-ag-text-muted">Section disabled — staff costs will not be applied to calculations.</p>
        ) : (
          <>
            <div className="flex gap-2 mb-4 flex-wrap">
              {paxCounts.map((p) => (
                <button key={p} onClick={() => setSelectedStaffPax(p)} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${selectedStaffPax === p ? 'bg-ag-accent text-white' : 'bg-ag-card-lighter text-ag-text-muted hover:text-ag-text'}`}>
                  {p} pax
                </button>
              ))}
            </div>
            <div className="space-y-4">
              {currentStaff.map((staff, index) => (
                <div key={index} className="flex items-end gap-4 pb-4 border-b border-ag-border last:border-0">
                  <div className="form-group flex-1">
                    <label className="form-label">Role</label>
                    <input type="text" value={staff.role} onChange={(e) => updateStaffMember(index, { role: e.target.value })} className="w-full" />
                  </div>
                  <div className="form-group w-32">
                    <label className="form-label">Daily Rate ($)</label>
                    <p className="text-xs text-ag-text-muted mb-1">Per staff, per day</p>
                    <input type="number" value={staff.dailyRate} onChange={(e) => updateStaffMember(index, { dailyRate: Number(e.target.value) })} className="w-full" />
                  </div>
                  <div className="form-group w-24">
                    <label className="form-label">Days</label>
                    <input
                      type="number"
                      value={config.staffConfig.useCustomStaffDays ? staff.days : config.tripDays}
                      onChange={(e) => updateStaffMember(index, { days: Number(e.target.value) })}
                      disabled={!config.staffConfig.useCustomStaffDays}
                      className={`w-full ${!config.staffConfig.useCustomStaffDays ? 'opacity-60' : ''}`}
                    />
                  </div>
                  <div className="form-group w-24">
                    <label className="form-label">Quantity</label>
                    <input type="number" value={staff.quantity} onChange={(e) => updateStaffMember(index, { quantity: Number(e.target.value) })} className="w-full" />
                  </div>
                  <button onClick={() => removeStaffMember(index)} className="btn btn-danger mb-4" disabled={currentStaff.length <= 1}>Remove</button>
                </div>
              ))}
              <div className="flex gap-2">
                <button onClick={addStaffMember} className="btn btn-secondary">+ Add Staff Member</button>
                <button onClick={copyStaffToAll} className="btn btn-secondary">Copy to All Pax</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-ag-border">
              <div className="form-group">
                <label className="form-label">Travel Days</label>
                <p className="text-xs text-ag-text-muted mb-1">Extra travel days — applied to all staff</p>
                <input type="number" value={config.staffConfig.travelDays} onChange={(e) => updateNestedConfig('staffConfig', { travelDays: Number(e.target.value) })} className="w-full" />
              </div>
              <div className="form-group">
                <label className="form-label">Travel Day Rate ($)</label>
                <p className="text-xs text-ag-text-muted mb-1">Per staff member, per travel day</p>
                <input type="number" value={config.staffConfig.travelDayRate} onChange={(e) => updateNestedConfig('staffConfig', { travelDayRate: Number(e.target.value) })} className="w-full" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Transport */}
      <div className={`card ${config.transportConfig.enabled === false ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Transport</h2>
          <div className="flex gap-2">
            {config.transportConfig.enabled !== false && (
              <button onClick={() => setTransportPerPax(!transportPerPax)} className={`btn text-xs ${transportPerPax ? 'btn-primary' : 'btn-secondary'}`}>
                {transportPerPax ? 'Per Pax Mode' : 'Simple Mode'}
              </button>
            )}
            <button onClick={() => updateNestedConfig('transportConfig', { enabled: config.transportConfig.enabled === false })} className={`btn text-xs ${config.transportConfig.enabled === false ? 'btn-danger' : 'btn-primary'}`}>
              {config.transportConfig.enabled === false ? 'Inactive' : 'Active'}
            </button>
          </div>
        </div>
        {config.transportConfig.enabled === false ? (
          <p className="text-sm text-ag-text-muted">Section disabled — transport costs will not be applied to calculations.</p>
        ) : (
          <>
            {!transportPerPax ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="form-group">
                  <label className="form-label">Guide Flights ($)</label>
                  <p className="text-xs text-ag-text-muted mb-1">Per guide for entire trip</p>
                  <input type="number" value={config.transportConfig.flightCostPerPerson} onChange={(e) => updateNestedConfig('transportConfig', { flightCostPerPerson: Number(e.target.value) })} className="w-full" />
                </div>
                <div className="form-group">
                  <label className="form-label">Ground Transport ($)</label>
                  <p className="text-xs text-ag-text-muted mb-1">Flat total for entire trip</p>
                  <input type="number" value={config.transportConfig.groundTransportTotal} onChange={(e) => updateNestedConfig('transportConfig', { groundTransportTotal: Number(e.target.value) })} className="w-full" />
                </div>
                <div className="form-group">
                  <label className="form-label">Airport Transfers ($)</label>
                  <p className="text-xs text-ag-text-muted mb-1">Flat total for entire trip</p>
                  <input type="number" value={config.transportConfig.airportTransfers} onChange={(e) => updateNestedConfig('transportConfig', { airportTransfers: Number(e.target.value) })} className="w-full" />
                </div>
                <div className="form-group">
                  <label className="form-label">Local Transport ($)</label>
                  <p className="text-xs text-ag-text-muted mb-1">Flat total for entire trip</p>
                  <input type="number" value={config.transportConfig.localTransport} onChange={(e) => updateNestedConfig('transportConfig', { localTransport: Number(e.target.value) })} className="w-full" />
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="form-label mb-0">Guide Flights by Pax ($)</label>
                    <button onClick={() => { const base = config.transportConfig.flightCostByPax?.[paxCounts[0]] ?? config.transportConfig.flightCostPerPerson; const c: { [k: number]: number } = {}; for (const p of paxCounts) c[p] = base; updateNestedConfig('transportConfig', { flightCostByPax: c }); }} className="btn btn-secondary text-xs">Apply First to All</button>
                  </div>
                  <p className="text-xs text-ag-text-muted mb-2">Per guide for entire trip — set different costs per group size</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                    {paxCounts.map((p) => (
                      <div key={p} className="form-group">
                        <label className="form-label text-center">{p} pax</label>
                        <input type="number" value={config.transportConfig.flightCostByPax?.[p] ?? config.transportConfig.flightCostPerPerson} onChange={(e) => updateNestedConfig('transportConfig', { flightCostByPax: { ...config.transportConfig.flightCostByPax, [p]: Number(e.target.value) } })} className="w-full text-center" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-ag-border">
                  <div className="form-group">
                    <label className="form-label">Ground Transport ($)</label>
                    <p className="text-xs text-ag-text-muted mb-1">Flat total for entire trip</p>
                    <input type="number" value={config.transportConfig.groundTransportTotal} onChange={(e) => updateNestedConfig('transportConfig', { groundTransportTotal: Number(e.target.value) })} className="w-full" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Airport Transfers ($)</label>
                    <p className="text-xs text-ag-text-muted mb-1">Flat total for entire trip</p>
                    <input type="number" value={config.transportConfig.airportTransfers} onChange={(e) => updateNestedConfig('transportConfig', { airportTransfers: Number(e.target.value) })} className="w-full" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Local Transport ($)</label>
                    <p className="text-xs text-ag-text-muted mb-1">Flat total for entire trip</p>
                    <input type="number" value={config.transportConfig.localTransport} onChange={(e) => updateNestedConfig('transportConfig', { localTransport: Number(e.target.value) })} className="w-full" />
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Trip-Specific Costs */}
      <div className={`card ${config.tripSpecific.enabled === false ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Trip-Specific Costs</h2>
          <button onClick={() => updateNestedConfig('tripSpecific', { enabled: config.tripSpecific.enabled === false })} className={`btn text-xs ${config.tripSpecific.enabled === false ? 'btn-danger' : 'btn-primary'}`}>
            {config.tripSpecific.enabled === false ? 'Inactive' : 'Active'}
          </button>
        </div>
        {config.tripSpecific.enabled === false ? (
          <p className="text-sm text-ag-text-muted">Section disabled — trip-specific costs will not be applied to calculations.</p>
        ) : (
          <>
            <p className="text-sm text-ag-text-muted mb-4">
              Check &quot;Per Pax&quot; to multiply the cost by the number of participants
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {TRIP_SPECIFIC_FIELDS.map(({ key, label }) => (
                <div key={key} className="form-group">
                  <label className="form-label">{label} ($)</label>
                  <div className="flex gap-3 items-center">
                    <input type="number" value={config.tripSpecific[key].amount} onChange={(e) => updateTripSpecificCost(key, { amount: Number(e.target.value) })} className="flex-1 min-w-0" />
                    <label className="flex items-center gap-1.5 cursor-pointer text-sm whitespace-nowrap shrink-0">
                      <input type="checkbox" checked={config.tripSpecific[key].perPax} onChange={(e) => updateTripSpecificCost(key, { perPax: e.target.checked })} className="w-4 h-4 accent-ag-accent" />
                      <span>Per Pax</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Logistics Rates */}
      <div className={`card ${config.logistics.enabled === false ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Logistics Rates</h2>
          <button onClick={() => updateNestedConfig('logistics', { enabled: config.logistics.enabled === false })} className={`btn text-xs ${config.logistics.enabled === false ? 'btn-danger' : 'btn-primary'}`}>
            {config.logistics.enabled === false ? 'Inactive' : 'Active'}
          </button>
        </div>
        {config.logistics.enabled === false ? (
          <p className="text-sm text-ag-text-muted">Section disabled — logistics costs will not be applied to calculations.</p>
        ) : (
          <>
            <div className="mb-4">
              <div className="flex gap-2 items-center">
                {(['perPaxPerDay', 'perDay', 'total'] as const).map((m) => {
                  const logisticsMode = config.logistics.mode || (config.logistics.perPax ? 'perPaxPerDay' : 'perDay');
                  const labels = { perPaxPerDay: 'Rate × Pax × Days', perDay: 'Rate × Days', total: 'Total Cost' };
                  return (
                    <button
                      key={m}
                      onClick={() => updateNestedConfig('logistics', { mode: m, perPax: m === 'perPaxPerDay' })}
                      className={`btn text-xs ${logisticsMode === m ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {labels[m]}
                    </button>
                  );
                })}
                <span className="text-xs text-ag-text-muted ml-2">
                  {(() => {
                    const mode = config.logistics.mode || (config.logistics.perPax ? 'perPaxPerDay' : 'perDay');
                    if (mode === 'perPaxPerDay') return '(rate × pax × trip days)';
                    if (mode === 'total') return '(entered value is total cost)';
                    return '(rate × trip days)';
                  })()}
                </span>
              </div>
            </div>
            <p className="text-xs text-ag-text-muted mb-3">Rate per pax level — use mode buttons above to control how it&apos;s applied</p>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {paxCounts.map((p) => {
                const existing = config.logistics.rates.find(r => r.pax === p);
                const rateValue = existing ? existing.rate : 0;
                return (
                  <div key={p} className="form-group">
                    <label className="form-label text-center">{p} pax</label>
                    <input type="number" value={rateValue} onChange={(e) => { const newRates = config.logistics.rates.filter(r => r.pax !== p); newRates.push({ pax: p, rate: Number(e.target.value) }); updateNestedConfig('logistics', { rates: newRates }); }} className="w-full text-center" />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
