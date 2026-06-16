-- 1. Add tags to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';

-- 2. Customer Tags Table
CREATE TABLE IF NOT EXISTS customer_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#2563EB',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, label)
);

ALTER TABLE customer_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tags" ON customer_tags FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. Customer Contacts Table
CREATE TABLE IF NOT EXISTS customer_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  designation TEXT DEFAULT '',
  phone TEXT NOT NULL,
  email TEXT DEFAULT '',
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(customer_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_contacts_customer_id ON customer_contacts(customer_id);

ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own contacts" ON customer_contacts FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 4. Report History Table
CREATE TABLE IF NOT EXISTS report_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  summary JSONB DEFAULT '{}'
);

ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own report history" ON report_history FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
