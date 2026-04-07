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
  mode?: 'perPaxPerNight' | 'perNight' | 'total' | 'perPax';
  hotelLabel?: string; // display name for primary hotel
  hotelNights?: number; // nights for primary hotel; defaults to extensionNights (custom mode only)
  hotelCostPerNight: number;
  lunchCostPerDay: number;
  dinnerCostPerNight: number;
  additionalMealCosts: number;
  hotelCostByPax?: { [pax: number]: number };
  lunchCostByPax?: { [pax: number]: number };
  dinnerCostByPax?: { [pax: number]: number };
  additionalMealCostsByPax?: { [pax: number]: number };
  additionalHotels?: AdditionalHotel[]; // custom mode only
}

export interface ExtensionStaffConfig {
  enabled: boolean;
  inheritFromMain: boolean;
  staffByPax: { [pax: number]: StaffMember[] };
  travelDays: number;
  travelDayRate: number;
  staffMealsCost?: number;
  staffMealsMode?: 'perDayPerGuide' | 'perDay' | 'total';
}

export interface ExtensionDiscountsConfig {
  enabled: boolean;
  inheritFromMain: boolean;
  earlyBirdDiscount: number;
  earlyBirdCountByPax: { [pax: number]: number };
  loyaltyDiscountRate: number;
  loyaltyCountByPax: { [pax: number]: number };
}

export interface ExtensionLogisticsConfig {
  enabled: boolean;
  inheritFromMain: boolean;
  mode?: 'perPaxPerDay' | 'perPax' | 'perDay' | 'total';
  simpleMode?: boolean; // true = single rate for all pax; false/undefined = per-pax grid
  rates: LogisticsRate[];
  baseRate: number;
  guideLogistics?: {
    rates: LogisticsRate[];
    mode?: 'perPaxPerDay' | 'perPax' | 'perDay' | 'total';
    simpleMode?: boolean;
  };
}

export interface ExtensionConfig {
  enabled: boolean; // Master toggle on Core Trip Details card

  // Core extension details
  extensionPrice: number;
  extensionNights: number;
  countByPax: { [pax: number]: number };

  // Sub-sections (each can inherit from main or use custom values)
  discounts: ExtensionDiscountsConfig;
  singleSupplement: ExtensionSingleSupplementConfig;
  hotelsMeals: ExtensionHotelsMealsConfig;
  staffConfig: ExtensionStaffConfig;
  logisticsConfig: ExtensionLogisticsConfig;
}

export interface AdditionalHotel {
  id: string;
  label: string;
  nights: number;
  ratePerNight: number;
}

export interface HotelsMealsConfig {
  enabled: boolean;
  mode?: 'perPaxPerNight' | 'perNight' | 'total' | 'perPax';
  hotelLabel?: string; // display name for primary hotel
  hotelNights?: number; // nights for primary hotel; defaults to tripNights
  hotelCostPerNight: number;
  lunchCostPerDay: number;
  dinnerCostPerNight: number;
  additionalMealCosts: number;
  hotelCostByPax?: { [pax: number]: number };
  lunchCostByPax?: { [pax: number]: number };
  dinnerCostByPax?: { [pax: number]: number };
  additionalMealCostsByPax?: { [pax: number]: number };
  additionalHotels?: AdditionalHotel[];
}

export interface LogisticsRate {
  pax: number;
  rate: number;
}

export interface LogisticsConfig {
  enabled: boolean;
  baseRate: number; // Legacy — unused but kept for DB compat
  rates: LogisticsRate[];
  perPax: boolean; // Legacy — mode is authoritative, perPax used as fallback
  mode?: 'perPaxPerDay' | 'perPax' | 'perDay' | 'total';
  simpleMode?: boolean; // true = single rate for all pax; false/undefined = per-pax grid
  includesGuide: boolean; // Legacy — unused but kept for DB compat
  guideLogistics?: {
    rates: LogisticsRate[];
    mode?: 'perPaxPerDay' | 'perPax' | 'perDay' | 'total';
    simpleMode?: boolean;
  };
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
  guideFlightCost?: number;
  guideFlightCountByPax?: { [pax: number]: number };
  staffMealsCost?: number;
  staffMealsMode?: 'perDayPerGuide' | 'perDay' | 'total';
}

export interface TransportConfig {
  enabled: boolean;
  flightCostPerPerson: number; // Legacy — flights now in StaffConfig, kept for migration
  groundTransportTotal: number;
  groundTransportPerPax?: boolean;
  groundTransportByPax?: { [pax: number]: number };
  airportTransfers: number;
  airportTransfersPerPax?: boolean;
  airportTransfersByPax?: { [pax: number]: number };
  localTransport: number;
  localTransportPerPax?: boolean;
  localTransportByPax?: { [pax: number]: number };
}

export interface TripSpecificCost {
  amount: number;
  perPax: boolean;
  percentOfRevenue?: boolean;
  active?: boolean; // undefined = active (backward-compat); false = inactive
}

export interface CustomTripCost {
  id: string;
  label: string;
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
  customCosts?: CustomTripCost[];
}

export interface SingleSupplementConfig {
  enabled: boolean;
  singleSupplement: number;
  singleRoomExtra: number;
  countByPax: { [pax: number]: number };
}

export interface UiPreferences {
  pricingPerPax?: boolean;
  discountsPerPax?: boolean;
  singleSuppPerPax?: boolean;
  hotelsMealsPerPax?: boolean;
  transportPerPax?: boolean;
  extPerPax?: boolean;
  extSuppPerPax?: boolean;
  extDiscountsPerPax?: boolean;
  extHotelsMealsPerPax?: boolean;
  notes?: string;
}

export interface TripConfiguration {
  id?: string;
  name: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;

  // UI mode preferences (persisted across tab switches)
  uiPreferences?: UiPreferences;

  // Core trip data
  tripPrice: number;
  tripPriceMode?: 'perPerson' | 'total';
  tripPriceByPax?: { [pax: number]: number };
  tripDays: number;
  tripNights: number;
  paxMin: number;
  paxMax: number;
  paxStep: number;
  inflationRate?: number;

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
  guideFlightsCost: number;
  staffMealsCost: number;
  transportCost: number;
  tripSpecificCost: number;
  singleRoomCost: number;
  totalCosts: number;

  // Extension breakdown
  extensionRevenue: number;
  extensionSingleSuppRevenue: number;
  extensionDiscountCost: number;
  extensionHotelsCost: number;
  extensionMealsCost: number;
  extensionStaffCost: number;
  extensionLogisticsCost: number;
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
  status?: 'budgeted' | 'run' | 'scratch' | 'open-enrollment';
  country?: string;
}

export interface FinancialBreakdown {
  tripTravelLogistics: number;
  guideWages: number;
  tripSupplies: number;
  commercialLicensing: number;
  tripCommunications: number;
  otherTripCosts: number;
  total: number;
}

export type TabType = 'summary' | 'inputs-core' | 'inputs-extension' | 'history' | 'financials';
