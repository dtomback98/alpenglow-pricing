import { createClient } from '@supabase/supabase-js';
import { TripConfiguration, HistoricalTrip } from './types';
import { DEFAULT_CONFIG } from './constants';
import { calculateForPax } from './calculations';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create client only if credentials are provided
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return supabase !== null;
};

// Migrate old earlyBirdTakeup (percentage) to per-pax counts
function migrateEarlyBirdTakeup(takeup: number, maxPax: number): { [pax: number]: number } {
  const result: { [pax: number]: number } = {};
  for (let p = 1; p <= maxPax; p++) {
    result[p] = Math.round(p * (takeup || 0.3));
  }
  return result;
}

// Generate default per-pax counts based on a rate
function migrateDefaultCountByPax(maxPax: number, rate: number): { [pax: number]: number } {
  const result: { [pax: number]: number } = {};
  for (let p = 1; p <= maxPax; p++) {
    result[p] = Math.round(p * rate);
  }
  return result;
}

// Migrate old prePost config to new extension format
function migratePrePostToExtension(prePost: any): TripConfiguration['extension'] {
  if (!prePost) return DEFAULT_CONFIG.extension;

  return {
    enabled: prePost.enabled ?? true,
    extensionPrice: prePost.pricePerPerson ?? 350,
    extensionNights: prePost.nights ?? 1,
    countByPax: prePost.countByPax || Object.fromEntries(
      Array.from({ length: 16 }, (_, i) => [i + 1, i + 1])
    ),
    singleSupplement: { ...DEFAULT_CONFIG.extension.singleSupplement },
    hotelsMeals: { ...DEFAULT_CONFIG.extension.hotelsMeals },
    staffConfig: {
      ...DEFAULT_CONFIG.extension.staffConfig,
      staffByPax: { ...DEFAULT_CONFIG.extension.staffConfig.staffByPax },
    },
  };
}

// Migrate old staff config (flat staff array) to new per-pax format
function migrateStaffConfig(staffConfig: any): any {
  if (staffConfig?.staffByPax) return staffConfig;
  if (staffConfig?.staff && Array.isArray(staffConfig.staff)) {
    const staffByPax: { [pax: number]: any[] } = {};
    for (let p = 1; p <= 16; p += 1) {
      staffByPax[p] = staffConfig.staff.map((s: any) => ({ ...s }));
    }
    return { ...staffConfig, staffByPax, staff: undefined };
  }
  return staffConfig;
}

// Migrate old singleSupplementCount to countByPax
function migrateSingleSupplementConfig(config: any): any {
  if (!config) return config;
  if (config.countByPax) return config;
  const count = config.singleSupplementCount ?? 2;
  const countByPax: { [pax: number]: number } = {};
  for (let p = 1; p <= 16; p++) countByPax[p] = count;
  return { singleSupplement: config.singleSupplement, singleRoomExtra: config.singleRoomExtra, countByPax };
}

// Convert database row to TripConfiguration
function rowToConfig(row: any): TripConfiguration {
  const singleSupplement = migrateSingleSupplementConfig(row.single_supplement_config || {
    singleSupplement: Number(row.single_supplement) || 950,
    singleRoomExtra: Number(row.single_room_extra) || 300,
    singleSupplementCount: 2,
  });

  // Handle extension: new format or migrate from old pre_post
  const extension = row.extension_config
    ? row.extension_config
    : migratePrePostToExtension(row.pre_post);

  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tripPrice: Number(row.trip_price),
    tripDays: row.trip_days,
    tripNights: row.trip_nights,
    paxMin: row.pax_min || 1,
    paxMax: row.pax_max || 16,
    paxStep: row.pax_step || 1,
    discountsEnabled: row.discounts_enabled ?? true,
    earlyBirdDiscount: Number(row.early_bird_discount),
    earlyBirdCountByPax: row.early_bird_count_by_pax || migrateEarlyBirdTakeup(Number(row.early_bird_takeup), row.pax_max || 16),
    loyaltyDiscountRate: Number(row.loyalty_discount_rate),
    loyaltyCountByPax: row.loyalty_count_by_pax || migrateDefaultCountByPax(row.pax_max || 16, 0.05),
    singleSupplement,
    extension,
    hotelsMeals: row.hotels_meals,
    logistics: row.logistics,
    staffConfig: migrateStaffConfig(row.staff_config),
    transportConfig: row.transport_config,
    tripSpecific: row.trip_specific,
    uiPreferences: row.ui_preferences || {},
  };
}

// Convert TripConfiguration to database row
function configToRow(config: TripConfiguration): any {
  return {
    name: config.name,
    trip_price: config.tripPrice,
    trip_days: config.tripDays,
    trip_nights: config.tripNights,
    pax_min: config.paxMin,
    pax_max: config.paxMax,
    pax_step: config.paxStep,
    discounts_enabled: config.discountsEnabled,
    early_bird_discount: config.earlyBirdDiscount,
    early_bird_count_by_pax: config.earlyBirdCountByPax,
    loyalty_discount_rate: config.loyaltyDiscountRate,
    loyalty_count_by_pax: config.loyaltyCountByPax,
    single_supplement_config: config.singleSupplement,
    single_room_extra: config.singleSupplement.singleRoomExtra,
    single_supplement: config.singleSupplement.singleSupplement,
    extension_config: config.extension,
    hotels_meals: config.hotelsMeals,
    logistics: config.logistics,
    staff_config: config.staffConfig,
    transport_config: config.transportConfig,
    trip_specific: config.tripSpecific,
    ui_preferences: config.uiPreferences || {},
  };
}

// Fetch all trip configurations
export async function fetchTripConfigurations(): Promise<TripConfiguration[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('trip_configurations')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching trip configurations:', error);
    return [];
  }

  return (data || []).map(rowToConfig);
}

// Fetch a single trip configuration by ID
export async function fetchTripConfiguration(id: string): Promise<TripConfiguration | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('trip_configurations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching trip configuration:', error);
    return null;
  }

  return data ? rowToConfig(data) : null;
}

// Save a trip configuration (insert or update)
export async function saveTripConfiguration(config: TripConfiguration): Promise<TripConfiguration | null> {
  if (!supabase) return null;

  const row = configToRow(config);

  if (config.id) {
    const { data, error } = await supabase
      .from('trip_configurations')
      .update(row)
      .eq('id', config.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating trip configuration:', error);
      return null;
    }

    return data ? rowToConfig(data) : null;
  } else {
    const { data, error } = await supabase
      .from('trip_configurations')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('Error inserting trip configuration:', error);
      return null;
    }

    return data ? rowToConfig(data) : null;
  }
}

// Delete a trip configuration
export async function deleteTripConfiguration(id: string): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('trip_configurations')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting trip configuration:', error);
    return false;
  }

  return true;
}

// Fetch historical trips
export async function fetchHistoricalTrips(category?: string): Promise<HistoricalTrip[]> {
  if (!supabase) return [];

  let query = supabase
    .from('historical_trips')
    .select('*')
    .order('trip_date', { ascending: false });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching historical trips:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    category: row.category,
    pax: row.pax,
    pricePerPax: Number(row.price_per_pax),
    revenue: Number(row.revenue),
    grossProfit: Number(row.gross_profit),
    margin: Number(row.margin),
    notes: row.notes || '',
    tripDate: row.trip_date,
    createdAt: row.created_at,
    year: row.year || 2025,
    tripConfigId: row.trip_config_id || undefined,
  }));
}

// Delete a historical trip entry
export async function deleteHistoricalTrip(id: string): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('historical_trips')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting historical trip:', error);
    return false;
  }

  return true;
}

// Save a trip to history with calculated values at a specific pax level
export async function saveToHistory(
  config: TripConfiguration,
  pax: number,
  category: string
): Promise<boolean> {
  if (!supabase || !config.id) return false;

  const calc = calculateForPax(pax, config);

  const row = {
    name: config.name,
    category,
    pax,
    price_per_pax: calc.totalRevenue / pax,
    revenue: calc.totalRevenue,
    gross_profit: calc.grossProfit,
    margin: calc.margin,
    year: 2026,
    trip_config_id: config.id,
    notes: '',
  };

  const { error } = await supabase
    .from('historical_trips')
    .insert(row);

  if (error) {
    console.error('Error inserting history entry:', error);
    return false;
  }

  return true;
}
