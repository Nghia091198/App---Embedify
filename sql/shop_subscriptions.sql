-- Subscription / billing tracking — chạy trên Supabase SQL Editor
CREATE TABLE IF NOT EXISTS public.shop_subscriptions (
  org_id text PRIMARY KEY,
  plan text NOT NULL DEFAULT 'free', -- 'free' | 'basic' | 'pro'
  status text NOT NULL DEFAULT 'active', -- 'active' | 'expired' | 'cancelled'
  paid_at timestamptz, -- lần thanh toán gần nhất
  expires_at timestamptz, -- hết hạn lúc nào
  haravan_charge_id text, -- ID charge từ Haravan
  raw_payload jsonb, -- raw webhook payload để debug
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_subscriptions DISABLE ROW LEVEL SECURITY;
GRANT ALL PRIVILEGES ON TABLE public.shop_subscriptions TO service_role;
