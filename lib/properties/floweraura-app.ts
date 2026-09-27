import type { PropertyConfig } from "./types";

export const FLOWERAURA_APP: PropertyConfig = {
  key: "floweraura-app",
  displayName: "FlowerAura App",
  brand: "FlowerAura",
  platform: "App",
  ga4PropertyIdEnvVar: "FLOWERAURA_APP_GA4_PROPERTY_ID",

  shopping: {
    root: { key: "sessionStart", label: "Session Start", ga4EventName: "session_start" },
    stages: [
      { key: "productView", label: "Product View", ga4EventName: "view_item" },
      { key: "buyNow", label: "Buy Now / ATC", ga4EventName: "buy_now" },
      { key: "checkoutStep0", label: "Checkout", ga4EventName: "checkout_step0" },
      { key: "orderConfirmed", label: "TRX", ga4EventName: "order_confirmed" },
    ],
    ecr: {
      key: "ecr",
      label: "ECR",
      numeratorKey: "orderConfirmed",
      denominatorKey: "sessionStart",
      description: "Order Confirmed users / Session Start users",
    },
  },

  checkout: {
    root: { key: "checkoutStep0", label: "Checkout Step 0", ga4EventName: "checkout_step0" },
    stages: [
      { key: "step1", label: "Step 1", ga4EventName: "checkout_step1" },
      { key: "step2", label: "Step 2", ga4EventName: "checkout_step2" },
      { key: "step3", label: "Step 3", ga4EventName: "checkout_step3" },
      { key: "step4", label: "Step 4", ga4EventName: "checkout_step4" },
      { key: "payment", label: "Payment", ga4EventName: "payment" },
      { key: "orderConfirmed", label: "Order Confirmed", ga4EventName: "order_confirmed" },
    ],
    ecr: {
      key: "checkoutEcr",
      label: "ECR",
      numeratorKey: "orderConfirmed",
      denominatorKey: "checkoutStep0",
      description: "Order Confirmed users / Checkout Step 0 users",
    },
  },

  // FlowerAura App is the only property with a second ECR-like metric: New ECR
  // divides by total Active Users instead of Session Start. Never remove this
  // just because the other three properties don't have it.
  additionalMetrics: [
    {
      key: "newEcr",
      label: "New ECR",
      numeratorKey: "orderConfirmed",
      denominatorKey: "activeUsers",
      description: "Order Confirmed users / Active Users (not Session Start — this is FlowerAura App's own reporting definition)",
    },
  ],
  extraMetrics: [{ key: "activeUsers", label: "Active Users", ga4EventName: null }],
  availableFilters: ["country", "device", "trafficSource", "trafficMedium"],

  mockProfile: {
    baseRootVolume: 1935,
    shoppingStageRates: {
      productView: 780 / 1935,
      buyNow: 439 / 780,
      checkoutStep0: 386 / 439,
      orderConfirmed: 225 / 386,
    },
    checkoutRootRate: 386 / 1935,
    checkoutStageRates: {
      step1: 353 / 386,
      step2: 305 / 353,
      step3: 297 / 305,
      step4: 266 / 297,
      payment: 266 / 266,
      orderConfirmed: 225 / 266,
    },
    extraMetricRates: {
      activeUsers: 1791 / 1935,
    },
  },
};
