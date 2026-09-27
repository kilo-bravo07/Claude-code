import { describe, expect, it } from "vitest";
import { computeFunnel, computeMetric } from "@/lib/metrics";
import { DEFAULT_PROPERTY_KEY, getProperty, isPropertyKey, PROPERTIES, PROPERTY_KEYS } from "@/lib/properties";
import { FLOWERAURA_WEB } from "@/lib/properties/floweraura-web";
import { FLOWERAURA_APP } from "@/lib/properties/floweraura-app";
import { BAKINGO_WEB } from "@/lib/properties/bakingo-web";
import { BAKINGO_APP } from "@/lib/properties/bakingo-app";
import type { RawCounts } from "@/lib/types";

function pct(...values: number[]) {
  return values.map((v) => Number(v.toFixed(2)));
}

describe("property registry", () => {
  it("has exactly the four required properties", () => {
    expect(PROPERTY_KEYS.sort()).toEqual(["bakingo-app", "bakingo-web", "floweraura-app", "floweraura-web"]);
  });

  it("isPropertyKey / getProperty round-trip correctly", () => {
    PROPERTY_KEYS.forEach((key) => {
      expect(isPropertyKey(key)).toBe(true);
      expect(getProperty(key).key).toBe(key);
    });
  });

  it("falls back to the default property for an unknown key rather than throwing", () => {
    expect(getProperty("not-a-real-property").key).toBe(DEFAULT_PROPERTY_KEY);
  });

  it("every property declares a brand, platform, and a distinct GA4 property ID env var", () => {
    const envVars = new Set<string>();
    PROPERTY_KEYS.forEach((key) => {
      const p = PROPERTIES[key];
      expect(p.brand).toBeTruthy();
      expect(p.platform).toBeTruthy();
      expect(envVars.has(p.ga4PropertyIdEnvVar)).toBe(false);
      envVars.add(p.ga4PropertyIdEnvVar);
    });
  });

  it("availableFilters differs per property (the mechanism is actually exercised, not dead config)", () => {
    const distinctSets = new Set(PROPERTY_KEYS.map((key) => PROPERTIES[key].availableFilters.slice().sort().join(",")));
    expect(distinctSets.size).toBeGreaterThan(1);
  });
});

describe("FlowerAura Web — validation fixture (9/26/2026)", () => {
  const counts: RawCounts = { sessionStart: 10393, viewItem: 3617, addToCart: 1309, beginCheckout: 1207, purchase: 566 };
  const stages = computeFunnel(FLOWERAURA_WEB.shopping, counts);

  it("matches every reported shopping rate exactly", () => {
    expect(pct(stages[0].rate!, stages[1].rate!, stages[2].rate!, stages[3].rate!)).toEqual([34.8, 36.19, 92.21, 46.89]);
  });
  it("matches the reported ECR", () => {
    expect(Number(computeMetric(FLOWERAURA_WEB.shopping.ecr, counts)!.toFixed(2))).toBe(5.45);
  });

  it("matches every reported checkout rate exactly (1207 -> 962 -> 830 -> 814 -> 732 -> 566)", () => {
    const checkoutCounts: RawCounts = { beginCheckout: 1207, step2: 962, step3: 830, step4: 814, step5: 732, purchase: 566 };
    const checkoutStages = computeFunnel(FLOWERAURA_WEB.checkout, checkoutCounts);
    expect(pct(...checkoutStages.map((s) => s.rate!))).toEqual([79.7, 86.28, 98.07, 89.93, 77.32]);
    expect(Number(computeMetric(FLOWERAURA_WEB.checkout.ecr, checkoutCounts)!.toFixed(2))).toBe(46.89);
  });
});

describe("FlowerAura App — validation fixture (9/26/2026)", () => {
  const counts: RawCounts = {
    sessionStart: 1935,
    productView: 780,
    buyNow: 439,
    checkoutStep0: 386,
    orderConfirmed: 225,
    activeUsers: 1791,
  };
  const stages = computeFunnel(FLOWERAURA_APP.shopping, counts);

  it("matches Product View / Buy Now / Checkout / TRX", () => {
    expect(pct(...stages.map((s) => s.rate!))).toEqual([40.31, 56.28, 87.93, 58.29]);
  });
  it("matches ECR (Order Confirmed / Session Start)", () => {
    expect(Number(computeMetric(FLOWERAURA_APP.shopping.ecr, counts)!.toFixed(2))).toBe(11.63);
  });
  it("matches New ECR (Order Confirmed / Active Users) — a distinct denominator from ECR", () => {
    const newEcr = FLOWERAURA_APP.additionalMetrics.find((m) => m.key === "newEcr")!;
    expect(Number(computeMetric(newEcr, counts)!.toFixed(2))).toBe(12.56);
    expect(computeMetric(newEcr, counts)).not.toBeCloseTo(computeMetric(FLOWERAURA_APP.shopping.ecr, counts)!, 1);
  });

  it("checkout funnel Step1..Step4/Payment/OrderConfirmed chain from checkout_step0", () => {
    const checkoutCounts: RawCounts = {
      checkoutStep0: 386,
      step1: 353,
      step2: 305,
      step3: 297,
      step4: 266,
      payment: 266,
      orderConfirmed: 225,
    };
    const checkoutStages = computeFunnel(FLOWERAURA_APP.checkout, checkoutCounts);
    expect(pct(...checkoutStages.map((s) => s.rate!))).toEqual([91.45, 86.4, 97.38, 89.56, 100, 84.59]);
  });
});

describe("Bakingo Web — validation fixture (9/26/2026)", () => {
  const counts: RawCounts = { sessionStart: 12336, viewItem: 3523, addToCart: 1513, beginCheckout: 1334, purchase: 558 };
  const stages = computeFunnel(BAKINGO_WEB.shopping, counts);

  it("computes the chain view_item -> add_to_cart -> begin_checkout -> purchase, matching reported rates exactly, even though GA4 lists the raw events in a different order", () => {
    expect(pct(...stages.map((s) => s.rate!))).toEqual([28.56, 42.95, 88.17, 41.83]);
  });
  it("matches the reported ECR", () => {
    expect(Number(computeMetric(BAKINGO_WEB.shopping.ecr, counts)!.toFixed(2))).toBe(4.52);
  });

  it("preserves a >100% checkout step conversion exactly, without capping (1584 / 1462 = 108.34%)", () => {
    const checkoutCounts: RawCounts = { checkoutStep0: 1462, step1: 1584, step2: 1413, step3: 1290, step4: 1062, purchase: 746 };
    const checkoutStages = computeFunnel(BAKINGO_WEB.checkout, checkoutCounts);
    expect(checkoutStages[0].rate).toBeGreaterThan(100);
    expect(pct(...checkoutStages.map((s) => s.rate!))).toEqual([108.34, 89.2, 91.3, 82.33, 70.24]);
    expect(Number(computeMetric(BAKINGO_WEB.checkout.ecr, checkoutCounts)!.toFixed(2))).toBe(51.03);
  });
});

describe("Bakingo App — validation fixture (9/26/2026)", () => {
  it("shopping funnel matches Product Viewed / ATC / Begin Checkout / Purchase / ECR", () => {
    const counts: RawCounts = { sessionStart: 6262, viewItem: 3521, addToCart: 1692, beginCheckout: 976, purchase: 646 };
    const stages = computeFunnel(BAKINGO_APP.shopping, counts);
    expect(pct(...stages.map((s) => s.rate!))).toEqual([56.23, 48.05, 57.68, 66.19]);
    expect(Number(computeMetric(BAKINGO_APP.shopping.ecr, counts)!.toFixed(2))).toBe(10.32);
  });

  it("checkout funnel is a fully independent event stream from the shopping funnel", () => {
    const checkoutCounts: RawCounts = {
      checkoutInitiated: 1162,
      shippingInfoAdded: 1156,
      payNowClicked: 865,
      paymentInfo: 760,
      purchase: 646,
    };
    const checkoutStages = computeFunnel(BAKINGO_APP.checkout, checkoutCounts);
    expect(pct(...checkoutStages.map((s) => s.rate!))).toEqual([99.48, 74.83, 87.86, 85]);
    expect(Number(computeMetric(BAKINGO_APP.checkout.ecr, checkoutCounts)!.toFixed(2))).toBe(55.59);

    // The checkout funnel's root event (checkout_initiated) is not a key the
    // shopping funnel ever produces — confirming the two funnels never share
    // a denominator or get combined.
    const shoppingStageKeys = [BAKINGO_APP.shopping.root.key, ...BAKINGO_APP.shopping.stages.map((s) => s.key)];
    expect(shoppingStageKeys).not.toContain(BAKINGO_APP.checkout.root.key);
  });
});
