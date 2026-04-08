import { TripConfiguration, PaxCalculation, LogisticsConfig, StaffMember, FinancialBreakdown } from './types';

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
    // When inheriting, always use extensionNights; when custom, respect hotelNights override
    const extHotelNights = hm.inheritFromMain
      ? extension.extensionNights
      : (hm.hotelNights ?? extension.extensionNights);
    // Additional hotels only apply in custom mode
    const extAdditionalHotels = hm.inheritFromMain ? [] : (hm.additionalHotels || []);

    if (extHmMode === 'perPaxPerNight') {
      extensionHotelsCost = hotelRate * extHotelNights * extPaxCount;
      for (const h of extAdditionalHotels) extensionHotelsCost += h.ratePerNight * h.nights * extPaxCount;
      extensionMealsCost = (lunchRate + dinnerRate) * extension.extensionNights * extPaxCount + additionalMeals;
    } else if (extHmMode === 'perNight') {
      extensionHotelsCost = hotelRate * extHotelNights;
      for (const h of extAdditionalHotels) extensionHotelsCost += h.ratePerNight * h.nights;
      extensionMealsCost = (lunchRate + dinnerRate) * extension.extensionNights + additionalMeals;
    } else if (extHmMode === 'perPax') {
      extensionHotelsCost = hotelRate * extPaxCount;
      for (const h of extAdditionalHotels) extensionHotelsCost += h.ratePerNight * extPaxCount;
      extensionMealsCost = (lunchRate + dinnerRate) * extPaxCount + additionalMeals;
    } else {
      extensionHotelsCost = hotelRate;
      for (const h of extAdditionalHotels) extensionHotelsCost += h.ratePerNight;
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
      // Staff meals: inherit from main config
      const mealsAmount = config.staffConfig.staffMealsCost || 0;
      const mealsMode = config.staffConfig.staffMealsMode || 'perDay';
      const totalStaffCount = mainStaff.reduce((sum, s) => sum + s.quantity, 0);
      if (mealsMode === 'perDayPerGuide') extensionStaffCost += mealsAmount * extension.extensionNights * totalStaffCount;
      else if (mealsMode === 'perDay') extensionStaffCost += mealsAmount * extension.extensionNights;
      else extensionStaffCost += mealsAmount;
    } else {
      const staff = sc.staffByPax[pax] || [];
      extensionStaffCost = calculateStaffCostFromArray(staff, sc.travelDays, sc.travelDayRate);
      // Staff meals: use extension's own config
      const mealsAmount = sc.staffMealsCost || 0;
      const mealsMode = sc.staffMealsMode || 'perDay';
      const totalStaffCount = staff.reduce((sum, s) => sum + s.quantity, 0);
      if (mealsMode === 'perDayPerGuide') extensionStaffCost += mealsAmount * extension.extensionNights * totalStaffCount;
      else if (mealsMode === 'perDay') extensionStaffCost += mealsAmount * extension.extensionNights;
      else extensionStaffCost += mealsAmount;
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
    else if (mode === 'perPax') extensionLogisticsCost = rate * extPaxCount;
    else if (mode === 'total') extensionLogisticsCost = rate;
    else extensionLogisticsCost = rate * extension.extensionNights;
    // Guide logistics rate (sub-section, gated with extension logistics)
    const gl = lc.inheritFromMain ? config.logistics.guideLogistics : lc.guideLogistics;
    if (gl) {
      const guideRateMatch = gl.rates?.find(r => r.pax === pax);
      const guideRate = guideRateMatch ? guideRateMatch.rate : 0;
      const guideMode = gl.mode || 'perDay';
      if (guideMode === 'perPaxPerDay') extensionLogisticsCost += guideRate * extension.extensionNights * extPaxCount;
      else if (guideMode === 'perPax') extensionLogisticsCost += guideRate * extPaxCount;
      else if (guideMode === 'total') extensionLogisticsCost += guideRate;
      else extensionLogisticsCost += guideRate * extension.extensionNights;
    }
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

  for (const cc of (config.tripSpecific.customCosts || [])) {
    total += cc.perPax ? cc.amount * pax : cc.amount;
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
  const discountsAM = config.discountsActiveMode;
  const earlyBirdCount = discountsOn ? Math.min(
    discountsAM === 'simple' ? (config.earlyBirdCountSimple ?? 0)
    : discountsAM === 'perPax' ? (config.earlyBirdCountByPax?.[pax] || 0)
    : (config.earlyBirdCountByPax?.[pax] || 0), // legacy: use byPax
    pax
  ) : 0;
  let earlyBirdCost = config.earlyBirdDiscount * earlyBirdCount;
  for (const tier of (config.earlyBirdTiers || [])) {
    const tierCount = discountsOn ? Math.min(
      discountsAM === 'simple' ? (tier.countSimple ?? 0)
      : discountsAM === 'perPax' ? (tier.countByPax?.[pax] || 0)
      : (tier.countByPax?.[pax] || 0),
      pax
    ) : 0;
    earlyBirdCost += tier.discount * tierCount;
  }
  const loyaltyCount = discountsOn ? Math.min(
    discountsAM === 'simple' ? (config.loyaltyCountSimple ?? 0)
    : discountsAM === 'perPax' ? (config.loyaltyCountByPax?.[pax] || 0)
    : (config.loyaltyCountByPax?.[pax] || 0),
    pax
  ) : 0;
  const loyaltyCost = perPersonPrice * loyaltyCount * config.loyaltyDiscountRate;

  // Single supplement (gated, clamped to pax count)
  const singleSuppOn = config.singleSupplement.enabled !== false;
  const ssAM = config.singleSupplement.activeMode;
  const singleSupplementGuests = singleSuppOn ? Math.min(
    ssAM === 'simple' ? (config.singleSupplement.countSimple ?? 0)
    : ssAM === 'perPax' ? (config.singleSupplement.countByPax?.[pax] ?? 0)
    : (config.singleSupplement.countByPax?.[pax] ?? 0), // legacy: use byPax
    pax
  ) : 0;
  const singleSupplementRevenue = singleSuppOn ? config.singleSupplement.singleSupplement * singleSupplementGuests : 0;

  // Extension
  const ext = calculateExtension(pax, config);

  const totalRevenue = baseRevenue - earlyBirdCost - loyaltyCost + singleSupplementRevenue
    + ext.extensionRevenue + ext.extensionSingleSuppRevenue - ext.extensionDiscountCost;

  // Hotels & meals (gated, with mode, with activeMode-controlled dataset selection)
  const hotelsMealsOn = config.hotelsMeals.enabled !== false;
  const hmAM = config.hotelsMeals.activeMode;
  const hmMode = config.hotelsMeals.mode || 'perPaxPerNight';
  const hmHotelRate = hmAM === 'simple' ? config.hotelsMeals.hotelCostPerNight
    : hmAM === 'perPax' ? (config.hotelsMeals.hotelCostByPax?.[pax] ?? config.hotelsMeals.hotelCostPerNight)
    : (config.hotelsMeals.hotelCostByPax?.[pax] ?? config.hotelsMeals.hotelCostPerNight); // legacy
  const hmLunchRate = hmAM === 'simple' ? config.hotelsMeals.lunchCostPerDay
    : hmAM === 'perPax' ? (config.hotelsMeals.lunchCostByPax?.[pax] ?? config.hotelsMeals.lunchCostPerDay)
    : (config.hotelsMeals.lunchCostByPax?.[pax] ?? config.hotelsMeals.lunchCostPerDay);
  const hmDinnerRate = hmAM === 'simple' ? config.hotelsMeals.dinnerCostPerNight
    : hmAM === 'perPax' ? (config.hotelsMeals.dinnerCostByPax?.[pax] ?? config.hotelsMeals.dinnerCostPerNight)
    : (config.hotelsMeals.dinnerCostByPax?.[pax] ?? config.hotelsMeals.dinnerCostPerNight);
  const hmAdditional = hmAM === 'simple' ? config.hotelsMeals.additionalMealCosts
    : hmAM === 'perPax' ? (config.hotelsMeals.additionalMealCostsByPax?.[pax] ?? config.hotelsMeals.additionalMealCosts)
    : (config.hotelsMeals.additionalMealCostsByPax?.[pax] ?? config.hotelsMeals.additionalMealCosts);
  const hmHotelNights = config.hotelsMeals.hotelNights ?? config.tripNights;
  const hmAdditionalHotels = config.hotelsMeals.additionalHotels || [];
  let hotelsCost = 0;
  let mealsCost = 0;
  if (hotelsMealsOn) {
    if (hmMode === 'perPaxPerNight') {
      hotelsCost = hmHotelRate * hmHotelNights * pax;
      for (const h of hmAdditionalHotels) hotelsCost += h.ratePerNight * h.nights * pax;
      mealsCost = (hmLunchRate * config.tripDays + hmDinnerRate * config.tripNights) * pax + hmAdditional;
    } else if (hmMode === 'perNight') {
      hotelsCost = hmHotelRate * hmHotelNights;
      for (const h of hmAdditionalHotels) hotelsCost += h.ratePerNight * h.nights;
      mealsCost = hmLunchRate * config.tripDays + hmDinnerRate * config.tripNights + hmAdditional;
    } else if (hmMode === 'perPax') {
      hotelsCost = hmHotelRate * pax;
      for (const h of hmAdditionalHotels) hotelsCost += h.ratePerNight * pax;
      mealsCost = (hmLunchRate + hmDinnerRate) * pax + hmAdditional;
    } else {
      hotelsCost = hmHotelRate;
      for (const h of hmAdditionalHotels) hotelsCost += h.ratePerNight;
      mealsCost = hmLunchRate + hmDinnerRate + hmAdditional;
    }
  }

  // Logistics (gated)
  const logisticsOn = config.logistics.enabled !== false;
  const logAM = config.logistics.activeMode;
  const logisticsRate = logAM === 'simple' ? config.logistics.baseRate
    : getLogisticsRate(pax, config.logistics); // per-pax or legacy: use rates array
  const logisticsMode = config.logistics.mode || (config.logistics.perPax ? 'perPaxPerDay' : 'perDay');
  let logisticsCost = 0;
  if (logisticsOn) {
    if (logisticsMode === 'perPaxPerDay') logisticsCost = logisticsRate * config.tripDays * pax;
    else if (logisticsMode === 'perPax') logisticsCost = logisticsRate * pax;
    else if (logisticsMode === 'total') logisticsCost = logisticsRate;
    else logisticsCost = logisticsRate * config.tripDays;
    // Guide logistics rate (sub-section, gated with main logistics)
    const gl = config.logistics.guideLogistics;
    if (gl) {
      const guideRateMatch = gl.rates?.find(r => r.pax === pax);
      const guideRate = guideRateMatch ? guideRateMatch.rate : 0;
      const guideMode = gl.mode || 'perDay';
      if (guideMode === 'perPaxPerDay') logisticsCost += guideRate * config.tripDays * pax;
      else if (guideMode === 'perPax') logisticsCost += guideRate * pax;
      else if (guideMode === 'total') logisticsCost += guideRate;
      else logisticsCost += guideRate * config.tripDays;
    }
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
  const tAM = config.transportConfig.activeMode;
  let transportCost = 0;
  if (transportOn) {
    const groundRate = tAM === 'simple'
      ? (config.transportConfig.groundTransportTotal || 0)
      : ((config.transportConfig.groundTransportByPax?.[pax] ?? config.transportConfig.groundTransportTotal) || 0);
    const airportRate = tAM === 'simple'
      ? (config.transportConfig.airportTransfers || 0)
      : ((config.transportConfig.airportTransfersByPax?.[pax] ?? config.transportConfig.airportTransfers) || 0);
    const localRate = tAM === 'simple'
      ? (config.transportConfig.localTransport || 0)
      : ((config.transportConfig.localTransportByPax?.[pax] ?? config.transportConfig.localTransport) || 0);
    transportCost += config.transportConfig.groundTransportPerPax ? groundRate * pax : groundRate;
    transportCost += config.transportConfig.airportTransfersPerPax ? airportRate * pax : airportRate;
    transportCost += config.transportConfig.localTransportPerPax ? localRate * pax : localRate;
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

// Map a PaxCalculation to the six financial reporting categories
export function calculateFinancialBreakdown(pax: number, config: TripConfiguration): FinancialBreakdown {
  const calc = calculateForPax(pax, config);
  const inflationMultiplier = Math.max(0, 1 + (config.inflationRate || 0));
  const tripSpecificOn = config.tripSpecific.enabled !== false;

  const calcTsItem = (item: { amount: number; perPax: boolean; percentOfRevenue?: boolean; active?: boolean }): number => {
    if (item.active === false) return 0;
    if (item.percentOfRevenue) return item.amount * calc.totalRevenue;
    return item.perPax ? item.amount * pax : item.amount;
  };

  let commercialLicensing = 0;
  let tripSupplies = 0;
  let otherTripCosts = 0;

  if (tripSpecificOn) {
    const ts = config.tripSpecific;
    commercialLicensing = calcTsItem(ts.permits) * inflationMultiplier;
    tripSupplies = (
      calcTsItem(ts.equipment) +
      calcTsItem(ts.jacketsApparel) +
      calcTsItem(ts.hypoxico || { amount: 0, perPax: false })
    ) * inflationMultiplier;
    const customTotal = (ts.customCosts || []).reduce(
      (sum, cc) => sum + (cc.perPax ? cc.amount * pax : cc.amount), 0
    );
    otherTripCosts = (
      calcTsItem(ts.insurance) +
      calcTsItem(ts.contingency) +
      calcTsItem(ts.otherCosts) +
      customTotal
    ) * inflationMultiplier;
  }

  const tripTravelLogistics =
    calc.transportCost +
    calc.logisticsCost +
    calc.hotelsCost +
    calc.mealsCost +
    calc.singleRoomCost +
    calc.extensionLogisticsCost +
    calc.extensionHotelsCost +
    calc.extensionMealsCost +
    calc.extensionSingleRoomCost +
    calc.guideFlightsCost;

  const guideWages =
    calc.staffCost +
    calc.staffMealsCost +
    calc.extensionStaffCost;

  return {
    tripTravelLogistics,
    guideWages,
    tripSupplies,
    commercialLicensing,
    tripCommunications: 0,
    otherTripCosts,
    total: calc.totalCosts,
  };
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
