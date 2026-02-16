import { TripConfiguration, PaxCalculation, LogisticsConfig, StaffMember } from './types';

// Get logistics rate based on pax count
export function getLogisticsRate(pax: number, logistics: LogisticsConfig): number {
  const match = logistics.rates.find((r) => r.pax === pax);
  return match ? match.rate : logistics.baseRate;
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

  // Add travel day costs
  const totalStaffCount = staff.reduce((sum, s) => sum + s.quantity, 0);
  totalCost += staffConfig.travelDays * staffConfig.travelDayRate * totalStaffCount;

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
    extensionHotelsCost: 0,
    extensionMealsCost: 0,
    extensionStaffCost: 0,
    extensionSingleRoomCost: 0,
    extensionTotalCost: 0,
  };

  if (!extension.enabled) return zeros;

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

  // Hotels & meals
  let extensionHotelsCost = 0;
  let extensionMealsCost = 0;
  if (extension.hotelsMeals.enabled !== false) {
    const hm = extension.hotelsMeals;
    const hotelRate = hm.inheritFromMain ? config.hotelsMeals.hotelCostPerNight : hm.hotelCostPerNight;
    const lunchRate = hm.inheritFromMain ? config.hotelsMeals.lunchCostPerDay : hm.lunchCostPerDay;
    const dinnerRate = hm.inheritFromMain ? config.hotelsMeals.dinnerCostPerNight : hm.dinnerCostPerNight;
    const additionalMeals = hm.inheritFromMain ? config.hotelsMeals.additionalMealCosts : hm.additionalMealCosts;

    extensionHotelsCost = hotelRate * extension.extensionNights * extPaxCount;
    extensionMealsCost = (lunchRate + dinnerRate) * extension.extensionNights * extPaxCount + additionalMeals;
  }

  // Staff
  let extensionStaffCost = 0;
  if (extension.staffConfig.enabled !== false) {
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

  const extensionTotalCost = extensionHotelsCost + extensionMealsCost + extensionStaffCost + extensionSingleRoomCost;

  return {
    extensionRevenue,
    extensionSingleSuppRevenue,
    extensionHotelsCost,
    extensionMealsCost,
    extensionStaffCost,
    extensionSingleRoomCost,
    extensionTotalCost,
  };
}

// Calculate trip-specific cost with per-pax option
function calculateTripSpecificCost(pax: number, config: TripConfiguration): number {
  const { tripSpecific } = config;
  let total = 0;

  const costs = [
    tripSpecific.permits,
    tripSpecific.equipment,
    tripSpecific.jacketsApparel,
    tripSpecific.insurance,
    tripSpecific.contingency,
    tripSpecific.otherCosts,
  ];

  for (const cost of costs) {
    total += cost.perPax ? cost.amount * pax : cost.amount;
  }

  return total;
}

// Calculate all values for a specific pax count
export function calculateForPax(pax: number, config: TripConfiguration): PaxCalculation {
  const effectivePrice = config.tripPrice;

  // Revenue calculations
  const baseRevenue = effectivePrice * pax;

  // Discounts (gated, clamped to pax count)
  const discountsOn = config.discountsEnabled !== false;
  const earlyBirdCount = discountsOn ? Math.min(config.earlyBirdCountByPax?.[pax] || 0, pax) : 0;
  const earlyBirdCost = config.earlyBirdDiscount * earlyBirdCount;
  const loyaltyCount = discountsOn ? Math.min(config.loyaltyCountByPax?.[pax] || 0, pax) : 0;
  const loyaltyCost = effectivePrice * loyaltyCount * config.loyaltyDiscountRate;

  // Single supplement (gated, clamped to pax count)
  const singleSuppOn = config.singleSupplement.enabled !== false;
  const singleSupplementGuests = singleSuppOn ? Math.min(config.singleSupplement.countByPax?.[pax] ?? 0, pax) : 0;
  const singleSupplementRevenue = singleSuppOn ? config.singleSupplement.singleSupplement * singleSupplementGuests : 0;

  // Extension
  const ext = calculateExtension(pax, config);

  const totalRevenue = baseRevenue - earlyBirdCost - loyaltyCost + singleSupplementRevenue
    + ext.extensionRevenue + ext.extensionSingleSuppRevenue;

  // Hotels & meals (gated)
  const hotelsMealsOn = config.hotelsMeals.enabled !== false;
  const hotelsCost = hotelsMealsOn ? config.hotelsMeals.hotelCostPerNight * config.tripNights * pax : 0;
  const lunchCost = hotelsMealsOn ? config.hotelsMeals.lunchCostPerDay * config.tripDays * pax : 0;
  const dinnerCost = hotelsMealsOn ? config.hotelsMeals.dinnerCostPerNight * config.tripNights * pax : 0;
  const mealsCost = hotelsMealsOn ? lunchCost + dinnerCost + config.hotelsMeals.additionalMealCosts : 0;

  // Logistics (gated)
  const logisticsOn = config.logistics.enabled !== false;
  const logisticsRate = getLogisticsRate(pax, config.logistics);
  const logisticsCost = logisticsOn
    ? (config.logistics.perPax ? logisticsRate * config.tripDays * pax : logisticsRate * config.tripDays)
    : 0;

  // Staff (gated)
  const staffOn = config.staffConfig.enabled !== false;
  const staffCost = staffOn ? calculateStaffCost(pax, config) : 0;

  // Transport (gated)
  const transportOn = config.transportConfig.enabled !== false;
  const flightCost = transportOn ? config.transportConfig.flightCostPerPerson * pax : 0;
  const groundTransport = transportOn
    ? (config.transportConfig.groundTransportPerPax
      ? config.transportConfig.groundTransportTotal * pax
      : config.transportConfig.groundTransportTotal)
    : 0;
  const transportCost = transportOn
    ? flightCost + groundTransport + config.transportConfig.airportTransfers + config.transportConfig.localTransport
    : 0;

  // Trip-specific (gated)
  const tripSpecificOn = config.tripSpecific.enabled !== false;
  const tripSpecificCost = tripSpecificOn ? calculateTripSpecificCost(pax, config) : 0;

  // Single room extra cost (gated with single supplement)
  const singleRoomCost = singleSuppOn ? config.singleSupplement.singleRoomExtra * singleSupplementGuests * config.tripNights : 0;

  // Total costs
  const totalCosts = hotelsCost + mealsCost + logisticsCost + staffCost +
    transportCost + tripSpecificCost + singleRoomCost + ext.extensionTotalCost;

  // Profit calculations
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
    hotelsCost,
    mealsCost,
    logisticsCost,
    staffCost,
    transportCost,
    tripSpecificCost,
    singleRoomCost,
    totalCosts,
    extensionRevenue: ext.extensionRevenue,
    extensionSingleSuppRevenue: ext.extensionSingleSuppRevenue,
    extensionHotelsCost: ext.extensionHotelsCost,
    extensionMealsCost: ext.extensionMealsCost,
    extensionStaffCost: ext.extensionStaffCost,
    extensionSingleRoomCost: ext.extensionSingleRoomCost,
    extensionTotalCost: ext.extensionTotalCost,
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
  if (margin >= 30) return 'text-ag-success';
  if (margin >= 20) return 'text-ag-warning';
  return 'text-ag-danger';
}

// Get profit color class based on value
export function getProfitColor(profit: number): string {
  if (profit > 0) return 'text-ag-success';
  if (profit === 0) return 'text-ag-warning';
  return 'text-ag-danger';
}
