/**
 * Minimal Google Maps Places typings for address autocomplete.
 */
declare namespace google.maps.places {
  interface AutocompletePrediction {
    description: string;
    place_id: string;
  }

  interface PlaceResult {
    address_components?: google.maps.GeocoderAddressComponent[];
    formatted_address?: string;
  }

  interface PlaceDetailsRequest {
    placeId?: string;
    fields?: string[];
  }

  class AutocompleteService {
    getPlacePredictions(
      request: { input: string; types?: string[] },
      callback: (predictions: AutocompletePrediction[] | null, status: string) => void
    ): void;
  }

  class PlacesService {
    constructor(attrContainer: HTMLElement);
    getDetails(
      request: PlaceDetailsRequest,
      callback: (place: PlaceResult | null, status: string) => void
    ): void;
  }

  enum PlacesServiceStatus {
    OK = 'OK'
  }
}

declare namespace google.maps {
  interface GeocoderAddressComponent {
    long_name: string;
    short_name: string;
    types: string[];
  }
}

declare const google: {
  maps: {
    places: typeof google.maps.places;
  } & typeof google.maps;
};
