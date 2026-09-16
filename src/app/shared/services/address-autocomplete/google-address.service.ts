import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { GoogleMapsLoaderService } from './google-maps-loader.service';
import { GoogleAddressFieldMode, PAKISTAN_COUNTRY_CODE } from './google-address.util';

@Injectable({
  providedIn: 'root'
})
export class GoogleAddressService {
  /** Ignore short keystrokes — saves Autocomplete billable events. */
  static readonly MIN_AUTOCOMPLETE_CHARS = 3;

  private autocompleteService: google.maps.places.AutocompleteService | null = null;

  /**
   * One Google Autocomplete session per field mode. When the customer picks a place,
   * Place Details reuses the token so keystroke predictions are billed as a session
   * (much cheaper than per-request Autocomplete).
   */
  private sessionTokens: Partial<Record<GoogleAddressFieldMode, google.maps.places.AutocompleteSessionToken>> = {};
  private lastPredictionQuery: Partial<Record<GoogleAddressFieldMode, string>> = {};

  suggestions$ = new BehaviorSubject<google.maps.places.AutocompletePrediction[]>([]);
  isAddressSelect = false;

  constructor(private googleMapsLoader: GoogleMapsLoaderService) {}

  private async ensureService(): Promise<boolean> {
    try {
      await this.googleMapsLoader.load();
    } catch {
      return false;
    }

    if (!this.autocompleteService && typeof google !== 'undefined') {
      this.autocompleteService = new google.maps.places.AutocompleteService();
    }

    return !!this.autocompleteService;
  }

  private predictionTypes(mode: GoogleAddressFieldMode): string[] {
    switch (mode) {
      case 'town':
        return ['(cities)'];
      case 'state':
        return ['(regions)'];
      case 'address':
      default:
        return ['geocode', 'establishment'];
    }
  }

  private ensureSessionToken(mode: GoogleAddressFieldMode): google.maps.places.AutocompleteSessionToken | undefined {
    if (typeof google === 'undefined' || !google.maps?.places?.AutocompleteSessionToken) {
      return undefined;
    }
    if (!this.sessionTokens[mode]) {
      this.sessionTokens[mode] = new google.maps.places.AutocompleteSessionToken();
    }
    return this.sessionTokens[mode];
  }

  /** Start a fresh Autocomplete billing session (after pick / clear / blur abandon). */
  beginAutocompleteSession(mode?: GoogleAddressFieldMode): void {
    if (typeof google === 'undefined' || !google.maps?.places?.AutocompleteSessionToken) {
      return;
    }
    if (mode) {
      this.sessionTokens[mode] = new google.maps.places.AutocompleteSessionToken();
      delete this.lastPredictionQuery[mode];
      return;
    }
    this.sessionTokens = {
      address: new google.maps.places.AutocompleteSessionToken(),
      town: new google.maps.places.AutocompleteSessionToken(),
      state: new google.maps.places.AutocompleteSessionToken(),
    };
    this.lastPredictionQuery = {};
  }

  private endAutocompleteSession(mode: GoogleAddressFieldMode): void {
    delete this.sessionTokens[mode];
    delete this.lastPredictionQuery[mode];
  }

  async getPlacePredictions(input: string, mode: GoogleAddressFieldMode = 'address'): Promise<void> {
    const query = (input || '').trim();
    if (query.length < GoogleAddressService.MIN_AUTOCOMPLETE_CHARS) {
      this.suggestions$.next([]);
      return;
    }

    // Same text already fetched for this field — don't bill again.
    if (this.lastPredictionQuery[mode] === query.toLowerCase()) {
      return;
    }

    const ready = await this.ensureService();
    if (!ready) {
      this.suggestions$.next([]);
      return;
    }

    const sessionToken = this.ensureSessionToken(mode);
    const request: google.maps.places.AutocompletionRequest = {
      input: query,
      types: this.predictionTypes(mode),
      componentRestrictions: { country: PAKISTAN_COUNTRY_CODE },
      ...(sessionToken ? { sessionToken } : {}),
    };

    this.lastPredictionQuery[mode] = query.toLowerCase();

    this.autocompleteService!.getPlacePredictions(request, (predictions, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
        this.suggestions$.next(predictions);
      } else {
        this.suggestions$.next([]);
      }
    });
  }

  selectAddress2(
    address: google.maps.places.AutocompletePrediction,
    callback: (place: google.maps.places.PlaceResult) => void,
    mode: GoogleAddressFieldMode = 'address'
  ): void {
    this.isAddressSelect = true;
    this.suggestions$.next([]);

    const sessionToken = this.sessionTokens[mode] || this.ensureSessionToken(mode);
    const request: google.maps.places.PlaceDetailsRequest = {
      placeId: address.place_id,
      // Essentials-level fields only — avoid higher Places Details SKUs.
      fields: ['address_components', 'formatted_address', 'geometry'],
      ...(sessionToken ? { sessionToken } : {}),
    };
    const placesService = new google.maps.places.PlacesService(document.createElement('div'));

    placesService.getDetails(request, (place, status) => {
      // Session ends when Place Details is called with the same token.
      this.endAutocompleteSession(mode);
      this.beginAutocompleteSession(mode);

      if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
        return;
      }

      // Do not chain extra Geocoding calls for postal code — parseGooglePlaceAddress
      // already applies Pakistan postal fallbacks (saves Geocoding SKU usage).
      callback(place);
    });
  }

  /** Coordinates for an address the customer typed (or one restored from their profile). */
  async geocodeAddressText(addressText: string): Promise<{ latitude: number; longitude: number } | null> {
    const text = addressText?.trim();
    if (!text) {
      return null;
    }

    const ready = await this.ensureService();
    if (!ready) {
      return null;
    }

    const geocoder = new google.maps.Geocoder();
    return new Promise((resolve) => {
      geocoder.geocode(
        { address: text, componentRestrictions: { country: PAKISTAN_COUNTRY_CODE } },
        (results, status) => {
          const location = status === google.maps.GeocoderStatus.OK ? results?.[0]?.geometry?.location : null;
          resolve(location ? { latitude: location.lat(), longitude: location.lng() } : null);
        }
      );
    });
  }

  /** Resolve a map pin into a Google place-like result for filling address fields. */
  async reverseGeocodeLatLng(
    latitude: number,
    longitude: number
  ): Promise<google.maps.places.PlaceResult | null> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    const ready = await this.ensureService();
    if (!ready) {
      return null;
    }

    const geocoder = new google.maps.Geocoder();
    return new Promise((resolve) => {
      geocoder.geocode(
        { location: { lat: latitude, lng: longitude } },
        (results, status) => {
          if (status !== google.maps.GeocoderStatus.OK || !results?.length) {
            resolve(null);
            return;
          }

          const result = this.preferReadableGeocodeResult(results);
          if (!result) {
            resolve(null);
            return;
          }

          resolve({
            address_components: result.address_components,
            formatted_address: this.stripPlusCodes(result.formatted_address || ''),
            geometry: result.geometry,
            place_id: result.place_id,
            name: this.stripPlusCodes(result.formatted_address || ''),
            types: result.types,
          } as google.maps.places.PlaceResult);
        }
      );
    });
  }

  /**
   * Prefer street / neighborhood / locality results over Plus Code-only reverse geocodes
   * that Google returns for rural Pakistan pins.
   */
  private preferReadableGeocodeResult(
    results: google.maps.GeocoderResult[]
  ): google.maps.GeocoderResult | null {
    const rank = (types: string[] | undefined): number => {
      const set = new Set(types || []);
      if (set.has('street_address') || set.has('premise') || set.has('subpremise')) {
        return 100;
      }
      if (set.has('route') || set.has('intersection')) {
        return 90;
      }
      if (set.has('neighborhood') || set.has('sublocality') || set.has('sublocality_level_1')) {
        return 80;
      }
      if (set.has('locality') || set.has('postal_town')) {
        return 70;
      }
      if (set.has('administrative_area_level_3') || set.has('administrative_area_level_2')) {
        return 60;
      }
      if (set.has('plus_code')) {
        return 10;
      }
      return 40;
    };

    const sorted = [...results].sort((a, b) => {
      const aPlus = this.hasPlusCodeText(a.formatted_address || '');
      const bPlus = this.hasPlusCodeText(b.formatted_address || '');
      const aUnnamed = this.hasUnnamedRoadText(a.formatted_address || '');
      const bUnnamed = this.hasUnnamedRoadText(b.formatted_address || '');
      const scoreA = rank(a.types) - (aPlus ? 25 : 0) - (aUnnamed ? 20 : 0);
      const scoreB = rank(b.types) - (bPlus ? 25 : 0) - (bUnnamed ? 20 : 0);
      return scoreB - scoreA;
    });

    return sorted[0] || null;
  }

  private hasPlusCodeText(value: string): boolean {
    return /\b[2-9CFGHJMPQRVWX]{4,8}\+[2-9CFGHJMPQRVWX]{2,3}\b/i.test(value);
  }

  private hasUnnamedRoadText(value: string): boolean {
    return /\bunnamed(\s+road|\s+street|\s+rd\.?|\s+st\.?)?\b/i.test(value || '');
  }

  private stripPlusCodes(value: string): string {
    return (value || '')
      .replace(/\b[2-9CFGHJMPQRVWX]{4,8}\+[2-9CFGHJMPQRVWX]{2,3}\b/gi, '')
      .replace(/\bunnamed(\s+road|\s+street|\s+rd\.?|\s+st\.?)?\b/gi, '')
      .replace(/\s*,\s*,/g, ',')
      .replace(/^\s*,\s*|\s*,\s*$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  clearSuggestions(): void {
    this.suggestions$.next([]);
  }
}
