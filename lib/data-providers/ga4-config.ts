/**
 * Every GA4-specific name (event names, custom-dimension names) that this
 * app depends on is read from the environment here — nothing is hardcoded
 * in ga4-provider.ts itself. See .env.example and README.md ("Connecting
 * GA4") for what each of these means and how to find the right value for
 * your property.
 */
function env(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

export const ga4Config = {
  propertyId: process.env.GA4_PROPERTY_ID?.trim() || "",

  auth: {
    serviceAccountKeyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() || "",
    oauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || "",
    oauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || "",
    oauthRefreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim() || "",
  },

  events: {
    sessionStart: env("GA4_EVENT_SESSION_START", "session_start"),
    viewItem: env("GA4_EVENT_VIEW_ITEM", "view_item"),
    addToCart: env("GA4_EVENT_ADD_TO_CART", "add_to_cart"),
    beginCheckout: env("GA4_EVENT_BEGIN_CHECKOUT", "begin_checkout"),
    checkoutStep2: env("GA4_EVENT_CHECKOUT_STEP2", "checkout_step_2"),
    checkoutStep3: env("GA4_EVENT_CHECKOUT_STEP3", "checkout_step_3"),
    checkoutStep4: env("GA4_EVENT_CHECKOUT_STEP4", "checkout_step_4"),
    checkoutStep5: env("GA4_EVENT_CHECKOUT_STEP5", "checkout_step_5"),
    purchase: env("GA4_EVENT_PURCHASE", "purchase"),
  },

  /**
   * GA4 custom dimension that identifies "brand" (e.g. multiple sites/apps
   * reporting into one property). Leave unset if you have a single brand —
   * the dashboard will report everything under "Default".
   * Format: "customEvent:your_dimension_name" or "customUser:your_dimension_name".
   */
  brandDimension: process.env.GA4_BRAND_DIMENSION?.trim() || "",
};

export function isGa4Configured(): boolean {
  const hasProperty = !!ga4Config.propertyId;
  const hasServiceAccount = !!ga4Config.auth.serviceAccountKeyFile;
  const hasOauth =
    !!ga4Config.auth.oauthClientId && !!ga4Config.auth.oauthClientSecret && !!ga4Config.auth.oauthRefreshToken;
  return hasProperty && (hasServiceAccount || hasOauth);
}
