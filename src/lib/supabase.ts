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
    discounts: { ...DEFAULT_CONFIG.extension.discounts },
    logisticsConfig: { ...DEFAULT_CONFIG.extension.logisticsConfig },
  };
}

// Migrate logistics: derive mode from perPax if mode missing
function migrateLogistics(logistics: any): any {
  if (!logistics) return logistics;
  if (!logistics.mode) {
    return { ...logistics, mode: logistics.perPax ? 'perPaxPerDay' : 'perDay' };
  }
  return logistics;
}

// Migrate trip-specific: add hypoxico if missing
function migrateTripSpecific(tripSpecific: any): any {
  if (!tripSpecific) return tripSpecific;
  if (!tripSpecific.hypoxico) {
    return { ...tripSpecific, hypoxico: { amount: 0, perPax: false } };
  }
  return tripSpecific;
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
  return { enabled: config.enabled ?? true, singleSupplement: config.singleSupplement, singleRoomExtra: config.singleRoomExtra, countByPax };
}

// Convert database row to TripConfiguration
function rowToConfig(row: any): TripConfiguration {
  const singleSupplement = migrateSingleSupplementConfig(row.single_supplement_config || {
    singleSupplement: Number(row.single_supplement) || 950,
    singleRoomExtra: Number(row.single_room_extra) || 300,
    singleSupplementCount: 2,
  });

  // Handle extension: new format or migrate from old pre_post, merged with defaults
  const rawExtension = row.extension_config
    ? row.extension_config
    : migratePrePostToExtension(row.pre_post);
  const extension = {
    ...DEFAULT_CONFIG.extension,
    ...rawExtension,
    singleSupplement: { ...DEFAULT_CONFIG.extension.singleSupplement, ...rawExtension?.singleSupplement },
    hotelsMeals: { ...DEFAULT_CONFIG.extension.hotelsMeals, ...rawExtension?.hotelsMeals },
    staffConfig: {
      ...DEFAULT_CONFIG.extension.staffConfig,
      ...rawExtension?.staffConfig,
      staffByPax: { ...DEFAULT_CONFIG.extension.staffConfig.staffByPax, ...rawExtension?.staffConfig?.staffByPax },
    },
    discounts: { ...DEFAULT_CONFIG.extension.discounts, ...rawExtension?.discounts },
    logisticsConfig: { ...DEFAULT_CONFIG.extension.logisticsConfig, ...rawExtension?.logisticsConfig },
  };

  // Migrate guide flights from transport to staff config (immutable — no direct mutation)
  const migratedStaff = migrateStaffConfig(row.staff_config);
  const staffConfig = migratedStaff && !migratedStaff.guideFlightCost && row.transport_config?.flightCostPerPerson
    ? { ...migratedStaff, guideFlightCost: row.transport_config.flightCostPerPerson }
    : migratedStaff;

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
    paxStep: Math.max(1, Math.round(row.pax_step || 1)),
    inflationRate: row.inflation_rate || 0,
    discountsEnabled: row.discounts_enabled ?? true,
    earlyBirdDiscount: Number(row.early_bird_discount),
    earlyBirdCountByPax: row.early_bird_count_by_pax || migrateEarlyBirdTakeup(Number(row.early_bird_takeup), row.pax_max || 16),
    earlyBirdDiscount2: row.ui_preferences?.earlyBirdDiscount2 || 0,
    earlyBirdCountByPax2: row.ui_preferences?.earlyBirdCountByPax2 || {},
    loyaltyDiscountRate: Number(row.loyalty_discount_rate),
    loyaltyCountByPax: row.loyalty_count_by_pax || migrateDefaultCountByPax(row.pax_max || 16, 0.05),
    singleSupplement,
    extension,
    hotelsMeals: { ...DEFAULT_CONFIG.hotelsMeals, ...(typeof row.hotels_meals === 'object' && row.hotels_meals !== null ? row.hotels_meals : {}) },
    logistics: migrateLogistics({ ...DEFAULT_CONFIG.logistics, ...(typeof row.logistics === 'object' && row.logistics !== null ? row.logistics : {}) }),
    staffConfig: { ...DEFAULT_CONFIG.staffConfig, ...staffConfig },
    transportConfig: { ...DEFAULT_CONFIG.transportConfig, ...(typeof row.transport_config === 'object' && row.transport_config !== null ? row.transport_config : {}) },
    tripSpecific: migrateTripSpecific({ ...DEFAULT_CONFIG.tripSpecific, ...(typeof row.trip_specific === 'object' && row.trip_specific !== null ? row.trip_specific : {}) }),
    uiPreferences: row.ui_preferences || {},
    tripPriceMode: row.ui_preferences?.tripPriceMode || undefined,
    tripPriceByPax: row.ui_preferences?.tripPriceByPax || undefined,
    notes: row.ui_preferences?.notes || '',
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
    inflation_rate: config.inflationRate || 0,
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
    // Clear tripPriceMode when per-pax pricing is active to prevent mode+byPax co-persistence inflating revenue
    ui_preferences: { ...(config.uiPreferences || {}), tripPriceMode: config.tripPriceByPax ? undefined : config.tripPriceMode, tripPriceByPax: config.tripPriceByPax, notes: config.notes || '', earlyBirdDiscount2: config.earlyBirdDiscount2 || 0, earlyBirdCountByPax2: config.earlyBirdCountByPax2 || {} },
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

// Fetch multiple trip configurations by IDs (returns a map for fast lookup)
export async function fetchTripConfigurationsByIds(ids: string[]): Promise<Map<string, TripConfiguration>> {
  if (!supabase || ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from('trip_configurations')
    .select('*')
    .in('id', ids);

  if (error) {
    console.error('Error fetching trip configurations by ids:', error);
    return new Map();
  }

  const map = new Map<string, TripConfiguration>();
  for (const row of (data || [])) {
    map.set(row.id, rowToConfig(row));
  }
  return map;
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
    status: (['run', 'budgeted', 'scratch', 'open-enrollment'].includes(row.status)) ? row.status : (row.year && row.year <= 2025 ? 'run' : 'budgeted'),
    country: row.country || 'Other',
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
// Returns the created HistoricalTrip (with its ID) so callers can track the loaded entry
export async function saveToHistory(
  config: TripConfiguration,
  pax: number,
  category: string,
  year?: number,
  status?: string,
  country?: string
): Promise<HistoricalTrip | null> {
  if (!supabase || !config.id || !Number.isFinite(pax) || pax <= 0) return null;

  const calc = calculateForPax(pax, config);

  const row = {
    name: config.name,
    category,
    pax,
    price_per_pax: calc.totalRevenue / pax,
    revenue: calc.totalRevenue,
    gross_profit: calc.grossProfit,
    margin: calc.margin,
    year: year || new Date().getFullYear(),
    trip_date: new Date().toISOString().split('T')[0],
    trip_config_id: config.id,
    notes: config.notes || '',
    status: status || 'budgeted',
    country: country || 'Other',
  };

  const { data, error } = await supabase
    .from('historical_trips')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('Error inserting history entry:', error);
    return null;
  }

  return data ? {
    id: data.id,
    name: data.name,
    category: data.category,
    pax: data.pax,
    pricePerPax: Number(data.price_per_pax),
    revenue: Number(data.revenue),
    grossProfit: Number(data.gross_profit),
    margin: Number(data.margin),
    notes: data.notes || '',
    tripDate: data.trip_date,
    createdAt: data.created_at,
    year: data.year || new Date().getFullYear(),
    tripConfigId: data.trip_config_id || undefined,
    status: data.status || 'budgeted',
    country: data.country || 'Other',
  } : null;
}

// Update the stored financial numbers (and optionally name/notes) in a history entry
export async function updateHistoryEntryNumbers(
  id: string,
  updates: { revenue: number; gross_profit: number; margin: number; price_per_pax: number; name?: string; notes?: string }
): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('historical_trips')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating history entry numbers:', error);
    return false;
  }

  return true;
}

// Delete a historical trip entry AND its linked config (1:1 ownership in new architecture)
export async function deleteHistoricalTripWithConfig(id: string, tripConfigId?: string): Promise<boolean> {
  if (!supabase) return false;

  const { error: histErr } = await supabase
    .from('historical_trips')
    .delete()
    .eq('id', id);

  if (histErr) {
    console.error('Error deleting historical trip:', histErr);
    return false;
  }

  // Delete the linked config if it exists (best-effort — don't fail if this errors)
  if (tripConfigId) {
    const { error: cfgErr } = await supabase
      .from('trip_configurations')
      .delete()
      .eq('id', tripConfigId);

    if (cfgErr) {
      console.error('Error deleting linked trip config (non-fatal):', cfgErr);
    }
  }

  return true;
}

// Update the name of a trip configuration
export async function updateTripConfigurationName(id: string, name: string): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('trip_configurations')
    .update({ name })
    .eq('id', id);

  if (error) {
    console.error('Error updating trip configuration name:', error);
    return false;
  }

  return true;
}

// Update a historical trip entry (status, notes, name, country)
export async function updateHistoricalTrip(
  id: string,
  updates: { status?: string; notes?: string; name?: string; country?: string }
): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from('historical_trips')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating historical trip:', error);
    return false;
  }

  return true;
}
