CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Migrate existing units
INSERT INTO units (user_id, name)
SELECT DISTINCT user_id, unit
FROM inventory
WHERE unit IS NOT NULL AND unit != ''
ON CONFLICT (user_id, name) DO NOTHING;
