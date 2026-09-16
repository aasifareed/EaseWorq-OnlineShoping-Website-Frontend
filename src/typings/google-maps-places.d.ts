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
    geometry?: google.maps.places.PlaceGeometry;
  }

  interface PlaceGeometry {
    location?: google.maps.LatLng;
  }

  interface AutocompletionRequest {
    input: string;
    types?: string[];
    componentRestrictions?: { country: string | string[] };
    sessionToken?: google.maps.places.AutocompleteSessionToken;
  }

  interface PlaceDetailsRequest {
    placeId?: string;
    fields?: string[];
    sessionToken?: google.maps.places.AutocompleteSessionToken;
  }

  class AutocompleteSessionToken {}

  class AutocompleteService {
    getPlacePredictions(
      request: AutocompletionRequest,
      callback: (
        predictions: AutocompletePrediction[] | null,
        status: google.maps.places.PlacesServiceStatus | string
      ) => void
    ): void;
  }

  class PlacesService {
    constructor(attrContainer: HTMLElement);
    getDetails(
      request: PlaceDetailsRequest,
      callback: (
        place: PlaceResult | null,
        status: google.maps.places.PlacesServiceStatus | string
      ) => void
    ): void;
  }

  enum PlacesServiceStatus {
    OK = 'OK'
  }
}

declare namespace google.maps {
  interface LatLng {
    lat(): number;
    lng(): number;
  }

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
