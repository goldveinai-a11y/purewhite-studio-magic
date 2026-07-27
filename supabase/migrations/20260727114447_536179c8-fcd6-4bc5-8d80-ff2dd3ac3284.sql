
-- ============ entitlements table ============
CREATE TABLE public.entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free','pro','lifetime')),
  stripe_customer_id text,
  stripe_subscription_id text,
  pro_period text,                -- 'YYYY-MM'
  pro_used integer NOT NULL DEFAULT 0,
  lifetime_used integer NOT NULL DEFAULT 0,
  extra_pack_balance integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.entitlements TO authenticated;
GRANT ALL ON public.entitlements TO service_role;

ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own row read" ON public.entitlements
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ============ auto-create entitlements row per user ============
CREATE OR REPLACE FUNCTION public.handle_new_user_entitlements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.entitlements (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_entitlements
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_entitlements();

-- ============ stripe events log (webhook idempotency) ============
CREATE TABLE public.stripe_events_processed (
  event_id text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.stripe_events_processed TO service_role;
ALTER TABLE public.stripe_events_processed ENABLE ROW LEVEL SECURITY;
-- no policies: only service_role touches this

-- ============ reserve_photos: atomic credit consumption ============
-- Hidden limits (never exposed to UI): pro=200/mo, lifetime=500 total
CREATE OR REPLACE FUNCTION public.reserve_photos(n integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ent public.entitlements%ROWTYPE;
  current_period text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  from_pack integer := 0;
  from_quota integer := 0;
  pro_limit constant integer := 200;
  lifetime_limit constant integer := 500;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  IF n IS NULL OR n < 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_count');
  END IF;

  SELECT * INTO ent FROM public.entitlements
    WHERE user_id = uid FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.entitlements (user_id) VALUES (uid);
    SELECT * INTO ent FROM public.entitlements WHERE user_id = uid FOR UPDATE;
  END IF;

  -- Free tier goes through the local 3-credit gate; server rejects here.
  IF ent.tier = 'free' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_paid_tier');
  END IF;

  -- Reset pro monthly counter on period change
  IF ent.tier = 'pro' AND (ent.pro_period IS NULL OR ent.pro_period <> current_period) THEN
    ent.pro_used := 0;
    ent.pro_period := current_period;
  END IF;

  -- Extra pack spends FIRST
  from_pack := LEAST(ent.extra_pack_balance, n);
  from_quota := n - from_pack;

  IF ent.tier = 'pro' THEN
    IF ent.pro_used + from_quota > pro_limit THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'limit_exceeded',
        'needTopUp', true
      );
    END IF;
    UPDATE public.entitlements SET
      extra_pack_balance = extra_pack_balance - from_pack,
      pro_used = pro_used + from_quota,
      pro_period = current_period,
      updated_at = now()
    WHERE user_id = uid;
  ELSIF ent.tier = 'lifetime' THEN
    IF ent.lifetime_used + from_quota > lifetime_limit THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'limit_exceeded',
        'needTopUp', true
      );
    END IF;
    UPDATE public.entitlements SET
      extra_pack_balance = extra_pack_balance - from_pack,
      lifetime_used = lifetime_used + from_quota,
      updated_at = now()
    WHERE user_id = uid;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_photos(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_photos(integer) TO authenticated;
