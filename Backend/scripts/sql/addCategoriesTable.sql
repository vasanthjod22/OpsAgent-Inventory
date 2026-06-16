CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Migrate existing categories
INSERT INTO categories (user_id, name)
SELECT DISTINCT user_id, category
FROM inventory
WHERE category IS NOT NULL AND category != ''
ON CONFLICT (user_id, name) DO NOTHING;
