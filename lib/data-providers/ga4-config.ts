/**
 * GA4 auth is shared across all four properties (the same Google account/
 * service account needs Viewer access on each property) — only the GA4
 * property ID differs per property, read from the env var named in each
 * property's `ga4PropertyIdEnvVar` (lib/properties/*.ts). See .env.example
 * and README.md ("Connecting GA4") for exactly what to set.
 */
import type { PropertyConfig } from "../properties/types";

export const ga4Auth = {
  serviceAccountKeyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() || "",
  oauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || "",
  oauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || "",
  oauthRefreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim() || "",
};

export function isAuthConfigured(): boolean {
  const hasServiceAccount = !!ga4Auth.serviceAccountKeyFile;
  const hasOauth = !!ga4Auth.oauthClientId && !!ga4Auth.oauthClientSecret && !!ga4Auth.oauthRefreshToken;
  return hasServiceAccount || hasOauth;
}

export function getPropertyId(property: Pick<PropertyConfig, "ga4PropertyIdEnvVar">): string {
  return process.env[property.ga4PropertyIdEnvVar]?.trim() || "";
}

export function isPropertyConfigured(property: Pick<PropertyConfig, "ga4PropertyIdEnvVar">): boolean {
  return !!getPropertyId(property) && isAuthConfigured();
}
