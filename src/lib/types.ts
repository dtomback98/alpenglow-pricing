// Core configuration types for the Alpenglow Pricing Tool

export interface ExtensionSingleSupplementConfig {
  enabled: boolean;
  inheritFromMain: boolean;
  singleSupplement: number;
  singleRoomExtra: number;
  countByPax: { [pax: number]: number };
}

export interface ExtensionHotelsMealsConfig {
  enabled: boolean;
  inheritFromMain: boolean;
  hotelCostPerNight: number;
  lunchCostPerDay: number;
  dinnerCostPerNight: number;
  additionalMealCosts: number;
}

export interface ExtensionStaffConfig {
  enabled: boolean;
  inheritFromMain: boolean;
  staffByPax: { [pax: number]: StaffMember[] };
  travelDays: number;
  travelDayRate: number;
}

export interface ExtensionConfig {
  enabled: boolean; // Master toggle on Core Trip Details card

  // Core extension details
  extensionPrice: number;
  extensionNights: number;
  countByPax: { [pax: number]: number };

  // Sub-sections (each can inherit from main or use custom values)
  singleSupplement: ExtensionSingleSupplementConfig;
  hotelsMeals: ExtensionHotelsMealsConfig;
  staffConfig: ExtensionStaffConfig;
}

export interface HotelsMealsConfig {
  enabled: boolean;
  hotelCostPerNight: number;
  lunchCostPerDay: number;
  dinnerCostPerNight: number;
  additionalMealCosts: number;
}

export interface LogisticsRate {
  pax: number;
  rate: number;
}

export interface LogisticsConfig {
  enabled: boolean;
  baseRate: number;
  rates: LogisticsRate[];
  perPax: boolean;
  mode?: 'perPaxPerDay' | 'perDay' | 'total';
  includesGuide: boolean;
}

export interface StaffMember {
  role: string;
  dailyRate: number;
  days: number;
  quantity: number;
}

export interface StaffConfig {
  enabled: boolean;
  useCustomStaffDays: boolean;
  staffByPax: { [pax: number]: StaffMember[] };
  travelDays: number;
  travelDayRate: number;
}

export interface TransportConfig {
  enabled: boolean;
  flightCostPerPerson: number;
  groundTransportTotal: number;
  groundTransportPerPax: boolean;
  airportTransfers: number;
  localTransport: number;
}

export interface TripSpecificCost {
  amount: number;
  perPax: boolean;
}

export interface TripSpecificConfig {
  enabled: boolean;
  permits: TripSpecificCost;
  equipment: TripSpecificCost;
  jacketsApparel: TripSpecificCost;
  insurance: TripSpecificCost;
  contingency: TripSpecificCost;
  hypoxico: TripSpecificCost;
  otherCosts: TripSpecificCost;
}

export interface SingleSupplementConfig {
  enabled: boolean;
  singleSupplement: number;
  singleRoomExtra: number;
  countByPax: { [pax: number]: number };
}

export interface UiPreferences {
  discountsPerPax?: boolean;
  singleSuppPerPax?: boolean;
  extPerPax?: boolean;
  extSuppPerPax?: boolean;
}

export interface TripConfiguration {
  id?: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;

  // UI mode preferences (persisted across tab switches)
  uiPreferences?: UiPreferences;

  // Core trip data
  tripPrice: number;
  tripDays: number;
  tripNights: number;
  paxMin: number;
  paxMax: number;
  paxStep: number;

  // Discounts
  discountsEnabled: boolean;
  earlyBirdDiscount: number;
  earlyBirdCountByPax: { [pax: number]: number };
  loyaltyDiscountRate: number;
  loyaltyCountByPax: { [pax: number]: number };

  // Single supplement
  singleSupplement: SingleSupplementConfig;

  // Extension (replaces old prePost)
  extension: ExtensionConfig;

  // Nested configs
  hotelsMeals: HotelsMealsConfig;
  logistics: LogisticsConfig;
  staffConfig: StaffConfig;
  transportConfig: TransportConfig;
  tripSpecific: TripSpecificConfig;
}

export interface PaxCalculation {
  pax: number;
  baseRevenue: number;
  earlyBirdCost: number;
  loyaltyCost: number;
  singleSupplementRevenue: number;
  totalRevenue: number;

  hotelsCost: number;
  mealsCost: number;
  logisticsCost: number;
  staffCost: number;
  transportCost: number;
  tripSpecificCost: number;
  singleRoomCost: number;
  totalCosts: number;

  // Extension breakdown
  extensionRevenue: number;
  extensionSingleSuppRevenue: number;
  extensionHotelsCost: number;
  extensionMealsCost: number;
  extensionStaffCost: number;
  extensionSingleRoomCost: number;
  extensionTotalCost: number;

  grossProfit: number;
  margin: number;
  perPaxProfit: number;
}

export interface HistoricalTrip {
  id: string;
  name: string;
  category: string;
  pax: number;
  pricePerPax: number;
  revenue: number;
  grossProfit: number;
  margin: number;
  notes?: string;
  tripDate?: string;
  createdAt?: string;
  year?: number;
  tripConfigId?: string;
}

export type TabType = 'summary' | 'inputs-core' | 'inputs-extension' | 'history';
