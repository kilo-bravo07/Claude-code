import { FLOWERAURA_WEB } from "./floweraura-web";
import { FLOWERAURA_APP } from "./floweraura-app";
import { BAKINGO_WEB } from "./bakingo-web";
import { BAKINGO_APP } from "./bakingo-app";
import type { PropertyConfig, PropertyKey } from "./types";

export const PROPERTIES: Record<PropertyKey, PropertyConfig> = {
  "floweraura-web": FLOWERAURA_WEB,
  "floweraura-app": FLOWERAURA_APP,
  "bakingo-web": BAKINGO_WEB,
  "bakingo-app": BAKINGO_APP,
};

export const PROPERTY_KEYS = Object.keys(PROPERTIES) as PropertyKey[];

export const DEFAULT_PROPERTY_KEY: PropertyKey = "floweraura-web";

export function isPropertyKey(value: string): value is PropertyKey {
  return value in PROPERTIES;
}

export function getProperty(key: string): PropertyConfig {
  if (isPropertyKey(key)) return PROPERTIES[key];
  return PROPERTIES[DEFAULT_PROPERTY_KEY];
}

export * from "./types";
