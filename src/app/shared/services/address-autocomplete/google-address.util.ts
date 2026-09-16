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
  { keys: ['gilgit'], code: '15100' },
  { keys: ['lodhran', 'dunyapur', 'kehror', 'mailsi'], code: '59320' },
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

/** Google Open Location Codes like PJ7J+FH — not useful as a customer street address. */
export function stripGooglePlusCodes(value: string): string {
  return (value || '')
    .replace(/\b[2-9CFGHJMPQRVWX]{4,8}\+[2-9CFGHJMPQRVWX]{2,3}\b/gi, '')
    .replace(/\s*,\s*,/g, ',')
    .replace(/^\s*,\s*|\s*,\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Google placeholder roads (common for rural pins) — never show these to customers. */
export function looksLikeUnnamedRoadLabel(value: string): boolean {
  const lower = (value || '').trim().toLowerCase();
  if (!lower) {
    return false;
  }
  return (
    /^unnamed(\s+road|\s+street|\s+rd\.?|\s+st\.?)?$/i.test(lower)
    || /^unknown(\s+road|\s+street)?$/i.test(lower)
  );
}

/**
 * Strip Plus Codes and Google "Unnamed Road" placeholders, then tidy commas/spaces.
 */
export function sanitizeGoogleStreetAddress(value: string): string {
  let cleaned = stripGooglePlusCodes(value || '');

  // Remove "Unnamed Road" / "Unnamed Street" anywhere in the line.
  cleaned = cleaned
    .replace(/\bunnamed(\s+road|\s+street|\s+rd\.?|\s+st\.?)?\b/gi, '')
    .replace(/\bunknown(\s+road|\s+street)?\b/gi, '')
    .replace(/\s*,\s*,/g, ',')
    .replace(/^\s*,\s*|\s*,\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Drop a leading/trailing orphan comma leftover after removals.
  cleaned = cleaned.replace(/^,+|,+$/g, '').trim();

  return cleaned;
}

/**
 * Google often tags Pakistani chaks / mauzas / bastis as `locality`, but those are villages
 * or colony labels — not the Town / City customers should enter (e.g. Lodhran, Multan).
 */
export function looksLikeVillageOrChakLabel(value: string): boolean {
  const raw = (value || '').trim();
  if (!raw) {
    return false;
  }

  const normalized = raw.replace(/\s+/g, ' ');
  const lower = normalized.toLowerCase();

  if (/\b(chak|mauza|moza|basti|mohalla|mohallah|colony|block)\b/.test(lower)) {
    return true;
  }

  // "364 WB", "364/WB", "364-WB"
  if (/^\d{1,4}\s*[\/\-]?\s*[a-z]{1,4}$/i.test(normalized)) {
    return true;
  }

  // Compact codes like "344WB" / "364WB"
  if (/^\d{2,4}[a-z]{1,4}$/i.test(normalized.replace(/\s+/g, ''))) {
    return true;
  }

  // "No 364 WB"
  if (/^(no\.?\s*)?\d{1,4}\s*[\/\-]?\s*[a-z]{1,4}$/i.test(normalized)) {
    return true;
  }

  return false;
}

function appendTownStateToAddress(address: string, town: string, state: string): string {
  const parts = [address.trim()];
  if (town && !containsPart(address, town) && !looksLikeVillageOrChakLabel(town)) {
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

function labelFromPredictionDescription(description?: string): string {
  return description ? addressFromPredictionDescription(description) : '';
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
  predictionDescription?: string,
  villageOrColony?: string
): string {
  const streetNumber = pickComponent(components, 'street_number');
  const routeRaw = pickComponent(components, 'route');
  const route = looksLikeUnnamedRoadLabel(routeRaw) ? '' : routeRaw;
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
    villageOrColony && looksLikeVillageOrChakLabel(villageOrColony) ? villageOrColony : '',
    neighborhood,
    sublocality2,
    sublocality1,
    sublocality && looksLikeVillageOrChakLabel(sublocality) ? sublocality : '',
  ]);

  // Prefer prediction text for rural Pakistan picks (often richer than components).
  const fromPrediction = predictionDescription
    ? sanitizeGoogleStreetAddress(addressFromPredictionDescription(predictionDescription))
    : '';

  if (fromPrediction && (!address || fromPrediction.length > address.length)) {
    address = fromPrediction;
  }

  if (!address && place.formatted_address) {
    const firstPart = sanitizeGoogleStreetAddress(
      place.formatted_address.split(',')[0]?.trim() || ''
    );
    // If first part was only "Unnamed Road", try the next meaningful part.
    if (firstPart) {
      address = firstPart;
    } else {
      const parts = (place.formatted_address || '')
        .split(',')
        .map((p) => sanitizeGoogleStreetAddress(p))
        .filter((p) => !!p && !looksLikeUnnamedRoadLabel(p));
      address = parts[0] || '';
    }
  }

  if (villageOrColony && looksLikeVillageOrChakLabel(villageOrColony) && !containsPart(address, villageOrColony)) {
    address = uniqueParts([villageOrColony, address]);
  }

  return sanitizeGoogleStreetAddress(address);
}

/**
 * Pick Town/City for checkout: prefer real city/district over Google `locality` when that
 * locality is actually a chak / mauza / basti label.
 */
function resolveTownAndVillage(
  components: google.maps.GeocoderAddressComponent[]
): { town: string; villageOrColony: string; district: string; state: string } {
  const locality = pickComponent(components, 'locality');
  const postalTown = pickComponent(components, 'postal_town');
  const adminLevel3 = pickComponent(components, 'administrative_area_level_3');
  const district = pickComponent(components, 'administrative_area_level_2');
  const state = pickComponent(components, 'administrative_area_level_1');
  const sublocality = pickComponent(components, 'sublocality');
  const sublocality1 = pickComponent(components, 'sublocality_level_1');

  const candidates = [locality, postalTown, adminLevel3, sublocality, sublocality1]
    .map((v) => (v || '').trim())
    .filter(Boolean);

  let villageOrColony = '';
  let town = '';

  for (const candidate of candidates) {
    if (looksLikeVillageOrChakLabel(candidate)) {
      if (!villageOrColony) {
        villageOrColony = candidate;
      }
      continue;
    }
    if (!town) {
      town = candidate;
    }
  }

  if (!town) {
    // District is the reliable "city" for rural Punjab when locality was only a chak.
    town = district;
  }

  // If Google still gave a chak-like district (rare), keep it out of Town.
  if (town && looksLikeVillageOrChakLabel(town)) {
    if (!villageOrColony) {
      villageOrColony = town;
    }
    town = '';
  }

  return { town, villageOrColony, district, state };
}

export function parseGooglePlaceAddress(
  place: google.maps.places.PlaceResult,
  mode: GoogleAddressFieldMode = 'address',
  currentValues?: Partial<ParsedGoogleAddress>,
  predictionDescription?: string
): ParsedGoogleAddress {
  const components = place.address_components || [];
  const { town, villageOrColony, district, state } = resolveTownAndVillage(components);

  const currentAddress = currentValues?.address?.trim() || '';
  const currentTown = currentValues?.town?.trim() || '';
  const currentState = currentValues?.state?.trim() || '';
  const currentPostal = currentValues?.postalcode?.trim() || '';

  // Never keep a previous chak label in Town once we can resolve a better city.
  const currentTownUsable =
    currentTown && !looksLikeVillageOrChakLabel(currentTown) ? currentTown : '';

  const resolvedTown = town || currentTownUsable || district;
  const resolvedState = state || currentState;
  const postalcode =
    extractPostalCode(place)
    || resolvePakistanPostalFallback(resolvedTown, district, resolvedState)
    || currentPostal;

  if (mode === 'state') {
    const fromPrediction = labelFromPredictionDescription(predictionDescription);
    return {
      address: currentAddress,
      town: currentTownUsable || resolvedTown,
      state: fromPrediction || resolvedState,
      postalcode: extractPostalCode(place) || currentPostal
    };
  }

  if (mode === 'town') {
    // Town autocomplete must still reject chak localities as the city value.
    return {
      address: currentAddress,
      town: resolvedTown,
      state: resolvedState,
      postalcode
    };
  }

  const streetAddress = buildStreetAddress(
    place,
    components,
    predictionDescription,
    villageOrColony
  );
  const baseAddress = streetAddress || currentAddress;
  const fullAddress = appendTownStateToAddress(baseAddress, resolvedTown, resolvedState);

  return {
    address: sanitizeGoogleStreetAddress(fullAddress),
    town: resolvedTown,
    state: resolvedState,
    postalcode
  };
}
