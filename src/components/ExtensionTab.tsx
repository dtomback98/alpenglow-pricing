'use client';

import { useState, useEffect } from 'react';
import { TripConfiguration, StaffMember } from '@/lib/types';

interface ExtensionTabProps {
  config: TripConfiguration;
  updateConfig: (updates: Partial<TripConfiguration>) => void;
}

export default function ExtensionTab({ config, updateConfig }: ExtensionTabProps) {
  const ext = config.extension;

  const updateExtension = (updates: Partial<TripConfiguration['extension']>) => {
    updateConfig({ extension: { ...ext, ...updates } });
  };

  const updateExtSingleSupplement = (updates: Partial<TripConfiguration['extension']['singleSupplement']>) => {
    updateConfig({ extension: { ...ext, singleSupplement: { ...ext.singleSupplement, ...updates } } });
  };

  const updateExtHotelsMeals = (updates: Partial<TripConfiguration['extension']['hotelsMeals']>) => {
    updateConfig({ extension: { ...ext, hotelsMeals: { ...ext.hotelsMeals, ...updates } } });
  };

  const updateExtStaff = (updates: Partial<TripConfiguration['extension']['staffConfig']>) => {
    updateConfig({ extension: { ...ext, staffConfig: { ...ext.staffConfig, ...updates } } });
  };

  const paxMin = config.paxMin || 1;
  const paxMax = config.paxMax || 16;
  const paxStep = Math.max(1, Math.round(config.paxStep || 1));

  const paxCounts: number[] = [];
  for (let p = paxMin; p <= paxMax; p += paxStep) {
    paxCounts.push(p);
  }

  const extPerPax = config.uiPreferences?.extPerPax ?? false;
  const extSuppPerPax = config.uiPreferences?.extSuppPerPax ?? false;
  const setExtPerPax = (val: boolean) => updateConfig({ uiPreferences: { ...config.uiPreferences, extPerPax: val } });
  const setExtSuppPerPax = (val: boolean) => updateConfig({ uiPreferences: { ...config.uiPreferences, extSuppPerPax: val } });
  const [selectedStaffPax, setSelectedStaffPax] = useState(paxMin);
  useEffect(() => { setSelectedStaffPax(paxMin); }, [paxMin]);

  const effectiveStaffPax = paxCounts.includes(selectedStaffPax) ? selectedStaffPax : paxCounts[0] || 1;

  // Get staff for extension (inherit or custom)
  const getExtStaff = (): StaffMember[] => {
    if (ext.staffConfig.inheritFromMain) {
      const mainStaff = config.staffConfig.staffByPax[effectiveStaffPax] || [];
      return mainStaff.map(s => ({ ...s, days: ext.extensionNights }));
    }
    return ext.staffConfig.staffByPax[effectiveStaffPax] || [
      { role: 'Lead Guide', dailyRate: 400, days: ext.extensionNights, quantity: 1 },
    ];
  };

  const currentExtStaff = getExtStaff();

  const updateExtStaffMember = (index: number, updates: Partial<StaffMember>) => {
    const newStaff = [...currentExtStaff];
    newStaff[index] = { ...newStaff[index], ...updates };
    updateExtStaff({
      staffByPax: { ...ext.staffConfig.staffByPax, [effectiveStaffPax]: newStaff },
    });
  };

  const addExtStaffMember = () => {
    const current = ext.staffConfig.staffByPax[effectiveStaffPax] || [];
    const newStaff = [
      ...current,
      { role: 'New Role', dailyRate: 200, days: ext.extensionNights, quantity: 1 },
    ];
    updateExtStaff({
      staffByPax: { ...ext.staffConfig.staffByPax, [effectiveStaffPax]: newStaff },
    });
  };

  const removeExtStaffMember = (index: number) => {
    const current = ext.staffConfig.staffByPax[effectiveStaffPax] || [];
    const newStaff = current.filter((_, i) => i !== index);
    updateExtStaff({
      staffByPax: { ...ext.staffConfig.staffByPax, [effectiveStaffPax]: newStaff },
    });
  };

  const copyExtStaffToAll = () => {
    const current = ext.staffConfig.staffByPax[effectiveStaffPax] || [];
    const newStaffByPax: { [pax: number]: StaffMember[] } = {};
    for (const p of paxCounts) {
      newStaffByPax[p] = current.map(s => ({ ...s }));
    }
    updateExtStaff({ staffByPax: newStaffByPax });
  };

  // Resolve values for display (inherit vs custom)
  const resolvedSingleSuppPrice = ext.singleSupplement.inheritFromMain
    ? config.singleSupplement.singleSupplement
    : ext.singleSupplement.singleSupplement;
  const resolvedSingleRoomExtra = ext.singleSupplement.inheritFromMain
    ? config.singleSupplement.singleRoomExtra
    : ext.singleSupplement.singleRoomExtra;

  const resolvedHotelRate = ext.hotelsMeals.inheritFromMain
    ? config.hotelsMeals.hotelCostPerNight
    : ext.hotelsMeals.hotelCostPerNight;
  const resolvedLunchRate = ext.hotelsMeals.inheritFromMain
    ? config.hotelsMeals.lunchCostPerDay
    : ext.hotelsMeals.lunchCostPerDay;
  const resolvedDinnerRate = ext.hotelsMeals.inheritFromMain
    ? config.hotelsMeals.dinnerCostPerNight
    : ext.hotelsMeals.dinnerCostPerNight;
  const resolvedAdditionalMeals = ext.hotelsMeals.inheritFromMain
    ? config.hotelsMeals.additionalMealCosts
    : ext.hotelsMeals.additionalMealCosts;

  return (
    <div className="space-y-6">
      {/* Core Extension Details */}
      <div className={`card ${!ext.enabled ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Extension - Core Trip Details</h2>
          <div className="flex gap-2">
            {ext.enabled && (
              <button onClick={() => setExtPerPax(!extPerPax)} className={`btn text-xs ${extPerPax ? 'btn-primary' : 'btn-secondary'}`}>
                {extPerPax ? 'Per Pax Mode' : 'Simple Mode'}
              </button>
            )}
            <button onClick={() => updateExtension({ enabled: !ext.enabled })} className={`btn text-xs ${!ext.enabled ? 'btn-danger' : 'btn-primary'}`}>
              {!ext.enabled ? 'Inactive' : 'Active'}
            </button>
          </div>
        </div>
        {!ext.enabled ? (
          <p className="text-sm text-ag-text-muted">Extension is disabled — all extension revenue and costs are excluded from calculations.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Extension Price / Person ($)</label>
                <p className="text-xs text-ag-text-muted mb-1">Amount charged per guest for the extension</p>
                <input type="number" value={ext.extensionPrice} onChange={(e) => updateExtension({ extensionPrice: Number(e.target.value) })} className="w-full" />
              </div>
              <div className="form-group">
                <label className="form-label">Extension Nights</label>
                <p className="text-xs text-ag-text-muted mb-1">Number of nights for the extension</p>
                <input type="number" min="1" value={ext.extensionNights} onChange={(e) => updateExtension({ extensionNights: Number(e.target.value) })} className="w-full" />
              </div>
            </div>
            {!extPerPax ? (
              <div className="mt-4 pt-4 border-t border-ag-border">
                <div className="form-group w-48">
                  <label className="form-label">Guest Count</label>
                  <p className="text-xs text-ag-text-muted mb-1">Same count applied to all group sizes</p>
                  <input type="number" min="0" value={ext.countByPax?.[paxCounts[0]] ?? 0} onChange={(e) => { const val = Number(e.target.value); const c: { [k: number]: number } = {}; for (const p of paxCounts) c[p] = val; updateExtension({ countByPax: c }); }} className="w-full" />
                </div>
              </div>
            ) : (
              <div className="mt-4 pt-4 border-t border-ag-border">
                <div className="flex items-center justify-between mb-2">
                  <label className="form-label mb-0">Guests Taking Extension by Pax</label>
                  <button onClick={() => { const c: { [k: number]: number } = {}; const b = ext.countByPax?.[paxCounts[0]] || 0; for (const p of paxCounts) c[p] = b; updateExtension({ countByPax: c }); }} className="btn btn-secondary text-xs">Apply First to All</button>
                </div>
                <p className="text-xs text-ag-text-muted mb-2">How many guests join the extension at each group size</p>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                  {paxCounts.map((p) => (
                    <div key={p} className="form-group">
                      <label className="form-label text-center">{p} pax</label>
                      <input type="number" min="0" value={ext.countByPax?.[p] ?? 0} onChange={(e) => updateExtension({ countByPax: { ...ext.countByPax, [p]: Number(e.target.value) } })} className="w-full text-center" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Extension Single Supplement */}
      {ext.enabled && (
        <div className={`card ${ext.singleSupplement.enabled === false ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Extension - Single Supplement</h2>
            <div className="flex gap-2">
              {ext.singleSupplement.enabled !== false && (
                <>
                  <button onClick={() => updateExtSingleSupplement({ inheritFromMain: !ext.singleSupplement.inheritFromMain })} className={`btn text-xs ${ext.singleSupplement.inheritFromMain ? 'btn-secondary' : 'btn-primary'}`}>
                    {ext.singleSupplement.inheritFromMain ? 'Match Core Inputs' : 'Custom'}
                  </button>
                  {!ext.singleSupplement.inheritFromMain && (
                    <button onClick={() => setExtSuppPerPax(!extSuppPerPax)} className={`btn text-xs ${extSuppPerPax ? 'btn-primary' : 'btn-secondary'}`}>
                      {extSuppPerPax ? 'Per Pax Mode' : 'Simple Mode'}
                    </button>
                  )}
                </>
              )}
              <button onClick={() => updateExtSingleSupplement({ enabled: ext.singleSupplement.enabled === false })} className={`btn text-xs ${ext.singleSupplement.enabled === false ? 'btn-danger' : 'btn-primary'}`}>
                {ext.singleSupplement.enabled === false ? 'Inactive' : 'Active'}
              </button>
            </div>
          </div>
          {ext.singleSupplement.enabled === false ? (
            <p className="text-sm text-ag-text-muted">Section disabled — extension single supplement will not be applied.</p>
          ) : ext.singleSupplement.inheritFromMain ? (
            <div>
              <p className="text-sm text-ag-text-muted mb-3">Rates from main trip. Set guest count for extension below.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Single Supplement Price ($)</label>
                  <input type="number" value={resolvedSingleSuppPrice} disabled className="w-full opacity-50 cursor-not-allowed" />
                </div>
                <div className="form-group">
                  <label className="form-label">Single Room Extra Cost ($)</label>
                  <input type="number" value={resolvedSingleRoomExtra} disabled className="w-full opacity-50 cursor-not-allowed" />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-ag-border">
                <div className="form-group w-48">
                  <label className="form-label">Number of Extension Guests</label>
                  <p className="text-xs text-ag-text-muted mb-1">How many extension guests take single supplement</p>
                  <input type="number" min="0" value={ext.singleSupplement.countByPax?.[paxCounts[0]] ?? 0} onChange={(e) => { const val = Number(e.target.value); const c: { [k: number]: number } = {}; for (const p of paxCounts) c[p] = val; updateExtSingleSupplement({ countByPax: c }); }} className="w-full" />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Single Supplement Price ($)</label>
                  <input type="number" value={ext.singleSupplement.singleSupplement} onChange={(e) => updateExtSingleSupplement({ singleSupplement: Number(e.target.value) })} className="w-full" />
                </div>
                <div className="form-group">
                  <label className="form-label">Single Room Extra Cost ($)</label>
                  <input type="number" value={ext.singleSupplement.singleRoomExtra} onChange={(e) => updateExtSingleSupplement({ singleRoomExtra: Number(e.target.value) })} className="w-full" />
                </div>
              </div>
              {!extSuppPerPax ? (
                <div className="mt-4 pt-4 border-t border-ag-border">
                  <div className="form-group w-48">
                    <label className="form-label">Number of Guests</label>
                    <p className="text-xs text-ag-text-muted mb-1">Same count applied to all group sizes</p>
                    <input type="number" min="0" value={ext.singleSupplement.countByPax?.[paxCounts[0]] ?? 0} onChange={(e) => { const val = Number(e.target.value); const c: { [k: number]: number } = {}; for (const p of paxCounts) c[p] = val; updateExtSingleSupplement({ countByPax: c }); }} className="w-full" />
                  </div>
                </div>
              ) : (
                <div className="mt-4 pt-4 border-t border-ag-border">
                  <div className="flex items-center justify-between mb-2">
                    <label className="form-label mb-0">Single Supplement Guests by Pax</label>
                    <button onClick={() => { const c: { [k: number]: number } = {}; const b = ext.singleSupplement.countByPax?.[paxCounts[0]] ?? 0; for (const p of paxCounts) c[p] = b; updateExtSingleSupplement({ countByPax: c }); }} className="btn btn-secondary text-xs">Apply First to All</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                    {paxCounts.map((p) => (
                      <div key={p} className="form-group">
                        <label className="form-label text-center">{p} pax</label>
                        <input type="number" min="0" value={ext.singleSupplement.countByPax?.[p] ?? 0} onChange={(e) => updateExtSingleSupplement({ countByPax: { ...ext.singleSupplement.countByPax, [p]: Number(e.target.value) } })} className="w-full text-center" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Extension Hotels & Meals */}
      {ext.enabled && (
        <div className={`card ${ext.hotelsMeals.enabled === false ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Extension - Hotels & Meals</h2>
            <div className="flex gap-2">
              {ext.hotelsMeals.enabled !== false && (
                <button onClick={() => updateExtHotelsMeals({ inheritFromMain: !ext.hotelsMeals.inheritFromMain })} className={`btn text-xs ${ext.hotelsMeals.inheritFromMain ? 'btn-secondary' : 'btn-primary'}`}>
                  {ext.hotelsMeals.inheritFromMain ? 'Match Core Inputs' : 'Custom'}
                </button>
              )}
              <button onClick={() => updateExtHotelsMeals({ enabled: ext.hotelsMeals.enabled === false })} className={`btn text-xs ${ext.hotelsMeals.enabled === false ? 'btn-danger' : 'btn-primary'}`}>
                {ext.hotelsMeals.enabled === false ? 'Inactive' : 'Active'}
              </button>
            </div>
          </div>
          {ext.hotelsMeals.enabled === false ? (
            <p className="text-sm text-ag-text-muted">Section disabled — extension hotels & meals will not be applied.</p>
          ) : ext.hotelsMeals.inheritFromMain ? (
            <div>
              <p className="text-sm text-ag-text-muted mb-3">Using values from main trip hotels & meals.</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="form-group">
                  <label className="form-label">Hotel Cost/Night ($)</label>
                  <input type="number" value={resolvedHotelRate} disabled className="w-full opacity-50 cursor-not-allowed" />
                </div>
                <div className="form-group">
                  <label className="form-label">Lunch Cost/Day ($)</label>
                  <input type="number" value={resolvedLunchRate} disabled className="w-full opacity-50 cursor-not-allowed" />
                </div>
                <div className="form-group">
                  <label className="form-label">Dinner Cost/Night ($)</label>
                  <input type="number" value={resolvedDinnerRate} disabled className="w-full opacity-50 cursor-not-allowed" />
                </div>
                <div className="form-group">
                  <label className="form-label">Additional Meal Costs ($)</label>
                  <input type="number" value={resolvedAdditionalMeals} disabled className="w-full opacity-50 cursor-not-allowed" />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="form-group">
                <label className="form-label">Hotel Cost/Night ($)</label>
                <input type="number" value={ext.hotelsMeals.hotelCostPerNight} onChange={(e) => updateExtHotelsMeals({ hotelCostPerNight: Number(e.target.value) })} className="w-full" />
              </div>
              <div className="form-group">
                <label className="form-label">Lunch Cost/Day ($)</label>
                <input type="number" value={ext.hotelsMeals.lunchCostPerDay} onChange={(e) => updateExtHotelsMeals({ lunchCostPerDay: Number(e.target.value) })} className="w-full" />
              </div>
              <div className="form-group">
                <label className="form-label">Dinner Cost/Night ($)</label>
                <input type="number" value={ext.hotelsMeals.dinnerCostPerNight} onChange={(e) => updateExtHotelsMeals({ dinnerCostPerNight: Number(e.target.value) })} className="w-full" />
              </div>
              <div className="form-group">
                <label className="form-label">Additional Meal Costs ($)</label>
                <input type="number" value={ext.hotelsMeals.additionalMealCosts} onChange={(e) => updateExtHotelsMeals({ additionalMealCosts: Number(e.target.value) })} className="w-full" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Extension Staff */}
      {ext.enabled && (
        <div className={`card ${ext.staffConfig.enabled === false ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Extension - Staff Configuration</h2>
            <div className="flex gap-2">
              {ext.staffConfig.enabled !== false && (
                <button onClick={() => updateExtStaff({ inheritFromMain: !ext.staffConfig.inheritFromMain })} className={`btn text-xs ${ext.staffConfig.inheritFromMain ? 'btn-secondary' : 'btn-primary'}`}>
                  {ext.staffConfig.inheritFromMain ? 'Match Core Inputs' : 'Custom'}
                </button>
              )}
              <button onClick={() => updateExtStaff({ enabled: ext.staffConfig.enabled === false })} className={`btn text-xs ${ext.staffConfig.enabled === false ? 'btn-danger' : 'btn-primary'}`}>
                {ext.staffConfig.enabled === false ? 'Inactive' : 'Active'}
              </button>
            </div>
          </div>
          {ext.staffConfig.enabled === false ? (
            <p className="text-sm text-ag-text-muted">Section disabled — extension staff costs will not be applied.</p>
          ) : ext.staffConfig.inheritFromMain ? (
            <div>
              <p className="text-sm text-ag-text-muted mb-3">Using staff from main trip (scaled to {ext.extensionNights} extension night{ext.extensionNights !== 1 ? 's' : ''}).</p>
              <div className="flex gap-2 mb-4 flex-wrap">
                {paxCounts.map((p) => (
                  <button key={p} onClick={() => setSelectedStaffPax(p)} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${selectedStaffPax === p ? 'bg-ag-accent text-white' : 'bg-ag-card-lighter text-ag-text-muted hover:text-ag-text'}`}>
                    {p} pax
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {currentExtStaff.map((staff, index) => (
                  <div key={index} className="flex items-end gap-4 pb-3 border-b border-ag-border last:border-0">
                    <div className="form-group flex-1">
                      <label className="form-label">Role</label>
                      <input type="text" value={staff.role} disabled className="w-full opacity-50 cursor-not-allowed" />
                    </div>
                    <div className="form-group w-32">
                      <label className="form-label">Daily Rate ($)</label>
                      <input type="number" value={staff.dailyRate} disabled className="w-full opacity-50 cursor-not-allowed" />
                    </div>
                    <div className="form-group w-24">
                      <label className="form-label">Days</label>
                      <input type="number" value={staff.days} disabled className="w-full opacity-50 cursor-not-allowed" />
                    </div>
                    <div className="form-group w-24">
                      <label className="form-label">Quantity</label>
                      <input type="number" value={staff.quantity} disabled className="w-full opacity-50 cursor-not-allowed" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-ag-border">
                <div className="form-group">
                  <label className="form-label">Travel Days</label>
                  <input type="number" value={ext.staffConfig.travelDays} onChange={(e) => updateExtStaff({ travelDays: Number(e.target.value) })} className="w-full" />
                </div>
                <div className="form-group">
                  <label className="form-label">Travel Day Rate ($)</label>
                  <input type="number" value={config.staffConfig.travelDayRate} disabled className="w-full opacity-50 cursor-not-allowed" />
                </div>
              </div>
            </div>
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
                {currentExtStaff.map((staff, index) => (
                  <div key={index} className="flex items-end gap-4 pb-4 border-b border-ag-border last:border-0">
                    <div className="form-group flex-1">
                      <label className="form-label">Role</label>
                      <input type="text" value={staff.role} onChange={(e) => updateExtStaffMember(index, { role: e.target.value })} className="w-full" />
                    </div>
                    <div className="form-group w-32">
                      <label className="form-label">Daily Rate ($)</label>
                      <input type="number" value={staff.dailyRate} onChange={(e) => updateExtStaffMember(index, { dailyRate: Number(e.target.value) })} className="w-full" />
                    </div>
                    <div className="form-group w-24">
                      <label className="form-label">Days</label>
                      <input type="number" value={staff.days} onChange={(e) => updateExtStaffMember(index, { days: Number(e.target.value) })} className="w-full" />
                    </div>
                    <div className="form-group w-24">
                      <label className="form-label">Quantity</label>
                      <input type="number" value={staff.quantity} onChange={(e) => updateExtStaffMember(index, { quantity: Number(e.target.value) })} className="w-full" />
                    </div>
                    <button onClick={() => removeExtStaffMember(index)} className="btn btn-danger mb-4" disabled={currentExtStaff.length <= 1}>Remove</button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <button onClick={addExtStaffMember} className="btn btn-secondary">+ Add Staff Member</button>
                  <button onClick={copyExtStaffToAll} className="btn btn-secondary">Copy to All Pax</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-ag-border">
                <div className="form-group">
                  <label className="form-label">Travel Days</label>
                  <input type="number" value={ext.staffConfig.travelDays} onChange={(e) => updateExtStaff({ travelDays: Number(e.target.value) })} className="w-full" />
                </div>
                <div className="form-group">
                  <label className="form-label">Travel Day Rate ($)</label>
                  <input type="number" value={ext.staffConfig.travelDayRate} onChange={(e) => updateExtStaff({ travelDayRate: Number(e.target.value) })} className="w-full" />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
