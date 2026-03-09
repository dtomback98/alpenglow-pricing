/**
 * Comprehensive tests for Trip-Specific Costs calculations
 * Covers: fixed fields, active/inactive, custom costs, per-pax,
 * % of revenue, section disabled, and full flow to totalCosts/grossProfit.
 */

let passed = 0, failed = 0;

function assert(label, actual, expected, tol = 0.01) {
  const ok = Math.abs(actual - expected) <= tol;
  if (ok) { console.log(`  ✅ ${label}: ${actual}`); passed++; }
  else     { console.log(`  ❌ ${label}: got ${actual}, expected ${expected}`); failed++; }
}

// ── Exact mirror of calculateTripSpecificCost in calculations.ts ──────────────
function calculateTripSpecificCost(pax, config, totalRevenue) {
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
  for (const cc of (tripSpecific.customCosts || [])) {
    total += cc.perPax ? cc.amount * pax : cc.amount;
  }
  return total;
}

// ── Minimal calculateForPax mirror (no ext/logistics/staff/transport for clarity) ──
function calculateForPax(pax, config) {
  const inflationMultiplier = Math.max(0, 1 + (config.inflationRate || 0));
  const effectivePrice = config.tripPriceByPax?.[pax] ?? config.tripPrice;
  const isTotalPricing = config.tripPriceMode === 'total' && !config.tripPriceByPax;
  const baseRevenue = isTotalPricing ? effectivePrice : effectivePrice * pax;

  // discounts
  const discountsOn = config.discountsEnabled !== false;
  const ebCount = discountsOn ? Math.min(config.earlyBirdCountByPax?.[pax] || 0, pax) : 0;
  const earlyBirdCost = (config.earlyBirdDiscount || 0) * ebCount;
  const loyaltyCount = discountsOn ? Math.min(config.loyaltyCountByPax?.[pax] || 0, pax) : 0;
  const perPersonPrice = isTotalPricing ? (pax > 0 ? effectivePrice / pax : 0) : effectivePrice;
  const loyaltyCost = perPersonPrice * loyaltyCount * (config.loyaltyDiscountRate || 0);

  const totalRevenue = baseRevenue - earlyBirdCost - loyaltyCost;

  const tripSpecificOn = config.tripSpecific.enabled !== false;
  const rawTripSpecific = tripSpecificOn ? calculateTripSpecificCost(pax, config, totalRevenue) : 0;
  const tripSpecificCost = rawTripSpecific * inflationMultiplier;

  // Hotels (simple perPaxPerNight)
  const hm = config.hotelsMeals || {};
  const hmOn = hm.enabled !== false;
  const hotelsCost = hmOn ? (hm.hotelCostPerNight || 0) * (config.tripNights || 0) * pax * inflationMultiplier : 0;

  const totalCosts = hotelsCost + tripSpecificCost;
  const grossProfit = totalRevenue - totalCosts;
  const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  return { pax, baseRevenue, totalRevenue, tripSpecificCost, hotelsCost, totalCosts, grossProfit, margin };
}

// ── Base config shared across tests ──────────────────────────────────────────
const BASE_TRIP_SPECIFIC = {
  enabled: true,
  permits:       { amount: 500,  perPax: false },
  equipment:     { amount: 300,  perPax: false },
  jacketsApparel:{ amount: 150,  perPax: true  },
  insurance:     { amount: 200,  perPax: true  },
  contingency:   { amount: 1000, perPax: false },
  hypoxico:      { amount: 0,    perPax: false },
  otherCosts:    { amount: 0,    perPax: false },
  customCosts:   [],
};

function makeConfig(overrides = {}) {
  return {
    tripPrice: 5000,
    tripDays: 9,
    tripNights: 8,
    inflationRate: 0,
    discountsEnabled: false,
    earlyBirdDiscount: 0,
    earlyBirdCountByPax: {},
    loyaltyDiscountRate: 0,
    loyaltyCountByPax: {},
    hotelsMeals: { enabled: false },
    tripSpecific: { ...BASE_TRIP_SPECIFIC, customCosts: [] },
    ...overrides,
    tripSpecific: { ...BASE_TRIP_SPECIFIC, customCosts: [], ...(overrides.tripSpecific || {}) },
  };
}


// ═════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════════');
console.log('1. FIXED FIELDS — ALL ACTIVE');
console.log('══════════════════════════════════════════════════════');
// At pax=8: permits(500) + equipment(300) + jackets(150*8=1200) + insurance(200*8=1600) + contingency(1000) = 4600
{
  const config = makeConfig();
  const result = calculateTripSpecificCost(8, config, 40000);
  assert('All active at pax=8', result, 500 + 300 + 150*8 + 200*8 + 1000);

  const r4 = calculateTripSpecificCost(4, config, 20000);
  assert('All active at pax=4', r4, 500 + 300 + 150*4 + 200*4 + 1000);
}

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════════');
console.log('2. DELETED FIELDS (active: false) EXCLUDED');
console.log('══════════════════════════════════════════════════════');
{
  // Delete permits
  const config = makeConfig({ tripSpecific: { ...BASE_TRIP_SPECIFIC, permits: { amount: 500, perPax: false, active: false }, customCosts: [] } });
  const result = calculateTripSpecificCost(8, config, 40000);
  assert('permits deleted: excluded from sum', result, 300 + 150*8 + 200*8 + 1000);

  // Delete insurance
  const c2 = makeConfig({ tripSpecific: { ...BASE_TRIP_SPECIFIC, insurance: { amount: 200, perPax: true, active: false }, customCosts: [] } });
  const r2 = calculateTripSpecificCost(8, c2, 40000);
  assert('insurance deleted: excluded', r2, 500 + 300 + 150*8 + 1000);

  // Delete multiple: permits + equipment + contingency
  const c3 = makeConfig({ tripSpecific: {
    ...BASE_TRIP_SPECIFIC,
    permits:    { amount: 500,  perPax: false, active: false },
    equipment:  { amount: 300,  perPax: false, active: false },
    contingency:{ amount: 1000, perPax: false, active: false },
    customCosts: [],
  }});
  const r3 = calculateTripSpecificCost(8, c3, 40000);
  assert('3 fields deleted: only jackets+insurance remain', r3, 150*8 + 200*8);

  // Delete ALL fixed fields
  const c4 = makeConfig({ tripSpecific: {
    enabled: true,
    permits:       { amount: 500,  perPax: false, active: false },
    equipment:     { amount: 300,  perPax: false, active: false },
    jacketsApparel:{ amount: 150,  perPax: true,  active: false },
    insurance:     { amount: 200,  perPax: true,  active: false },
    contingency:   { amount: 1000, perPax: false, active: false },
    hypoxico:      { amount: 0,    perPax: false, active: false },
    otherCosts:    { amount: 0,    perPax: false, active: false },
    customCosts: [],
  }});
  const r4 = calculateTripSpecificCost(8, c4, 40000);
  assert('all fixed fields deleted: zero', r4, 0);
}

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════════');
console.log('3. CUSTOM COSTS — FLAT');
console.log('══════════════════════════════════════════════════════');
{
  const config = makeConfig({ tripSpecific: {
    ...BASE_TRIP_SPECIFIC,
    customCosts: [{ id: '1', label: 'Everest KPCB Permit', amount: 11000, perPax: false }],
  }});
  const result = calculateTripSpecificCost(8, config, 40000);
  const fixedBase = 500 + 300 + 150*8 + 200*8 + 1000;
  assert('flat custom cost added', result, fixedBase + 11000);

  // Multiple custom flat costs
  const c2 = makeConfig({ tripSpecific: {
    ...BASE_TRIP_SPECIFIC,
    customCosts: [
      { id: '1', label: 'KPCB Permit', amount: 11000, perPax: false },
      { id: '2', label: 'Base Camp Fee', amount: 2500, perPax: false },
    ],
  }});
  const r2 = calculateTripSpecificCost(8, c2, 40000);
  assert('two flat custom costs added', r2, fixedBase + 11000 + 2500);
}

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════════');
console.log('4. CUSTOM COSTS — PER PAX');
console.log('══════════════════════════════════════════════════════');
{
  const config = makeConfig({ tripSpecific: {
    ...BASE_TRIP_SPECIFIC,
    customCosts: [{ id: '1', label: 'Oxygen Set', amount: 800, perPax: true }],
  }});
  const r8 = calculateTripSpecificCost(8, config, 40000);
  const r4 = calculateTripSpecificCost(4, config, 20000);
  const fixedAt8 = 500 + 300 + 150*8 + 200*8 + 1000;
  const fixedAt4 = 500 + 300 + 150*4 + 200*4 + 1000;
  assert('per-pax custom at pax=8: +800*8', r8, fixedAt8 + 800*8);
  assert('per-pax custom at pax=4: +800*4', r4, fixedAt4 + 800*4);
  assert('per-pax custom scales linearly', r8 - fixedAt8, 2 * (r4 - fixedAt4));
}

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════════');
console.log('5. INSURANCE — PERCENT OF REVENUE');
console.log('══════════════════════════════════════════════════════');
{
  const totalRevenue = 40000;
  const config = makeConfig({ tripSpecific: {
    ...BASE_TRIP_SPECIFIC,
    insurance: { amount: 0.05, perPax: false, percentOfRevenue: true },
    customCosts: [],
  }});
  const result = calculateTripSpecificCost(8, config, totalRevenue);
  // 5% of 40000 = 2000; plus permits(500)+equipment(300)+jackets(150*8=1200)+contingency(1000) = 5000
  assert('5% of revenue insurance', result, 500 + 300 + 150*8 + 0.05*40000 + 1000);

  // Insurance % at different revenue levels
  const r2 = calculateTripSpecificCost(8, config, 60000);
  assert('5% of higher revenue', r2, 500 + 300 + 150*8 + 0.05*60000 + 1000);

  // Insurance % with active: false (deleted)
  const c3 = makeConfig({ tripSpecific: {
    ...BASE_TRIP_SPECIFIC,
    insurance: { amount: 0.05, perPax: false, percentOfRevenue: true, active: false },
    customCosts: [],
  }});
  const r3 = calculateTripSpecificCost(8, c3, 40000);
  assert('% insurance deleted: excluded', r3, 500 + 300 + 150*8 + 1000);
}

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════════');
console.log('6. SECTION DISABLED');
console.log('══════════════════════════════════════════════════════');
{
  const config = makeConfig({ tripSpecific: { ...BASE_TRIP_SPECIFIC, enabled: false, customCosts: [] } });
  // calculateForPax gates on enabled flag
  const calc = calculateForPax(8, config);
  assert('section disabled: tripSpecificCost = 0', calc.tripSpecificCost, 0);
  assert('section disabled: totalCosts unaffected by tripSpecific', calc.totalCosts, calc.hotelsCost);
}

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════════');
console.log('7. MIX: DELETED FIELDS + CUSTOM COSTS + % INSURANCE');
console.log('══════════════════════════════════════════════════════');
{
  const totalRevenue = 8 * 5000; // 40000
  const config = makeConfig({ tripSpecific: {
    enabled: true,
    permits:       { amount: 11000, perPax: false },           // Everest-style permit
    equipment:     { amount: 300,   perPax: false, active: false }, // deleted
    jacketsApparel:{ amount: 150,   perPax: true,  active: false }, // deleted
    insurance:     { amount: 0.03,  perPax: false, percentOfRevenue: true }, // 3% of rev
    contingency:   { amount: 2000,  perPax: false },
    hypoxico:      { amount: 500,   perPax: false },
    otherCosts:    { amount: 0,     perPax: false },
    customCosts: [
      { id: '1', label: 'Sherpa wages', amount: 1200, perPax: false },
      { id: '2', label: 'Oxygen per pax', amount: 800, perPax: true },
    ],
  }});
  const result = calculateTripSpecificCost(8, config, totalRevenue);
  const expected =
    11000 +                         // permits
    // equipment: deleted
    // jackets: deleted
    0.03 * totalRevenue +           // insurance 3% of rev
    2000 +                          // contingency
    500 +                           // hypoxico
    // otherCosts: 0
    1200 +                          // custom: Sherpa wages
    800 * 8;                        // custom: Oxygen per pax
  assert('Everest mix at pax=8', result, expected);

  // Same config at pax=4
  const r4 = calculateTripSpecificCost(4, config, 4 * 5000);
  const exp4 =
    11000 +
    0.03 * (4 * 5000) +
    2000 +
    500 +
    1200 +
    800 * 4;
  assert('Everest mix at pax=4', r4, exp4);
}

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════════');
console.log('8. FLOW TO totalCosts / grossProfit');
console.log('══════════════════════════════════════════════════════');
{
  // Verify tripSpecificCost is included in totalCosts and affects grossProfit
  const configNoTrip = makeConfig({ tripSpecific: { ...BASE_TRIP_SPECIFIC, enabled: false, customCosts: [] } });
  const configWithTrip = makeConfig({ tripSpecific: {
    ...BASE_TRIP_SPECIFIC,
    customCosts: [{ id: '1', label: 'Special Fee', amount: 5000, perPax: false }],
  }});

  const calcNo  = calculateForPax(8, configNoTrip);
  const calcWith = calculateForPax(8, configWithTrip);

  const fixedCosts = 500 + 300 + 150*8 + 200*8 + 1000;
  const customExtra = 5000;

  assert('tripSpecificCost = fixed + custom', calcWith.tripSpecificCost, fixedCosts + customExtra);
  assert('totalCosts includes tripSpecific', calcWith.totalCosts - calcNo.totalCosts, calcWith.tripSpecificCost);
  assert('grossProfit reduced by tripSpecific', calcNo.grossProfit - calcWith.grossProfit, calcWith.tripSpecificCost);
}

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════════');
console.log('9. INFLATION MULTIPLIER APPLIES TO TRIP-SPECIFIC');
console.log('══════════════════════════════════════════════════════');
{
  const configNoInf = makeConfig({ inflationRate: 0, tripSpecific: {
    ...BASE_TRIP_SPECIFIC, customCosts: [{ id: '1', label: 'Fee', amount: 1000, perPax: false }],
  }});
  const configInf = makeConfig({ inflationRate: 0.10, tripSpecific: {
    ...BASE_TRIP_SPECIFIC, customCosts: [{ id: '1', label: 'Fee', amount: 1000, perPax: false }],
  }});

  const calcNo  = calculateForPax(8, configNoInf);
  const calcInf = calculateForPax(8, configInf);

  assert('10% inflation multiplies tripSpecificCost', calcInf.tripSpecificCost, calcNo.tripSpecificCost * 1.10);
  assert('revenue unchanged by inflation', calcNo.totalRevenue, calcInf.totalRevenue);
}

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════════');
console.log('10. TRIP TYPE SIMULATIONS');
console.log('══════════════════════════════════════════════════════');

{
  console.log('\n  [A] Alpine beginner trip — minimal fixed costs');
  // Permits only, no custom costs
  const config = makeConfig({ tripSpecific: {
    enabled: true,
    permits:       { amount: 50,  perPax: false },
    equipment:     { amount: 0,   perPax: false },
    jacketsApparel:{ amount: 0,   perPax: false },
    insurance:     { amount: 0,   perPax: false },
    contingency:   { amount: 200, perPax: false },
    hypoxico:      { amount: 0,   perPax: false },
    otherCosts:    { amount: 0,   perPax: false },
    customCosts:   [],
  }});
  assert('Beginner pax=6', calculateTripSpecificCost(6, config, 18000), 50 + 200);

  console.log('\n  [B] Ski trip — jackets + contingency, no insurance');
  const ski = makeConfig({ tripSpecific: {
    enabled: true,
    permits:       { amount: 0,   perPax: false, active: false },
    equipment:     { amount: 0,   perPax: false, active: false },
    jacketsApparel:{ amount: 200, perPax: true  },
    insurance:     { amount: 0,   perPax: false, active: false },
    contingency:   { amount: 500, perPax: false },
    hypoxico:      { amount: 0,   perPax: false, active: false },
    otherCosts:    { amount: 0,   perPax: false, active: false },
    customCosts: [{ id: '1', label: 'Lift passes', amount: 120, perPax: true }],
  }});
  assert('Ski pax=8: jackets+contingency+lifts', calculateTripSpecificCost(8, ski, 32000), 200*8 + 500 + 120*8);
  assert('Ski pax=4: scales correctly', calculateTripSpecificCost(4, ski, 16000), 200*4 + 500 + 120*4);

  console.log('\n  [C] Everest expedition — high custom costs, % insurance');
  const everest = makeConfig({ tripSpecific: {
    enabled: true,
    permits:       { amount: 11000, perPax: false },
    equipment:     { amount: 500,   perPax: true  },
    jacketsApparel:{ amount: 300,   perPax: true  },
    insurance:     { amount: 0.04,  perPax: false, percentOfRevenue: true },
    contingency:   { amount: 5000,  perPax: false },
    hypoxico:      { amount: 250,   perPax: true  },
    otherCosts:    { amount: 1000,  perPax: false },
    customCosts: [
      { id: '1', label: 'Sherpa team', amount: 15000, perPax: false },
      { id: '2', label: 'Oxygen sets', amount: 900,   perPax: true  },
      { id: '3', label: 'Base camp cook', amount: 3000, perPax: false },
    ],
  }});
  const pax = 12;
  const rev = pax * 55000;
  const expected =
    11000 +
    500 * pax +
    300 * pax +
    0.04 * rev +
    5000 +
    250 * pax +
    1000 +
    15000 +
    900 * pax +
    3000;
  assert(`Everest pax=${pax}`, calculateTripSpecificCost(pax, everest, rev), expected);

  // Verify it changes correctly at pax=8
  const pax2 = 8;
  const rev2 = pax2 * 55000;
  const exp2 = 11000 + 500*pax2 + 300*pax2 + 0.04*rev2 + 5000 + 250*pax2 + 1000 + 15000 + 900*pax2 + 3000;
  assert(`Everest pax=${pax2}`, calculateTripSpecificCost(pax2, everest, rev2), exp2);
}

// ═════════════════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════════');
console.log('11. EDGE CASES');
console.log('══════════════════════════════════════════════════════');
{
  // No custom costs key (undefined) — backward compat
  const config = makeConfig();
  delete config.tripSpecific.customCosts;
  assert('missing customCosts key: treated as []', calculateTripSpecificCost(8, config, 40000), 500 + 300 + 150*8 + 200*8 + 1000);

  // Custom cost with amount = 0
  const c2 = makeConfig({ tripSpecific: {
    ...BASE_TRIP_SPECIFIC,
    customCosts: [{ id: '1', label: 'Zero fee', amount: 0, perPax: false }],
  }});
  const r2 = calculateTripSpecificCost(8, c2, 40000);
  assert('custom cost amount=0: no change', r2, 500 + 300 + 150*8 + 200*8 + 1000);

  // All fields active:true (explicitly set, not undefined)
  const c3 = makeConfig({ tripSpecific: {
    ...BASE_TRIP_SPECIFIC,
    permits: { amount: 500, perPax: false, active: true },
    customCosts: [],
  }});
  assert('active:true treated same as active:undefined', calculateTripSpecificCost(8, c3, 40000), 500 + 300 + 150*8 + 200*8 + 1000);

  // hypoxico missing (old DB rows) — falls back to {amount:0, perPax:false}
  const c4 = makeConfig({ tripSpecific: { ...BASE_TRIP_SPECIFIC, customCosts: [] } });
  delete c4.tripSpecific.hypoxico;
  assert('hypoxico missing: treated as 0', calculateTripSpecificCost(8, c4, 40000), 500 + 300 + 150*8 + 200*8 + 1000);

  // Pax = 1 edge case
  assert('pax=1 per-pax scales to 1', calculateTripSpecificCost(1, makeConfig(), 5000), 500 + 300 + 150*1 + 200*1 + 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('══════════════════════════════════════════════════════\n');
if (failed > 0) process.exit(1);
