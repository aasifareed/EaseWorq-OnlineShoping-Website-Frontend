/**
 * Weight arrives from the server in kilograms, which is what the couriers bill in. This shop sells
 * mobile accessories, so most parcels are a couple of hundred grams and "0.18 kg" reads as a rounding
 * artefact where "180 g" reads as a weight. Formatting lives here so the storefront and the admin
 * describe the same parcel identically.
 */

/** Grams under a kilogram, kilograms at or above. Empty string when the weight is unknown. */
export function describeWeight(weightKg: number | null | undefined): string {
  const kg = Number(weightKg ?? 0);
  if (!Number.isFinite(kg) || kg <= 0) {
    return '';
  }

  if (kg < 1) {
    return `${Math.round(kg * 1000)} g`;
  }

  return `${Number(kg.toFixed(2))} kg`;
}
