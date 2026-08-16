import {
  AfterViewInit,
  Component,
  HostListener,
  OnDestroy,
  OnInit
} from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { AuthService, ShopCustomerProfile } from '../../../shared/services/auth.service';
import { trimMaxLength, trimRequired } from '../../../shop/checkout/checkout-validators';
import { GoogleAddressService } from '../../../shared/services/address-autocomplete/google-address.service';
import {
  GoogleAddressFieldMode,
  parseGooglePlaceAddress
} from '../../../shared/services/address-autocomplete/google-address.util';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, AfterViewInit, OnDestroy {

  form: UntypedFormGroup;
  loading = false;
  saving = false;
  highlightedIndex = -1;
  activeAutocompleteField: GoogleAddressFieldMode | null = null;
  private placeSelectionInFlight = false;
  private readonly destroy$ = new Subject<void>();
  private readonly lastSelectedValues: Record<GoogleAddressFieldMode, string> = {
    address: '',
    town: '',
    state: ''
  };

  constructor(
    private fb: UntypedFormBuilder,
    private auth: AuthService,
    private toastr: ToastrService,
    private router: Router,
    public googleAddressService: GoogleAddressService
  ) {
    this.form = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: [{ value: '', disabled: true }],
      phone: [''],
      address: ['', [trimRequired(), trimMaxLength(100)]],
      town: ['', trimRequired()],
      state: ['', trimRequired()],
      country: [{ value: 'Pakistan', disabled: true }],
      postalcode: ['']
    });
  }

  ngOnInit(): void {
    this.auth.seedShopContextFromEnvironment();
    if (!this.auth.isLoggedIn()) {
      void this.router.navigate(['/pages/login'], { queryParams: { returnUrl: '/pages/profile' } });
      return;
    }

    this.patchFromProfile(this.auth.getCustomerProfile());
    this.loading = true;
    this.auth.refreshCustomerProfileForCheckout().subscribe({
      next: (profile) => {
        this.patchFromProfile(profile);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  ngAfterViewInit(): void {
    this.setupFieldAutocomplete('address');
    this.setupFieldAutocomplete('town');
    this.setupFieldAutocomplete('state');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: EventTarget | null): void {
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.closest('.address-autocomplete-wrap')) {
      return;
    }
    this.closeSuggestions();
  }

  onAutocompleteBlur(field: GoogleAddressFieldMode, event?: FocusEvent): void {
    const sourceWrap =
      event?.target instanceof HTMLElement
        ? event.target.closest('.address-autocomplete-wrap')
        : null;

    window.setTimeout(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        const activeWrap = active.closest('.address-autocomplete-wrap');
        if (sourceWrap && activeWrap && activeWrap === sourceWrap) {
          return;
        }
      }
      if (this.activeAutocompleteField === field) {
        this.closeSuggestions();
      }
      if (field === 'town') {
        this.enforceTownSelected();
      }
    }, 0);
  }

  handleKeyDown(event: KeyboardEvent, field: GoogleAddressFieldMode): void {
    this.activeAutocompleteField = field;
    const suggestions = this.googleAddressService.suggestions$.getValue() || [];
    if (suggestions.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      this.highlightedIndex = (this.highlightedIndex + 1) % suggestions.length;
      event.preventDefault();
    } else if (event.key === 'ArrowUp') {
      this.highlightedIndex = (this.highlightedIndex - 1 + suggestions.length) % suggestions.length;
      event.preventDefault();
    } else if (event.key === 'Enter' && this.highlightedIndex >= 0) {
      this.onPlaceSelected(suggestions[this.highlightedIndex], field);
      this.highlightedIndex = -1;
      event.preventDefault();
    }
  }

  onPlaceSelected(
    prediction: google.maps.places.AutocompletePrediction,
    field: GoogleAddressFieldMode
  ): void {
    this.placeSelectionInFlight = true;
    this.googleAddressService.selectAddress2(prediction, (place) => {
      const current = this.form.getRawValue();
      const parsed = parseGooglePlaceAddress(place, field, {
        address: current.address,
        town: current.town,
        state: current.state,
        postalcode: field === 'state' ? current.postalcode : ''
      }, prediction.description);

      this.lastSelectedValues.address = parsed.address;
      this.lastSelectedValues.town = parsed.town;
      this.lastSelectedValues.state = parsed.state;

      this.form.patchValue({
        address: parsed.address,
        town: parsed.town,
        state: parsed.state,
        postalcode: parsed.postalcode
      }, { emitEvent: false });

      this.activeAutocompleteField = null;
      this.highlightedIndex = -1;
      this.placeSelectionInFlight = false;
    });
  }

  touchedInvalid(name: string): boolean {
    const control = this.form.get(name);
    return !!control && control.touched && control.invalid;
  }

  hasError(name: string, error: string): boolean {
    return !!this.form.get(name)?.hasError(error);
  }

  submit(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    this.saving = true;
    this.auth.updateCustomerProfile({
      firstName: v.firstName,
      lastName: v.lastName,
      phoneNumber: v.phone,
      address: v.address,
      townCity: v.town,
      stateCounty: v.state,
      postalCode: v.postalcode?.trim() || ''
    }).subscribe({
      next: () => {
        this.saving = false;
        this.toastr.success('Your profile has been updated.');
      },
      error: () => {
        this.saving = false;
      }
    });
  }

  private enforceTownSelected(): void {
    if (this.placeSelectionInFlight) {
      return;
    }

    const townCtrl = this.form.get('town');
    const town = (townCtrl?.value ?? '').toString().trim();
    if (!town) {
      return;
    }

    const confirmed = (this.lastSelectedValues.town ?? '').trim();
    if (town.toLowerCase() === confirmed.toLowerCase()) {
      return;
    }

    this.googleAddressService.isAddressSelect = true;
    this.form.patchValue({ town: '', postalcode: '' });
    townCtrl?.markAsTouched();
    this.lastSelectedValues.town = '';
    this.googleAddressService.clearSuggestions();
  }

  private closeSuggestions(): void {
    this.googleAddressService.clearSuggestions();
    this.highlightedIndex = -1;
    this.activeAutocompleteField = null;
  }

  private setupFieldAutocomplete(field: GoogleAddressFieldMode): void {
    this.form.get(field)?.valueChanges
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe((value: string) => {
        if (!this.googleAddressService.isAddressSelect && value !== this.lastSelectedValues[field]) {
          this.activeAutocompleteField = field;
          void this.googleAddressService.getPlacePredictions(value, field);
        }
        this.googleAddressService.isAddressSelect = false;
      });
  }

  private patchFromProfile(profile: ShopCustomerProfile | null): void {
    const email = profile?.customerEmail || this.auth.getCustomerEmail() || '';
    const { firstName, lastName } = this.splitName(profile?.customerName);
    const address = profile?.address || '';
    const town = profile?.town || '';
    const state = profile?.state || '';
    const postalcode = profile?.postalcode || '';

    this.googleAddressService.isAddressSelect = true;
    this.form.patchValue({
      firstName,
      lastName,
      email,
      phone: profile?.customerMobileNo || '',
      address,
      town,
      state,
      postalcode
    }, { emitEvent: false });

    // Treat saved profile values as confirmed so blur won't clear an existing town.
    this.lastSelectedValues.address = address.trim();
    this.lastSelectedValues.town = town.trim();
    this.lastSelectedValues.state = state.trim();
    this.googleAddressService.isAddressSelect = false;
  }

  private splitName(fullName: string | undefined): { firstName: string; lastName: string } {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return { firstName: '', lastName: '' };
    }
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    }
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' ')
    };
  }
}
