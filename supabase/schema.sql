-- Alpenglow Pricing Tool Database Schema
-- Run this in your Supabase SQL Editor to create the required tables

-- Table: trip_configurations
-- Stores each trip's full configuration
CREATE TABLE trip_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Core trip data
  trip_price NUMERIC NOT NULL DEFAULT 5495,
  trip_days INTEGER NOT NULL DEFAULT 9,
  trip_nights INTEGER NOT NULL DEFAULT 8,
  pax_min INTEGER DEFAULT 1,
  pax_max INTEGER DEFAULT 16,
  pax_step INTEGER DEFAULT 1,

  -- Discounts
  discounts_enabled BOOLEAN DEFAULT TRUE,
  early_bird_discount NUMERIC DEFAULT 0,
  early_bird_takeup NUMERIC DEFAULT 0,
  early_bird_count_by_pax JSONB,
  loyalty_discount_rate NUMERIC DEFAULT 0,
  loyalty_count_by_pax JSONB,

  -- Single supplement
  single_room_extra NUMERIC DEFAULT 300,
  single_supplement NUMERIC DEFAULT 950,
  single_supplement_config JSONB,

  -- Extension
  extension_config JSONB,

  -- Legacy pre/post (kept for migration)
  pre_post JSONB NOT NULL DEFAULT '{}',

  -- JSON columns for complex nested data
  hotels_meals JSONB NOT NULL DEFAULT '{}',
  logistics JSONB NOT NULL DEFAULT '{}',
  staff_config JSONB NOT NULL DEFAULT '{}',
  transport_config JSONB NOT NULL DEFAULT '{}',
  trip_specific JSONB NOT NULL DEFAULT '{}'
);

-- Index for quick lookups by name
CREATE INDEX idx_trip_configurations_name ON trip_configurations(name);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to call the function on updates
CREATE TRIGGER update_trip_configurations_updated_at
  BEFORE UPDATE ON trip_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Table: historical_trips
-- Stores historical performance data for comparison
CREATE TABLE historical_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,  -- 'Beg', 'Inter', 'Adv', 'Ski', '8K'
  pax INTEGER NOT NULL,
  price_per_pax NUMERIC NOT NULL,
  revenue NUMERIC NOT NULL,
  gross_profit NUMERIC NOT NULL,
  margin NUMERIC NOT NULL,
  trip_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for filtering by category
CREATE INDEX idx_historical_trips_category ON historical_trips(category);

-- Enable Row Level Security (optional - uncomment if you want to add auth later)
-- ALTER TABLE trip_configurations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE historical_trips ENABLE ROW LEVEL SECURITY;

-- Sample historical data for testing
INSERT INTO historical_trips (name, category, pax, price_per_pax, revenue, gross_profit, margin, trip_date) VALUES
  ('Beginner Alps 2024', 'Beg', 12, 4995, 59940, 18000, 30.0, '2024-06-15'),
  ('Intermediate Dolomites', 'Inter', 10, 5495, 54950, 17500, 31.8, '2024-07-20'),
  ('Advanced Chamonix', 'Adv', 8, 6495, 51960, 15000, 28.9, '2024-08-10'),
  ('Ski Touring Week', 'Ski', 6, 5995, 35970, 12000, 33.4, '2024-03-01'),
  ('8K Expedition Prep', '8K', 4, 8995, 35980, 10000, 27.8, '2024-05-01');
