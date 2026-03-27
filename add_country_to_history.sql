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

-- Everything else → Unknown
UPDATE historical_trips SET country = 'Unknown' WHERE country IS NULL;
