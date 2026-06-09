-- SQL Migration to update Inventory table
-- 1. Drop the existing primary key constraint
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_pkey;

-- 2. Add a new UUID id column
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4();

-- 3. Make id the primary key
ALTER TABLE inventory ADD PRIMARY KEY (id);

-- 4. Rename column sku to hsn
ALTER TABLE inventory RENAME COLUMN sku TO hsn;
