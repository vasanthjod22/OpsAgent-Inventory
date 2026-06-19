-- Performance Indexes for OpsAgent Scalability

-- 1. Bills Table Indexes
-- Most queries filter by user_id and date ranges, or user_id and payment_status
CREATE INDEX IF NOT EXISTS idx_bills_user_date ON bills (user_id, date);
CREATE INDEX IF NOT EXISTS idx_bills_user_payment_status ON bills (user_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_bills_user_created_at ON bills (user_id, created_at);

-- 2. Inventory Table Indexes
-- Frequently searched by user_id, category, and name
CREATE INDEX IF NOT EXISTS idx_inventory_user_category ON inventory (user_id, category);
CREATE INDEX IF NOT EXISTS idx_inventory_user_name ON inventory (user_id, name);

-- 3. Finance Table Indexes
CREATE INDEX IF NOT EXISTS idx_finance_user_date ON finance (user_id, date);
CREATE INDEX IF NOT EXISTS idx_finance_user_type ON finance (user_id, type);

-- 4. Quotations Table Indexes
CREATE INDEX IF NOT EXISTS idx_quotations_user_date ON quotations (user_id, date);

-- 5. GRN Table Indexes
CREATE INDEX IF NOT EXISTS idx_grn_user_date ON grn (user_id, date);

-- 6. Users Table Indexes
-- Frequently used during login
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Optional: If purchase_orders table exists
CREATE INDEX IF NOT EXISTS idx_po_user_created_at ON purchase_orders (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_po_user_status ON purchase_orders (user_id, status);

-- Optional: If expenses table exists
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses (user_id, date);
