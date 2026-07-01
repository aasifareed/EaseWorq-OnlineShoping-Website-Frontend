import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { GoogleMapsLoaderService } from './google-maps-loader.service';
import { GoogleAddressFieldMode, PAKISTAN_COUNTRY_CODE, extractPostalCode } from './google-address.util';

@Injectable({
  providedIn: 'root'
})
export class GoogleAddressService {
  private autocompleteService: google.maps.places.AutocompleteService | null = null;

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

  async getPlacePredictions(input: string, mode: GoogleAddressFieldMode = 'address'): Promise<void> {
    const ready = await this.ensureService();
    if (!ready || !input?.trim()) {
      this.suggestions$.next([]);
      return;
    }

    const request: google.maps.places.AutocompletionRequest = {
      input: input.trim(),
      types: this.predictionTypes(mode),
      componentRestrictions: { country: PAKISTAN_COUNTRY_CODE }
    };

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
    callback: (place: google.maps.places.PlaceResult) => void
  ): void {
    this.isAddressSelect = true;
    this.suggestions$.next([]);

    const request: google.maps.places.PlaceDetailsRequest = {
      placeId: address.place_id,
      fields: ['address_components', 'formatted_address', 'geometry']
    };
    const placesService = new google.maps.places.PlacesService(document.createElement('div'));

    placesService.getDetails(request, (place, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
        return;
      }

      void this.enrichPlacePostalCode(place).then((enriched) => callback(enriched));
    });
  }

  /** Autocomplete predictions never include postal codes; try geocoding when Place Details omit them. */
  private async enrichPlacePostalCode(
    place: google.maps.places.PlaceResult
  ): Promise<google.maps.places.PlaceResult> {
    if (extractPostalCode(place)) {
      return place;
    }

    const geocoder = new google.maps.Geocoder();
    const location = place.geometry?.location;
    const formattedAddress = place.formatted_address?.trim();

    const tryGeocode = (
      request: google.maps.GeocoderRequest
    ): Promise<google.maps.GeocoderResult | null> =>
      new Promise((resolve) => {
        geocoder.geocode(request, (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results?.[0]) {
            resolve(results[0]);
            return;
          }
          resolve(null);
        });
      });

    const candidates: google.maps.GeocoderRequest[] = [];
    if (location) {
      candidates.push({ location });
    }
    if (formattedAddress) {
      candidates.push({
        address: formattedAddress,
        componentRestrictions: { country: PAKISTAN_COUNTRY_CODE }
      });
    }

    for (const request of candidates) {
      const result = await tryGeocode(request);
      const postalComponent = result?.address_components?.find((c) =>
        c.types.includes('postal_code') || c.types.includes('postal_code_prefix')
      );
      if (!postalComponent) {
        continue;
      }

      const postal = postalComponent.long_name?.trim() || postalComponent.short_name?.trim() || '';
      if (!postal) {
        continue;
      }

      return {
        ...place,
        address_components: [...(place.address_components || []), postalComponent],
        formatted_address: result?.formatted_address || place.formatted_address
      };
    }

    return place;
  }

  clearSuggestions(): void {
    this.suggestions$.next([]);
  }
}
