import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getEntitlements } from "@/lib/payments.functions";

// Internal processing allowances for paid tiers. These numbers are
// deliberately NOT shown anywhere in the UI/marketing copy - Pro is sold as
// "unlimited" and Lifetime as "no subscription", and this cap only exists to
// protect unit economics against the rare outlier account. Sized from usage
// data: median small/medium seller needs well under 50 uploads/month, so 200
// covers the real distribution with wide headroom. Lifetime's 500 is a
// one-time total, not a monthly refill.
const PRO_MONTHLY_LIMIT = 200;
const LIFETIME_TOTAL_LIMIT = 500;

export type Tier = "free" | "pro" | "lifetime";

const TIER_KEY = "pwbg_tier";
const PRO_PERIOD_KEY = "pwbg_pro_period"; // "YYYY-MM"
const PRO_USED_KEY = "pwbg_pro_used";
const LIFETIME_USED_KEY = "pwbg_lifetime_used";

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function readTier(): Tier {
  try {
    const stored = localStorage.getItem(TIER_KEY);
    if (stored === "pro" || stored === "lifetime") return stored;
  } catch {
    // ignore
  }
  return "free";
}

export function useTierLimits() {
  const [tier, setTierState] = useState<Tier>("free");

  useEffect(() => {
    setTierState(readTier());
    let cancelled = false;
    const sync = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;
        const res = await getEntitlements();
        if (cancelled) return;
        if ("entitlements" in res) {
          const serverTier = res.entitlements.tier;
          setTierState(serverTier);
          try {
            localStorage.setItem(TIER_KEY, serverTier);
          } catch {
            // ignore
          }
        }
      } catch {
        // network / auth issue — keep local guess
      }
    };
    void sync();
    return () => {
      cancelled = true;
    };
  }, []);

  // NOTE: there is no real payment/subscription backend yet - this just
  // records which button the user clicked. It stands in for the real tier
  // flag until Stripe + accounts land; swap this for a server-verified
  // subscription check at that point, and treat everything below as the
  // interim approximation it is.
  const setTier = useCallback((t: Tier) => {
    setTierState(t);
    try {
      localStorage.setItem(TIER_KEY, t);
    } catch {
      // ignore
    }
  }, []);

  // Returns true if the batch of `n` photos fits inside the hidden
  // allowance for the current tier (and reserves it), false if it would
  // exceed the cap - the caller should show the top-up prompt in that case.
  // Free tier is governed entirely by the separate 3-credit gate, so this
  // always allows it through here.
  const reserve = useCallback(
    (n: number): boolean => {
      if (tier === "free") return true;
      try {
        if (tier === "pro") {
          const period = currentPeriod();
          const storedPeriod = localStorage.getItem(PRO_PERIOD_KEY);
          const used =
            storedPeriod === period ? Number(localStorage.getItem(PRO_USED_KEY) ?? 0) : 0;
          if (used + n > PRO_MONTHLY_LIMIT) return false;
          localStorage.setItem(PRO_PERIOD_KEY, period);
          localStorage.setItem(PRO_USED_KEY, String(used + n));
          return true;
        }
        if (tier === "lifetime") {
          const used = Number(localStorage.getItem(LIFETIME_USED_KEY) ?? 0);
          if (used + n > LIFETIME_TOTAL_LIMIT) return false;
          localStorage.setItem(LIFETIME_USED_KEY, String(used + n));
          return true;
        }
      } catch {
        // Storage failure shouldn't block a paying customer - fail open.
        return true;
      }
      return true;
    },
    [tier],
  );

  return { tier, setTier, reserve };
}
