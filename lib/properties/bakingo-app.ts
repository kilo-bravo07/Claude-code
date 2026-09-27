import type { PropertyConfig } from "./types";

export const BAKINGO_APP: PropertyConfig = {
  key: "bakingo-app",
  displayName: "Bakingo App",
  brand: "Bakingo",
  platform: "App",
  ga4PropertyIdEnvVar: "BAKINGO_APP_GA4_PROPERTY_ID",

  shopping: {
    root: { key: "sessionStart", label: "Session Start", ga4EventName: "session_start" },
    stages: [
      { key: "viewItem", label: "Product Viewed", ga4EventName: "view_item" },
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

  // Bakingo App's checkout funnel is a fully independent event stream from
  // its shopping funnel (checkout_initiated is not the same event as
  // begin_checkout) — the two are never combined into one funnel.
  checkout: {
    root: { key: "checkoutInitiated", label: "Checkout Initiated", ga4EventName: "checkout_initiated" },
    stages: [
      { key: "shippingInfoAdded", label: "Shipping Info Added", ga4EventName: "shipping_info_added" },
      { key: "payNowClicked", label: "Pay Now Clicked", ga4EventName: "pay_now_clicked" },
      { key: "paymentInfo", label: "Payment Info", ga4EventName: "payment_info" },
      { key: "purchase", label: "Purchase", ga4EventName: "purchase" },
    ],
    ecr: {
      key: "checkoutEcr",
      label: "Checkout ECR",
      numeratorKey: "purchase",
      denominatorKey: "checkoutInitiated",
      description: "Purchase users / Checkout Initiated users",
    },
  },

  additionalMetrics: [],
  extraMetrics: [],
  // City is left out for both App properties by default (app installs don't
  // reliably carry a usable GA4 city dimension) — adjust here if your app
  // property does report it well.
  availableFilters: ["country", "device", "trafficSource", "trafficMedium"],

  mockProfile: {
    baseRootVolume: 6262,
    shoppingStageRates: {
      viewItem: 3521 / 6262,
      addToCart: 1692 / 3521,
      beginCheckout: 976 / 1692,
      purchase: 646 / 976,
    },
    checkoutRootRate: 1162 / 6262,
    checkoutStageRates: {
      shippingInfoAdded: 1156 / 1162,
      payNowClicked: 865 / 1156,
      paymentInfo: 760 / 865,
      purchase: 646 / 760,
    },
  },
};
