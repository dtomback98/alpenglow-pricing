'use client';

import React, { useState, useEffect } from 'react';
import { TripConfiguration, StaffMember, AdditionalHotel } from '@/lib/types';

interface ActiveDropdownProps {
  id: string;
  value: 'simple' | 'perPax';
  onChange: (v: 'simple' | 'perPax') => void;
  openId: string | null;
  setOpenId: (id: string | null) => void;
}
const ActiveDropdown = ({ id, value, onChange, openId, setOpenId }: ActiveDropdownProps) => (
  <div className="relative" onClick={e => e.stopPropagation()}>
    <button
      className="btn btn-secondary text-xs flex items-center gap-1"
      onClick={() => setOpenId(openId === id ? null : id)}
    >
      Active: {value === 'simple' ? 'Simple' : 'Per Pax'} <span className="opacity-50">▾</span>
    </button>
    {openId === id && (
      <div className="absolute right-0 top-full mt-1 z-50 min-w-[110px] rounded-md border border-ag-border bg-ag-card shadow-lg">
        <button
          className={`block w-full text-left px-3 py-2 text-xs rounded-t-md hover:bg-white/5 ${value === 'simple' ? 'text-blue-400 font-medium' : 'text-ag-text'}`}
          onClick={() => { onChange('simple'); setOpenId(null); }}
        >Simple</button>
        <button
          className={`block w-full text-left px-3 py-2 text-xs rounded-b-md hover:bg-white/5 ${value === 'perPax' ? 'text-blue-400 font-medium' : 'text-ag-text'}`}
          onClick={() => { onChange('perPax'); setOpenId(null); }}
        >Per Pax</button>
      </div>
    )}
  </div>
);

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

  const updateExtGuideLogistics = (updates: Partial<NonNullable<TripConfiguration['extension']['logisticsConfig']['guideLogistics']>>) => {
    updateConfig(prev => {
      const gl = prev.extension.logisticsConfig.guideLogistics ?? { baseRate: 0, rates: [], mode: 'perDay' as const, simpleMode: true };
      return { extension: { ...prev.extension, logisticsConfig: { ...prev.extension.logisticsConfig, guideLogistics: { ...gl, ...updates } } } } as Partial<TripConfiguration>;
    });
  };

  const extSuppPerPax = config.uiPreferences?.extSuppPerPax ?? false;
  const extDiscountsPerPax = config.uiPreferences?.extDiscountsPerPax ?? false;
  const extHotelsMealsPerPax = config.uiPreferences?.extHotelsMealsPerPax ?? false;
  const extHmEffectiveAM: 'simple' | 'perPax' = ext.hotelsMeals.activeMode
    ?? (ext.hotelsMeals.hotelCostByPax && Object.keys(ext.hotelsMeals.hotelCostByPax).length > 0 ? 'perPax' : 'simple');
  const extDiscountsEffectiveAM: 'simple' | 'perPax' = ext.discounts?.activeMode ?? (extDiscountsPerPax ? 'perPax' : 'simple');
  const extSuppEffectiveAM: 'simple' | 'perPax' = ext.singleSupplement?.activeMode ?? 'simple';
  const extLogEffectiveAM: 'simple' | 'perPax' = ext.logisticsConfig?.activeMode ?? (ext.logisticsConfig?.simpleMode !== false ? 'simple' : 'perPax');
  const extGuideLogEffectiveAM: 'simple' | 'perPax' = ext.logisticsConfig?.guideLogistics?.activeMode ?? (ext.logisticsConfig?.guideLogistics?.simpleMode !== false ? 'simple' : 'perPax');
  const setExtSuppPerPax = (val: boolean) => updateConfig(prev => ({ uiPreferences: { ...prev.uiPreferences, extSuppPerPax: val } }));
  const setExtDiscountsPerPax = (val: boolean) => updateConfig(prev => ({ uiPreferences: { ...prev.uiPreferences, extDiscountsPerPax: val } }));

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  useEffect(() => {
    if (!openDropdown) return;
    const close = () => setOpenDropdown(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openDropdown]);

  const [extPercent, setExtPercent] = useState(100);

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
      // Switching back to Simple view: clear per-pax data and reset activeMode so dropdown reads correctly
      updateConfig(prev => ({
        uiPreferences: { ...prev.uiPreferences, extHotelsMealsPerPax: false },
        extension: { ...prev.extension, hotelsMeals: { ...prev.extension.hotelsMeals, activeMode: undefined, hotelCostByPax: undefined, lunchCostByPax: undefined, dinnerCostByPax: undefined, additionalMealCostsByPax: undefined } },
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
          <button onClick={() => updateExtension({ enabled: !ext.enabled })} className={`btn text-xs ${!ext.enabled ? 'btn-danger' : 'btn-primary'}`}>
            {!ext.enabled ? 'Inactive' : 'Active'}
          </button>
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
            <div className="mt-4 pt-4 border-t border-ag-border">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <label className="form-label mb-0">Guests Taking Extension by Pax</label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <input type="number" min="0" max="100" value={extPercent} onChange={(e) => setExtPercent(Math.min(100, Math.max(0, Number(e.target.value))))} className="w-16 text-center text-sm" />
                    <span className="text-sm text-ag-text-muted">%</span>
                  </div>
                  <button onClick={() => { const c: { [k: number]: number } = {}; for (const p of paxCounts) c[p] = Math.ceil(p * extPercent / 100); updateExtension({ countByPax: c }); }} className="btn btn-secondary text-xs">Apply %</button>
                  <button onClick={() => { const c: { [k: number]: number } = {}; const b = ext.countByPax?.[paxCounts[0]] || 0; for (const p of paxCounts) c[p] = Math.min(b, p); updateExtension({ countByPax: c }); }} className="btn btn-secondary text-xs">Apply First to All</button>
                </div>
              </div>
              <p className="text-xs text-ag-text-muted mb-2">How many guests join the extension at each group size</p>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                {paxCounts.map((p) => (
                  <div key={p} className="form-group">
                    <label className="form-label text-center">{p} pax</label>
                    <NumInput type="number" min="0" max={p} value={ext.countByPax?.[p] ?? 0} onChange={(e) => { const val = Math.min(Math.max(0, Number(e.target.value) || 0), p); e.target.value = String(val); updateConfig(prev => ({ extension: { ...prev.extension, countByPax: { ...prev.extension.countByPax, [p]: val } } })); }} className="w-full text-center" />
                  </div>
                ))}
              </div>
            </div>
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
                    <>
                      <button onClick={() => setExtDiscountsPerPax(false)} className={`btn text-xs ${!extDiscountsPerPax ? 'btn-primary' : 'btn-secondary'}`}>Simple</button>
                      <button onClick={() => setExtDiscountsPerPax(true)} className={`btn text-xs ${extDiscountsPerPax ? 'btn-primary' : 'btn-secondary'}`}>Per Pax</button>
                      <ActiveDropdown id="extDiscounts" value={extDiscountsEffectiveAM} onChange={v => updateExtDiscounts({ activeMode: v })} openId={openDropdown} setOpenId={setOpenDropdown} />
                    </>
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
                      <button onClick={() => { const c: { [k: number]: number } = {}; const b = ext.discounts.earlyBirdCountByPax?.[paxCounts[0]] ?? 0; for (const p of paxCounts) c[p] = Math.min(b, ext.countByPax?.[p] ?? p); updateExtDiscounts({ earlyBirdCountByPax: c }); }} className="btn btn-secondary text-xs">Apply First to All</button>
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
                      <button onClick={() => { const c: { [k: number]: number } = {}; const b = ext.discounts.loyaltyCountByPax?.[paxCounts[0]] ?? 0; for (const p of paxCounts) c[p] = Math.min(b, ext.countByPax?.[p] ?? p); updateExtDiscounts({ loyaltyCountByPax: c }); }} className="btn btn-secondary text-xs">Apply First to All</button>
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
                    <>
                      <button onClick={() => setExtSuppPerPax(false)} className={`btn text-xs ${!extSuppPerPax ? 'btn-primary' : 'btn-secondary'}`}>Simple</button>
                      <button onClick={() => setExtSuppPerPax(true)} className={`btn text-xs ${extSuppPerPax ? 'btn-primary' : 'btn-secondary'}`}>Per Pax</button>
                      <ActiveDropdown id="extSingleSupp" value={extSuppEffectiveAM} onChange={v => updateExtSingleSupplement({ activeMode: v })} openId={openDropdown} setOpenId={setOpenDropdown} />
                    </>
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
                    <>
                      <button onClick={() => toggleExtHotelsMealsPerPax(false)} className={`btn text-xs ${!extHotelsMealsPerPax ? 'btn-primary' : 'btn-secondary'}`}>Simple</button>
                      <button onClick={() => toggleExtHotelsMealsPerPax(true)} className={`btn text-xs ${extHotelsMealsPerPax ? 'btn-primary' : 'btn-secondary'}`}>Per Pax</button>
                      <ActiveDropdown id="extHM" value={extHmEffectiveAM} onChange={v => updateExtHotelsMeals({ activeMode: v })} openId={openDropdown} setOpenId={setOpenDropdown} />
                    </>
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
                if (mode === 'perPax') return 'Per Pax';
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
                  {(['perPaxPerNight', 'perNight', 'perPax', 'total'] as const).map((m) => {
                    const extHmMode = ext.hotelsMeals.mode || 'perPaxPerNight';
                    const labels = { perPaxPerNight: 'Rate \u00d7 Pax \u00d7 Nights', perNight: 'Rate \u00d7 Nights', perPax: 'Rate \u00d7 Pax', total: 'Total Cost' };
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
                      if (mode === 'perNight') return '(rate \u00d7 ext nights)';
                      if (mode === 'perPax') return '(rate \u00d7 ext pax, whole-trip per-person cost)';
                      return '(entered value is total cost)';
                    })()}
                  </span>
                </div>
              </div>
              {!extHotelsMealsPerPax ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3 items-end">
                    <div className="form-group">
                      <label className="form-label">Hotel 1 — Name</label>
                      <input type="text" value={ext.hotelsMeals.hotelLabel || ''} onChange={(e) => updateExtHotelsMeals({ hotelLabel: e.target.value })} className="w-full" placeholder="Hotel 1" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Nights</label>
                      <NumInput value={ext.hotelsMeals.hotelNights ?? ext.extensionNights} onChange={(e) => updateExtHotelsMeals({ hotelNights: Number(e.target.value) || 1 })} className="w-full" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Rate ($)</label>
                      <p className="text-xs text-ag-text-muted mb-1">{(ext.hotelsMeals.mode || 'perPaxPerNight') === 'perPaxPerNight' ? 'Per pax, per night' : (ext.hotelsMeals.mode || 'perPaxPerNight') === 'perNight' ? 'Per night (flat)' : (ext.hotelsMeals.mode || 'perPaxPerNight') === 'perPax' ? 'Per person, whole trip' : 'Total'}</p>
                      <NumInput type="number" value={ext.hotelsMeals.hotelCostPerNight} onChange={(e) => updateExtHotelsMeals({ hotelCostPerNight: Number(e.target.value) })} className="w-full" />
                    </div>
                    <div />
                  </div>
                  {(ext.hotelsMeals.additionalHotels || []).map((hotel, idx) => (
                    <div key={hotel.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3 items-end">
                      <div className="form-group">
                        <label className="form-label">Hotel {idx + 2} — Name</label>
                        <input type="text" value={hotel.label} onChange={(e) => { const updated = (ext.hotelsMeals.additionalHotels || []).map((h, i) => i === idx ? { ...h, label: e.target.value } : h); updateExtHotelsMeals({ additionalHotels: updated }); }} className="w-full" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Nights</label>
                        <NumInput value={hotel.nights} onChange={(e) => { const updated = (ext.hotelsMeals.additionalHotels || []).map((h, i) => i === idx ? { ...h, nights: Number(e.target.value) || 1 } : h); updateExtHotelsMeals({ additionalHotels: updated }); }} className="w-full" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Rate ($)</label>
                        <p className="text-xs text-ag-text-muted mb-1">{(ext.hotelsMeals.mode || 'perPaxPerNight') === 'perPaxPerNight' ? 'Per pax, per night' : (ext.hotelsMeals.mode || 'perPaxPerNight') === 'perNight' ? 'Per night (flat)' : (ext.hotelsMeals.mode || 'perPaxPerNight') === 'perPax' ? 'Per person, whole trip' : 'Total'}</p>
                        <NumInput value={hotel.ratePerNight} onChange={(e) => { const updated = (ext.hotelsMeals.additionalHotels || []).map((h, i) => i === idx ? { ...h, ratePerNight: Number(e.target.value) } : h); updateExtHotelsMeals({ additionalHotels: updated }); }} className="w-full" />
                      </div>
                      <div className="form-group flex items-end pb-0.5">
                        <button className="btn btn-danger text-xs" onClick={() => updateExtHotelsMeals({ additionalHotels: (ext.hotelsMeals.additionalHotels || []).filter((_, i) => i !== idx) })}>Remove</button>
                      </div>
                    </div>
                  ))}
                  <button className="btn btn-secondary text-xs mb-4" onClick={() => { const newHotel: AdditionalHotel = { id: Date.now().toString(), label: `Hotel ${(ext.hotelsMeals.additionalHotels?.length || 0) + 2}`, nights: ext.hotelsMeals.hotelNights ?? ext.extensionNights, ratePerNight: ext.hotelsMeals.hotelCostPerNight }; updateExtHotelsMeals({ additionalHotels: [...(ext.hotelsMeals.additionalHotels || []), newHotel] }); }}>+ Add Hotel</button>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="form-group">
                      <label className="form-label">Lunch Cost ($)</label>
                      <p className="text-xs text-ag-text-muted mb-1">{(ext.hotelsMeals.mode || 'perPaxPerNight') === 'perPaxPerNight' ? 'Per pax, per day' : (ext.hotelsMeals.mode || 'perPaxPerNight') === 'perNight' ? 'Per day (flat)' : 'Total'}</p>
                      <NumInput type="number" value={ext.hotelsMeals.lunchCostPerDay} onChange={(e) => updateExtHotelsMeals({ lunchCostPerDay: Number(e.target.value) })} className="w-full" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Dinner Cost ($)</label>
                      <p className="text-xs text-ag-text-muted mb-1">{(ext.hotelsMeals.mode || 'perPaxPerNight') === 'perPaxPerNight' ? 'Per pax, per night' : (ext.hotelsMeals.mode || 'perPaxPerNight') === 'perNight' ? 'Per night (flat)' : (ext.hotelsMeals.mode || 'perPaxPerNight') === 'perPax' ? 'Per person, whole trip' : 'Total'}</p>
                      <NumInput type="number" value={ext.hotelsMeals.dinnerCostPerNight} onChange={(e) => updateExtHotelsMeals({ dinnerCostPerNight: Number(e.target.value) })} className="w-full" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Additional Meal Costs ($)</label>
                      <p className="text-xs text-ag-text-muted mb-1">Flat total</p>
                      <NumInput type="number" value={ext.hotelsMeals.additionalMealCosts} onChange={(e) => updateExtHotelsMeals({ additionalMealCosts: Number(e.target.value) })} className="w-full" />
                    </div>
                  </div>
                </>
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
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3 items-end">
                    <div className="form-group">
                      <label className="form-label">Hotel 1 — Name</label>
                      <input type="text" value={ext.hotelsMeals.hotelLabel || ''} onChange={(e) => updateExtHotelsMeals({ hotelLabel: e.target.value })} className="w-full" placeholder="Hotel 1" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Nights</label>
                      <NumInput value={ext.hotelsMeals.hotelNights ?? ext.extensionNights} onChange={(e) => updateExtHotelsMeals({ hotelNights: Number(e.target.value) || 1 })} className="w-full" />
                    </div>
                    <div />
                    <div />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3">
                    <div className="form-group">
                      <label className="form-label">Hotel Cost ($)</label>
                      <p className="text-xs text-ag-text-muted mb-1">{(ext.hotelsMeals.mode || 'perPaxPerNight') === 'perPaxPerNight' ? 'Per pax, per night' : (ext.hotelsMeals.mode || 'perPaxPerNight') === 'perNight' ? 'Per night (flat)' : (ext.hotelsMeals.mode || 'perPaxPerNight') === 'perPax' ? 'Per person, whole trip' : 'Total'}</p>
                      <NumInput type="number" value={ext.hotelsMeals.hotelCostByPax?.[effectiveExtHMPax] ?? ext.hotelsMeals.hotelCostPerNight} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ extension: { ...prev.extension, hotelsMeals: { ...prev.extension.hotelsMeals, hotelCostByPax: { ...prev.extension.hotelsMeals.hotelCostByPax, [effectiveExtHMPax]: val } } } })); }} className="w-full" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Lunch Cost ($)</label>
                      <p className="text-xs text-ag-text-muted mb-1">{(ext.hotelsMeals.mode || 'perPaxPerNight') === 'perPaxPerNight' ? 'Per pax, per day' : (ext.hotelsMeals.mode || 'perPaxPerNight') === 'perNight' ? 'Per day (flat)' : 'Total'}</p>
                      <NumInput type="number" value={ext.hotelsMeals.lunchCostByPax?.[effectiveExtHMPax] ?? ext.hotelsMeals.lunchCostPerDay} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ extension: { ...prev.extension, hotelsMeals: { ...prev.extension.hotelsMeals, lunchCostByPax: { ...prev.extension.hotelsMeals.lunchCostByPax, [effectiveExtHMPax]: val } } } })); }} className="w-full" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Dinner Cost ($)</label>
                      <p className="text-xs text-ag-text-muted mb-1">{(ext.hotelsMeals.mode || 'perPaxPerNight') === 'perPaxPerNight' ? 'Per pax, per night' : (ext.hotelsMeals.mode || 'perPaxPerNight') === 'perNight' ? 'Per night (flat)' : (ext.hotelsMeals.mode || 'perPaxPerNight') === 'perPax' ? 'Per person, whole trip' : 'Total'}</p>
                      <NumInput type="number" value={ext.hotelsMeals.dinnerCostByPax?.[effectiveExtHMPax] ?? ext.hotelsMeals.dinnerCostPerNight} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ extension: { ...prev.extension, hotelsMeals: { ...prev.extension.hotelsMeals, dinnerCostByPax: { ...prev.extension.hotelsMeals.dinnerCostByPax, [effectiveExtHMPax]: val } } } })); }} className="w-full" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Additional Meal Costs ($)</label>
                      <p className="text-xs text-ag-text-muted mb-1">Flat total</p>
                      <NumInput type="number" value={ext.hotelsMeals.additionalMealCostsByPax?.[effectiveExtHMPax] ?? ext.hotelsMeals.additionalMealCosts} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ extension: { ...prev.extension, hotelsMeals: { ...prev.extension.hotelsMeals, additionalMealCostsByPax: { ...prev.extension.hotelsMeals.additionalMealCostsByPax, [effectiveExtHMPax]: val } } } })); }} className="w-full" />
                    </div>
                  </div>
                  {(ext.hotelsMeals.additionalHotels || []).map((hotel, idx) => (
                    <div key={hotel.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3 items-end">
                      <div className="form-group">
                        <label className="form-label">Hotel {idx + 2} — Name</label>
                        <input type="text" value={hotel.label} onChange={(e) => { const updated = (ext.hotelsMeals.additionalHotels || []).map((h, i) => i === idx ? { ...h, label: e.target.value } : h); updateExtHotelsMeals({ additionalHotels: updated }); }} className="w-full" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Nights</label>
                        <NumInput value={hotel.nights} onChange={(e) => { const updated = (ext.hotelsMeals.additionalHotels || []).map((h, i) => i === idx ? { ...h, nights: Number(e.target.value) || 1 } : h); updateExtHotelsMeals({ additionalHotels: updated }); }} className="w-full" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Rate ($)</label>
                        <p className="text-xs text-ag-text-muted mb-1">{(ext.hotelsMeals.mode || 'perPaxPerNight') === 'perPaxPerNight' ? 'Per pax, per night' : (ext.hotelsMeals.mode || 'perPaxPerNight') === 'perNight' ? 'Per night (flat)' : (ext.hotelsMeals.mode || 'perPaxPerNight') === 'perPax' ? 'Per person, whole trip' : 'Total'}</p>
                        <NumInput value={hotel.ratePerNight} onChange={(e) => { const updated = (ext.hotelsMeals.additionalHotels || []).map((h, i) => i === idx ? { ...h, ratePerNight: Number(e.target.value) } : h); updateExtHotelsMeals({ additionalHotels: updated }); }} className="w-full" />
                      </div>
                      <div className="form-group flex items-end pb-0.5">
                        <button className="btn btn-danger text-xs" onClick={() => updateExtHotelsMeals({ additionalHotels: (ext.hotelsMeals.additionalHotels || []).filter((_, i) => i !== idx) })}>Remove</button>
                      </div>
                    </div>
                  ))}
                  <button className="btn btn-secondary text-xs mt-3" onClick={() => { const newHotel: AdditionalHotel = { id: Date.now().toString(), label: `Hotel ${(ext.hotelsMeals.additionalHotels?.length || 0) + 2}`, nights: ext.hotelsMeals.hotelNights ?? ext.extensionNights, ratePerNight: ext.hotelsMeals.hotelCostPerNight }; updateExtHotelsMeals({ additionalHotels: [...(ext.hotelsMeals.additionalHotels || []), newHotel] }); }}>+ Add Hotel</button>
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
              <div className="mt-4 pt-4 border-t border-ag-border">
                <div className="flex items-center gap-3 mb-3">
                  <label className="form-label mb-0">Staff Guide Meals Cost ($)</label>
                  <div className="flex gap-1">
                    {(['perDayPerGuide', 'perDay', 'total'] as const).map((m) => {
                      const mode = config.staffConfig.staffMealsMode || 'perDay';
                      return (
                        <button key={m} disabled className={`btn text-xs opacity-50 cursor-not-allowed ${mode === m ? 'btn-primary' : 'btn-secondary'}`}>
                          {m === 'perDayPerGuide' ? 'Per Day/Guide' : m === 'perDay' ? 'Per Day' : 'Total'}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-xs text-ag-text-muted">
                    {(config.staffConfig.staffMealsMode || 'perDay') === 'perDayPerGuide'
                      ? `(cost \u00d7 ${ext.extensionNights} nights \u00d7 guides)`
                      : (config.staffConfig.staffMealsMode || 'perDay') === 'perDay'
                      ? `(cost \u00d7 ${ext.extensionNights} extension nights)`
                      : '(entered value is total cost)'}
                  </span>
                </div>
                <NumInput type="number" value={config.staffConfig.staffMealsCost || 0} disabled className="w-48 opacity-50 cursor-not-allowed" />
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
              <div className="mt-4 pt-4 border-t border-ag-border">
                <div className="flex items-center gap-3 mb-3">
                  <label className="form-label mb-0">Staff Guide Meals Cost ($)</label>
                  <div className="flex gap-1">
                    {(['perDayPerGuide', 'perDay', 'total'] as const).map((m) => {
                      const mode = ext.staffConfig.staffMealsMode || 'perDay';
                      return (
                        <button key={m} onClick={() => updateExtStaff({ staffMealsMode: m })} className={`btn text-xs ${mode === m ? 'btn-primary' : 'btn-secondary'}`}>
                          {m === 'perDayPerGuide' ? 'Per Day/Guide' : m === 'perDay' ? 'Per Day' : 'Total'}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-xs text-ag-text-muted">
                    {(ext.staffConfig.staffMealsMode || 'perDay') === 'perDayPerGuide'
                      ? `(cost \u00d7 ${ext.extensionNights} nights \u00d7 guides)`
                      : (ext.staffConfig.staffMealsMode || 'perDay') === 'perDay'
                      ? `(cost \u00d7 ${ext.extensionNights} extension nights)`
                      : '(entered value is total cost)'}
                  </span>
                </div>
                <NumInput type="number" value={ext.staffConfig.staffMealsCost || 0} onChange={(e) => updateExtStaff({ staffMealsCost: Number(e.target.value) })} className="w-48" />
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
                <>
                  <button onClick={() => updateExtLogistics({ inheritFromMain: !ext.logisticsConfig.inheritFromMain })} className={`btn text-xs ${ext.logisticsConfig.inheritFromMain ? 'btn-secondary' : 'btn-primary'}`}>
                    {ext.logisticsConfig.inheritFromMain ? 'Match Core Inputs' : 'Custom'}
                  </button>
                  {!ext.logisticsConfig.inheritFromMain && (
                    <>
                      <button onClick={() => updateExtLogistics({ simpleMode: true })} className={`btn text-xs ${ext.logisticsConfig.simpleMode !== false ? 'btn-primary' : 'btn-secondary'}`}>Simple</button>
                      <button onClick={() => updateExtLogistics({ simpleMode: false })} className={`btn text-xs ${ext.logisticsConfig.simpleMode === false ? 'btn-primary' : 'btn-secondary'}`}>Per Pax</button>
                      <ActiveDropdown id="extLog" value={extLogEffectiveAM} onChange={v => updateExtLogistics({ activeMode: v })} openId={openDropdown} setOpenId={setOpenDropdown} />
                    </>
                  )}
                </>
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
                if (mode === 'perPax') return 'Rate \u00d7 Pax';
                if (mode === 'total') return 'Total Cost';
                return 'Rate \u00d7 Nights';
              })()}, applied to extension nights).</p>
              {config.logistics.simpleMode !== false ? (
                <div className="max-w-xs">
                  <label className="form-label">Rate (all pax)</label>
                  <NumInput type="number" value={config.logistics.baseRate ?? config.logistics.rates[0]?.rate ?? 0} disabled className="w-full opacity-50 cursor-not-allowed" />
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
              {/* Guide Logistics Rate — inherited read-only */}
              <div className="border-t border-ag-border mt-6 pt-6">
                <h3 className="text-sm font-semibold mb-3">Guide Logistics Rate</h3>
                {config.logistics.guideLogistics?.enabled === false ? (
                  <p className="text-sm text-ag-text-muted">Core guide logistics is disabled.</p>
                ) : config.logistics.guideLogistics?.simpleMode !== false ? (
                  <div className="max-w-xs">
                    <label className="form-label">Rate (all pax)</label>
                    <NumInput type="number" value={config.logistics.guideLogistics?.baseRate ?? 0} disabled className="w-full opacity-50 cursor-not-allowed" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                    {paxCounts.map((p) => {
                      const existing = config.logistics.guideLogistics?.rates?.find(r => r.pax === p);
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
            </div>
          ) : (
            <>
              <div className="mb-4">
                <div className="flex gap-2 items-center flex-wrap">
                  {(['perPaxPerDay', 'perPax', 'perDay', 'total'] as const).map((m) => {
                    const extLogMode = ext.logisticsConfig.mode || 'perDay';
                    const labels = { perPaxPerDay: 'Rate \u00d7 Pax \u00d7 Nights', perPax: 'Rate \u00d7 Pax', perDay: 'Rate \u00d7 Nights', total: 'Total Cost' };
                    return (
                      <button key={m} onClick={() => updateExtLogistics({ mode: m })} className={`btn text-xs ${extLogMode === m ? 'btn-primary' : 'btn-secondary'}`}>
                        {labels[m]}
                      </button>
                    );
                  })}
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

              {/* Guide Logistics Rate — custom editable */}
              <div className="border-t border-ag-border mt-6 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">Guide Logistics Rate</h3>
                  <div className="flex gap-2">
                    {ext.logisticsConfig.guideLogistics?.enabled !== false && (
                      <>
                        <button
                          onClick={() => updateExtGuideLogistics({ simpleMode: true })}
                          className={`btn text-xs ${ext.logisticsConfig.guideLogistics?.simpleMode !== false ? 'btn-primary' : 'btn-secondary'}`}
                        >
                          Simple
                        </button>
                        <button
                          onClick={() => updateExtGuideLogistics({ simpleMode: false })}
                          className={`btn text-xs ${ext.logisticsConfig.guideLogistics?.simpleMode === false ? 'btn-primary' : 'btn-secondary'}`}
                        >
                          Per Pax
                        </button>
                        <ActiveDropdown id="extGuideLog" value={extGuideLogEffectiveAM} onChange={v => updateExtGuideLogistics({ activeMode: v })} openId={openDropdown} setOpenId={setOpenDropdown} />
                      </>
                    )}
                    <button onClick={() => updateExtGuideLogistics({ enabled: ext.logisticsConfig.guideLogistics?.enabled === false })} className={`btn text-xs ${ext.logisticsConfig.guideLogistics?.enabled === false ? 'btn-danger' : 'btn-primary'}`}>
                      {ext.logisticsConfig.guideLogistics?.enabled === false ? 'Inactive' : 'Active'}
                    </button>
                  </div>
                </div>
                {ext.logisticsConfig.guideLogistics?.enabled === false ? (
                  <p className="text-sm text-ag-text-muted">Guide logistics disabled — guide logistics costs will not be applied.</p>
                ) : (
                  <>
                    <div className="mb-4">
                      <div className="flex gap-2 items-center flex-wrap">
                        {(['perPaxPerDay', 'perPax', 'perDay', 'total'] as const).map((m) => {
                          const guideMode = ext.logisticsConfig.guideLogistics?.mode || 'perDay';
                          const labels = { perPaxPerDay: 'Rate \u00d7 Pax \u00d7 Nights', perPax: 'Rate \u00d7 Pax', perDay: 'Rate \u00d7 Nights', total: 'Total Cost' };
                          return (
                            <button key={m} onClick={() => updateExtGuideLogistics({ mode: m })} className={`btn text-xs ${guideMode === m ? 'btn-primary' : 'btn-secondary'}`}>
                              {labels[m]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {ext.logisticsConfig.guideLogistics?.simpleMode !== false ? (
                      <div className="max-w-xs">
                        <label className="form-label">Rate (all pax)</label>
                        <NumInput
                          type="number"
                          value={ext.logisticsConfig.guideLogistics?.rates?.[0]?.rate ?? 0}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            updateExtGuideLogistics({ rates: paxCounts.map(p => ({ pax: p, rate: val })) });
                          }}
                          className="w-full"
                        />
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-ag-text-muted mb-3">Rate per pax level — use mode buttons above to control how it&apos;s applied</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                          {paxCounts.map((p) => {
                            const existing = ext.logisticsConfig.guideLogistics?.rates?.find((r: { pax: number; rate: number }) => r.pax === p);
                            const rateValue = existing ? existing.rate : 0;
                            return (
                              <div key={p} className="form-group">
                                <label className="form-label text-center">{p} pax</label>
                                <NumInput type="number" value={rateValue} onChange={(e) => {
                                  updateConfig(prev => {
                                    const gl = prev.extension.logisticsConfig.guideLogistics ?? { baseRate: 0, rates: [], mode: 'perDay' as const, simpleMode: true };
                                    const rates = (gl.rates || []).filter((r: { pax: number; rate: number }) => r.pax !== p);
                                    rates.push({ pax: p, rate: Number(e.target.value) });
                                    return { extension: { ...prev.extension, logisticsConfig: { ...prev.extension.logisticsConfig, guideLogistics: { ...gl, rates } } } } as Partial<TripConfiguration>;
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
