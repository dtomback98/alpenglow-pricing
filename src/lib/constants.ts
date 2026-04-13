import { TripConfiguration } from './types';

// Default trip configuration — all financial values are zero; structural fields kept
export const DEFAULT_CONFIG: TripConfiguration = {
  name: 'New Trip',
  tripPrice: 0,
  tripDays: 0,
  tripNights: 0,
  paxMin: 1,
  paxMax: 16,
  paxStep: 1,
  inflationRate: 0,
  discountsEnabled: true,
  earlyBirdDiscount: 0,
  earlyBirdCountByPax: Object.fromEntries(
    Array.from({ length: 16 }, (_, i) => [i + 1, 0])
  ),
  earlyBirdTiers: [],
  loyaltyDiscountRate: 0,
  loyaltyCountByPax: Object.fromEntries(
    Array.from({ length: 16 }, (_, i) => [i + 1, 0])
  ),

  singleSupplement: {
    enabled: true,
    singleSupplement: 0,
    singleRoomExtra: 0,
    countSimple: 0,
    countByPax: Object.fromEntries(
      Array.from({ length: 16 }, (_, i) => [i + 1, 0])
    ),
  },

  extension: {
    enabled: true,
    extensionPrice: 0,
    extensionNights: 0,
    countByPax: Object.fromEntries(
      Array.from({ length: 16 }, (_, i) => [i + 1, 0])
    ),
    singleSupplement: {
      enabled: true,
      inheritFromMain: true,
      singleSupplement: 0,
      singleRoomExtra: 0,
      countByPax: Object.fromEntries(
        Array.from({ length: 16 }, (_, i) => [i + 1, 0])
      ),
    },
    hotelsMeals: {
      enabled: true,
      inheritFromMain: true,
      hotelCostPerNight: 0,
      lunchCostPerDay: 0,
      dinnerCostPerNight: 0,
      additionalMealCosts: 0,
    },
    staffConfig: {
      enabled: true,
      inheritFromMain: true,
      staffByPax: Object.fromEntries(
        Array.from({ length: 16 }, (_, i) => [i + 1, []])
      ),
      travelDays: 0,
      travelDayRate: 0,
      staffMealsCost: 0,
      staffMealsMode: 'perDay' as const,
    },
    discounts: {
      enabled: true,
      inheritFromMain: true,
      earlyBirdDiscount: 0,
      earlyBirdCountByPax: Object.fromEntries(
        Array.from({ length: 16 }, (_, i) => [i + 1, 0])
      ),
      loyaltyDiscountRate: 0,
      loyaltyCountByPax: Object.fromEntries(
        Array.from({ length: 16 }, (_, i) => [i + 1, 0])
      ),
    },
    logisticsConfig: {
      enabled: true,
      inheritFromMain: true,
      mode: 'perDay' as const,
      simpleMode: true,
      rates: Array.from({ length: 16 }, (_, i) => ({ pax: i + 1, rate: 0 })),
      baseRate: 0,
      guideLogistics: {
        baseRate: 0,
        rates: Array.from({ length: 16 }, (_, i) => ({ pax: i + 1, rate: 0 })),
        mode: 'perDay' as const,
        simpleMode: true,
      },
    },
  },

  hotelsMeals: {
    enabled: true,
    mode: 'perPaxPerNight' as const,
    hotelCostPerNight: 0,
    lunchCostPerDay: 0,
    dinnerCostPerNight: 0,
    additionalMealCosts: 0,
  },

  logistics: {
    enabled: true,
    baseRate: 0,
    rates: Array.from({ length: 16 }, (_, i) => ({ pax: i + 1, rate: 0 })),
    perPax: false,
    mode: 'perDay' as const,
    simpleMode: true,
    includesGuide: false,
    guideLogistics: {
      baseRate: 0,
      rates: Array.from({ length: 16 }, (_, i) => ({ pax: i + 1, rate: 0 })),
      mode: 'perDay' as const,
      simpleMode: true,
    },
  },

  staffConfig: {
    enabled: true,
    useCustomStaffDays: false,
    staffByPax: Object.fromEntries(
      Array.from({ length: 16 }, (_, i) => [i + 1, []])
    ),
    travelDays: 0,
    travelDayRate: 0,
    guideFlightCost: 0,
    guideFlightCountByPax: Object.fromEntries(
      Array.from({ length: 16 }, (_, i) => [i + 1, 0])
    ),
    staffMealsCost: 0,
    staffMealsMode: 'perDay' as const,
  },

  transportConfig: {
    enabled: true,
    flightCostPerPerson: 0,
    groundTransportTotal: 0,
    airportTransfers: 0,
    localTransport: 0,
    transportBands: [],
  },

  tripSpecific: {
    enabled: true,
    permits: { amount: 0, perPax: false, active: false },
    equipment: { amount: 0, perPax: false, active: false },
    jacketsApparel: { amount: 0, perPax: true },
    insurance: { amount: 0, perPax: true },
    contingency: { amount: 0, perPax: false },
    hypoxico: { amount: 0, perPax: false, active: false },
    otherCosts: { amount: 0, perPax: false, active: false },
    customCosts: [],
  },
};

// Chart colors
export const CHART_COLORS = {
  revenue: '#22c55e',
  costs: '#ef4444',
  profit: '#f97316',
  margin: '#3b82f6',
  historical: '#8b5cf6',
};

// Category colors for historical data
export const CATEGORY_COLORS: Record<string, string> = {
  Beg: '#22c55e',
  Inter: '#3b82f6',
  Adv: '#f97316',
  Ski: '#8b5cf6',
  '8k E': '#ef4444',
  '8K': '#ef4444',
};

// Trip status constants
export const STATUS_ORDER = ['for-review', 'open-enrollment', 'budgeted', 'run', 'scratch'];

export const STATUS_LABELS: Record<string, string> = {
  'run': 'Run',
  'budgeted': 'Budgeted',
  'open-enrollment': 'Open Enrollment',
  'scratch': 'Scratch',
  'for-review': 'For Review',
};

export const STATUS_BADGE_CLASSES: Record<string, string> = {
  'run': 'bg-green-500/20 text-green-400',
  'scratch': 'bg-red-500/20 text-red-400',
  'open-enrollment': 'bg-blue-500/20 text-blue-400',
  'budgeted': 'bg-yellow-500/20 text-yellow-400',
  'for-review': 'bg-purple-500/20 text-purple-400',
};

// Countries list (shared between Header and HistoryTab)
export const EXPEDITIONS = [
  'Aconcagua',
  'Alpamayo',
  'Ama Dablam',
  'Chile Volcanoes',
  'Cotopaxi',
  'ECS',
  'Everest',
  'Huayhuash',
  'Japan Ski',
  'Kilimanjaro',
  'Lenin',
  'Mexico Volcanoes',
  'Bolivia Ski',
  'Mountains of Bolivia',
  'Patagonia Ski',
  'PCS',
  'PVT Ecuador',
  'Vinson',
  'Privates - Other',
  'Other',
];

// Category labels
export const CATEGORY_LABELS: Record<string, string> = {
  All: 'All',
  Beg: 'Beginner',
  Inter: 'Intermediate',
  Adv: 'Advanced',
  Ski: 'Ski',
  '8k E': '8K Expedition',
  '8K': '8K Expedition',
};
