CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  po_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_phone TEXT DEFAULT '',
  supplier_email TEXT DEFAULT '',
  supplier_address TEXT DEFAULT '',
  expected_date DATE,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  grand_total NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft','Sent','Acknowledged','Partially Received','Fully Received','Cancelled')),
  notes TEXT DEFAULT '',
  payment_terms TEXT DEFAULT '30 days',
  received_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_user_id ON purchase_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own purchase orders" 
  ON purchase_orders 
  FOR ALL 
  USING (auth.uid() = user_id);
