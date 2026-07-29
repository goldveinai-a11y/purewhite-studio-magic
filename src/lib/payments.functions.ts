import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from '@/lib/stripe.server';

type CheckoutResult = { clientSecret: string } | { error: string };

type Entitlements = {
  tier: 'free' | 'pro' | 'lifetime';
  extra_pack_balance: number;
  pro_used: number;
  lifetime_used: number;
  pro_period: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
};

type EntitlementsResult = { entitlements: Entitlements } | { error: string };

type ReserveResult =
  | { ok: true }
  | { ok: false; reason: string; needTopUp?: boolean }
  | { error: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error('Invalid userId');

  const found = await stripe.customers.search({
    query: `metadata['userId']:'${options.userId}'`,
    limit: 1,
  });
  if (found.data.length) return found.data[0].id;

  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }

  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { userId: options.userId },
  });
  return created.id;
}

async function createCheckout(
  params: {
    priceId: string;
    productKey: 'pro' | 'lifetime' | 'extra_pack';
    returnUrl: string;
    environment: StripeEnv;
    /** GA4 client_id, captured client-side from the `_ga` cookie, so the
     * webhook can later attribute the resulting `purchase` event back to
     * this visitor's session instead of firing as an anonymous server
     * event. Optional — checkout must never fail because analytics is
     * blocked or the cookie hasn't been set yet. */
    gaClientId?: string;
  },
  userId: string,
  email: string | undefined,
): Promise<CheckoutResult> {
  try {
    const stripe = createStripeClient(params.environment);
    const prices = await stripe.prices.list({ lookup_keys: [params.priceId] });
    if (!prices.data.length) return { error: 'Price not found' };
    const price = prices.data[0];
    const isRecurring = price.type === 'recurring';

    const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

    let description: string | undefined;
    if (!isRecurring) {
      const productId = typeof price.product === 'string' ? price.product : price.product.id;
      const product = await stripe.products.retrieve(productId);
      description = product.name;
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: price.id, quantity: 1 }],
      mode: isRecurring ? 'subscription' : 'payment',
      ui_mode: 'embedded_page',
      return_url: params.returnUrl,
      customer: customerId,
      ...(!isRecurring && { payment_intent_data: { description } }),
      metadata: { userId, product: params.productKey, gaClientId: params.gaClientId ?? '' },
      ...(isRecurring && {
        subscription_data: {
          metadata: { userId, product: params.productKey, gaClientId: params.gaClientId ?? '' },
        },
      }),
      managed_payments: { enabled: true },
    } as Parameters<typeof stripe.checkout.sessions.create>[0]);

    return { clientSecret: session.client_secret ?? '' };
  } catch (error) {
    return { error: getStripeErrorMessage(error) };
  }
}

export const createProCheckout = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl: string; environment: StripeEnv; gaClientId?: string }) => data)
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { userId, supabase } = context;
    const { data: { user } } = await supabase.auth.getUser();
    return createCheckout(
      { priceId: 'pro_monthly', productKey: 'pro', ...data },
      userId,
      user?.email ?? undefined,
    );
  });

export const createLifetimeCheckout = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl: string; environment: StripeEnv; gaClientId?: string }) => data)
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { userId, supabase } = context;
    const { data: { user } } = await supabase.auth.getUser();
    return createCheckout(
      { priceId: 'lifetime_onetime', productKey: 'lifetime', ...data },
      userId,
      user?.email ?? undefined,
    );
  });

export const createExtraPackCheckout = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl: string; environment: StripeEnv; gaClientId?: string }) => data)
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { userId, supabase } = context;
    // Extra Pack only for paying users
    const { data: ent } = await supabase
      .from('entitlements')
      .select('tier')
      .eq('user_id', userId)
      .maybeSingle();
    if (!ent || (ent.tier !== 'pro' && ent.tier !== 'lifetime')) {
      return { error: 'Extra Pack is available only for Pro or Lifetime users' };
    }
    const { data: { user } } = await supabase.auth.getUser();
    return createCheckout(
      { priceId: 'extra_pack_500', productKey: 'extra_pack', ...data },
      userId,
      user?.email ?? undefined,
    );
  });

export const getEntitlements = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EntitlementsResult> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from('entitlements')
      .select('tier, extra_pack_balance, pro_used, lifetime_used, pro_period, subscription_status, current_period_end, cancel_at_period_end, stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return { error: error.message };
    return {
      entitlements:
        (data as Entitlements) ?? {
          tier: 'free',
          extra_pack_balance: 0,
          pro_used: 0,
          lifetime_used: 0,
          pro_period: null,
          subscription_status: null,
          current_period_end: null,
          cancel_at_period_end: false,
          stripe_customer_id: null,
        },
    };
  });

export const reservePhotos = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { count: number }) => data)
  .handler(async ({ data, context }): Promise<ReserveResult> => {
    const { supabase } = context;
    const { data: result, error } = await supabase.rpc('reserve_photos', { n: data.count });
    if (error) return { error: error.message };
    return result as ReserveResult;
  });

export const createPortalSession = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    try {
      const { userId, supabase } = context;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const stripe = createStripeClient(data.environment);
      const customerId = await resolveOrCreateCustomer(stripe, {
        email: user?.email ?? undefined,
        userId,
      });
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: data.returnUrl,
      });
      return { url: session.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
