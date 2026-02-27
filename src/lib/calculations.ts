import { TripConfiguration, PaxCalculation, LogisticsConfig, StaffMember } from './types';

// Get logistics rate based on pax count
export function getLogisticsRate(pax: number, logistics: LogisticsConfig): number {
  const match = logistics.rates.find((r) => r.pax === pax);
  return match ? match.rate : 0;
}

// Calculate staff costs for a given pax count
export function calculateStaffCost(pax: number, config: TripConfiguration): number {
  const { staffConfig } = config;
  const staff = staffConfig.staffByPax[pax] || [];

  let totalCost = 0;

  // Calculate cost for each staff member
  for (const s of staff) {
    totalCost += s.dailyRate * s.days * s.quantity;
  }

  // Add travel day costs (only for guides who fly)
  const flyingGuides = staffConfig.guideFlightCountByPax?.[pax] ?? 0;
  totalCost += staffConfig.travelDays * staffConfig.travelDayRate * flyingGuides;

  return totalCost;
}

// Calculate staff cost from a staff array and travel config
function calculateStaffCostFromArray(
  staff: StaffMember[],
  travelDays: number,
  travelDayRate: number
): number {
  let totalCost = 0;
  for (const s of staff) {
    totalCost += s.dailyRate * s.days * s.quantity;
  }
  const totalStaffCount = staff.reduce((sum, s) => sum + s.quantity, 0);
  totalCost += travelDays * travelDayRate * totalStaffCount;
  return totalCost;
}

// Calculate extension (formerly pre/post) values
function calculateExtension(pax: number, config: TripConfiguration) {
  const { extension } = config;
  const zeros = {
    extensionRevenue: 0,
    extensionSingleSuppRevenue: 0,
    extensionDiscountCost: 0,
    extensionHotelsCost: 0,
    extensionMealsCost: 0,
    extensionStaffCost: 0,
    extensionLogisticsCost: 0,
    extensionSingleRoomCost: 0,
    extensionTotalCost: 0,
  };

  if (!extension.enabled) return zeros;
  if ((extension.extensionNights ?? 0) <= 0) return zeros;

  const extPaxCount = Math.min(extension.countByPax?.[pax] ?? 0, pax);

  // Extension revenue
  const extensionRevenue = extension.extensionPrice * extPaxCount;

  // Single supplement
  let extensionSingleSuppRevenue = 0;
  let extensionSingleRoomCost = 0;
  if (extension.singleSupplement.enabled !== false) {
    const ss = extension.singleSupplement;
    const suppPrice = ss.inheritFromMain ? config.singleSupplement.singleSupplement : ss.singleSupplement;
    const roomExtra = ss.inheritFromMain ? config.singleSupplement.singleRoomExtra : ss.singleRoomExtra;
    const suppCount = Math.min(ss.countByPax?.[pax] ?? 0, extPaxCount);
    extensionSingleSuppRevenue = suppPrice * suppCount;
    extensionSingleRoomCost = roomExtra * suppCount * extension.extensionNights;
  }

  // Discounts (revenue deduction — not inflated)
  let extensionDiscountCost = 0;
  if (extension.discounts?.enabled !== false && extPaxCount > 0) {
    const disc = extension.discounts;
    const ebDiscount = disc.inheritFromMain ? config.earlyBirdDiscount : disc.earlyBirdDiscount;
    const ebCount = Math.min(disc.earlyBirdCountByPax?.[pax] ?? 0, extPaxCount);
    const loyaltyRate = disc.inheritFromMain ? config.loyaltyDiscountRate : disc.loyaltyDiscountRate;
    const loyaltyCount = Math.min(disc.loyaltyCountByPax?.[pax] ?? 0, extPaxCount);
    extensionDiscountCost = (ebDiscount * ebCount) + (extension.extensionPrice * loyaltyCount * loyaltyRate);
  }

  // Hotels & meals (only when guests take the extension)
  let extensionHotelsCost = 0;
  let extensionMealsCost = 0;
  if (extension.hotelsMeals.enabled !== false && extPaxCount > 0) {
    const hm = extension.hotelsMeals;
    const hotelRate = hm.inheritFromMain
      ? (config.hotelsMeals.hotelCostByPax?.[pax] ?? config.hotelsMeals.hotelCostPerNight)
      : (hm.hotelCostByPax?.[pax] ?? hm.hotelCostPerNight);
    const lunchRate = hm.inheritFromMain
      ? (config.hotelsMeals.lunchCostByPax?.[pax] ?? config.hotelsMeals.lunchCostPerDay)
      : (hm.lunchCostByPax?.[pax] ?? hm.lunchCostPerDay);
    const dinnerRate = hm.inheritFromMain
      ? (config.hotelsMeals.dinnerCostByPax?.[pax] ?? config.hotelsMeals.dinnerCostPerNight)
      : (hm.dinnerCostByPax?.[pax] ?? hm.dinnerCostPerNight);
    const additionalMeals = hm.inheritFromMain
      ? (config.hotelsMeals.additionalMealCostsByPax?.[pax] ?? config.hotelsMeals.additionalMealCosts)
      : (hm.additionalMealCostsByPax?.[pax] ?? hm.additionalMealCosts);
    const extHmMode = hm.inheritFromMain ? (config.hotelsMeals.mode || 'perPaxPerNight') : (hm.mode || 'perPaxPerNight');

    if (extHmMode === 'perPaxPerNight') {
      extensionHotelsCost = hotelRate * extension.extensionNights * extPaxCount;
      extensionMealsCost = (lunchRate + dinnerRate) * extension.extensionNights * extPaxCount + additionalMeals;
    } else if (extHmMode === 'perNight') {
      extensionHotelsCost = hotelRate * extension.extensionNights;
      extensionMealsCost = (lunchRate + dinnerRate) * extension.extensionNights + additionalMeals;
    } else {
      extensionHotelsCost = hotelRate;
      extensionMealsCost = lunchRate + dinnerRate + additionalMeals;
    }
  }

  // Staff (only when guests take the extension)
  let extensionStaffCost = 0;
  if (extension.staffConfig.enabled !== false && extPaxCount > 0) {
    const sc = extension.staffConfig;
    if (sc.inheritFromMain) {
      // Use main staff but scale days to extension nights
      const mainStaff = config.staffConfig.staffByPax[pax] || [];
      const extStaff = mainStaff.map(s => ({ ...s, days: extension.extensionNights }));
      extensionStaffCost = calculateStaffCostFromArray(extStaff, sc.travelDays, config.staffConfig.travelDayRate);
    } else {
      const staff = sc.staffByPax[pax] || [];
      extensionStaffCost = calculateStaffCostFromArray(staff, sc.travelDays, sc.travelDayRate);
    }
  }

  // Logistics
  let extensionLogisticsCost = 0;
  if (extension.logisticsConfig?.enabled !== false && extPaxCount > 0) {
    const lc = extension.logisticsConfig;
    let rate = 0;
    let mode = 'perDay';
    if (lc.inheritFromMain) {
      rate = getLogisticsRate(pax, config.logistics);
      mode = config.logistics.mode || (config.logistics.perPax ? 'perPaxPerDay' : 'perDay');
    } else {
      const match = lc.rates?.find(r => r.pax === pax);
      rate = match ? match.rate : 0;
      mode = lc.mode || 'perDay';
    }
    if (mode === 'perPaxPerDay') extensionLogisticsCost = rate * extension.extensionNights * extPaxCount;
    else if (mode === 'total') extensionLogisticsCost = rate;
    else extensionLogisticsCost = rate * extension.extensionNights;
  }

  const extensionTotalCost = extensionHotelsCost + extensionMealsCost + extensionStaffCost + extensionLogisticsCost + extensionSingleRoomCost;

  return {
    extensionRevenue,
    extensionSingleSuppRevenue,
    extensionDiscountCost,
    extensionHotelsCost,
    extensionMealsCost,
    extensionStaffCost,
    extensionLogisticsCost,
    extensionSingleRoomCost,
    extensionTotalCost,
  };
}

// Calculate trip-specific cost with per-pax option
function calculateTripSpecificCost(pax: number, config: TripConfiguration, totalRevenue: number): number {
  const { tripSpecific } = config;
  let total = 0;

  const costs = [
    tripSpecific.permits,
    tripSpecific.equipment,
    tripSpecific.jacketsApparel,
    tripSpecific.insurance,
    tripSpecific.contingency,
    tripSpecific.hypoxico || { amount: 0, perPax: false },
    tripSpecific.otherCosts,
  ];

  for (const cost of costs) {
    if (cost.active === false) continue;
    if (cost.percentOfRevenue) {
      total += cost.amount * totalRevenue;
    } else {
      total += cost.perPax ? cost.amount * pax : cost.amount;
    }
  }

  return total;
}

// Calculate all values for a specific pax count
export function calculateForPax(pax: number, config: TripConfiguration): PaxCalculation {
  const effectivePrice = config.tripPriceByPax?.[pax] ?? config.tripPrice;
  const isTotalPricing = config.tripPriceMode === 'total' && !config.tripPriceByPax;

  // Revenue calculations
  const baseRevenue = isTotalPricing ? effectivePrice : effectivePrice * pax;
  const perPersonPrice = isTotalPricing ? (pax > 0 ? effectivePrice / pax : 0) : effectivePrice;

  // Discounts (gated, clamped to pax count)
  const discountsOn = config.discountsEnabled !== false;
  const earlyBirdCount = discountsOn ? Math.min(config.earlyBirdCountByPax?.[pax] || 0, pax) : 0;
  const earlyBirdCost = config.earlyBirdDiscount * earlyBirdCount;
  const loyaltyCount = discountsOn ? Math.min(config.loyaltyCountByPax?.[pax] || 0, pax) : 0;
  const loyaltyCost = perPersonPrice * loyaltyCount * config.loyaltyDiscountRate;

  // Single supplement (gated, clamped to pax count)
  const singleSuppOn = config.singleSupplement.enabled !== false;
  const singleSupplementGuests = singleSuppOn ? Math.min(config.singleSupplement.countByPax?.[pax] ?? 0, pax) : 0;
  const singleSupplementRevenue = singleSuppOn ? config.singleSupplement.singleSupplement * singleSupplementGuests : 0;

  // Extension
  const ext = calculateExtension(pax, config);

  const totalRevenue = baseRevenue - earlyBirdCost - loyaltyCost + singleSupplementRevenue
    + ext.extensionRevenue + ext.extensionSingleSuppRevenue - ext.extensionDiscountCost;

  // Hotels & meals (gated, with mode, with byPax resolution)
  const hotelsMealsOn = config.hotelsMeals.enabled !== false;
  const hmMode = config.hotelsMeals.mode || 'perPaxPerNight';
  const hmHotelRate = config.hotelsMeals.hotelCostByPax?.[pax] ?? config.hotelsMeals.hotelCostPerNight;
  const hmLunchRate = config.hotelsMeals.lunchCostByPax?.[pax] ?? config.hotelsMeals.lunchCostPerDay;
  const hmDinnerRate = config.hotelsMeals.dinnerCostByPax?.[pax] ?? config.hotelsMeals.dinnerCostPerNight;
  const hmAdditional = config.hotelsMeals.additionalMealCostsByPax?.[pax] ?? config.hotelsMeals.additionalMealCosts;
  let hotelsCost = 0;
  let mealsCost = 0;
  if (hotelsMealsOn) {
    if (hmMode === 'perPaxPerNight') {
      hotelsCost = hmHotelRate * config.tripNights * pax;
      mealsCost = (hmLunchRate * config.tripDays + hmDinnerRate * config.tripNights) * pax + hmAdditional;
    } else if (hmMode === 'perNight') {
      hotelsCost = hmHotelRate * config.tripNights;
      mealsCost = hmLunchRate * config.tripDays + hmDinnerRate * config.tripNights + hmAdditional;
    } else {
      hotelsCost = hmHotelRate;
      mealsCost = hmLunchRate + hmDinnerRate + hmAdditional;
    }
  }

  // Logistics (gated)
  const logisticsOn = config.logistics.enabled !== false;
  const logisticsRate = getLogisticsRate(pax, config.logistics);
  const logisticsMode = config.logistics.mode || (config.logistics.perPax ? 'perPaxPerDay' : 'perDay');
  let logisticsCost = 0;
  if (logisticsOn) {
    if (logisticsMode === 'perPaxPerDay') logisticsCost = logisticsRate * config.tripDays * pax;
    else if (logisticsMode === 'total') logisticsCost = logisticsRate;
    else logisticsCost = logisticsRate * config.tripDays;
  }

  // Staff (gated)
  const staffOn = config.staffConfig.enabled !== false;
  const staffCost = staffOn ? calculateStaffCost(pax, config) : 0;

  // Guide flights (part of staff config, gated with staff)
  const guideFlightCostPer = config.staffConfig.guideFlightCost || 0;
  const guideFlightCount = config.staffConfig.guideFlightCountByPax?.[pax] ?? 0;
  const guideFlightsCost = staffOn ? guideFlightCostPer * guideFlightCount : 0;

  // Staff guide meals (gated with staff)
  const staffMealsAmount = config.staffConfig.staffMealsCost || 0;
  const staffMealsMode = config.staffConfig.staffMealsMode || 'perDay';
  let staffMealsCost = 0;
  if (staffOn) {
    const staff = config.staffConfig.staffByPax[pax] || [];
    const totalStaffCount = staff.reduce((sum, s) => sum + s.quantity, 0);
    if (staffMealsMode === 'perDayPerGuide') staffMealsCost = staffMealsAmount * config.tripDays * totalStaffCount;
    else if (staffMealsMode === 'perDay') staffMealsCost = staffMealsAmount * config.tripDays;
    else staffMealsCost = staffMealsAmount;
  }

  // Transport (gated — flights removed, now in staff section)
  const transportOn = config.transportConfig.enabled !== false;
  let transportCost = 0;
  if (transportOn) {
    transportCost += config.transportConfig.groundTransportPerPax ? config.transportConfig.groundTransportTotal * pax : config.transportConfig.groundTransportTotal;
    transportCost += config.transportConfig.airportTransfersPerPax ? config.transportConfig.airportTransfers * pax : config.transportConfig.airportTransfers;
    transportCost += config.transportConfig.localTransportPerPax ? config.transportConfig.localTransport * pax : config.transportConfig.localTransport;
  }

  // Trip-specific (gated)
  const tripSpecificOn = config.tripSpecific.enabled !== false;
  const tripSpecificCost = tripSpecificOn ? calculateTripSpecificCost(pax, config, totalRevenue) : 0;

  // Single room extra cost (gated with single supplement)
  const singleRoomCost = singleSuppOn ? config.singleSupplement.singleRoomExtra * singleSupplementGuests * config.tripNights : 0;

  // Apply inflation multiplier to all costs (clamped to 0 so costs never go negative)
  const inflationMultiplier = Math.max(0, 1 + (config.inflationRate || 0));
  const iHotelsCost = hotelsCost * inflationMultiplier;
  const iMealsCost = mealsCost * inflationMultiplier;
  const iLogisticsCost = logisticsCost * inflationMultiplier;
  const iStaffCost = staffCost * inflationMultiplier;
  const iGuideFlightsCost = guideFlightsCost * inflationMultiplier;
  const iStaffMealsCost = staffMealsCost * inflationMultiplier;
  const iTransportCost = transportCost * inflationMultiplier;
  const iTripSpecificCost = tripSpecificCost * inflationMultiplier;
  const iSingleRoomCost = singleRoomCost * inflationMultiplier;
  const iExtHotelsCost = ext.extensionHotelsCost * inflationMultiplier;
  const iExtMealsCost = ext.extensionMealsCost * inflationMultiplier;
  const iExtStaffCost = ext.extensionStaffCost * inflationMultiplier;
  const iExtLogisticsCost = ext.extensionLogisticsCost * inflationMultiplier;
  const iExtSingleRoomCost = ext.extensionSingleRoomCost * inflationMultiplier;
  const iExtTotalCost = iExtHotelsCost + iExtMealsCost + iExtStaffCost + iExtLogisticsCost + iExtSingleRoomCost;

  // Total costs (all inflated)
  const totalCosts = iHotelsCost + iMealsCost + iLogisticsCost + iStaffCost +
    iGuideFlightsCost + iStaffMealsCost + iTransportCost + iTripSpecificCost +
    iSingleRoomCost + iExtTotalCost;

  // Profit calculations (revenue NOT inflated)
  const grossProfit = totalRevenue - totalCosts;
  const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const perPaxProfit = pax > 0 ? grossProfit / pax : 0;

  return {
    pax,
    baseRevenue,
    earlyBirdCost,
    loyaltyCost,
    singleSupplementRevenue,
    totalRevenue,
    hotelsCost: iHotelsCost,
    mealsCost: iMealsCost,
    logisticsCost: iLogisticsCost,
    staffCost: iStaffCost,
    guideFlightsCost: iGuideFlightsCost,
    staffMealsCost: iStaffMealsCost,
    transportCost: iTransportCost,
    tripSpecificCost: iTripSpecificCost,
    singleRoomCost: iSingleRoomCost,
    totalCosts,
    extensionRevenue: ext.extensionRevenue,
    extensionSingleSuppRevenue: ext.extensionSingleSuppRevenue,
    extensionDiscountCost: ext.extensionDiscountCost,
    extensionHotelsCost: iExtHotelsCost,
    extensionMealsCost: iExtMealsCost,
    extensionStaffCost: iExtStaffCost,
    extensionLogisticsCost: iExtLogisticsCost,
    extensionSingleRoomCost: iExtSingleRoomCost,
    extensionTotalCost: iExtTotalCost,
    grossProfit,
    margin,
    perPaxProfit,
  };
}

// Calculate for all pax in range
export function calculateAllPax(config: TripConfiguration): PaxCalculation[] {
  const results: PaxCalculation[] = [];
  const min = config.paxMin || 1;
  const max = config.paxMax || 16;
  const step = Math.max(1, Math.round(config.paxStep || 1));

  for (let pax = min; pax <= max && results.length < 100; pax += step) {
    results.push(calculateForPax(pax, config));
  }

  return results;
}

// Format currency
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Format percentage
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Get margin color class based on value
export function getMarginColor(margin: number): string {
  if (margin >= 40) return 'text-ag-success';
  if (margin >= 30) return 'text-ag-warning';
  return 'text-ag-danger';
}

// Get profit color class based on value
export function getProfitColor(profit: number): string {
  if (profit > 0) return 'text-ag-success';
  if (profit === 0) return 'text-ag-warning';
  return 'text-ag-danger';
}
