import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  HostListener,
  ElementRef
} from '@angular/core';
import { AbstractControl, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../../shared/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { trimMaxLength, trimRequired } from '../../../shop/checkout/checkout-validators';
import { GoogleAddressService } from '../../../shared/services/address-autocomplete/google-address.service';
import {
  GoogleAddressFieldMode,
  parseGooglePlaceAddress
} from '../../../shared/services/address-autocomplete/google-address.util';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit, AfterViewInit, OnDestroy {

  registerForm: UntypedFormGroup;
  loading = false;
  highlightedIndex = -1;
  activeAutocompleteField: GoogleAddressFieldMode | null = null;
  private readonly destroy$ = new Subject<void>();
  private readonly lastSelectedValues: Record<GoogleAddressFieldMode, string> = {
    address: '',
    town: '',
    state: ''
  };

  constructor(
    private fb: UntypedFormBuilder,
    private auth: AuthService,
    private router: Router,
    private toastr: ToastrService,
    public googleAddressService: GoogleAddressService,
    private elementRef: ElementRef
  ) {
    this.registerForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      address: ['', [trimRequired(), trimMaxLength(100)]],
      town: ['', trimRequired()],
      state: ['', trimRequired()],
      postalcode: ['', trimRequired()],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.auth.seedShopContextFromEnvironment();
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

  onAutocompleteBlur(field: GoogleAddressFieldMode): void {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.closest('.address-autocomplete-wrap')) {
        return;
      }
      if (this.activeAutocompleteField === field) {
        this.closeSuggestions();
      }
    }, 0);
  }

  private closeSuggestions(): void {
    this.googleAddressService.clearSuggestions();
    this.highlightedIndex = -1;
    this.activeAutocompleteField = null;
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
    this.googleAddressService.selectAddress2(prediction, (place) => {
      const current = this.registerForm.value;
      const parsed = parseGooglePlaceAddress(place, field, {
        address: current.address,
        town: current.town,
        state: current.state,
        postalcode: current.postalcode
      }, prediction.description);

      this.lastSelectedValues.address = parsed.address;
      this.lastSelectedValues.town = parsed.town;
      this.lastSelectedValues.state = parsed.state;

      this.registerForm.patchValue({
        address: parsed.address,
        town: parsed.town,
        state: parsed.state,
        postalcode: parsed.postalcode
      }, { emitEvent: false });

      this.activeAutocompleteField = null;
      this.highlightedIndex = -1;
    });
  }

  private setupFieldAutocomplete(field: GoogleAddressFieldMode): void {
    this.registerForm.get(field)?.valueChanges
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe((value: string) => {
        if (!this.googleAddressService.isAddressSelect && value !== this.lastSelectedValues[field]) {
          this.activeAutocompleteField = field;
          void this.googleAddressService.getPlacePredictions(value, field);
        }
        this.googleAddressService.isAddressSelect = false;
      });
  }

  passwordMatchValidator(group: AbstractControl): { mismatch: boolean } | null {
    const pass = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass === confirm ? null : { mismatch: true };
  }

  submit(): void {
    if (this.registerForm.invalid || this.loading) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const v = this.registerForm.value;
    const email = String(v.email).trim();
    this.loading = true;

    this.auth.signup({
      userName: email,
      name: v.firstName.trim(),
      surname: v.lastName.trim(),
      emailAddress: email,
      phoneNumber: v.phone?.trim() || '',
      password: v.password,
      storeId: this.auth.storeId,
      tenantId: this.auth.tenantId,
      address: v.address?.trim() || '',
      townCity: v.town?.trim() || '',
      stateCounty: v.state?.trim() || '',
      postalCode: v.postalcode?.trim() || ''
    }).subscribe({
      next: (msg) => {
        this.loading = false;
        this.auth.saveCustomerProfile({
          customerName: `${v.firstName.trim()} ${v.lastName.trim()}`.trim(),
          customerEmail: email,
          customerMobileNo: v.phone?.trim() || undefined,
          address: v.address?.trim() || undefined,
          town: v.town?.trim() || undefined,
          state: v.state?.trim() || undefined,
          postalcode: v.postalcode?.trim() || undefined
        });
        this.toastr.success(msg);
        this.router.navigate(['/pages/login']);
      },
      error: () => {
        this.loading = false;
      }
    });
  }

}
