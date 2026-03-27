-- Add country column to historical_trips
ALTER TABLE historical_trips ADD COLUMN IF NOT EXISTS country text;

-- Argentina
UPDATE historical_trips SET country = 'Argentina' WHERE LOWER(name) LIKE '%aconcagua%';

-- Peru
UPDATE historical_trips SET country = 'Peru'
  WHERE LOWER(name) LIKE '%alpamayo%'
     OR LOWER(name) LIKE '%huayhuash%'
     OR LOWER(name) LIKE '%peru%'
     OR LOWER(name) LIKE '%yana%'
     OR LOWER(name) LIKE '%chopi%';

-- Nepal
UPDATE historical_trips SET country = 'Nepal'
  WHERE LOWER(name) LIKE '%ama dablam%'
     OR LOWER(name) LIKE '%everest%'
     OR LOWER(name) LIKE '%ebc%';

-- Ecuador
UPDATE historical_trips SET country = 'Ecuador'
  WHERE LOWER(name) LIKE '%cotopaxi%'
     OR LOWER(name) LIKE '%chimbo%'
     OR LOWER(name) LIKE '%antisana%'
     OR LOWER(name) LIKE '%cayambe%'
     OR LOWER(name) LIKE '%illiniza%'
     OR LOWER(name) LIKE '%ecu%'
     OR name LIKE 'ECS%';

-- Tanzania
UPDATE historical_trips SET country = 'Tanzania' WHERE LOWER(name) LIKE '%kili%';

-- Mexico
UPDATE historical_trips SET country = 'Mexico' WHERE LOWER(name) LIKE '%mexico%';

-- Japan
UPDATE historical_trips SET country = 'Japan' WHERE LOWER(name) LIKE '%japan%';

-- Bolivia
UPDATE historical_trips SET country = 'Bolivia' WHERE LOWER(name) LIKE '%bolivia%';

-- Chile
UPDATE historical_trips SET country = 'Chile'
  WHERE LOWER(name) LIKE '%chile%'
     OR LOWER(name) LIKE '%patagonia%';

-- Kyrgyzstan
UPDATE historical_trips SET country = 'Kyrgyzstan' WHERE LOWER(name) LIKE '%lenin%';

-- Canada
UPDATE historical_trips SET country = 'Canada' WHERE name = 'DiMM';

-- Antarctica
UPDATE historical_trips SET country = 'Antarctica' WHERE LOWER(name) LIKE '%vinson%';

-- Ecuador (specific trips by exact name, with renames)
UPDATE historical_trips SET name = 'Ring of Fire - Ecuador', country = 'Ecuador' WHERE name = 'ROF';
UPDATE historical_trips SET name = 'Women''s Climbing Adv - Ecuador', country = 'Ecuador' WHERE name = 'Womens Climbing Adv';
UPDATE historical_trips SET name = 'PVT Thill - Ecuador', country = 'Ecuador' WHERE name = 'PVT Thill';
UPDATE historical_trips SET country = 'Ecuador' WHERE LOWER(name) LIKE '%women%ecs%' OR LOWER(name) LIKE '%ecs%women%';

-- Everything else → Other
UPDATE historical_trips SET country = 'Other' WHERE country IS NULL;

-- Rename any previously set Unknown → Other
UPDATE historical_trips SET country = 'Other' WHERE country = 'Unknown';
