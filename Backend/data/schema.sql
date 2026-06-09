-- Supabase Schema for OpsAgent (Multi-Tenant)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  password TEXT NOT NULL,
  company TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory Table
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hsn TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Uncategorized',
  qty NUMERIC DEFAULT 0,
  unit TEXT DEFAULT 'Nos',
  min NUMERIC DEFAULT 0,
  max NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Finance Table
CREATE TABLE IF NOT EXISTS finance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  customer TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'Completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bills Table
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bill_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  date DATE DEFAULT CURRENT_DATE,
  items JSONB NOT NULL,
  subtotal NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  grand_total NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'Unpaid',
  balance_due NUMERIC,
  amount_paid NUMERIC,
  notes TEXT,
  include_terms BOOLEAN DEFAULT false,
  terms TEXT,
  inventory_updated BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, bill_number)
);

-- Quotations Table
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quotation_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT DEFAULT '',
  customer_email TEXT DEFAULT '',
  customer_address TEXT DEFAULT '',
  date DATE NOT NULL,
  validity TEXT DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  grand_total NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  include_terms BOOLEAN DEFAULT false,
  terms TEXT DEFAULT '',
  status TEXT DEFAULT 'Draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, quotation_number)
);

-- GRN Table
CREATE TABLE IF NOT EXISTS grn (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  supplier TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  item_count NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  inventory_updated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- Company Table (Per User)
CREATE TABLE IF NOT EXISTS company (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT DEFAULT '',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  gstin TEXT DEFAULT '',
  bank_name TEXT DEFAULT '',
  account_number TEXT DEFAULT '',
  ifsc TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- To enable RLS run:
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE finance ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE grn ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE company ENABLE ROW LEVEL SECURITY;