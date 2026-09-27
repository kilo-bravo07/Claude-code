import type { PropertyConfig } from "./types";

export const BAKINGO_WEB: PropertyConfig = {
  key: "bakingo-web",
  displayName: "Bakingo Web",
  brand: "Bakingo",
  platform: "Web",
  ga4PropertyIdEnvVar: "BAKINGO_WEB_GA4_PROPERTY_ID",

  // NOTE: GA4 lists these events as session_start, view_item, begin_checkout,
  // add_to_cart, purchase (begin_checkout before add_to_cart) — but the
  // reported conversion chain still goes view_item -> add_to_cart ->
  // begin_checkout -> purchase, same shape as the other properties. Don't
  // assume the two orderings always match; this file is the source of truth.
  shopping: {
    root: { key: "sessionStart", label: "Session Start", ga4EventName: "session_start" },
    stages: [
      { key: "viewItem", label: "View Item", ga4EventName: "view_item" },
      { key: "addToCart", label: "Add to Cart", ga4EventName: "add_to_cart" },
      { key: "beginCheckout", label: "Begin Checkout", ga4EventName: "begin_checkout" },
      { key: "purchase", label: "Purchase", ga4EventName: "purchase" },
    ],
    ecr: {
      key: "ecr",
      label: "ECR",
      numeratorKey: "purchase",
      denominatorKey: "sessionStart",
      description: "Purchase users / Session Start users",
    },
  },

  checkout: {
    root: { key: "checkoutStep0", label: "Checkout Step 0", ga4EventName: "checkout_step0" },
    stages: [
      { key: "step1", label: "Step 1", ga4EventName: "checkout_step1" },
      { key: "step2", label: "Step 2", ga4EventName: "checkout_step2" },
      { key: "step3", label: "Step 3", ga4EventName: "checkout_step3" },
      { key: "step4", label: "Step 4", ga4EventName: "checkout_step4" },
      { key: "purchase", label: "Purchase", ga4EventName: "purchase" },
    ],
    ecr: {
      key: "checkoutEcr",
      label: "Checkout ECR",
      numeratorKey: "purchase",
      denominatorKey: "checkoutStep0",
      description: "Purchase users / Checkout Step 0 users",
    },
  },

  additionalMetrics: [],
  extraMetrics: [],
  availableFilters: ["ga4City", "country", "device", "trafficSource", "trafficMedium"],

  mockProfile: {
    baseRootVolume: 12336,
    shoppingStageRates: {
      viewItem: 3523 / 12336,
      addToCart: 1513 / 3523,
      beginCheckout: 1334 / 1513,
      purchase: 558 / 1334,
    },
    checkoutRootRate: 1462 / 12336,
    // step1's rate is intentionally > 1 (1584/1462) — this is a real, observed
    // reporting quirk for Bakingo Web (spec section 19), preserved as-is. The
    // data-quality layer flags it; it is never capped or "corrected" here.
    checkoutStageRates: {
      step1: 1584 / 1462,
      step2: 1413 / 1584,
      step3: 1290 / 1413,
      step4: 1062 / 1290,
      purchase: 746 / 1062,
    },
    storyCity: "Gurgaon",
  },
};
