'use client';

import React, { useState, useEffect } from 'react';
import { TripConfiguration, StaffMember } from '@/lib/types';

interface ExtensionTabProps {
  config: TripConfiguration;
  updateConfig: (updates: Partial<TripConfiguration> | ((prev: TripConfiguration) => Partial<TripConfiguration>)) => void;
}

// Shows empty string instead of "0" so users don't get a leading zero when they clear and retype a value
const NumInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} type="number" value={(props.value as number) || ''} />
);

export default function ExtensionTab({ config, updateConfig }: ExtensionTabProps) {
  const ext = config.extension;

  const updateExtension = (updates: Partial<TripConfiguration['extension']>) => {
    updateConfig(prev => ({ extension: { ...prev.extension, ...updates } }));
  };

  const updateExtSingleSupplement = (updates: Partial<TripConfiguration['extension']['singleSupplement']>) => {
    updateConfig(prev => ({ extension: { ...prev.extension, singleSupplement: { ...prev.extension.singleSupplement, ...updates } } }));
  };

  const updateExtHotelsMeals = (updates: Partial<TripConfiguration['extension']['hotelsMeals']>) => {
    updateConfig(prev => ({ extension: { ...prev.extension, hotelsMeals: { ...prev.extension.hotelsMeals, ...updates } } }));
  };

  const updateExtStaff = (updates: Partial<TripConfiguration['extension']['staffConfig']>) => {
    updateConfig(prev => ({ extension: { ...prev.extension, staffConfig: { ...prev.extension.staffConfig, ...updates } } }));
  };

  const paxMin = config.paxMin || 1;
  const paxMax = config.paxMax || 16;
  const paxStep = Math.max(1, Math.round(config.paxStep || 1));

  const paxCounts: number[] = [];
  for (let p = paxMin; p <= paxMax; p += paxStep) {
    paxCounts.push(p);
  }

  const updateExtDiscounts = (updates: Partial<TripConfiguration['extension']['discounts']>) => {
    updateConfig(prev => ({ extension: { ...prev.extension, discounts: { ...prev.extension.discounts, ...updates } } }));
  };

  const updateExtLogistics = (updates: Partial<TripConfiguration['extension']['logisticsConfig']>) => {
    updateConfig(prev => ({ extension: { ...prev.extension, logisticsConfig: { ...prev.extension.logisticsConfig, ...updates } } }));
  };

  const extPerPax = config.uiPreferences?.extPerPax ?? false;
  const extSuppPerPax = config.uiPreferences?.extSuppPerPax ?? false;
  const extDiscountsPerPax = config.uiPreferences?.extDiscountsPerPax ?? false;
  const extHotelsMealsPerPax = config.uiPreferences?.extHotelsMealsPerPax ?? false;
  const setExtPerPax = (val: boolean) => updateConfig(prev => ({ uiPreferences: { ...prev.uiPreferences, extPerPax: val } }));
  const setExtSuppPerPax = (val: boolean) => updateConfig(prev => ({ uiPreferences: { ...prev.uiPreferences, extSuppPerPax: val } }));
  const setExtDiscountsPerPax = (val: boolean) => updateConfig(prev => ({ uiPreferences: { ...prev.uiPreferences, extDiscountsPerPax: val } }));

  const [selectedExtHMPax, setSelectedExtHMPax] = useState(paxMin);
  useEffect(() => { setSelectedExtHMPax(paxMin); }, [paxMin]);
  const effectiveExtHMPax = paxCounts.includes(selectedExtHMPax) ? selectedExtHMPax : paxCounts[0] || 1;

  const toggleExtHotelsMealsPerPax = (val: boolean) => {
    if (val) {
      updateConfig(prev => {
        const hm = prev.extension.hotelsMeals;
        const needsInit = !hm.hotelCostByPax || Object.keys(hm.hotelCostByPax).length === 0;
        if (!needsInit) return { uiPreferences: { ...prev.uiPreferences, extHotelsMealsPerPax: true } };
        const hotelByPax: { [k: number]: number } = {};
        const lunchByPax: { [k: number]: number } = {};
        const dinnerByPax: { [k: number]: number } = {};
        const additionalByPax: { [k: number]: number } = {};
        for (const p of paxCounts) {
          hotelByPax[p] = hm.hotelCostPerNight;
          lunchByPax[p] = hm.lunchCostPerDay;
          dinnerByPax[p] = hm.dinnerCostPerNight;
          additionalByPax[p] = hm.additionalMealCosts;
        }
        return {
          uiPreferences: { ...prev.uiPreferences, extHotelsMealsPerPax: true },
          extension: { ...prev.extension, hotelsMeals: { ...hm, hotelCostByPax: hotelByPax, lunchCostByPax: lunchByPax, dinnerCostByPax: dinnerByPax, additionalMealCostsByPax: additionalByPax } },
        };
      });
    } else {
      updateConfig(prev => ({
        uiPreferences: { ...prev.uiPreferences, extHotelsMealsPerPax: false },
        extension: { ...prev.extension, hotelsMeals: { ...prev.extension.hotelsMeals, hotelCostByPax: undefined, lunchCostByPax: undefined, dinnerCostByPax: undefined, additionalMealCostsByPax: undefined } },
      }));
    }
  };

  const copyExtHMToAllPax = () => {
    updateConfig(prev => {
      const hm = prev.extension.hotelsMeals;
      const p = effectiveExtHMPax;
      const hotel = hm.hotelCostByPax?.[p] ?? hm.hotelCostPerNight;
      const lunch = hm.lunchCostByPax?.[p] ?? hm.lunchCostPerDay;
      const dinner = hm.dinnerCostByPax?.[p] ?? hm.dinnerCostPerNight;
      const additional = hm.additionalMealCostsByPax?.[p] ?? hm.additionalMealCosts;
      const hotelByPax: { [k: number]: number } = {};
      const lunchByPax: { [k: number]: number } = {};
      const dinnerByPax: { [k: number]: number } = {};
      const additionalByPax: { [k: number]: number } = {};
      for (const pp of paxCounts) {
        hotelByPax[pp] = hotel;
        lunchByPax[pp] = lunch;
        dinnerByPax[pp] = dinner;
        additionalByPax[pp] = additional;
      }
      return { extension: { ...prev.extension, hotelsMeals: { ...hm, hotelCostByPax: hotelByPax, lunchCostByPax: lunchByPax, dinnerCostByPax: dinnerByPax, additionalMealCostsByPax: additionalByPax } } };
    });
  };
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
    updateConfig(prev => {
      const staff = prev.extension.staffConfig.staffByPax[effectiveStaffPax] || [{ role: 'Lead Guide', dailyRate: 400, days: prev.extension.extensionNights, quantity: 1 }];
      const newStaff = [...staff];
      newStaff[index] = { ...newStaff[index], ...updates };
      return { extension: { ...prev.extension, staffConfig: { ...prev.extension.staffConfig, staffByPax: { ...prev.extension.staffConfig.staffByPax, [effectiveStaffPax]: newStaff } } } };
    });
  };

  const addExtStaffMember = () => {
    updateConfig(prev => {
      const staff = prev.extension.staffConfig.staffByPax[effectiveStaffPax] || [];
      const newStaff = [...staff, { role: 'New Role', dailyRate: 200, days: prev.extension.extensionNights, quantity: 1 }];
      return { extension: { ...prev.extension, staffConfig: { ...prev.extension.staffConfig, staffByPax: { ...prev.extension.staffConfig.staffByPax, [effectiveStaffPax]: newStaff } } } };
    });
  };

  const removeExtStaffMember = (index: number) => {
    updateConfig(prev => {
      const staff = prev.extension.staffConfig.staffByPax[effectiveStaffPax] || [];
      const newStaff = staff.filter((_: StaffMember, i: number) => i !== index);
      return { extension: { ...prev.extension, staffConfig: { ...prev.extension.staffConfig, staffByPax: { ...prev.extension.staffConfig.staffByPax, [effectiveStaffPax]: newStaff } } } };
    });
  };

  const copyExtStaffToAll = () => {
    updateConfig(prev => {
      const staff = prev.extension.staffConfig.staffByPax[effectiveStaffPax] || [{ role: 'Lead Guide', dailyRate: 400, days: prev.extension.extensionNights, quantity: 1 }];
      const newStaffByPax: { [pax: number]: StaffMember[] } = {};
      for (const p of paxCounts) newStaffByPax[p] = staff.map((s: StaffMember) => ({ ...s }));
      return { extension: { ...prev.extension, staffConfig: { ...prev.extension.staffConfig, staffByPax: newStaffByPax } } };
    });
  };

  // Resolve values for display (inherit vs custom)
  const resolvedSingleSuppPrice = ext.singleSupplement.inheritFromMain
    ? config.singleSupplement.singleSupplement
    : ext.singleSupplement.singleSupplement;
  const resolvedSingleRoomExtra = ext.singleSupplement.inheritFromMain
    ? config.singleSupplement.singleRoomExtra
    : ext.singleSupplement.singleRoomExtra;

  // When inheriting from main, use per-pax rates if the main trip uses per-pax mode
  // (effectiveStaffPax is the currently-displayed pax level in the extension UI)
  const resolvedHotelRate = ext.hotelsMeals.inheritFromMain
    ? (config.hotelsMeals.hotelCostByPax?.[effectiveStaffPax] ?? config.hotelsMeals.hotelCostPerNight)
    : ext.hotelsMeals.hotelCostPerNight;
  const resolvedLunchRate = ext.hotelsMeals.inheritFromMain
    ? (config.hotelsMeals.lunchCostByPax?.[effectiveStaffPax] ?? config.hotelsMeals.lunchCostPerDay)
    : ext.hotelsMeals.lunchCostPerDay;
  const resolvedDinnerRate = ext.hotelsMeals.inheritFromMain
    ? (config.hotelsMeals.dinnerCostByPax?.[effectiveStaffPax] ?? config.hotelsMeals.dinnerCostPerNight)
    : ext.hotelsMeals.dinnerCostPerNight;
  const resolvedAdditionalMeals = ext.hotelsMeals.inheritFromMain
    ? (config.hotelsMeals.additionalMealCostsByPax?.[effectiveStaffPax] ?? config.hotelsMeals.additionalMealCosts)
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
                <NumInput type="number" value={ext.extensionPrice} onChange={(e) => updateExtension({ extensionPrice: Number(e.target.value) })} className="w-full" />
              </div>
              <div className="form-group">
                <label className="form-label">Extension Nights</label>
                <p className="text-xs text-ag-text-muted mb-1">Number of nights for the extension</p>
                <NumInput type="number" min="1" value={ext.extensionNights} onChange={(e) => updateExtension({ extensionNights: Math.max(1, Number(e.target.value)) })} className="w-full" />
              </div>
            </div>
            {!extPerPax ? (
              <div className="mt-4 pt-4 border-t border-ag-border">
                <div className="form-group w-48">
                  <label className="form-label">Guest Count</label>
                  <p className="text-xs text-ag-text-muted mb-1">Same count applied to all group sizes</p>
                  <NumInput type="number" min="0" value={ext.countByPax?.[paxCounts[0]] ?? 0} onChange={(e) => { const val = Number(e.target.value); const c: { [k: number]: number } = {}; for (const p of paxCounts) c[p] = val; updateExtension({ countByPax: c }); }} className="w-full" />
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
                      <NumInput type="number" min="0" value={ext.countByPax?.[p] ?? 0} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ extension: { ...prev.extension, countByPax: { ...prev.extension.countByPax, [p]: val } } })); }} className="w-full text-center" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Extension Discounts */}
      {ext.enabled && (
        <div className={`card ${ext.discounts?.enabled === false ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Extension - Discounts</h2>
            <div className="flex gap-2">
              {ext.discounts?.enabled !== false && (
                <>
                  <button onClick={() => updateExtDiscounts({ inheritFromMain: !ext.discounts.inheritFromMain })} className={`btn text-xs ${ext.discounts.inheritFromMain ? 'btn-secondary' : 'btn-primary'}`}>
                    {ext.discounts.inheritFromMain ? 'Match Core Inputs' : 'Custom'}
                  </button>
                  {!ext.discounts.inheritFromMain && (
                    <button onClick={() => setExtDiscountsPerPax(!extDiscountsPerPax)} className={`btn text-xs ${extDiscountsPerPax ? 'btn-primary' : 'btn-secondary'}`}>
                      {extDiscountsPerPax ? 'Per Pax Mode' : 'Simple Mode'}
                    </button>
                  )}
                </>
              )}
              <button onClick={() => updateExtDiscounts({ enabled: ext.discounts?.enabled === false })} className={`btn text-xs ${ext.discounts?.enabled === false ? 'btn-danger' : 'btn-primary'}`}>
                {ext.discounts?.enabled === false ? 'Inactive' : 'Active'}
              </button>
            </div>
          </div>
          {ext.discounts?.enabled === false ? (
            <p className="text-sm text-ag-text-muted">Section disabled — extension discounts will not be applied.</p>
          ) : ext.discounts.inheritFromMain ? (
            <div>
              <p className="text-sm text-ag-text-muted mb-3">Rates from main trip. Set guest counts for extension below.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Early Bird Discount ($)</label>
                  <NumInput type="number" value={config.earlyBirdDiscount} disabled className="w-full opacity-50 cursor-not-allowed" />
                </div>
                <div className="form-group">
                  <label className="form-label">Loyalty Discount Rate (%)</label>
                  <NumInput type="number" value={config.loyaltyDiscountRate * 100} disabled className="w-full opacity-50 cursor-not-allowed" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-ag-border">
                <div className="form-group">
                  <label className="form-label">Early Bird Count</label>
                  <p className="text-xs text-ag-text-muted mb-1">Same count applied to all group sizes</p>
                  <NumInput type="number" min="0" value={ext.discounts.earlyBirdCountByPax?.[paxCounts[0]] ?? 0} onChange={(e) => { const val = Number(e.target.value); const c: { [k: number]: number } = {}; for (const p of paxCounts) c[p] = val; updateExtDiscounts({ earlyBirdCountByPax: c }); }} className="w-full" />
                </div>
                <div className="form-group">
                  <label className="form-label">Loyalty Count</label>
                  <p className="text-xs text-ag-text-muted mb-1">Same count applied to all group sizes</p>
                  <NumInput type="number" min="0" value={ext.discounts.loyaltyCountByPax?.[paxCounts[0]] ?? 0} onChange={(e) => { const val = Number(e.target.value); const c: { [k: number]: number } = {}; for (const p of paxCounts) c[p] = val; updateExtDiscounts({ loyaltyCountByPax: c }); }} className="w-full" />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Early Bird Discount ($)</label>
                  <p className="text-xs text-ag-text-muted mb-1">Amount discounted per early bird guest</p>
                  <NumInput type="number" value={ext.discounts.earlyBirdDiscount} onChange={(e) => updateExtDiscounts({ earlyBirdDiscount: Number(e.target.value) })} className="w-full" />
                </div>
                <div className="form-group">
                  <label className="form-label">Loyalty Discount Rate (%)</label>
                  <p className="text-xs text-ag-text-muted mb-1">% discount on extension price per loyalty guest</p>
                  <NumInput type="number" step="0.01" value={ext.discounts.loyaltyDiscountRate * 100} onChange={(e) => updateExtDiscounts({ loyaltyDiscountRate: Number(e.target.value) / 100 })} className="w-full" />
                </div>
              </div>
              {!extDiscountsPerPax ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-ag-border">
                  <div className="form-group">
                    <label className="form-label">Early Bird Count</label>
                    <p className="text-xs text-ag-text-muted mb-1">Same count applied to all group sizes</p>
                    <NumInput type="number" min="0" value={ext.discounts.earlyBirdCountByPax?.[paxCounts[0]] ?? 0} onChange={(e) => { const val = Number(e.target.value); const c: { [k: number]: number } = {}; for (const p of paxCounts) c[p] = val; updateExtDiscounts({ earlyBirdCountByPax: c }); }} className="w-full" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Loyalty Count</label>
                    <p className="text-xs text-ag-text-muted mb-1">Same count applied to all group sizes</p>
                    <NumInput type="number" min="0" value={ext.discounts.loyaltyCountByPax?.[paxCounts[0]] ?? 0} onChange={(e) => { const val = Number(e.target.value); const c: { [k: number]: number } = {}; for (const p of paxCounts) c[p] = val; updateExtDiscounts({ loyaltyCountByPax: c }); }} className="w-full" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-4 pt-4 border-t border-ag-border">
                    <div className="flex items-center justify-between mb-2">
                      <label className="form-label mb-0">Early Bird Count by Pax</label>
                      <button onClick={() => { const c: { [k: number]: number } = {}; const b = ext.discounts.earlyBirdCountByPax?.[paxCounts[0]] ?? 0; for (const p of paxCounts) c[p] = b; updateExtDiscounts({ earlyBirdCountByPax: c }); }} className="btn btn-secondary text-xs">Apply First to All</button>
                    </div>
                    <p className="text-xs text-ag-text-muted mb-2">How many extension guests get the early bird discount at each group size</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                      {paxCounts.map((p) => (
                        <div key={p} className="form-group">
                          <label className="form-label text-center">{p} pax</label>
                          <NumInput type="number" min="0" value={ext.discounts.earlyBirdCountByPax?.[p] ?? 0} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ extension: { ...prev.extension, discounts: { ...prev.extension.discounts, earlyBirdCountByPax: { ...prev.extension.discounts.earlyBirdCountByPax, [p]: val } } } })); }} className="w-full text-center" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-ag-border">
                    <div className="flex items-center justify-between mb-2">
                      <label className="form-label mb-0">Loyalty Count by Pax</label>
                      <button onClick={() => { const c: { [k: number]: number } = {}; const b = ext.discounts.loyaltyCountByPax?.[paxCounts[0]] ?? 0; for (const p of paxCounts) c[p] = b; updateExtDiscounts({ loyaltyCountByPax: c }); }} className="btn btn-secondary text-xs">Apply First to All</button>
                    </div>
                    <p className="text-xs text-ag-text-muted mb-2">How many extension guests get the loyalty discount at each group size</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                      {paxCounts.map((p) => (
                        <div key={p} className="form-group">
                          <label className="form-label text-center">{p} pax</label>
                          <NumInput type="number" min="0" value={ext.discounts.loyaltyCountByPax?.[p] ?? 0} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ extension: { ...prev.extension, discounts: { ...prev.extension.discounts, loyaltyCountByPax: { ...prev.extension.discounts.loyaltyCountByPax, [p]: val } } } })); }} className="w-full text-center" />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

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
                  <NumInput type="number" value={resolvedSingleSuppPrice} disabled className="w-full opacity-50 cursor-not-allowed" />
                </div>
                <div className="form-group">
                  <label className="form-label">Single Room Extra Cost ($)</label>
                  <NumInput type="number" value={resolvedSingleRoomExtra} disabled className="w-full opacity-50 cursor-not-allowed" />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-ag-border">
                <div className="form-group w-48">
                  <label className="form-label">Number of Extension Guests</label>
                  <p className="text-xs text-ag-text-muted mb-1">How many extension guests take single supplement</p>
                  <NumInput type="number" min="0" value={ext.singleSupplement.countByPax?.[paxCounts[0]] ?? 0} onChange={(e) => { const val = Number(e.target.value); const c: { [k: number]: number } = {}; for (const p of paxCounts) c[p] = val; updateExtSingleSupplement({ countByPax: c }); }} className="w-full" />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Single Supplement Price ($)</label>
                  <NumInput type="number" value={ext.singleSupplement.singleSupplement} onChange={(e) => updateExtSingleSupplement({ singleSupplement: Number(e.target.value) })} className="w-full" />
                </div>
                <div className="form-group">
                  <label className="form-label">Single Room Extra Cost ($)</label>
                  <NumInput type="number" value={ext.singleSupplement.singleRoomExtra} onChange={(e) => updateExtSingleSupplement({ singleRoomExtra: Number(e.target.value) })} className="w-full" />
                </div>
              </div>
              {!extSuppPerPax ? (
                <div className="mt-4 pt-4 border-t border-ag-border">
                  <div className="form-group w-48">
                    <label className="form-label">Number of Guests</label>
                    <p className="text-xs text-ag-text-muted mb-1">Same count applied to all group sizes</p>
                    <NumInput type="number" min="0" value={ext.singleSupplement.countByPax?.[paxCounts[0]] ?? 0} onChange={(e) => { const val = Number(e.target.value); const c: { [k: number]: number } = {}; for (const p of paxCounts) c[p] = val; updateExtSingleSupplement({ countByPax: c }); }} className="w-full" />
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
                        <NumInput type="number" min="0" value={ext.singleSupplement.countByPax?.[p] ?? 0} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ extension: { ...prev.extension, singleSupplement: { ...prev.extension.singleSupplement, countByPax: { ...prev.extension.singleSupplement.countByPax, [p]: val } } } })); }} className="w-full text-center" />
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
                <>
                  <button onClick={() => updateExtHotelsMeals({ inheritFromMain: !ext.hotelsMeals.inheritFromMain })} className={`btn text-xs ${ext.hotelsMeals.inheritFromMain ? 'btn-secondary' : 'btn-primary'}`}>
                    {ext.hotelsMeals.inheritFromMain ? 'Match Core Inputs' : 'Custom'}
                  </button>
                  {!ext.hotelsMeals.inheritFromMain && (
                    <button onClick={() => toggleExtHotelsMealsPerPax(!extHotelsMealsPerPax)} className={`btn text-xs ${extHotelsMealsPerPax ? 'btn-primary' : 'btn-secondary'}`}>
                      {extHotelsMealsPerPax ? 'Per Pax Mode' : 'Simple Mode'}
                    </button>
                  )}
                </>
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
              <p className="text-sm text-ag-text-muted mb-3">Using values from main trip hotels & meals ({(() => {
                const mode = config.hotelsMeals.mode || 'perPaxPerNight';
                if (mode === 'perPaxPerNight') return 'Per Pax/Night';
                if (mode === 'perNight') return 'Per Night';
                return 'Total';
              })()} mode).</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="form-group">
                  <label className="form-label">Hotel Cost ($)</label>
                  <NumInput type="number" value={resolvedHotelRate} disabled className="w-full opacity-50 cursor-not-allowed" />
                </div>
                <div className="form-group">
                  <label className="form-label">Lunch Cost ($)</label>
                  <NumInput type="number" value={resolvedLunchRate} disabled className="w-full opacity-50 cursor-not-allowed" />
                </div>
                <div className="form-group">
                  <label className="form-label">Dinner Cost ($)</label>
                  <NumInput type="number" value={resolvedDinnerRate} disabled className="w-full opacity-50 cursor-not-allowed" />
                </div>
                <div className="form-group">
                  <label className="form-label">Additional Meal Costs ($)</label>
                  <NumInput type="number" value={resolvedAdditionalMeals} disabled className="w-full opacity-50 cursor-not-allowed" />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <div className="flex gap-2 items-center">
                  {(['perPaxPerNight', 'perNight', 'total'] as const).map((m) => {
                    const extHmMode = ext.hotelsMeals.mode || 'perPaxPerNight';
                    const labels = { perPaxPerNight: 'Rate \u00d7 Pax \u00d7 Nights', perNight: 'Rate \u00d7 Nights', total: 'Total Cost' };
                    return (
                      <button key={m} onClick={() => updateExtHotelsMeals({ mode: m })} className={`btn text-xs ${extHmMode === m ? 'btn-primary' : 'btn-secondary'}`}>
                        {labels[m]}
                      </button>
                    );
                  })}
                  <span className="text-xs text-ag-text-muted ml-2">
                    {(() => {
                      const mode = ext.hotelsMeals.mode || 'perPaxPerNight';
                      if (mode === 'perPaxPerNight') return '(rate \u00d7 ext pax \u00d7 ext nights)';
                      if (mode === 'total') return '(entered value is total cost)';
                      return '(rate \u00d7 ext nights)';
                    })()}
                  </span>
                </div>
              </div>
              {!extHotelsMealsPerPax ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="form-group">
                    <label className="form-label">Hotel Cost ($)</label>
                    <p className="text-xs text-ag-text-muted mb-1">{(ext.hotelsMeals.mode || 'perPaxPerNight') === 'perPaxPerNight' ? 'Per pax, per night' : (ext.hotelsMeals.mode || 'perPaxPerNight') === 'perNight' ? 'Per night (flat)' : 'Total'}</p>
                    <NumInput type="number" value={ext.hotelsMeals.hotelCostPerNight} onChange={(e) => updateExtHotelsMeals({ hotelCostPerNight: Number(e.target.value) })} className="w-full" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lunch Cost ($)</label>
                    <p className="text-xs text-ag-text-muted mb-1">{(ext.hotelsMeals.mode || 'perPaxPerNight') === 'perPaxPerNight' ? 'Per pax, per day' : (ext.hotelsMeals.mode || 'perPaxPerNight') === 'perNight' ? 'Per day (flat)' : 'Total'}</p>
                    <NumInput type="number" value={ext.hotelsMeals.lunchCostPerDay} onChange={(e) => updateExtHotelsMeals({ lunchCostPerDay: Number(e.target.value) })} className="w-full" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dinner Cost ($)</label>
                    <p className="text-xs text-ag-text-muted mb-1">{(ext.hotelsMeals.mode || 'perPaxPerNight') === 'perPaxPerNight' ? 'Per pax, per night' : (ext.hotelsMeals.mode || 'perPaxPerNight') === 'perNight' ? 'Per night (flat)' : 'Total'}</p>
                    <NumInput type="number" value={ext.hotelsMeals.dinnerCostPerNight} onChange={(e) => updateExtHotelsMeals({ dinnerCostPerNight: Number(e.target.value) })} className="w-full" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Additional Meal Costs ($)</label>
                    <p className="text-xs text-ag-text-muted mb-1">Flat total</p>
                    <NumInput type="number" value={ext.hotelsMeals.additionalMealCosts} onChange={(e) => updateExtHotelsMeals({ additionalMealCosts: Number(e.target.value) })} className="w-full" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex gap-2 flex-wrap">
                      {paxCounts.map((p) => (
                        <button key={p} onClick={() => setSelectedExtHMPax(p)} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${selectedExtHMPax === p ? 'bg-ag-accent text-white' : 'bg-ag-card-lighter text-ag-text-muted hover:text-ag-text'}`}>
                          {p} pax
                        </button>
                      ))}
                    </div>
                    <button onClick={copyExtHMToAllPax} className="btn btn-secondary text-xs ml-2">Copy to All Pax</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3">
                    <div className="form-group">
                      <label className="form-label">Hotel Cost ($)</label>
                      <p className="text-xs text-ag-text-muted mb-1">{(ext.hotelsMeals.mode || 'perPaxPerNight') === 'perPaxPerNight' ? 'Per pax, per night' : (ext.hotelsMeals.mode || 'perPaxPerNight') === 'perNight' ? 'Per night (flat)' : 'Total'}</p>
                      <NumInput type="number" value={ext.hotelsMeals.hotelCostByPax?.[effectiveExtHMPax] ?? ext.hotelsMeals.hotelCostPerNight} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ extension: { ...prev.extension, hotelsMeals: { ...prev.extension.hotelsMeals, hotelCostByPax: { ...prev.extension.hotelsMeals.hotelCostByPax, [effectiveExtHMPax]: val } } } })); }} className="w-full" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Lunch Cost ($)</label>
                      <p className="text-xs text-ag-text-muted mb-1">{(ext.hotelsMeals.mode || 'perPaxPerNight') === 'perPaxPerNight' ? 'Per pax, per day' : (ext.hotelsMeals.mode || 'perPaxPerNight') === 'perNight' ? 'Per day (flat)' : 'Total'}</p>
                      <NumInput type="number" value={ext.hotelsMeals.lunchCostByPax?.[effectiveExtHMPax] ?? ext.hotelsMeals.lunchCostPerDay} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ extension: { ...prev.extension, hotelsMeals: { ...prev.extension.hotelsMeals, lunchCostByPax: { ...prev.extension.hotelsMeals.lunchCostByPax, [effectiveExtHMPax]: val } } } })); }} className="w-full" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Dinner Cost ($)</label>
                      <p className="text-xs text-ag-text-muted mb-1">{(ext.hotelsMeals.mode || 'perPaxPerNight') === 'perPaxPerNight' ? 'Per pax, per night' : (ext.hotelsMeals.mode || 'perPaxPerNight') === 'perNight' ? 'Per night (flat)' : 'Total'}</p>
                      <NumInput type="number" value={ext.hotelsMeals.dinnerCostByPax?.[effectiveExtHMPax] ?? ext.hotelsMeals.dinnerCostPerNight} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ extension: { ...prev.extension, hotelsMeals: { ...prev.extension.hotelsMeals, dinnerCostByPax: { ...prev.extension.hotelsMeals.dinnerCostByPax, [effectiveExtHMPax]: val } } } })); }} className="w-full" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Additional Meal Costs ($)</label>
                      <p className="text-xs text-ag-text-muted mb-1">Flat total</p>
                      <NumInput type="number" value={ext.hotelsMeals.additionalMealCostsByPax?.[effectiveExtHMPax] ?? ext.hotelsMeals.additionalMealCosts} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ extension: { ...prev.extension, hotelsMeals: { ...prev.extension.hotelsMeals, additionalMealCostsByPax: { ...prev.extension.hotelsMeals.additionalMealCostsByPax, [effectiveExtHMPax]: val } } } })); }} className="w-full" />
                    </div>
                  </div>
                </>
              )}
            </>
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
                      <NumInput type="number" value={staff.dailyRate} disabled className="w-full opacity-50 cursor-not-allowed" />
                    </div>
                    <div className="form-group w-24">
                      <label className="form-label">Days</label>
                      <NumInput type="number" value={staff.days} disabled className="w-full opacity-50 cursor-not-allowed" />
                    </div>
                    <div className="form-group w-24">
                      <label className="form-label">Quantity</label>
                      <NumInput type="number" value={staff.quantity} disabled className="w-full opacity-50 cursor-not-allowed" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-ag-border">
                <div className="form-group">
                  <label className="form-label">Travel Days</label>
                  <NumInput type="number" value={ext.staffConfig.travelDays} onChange={(e) => updateExtStaff({ travelDays: Number(e.target.value) })} className="w-full" />
                </div>
                <div className="form-group">
                  <label className="form-label">Travel Day Rate ($)</label>
                  <NumInput type="number" value={config.staffConfig.travelDayRate} disabled className="w-full opacity-50 cursor-not-allowed" />
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
                      <NumInput type="number" value={staff.dailyRate} onChange={(e) => updateExtStaffMember(index, { dailyRate: Number(e.target.value) })} className="w-full" />
                    </div>
                    <div className="form-group w-24">
                      <label className="form-label">Days</label>
                      <NumInput type="number" value={staff.days} onChange={(e) => updateExtStaffMember(index, { days: Number(e.target.value) })} className="w-full" />
                    </div>
                    <div className="form-group w-24">
                      <label className="form-label">Quantity</label>
                      <NumInput type="number" value={staff.quantity} onChange={(e) => updateExtStaffMember(index, { quantity: Number(e.target.value) })} className="w-full" />
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
                  <NumInput type="number" value={ext.staffConfig.travelDays} onChange={(e) => updateExtStaff({ travelDays: Number(e.target.value) })} className="w-full" />
                </div>
                <div className="form-group">
                  <label className="form-label">Travel Day Rate ($)</label>
                  <NumInput type="number" value={ext.staffConfig.travelDayRate} onChange={(e) => updateExtStaff({ travelDayRate: Number(e.target.value) })} className="w-full" />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Extension Logistics */}
      {ext.enabled && (
        <div className={`card ${ext.logisticsConfig?.enabled === false ? 'opacity-60' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Extension - Logistics</h2>
            <div className="flex gap-2">
              {ext.logisticsConfig?.enabled !== false && (
                <button onClick={() => updateExtLogistics({ inheritFromMain: !ext.logisticsConfig.inheritFromMain })} className={`btn text-xs ${ext.logisticsConfig.inheritFromMain ? 'btn-secondary' : 'btn-primary'}`}>
                  {ext.logisticsConfig.inheritFromMain ? 'Match Core Inputs' : 'Custom'}
                </button>
              )}
              <button onClick={() => updateExtLogistics({ enabled: ext.logisticsConfig?.enabled === false })} className={`btn text-xs ${ext.logisticsConfig?.enabled === false ? 'btn-danger' : 'btn-primary'}`}>
                {ext.logisticsConfig?.enabled === false ? 'Inactive' : 'Active'}
              </button>
            </div>
          </div>
          {ext.logisticsConfig?.enabled === false ? (
            <p className="text-sm text-ag-text-muted">Section disabled — extension logistics will not be applied.</p>
          ) : ext.logisticsConfig.inheritFromMain ? (
            <div>
              <p className="text-sm text-ag-text-muted mb-3">Using rates and mode from main trip logistics ({(() => {
                const mode = config.logistics.mode || (config.logistics.perPax ? 'perPaxPerDay' : 'perDay');
                if (mode === 'perPaxPerDay') return 'Rate \u00d7 Pax \u00d7 Nights';
                if (mode === 'total') return 'Total Cost';
                return 'Rate \u00d7 Nights';
              })()}, applied to extension nights).</p>
              {config.logistics.simpleMode !== false ? (
                <div className="max-w-xs">
                  <label className="form-label">Rate (all pax)</label>
                  <NumInput type="number" value={config.logistics.rates[0]?.rate ?? 0} disabled className="w-full opacity-50 cursor-not-allowed" />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                  {paxCounts.map((p) => {
                    const existing = config.logistics.rates.find(r => r.pax === p);
                    const rateValue = existing ? existing.rate : 0;
                    return (
                      <div key={p} className="form-group">
                        <label className="form-label text-center">{p} pax</label>
                        <NumInput type="number" value={rateValue} disabled className="w-full text-center opacity-50 cursor-not-allowed" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="mb-4">
                <div className="flex gap-2 items-center flex-wrap">
                  {(['perPaxPerDay', 'perDay', 'total'] as const).map((m) => {
                    const extLogMode = ext.logisticsConfig.mode || 'perDay';
                    const labels = { perPaxPerDay: 'Rate \u00d7 Pax \u00d7 Nights', perDay: 'Rate \u00d7 Nights', total: 'Total Cost' };
                    return (
                      <button key={m} onClick={() => updateExtLogistics({ mode: m })} className={`btn text-xs ${extLogMode === m ? 'btn-primary' : 'btn-secondary'}`}>
                        {labels[m]}
                      </button>
                    );
                  })}
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => updateExtLogistics({ simpleMode: true })}
                      className={`btn text-xs ${ext.logisticsConfig.simpleMode !== false ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      Simple
                    </button>
                    <button
                      onClick={() => updateExtLogistics({ simpleMode: false })}
                      className={`btn text-xs ${ext.logisticsConfig.simpleMode === false ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      Per Pax
                    </button>
                  </div>
                </div>
              </div>
              {ext.logisticsConfig.simpleMode !== false ? (
                <div className="max-w-xs">
                  <label className="form-label">Rate (all pax)</label>
                  <NumInput
                    type="number"
                    value={ext.logisticsConfig.rates?.[0]?.rate ?? 0}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      updateExtLogistics({ rates: paxCounts.map(p => ({ pax: p, rate: val })) });
                    }}
                    className="w-full"
                  />
                </div>
              ) : (
                <>
                  <p className="text-xs text-ag-text-muted mb-3">Rate per pax level — use mode buttons above to control how it&apos;s applied</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                    {paxCounts.map((p) => {
                      const existing = ext.logisticsConfig.rates?.find((r: { pax: number; rate: number }) => r.pax === p);
                      const rateValue = existing ? existing.rate : 0;
                      return (
                        <div key={p} className="form-group">
                          <label className="form-label text-center">{p} pax</label>
                          <NumInput type="number" value={rateValue} onChange={(e) => {
                            updateConfig(prev => {
                              const rates = (prev.extension.logisticsConfig.rates || []).filter((r: { pax: number; rate: number }) => r.pax !== p);
                              rates.push({ pax: p, rate: Number(e.target.value) });
                              return { extension: { ...prev.extension, logisticsConfig: { ...prev.extension.logisticsConfig, rates } } };
                            });
                          }} className="w-full text-center" />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
