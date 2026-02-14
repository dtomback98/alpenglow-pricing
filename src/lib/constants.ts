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
  discountsEnabled: true,
  earlyBirdDiscount: 200,
  earlyBirdCountByPax: Object.fromEntries(
    Array.from({ length: 16 }, (_, i) => [i + 1, Math.round((i + 1) * 0.3)])
  ),
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
    },
  },

  hotelsMeals: {
    enabled: true,
    hotelCostPerNight: 120,
    lunchCostPerDay: 25,
    dinnerCostPerNight: 45,
    additionalMealCosts: 0,
  },

  logistics: {
    enabled: true,
    baseRate: 400,
    rates: [
      { pax: 1, rate: 500 },
      { pax: 2, rate: 500 },
      { pax: 3, rate: 500 },
      { pax: 4, rate: 500 },
      { pax: 5, rate: 450 },
      { pax: 6, rate: 450 },
      { pax: 7, rate: 450 },
      { pax: 8, rate: 450 },
      { pax: 9, rate: 400 },
      { pax: 10, rate: 400 },
      { pax: 11, rate: 400 },
      { pax: 12, rate: 400 },
      { pax: 13, rate: 375 },
      { pax: 14, rate: 375 },
      { pax: 15, rate: 375 },
      { pax: 16, rate: 375 },
    ],
    perPax: false,
    includesGuide: false,
  },

  staffConfig: {
    enabled: true,
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
  },

  transportConfig: {
    enabled: true,
    flightCostPerPerson: 800,
    groundTransportTotal: 2000,
    groundTransportPerPax: false,
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
    otherCosts: { amount: 0, perPax: false },
  },
};

// Pax range for calculations
export const PAX_RANGE = {
  min: 1,
  max: 16,
  step: 1,
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
