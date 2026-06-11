-- Add cost_price to inventory
-- Required for profit calculations
ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS
cost_price NUMERIC DEFAULT 0;

-- Add payment_method to bills
-- Required for payment methods chart
ALTER TABLE bills
ADD COLUMN IF NOT EXISTS
payment_method TEXT DEFAULT 'Cash';

-- Add activity_log table
-- For Recent Activity timeline
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY
    DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  reference_id TEXT DEFAULT '',
  reference_type TEXT DEFAULT '',
  icon TEXT DEFAULT '📋',
  color TEXT DEFAULT '#2563EB',
  created_at TIMESTAMP WITH TIME ZONE
    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
idx_activity_user_id
ON activity_log(user_id);

CREATE INDEX IF NOT EXISTS
idx_activity_created_at
ON activity_log(created_at DESC);

ALTER TABLE activity_log
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own activity"
ON activity_log FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Add expense tracking table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY
    DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash',
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE
    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
idx_expenses_user_id
ON expenses(user_id);

CREATE INDEX IF NOT EXISTS
idx_expenses_date
ON expenses(date);

ALTER TABLE expenses
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own expenses"
ON expenses FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
