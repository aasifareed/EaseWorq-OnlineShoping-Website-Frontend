import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { GoogleAddressService } from '../../../shared/services/address-autocomplete/google-address.service';
import { parseGooglePlaceAddress, sanitizeGoogleStreetAddress } from '../../../shared/services/address-autocomplete/google-address.util';
import { GoogleMapsLoaderService } from '../../../shared/services/address-autocomplete/google-maps-loader.service';

export interface MapLatLng {
  latitude: number;
  longitude: number;
}

export interface MapLocationPickResult {
  latitude: number;
  longitude: number;
  address: {
    address: string;
    town: string;
    state: string;
    postalcode: string;
    formattedAddress: string;
  } | null;
}

@Component({
  selector: 'app-google-location-picker',
  templateUrl: './google-location-picker.component.html',
  styleUrls: ['./google-location-picker.component.scss'],
})
export class GoogleLocationPickerComponent implements AfterViewInit, OnDestroy {
  @Input() initialPoint: MapLatLng | null = null;
  @Input() addressQuery: string | null = null;
  @Output() picked = new EventEmitter<MapLocationPickResult>();
  @Output() cancelled = new EventEmitter<void>();

  @ViewChild('mapHost', { static: true }) mapHost!: ElementRef<HTMLDivElement>;

  isLoading = true;
  isApplying = false;
  loadError: string | null = null;
  statusMessage = 'Detecting your current location…';
  selectedPoint: MapLatLng | null = null;

  private map: google.maps.Map | null = null;
  private marker: google.maps.Marker | null = null;
  private clickListener: google.maps.MapsEventListener | null = null;
  private dragListener: google.maps.MapsEventListener | null = null;

  constructor(
    private googleMapsLoader: GoogleMapsLoaderService,
    private googleAddress: GoogleAddressService,
  ) {}

  ngAfterViewInit(): void {
    setTimeout(() => void this.open(), 0);
  }

  ngOnDestroy(): void {
    this.destroyMap();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement)?.classList?.contains('google-location-modal')) {
      this.close();
    }
  }

  close(): void {
    this.destroyMap();
    this.cancelled.emit();
  }

  useMyLocation(): void {
    void this.moveToBrowserGeolocation();
  }

  async saveLocation(): Promise<void> {
    if (!this.selectedPoint || this.isApplying) {
      return;
    }

    this.isApplying = true;
    this.statusMessage = 'Updating address from selected location…';

    const place = await this.googleAddress.reverseGeocodeLatLng(
      this.selectedPoint.latitude,
      this.selectedPoint.longitude,
    );

    let address: MapLocationPickResult['address'] = null;
    if (place) {
      const parsed = parseGooglePlaceAddress(place, 'address');
      address = {
        address: sanitizeGoogleStreetAddress(parsed.address || '').trim(),
        town: (parsed.town || '').trim(),
        state: (parsed.state || '').trim(),
        postalcode: (parsed.postalcode || '').trim(),
        formattedAddress: sanitizeGoogleStreetAddress(place.formatted_address || '').trim(),
      };
    }

    this.picked.emit({
      latitude: this.selectedPoint.latitude,
      longitude: this.selectedPoint.longitude,
      address,
    });

    this.isApplying = false;
    this.destroyMap();
  }

  private async open(): Promise<void> {
    this.isLoading = true;
    this.loadError = null;
    this.statusMessage = 'Loading Google Maps…';

    try {
      await this.googleMapsLoader.load();

      const { point: center, source } = await this.resolveInitialCenter();
      this.selectedPoint = { ...center };

      this.map = new google.maps.Map(this.mapHost.nativeElement, {
        center: { lat: center.latitude, lng: center.longitude },
        zoom: 18,
        mapTypeId: 'roadmap',
        streetViewControl: false,
        fullscreenControl: false,
        mapTypeControl: false,
        // POI info windows show Plus Codes (e.g. PJ7J+FH) instead of readable addresses.
        clickableIcons: false,
        gestureHandling: 'greedy',
      });

      this.marker = new google.maps.Marker({
        map: this.map,
        position: { lat: center.latitude, lng: center.longitude },
        draggable: true,
        title: 'Delivery location',
      });

      this.clickListener = this.map.addListener('click', (event: google.maps.MapMouseEvent) => {
        const latLng = event.latLng;
        if (!latLng) {
          return;
        }
        this.setSelectedPoint(
          { latitude: latLng.lat(), longitude: latLng.lng() },
          'Location updated. Save to fill your address.',
        );
      });

      this.dragListener = this.marker.addListener('dragend', () => {
        const position = this.marker?.getPosition();
        if (!position) {
          return;
        }
        this.setSelectedPoint(
          { latitude: position.lat(), longitude: position.lng() },
          'Location updated. Save to fill your address.',
        );
      });

      this.isLoading = false;
      this.statusMessage =
        source === 'gps'
          ? 'Current location selected. Drag the pin or tap the map, then save.'
          : 'Drag the pin onto your building or street, then save.';

      // Recalculate tiles after the large modal layout settles.
      setTimeout(() => {
        google.maps.event.trigger(this.map, 'resize');
        if (this.selectedPoint) {
          this.map?.setCenter({
            lat: this.selectedPoint.latitude,
            lng: this.selectedPoint.longitude,
          });
        }
      }, 50);
    } catch (err) {
      console.error('Failed to open Google location picker', err);
      this.loadError = 'Unable to load Google Maps. Check the API key and enabled APIs.';
      this.isLoading = false;
    }
  }

  private async resolveInitialCenter(): Promise<{ point: MapLatLng; source: 'gps' | 'fallback' }> {
    const current = await this.readBrowserGeolocation();
    if (current && this.isInPakistan(current)) {
      return { point: current, source: 'gps' };
    }

    if (this.initialPoint) {
      return { point: { ...this.initialPoint }, source: 'fallback' };
    }

    const fromAddress = await this.googleAddress.geocodeAddressText(this.addressQuery || '');
    if (fromAddress) {
      return { point: fromAddress, source: 'fallback' };
    }

    return { point: { latitude: 29.840612, longitude: 71.545335 }, source: 'fallback' };
  }

  private async moveToBrowserGeolocation(): Promise<void> {
    this.statusMessage = 'Detecting your current location…';
    const point = await this.readBrowserGeolocation();
    if (!point) {
      this.statusMessage = 'Could not read your current location. Move the pin on the map instead.';
      return;
    }

    this.setSelectedPoint(point, 'Moved pin to your current location. Adjust if needed, then save.');
    this.map?.panTo({ lat: point.latitude, lng: point.longitude });
    this.map?.setZoom(18);
  }

  private setSelectedPoint(point: MapLatLng, message: string): void {
    this.selectedPoint = point;
    this.marker?.setPosition({ lat: point.latitude, lng: point.longitude });
    this.statusMessage = message;
  }

  private isInPakistan(point: MapLatLng): boolean {
    return (
      point.latitude >= 23.5 &&
      point.latitude <= 37.5 &&
      point.longitude >= 60.5 &&
      point.longitude <= 77.5
    );
  }

  private readBrowserGeolocation(): Promise<MapLatLng | null> {
    if (!navigator?.geolocation) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
      );
    });
  }

  private destroyMap(): void {
    this.clickListener?.remove();
    this.dragListener?.remove();
    this.clickListener = null;
    this.dragListener = null;
    this.marker?.setMap(null);
    this.marker = null;
    this.map = null;
  }
}
