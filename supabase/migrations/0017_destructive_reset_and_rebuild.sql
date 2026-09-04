-- ==========================================
-- 0. TEARDOWN (Option B: Safe Tear Down)
-- ==========================================

-- Drop triggers first
DROP TRIGGER IF EXISTS tr_update_quotation_total_insert ON public.quotation_items;
DROP TRIGGER IF EXISTS tr_update_quotation_total_update ON public.quotation_items;
DROP TRIGGER IF EXISTS tr_update_quotation_total_delete ON public.quotation_items;
DROP TRIGGER IF EXISTS tr_ensure_item_ownership ON public.quotation_items;
DROP TRIGGER IF EXISTS tr_price_list_updated_at ON public.price_list;
DROP TRIGGER IF EXISTS tr_quotations_updated_at ON public.quotations;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop functions
DROP FUNCTION IF EXISTS public.update_quotation_total();
DROP FUNCTION IF EXISTS public.ensure_quotation_item_ownership();
DROP FUNCTION IF EXISTS public.set_updated_at();
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop tables in dependency order
DROP TABLE IF EXISTS public.quotation_items CASCADE;
DROP TABLE IF EXISTS public.founder_time_logs CASCADE;
DROP TABLE IF EXISTS public.quotations CASCADE;
DROP TABLE IF EXISTS public.price_list CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ==========================================
-- 1. PROFILES & AUTH INTEGRATION
-- ==========================================

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT profile_id_check CHECK (id IS NOT NULL)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Backfill existing auth users into profiles (so test accounts still work)
INSERT INTO public.profiles (id)
SELECT id FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 2. SHARED UTILITIES
-- ==========================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 3. CORE BUSINESS TABLES
-- ==========================================

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  name TEXT NOT NULL,
  referral_source TEXT NOT NULL,
  staff_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT staff_size_range CHECK (staff_size >= 20 AND staff_size <= 150)
);

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.price_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  sku TEXT NOT NULL,
  description TEXT,
  base_cost NUMERIC(12, 2) NOT NULL,
  item_group TEXT NOT NULL CHECK (item_group IN ('Furniture - Standard', 'Furniture - Custom')),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, sku)
);

CREATE TABLE public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Approved', 'Rejected', 'Order')),
  total_amount NUMERIC(12, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  order_converted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public.quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL,
  line_total NUMERIC(12, 2) NOT NULL,
  requires_a3_approval BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.founder_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE SET NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 4. INTEGRITY CONSTRAINTS & TRIGGERS
-- ==========================================

CREATE OR REPLACE FUNCTION public.ensure_quotation_item_ownership()
RETURNS trigger AS $$
DECLARE
  quote_user_id UUID;
BEGIN
  SELECT user_id INTO quote_user_id FROM public.quotations WHERE id = NEW.quotation_id;
  IF NEW.user_id <> quote_user_id THEN
    RAISE EXCEPTION 'Item user_id must match Quotation user_id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_ensure_item_ownership
  BEFORE INSERT OR UPDATE ON public.quotation_items
  FOR EACH ROW EXECUTE PROCEDURE public.ensure_quotation_item_ownership();

CREATE OR REPLACE FUNCTION public.update_quotation_total()
RETURNS trigger AS $$
DECLARE
  target_quote_id UUID;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    target_quote_id := OLD.quotation_id;
  ELSE
    target_quote_id := NEW.quotation_id;
  END IF;

  UPDATE public.quotations
  SET total_amount = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM public.quotation_items
    WHERE quotation_id = target_quote_id
  )
  WHERE id = target_quote_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_quotation_total_insert AFTER INSERT ON public.quotation_items FOR EACH ROW EXECUTE PROCEDURE public.update_quotation_total();
CREATE TRIGGER tr_update_quotation_total_update AFTER UPDATE ON public.quotation_items FOR EACH ROW EXECUTE PROCEDURE public.update_quotation_total();
CREATE TRIGGER tr_update_quotation_total_delete AFTER DELETE ON public.quotation_items FOR EACH ROW EXECUTE PROCEDURE public.update_quotation_total();

CREATE TRIGGER tr_price_list_updated_at BEFORE UPDATE ON public.price_list FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE TRIGGER tr_quotations_updated_at BEFORE UPDATE ON public.quotations FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ==========================================
-- 5. RLS POLICIES
-- ==========================================

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers: Owner Access" ON public.customers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Suppliers: Owner Access" ON public.suppliers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "PriceList: Owner Access" ON public.price_list FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Quotations: Owner Access" ON public.quotations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "QuotationItems: Owner Access" ON public.quotation_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "TimeLogs: Owner Access" ON public.founder_time_logs FOR ALL USING (auth.uid() = user_id);
