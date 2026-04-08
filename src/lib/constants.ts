import { TripConfiguration } from './types';

// Default trip configuration
export const DEFAULT_CONFIG: TripConfiguration = {
  name: 'New Trip',
  tripPrice: 5495,
  tripDays: 9,
  tripNights: 8,
  paxMin: 1,
  paxMax: 16,
  paxStep: 1,
  inflationRate: 0,
  discountsEnabled: true,
  earlyBirdDiscount: 200,
  earlyBirdCountByPax: Object.fromEntries(
    Array.from({ length: 16 }, (_, i) => [i + 1, Math.round((i + 1) * 0.3)])
  ),
  earlyBirdDiscount2: 0,
  earlyBirdCountByPax2: {},
  loyaltyDiscountRate: 0.05, // 5%
  loyaltyCountByPax: Object.fromEntries(
    Array.from({ length: 16 }, (_, i) => [i + 1, Math.round((i + 1) * 0.05)])
  ),

  singleSupplement: {
    enabled: true,
    singleSupplement: 950,
    singleRoomExtra: 300,
    countByPax: Object.fromEntries(
      Array.from({ length: 16 }, (_, i) => [i + 1, 0])
    ),
  },

  extension: {
    enabled: true,
    extensionPrice: 350,
    extensionNights: 1,
    countByPax: Object.fromEntries(
      Array.from({ length: 16 }, (_, i) => [i + 1, 0])
    ),
    singleSupplement: {
      enabled: true,
      inheritFromMain: true,
      singleSupplement: 950,
      singleRoomExtra: 300,
      countByPax: Object.fromEntries(
        Array.from({ length: 16 }, (_, i) => [i + 1, 0])
      ),
    },
    hotelsMeals: {
      enabled: true,
      inheritFromMain: true,
      hotelCostPerNight: 120,
      lunchCostPerDay: 25,
      dinnerCostPerNight: 45,
      additionalMealCosts: 0,
    },
    staffConfig: {
      enabled: true,
      inheritFromMain: true,
      staffByPax: Object.fromEntries(
        Array.from({ length: 16 }, (_, i) => [
          i + 1,
          [
            { role: 'Lead Guide', dailyRate: 400, days: 1, quantity: 1 },
          ],
        ])
      ),
      travelDays: 0,
      travelDayRate: 150,
      staffMealsCost: 0,
      staffMealsMode: 'perDay' as const,
    },
    discounts: {
      enabled: true,
      inheritFromMain: true,
      earlyBirdDiscount: 200,
      earlyBirdCountByPax: Object.fromEntries(
        Array.from({ length: 16 }, (_, i) => [i + 1, 0])
      ),
      loyaltyDiscountRate: 0.05,
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
        rates: Array.from({ length: 16 }, (_, i) => ({ pax: i + 1, rate: 0 })),
        mode: 'perDay' as const,
        simpleMode: true,
      },
    },
  },

  hotelsMeals: {
    enabled: true,
    mode: 'perPaxPerNight' as const,
    hotelCostPerNight: 120,
    lunchCostPerDay: 25,
    dinnerCostPerNight: 45,
    additionalMealCosts: 0,
  },

  logistics: {
    enabled: true,
    baseRate: 0,
    // All rates uniform so simpleMode display matches calculations for new trips
    rates: Array.from({ length: 16 }, (_, i) => ({ pax: i + 1, rate: 500 })),
    perPax: false,
    mode: 'perDay' as const,
    simpleMode: true,
    includesGuide: false,
    guideLogistics: {
      rates: Array.from({ length: 16 }, (_, i) => ({ pax: i + 1, rate: 0 })),
      mode: 'perDay' as const,
      simpleMode: true,
    },
  },

  staffConfig: {
    enabled: true,
    useCustomStaffDays: false,
    staffByPax: Object.fromEntries(
      Array.from({ length: 16 }, (_, i) => [
        i + 1,
        [
          { role: 'Lead Guide', dailyRate: 400, days: 9, quantity: 1 },
          { role: 'Assistant Guide', dailyRate: 300, days: 9, quantity: 1 },
        ],
      ])
    ),
    travelDays: 2,
    travelDayRate: 150,
    guideFlightCost: 800,
    guideFlightCountByPax: Object.fromEntries(
      Array.from({ length: 16 }, (_, i) => [i + 1, 2])
    ),
    staffMealsCost: 0,
    staffMealsMode: 'perDay' as const,
  },

  transportConfig: {
    enabled: true,
    flightCostPerPerson: 0, // Legacy — flights now in staffConfig
    groundTransportTotal: 2000,
    airportTransfers: 500,
    localTransport: 300,
  },

  tripSpecific: {
    enabled: true,
    permits: { amount: 500, perPax: false },
    equipment: { amount: 300, perPax: false },
    jacketsApparel: { amount: 150, perPax: true },
    insurance: { amount: 200, perPax: true },
    contingency: { amount: 1000, perPax: false },
    hypoxico: { amount: 0, perPax: false },
    otherCosts: { amount: 0, perPax: false },
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
export const STATUS_ORDER = ['open-enrollment', 'budgeted', 'run', 'scratch'];

export const STATUS_LABELS: Record<string, string> = {
  'run': 'Run',
  'budgeted': 'Budgeted',
  'open-enrollment': 'Open Enrollment',
  'scratch': 'Scratch',
};

export const STATUS_BADGE_CLASSES: Record<string, string> = {
  'run': 'bg-green-500/20 text-green-400',
  'scratch': 'bg-red-500/20 text-red-400',
  'open-enrollment': 'bg-blue-500/20 text-blue-400',
  'budgeted': 'bg-yellow-500/20 text-yellow-400',
};

// Countries list (shared between Header and HistoryTab)
export const COUNTRIES = ['Antarctica', 'Argentina', 'Bolivia', 'Canada', 'Chile', 'Ecuador', 'Japan', 'Kyrgyzstan', 'Mexico', 'Nepal', 'Peru', 'Tanzania', 'Other'];

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
