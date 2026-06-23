export const PAKISTAN_COUNTRY_CODE = 'pk';

export type GoogleAddressFieldMode = 'address' | 'town' | 'state';

export interface ParsedGoogleAddress {
  address: string;
  town: string;
  state: string;
  postalcode: string;
}

/** District / city → main postal code when Google omits postal_code (common in Pakistan). */
const PAKISTAN_POSTAL_FALLBACKS: Array<{ keys: string[]; code: string }> = [
  { keys: ['dera ismail khan', 'paharpur', 'di khan', 'tank', 'kulachi', 'paroa'], code: '29160' },
  { keys: ['islamabad'], code: '44000' },
  { keys: ['rawalpindi'], code: '46000' },
  { keys: ['lahore'], code: '54000' },
  { keys: ['karachi'], code: '75500' },
  { keys: ['peshawar'], code: '25000' },
  { keys: ['multan'], code: '60000' },
  { keys: ['faisalabad'], code: '38000' },
  { keys: ['quetta'], code: '87300' },
  { keys: ['hyderabad'], code: '71000' },
  { keys: ['gujranwala'], code: '52250' },
  { keys: ['sialkot'], code: '51310' },
  { keys: ['abbottabad'], code: '22010' },
  { keys: ['mardan'], code: '23200' },
  { keys: ['swat', 'mingora'], code: '19200' },
  { keys: ['bannu'], code: '28100' },
  { keys: ['kohat'], code: '26000' },
  { keys: ['muzaffarabad'], code: '13100' },
  { keys: ['sukkur'], code: '65200' },
  { keys: ['bahawalpur'], code: '63100' },
  { keys: ['sargodha'], code: '40100' },
  { keys: ['gujrat'], code: '50700' },
  { keys: ['jhelum'], code: '49600' },
  { keys: ['sahiwal'], code: '57000' },
  { keys: ['okara'], code: '56300' },
  { keys: ['larkana'], code: '77150' },
  { keys: ['mirpur'], code: '10250' },
  { keys: ['gilgit'], code: '15100' }
];

function pickComponent(
  components: google.maps.GeocoderAddressComponent[],
  type: string,
  useShort = false
): string {
  const match = components.find((c) => c.types.includes(type));
  if (!match) {
    return '';
  }
  return (useShort ? match.short_name : match.long_name)?.trim() || '';
}

function uniqueParts(parts: string[]): string {
  const seen = new Set<string>();
  return parts
    .map((p) => p.trim())
    .filter((p) => {
      const key = p.toLowerCase();
      if (!p || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .join(', ');
}

function containsPart(address: string, part: string): boolean {
  if (!part?.trim()) {
    return false;
  }
  return address.toLowerCase().includes(part.toLowerCase());
}

function appendTownStateToAddress(address: string, town: string, state: string): string {
  const parts = [address.trim()];
  if (town && !containsPart(address, town)) {
    parts.push(town.trim());
  }
  if (state && !containsPart(address, state)) {
    parts.push(state.trim());
  }
  return uniqueParts(parts);
}

function addressFromPredictionDescription(description: string): string {
  return description.replace(/,?\s*Pakistan\s*$/i, '').trim();
}

function extractPostalFromComponents(
  components: google.maps.GeocoderAddressComponent[]
): string {
  return (
    pickComponent(components, 'postal_code')
    || pickComponent(components, 'postal_code_prefix')
  );
}

/** Pakistan uses 5-digit postal codes; sometimes only present in formatted_address. */
function extractPostalFromFormattedAddress(formattedAddress: string): string {
  const match = formattedAddress.match(/\b(\d{5})\b/);
  return match?.[1] || '';
}

export function resolvePakistanPostalFallback(
  town: string,
  district: string,
  state: string
): string {
  const blob = `${town} ${district} ${state}`.toLowerCase();
  for (const entry of PAKISTAN_POSTAL_FALLBACKS) {
    if (entry.keys.some((key) => blob.includes(key))) {
      return entry.code;
    }
  }
  return '';
}

export function extractPostalCode(place: google.maps.places.PlaceResult): string {
  const components = place.address_components || [];
  return (
    extractPostalFromComponents(components)
    || extractPostalFromFormattedAddress(place.formatted_address || '')
  );
}

function buildStreetAddress(
  place: google.maps.places.PlaceResult,
  components: google.maps.GeocoderAddressComponent[],
  predictionDescription?: string
): string {
  const streetNumber = pickComponent(components, 'street_number');
  const route = pickComponent(components, 'route');
  const premise = pickComponent(components, 'premise');
  const subpremise = pickComponent(components, 'subpremise');
  const establishment = pickComponent(components, 'establishment');
  const neighborhood = pickComponent(components, 'neighborhood');
  const sublocality1 = pickComponent(components, 'sublocality_level_1');
  const sublocality2 = pickComponent(components, 'sublocality_level_2');
  const sublocality = pickComponent(components, 'sublocality');

  let address = uniqueParts([
    premise,
    subpremise,
    establishment,
    streetNumber,
    route,
    neighborhood,
    sublocality2,
    sublocality1,
    sublocality
  ]);

  if (!address && place.formatted_address) {
    address = place.formatted_address.split(',')[0]?.trim() || '';
  }

  const fromPrediction = predictionDescription
    ? addressFromPredictionDescription(predictionDescription)
    : '';

  if (fromPrediction && (!address || fromPrediction.length > address.length)) {
    address = fromPrediction;
  }

  return address;
}

export function parseGooglePlaceAddress(
  place: google.maps.places.PlaceResult,
  mode: GoogleAddressFieldMode = 'address',
  currentValues?: Partial<ParsedGoogleAddress>,
  predictionDescription?: string
): ParsedGoogleAddress {
  const components = place.address_components || [];

  const locality = pickComponent(components, 'locality');
  const postalTown = pickComponent(components, 'postal_town');
  const adminLevel3 = pickComponent(components, 'administrative_area_level_3');
  const district = pickComponent(components, 'administrative_area_level_2');
  const state = pickComponent(components, 'administrative_area_level_1');

  const town =
    locality
    || postalTown
    || adminLevel3
    || pickComponent(components, 'sublocality')
    || pickComponent(components, 'sublocality_level_1')
    || district;

  const currentAddress = currentValues?.address?.trim() || '';
  const currentTown = currentValues?.town?.trim() || '';
  const currentState = currentValues?.state?.trim() || '';
  const currentPostal = currentValues?.postalcode?.trim() || '';

  const resolvedTown = town || currentTown || district;
  const resolvedState = state || currentState;
  const postalcode =
    extractPostalCode(place)
    || resolvePakistanPostalFallback(resolvedTown, district, resolvedState)
    || currentPostal;

  if (mode === 'state') {
    return {
      address: currentAddress,
      town: currentTown,
      state: resolvedState,
      postalcode
    };
  }

  if (mode === 'town') {
    return {
      address: currentAddress,
      town: resolvedTown,
      state: resolvedState,
      postalcode
    };
  }

  const streetAddress = buildStreetAddress(place, components, predictionDescription);
  const baseAddress = streetAddress || currentAddress;
  const fullAddress = appendTownStateToAddress(baseAddress, resolvedTown, resolvedState);

  return {
    address: fullAddress,
    town: resolvedTown,
    state: resolvedState,
    postalcode
  };
}
