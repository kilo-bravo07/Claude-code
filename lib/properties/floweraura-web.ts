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
  },

  checkout: {
    root: { key: "beginCheckout", label: "Begin Checkout", ga4EventName: "begin_checkout" },
    stages: [
      { key: "step2", label: "Step 2", ga4EventName: "checkout_step_2" },
      { key: "step3", label: "Step 3", ga4EventName: "checkout_step_3" },
      { key: "step4", label: "Step 4", ga4EventName: "checkout_step_4" },
      { key: "step5", label: "Step 5", ga4EventName: "checkout_step_5" },
      { key: "purchase", label: "Purchase", ga4EventName: "purchase" },
    ],
    ecr: {
      key: "checkoutEcr",
      label: "Checkout ECR",
      numeratorKey: "purchase",
      denominatorKey: "beginCheckout",
      description: "Purchase users / Begin Checkout users",
    },
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
      purchase: 566 / 732,
    },
    storyCity: "Gurgaon",
  },
};
