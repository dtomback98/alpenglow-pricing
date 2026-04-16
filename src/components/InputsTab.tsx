'use client';

import React, { useState, useEffect } from 'react';
import { TripConfiguration, StaffMember, TripSpecificCost, CustomTripCost, AdditionalHotel, EarlyBirdTier, VehicleBand, TransportVehicle } from '@/lib/types';

interface InputsTabProps {
  config: TripConfiguration;
  updateConfig: (updates: Partial<TripConfiguration> | ((prev: TripConfiguration) => Partial<TripConfiguration>), options?: { silent?: boolean }) => void;
}

type NestedConfigKey = 'extension' | 'hotelsMeals' | 'logistics' | 'staffConfig' | 'transportConfig' | 'tripSpecific' | 'singleSupplement';

// Shows empty string instead of "0" so users don't get a leading zero when they clear and retype a value
const NumInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} type="number" value={(props.value as number) || ''} />
);

interface ActiveDropdownProps {
  id: string;
  value: 'simple' | 'perPax' | 'bands';
  onChange: (v: 'simple' | 'perPax' | 'bands') => void;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  showBands?: boolean;
  showPerPax?: boolean;
}
const ActiveDropdown = ({ id, value, onChange, openId, setOpenId, showBands, showPerPax = true }: ActiveDropdownProps) => (
  <div className="relative" onClick={e => e.stopPropagation()}>
    <button
      className="btn btn-secondary text-xs flex items-center gap-1"
      onClick={() => setOpenId(openId === id ? null : id)}
    >
      Mode: {value === 'simple' ? 'Simple' : value === 'bands' ? 'Bands' : 'Per Pax'} <span className="opacity-50">▾</span>
    </button>
    {openId === id && (
      <div className="absolute right-0 top-full mt-1 z-50 min-w-[110px] rounded-md border border-ag-border bg-ag-card shadow-lg">
        <button
          className={`block w-full text-left px-3 py-2 text-xs rounded-t-md hover:bg-white/5 ${value === 'simple' ? 'text-blue-400 font-medium' : 'text-ag-text'}`}
          onClick={() => { onChange('simple'); setOpenId(null); }}
        >Simple</button>
        {showPerPax && (
          <button
            className={`block w-full text-left px-3 py-2 text-xs ${!showBands ? 'rounded-b-md' : ''} hover:bg-white/5 ${value === 'perPax' ? 'text-blue-400 font-medium' : 'text-ag-text'}`}
            onClick={() => { onChange('perPax'); setOpenId(null); }}
          >Per Pax</button>
        )}
        {showBands && (
          <button
            className={`block w-full text-left px-3 py-2 text-xs rounded-b-md hover:bg-white/5 ${value === 'bands' ? 'text-blue-400 font-medium' : 'text-ag-text'}`}
            onClick={() => { onChange('bands'); setOpenId(null); }}
          >Bands</button>
        )}
      </div>
    )}
  </div>
);

type TripSpecificFieldDef = { key: keyof Omit<TripConfiguration['tripSpecific'], 'enabled' | 'customCosts'>; label: string };

const TRIP_SPECIFIC_ALWAYS_FIELDS: TripSpecificFieldDef[] = [
  { key: 'jacketsApparel', label: 'Jackets & Apparel' },
  { key: 'contingency', label: 'Contingency' },
];

const TRIP_SPECIFIC_BUTTON_FIELDS: TripSpecificFieldDef[] = [
  { key: 'permits', label: 'Permits' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'hypoxico', label: 'Hypoxico' },
  { key: 'otherCosts', label: 'Other Costs' },
];

const ALL_TRIP_SPECIFIC_FIELDS = [...TRIP_SPECIFIC_ALWAYS_FIELDS, ...TRIP_SPECIFIC_BUTTON_FIELDS];

export default function InputsTab({ config, updateConfig }: InputsTabProps) {
  const updateNestedConfig = <K extends NestedConfigKey>(
    key: K,
    updates: Partial<TripConfiguration[K]>
  ) => {
    updateConfig(prev => ({
      [key]: { ...prev[key], ...updates },
    } as Partial<TripConfiguration>));
  };

  const updateGuideLogistics = (updates: Partial<NonNullable<TripConfiguration['logistics']['guideLogistics']>>) => {
    updateConfig(prev => {
      const gl = prev.logistics.guideLogistics ?? { baseRate: 0, rates: [], mode: 'perDay' as const, simpleMode: true };
      return { logistics: { ...prev.logistics, guideLogistics: { ...gl, ...updates } } } as Partial<TripConfiguration>;
    });
  };

  const updateTripSpecificCost = (
    field: keyof Omit<TripConfiguration['tripSpecific'], 'enabled' | 'customCosts'>,
    updates: Partial<TripSpecificCost>
  ) => {
    updateConfig(prev => ({
      tripSpecific: { ...prev.tripSpecific, [field]: { ...(prev.tripSpecific[field] as TripSpecificCost), ...updates } },
    }));
  };

  const addCustomCost = () => updateConfig(prev => ({
    tripSpecific: {
      ...prev.tripSpecific,
      customCosts: [...(prev.tripSpecific.customCosts || []), { id: crypto.randomUUID(), label: '', amount: 0, perPax: false }],
    },
  }));

  const updateCustomCost = (id: string, updates: Partial<CustomTripCost>) => updateConfig(prev => ({
    tripSpecific: {
      ...prev.tripSpecific,
      customCosts: (prev.tripSpecific.customCosts || []).map(c => c.id === id ? { ...c, ...updates } : c),
    },
  }));

  const removeCustomCost = (id: string) => updateConfig(prev => ({
    tripSpecific: {
      ...prev.tripSpecific,
      customCosts: (prev.tripSpecific.customCosts || []).filter(c => c.id !== id),
    },
  }));

  const tripSpecificMode = config.tripSpecific.mode ?? 'simple';

  const paxMin = config.paxMin || 1;
  const paxMax = config.paxMax || 16;
  const paxStep = Math.max(1, Math.round(config.paxStep || 1));

  const paxCounts: number[] = [];
  for (let p = paxMin; p <= paxMax; p += paxStep) {
    paxCounts.push(p);
  }

  const [selectedStaffPax, setSelectedStaffPax] = useState(paxMin);
  useEffect(() => { setSelectedStaffPax(paxMin); }, [paxMin]);
  useEffect(() => { setSelectedStaffPax(paxMin); }, [config.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [selectedTravelPax, setSelectedTravelPax] = useState(paxMin);
  useEffect(() => { setSelectedTravelPax(paxMin); }, [paxMin]);
  useEffect(() => { setSelectedTravelPax(paxMin); }, [config.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  useEffect(() => {
    if (!openDropdown) return;
    const close = () => setOpenDropdown(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openDropdown]);

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const toggleSection = (key: string) => setCollapsedSections(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  // Auto-sync staff days with tripDays when not using custom days
  // Uses silent:true so tab mounts don't mark the config dirty when no change occurs
  useEffect(() => {
    updateConfig(prev => {
      if (prev.staffConfig.useCustomStaffDays || prev.staffConfig.enabled === false) return {};
      const newStaffByPax: { [pax: number]: StaffMember[] } = {};
      let changed = false;
      for (const [pax, staff] of Object.entries(prev.staffConfig.staffByPax)) {
        newStaffByPax[Number(pax)] = (staff as StaffMember[]).map(s => {
          if (s.days !== prev.tripDays) changed = true;
          return { ...s, days: prev.tripDays };
        });
      }
      if (!changed) return {};
      return { staffConfig: { ...prev.staffConfig, staffByPax: newStaffByPax } };
    }, { silent: true });
  }, [config.tripDays, config.staffConfig.useCustomStaffDays, updateConfig]);
  const pricingPerPax = config.uiPreferences?.pricingPerPax ?? false;
  const pricingEffectiveAM: 'simple' | 'perPax' = config.tripPriceActiveMode ?? (config.tripPriceByPax != null ? 'perPax' : 'simple');
  const discountsPerPax = config.uiPreferences?.discountsPerPax ?? false;
  // Effective active modes: explicit setting wins; otherwise derive from existing data/view state
  const discountsEffectiveAM: 'simple' | 'perPax' = config.discountsActiveMode ?? (discountsPerPax ? 'perPax' : 'simple');
  const ssEffectiveAM: 'simple' | 'perPax' = config.singleSupplement.activeMode ?? 'simple';
  const hmEffectiveAM: 'simple' | 'perPax' = config.hotelsMeals.activeMode ?? (config.hotelsMeals.hotelCostByPax && Object.keys(config.hotelsMeals.hotelCostByPax).length > 0 ? 'perPax' : 'simple');
  const logEffectiveAM: 'simple' | 'perPax' = config.logistics.activeMode ?? (config.logistics.simpleMode !== false ? 'simple' : 'perPax');
  const glEffectiveAM: 'simple' | 'perPax' = config.logistics.guideLogistics?.activeMode ?? (config.logistics.guideLogistics?.simpleMode !== false ? 'simple' : 'perPax');
  const earlyBirdTiers = config.earlyBirdTiers || [];
  const addEarlyBirdTier = () => {
    const newTier: EarlyBirdTier = {
      id: `eb-${Date.now()}`,
      discount: 0,
      countSimple: 0,
      countByPax: Object.fromEntries(paxCounts.map(p => [p, 0])),
    };
    updateConfig({ earlyBirdTiers: [...earlyBirdTiers, newTier] });
  };
  const removeEarlyBirdTier = (id: string) => {
    updateConfig({ earlyBirdTiers: earlyBirdTiers.filter(t => t.id !== id) });
  };
  const updateEarlyBirdTier = (id: string, updates: Partial<EarlyBirdTier>) => {
    updateConfig({ earlyBirdTiers: earlyBirdTiers.map(t => t.id === id ? { ...t, ...updates } : t) });
  };
  const singleSuppPerPax = config.uiPreferences?.singleSuppPerPax ?? false;
  const hotelsMealsPerPax = config.uiPreferences?.hotelsMealsPerPax ?? false;
  const setPricingPerPax = (val: boolean) => updateConfig(prev => ({ uiPreferences: { ...prev.uiPreferences, pricingPerPax: val } }));
  const switchToPricingPerPax = () => updateConfig(prev => {
    const byPax = prev.tripPriceByPax;
    if (!byPax || Object.keys(byPax).length === 0) {
      const newPrices: { [pax: number]: number } = {};
      for (const p of paxCounts) newPrices[p] = prev.tripPrice;
      return { uiPreferences: { ...prev.uiPreferences, pricingPerPax: true }, tripPriceByPax: newPrices };
    }
    return { uiPreferences: { ...prev.uiPreferences, pricingPerPax: true } };
  });
  const setDiscountsPerPax = (val: boolean) => updateConfig(prev => ({ uiPreferences: { ...prev.uiPreferences, discountsPerPax: val } }));
  const setSingleSuppPerPax = (val: boolean) => updateConfig(prev => ({ uiPreferences: { ...prev.uiPreferences, singleSuppPerPax: val } }));

  const [selectedHMPax, setSelectedHMPax] = useState(paxMin);
  useEffect(() => { setSelectedHMPax(paxMin); }, [paxMin]);
  useEffect(() => { setSelectedHMPax(paxMin); }, [config.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const effectiveHMPax = paxCounts.includes(selectedHMPax) ? selectedHMPax : paxCounts[0] || 1;
  const [vehiclePaxSelection, setVehiclePaxSelection] = useState<{ [vehicleId: string]: number }>({});
  useEffect(() => { setVehiclePaxSelection({}); }, [config.paxMin, config.paxMax, config.paxStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-migrate legacy transport data to vehicles when a trip is loaded
  useEffect(() => {
    if (config.transportConfig.transportVehicles && config.transportConfig.transportVehicles.length > 0) return;
    const t = config.transportConfig;
    const tAM = t.activeMode ?? 'simple';
    const vehicles: TransportVehicle[] = [];
    if (tAM === 'bands' && (t.transportBands || []).length > 0) {
      vehicles.push({ id: crypto.randomUUID(), label: 'Transport', mode: 'bands', simpleRate: 0, bands: (t.transportBands || []).map(b => ({ id: b.id, minPax: b.minPax, maxPax: b.maxPax, cost: b.groundTransport + b.airportTransfers + b.localTransport })) });
    } else if (tAM === 'perPax') {
      const gtByPax = t.groundTransportByPax; const atByPax = t.airportTransfersByPax; const ltByPax = t.localTransportByPax;
      if (gtByPax && Object.values(gtByPax).some(v => v > 0)) vehicles.push({ id: crypto.randomUUID(), label: 'Ground Transport', mode: 'perPax', simpleRate: t.groundTransportTotal, perPaxRates: gtByPax, bands: [] });
      else if (t.groundTransportTotal > 0) vehicles.push({ id: crypto.randomUUID(), label: 'Ground Transport', mode: 'simple', simpleRate: t.groundTransportTotal, bands: [] });
      if (atByPax && Object.values(atByPax).some(v => v > 0)) vehicles.push({ id: crypto.randomUUID(), label: 'Helicopters', mode: 'perPax', simpleRate: t.airportTransfers, perPaxRates: atByPax, bands: [] });
      else if (t.airportTransfers > 0) vehicles.push({ id: crypto.randomUUID(), label: 'Helicopters', mode: 'simple', simpleRate: t.airportTransfers, bands: [] });
      if (ltByPax && Object.values(ltByPax).some(v => v > 0)) vehicles.push({ id: crypto.randomUUID(), label: 'Local Transport', mode: 'perPax', simpleRate: t.localTransport, perPaxRates: ltByPax, bands: [] });
      else if (t.localTransport > 0) vehicles.push({ id: crypto.randomUUID(), label: 'Local Transport', mode: 'simple', simpleRate: t.localTransport, bands: [] });
    } else {
      if (t.groundTransportTotal > 0) vehicles.push({ id: crypto.randomUUID(), label: 'Ground Transport', mode: 'simple', simpleRate: t.groundTransportTotal, bands: [] });
      if (t.airportTransfers > 0) vehicles.push({ id: crypto.randomUUID(), label: 'Helicopters', mode: 'simple', simpleRate: t.airportTransfers, bands: [] });
      if (t.localTransport > 0) vehicles.push({ id: crypto.randomUUID(), label: 'Local Transport', mode: 'simple', simpleRate: t.localTransport, bands: [] });
    }
    if (vehicles.length > 0) updateConfig(prev => ({ transportConfig: { ...prev.transportConfig, transportVehicles: vehicles } }), { silent: true });
  }, [config.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const addVehicle = () => {
    updateConfig(prev => ({ transportConfig: { ...prev.transportConfig, transportVehicles: [...(prev.transportConfig.transportVehicles || []), { id: crypto.randomUUID(), label: 'New Vehicle', mode: 'simple' as const, simpleRate: 0, bands: [] }] } }));
  };

  const removeVehicle = (id: string) => {
    updateConfig(prev => ({ transportConfig: { ...prev.transportConfig, transportVehicles: (prev.transportConfig.transportVehicles || []).filter(v => v.id !== id) } }));
  };

  const updateVehicle = (id: string, updates: Partial<TransportVehicle>) => {
    updateConfig(prev => ({ transportConfig: { ...prev.transportConfig, transportVehicles: (prev.transportConfig.transportVehicles || []).map(v => v.id === id ? { ...v, ...updates } : v) } }));
  };

  const updateVehicleMode = (vehicleId: string, mode: 'simple' | 'perPax' | 'bands') => {
    updateConfig(prev => {
      const vehicles = prev.transportConfig.transportVehicles || [];
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (!vehicle) return {};
      let extra: Partial<TransportVehicle> = {};
      if (mode === 'perPax' && (!vehicle.perPaxRates || Object.keys(vehicle.perPaxRates).length === 0)) {
        const rates: { [k: number]: number } = {};
        for (const p of paxCounts) rates[p] = vehicle.simpleRate;
        extra = { perPaxRates: rates };
      }
      return { transportConfig: { ...prev.transportConfig, transportVehicles: vehicles.map(v => v.id === vehicleId ? { ...v, mode, ...extra } : v) } };
    });
  };

  const addVehicleBand = (vehicleId: string) => {
    updateConfig(prev => {
      const vehicles = prev.transportConfig.transportVehicles || [];
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (!vehicle) return {};
      const lastMax = vehicle.bands.length > 0 ? (vehicle.bands[vehicle.bands.length - 1].maxPax ?? null) : null;
      const newBand: VehicleBand = { id: crypto.randomUUID(), minPax: lastMax !== null ? lastMax + 1 : paxMin, maxPax: null, cost: 0 };
      return { transportConfig: { ...prev.transportConfig, transportVehicles: vehicles.map(v => v.id === vehicleId ? { ...v, bands: [...v.bands, newBand] } : v) } };
    });
  };

  const removeVehicleBand = (vehicleId: string, bandId: string) => {
    updateConfig(prev => ({ transportConfig: { ...prev.transportConfig, transportVehicles: (prev.transportConfig.transportVehicles || []).map(v => v.id === vehicleId ? { ...v, bands: v.bands.filter(b => b.id !== bandId) } : v) } }));
  };

  const updateVehicleBand = (vehicleId: string, bandId: string, updates: Partial<VehicleBand>) => {
    updateConfig(prev => ({ transportConfig: { ...prev.transportConfig, transportVehicles: (prev.transportConfig.transportVehicles || []).map(v => v.id === vehicleId ? { ...v, bands: v.bands.map(b => b.id === bandId ? { ...b, ...updates } : b) } : v) } }));
  };

  const updateVehiclePerPaxRate = (vehicleId: string, pax: number, rate: number) => {
    updateConfig(prev => ({
      transportConfig: {
        ...prev.transportConfig,
        transportVehicles: (prev.transportConfig.transportVehicles || []).map(v =>
          v.id === vehicleId ? { ...v, perPaxRates: { ...v.perPaxRates, [pax]: rate } } : v
        ),
      },
    }));
  };

  const copyVehicleToAllPax = (vehicleId: string) => {
    updateConfig(prev => {
      const vehicles = prev.transportConfig.transportVehicles || [];
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (!vehicle) return {};
      const selPax = vehiclePaxSelection[vehicleId] ?? paxMin;
      const effPax = paxCounts.includes(selPax) ? selPax : (paxCounts[0] || 1);
      const rate = vehicle.perPaxRates?.[effPax] ?? vehicle.simpleRate;
      const rates: { [k: number]: number } = {};
      for (const p of paxCounts) rates[p] = rate;
      return { transportConfig: { ...prev.transportConfig, transportVehicles: vehicles.map(v => v.id === vehicleId ? { ...v, perPaxRates: rates } : v) } };
    });
  };

  const toggleHotelsMealsPerPax = (val: boolean) => {
    if (val) {
      // Switching to per-pax: initialize byPax from flat rates if empty
      updateConfig(prev => {
        const hm = prev.hotelsMeals;
        const needsInit = !hm.hotelCostByPax || Object.keys(hm.hotelCostByPax).length === 0;
        if (!needsInit) return { uiPreferences: { ...prev.uiPreferences, hotelsMealsPerPax: true } };
        const hotelByPax: { [k: number]: number } = {};
        const additionalByPax: { [k: number]: number } = {};
        for (const p of paxCounts) {
          hotelByPax[p] = hm.hotelCostPerNight;
          additionalByPax[p] = hm.additionalMealCosts;
        }
        return {
          uiPreferences: { ...prev.uiPreferences, hotelsMealsPerPax: true },
          hotelsMeals: { ...hm, hotelCostByPax: hotelByPax, additionalMealCostsByPax: additionalByPax },
        };
      });
    } else {
      // View-only switch: preserve byPax data, just change which editor is shown
      updateConfig(prev => ({ uiPreferences: { ...prev.uiPreferences, hotelsMealsPerPax: false } }));
    }
  };

  const copyHMHotelsToAll = () => {
    updateConfig(prev => {
      const hm = prev.hotelsMeals;
      const hotel = hm.hotelCostByPax?.[effectiveHMPax] ?? hm.hotelCostPerNight;
      const additional = hm.additionalMealCostsByPax?.[effectiveHMPax] ?? hm.additionalMealCosts;
      const hotelByPax: { [k: number]: number } = {};
      const additionalByPax: { [k: number]: number } = {};
      for (const pp of paxCounts) { hotelByPax[pp] = hotel; additionalByPax[pp] = additional; }
      return { hotelsMeals: { ...hm, hotelCostByPax: hotelByPax, additionalMealCostsByPax: additionalByPax } };
    });
  };



  // Logistics simple-view toggle: migrate baseRate from rates[0] on first switch if baseRate is 0
  const setLogisticsSimpleView = (simple: boolean) => {
    if (simple && (config.logistics.baseRate === 0) && (config.logistics.rates[0]?.rate ?? 0) > 0) {
      updateNestedConfig('logistics', { simpleMode: true, baseRate: config.logistics.rates[0].rate });
    } else {
      updateNestedConfig('logistics', { simpleMode: simple });
    }
  };
  const setGuideLogisticsSimpleView = (simple: boolean) => {
    const gl = config.logistics.guideLogistics;
    if (simple && (gl?.rates[0]?.rate ?? 0) > 0 && !gl?.baseRate) {
      updateConfig(prev => {
        const g = prev.logistics.guideLogistics ?? { baseRate: 0, rates: [], mode: 'perDay' as const };
        return { logistics: { ...prev.logistics, guideLogistics: { ...g, simpleMode: true, baseRate: g.rates[0]?.rate ?? 0 } } };
      });
    } else {
      updateConfig(prev => {
        const g = prev.logistics.guideLogistics ?? { baseRate: 0, rates: [], mode: 'perDay' as const };
        return { logistics: { ...prev.logistics, guideLogistics: { ...g, simpleMode: simple } } };
      });
    }
  };

  const effectiveStaffPax = paxCounts.includes(selectedStaffPax) ? selectedStaffPax : paxCounts[0] || 1;
  const effectiveTravelPax = paxCounts.includes(selectedTravelPax) ? selectedTravelPax : paxCounts[0] || 1;

  const currentStaff = config.staffConfig.staffByPax[effectiveStaffPax] || [
    { role: 'Lead Guide', dailyRate: 400, days: config.tripDays, quantity: 1 },
  ];

  const updateStaffMember = (index: number, updates: Partial<StaffMember>) => {
    updateConfig(prev => {
      const staff = prev.staffConfig.staffByPax[effectiveStaffPax] || [{ role: 'Lead Guide', dailyRate: 400, days: prev.tripDays, quantity: 1 }];
      const newStaff = [...staff];
      newStaff[index] = { ...newStaff[index], ...updates };
      return { staffConfig: { ...prev.staffConfig, staffByPax: { ...prev.staffConfig.staffByPax, [effectiveStaffPax]: newStaff } } };
    });
  };

  const addStaffMember = () => {
    updateConfig(prev => {
      const staff = prev.staffConfig.staffByPax[effectiveStaffPax] || [{ role: 'Lead Guide', dailyRate: 400, days: prev.tripDays, quantity: 1 }];
      const newStaff = [...staff, { role: 'New Role', dailyRate: 200, days: prev.tripDays, quantity: 1 }];
      return { staffConfig: { ...prev.staffConfig, staffByPax: { ...prev.staffConfig.staffByPax, [effectiveStaffPax]: newStaff } } };
    });
  };

  const removeStaffMember = (index: number) => {
    updateConfig(prev => {
      const staff = prev.staffConfig.staffByPax[effectiveStaffPax] || [];
      const newStaff = staff.filter((_: StaffMember, i: number) => i !== index);
      return { staffConfig: { ...prev.staffConfig, staffByPax: { ...prev.staffConfig.staffByPax, [effectiveStaffPax]: newStaff } } };
    });
  };

  const copyStaffToAll = () => {
    updateConfig(prev => {
      const staff = prev.staffConfig.staffByPax[effectiveStaffPax] || [{ role: 'Lead Guide', dailyRate: 400, days: prev.tripDays, quantity: 1 }];
      const newStaffByPax: { [pax: number]: StaffMember[] } = {};
      for (const p of paxCounts) {
        newStaffByPax[p] = staff.map((s: StaffMember) => ({ ...s }));
      }
      return { staffConfig: { ...prev.staffConfig, staffByPax: newStaffByPax } };
    });
  };

  const copyTravelToAll = () => {
    updateConfig(prev => {
      const sc = prev.staffConfig;
      const p = effectiveTravelPax;
      const flightCount = sc.guideFlightCountByPax?.[p] ?? 0;
      const flightCost = sc.guideFlightCostByPax?.[p] ?? sc.guideFlightCost ?? 0;
      const travelDays = sc.travelDaysByPax?.[p] ?? sc.travelDays;
      const travelDayRate = sc.travelDayRateByPax?.[p] ?? sc.travelDayRate;
      const mealsCost = sc.staffMealsCostByPax?.[p] ?? sc.staffMealsCost ?? 0;
      const newFlightCount: { [k: number]: number } = {};
      const newFlightCost: { [k: number]: number } = {};
      const newTravelDays: { [k: number]: number } = {};
      const newTravelDayRate: { [k: number]: number } = {};
      const newMealsCost: { [k: number]: number } = {};
      for (const pp of paxCounts) {
        newFlightCount[pp] = flightCount;
        newFlightCost[pp] = flightCost;
        newTravelDays[pp] = travelDays;
        newTravelDayRate[pp] = travelDayRate;
        newMealsCost[pp] = mealsCost;
      }
      return {
        staffConfig: {
          ...sc,
          guideFlightCountByPax: newFlightCount,
          guideFlightCostByPax: newFlightCost,
          travelDaysByPax: newTravelDays,
          travelDayRateByPax: newTravelDayRate,
          staffMealsCostByPax: newMealsCost,
        }
      };
    });
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button onClick={() => toggleSection('core')} className="text-ag-text-muted hover:text-ag-text text-sm mr-2">{collapsedSections.has('core') ? '▶' : '▼'}</button>
            <h2 className="text-lg font-semibold">Core Trip Details</h2>
          </div>
          <div className="flex gap-2">
            <ActiveDropdown id="pricing" value={pricingEffectiveAM} onChange={v => { if (v === 'perPax') switchToPricingPerPax(); else setPricingPerPax(false); updateConfig({ tripPriceActiveMode: v as 'simple' | 'perPax' }); }} openId={openDropdown} setOpenId={setOpenDropdown} />
          </div>
        </div>
        {!collapsedSections.has('core') && (<>
        {!pricingPerPax ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label">Trip Price ($)</label>
              <p className="text-xs text-ag-text-muted mb-1">
                {config.tripPriceMode === 'total' ? 'Total revenue for entire trip' : 'Per person for entire trip'}
              </p>
              <NumInput type="number" value={config.tripPrice} onChange={(e) => {
                updateConfig({ tripPrice: Number(e.target.value), tripPriceByPax: undefined });
              }} className="w-full" />
              <div className="flex gap-1 mt-2">
                <button onClick={() => updateConfig({ tripPriceMode: undefined })} className={`btn text-xs ${config.tripPriceMode !== 'total' ? 'btn-primary' : 'btn-secondary'}`}>Per Person</button>
                <button onClick={() => updateConfig({ tripPriceMode: 'total' })} className={`btn text-xs ${config.tripPriceMode === 'total' ? 'btn-primary' : 'btn-secondary'}`}>Total for Trip</button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Trip Days</label>
              <p className="text-xs text-ag-text-muted mb-1">&nbsp;</p>
              <NumInput type="number" value={config.tripDays} onChange={(e) => updateConfig({ tripDays: Number(e.target.value) })} className="w-full" />
            </div>
            <div className="form-group">
              <label className="form-label">Trip Nights</label>
              <p className="text-xs text-ag-text-muted mb-1">&nbsp;</p>
              <NumInput type="number" value={config.tripNights} onChange={(e) => updateConfig({ tripNights: Number(e.target.value) })} className="w-full" />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="form-group">
                <label className="form-label">Trip Days</label>
                <NumInput type="number" value={config.tripDays} onChange={(e) => updateConfig({ tripDays: Number(e.target.value) })} className="w-full" />
              </div>
              <div className="form-group">
                <label className="form-label">Trip Nights</label>
                <NumInput type="number" value={config.tripNights} onChange={(e) => updateConfig({ tripNights: Number(e.target.value) })} className="w-full" />
              </div>
            </div>
            <div className="flex items-center justify-between mb-2">
              <label className="form-label mb-0">Price by Pax Level ($ per person)</label>
              <button onClick={() => {
                const baseVal = config.tripPriceByPax?.[paxCounts[0]] ?? config.tripPrice;
                const newPrices: { [pax: number]: number } = {};
                for (const p of paxCounts) newPrices[p] = baseVal;
                updateConfig({ tripPriceByPax: newPrices });
              }} className="btn btn-secondary text-xs">Apply First to All</button>
            </div>
            <p className="text-xs text-ag-text-muted mb-2">Set a different price per person at each group size</p>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {paxCounts.map((p) => (
                <div key={p} className="form-group">
                  <label className="form-label text-center">{p} pax</label>
                  <NumInput type="number" value={config.tripPriceByPax?.[p] ?? config.tripPrice} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ tripPriceByPax: { ...prev.tripPriceByPax, [p]: val } })); }} className="w-full text-center" />
                </div>
              ))}
            </div>
          </>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-ag-border">
          <div className="form-group">
            <label className="form-label">Min Pax</label>
            <NumInput type="number" min="1" value={paxMin} onChange={(e) => updateConfig(prev => ({ paxMin: Math.max(1, Math.min(Number(e.target.value), prev.paxMax)) }))} className="w-full" />
          </div>
          <div className="form-group">
            <label className="form-label">Max Pax</label>
            <NumInput type="number" min="1" value={paxMax} onChange={(e) => updateConfig({ paxMax: Math.max(paxMin, Number(e.target.value)) })} className="w-full" />
          </div>
          <div className="form-group">
            <label className="form-label">Pax Step</label>
            <NumInput type="number" min="1" value={paxStep} onChange={(e) => updateConfig({ paxStep: Math.max(1, Math.round(Number(e.target.value) || 1)) })} className="w-full" />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-ag-border">
          <div className="form-group w-48">
            <label className="form-label">Inflation Rate (%)</label>
            <p className="text-xs text-ag-text-muted mb-1">Applied to all cost items</p>
            <NumInput type="number" step="0.1" min="-100" max="1000" value={parseFloat(((config.inflationRate || 0) * 100).toFixed(1))} onChange={(e) => updateConfig({ inflationRate: Number(e.target.value) / 100 })} className="w-full" />
          </div>
        </div>
        </>)}
      </div>

      {/* Discounts */}
      <div className={`card ${config.discountsEnabled === false ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button onClick={() => toggleSection('discounts')} className="text-ag-text-muted hover:text-ag-text text-sm mr-2">{collapsedSections.has('discounts') ? '▶' : '▼'}</button>
            <h2 className="text-lg font-semibold">Discounts</h2>
          </div>
          <div className="flex gap-2">
            {config.discountsEnabled !== false && (
              <>
                <ActiveDropdown id="discounts" value={discountsEffectiveAM} onChange={v => { setDiscountsPerPax(v === 'perPax'); updateConfig({ discountsActiveMode: v as 'simple' | 'perPax' }); }} openId={openDropdown} setOpenId={setOpenDropdown} />
              </>
            )}
            <button onClick={() => updateConfig({ discountsEnabled: config.discountsEnabled === false })} className={`btn text-xs ${config.discountsEnabled === false ? 'btn-danger' : 'btn-primary'}`}>
              {config.discountsEnabled === false ? 'Inactive' : 'Active'}
            </button>
          </div>
        </div>
        {!collapsedSections.has('discounts') && (config.discountsEnabled === false ? (
          <p className="text-sm text-ag-text-muted">Section disabled — discounts will not be applied to calculations.</p>
        ) : (
          <>
            {!discountsPerPax ? (
              <>
                {/* Simple mode: rate + count side by side — counts write to scalar fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Loyalty Discount Rate (%)</label>
                    <p className="text-xs text-ag-text-muted mb-1">% discount on trip price per loyalty guest</p>
                    <NumInput type="number" step="0.01" value={parseFloat((config.loyaltyDiscountRate * 100).toFixed(1))} onChange={(e) => updateConfig({ loyaltyDiscountRate: Number(e.target.value) / 100 })} className="w-full" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Loyalty Count</label>
                    <p className="text-xs text-ag-text-muted mb-1">Same count for all group sizes</p>
                    <NumInput type="number" min="0" value={config.loyaltyCountSimple ?? 0} onChange={(e) => updateConfig({ loyaltyCountSimple: Number(e.target.value) })} className="w-full" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="form-group">
                    <label className="form-label">Early Bird Discount ($)</label>
                    <p className="text-xs text-ag-text-muted mb-1">Amount discounted per early bird guest</p>
                    <NumInput type="number" value={config.earlyBirdDiscount} onChange={(e) => updateConfig({ earlyBirdDiscount: Number(e.target.value) })} className="w-full" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Early Bird Count</label>
                    <p className="text-xs text-ag-text-muted mb-1">Same count for all group sizes</p>
                    <NumInput type="number" min="0" value={config.earlyBirdCountSimple ?? 0} onChange={(e) => updateConfig({ earlyBirdCountSimple: Number(e.target.value) })} className="w-full" />
                  </div>
                </div>
                {earlyBirdTiers.map((tier, idx) => (
                  <div key={tier.id} className="mt-4 pt-4 border-t border-ag-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">Early Bird {idx + 2}</span>
                      <button className="btn btn-danger text-xs" onClick={() => removeEarlyBirdTier(tier.id)}>Remove</button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="form-group">
                        <label className="form-label">Early Bird {idx + 2} Discount ($)</label>
                        <p className="text-xs text-ag-text-muted mb-1">Amount discounted per guest</p>
                        <NumInput type="number" value={tier.discount} onChange={(e) => updateEarlyBirdTier(tier.id, { discount: Number(e.target.value) })} className="w-full" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Early Bird {idx + 2} Count</label>
                        <p className="text-xs text-ag-text-muted mb-1">Same count for all group sizes</p>
                        <NumInput type="number" min="0" value={tier.countSimple ?? 0} onChange={(e) => updateEarlyBirdTier(tier.id, { countSimple: Number(e.target.value) })} className="w-full" />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="mt-4">
                  <button className="btn btn-secondary text-xs" onClick={addEarlyBirdTier}>+ Early Bird</button>
                </div>
              </>
            ) : (
              <>
                {/* Per-pax mode: rate on left, count grid on right */}
                <div className="flex gap-6 items-start">
                  <div className="form-group w-40 shrink-0">
                    <label className="form-label">Loyalty Rate (%)</label>
                    <p className="text-xs text-ag-text-muted mb-1">% discount per loyalty guest</p>
                    <NumInput type="number" step="0.01" value={parseFloat((config.loyaltyDiscountRate * 100).toFixed(1))} onChange={(e) => updateConfig({ loyaltyDiscountRate: Number(e.target.value) / 100 })} className="w-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <label className="form-label mb-0">Loyalty Count by Pax</label>
                      <button onClick={() => updateConfig({ loyaltyCountByPax: applyToAllPax(config.loyaltyCountByPax, 0) })} className="btn btn-secondary text-xs">Apply First to All</button>
                    </div>
                    <p className="text-xs text-ag-text-muted mb-2">How many guests get the loyalty discount at each group size</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                      {paxCounts.map((p) => (
                        <div key={p}>
                          <label className="text-xs text-ag-text-muted text-center block mb-1">{p} pax</label>
                          <NumInput type="number" min="0" value={config.loyaltyCountByPax?.[p] || 0} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ loyaltyCountByPax: { ...prev.loyaltyCountByPax, [p]: val } })); }} className="w-full text-center" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-ag-border flex gap-6 items-start">
                  <div className="form-group w-40 shrink-0">
                    <label className="form-label">Early Bird Discount ($)</label>
                    <p className="text-xs text-ag-text-muted mb-1">Amount per early bird guest</p>
                    <NumInput type="number" value={config.earlyBirdDiscount} onChange={(e) => updateConfig({ earlyBirdDiscount: Number(e.target.value) })} className="w-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <label className="form-label mb-0">Early Bird Count by Pax</label>
                      <button onClick={() => updateConfig({ earlyBirdCountByPax: applyToAllPax(config.earlyBirdCountByPax, 0) })} className="btn btn-secondary text-xs">Apply First to All</button>
                    </div>
                    <p className="text-xs text-ag-text-muted mb-2">How many guests get the early bird discount at each group size</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                      {paxCounts.map((p) => (
                        <div key={p}>
                          <label className="text-xs text-ag-text-muted text-center block mb-1">{p} pax</label>
                          <NumInput type="number" min="0" value={config.earlyBirdCountByPax?.[p] || 0} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ earlyBirdCountByPax: { ...prev.earlyBirdCountByPax, [p]: val } })); }} className="w-full text-center" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {earlyBirdTiers.map((tier, idx) => (
                  <div key={tier.id} className="mt-4 pt-4 border-t border-ag-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">Early Bird {idx + 2}</span>
                      <button className="btn btn-danger text-xs" onClick={() => removeEarlyBirdTier(tier.id)}>Remove</button>
                    </div>
                    <div className="flex gap-6 items-start">
                      <div className="form-group w-40 shrink-0">
                        <label className="form-label">EB{idx + 2} Discount ($)</label>
                        <p className="text-xs text-ag-text-muted mb-1">Amount per guest</p>
                        <NumInput type="number" value={tier.discount} onChange={(e) => updateEarlyBirdTier(tier.id, { discount: Number(e.target.value) })} className="w-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <label className="form-label mb-0">Early Bird {idx + 2} Count by Pax</label>
                          <button onClick={() => updateEarlyBirdTier(tier.id, { countByPax: applyToAllPax(tier.countByPax, 0) })} className="btn btn-secondary text-xs">Apply First to All</button>
                        </div>
                        <p className="text-xs text-ag-text-muted mb-2">How many guests get this discount at each group size</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                          {paxCounts.map((p) => (
                            <div key={p}>
                              <label className="text-xs text-ag-text-muted text-center block mb-1">{p} pax</label>
                              <NumInput type="number" min="0" value={tier.countByPax?.[p] || 0} onChange={(e) => { const val = Number(e.target.value); updateEarlyBirdTier(tier.id, { countByPax: { ...tier.countByPax, [p]: val } }); }} className="w-full text-center" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="mt-4">
                  <button className="btn btn-secondary text-xs" onClick={addEarlyBirdTier}>+ Early Bird</button>
                </div>
              </>
            )}
          </>
        ))}
      </div>

      {/* Single Supplement */}
      <div className={`card ${config.singleSupplement.enabled === false ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button onClick={() => toggleSection('singleSupp')} className="text-ag-text-muted hover:text-ag-text text-sm mr-2">{collapsedSections.has('singleSupp') ? '▶' : '▼'}</button>
            <h2 className="text-lg font-semibold">Single Supplement</h2>
          </div>
          <div className="flex gap-2">
            {config.singleSupplement.enabled !== false && (
              <>
                <ActiveDropdown id="singleSupp" value={ssEffectiveAM} onChange={v => { setSingleSuppPerPax(v === 'perPax'); updateNestedConfig('singleSupplement', { activeMode: v as 'simple' | 'perPax' }); }} openId={openDropdown} setOpenId={setOpenDropdown} />
              </>
            )}
            <button onClick={() => updateNestedConfig('singleSupplement', { enabled: config.singleSupplement.enabled === false })} className={`btn text-xs ${config.singleSupplement.enabled === false ? 'btn-danger' : 'btn-primary'}`}>
              {config.singleSupplement.enabled === false ? 'Inactive' : 'Active'}
            </button>
          </div>
        </div>
        {!collapsedSections.has('singleSupp') && (config.singleSupplement.enabled === false ? (
          <p className="text-sm text-ag-text-muted">Section disabled — single supplement will not be applied to calculations.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Single Supplement Price ($)</label>
                <p className="text-xs text-ag-text-muted mb-1">Amount charged to guest</p>
                <NumInput type="number" value={config.singleSupplement.singleSupplement} onChange={(e) => updateNestedConfig('singleSupplement', { singleSupplement: Number(e.target.value) })} className="w-full" />
              </div>
              <div className="form-group">
                <label className="form-label">Single Room Extra Cost ($)</label>
                <p className="text-xs text-ag-text-muted mb-1">Extra cost per night for single room</p>
                <NumInput type="number" value={config.singleSupplement.singleRoomExtra} onChange={(e) => updateNestedConfig('singleSupplement', { singleRoomExtra: Number(e.target.value) })} className="w-full" />
              </div>
            </div>
            {!singleSuppPerPax ? (
              <div className="mt-4 pt-4 border-t border-ag-border">
                <div className="form-group w-48">
                  <label className="form-label">Number of Guests</label>
                  <p className="text-xs text-ag-text-muted mb-1">Same count for all group sizes</p>
                  <NumInput type="number" min="0" value={config.singleSupplement.countSimple ?? 0} onChange={(e) => updateNestedConfig('singleSupplement', { countSimple: Number(e.target.value) })} className="w-full" />
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
                      <NumInput type="number" min="0" value={config.singleSupplement.countByPax?.[p] ?? 0} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ singleSupplement: { ...prev.singleSupplement, countByPax: { ...prev.singleSupplement.countByPax, [p]: val } } })); }} className="w-full text-center" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ))}
      </div>

      {/* Hotels & Meals */}
      <div className={`card ${config.hotelsMeals.enabled === false ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button onClick={() => toggleSection('hotels')} className="text-ag-text-muted hover:text-ag-text text-sm mr-2">{collapsedSections.has('hotels') ? '▶' : '▼'}</button>
            <h2 className="text-lg font-semibold">Hotels & Meals</h2>
          </div>
          <div className="flex gap-2">
            {config.hotelsMeals.enabled !== false && (
              <>
                <ActiveDropdown id="hotels" value={hmEffectiveAM} onChange={v => { toggleHotelsMealsPerPax(v === 'perPax'); updateNestedConfig('hotelsMeals', { activeMode: v as 'simple' | 'perPax' }); }} openId={openDropdown} setOpenId={setOpenDropdown} />
              </>
            )}
            <button onClick={() => updateNestedConfig('hotelsMeals', { enabled: config.hotelsMeals.enabled === false })} className={`btn text-xs ${config.hotelsMeals.enabled === false ? 'btn-danger' : 'btn-primary'}`}>
              {config.hotelsMeals.enabled === false ? 'Inactive' : 'Active'}
            </button>
          </div>
        </div>
        {!collapsedSections.has('hotels') && (config.hotelsMeals.enabled === false ? (
          <p className="text-sm text-ag-text-muted">Section disabled — hotels & meals will not be applied to calculations.</p>
        ) : (
          <>
            <div className="mb-4">
              <div className="flex gap-2 items-center">
                {(['perPaxPerNight', 'perNight', 'perPax', 'total'] as const).map((m) => {
                  const hmMode = config.hotelsMeals.mode || 'perPaxPerNight';
                  const labels = { perPaxPerNight: 'Rate \u00d7 Pax \u00d7 Nights', perNight: 'Rate \u00d7 Nights', perPax: 'Rate \u00d7 Pax', total: 'Total Cost' };
                  return (
                    <button key={m} onClick={() => updateNestedConfig('hotelsMeals', { mode: m })} className={`btn text-xs ${hmMode === m ? 'btn-primary' : 'btn-secondary'}`}>
                      {labels[m]}
                    </button>
                  );
                })}
                <span className="text-xs text-ag-text-muted ml-2">
                  {(() => {
                    const mode = config.hotelsMeals.mode || 'perPaxPerNight';
                    if (mode === 'perPaxPerNight') return '(rate \u00d7 pax \u00d7 nights/days)';
                    if (mode === 'perNight') return '(rate \u00d7 nights/days)';
                    if (mode === 'perPax') return '(rate \u00d7 pax, whole-trip per-person cost)';
                    return '(entered value is total cost)';
                  })()}
                </span>
              </div>
            </div>
            {!hotelsMealsPerPax ? (
              <>
                {/* Hotel 1 */}
                <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 mb-2 items-end">
                  <div className="form-group mb-0">
                    <label className="form-label">Hotel 1 — Name</label>
                    <input type="text" value={config.hotelsMeals.hotelLabel || ''} onChange={(e) => updateNestedConfig('hotelsMeals', { hotelLabel: e.target.value })} className="w-full" placeholder="Hotel 1" />
                  </div>
                  <div className="form-group mb-0">
                    <label className="form-label">Nights</label>
                    <NumInput value={config.hotelsMeals.hotelNights ?? config.tripNights} onChange={(e) => updateNestedConfig('hotelsMeals', { hotelNights: Number(e.target.value) || 1 })} className="w-full" />
                  </div>
                  <div className="form-group mb-0">
                    <label className="form-label">Rate ($)</label>
                    <NumInput type="number" value={config.hotelsMeals.hotelCostPerNight} onChange={(e) => updateNestedConfig('hotelsMeals', { hotelCostPerNight: Number(e.target.value) })} className="w-full" />
                  </div>
                  <div className="w-16" />
                </div>
                {/* Additional hotels */}
                {(config.hotelsMeals.additionalHotels || []).map((hotel, idx) => (
                  <div key={hotel.id} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 mb-2 items-end">
                    <div className="form-group mb-0">
                      <label className="form-label">Hotel {idx + 2} — Name</label>
                      <input type="text" value={hotel.label} onChange={(e) => { const updated = (config.hotelsMeals.additionalHotels || []).map((h, i) => i === idx ? { ...h, label: e.target.value } : h); updateNestedConfig('hotelsMeals', { additionalHotels: updated }); }} className="w-full" />
                    </div>
                    <div className="form-group mb-0">
                      <label className="form-label">Nights</label>
                      <NumInput value={hotel.nights} onChange={(e) => { const updated = (config.hotelsMeals.additionalHotels || []).map((h, i) => i === idx ? { ...h, nights: Number(e.target.value) || 1 } : h); updateNestedConfig('hotelsMeals', { additionalHotels: updated }); }} className="w-full" />
                    </div>
                    <div className="form-group mb-0">
                      <label className="form-label">Rate ($)</label>
                      <NumInput value={hotel.ratePerNight} onChange={(e) => { const updated = (config.hotelsMeals.additionalHotels || []).map((h, i) => i === idx ? { ...h, ratePerNight: Number(e.target.value) } : h); updateNestedConfig('hotelsMeals', { additionalHotels: updated }); }} className="w-full" />
                    </div>
                    <div className="flex items-end pb-0.5">
                      <button className="btn btn-danger text-xs" onClick={() => updateNestedConfig('hotelsMeals', { additionalHotels: (config.hotelsMeals.additionalHotels || []).filter((_, i) => i !== idx) })}>Remove</button>
                    </div>
                  </div>
                ))}
                <button className="btn btn-secondary text-xs mt-2" onClick={() => { const newHotel: AdditionalHotel = { id: Date.now().toString(), label: `Hotel ${(config.hotelsMeals.additionalHotels?.length || 0) + 2}`, nights: config.hotelsMeals.hotelNights ?? config.tripNights, ratePerNight: config.hotelsMeals.hotelCostPerNight }; updateNestedConfig('hotelsMeals', { additionalHotels: [...(config.hotelsMeals.additionalHotels || []), newHotel] }); }}>+ Add Hotel</button>
                {/* Additional Meal Costs — follows hotel mode */}
                {(() => {
                  const m = config.hotelsMeals.mode || 'perPaxPerNight';
                  const hint = m === 'perPaxPerNight' ? 'Per person, per night' : m === 'perNight' ? 'Per night (flat)' : m === 'perPax' ? 'Per person, whole trip' : 'Flat total for entire trip';
                  return (
                    <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 mt-3 items-end">
                      <div className="form-group mb-0">
                        <label className="form-label">Additional Meal Costs ($)</label>
                        <p className="text-xs text-ag-text-muted mb-1">{hint}</p>
                        <NumInput type="number" value={config.hotelsMeals.additionalMealCosts} onChange={(e) => updateNestedConfig('hotelsMeals', { additionalMealCosts: Number(e.target.value) })} className="w-full" />
                      </div>
                      <div className="col-span-3" />
                    </div>
                  );
                })()}
              </>
            ) : (
              <>
                <div className="flex gap-2 flex-wrap items-center mb-3">
                  {paxCounts.map((p) => (
                    <button key={p} onClick={() => setSelectedHMPax(p)} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${selectedHMPax === p ? 'bg-ag-accent text-white' : 'bg-ag-card-lighter text-ag-text-muted hover:text-ag-text'}`}>
                      {p} pax
                    </button>
                  ))}
                  <button onClick={copyHMHotelsToAll} className="btn btn-secondary text-xs">Copy to All Pax</button>
                </div>
                {/* Hotel 1 */}
                <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 mb-2 items-end">
                  <div className="form-group mb-0">
                    <label className="form-label">Hotel 1 — Name</label>
                    <input type="text" value={config.hotelsMeals.hotelLabel || ''} onChange={(e) => updateNestedConfig('hotelsMeals', { hotelLabel: e.target.value })} className="w-full" placeholder="Hotel 1" />
                  </div>
                  <div className="form-group mb-0">
                    <label className="form-label">Nights</label>
                    <NumInput value={config.hotelsMeals.hotelNights ?? config.tripNights} onChange={(e) => updateNestedConfig('hotelsMeals', { hotelNights: Number(e.target.value) || 1 })} className="w-full" />
                  </div>
                  <div className="form-group mb-0">
                    <label className="form-label">Rate ($)</label>
                    <NumInput type="number" value={config.hotelsMeals.hotelCostByPax?.[effectiveHMPax] ?? config.hotelsMeals.hotelCostPerNight} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ hotelsMeals: { ...prev.hotelsMeals, hotelCostByPax: { ...prev.hotelsMeals.hotelCostByPax, [effectiveHMPax]: val } } })); }} className="w-full" />
                  </div>
                  <div className="w-16" />
                </div>
                {/* Additional hotels */}
                {(config.hotelsMeals.additionalHotels || []).map((hotel, idx) => (
                  <div key={hotel.id} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 mb-2 items-end">
                    <div className="form-group mb-0">
                      <label className="form-label">Hotel {idx + 2} — Name</label>
                      <input type="text" value={hotel.label} onChange={(e) => { const updated = (config.hotelsMeals.additionalHotels || []).map((h, i) => i === idx ? { ...h, label: e.target.value } : h); updateNestedConfig('hotelsMeals', { additionalHotels: updated }); }} className="w-full" />
                    </div>
                    <div className="form-group mb-0">
                      <label className="form-label">Nights</label>
                      <NumInput value={hotel.nights} onChange={(e) => { const updated = (config.hotelsMeals.additionalHotels || []).map((h, i) => i === idx ? { ...h, nights: Number(e.target.value) || 1 } : h); updateNestedConfig('hotelsMeals', { additionalHotels: updated }); }} className="w-full" />
                    </div>
                    <div className="form-group mb-0">
                      <label className="form-label">Rate ($)</label>
                      <NumInput value={hotel.ratePerNight} onChange={(e) => { const updated = (config.hotelsMeals.additionalHotels || []).map((h, i) => i === idx ? { ...h, ratePerNight: Number(e.target.value) } : h); updateNestedConfig('hotelsMeals', { additionalHotels: updated }); }} className="w-full" />
                    </div>
                    <div className="flex items-end pb-0.5">
                      <button className="btn btn-danger text-xs" onClick={() => updateNestedConfig('hotelsMeals', { additionalHotels: (config.hotelsMeals.additionalHotels || []).filter((_, i) => i !== idx) })}>Remove</button>
                    </div>
                  </div>
                ))}
                <button className="btn btn-secondary text-xs mt-2" onClick={() => { const newHotel: AdditionalHotel = { id: Date.now().toString(), label: `Hotel ${(config.hotelsMeals.additionalHotels?.length || 0) + 2}`, nights: config.hotelsMeals.hotelNights ?? config.tripNights, ratePerNight: config.hotelsMeals.hotelCostPerNight }; updateNestedConfig('hotelsMeals', { additionalHotels: [...(config.hotelsMeals.additionalHotels || []), newHotel] }); }}>+ Add Hotel</button>
                {/* Additional Meal Costs — follows hotel mode */}
                {(() => {
                  const m = config.hotelsMeals.mode || 'perPaxPerNight';
                  const hint = m === 'perPaxPerNight' ? 'Per person, per night' : m === 'perNight' ? 'Per night (flat)' : m === 'perPax' ? 'Per person, whole trip' : 'Flat total for entire trip';
                  return (
                    <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 mt-3 items-end">
                      <div className="form-group mb-0">
                        <label className="form-label">Additional Meal Costs ($)</label>
                        <p className="text-xs text-ag-text-muted mb-1">{hint}</p>
                        <NumInput type="number" value={config.hotelsMeals.additionalMealCostsByPax?.[effectiveHMPax] ?? config.hotelsMeals.additionalMealCosts} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ hotelsMeals: { ...prev.hotelsMeals, additionalMealCostsByPax: { ...prev.hotelsMeals.additionalMealCostsByPax, [effectiveHMPax]: val } } })); }} className="w-full" />
                      </div>
                      <div className="col-span-3" />
                    </div>
                  );
                })()}
              </>
            )}
            {/* Guide Inclusion */}
            <div className="mt-6 pt-6 border-t border-ag-border">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-sm font-semibold">Guide Inclusion</h3>
                <span className="text-xs text-ag-text-muted">Add guides to pax count for cost calculation (Rate × Pax modes only)</span>
              </div>
              <div className="flex gap-2 items-center mb-3">
                {(['off', 'matchStaff', 'custom'] as const).map((m) => (
                  <button key={m} onClick={() => updateNestedConfig('hotelsMeals', { guideCountMode: m })}
                    className={`btn text-xs ${(config.hotelsMeals.guideCountMode ?? 'off') === m ? 'btn-primary' : 'btn-secondary'}`}>
                    {m === 'off' ? 'Off' : m === 'matchStaff' ? 'Match Staff' : 'Custom'}
                  </button>
                ))}
              </div>
              {(config.hotelsMeals.guideCountMode ?? 'off') === 'matchStaff' && (
                <p className="text-xs text-ag-text-muted">Guide count is automatically read from Staff Configuration for each group size.</p>
              )}
              {(config.hotelsMeals.guideCountMode ?? 'off') === 'custom' && (
                <>
                  <div className="flex gap-2 items-center mb-3">
                    <button onClick={() => updateConfig(prev => ({ uiPreferences: { ...prev.uiPreferences, hmGuidePerPax: false } }))}
                      className={`btn text-xs ${!config.uiPreferences?.hmGuidePerPax ? 'btn-primary' : 'btn-secondary'}`}>Simple</button>
                    <button onClick={() => updateConfig(prev => ({ uiPreferences: { ...prev.uiPreferences, hmGuidePerPax: true } }))}
                      className={`btn text-xs ${config.uiPreferences?.hmGuidePerPax ? 'btn-primary' : 'btn-secondary'}`}>Per Pax</button>
                  </div>
                  {!config.uiPreferences?.hmGuidePerPax ? (
                    <div className="form-group">
                      <label className="form-label">Guide Count</label>
                      <p className="text-xs text-ag-text-muted mb-1">Same guide count for all group sizes</p>
                      <NumInput type="number" value={config.hotelsMeals.guideCount ?? 0}
                        onChange={(e) => updateNestedConfig('hotelsMeals', { guideCount: Number(e.target.value) })} className="w-32" />
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2 flex-wrap items-center mb-2">
                        {paxCounts.map((p) => (
                          <button key={p} onClick={() => setSelectedHMPax(p)}
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${effectiveHMPax === p ? 'bg-ag-accent text-white' : 'bg-ag-card-lighter text-ag-text-muted hover:text-ag-text'}`}>
                            {p} pax
                          </button>
                        ))}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Guide Count ({effectiveHMPax} pax)</label>
                        <NumInput type="number"
                          value={config.hotelsMeals.guideCountByPax?.[effectiveHMPax] ?? config.hotelsMeals.guideCount ?? 0}
                          onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ hotelsMeals: { ...prev.hotelsMeals, guideCountByPax: { ...prev.hotelsMeals.guideCountByPax, [effectiveHMPax]: val } } })); }}
                          className="w-32" />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </>
        ))}
      </div>

      {/* Staff Configuration */}
      <div className={`card ${config.staffConfig.enabled === false ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button onClick={() => toggleSection('staff')} className="text-ag-text-muted hover:text-ag-text text-sm mr-2">{collapsedSections.has('staff') ? '▶' : '▼'}</button>
            <h2 className="text-lg font-semibold">Staff Configuration</h2>
          </div>
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
        {!collapsedSections.has('staff') && (config.staffConfig.enabled === false ? (
          <p className="text-sm text-ag-text-muted">Section disabled — staff costs will not be applied to calculations.</p>
        ) : (
          <>
            {/* Staff roles sub-section — pax selector with Copy to All Pax as last button */}
            <div className="flex gap-2 mb-4 flex-wrap items-center">
              {paxCounts.map((p) => (
                <button key={p} onClick={() => setSelectedStaffPax(p)} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${selectedStaffPax === p ? 'bg-ag-accent text-white' : 'bg-ag-card-lighter text-ag-text-muted hover:text-ag-text'}`}>
                  {p} pax
                </button>
              ))}
              <button onClick={copyStaffToAll} className="btn btn-secondary text-xs">Copy to All Pax</button>
            </div>
            <div className="space-y-4">
              {currentStaff.map((staff, index) => (
                <div key={index} className="flex items-end gap-4 pb-4">
                  <div className="form-group flex-1">
                    <label className="form-label">Role</label>
                    <input type="text" value={staff.role} onChange={(e) => updateStaffMember(index, { role: e.target.value })} className="w-full" />
                  </div>
                  <div className="form-group w-32">
                    <label className="form-label">Daily Rate ($)</label>
                    <p className="text-xs text-ag-text-muted mb-1">Per staff, per day</p>
                    <NumInput type="number" value={staff.dailyRate} onChange={(e) => updateStaffMember(index, { dailyRate: Number(e.target.value) })} className="w-full" />
                  </div>
                  <div className="form-group w-24">
                    <label className="form-label">Days</label>
                    <NumInput
                      type="number"
                      value={config.staffConfig.useCustomStaffDays ? staff.days : config.tripDays}
                      onChange={(e) => updateStaffMember(index, { days: Number(e.target.value) })}
                      disabled={!config.staffConfig.useCustomStaffDays}
                      className={`w-full ${!config.staffConfig.useCustomStaffDays ? 'opacity-60' : ''}`}
                    />
                  </div>
                  <div className="form-group w-24">
                    <label className="form-label">Quantity</label>
                    <NumInput type="number" value={staff.quantity} onChange={(e) => updateStaffMember(index, { quantity: Number(e.target.value) })} className="w-full" />
                  </div>
                  <button onClick={() => removeStaffMember(index)} className="btn btn-danger mb-4" disabled={currentStaff.length <= 1}>Remove</button>
                </div>
              ))}
              <div className="flex gap-2">
                <button onClick={addStaffMember} className="btn btn-secondary">+ Add Staff Member</button>
              </div>
            </div>

            {/* Guide Travel sub-section */}
            <div className="mt-6 pt-6 border-t border-ag-border">
              {/* Travel pax selector with its own Copy to All Pax */}
              <div className="flex gap-2 mb-4 flex-wrap items-center">
                {paxCounts.map((p) => (
                  <button key={p} onClick={() => setSelectedTravelPax(p)} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${selectedTravelPax === p ? 'bg-ag-accent text-white' : 'bg-ag-card-lighter text-ag-text-muted hover:text-ag-text'}`}>
                    {p} pax
                  </button>
                ))}
                <button onClick={copyTravelToAll} className="btn btn-secondary text-xs">Copy to All Pax</button>
              </div>
              {/* Row 1: Guide Flights Needed | Guide Flight Cost */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="form-group">
                  <label className="form-label">Guide Flights Needed</label>
                  <p className="text-xs text-ag-text-muted mb-1">Number of flights at {effectiveTravelPax} pax</p>
                  <NumInput type="number" min="0" value={config.staffConfig.guideFlightCountByPax?.[effectiveTravelPax] ?? 0} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ staffConfig: { ...prev.staffConfig, guideFlightCountByPax: { ...prev.staffConfig.guideFlightCountByPax, [effectiveTravelPax]: val } } })); }} className="w-full" />
                </div>
                <div className="form-group">
                  <label className="form-label">Guide Flight Cost ($)</label>
                  <p className="text-xs text-ag-text-muted mb-1">Cost per flight at {effectiveTravelPax} pax</p>
                  <NumInput type="number" value={config.staffConfig.guideFlightCostByPax?.[effectiveTravelPax] ?? config.staffConfig.guideFlightCost ?? 0} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ staffConfig: { ...prev.staffConfig, guideFlightCostByPax: { ...prev.staffConfig.guideFlightCostByPax, [effectiveTravelPax]: val } } })); }} className="w-full" />
                </div>
              </div>
              {/* Row 2: Travel Days | Travel Day Rate */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="form-group">
                  <label className="form-label">Travel Days</label>
                  <p className="text-xs text-ag-text-muted mb-1">Extra travel days at {effectiveTravelPax} pax</p>
                  <NumInput type="number" value={config.staffConfig.travelDaysByPax?.[effectiveTravelPax] ?? config.staffConfig.travelDays} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ staffConfig: { ...prev.staffConfig, travelDaysByPax: { ...prev.staffConfig.travelDaysByPax, [effectiveTravelPax]: val } } })); }} className="w-full" />
                </div>
                <div className="form-group">
                  <label className="form-label">Travel Day Rate ($)</label>
                  <p className="text-xs text-ag-text-muted mb-1">Per flying guide, per travel day</p>
                  <NumInput type="number" value={config.staffConfig.travelDayRateByPax?.[effectiveTravelPax] ?? config.staffConfig.travelDayRate} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ staffConfig: { ...prev.staffConfig, travelDayRateByPax: { ...prev.staffConfig.travelDayRateByPax, [effectiveTravelPax]: val } } })); }} className="w-full" />
                </div>
              </div>
              {/* Row 3: Staff Guide Meals */}
              <div className="pt-2">
                <div className="flex items-center gap-3 mb-3">
                  <label className="form-label mb-0">Staff Guide Meals Cost ($)</label>
                  <div className="flex gap-1">
                    {(['perDayPerGuide', 'perDay', 'total'] as const).map((m) => {
                      const mode = config.staffConfig.staffMealsMode || 'perDay';
                      return (
                        <button key={m} onClick={() => updateNestedConfig('staffConfig', { staffMealsMode: m })} className={`btn text-xs ${mode === m ? 'btn-primary' : 'btn-secondary'}`}>
                          {m === 'perDayPerGuide' ? 'Per Day/Guide' : m === 'perDay' ? 'Per Day' : 'Total'}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-xs text-ag-text-muted">
                    {(config.staffConfig.staffMealsMode || 'perDay') === 'perDayPerGuide'
                      ? `(cost \u00d7 ${config.tripDays} days \u00d7 guides)`
                      : (config.staffConfig.staffMealsMode || 'perDay') === 'perDay'
                      ? `(cost \u00d7 ${config.tripDays} trip days)`
                      : '(entered value is total cost)'}
                  </span>
                </div>
                <NumInput type="number" value={config.staffConfig.staffMealsCostByPax?.[effectiveTravelPax] ?? config.staffConfig.staffMealsCost ?? 0} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ staffConfig: { ...prev.staffConfig, staffMealsCostByPax: { ...prev.staffConfig.staffMealsCostByPax, [effectiveTravelPax]: val } } })); }} className="w-48" />
              </div>
            </div>
          </>
        ))}
      </div>

      {/* Transport */}
      <div className={`card ${config.transportConfig.enabled === false ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button onClick={() => toggleSection('transport')} className="text-ag-text-muted hover:text-ag-text text-sm mr-2">{collapsedSections.has('transport') ? '▶' : '▼'}</button>
            <h2 className="text-lg font-semibold">Transport</h2>
          </div>
          <button onClick={() => updateNestedConfig('transportConfig', { enabled: config.transportConfig.enabled === false })} className={`btn text-xs ${config.transportConfig.enabled === false ? 'btn-danger' : 'btn-primary'}`}>
            {config.transportConfig.enabled === false ? 'Inactive' : 'Active'}
          </button>
        </div>
        {!collapsedSections.has('transport') && (config.transportConfig.enabled === false ? (
          <p className="text-sm text-ag-text-muted">Section disabled — transport costs will not be applied to calculations.</p>
        ) : (
          <>
            {(config.transportConfig.transportVehicles || []).length === 0 && (
              <p className="text-sm text-ag-text-muted mb-3">No transport line items defined. Add one below.</p>
            )}
            {(config.transportConfig.transportVehicles || []).map((vehicle, idx) => {
              const selPax = vehiclePaxSelection[vehicle.id] ?? paxMin;
              const effPax = paxCounts.includes(selPax) ? selPax : (paxCounts[0] || 1);
              return (
                <div key={vehicle.id}>
                  {idx > 0 && <hr className="border-ag-border my-4" />}
                  {/* Vehicle header */}
                  <div className="flex items-center justify-between mb-3">
                    <input
                      type="text"
                      value={vehicle.label}
                      onChange={(e) => updateVehicle(vehicle.id, { label: e.target.value })}
                      className="bg-transparent text-sm font-medium border-b border-ag-border focus:outline-none focus:border-ag-accent text-ag-text w-48"
                    />
                    <div className="flex gap-2">
                      <ActiveDropdown
                        id={`vehicle-${vehicle.id}`}
                        value={vehicle.mode}
                        onChange={(v) => updateVehicleMode(vehicle.id, v)}
                        showBands
                        openId={openDropdown}
                        setOpenId={setOpenDropdown}
                      />
                      <button onClick={() => removeVehicle(vehicle.id)} className="btn btn-danger text-xs">Remove</button>
                    </div>
                  </div>
                  {/* Simple mode */}
                  {vehicle.mode === 'simple' && (
                    <div className="form-group">
                      <label className="form-label">Cost ($)</label>
                      <NumInput type="number" value={vehicle.simpleRate} onChange={(e) => updateVehicle(vehicle.id, { simpleRate: Number(e.target.value) })} className="w-48" />
                    </div>
                  )}
                  {/* Per-pax mode */}
                  {vehicle.mode === 'perPax' && (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex gap-2 flex-wrap">
                          {paxCounts.map((p) => (
                            <button key={p} onClick={() => setVehiclePaxSelection(prev => ({ ...prev, [vehicle.id]: p }))} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${effPax === p ? 'bg-ag-accent text-white' : 'bg-ag-card-lighter text-ag-text-muted hover:text-ag-text'}`}>
                              {p} pax
                            </button>
                          ))}
                        </div>
                        <button onClick={() => copyVehicleToAllPax(vehicle.id)} className="btn btn-secondary text-xs ml-2">Copy to All Pax</button>
                      </div>
                      <div className="form-group mt-3">
                        <label className="form-label">Cost ($)</label>
                        <NumInput
                          type="number"
                          value={vehicle.perPaxRates?.[effPax] ?? vehicle.simpleRate}
                          onChange={(e) => updateVehiclePerPaxRate(vehicle.id, effPax, Number(e.target.value))}
                          className="w-48"
                        />
                      </div>
                    </>
                  )}
                  {/* Bands mode */}
                  {vehicle.mode === 'bands' && (
                    <>
                      <p className="text-xs text-ag-text-muted mb-3">The first band whose range contains the pax count will be used.</p>
                      {vehicle.bands.length === 0 ? (
                        <p className="text-sm text-ag-text-muted mb-3">No bands defined. Add one below.</p>
                      ) : (
                        <div className="overflow-x-auto mb-3">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-ag-text-muted text-xs">
                                <th className="text-left pb-2 pr-3 font-medium">Min Pax</th>
                                <th className="text-left pb-2 pr-3 font-medium">Max Pax</th>
                                <th className="text-left pb-2 pr-3 font-medium">Cost ($)</th>
                                <th className="pb-2"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {vehicle.bands.map((band) => (
                                <tr key={band.id}>
                                  <td className="py-2 pr-3">
                                    <NumInput type="number" min="1" value={band.minPax} onChange={(e) => updateVehicleBand(vehicle.id, band.id, { minPax: Number(e.target.value) })} className="w-20" />
                                  </td>
                                  <td className="py-2 pr-3">
                                    <input type="number" min="1" placeholder="∞" value={band.maxPax ?? ''} onChange={(e) => updateVehicleBand(vehicle.id, band.id, { maxPax: e.target.value === '' ? null : Number(e.target.value) })} className="w-20" />
                                  </td>
                                  <td className="py-2 pr-3">
                                    <NumInput type="number" value={band.cost} onChange={(e) => updateVehicleBand(vehicle.id, band.id, { cost: Number(e.target.value) })} className="w-28" />
                                  </td>
                                  <td className="py-2">
                                    <button onClick={() => removeVehicleBand(vehicle.id, band.id)} className="btn btn-danger text-xs">Remove</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <button onClick={() => addVehicleBand(vehicle.id)} className="btn btn-secondary text-xs">+ Add Band</button>
                    </>
                  )}
                  {/* Guide Seats */}
                  <div className="mt-4 pt-4 border-t border-ag-border">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-semibold">Guide Seats</span>
                      <span className="text-xs text-ag-text-muted">Add guides to pax for band/per-pax lookup (no effect on flat rates)</span>
                    </div>
                    <div className="flex gap-2 items-center mb-2">
                      {(['off', 'matchStaff', 'custom'] as const).map((m) => (
                        <button key={m} onClick={() => updateVehicle(vehicle.id, { guideCountMode: m })}
                          className={`btn text-xs ${(vehicle.guideCountMode ?? 'off') === m ? 'btn-primary' : 'btn-secondary'}`}>
                          {m === 'off' ? 'Off' : m === 'matchStaff' ? 'Match Staff' : 'Custom'}
                        </button>
                      ))}
                    </div>
                    {(vehicle.guideCountMode ?? 'off') === 'matchStaff' && (
                      <p className="text-xs text-ag-text-muted">Guide count automatically read from Staff Configuration for each group size.</p>
                    )}
                    {(vehicle.guideCountMode ?? 'off') === 'custom' && (
                      <>
                        <div className="flex gap-2 items-center mb-2">
                          <button onClick={() => updateVehicle(vehicle.id, { guideCountPerPax: false })}
                            className={`btn text-xs ${!vehicle.guideCountPerPax ? 'btn-primary' : 'btn-secondary'}`}>Simple</button>
                          <button onClick={() => updateVehicle(vehicle.id, { guideCountPerPax: true })}
                            className={`btn text-xs ${vehicle.guideCountPerPax ? 'btn-primary' : 'btn-secondary'}`}>Per Pax</button>
                        </div>
                        {!vehicle.guideCountPerPax ? (
                          <div className="form-group">
                            <label className="form-label">Guide Count</label>
                            <NumInput type="number" value={vehicle.guideCount ?? 0}
                              onChange={(e) => updateVehicle(vehicle.id, { guideCount: Number(e.target.value) })} className="w-32" />
                          </div>
                        ) : (
                          <>
                            <div className="flex gap-2 flex-wrap items-center mb-2">
                              {paxCounts.map((p) => (
                                <button key={p} onClick={() => setVehiclePaxSelection(prev => ({ ...prev, [vehicle.id]: p }))}
                                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${effPax === p ? 'bg-ag-accent text-white' : 'bg-ag-card-lighter text-ag-text-muted hover:text-ag-text'}`}>
                                  {p} pax
                                </button>
                              ))}
                            </div>
                            <div className="form-group">
                              <label className="form-label">Guide Count ({effPax} pax)</label>
                              <NumInput type="number"
                                value={vehicle.guideCountByPax?.[effPax] ?? vehicle.guideCount ?? 0}
                                onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => ({ transportConfig: { ...prev.transportConfig, transportVehicles: (prev.transportConfig.transportVehicles || []).map(v => v.id === vehicle.id ? { ...v, guideCountByPax: { ...v.guideCountByPax, [effPax]: val } } : v) } })); }}
                                className="w-32" />
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <div className={`${(config.transportConfig.transportVehicles || []).length > 0 ? 'mt-4 pt-4 border-t border-ag-border' : ''}`}>
              <button onClick={addVehicle} className="btn btn-secondary text-xs">+ Add Vehicle</button>
            </div>
          </>
        ))}
      </div>

      {/* Trip-Specific Costs */}
      <div className={`card ${config.tripSpecific.enabled === false ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button onClick={() => toggleSection('tripSpecific')} className="text-ag-text-muted hover:text-ag-text text-sm mr-2">{collapsedSections.has('tripSpecific') ? '▶' : '▼'}</button>
            <h2 className="text-lg font-semibold">Trip-Specific Costs</h2>
          </div>
          <div className="flex gap-2">
            {config.tripSpecific.enabled !== false && (
              <>
                <ActiveDropdown id="tripSpecific" value={tripSpecificMode} onChange={v => updateNestedConfig('tripSpecific', { mode: v as 'simple' | 'bands' })} openId={openDropdown} setOpenId={setOpenDropdown} showBands showPerPax={false} />
              </>
            )}
            <button onClick={() => updateNestedConfig('tripSpecific', { enabled: config.tripSpecific.enabled === false })} className={`btn text-xs ${config.tripSpecific.enabled === false ? 'btn-danger' : 'btn-primary'}`}>
              {config.tripSpecific.enabled === false ? 'Inactive' : 'Active'}
            </button>
          </div>
        </div>
        {!collapsedSections.has('tripSpecific') && (config.tripSpecific.enabled === false ? (
          <p className="text-sm text-ag-text-muted">Section disabled — trip-specific costs will not be applied to calculations.</p>
        ) : (
          <>
            {tripSpecificMode === 'bands' && (
              <p className="text-sm text-ag-text-muted mb-4">Each cost only applies when pax falls within its Min–Max range. Leave blank for no limit.</p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col />
                  <col className="w-32" />
                  <col className="w-24" />
                  {tripSpecificMode === 'bands' && (
                    <>
                      <col className="w-28" />
                      <col className="w-28" />
                    </>
                  )}
                  <col className="w-20" />
                </colgroup>
                <thead>
                  <tr className="text-ag-text-muted text-xs border-b border-ag-border">
                    <th className="text-left pb-2 pr-4 font-medium">Category ($)</th>
                    <th className="text-left pb-2 pr-4 font-medium">Amount</th>
                    <th className="text-left pb-2 pr-4 font-medium">Per Pax</th>
                    {tripSpecificMode === 'bands' && (
                      <>
                        <th className="text-left pb-2 pr-4 font-medium">Min Pax</th>
                        <th className="text-left pb-2 pr-4 font-medium">Max Pax</th>
                      </>
                    )}
                    <th className="text-left pb-2 font-medium">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {ALL_TRIP_SPECIFIC_FIELDS.filter(({ key }) => (config.tripSpecific[key] as TripSpecificCost).active !== false).map(({ key, label }) => {
                    const cost = config.tripSpecific[key] as TripSpecificCost;
                    return (
                      <tr key={key}>
                        <td className="py-2 pr-4">
                          <span className="text-sm text-ag-text">{label}</span>
                        </td>
                        <td className="py-2 pr-4">
                          <NumInput value={cost.amount} onChange={(e) => updateTripSpecificCost(key, { amount: Number(e.target.value) })} className="w-28" />
                        </td>
                        <td className="py-2 pr-4">
                          <input type="checkbox" checked={cost.perPax} onChange={(e) => updateTripSpecificCost(key, { perPax: e.target.checked })} className="w-4 h-4 accent-ag-accent" />
                        </td>
                        {tripSpecificMode === 'bands' && (
                          <>
                            <td className="py-2 pr-4">
                              <NumInput value={cost.minPax ?? undefined} onChange={(e) => updateTripSpecificCost(key, { minPax: e.target.value === '' ? null : Number(e.target.value) })} className="w-20" placeholder="any" />
                            </td>
                            <td className="py-2 pr-4">
                              <NumInput value={cost.maxPax ?? undefined} onChange={(e) => updateTripSpecificCost(key, { maxPax: e.target.value === '' ? null : Number(e.target.value) })} className="w-20" placeholder="any" />
                            </td>
                          </>
                        )}
                        <td className="py-2">
                          <button onClick={() => updateTripSpecificCost(key, { active: false })} className="btn btn-danger text-xs">×</button>
                        </td>
                      </tr>
                    );
                  })}
                  {(config.tripSpecific.customCosts || []).map((cc) => (
                    <tr key={cc.id}>
                      <td className="py-2 pr-4">
                        <input type="text" placeholder="Label" value={cc.label} onChange={(e) => updateCustomCost(cc.id, { label: e.target.value })} className="w-full" />
                      </td>
                      <td className="py-2 pr-4">
                        <NumInput value={cc.amount} onChange={(e) => updateCustomCost(cc.id, { amount: Number(e.target.value) })} className="w-28" />
                      </td>
                      <td className="py-2 pr-4">
                        <input type="checkbox" checked={cc.perPax} onChange={(e) => updateCustomCost(cc.id, { perPax: e.target.checked })} className="w-4 h-4 accent-ag-accent" />
                      </td>
                      {tripSpecificMode === 'bands' && (
                        <>
                          <td className="py-2 pr-4">
                            <NumInput value={cc.minPax ?? undefined} onChange={(e) => updateCustomCost(cc.id, { minPax: e.target.value === '' ? null : Number(e.target.value) })} className="w-20" placeholder="any" />
                          </td>
                          <td className="py-2 pr-4">
                            <NumInput value={cc.maxPax ?? undefined} onChange={(e) => updateCustomCost(cc.id, { maxPax: e.target.value === '' ? null : Number(e.target.value) })} className="w-20" placeholder="any" />
                          </td>
                        </>
                      )}
                      <td className="py-2">
                        <button onClick={() => removeCustomCost(cc.id)} className="btn btn-danger text-xs">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add buttons */}
            <div className="flex flex-wrap gap-2 mt-4">
              {ALL_TRIP_SPECIFIC_FIELDS.filter(({ key }) => (config.tripSpecific[key] as TripSpecificCost).active === false).map(({ key, label }) => (
                <button key={key} onClick={() => updateTripSpecificCost(key, { active: true })} className="btn btn-secondary text-xs">+ {label}</button>
              ))}
              <button onClick={addCustomCost} className="btn btn-secondary text-xs">+ Add Cost</button>
            </div>
          </>
        ))}
      </div>

      {/* Logistics Rates */}
      <div className={`card ${config.logistics.enabled === false ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button onClick={() => toggleSection('logistics')} className="text-ag-text-muted hover:text-ag-text text-sm mr-2">{collapsedSections.has('logistics') ? '▶' : '▼'}</button>
            <h2 className="text-lg font-semibold">Logistics Rates</h2>
          </div>
          <div className="flex gap-2">
            {config.logistics.enabled !== false && (
              <>
                <ActiveDropdown id="logistics" value={logEffectiveAM} onChange={v => { setLogisticsSimpleView(v === 'simple'); updateNestedConfig('logistics', { activeMode: v as 'simple' | 'perPax' }); }} openId={openDropdown} setOpenId={setOpenDropdown} />
              </>
            )}
            <button onClick={() => updateNestedConfig('logistics', { enabled: config.logistics.enabled === false })} className={`btn text-xs ${config.logistics.enabled === false ? 'btn-danger' : 'btn-primary'}`}>
              {config.logistics.enabled === false ? 'Inactive' : 'Active'}
            </button>
          </div>
        </div>
        {!collapsedSections.has('logistics') && (config.logistics.enabled === false ? (
          <p className="text-sm text-ag-text-muted">Section disabled — logistics costs will not be applied to calculations.</p>
        ) : (
          <>
            <div className="mb-4">
              <div className="flex gap-2 items-center flex-wrap">
                {(['perPaxPerDay', 'perPax', 'perDay', 'total'] as const).map((m) => {
                  const logisticsMode = config.logistics.mode || (config.logistics.perPax ? 'perPaxPerDay' : 'perDay');
                  const labels = { perPaxPerDay: 'Rate × Pax × Days', perPax: 'Rate × Pax', perDay: 'Rate × Days', total: 'Total Cost' };
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
              </div>
            </div>
            {config.logistics.simpleMode !== false ? (
              <div className="max-w-xs">
                <label className="form-label">Rate (all pax)</label>
                <NumInput
                  type="number"
                  value={config.logistics.baseRate}
                  onChange={(e) => updateNestedConfig('logistics', { baseRate: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
            ) : (
              <>
                <p className="text-xs text-ag-text-muted mb-3">Rate per pax level — use mode buttons above to control how it&apos;s applied</p>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                  {paxCounts.map((p) => {
                    const existing = config.logistics.rates.find(r => r.pax === p);
                    const rateValue = existing ? existing.rate : 0;
                    return (
                      <div key={p} className="form-group">
                        <label className="form-label text-center">{p} pax</label>
                        <NumInput type="number" value={rateValue} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => { const newRates = prev.logistics.rates.filter(r => r.pax !== p); newRates.push({ pax: p, rate: val }); return { logistics: { ...prev.logistics, rates: newRates } }; }); }} className="w-full text-center" />
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Guide Logistics Rate */}
            <div className="border-t border-ag-border mt-6 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Guide Logistics Rate</h3>
                <div className="flex gap-2">
                  {config.logistics.guideLogistics?.enabled !== false && (
                    <>
                      <ActiveDropdown id="guideLogistics" value={glEffectiveAM} onChange={v => { setGuideLogisticsSimpleView(v === 'simple'); updateGuideLogistics({ activeMode: v as 'simple' | 'perPax' }); }} openId={openDropdown} setOpenId={setOpenDropdown} />
                    </>
                  )}
                  <button onClick={() => updateGuideLogistics({ enabled: config.logistics.guideLogistics?.enabled === false })} className={`btn text-xs ${config.logistics.guideLogistics?.enabled === false ? 'btn-danger' : 'btn-primary'}`}>
                    {config.logistics.guideLogistics?.enabled === false ? 'Inactive' : 'Active'}
                  </button>
                </div>
              </div>
              {config.logistics.guideLogistics?.enabled === false ? (
                <p className="text-sm text-ag-text-muted">Guide logistics disabled — guide logistics costs will not be applied to calculations.</p>
              ) : (
                <>
                  <div className="mb-4">
                    <div className="flex gap-2 items-center flex-wrap">
                      {(['perPaxPerDay', 'perPax', 'perDay', 'total'] as const).map((m) => {
                        const guideMode = config.logistics.guideLogistics?.mode || 'perDay';
                        const labels = { perPaxPerDay: 'Rate × Pax × Days', perPax: 'Rate × Pax', perDay: 'Rate × Days', total: 'Total Cost' };
                        return (
                          <button
                            key={m}
                            onClick={() => updateGuideLogistics({ mode: m })}
                            className={`btn text-xs ${guideMode === m ? 'btn-primary' : 'btn-secondary'}`}
                          >
                            {labels[m]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {config.logistics.guideLogistics?.simpleMode !== false ? (
                    <div className="max-w-xs">
                      <label className="form-label">Rate (all pax)</label>
                      <NumInput
                        type="number"
                        value={config.logistics.guideLogistics?.baseRate ?? 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateConfig(prev => {
                            const gl = prev.logistics.guideLogistics ?? { rates: [], mode: 'perDay' as const };
                            return { logistics: { ...prev.logistics, guideLogistics: { ...gl, baseRate: val } } };
                          });
                        }}
                        className="w-full"
                      />
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-ag-text-muted mb-3">Rate per pax level — use mode buttons above to control how it&apos;s applied</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                        {paxCounts.map((p) => {
                          const existing = config.logistics.guideLogistics?.rates?.find(r => r.pax === p);
                          const rateValue = existing ? existing.rate : 0;
                          return (
                            <div key={p} className="form-group">
                              <label className="form-label text-center">{p} pax</label>
                              <NumInput type="number" value={rateValue} onChange={(e) => { const val = Number(e.target.value); updateConfig(prev => { const gl = prev.logistics.guideLogistics || { baseRate: 0, rates: [], mode: 'perDay' as const, simpleMode: true }; const newRates = (gl.rates || []).filter(r => r.pax !== p); newRates.push({ pax: p, rate: val }); return { logistics: { ...prev.logistics, guideLogistics: { ...gl, rates: newRates } } }; }); }} className="w-full text-center" />
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
        ))}
      </div>
    </div>
  );
}
