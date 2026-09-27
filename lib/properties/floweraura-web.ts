import type { PropertyConfig } from "./types";

export const FLOWERAURA_WEB: PropertyConfig = {
  key: "floweraura-web",
  displayName: "FlowerAura Web",
  brand: "FlowerAura",
  platform: "Web",
  ga4PropertyIdEnvVar: "FLOWERAURA_WEB_GA4_PROPERTY_ID",

  shopping: {
    root: { key: "sessionStart", label: "Session Start", ga4EventName: "session_start" },
    stages: [
      { key: "viewItem", label: "View Item", ga4EventName: "view_item" },
      { key: "addToCart", label: "Add to Cart", ga4EventName: "add_to_cart" },
      { key: "beginCheckout", label: "Checkout", ga4EventName: "begin_checkout" },
      { key: "purchase", label: "Purchase", ga4EventName: "purchase" },
    ],
    ecr: {
      key: "ecr",
      label: "ECR",
      numeratorKey: "purchase",
      denominatorKey: "sessionStart",
      description: "Purchase users / Session Start users",
    },
    // Matches the exact segment used in the existing FlowerAura Web GA4
    // reporting: exclude blog/quote/shayari content pages and non-shopping
    // ad traffic (branding/display/demand/video campaigns, Criteo) from the
    // shopping funnel.
    baseFilters: [
      { dimension: "landingPage", match: "partial_regexp", value: "blog|/p/|quote|shayari", negate: true },
      { dimension: "sessionCampaignName", match: "partial_regexp", value: "Branding|display|demand|video", negate: true },
      { dimension: "sessionSourceMedium", match: "partial_regexp", value: "criteo", negate: true },
    ],
  },

  checkout: {
    // Renamed from the shopping funnel's "beginCheckout" stage key: the
    // checkout funnel applies a NARROWER exclusion segment than shopping
    // (see baseFilters below), so its begin_checkout count is not
    // guaranteed to equal shopping's — they must not share a raw-counts key.
    root: { key: "checkoutRoot", label: "Begin Checkout", ga4EventName: "begin_checkout" },
    stages: [
      { key: "step2", label: "Step 2", ga4EventName: "checkout_step2" },
      { key: "step3", label: "Step 3", ga4EventName: "checkout_step3" },
      { key: "step4", label: "Step 4", ga4EventName: "checkout_step4" },
      { key: "step5", label: "Step 5", ga4EventName: "checkout_step5" },
      // Renamed from shopping's "purchase" for the same reason as the root above.
      { key: "checkoutPurchase", label: "Purchase", ga4EventName: "purchase" },
    ],
    ecr: {
      key: "checkoutEcr",
      label: "Checkout ECR",
      numeratorKey: "checkoutPurchase",
      denominatorKey: "checkoutRoot",
      description: "Purchase users / Begin Checkout users",
    },
    baseFilters: [
      { dimension: "landingPage", match: "partial_regexp", value: "blog|/p/", negate: true },
      { dimension: "sessionCampaignName", match: "contains", value: "branding", negate: true },
    ],
  },

  additionalMetrics: [],
  extraMetrics: [],
  availableFilters: ["ga4City", "country", "device", "trafficSource", "trafficMedium"],

  mockProfile: {
    baseRootVolume: 10393,
    shoppingStageRates: {
      viewItem: 3617 / 10393,
      addToCart: 1309 / 3617,
      beginCheckout: 1207 / 1309,
      purchase: 566 / 1207,
    },
    checkoutRootRate: 1207 / 10393,
    checkoutStageRates: {
      step2: 962 / 1207,
      step3: 830 / 962,
      step4: 814 / 830,
      step5: 732 / 814,
      checkoutPurchase: 566 / 732,
    },
    storyCity: "Gurgaon",
  },
};
