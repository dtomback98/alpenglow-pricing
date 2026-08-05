// Core configuration types for the Alpenglow Pricing Tool

export interface ExtensionSingleSupplementConfig {
  enabled: boolean;
  inheritFromMain: boolean;
  activeMode?: 'simple' | 'perPax';
  singleSupplement: number;
  singleRoomExtra: number;
  countByPax: { [pax: number]: number };
}

export interface ExtensionHotelsMealsConfig {
  enabled: boolean;
  inheritFromMain: boolean;
  activeMode?: 'simple' | 'perPax';
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
  guideCountMode?: 'off' | 'matchStaff' | 'custom';
  guideCount?: number;
  guideCountByPax?: { [pax: number]: number };
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
  activeMode?: 'simple' | 'perPax';
  earlyBirdDiscount: number;
  earlyBirdCountByPax: { [pax: number]: number };
  loyaltyDiscountRate: number;
  loyaltyCountByPax: { [pax: number]: number };
}

export interface ExtensionLogisticsConfig {
  enabled: boolean;
  inheritFromMain: boolean;
  activeMode?: 'simple' | 'perPax';
  mode?: 'perPaxPerDay' | 'perPax' | 'perDay' | 'total';
  simpleMode?: boolean; // true = single rate for all pax; false/undefined = per-pax grid
  rates: LogisticsRate[];
  baseRate: number;
  guideLogistics?: {
    enabled?: boolean; // undefined = active (backward-compat)
    activeMode?: 'simple' | 'perPax';
    rates: LogisticsRate[];
    baseRate?: number;
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
  activeMode?: 'simple' | 'perPax'; // which dataset feeds calculations; undefined = legacy (byPax ?? flat)
  mode?: 'perPaxPerNight' | 'perNight' | 'total' | 'perPax'; // hotel rate mode
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
  guideCountMode?: 'off' | 'matchStaff' | 'custom';
  guideCount?: number;
  guideCountByPax?: { [pax: number]: number };
}

export interface LogisticsRate {
  pax: number;
  rate: number;
}

export interface LogisticsConfig {
  enabled: boolean;
  activeMode?: 'simple' | 'perPax'; // which dataset feeds calculations; undefined = legacy (rates array)
  baseRate: number; // simple-mode value (previously legacy/unused — now the simple dataset)
  rates: LogisticsRate[];
  perPax: boolean; // Legacy — mode is authoritative, perPax used as fallback
  mode?: 'perPaxPerDay' | 'perPax' | 'perDay' | 'total';
  simpleMode?: boolean; // true = show simple editor; false = show per-pax grid (view-only flag)
  includesGuide: boolean; // Legacy — unused but kept for DB compat
  guideLogistics?: {
    enabled?: boolean; // undefined = active (backward-compat)
    activeMode?: 'simple' | 'perPax'; // which dataset feeds calculations
    rates: LogisticsRate[];
    baseRate?: number; // simple-mode value
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
  guideFlightCostByPax?: { [pax: number]: number };
  guideFlightCountByPax?: { [pax: number]: number };
  travelDaysByPax?: { [pax: number]: number };
  travelDayRateByPax?: { [pax: number]: number };
  staffMealsCost?: number;
  staffMealsCostByPax?: { [pax: number]: number };
  staffMealsMode?: 'perDayPerGuide' | 'perDay' | 'total';
}

export interface TransportBand {
  id: string;
  minPax: number;
  maxPax: number | null; // null = no upper limit
  groundTransport: number;
  airportTransfers: number;
  localTransport: number;
}

export interface VehicleBand {
  id: string;
  minPax: number;
  maxPax: number | null;
  cost: number;
}

export interface TransportVehicle {
  id: string;
  label: string;
  mode: 'simple' | 'perPax' | 'bands';
  simpleRate: number;
  perPaxRates?: { [pax: number]: number };
  bands: VehicleBand[];
  guideCountMode?: 'off' | 'matchStaff' | 'custom';
  guideCount?: number;
  guideCountByPax?: { [pax: number]: number };
  guideCountPerPax?: boolean;
}

export interface TransportConfig {
  enabled: boolean;
  activeMode?: 'simple' | 'perPax' | 'bands'; // Legacy — used by old single-table bands; ignored when transportVehicles is set
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
  transportBands?: TransportBand[]; // Legacy single-table bands
  transportVehicles?: TransportVehicle[]; // Multi-vehicle line items (authoritative when non-empty)
}

export interface TripSpecificCost {
  amount: number;
  perPax: boolean;
  percentOfRevenue?: boolean;
  active?: boolean; // undefined = active (backward-compat); false = inactive
  minPax?: number | null; // bands mode: only apply when pax >= minPax
  maxPax?: number | null; // bands mode: only apply when pax <= maxPax
}

export interface CustomTripCost {
  id: string;
  label: string;
  amount: number;
  perPax: boolean;
  minPax?: number | null; // bands mode
  maxPax?: number | null; // bands mode
}

export interface TripSpecificConfig {
  enabled: boolean;
  mode?: 'simple' | 'bands';
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
  activeMode?: 'simple' | 'perPax'; // which dataset feeds calculations; undefined = legacy (countByPax)
  singleSupplement: number;
  singleRoomExtra: number;
  countSimple?: number; // simple-mode guest count (same for all group sizes)
  countByPax: { [pax: number]: number };
}

export interface EarlyBirdTier {
  id: string;
  discount: number;
  countSimple?: number;
  countByPax?: { [pax: number]: number };
}

export interface UiPreferences {
  pricingPerPax?: boolean;
  discountsPerPax?: boolean;
  discountsActiveMode?: 'simple' | 'perPax';
  earlyBirdCountSimple?: number;
  loyaltyCountSimple?: number;
  singleSuppPerPax?: boolean;
  hotelsMealsPerPax?: boolean;
  transportPerPax?: boolean;
  transportBandsView?: boolean;
  extPerPax?: boolean;
  extSuppPerPax?: boolean;
  extDiscountsPerPax?: boolean;
  extHotelsMealsPerPax?: boolean;
  hmGuidePerPax?: boolean;
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
  tripPriceActiveMode?: 'simple' | 'perPax';
  tripPriceByPax?: { [pax: number]: number };
  tripDays: number;
  tripNights: number;
  paxMin: number;
  paxMax: number;
  paxStep: number;
  inflationRate?: number;

  // Discounts
  discountsEnabled: boolean;
  discountsActiveMode?: 'simple' | 'perPax'; // which dataset feeds calculations
  earlyBirdDiscount: number;
  earlyBirdCountSimple?: number; // simple-mode count (same for all group sizes)
  earlyBirdCountByPax: { [pax: number]: number };
  earlyBirdTiers?: EarlyBirdTier[]; // additional early bird tiers (EB2, EB3, ...)
  loyaltyDiscountRate: number;
  loyaltyCountSimple?: number;
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
  month?: string;
  tripConfigId?: string;
  status?: 'budgeted' | 'run' | 'actuals' | 'scratch' | 'open-enrollment' | 'for-review';
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

export type TabType = 'summary' | 'inputs-core' | 'inputs-extension' | 'history' | 'financials' | 'gm-review';
