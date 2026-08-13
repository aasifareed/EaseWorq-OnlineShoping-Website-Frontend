import { Component, OnDestroy, OnInit, AfterViewInit, HostListener, ElementRef } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { trimRequired, trimPersonName, trimPhoneNumber, trimMaxLength, mustMatchSelectedValue } from './checkout-validators';
import { Router } from '@angular/router';
import { Observable, of, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, takeUntil, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Product } from '../../shared/classes/product';
import { ProductService } from '../../shared/services/product.service';
import { CreatePayFastCheckoutRequest, PayFastPaymentService } from './pay-fast-payment.service';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../shared/services/auth.service';
import { extractAbpErrorMessage } from '../../shared/utils/abp-http.util';
import Swal from 'sweetalert2';
import {
  OnlineShopOrderService,
  OnlineShopPaymentMethod,
  OnlineShopShippingMethod,
  CheckoutOrderSelection,
  ONLINE_SHOP_PAYMENT_METHOD_LABELS,
  ONLINE_SHOP_SHIPPING_METHOD_LABELS,
  CheckoutFormValues,
  CreateOnlineShopSaleOrderResponse,
  CheckoutAddressFormValues
} from '../../shared/services/online-shop-order.service';
import {
  CourierShippingOptionResult,
  OnlineShopAppliedDiscount,
  OnlineShopCheckoutService,
  OnlineShopCouponStatus,
  OnlineShopPricingResult
} from '../../shared/services/online-shop-checkout.service';
import { OnlineShopSettingsService } from '../../shared/services/online-shop-settings.service';
import { CouponType, DiscountScope } from '../../shared/models/online-shop-discount.enum';
import { OnlineShopStorefront } from '../../shared/models/online-shop-storefront.model';
import { describeWeight } from '../../shared/utils/weight-format.util';
import { GoogleAddressService } from '../../shared/services/address-autocomplete/google-address.service';
import {
  GoogleAddressFieldMode,
  parseGooglePlaceAddress
} from '../../shared/services/address-autocomplete/google-address.util';
import { OnlineShopWorkingAreaService } from '../../shared/services/online-shop-working-area.service';

type CheckoutAddressGroup = 'billing' | 'shipping';
type CheckoutAutocompleteKey = `${CheckoutAddressGroup}.${GoogleAddressFieldMode}`;

interface StoredCheckoutShippingAddress extends CheckoutAddressFormValues {
  confirmedAddress?: string;
  confirmedTown?: string;
  confirmedState?: string;
}

const CHECKOUT_SHIPPING_STORAGE_KEY = 'onlineShopCheckoutShippingAddress';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements OnInit, OnDestroy, AfterViewInit {

  /** Default storefront country until a country selector is added. */
  private readonly defaultCountryCode = 'PK';

  private readonly destroy$ = new Subject<void>();
  private readonly pricingRequested$ = new Subject<void>();
  private pricingRequestId = 0;
  private lastSelectedValues: Record<CheckoutAddressGroup, Record<GoogleAddressFieldMode, string>> = {
    billing: { address: '', town: '', state: '' },
    shipping: { address: '', town: '', state: '' }
  };

  activeAutocompleteKey: CheckoutAutocompleteKey | null = null;
  highlightedIndex = -1;
  itemsExpanded = false;
  isBillingCardView = false;
  isShippingCardView = false;
  readonly checkoutVisibleItemCount = 4;
  /** True while a Google place selection is resolving, so blur won't clear a city mid-pick. */
  private placeSelectionInFlight = false;

  public checkoutForm: UntypedFormGroup;
  public products: Product[] = [];
  public loading = false;
  public shippingLoading = false;
  public placeOrderError = '';

  /** The server's pricing for the current cart, coupon, address and courier selection. */
  public pricing: OnlineShopPricingResult | null = null;

  /**
   * Courier options from the most recent quote that asked for shipping. Cached so the list stays on
   * screen after the customer picks "help me arrange delivery", which prices without a courier.
   */
  private cachedCourierOptions: CourierShippingOptionResult[] = [];

  public selectedCourierOptionKey: string | null = null;
  private courierSelectionSkipped = false;
  public appliedCouponCodes: string[] = [];
  public couponCodeInput = '';
  public couponApplying = false;
  /** The code the customer just entered, awaiting the server's verdict in the next quote. */
  private pendingCouponCode: string | null = null;
  public storefront: OnlineShopStorefront | null = null;

  public paymentMethod: OnlineShopPaymentMethod = OnlineShopPaymentMethod.GoPayFast;
  public shippingMethod: OnlineShopShippingMethod = OnlineShopShippingMethod.Shipping;
  /** When false, only top recommended courier options are shown. */
  public showAllCourierOptions = false;
  readonly courierPreviewLimit = 4;

  readonly OnlineShopPaymentMethod = OnlineShopPaymentMethod;
  readonly OnlineShopShippingMethod = OnlineShopShippingMethod;
  readonly paymentMethodOptions = [
    OnlineShopPaymentMethod.CashOnDelivery,
    OnlineShopPaymentMethod.GoPayFast
  ];
  readonly shippingMethodOptions = [
    OnlineShopShippingMethod.Shipping,
    OnlineShopShippingMethod.LocalPickup
  ];
  /** Turn on to offer local pickup again; the working-area gating below then applies. */
  private readonly localPickupEnabled = false;
  /** Local pickup is offered only when the billing address falls inside the store working area. */
  public localPickupAvailable = true;
  private billingCoordinates: { latitude: number; longitude: number } | null = null;
  /** Billing address the cached coordinates belong to, so edits force a fresh lookup. */
  private billingCoordinatesKey = '';
  private workingAreaRequestId = 0;
  readonly paymentMethodLabels = ONLINE_SHOP_PAYMENT_METHOD_LABELS;
  readonly shippingMethodLabels = ONLINE_SHOP_SHIPPING_METHOD_LABELS;

  constructor(
    private fb: UntypedFormBuilder,
    public productService: ProductService,
    private onlineShopOrder: OnlineShopOrderService,
    private auth: AuthService,
        private payFast: PayFastPaymentService,
    private router: Router,
  private toastr: ToastrService,
    private translate: TranslateService,
    private onlineShopCheckout: OnlineShopCheckoutService,
    private onlineShopSettings: OnlineShopSettingsService,
    public googleAddressService: GoogleAddressService,
    private workingArea: OnlineShopWorkingAreaService,
    private elementRef: ElementRef,
  ) {
    this.checkoutForm = this.fb.group({
      billing: this.createBillingAddressGroup(),
      shipping: this.createShippingAddressGroup(),
      shipToDifferentAddress: [false],
      description: ['']
    });
    this.setShippingValidators(false);
  }

  ngOnInit(): void {
    // Fresh settings (not header menu) — includes collectShippingChargesOnCod.
    this.onlineShopSettings.loadStorefront(true).subscribe((s) => {
      this.storefront = s;
      this.applyPaymentMethodDefaults();
    });

    // One debounced pipeline, so a burst of form and cart events costs a single pricing call.
    this.pricingRequested$
      .pipe(
        tap(() => {
          if (this.shouldQuoteShipping()) {
            this.shippingLoading = true;
          }
        }),
        debounceTime(250),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.requestPricing());

    this.productService.cartItems
      .pipe(takeUntil(this.destroy$))
      .subscribe(response => {
        this.products = response;
        this.pricingRequested$.next();
      });

    this.productService.appliedCouponCodes$
      .pipe(takeUntil(this.destroy$))
      .subscribe((codes) => {
        this.appliedCouponCodes = codes;
        // Delivery tiers match on the post-discount goods total, so re-price on coupon changes.
        this.pricingRequested$.next();
      });

    this.checkoutForm.get('shipToDifferentAddress')?.valueChanges.subscribe((checked: boolean) => {
      this.setShippingValidators(!!checked);
      if (!checked) {
        this.shippingGroup.reset();
        this.isShippingCardView = false;
        this.clearShippingLocalStorage();
        this.resetShippingAutocompleteState();
      } else {
        this.isShippingCardView = false;
        this.loadShippingFromLocalStorage();
      }
      this.pricingRequested$.next();
    });

    this.billingGroup.valueChanges
      .pipe(
        map(() => this.billingAddressText()),
        debounceTime(600),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.refreshLocalPickupAvailability());

    this.prefillCheckoutCustomerDetails();
  }

  ngAfterViewInit(): void {
    this.setupAddressAutocomplete('billing', this.billingGroup);
    this.setupAddressAutocomplete('shipping', this.shippingGroup);
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

  onAutocompleteBlur(group: CheckoutAddressGroup, field: GoogleAddressFieldMode, event?: FocusEvent): void {
    const key = `${group}.${field}`;
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
      if (this.activeAutocompleteKey === key) {
        this.closeSuggestions();
      }
      // City must be picked from a Google suggestion; if it was typed manually and not
      // confirmed, clear it (and its postal code, which belongs to that city).
      if (field === 'town') {
        this.enforceTownSelected(group);
      }
      if (field === 'state') {
        this.enforceStateSelected(group);
      }
    }, 0);
  }

  private enforceTownSelected(group: CheckoutAddressGroup): void {
    if (this.placeSelectionInFlight) {
      return;
    }

    const formGroup = group === 'billing' ? this.billingGroup : this.shippingGroup;
    const townCtrl = formGroup.get('town');
    const town = (townCtrl?.value ?? '').toString().trim();
    if (!town) {
      return;
    }

    const confirmed = (this.lastSelectedValues[group].town ?? '').trim();
    if (town.toLowerCase() === confirmed.toLowerCase()) {
      return;
    }

    this.googleAddressService.isAddressSelect = true;
    formGroup.patchValue({ town: '', postalcode: '' });
    townCtrl?.markAsTouched();
    townCtrl?.updateValueAndValidity();
    this.lastSelectedValues[group].town = '';
    this.googleAddressService.clearSuggestions();
  }

  private enforceStateSelected(group: CheckoutAddressGroup): void {
    if (this.placeSelectionInFlight) {
      return;
    }

    const formGroup = group === 'billing' ? this.billingGroup : this.shippingGroup;
    const stateCtrl = formGroup.get('state');
    const state = (stateCtrl?.value ?? '').toString().trim();
    if (!state) {
      return;
    }

    const confirmed = (this.lastSelectedValues[group].state ?? '').trim();
    if (state.toLowerCase() === confirmed.toLowerCase()) {
      return;
    }

    this.googleAddressService.isAddressSelect = true;
    formGroup.patchValue({ state: '' });
    stateCtrl?.markAsTouched();
    stateCtrl?.updateValueAndValidity();
    this.lastSelectedValues[group].state = '';
    this.googleAddressService.clearSuggestions();
  }

  private closeSuggestions(): void {
    this.googleAddressService.clearSuggestions();
    this.highlightedIndex = -1;
    this.activeAutocompleteKey = null;
  }

  isAutocompleteActive(group: CheckoutAddressGroup, field: GoogleAddressFieldMode): boolean {
    return this.activeAutocompleteKey === `${group}.${field}`;
  }

  handleKeyDown(
    event: KeyboardEvent,
    group: CheckoutAddressGroup,
    field: GoogleAddressFieldMode
  ): void {
    this.activeAutocompleteKey = `${group}.${field}`;
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
      this.onPlaceSelected(suggestions[this.highlightedIndex], group, field);
      this.highlightedIndex = -1;
      event.preventDefault();
    }
  }

  onPlaceSelected(
    prediction: google.maps.places.AutocompletePrediction,
    group: CheckoutAddressGroup,
    field: GoogleAddressFieldMode
  ): void {
    this.placeSelectionInFlight = true;
    this.googleAddressService.selectAddress2(prediction, (place) => {
      const formGroup = group === 'billing' ? this.billingGroup : this.shippingGroup;
      const current = formGroup.value as CheckoutAddressFormValues;
      const parsed = parseGooglePlaceAddress(place, field, {
        address: current.address,
        town: current.town,
        state: current.state,
        // When the city/address changes, the postal code must reflect the new selection.
        // Don't carry over the previous city's postal code; only keep it for state changes.
        postalcode: field === 'state' ? current.postalcode : ''
      }, prediction.description);

      this.lastSelectedValues[group].address = parsed.address;
      this.lastSelectedValues[group].town = parsed.town;
      this.lastSelectedValues[group].state = parsed.state;

      formGroup.patchValue({
        address: parsed.address,
        town: parsed.town,
        state: parsed.state,
        postalcode: parsed.postalcode
      });

      formGroup.get('town')?.updateValueAndValidity();
      formGroup.get('state')?.updateValueAndValidity();

      if (group === 'billing') {
        // Only a street-level pick is precise enough to test against the working area;
        // a town/state pick would resolve to the city centre, so re-geocode the full address.
        const location = field === 'address' ? place.geometry?.location : null;
        this.billingCoordinates = location
          ? { latitude: location.lat(), longitude: location.lng() }
          : null;
        this.billingCoordinatesKey = location ? this.billingAddressText() : '';
        this.refreshLocalPickupAvailability();
      }

      this.activeAutocompleteKey = null;
      this.highlightedIndex = -1;
      this.placeSelectionInFlight = false;
    });
  }

  /**
   * Local pickup depends on the customer's full billing address (street + city + state + postal
   * code) sitting inside the store working area polygon.
   */
  private refreshLocalPickupAvailability(): void {
    if (!this.localPickupEnabled) {
      return;
    }

    const requestId = ++this.workingAreaRequestId;

    void this.resolveBillingCoordinates().then((coordinates) => {
      if (requestId !== this.workingAreaRequestId) {
        return;
      }

      if (!coordinates) {
        this.applyLocalPickupAvailability(true);
        return;
      }

      this.workingArea
        .isPointInsideWorkingArea(coordinates.latitude, coordinates.longitude)
        .subscribe((result) => {
          if (requestId !== this.workingAreaRequestId) {
            return;
          }
          // No polygon drawn yet means the store has not restricted pickup at all.
          this.applyLocalPickupAvailability(!result.hasWorkingArea || result.isInside);
        });
    });
  }

  private applyLocalPickupAvailability(available: boolean): void {
    this.localPickupAvailable = available;
    if (!available && this.shippingMethod === OnlineShopShippingMethod.LocalPickup) {
      this.onShippingMethodChange(OnlineShopShippingMethod.Shipping);
    }
  }

  private async resolveBillingCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
    const text = this.billingAddressText();
    if (!text) {
      return null;
    }

    if (this.billingCoordinates && this.billingCoordinatesKey === text) {
      return this.billingCoordinates;
    }

    this.billingCoordinates = await this.googleAddressService.geocodeAddressText(text);
    this.billingCoordinatesKey = text;
    return this.billingCoordinates;
  }

  private billingAddressText(): string {
    const billing = this.billingGroup.getRawValue() as CheckoutAddressFormValues;
    return [billing.address, billing.town, billing.state, billing.postalcode]
      .map((part) => String(part ?? '').trim())
      .filter((part) => !!part)
      .join(', ');
  }

  get availableShippingMethods(): OnlineShopShippingMethod[] {
    return this.shippingMethodOptions.filter(
      (method) =>
        method !== OnlineShopShippingMethod.LocalPickup ||
        (this.localPickupEnabled && this.localPickupAvailable)
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  courierOptionKey(option: CourierShippingOptionResult): string {
    return `${option.courierCompany}|${option.courierServiceType}`;
  }

  onCourierOptionSelected(key: string): void {
    if (this.selectedCourierOptionKey === key) {
      return;
    }

    this.courierSelectionSkipped = false;
    this.selectedCourierOptionKey = key;
    const option = this.selectedCourierOption;
    if (option && this.pricing) {
      this.applyCourierOptionToPricing(option);
      return;
    }
    this.pricingRequested$.next();
  }

  /** Customer found no courier that serves them; the store arranges delivery manually. */
  skipCourierSelection(): void {
    this.courierSelectionSkipped = true;
    this.selectedCourierOptionKey = null;
    if (this.pricing) {
      this.applyCourierOptionToPricing(null);
      return;
    }
    this.pricingRequested$.next();
  }

  /**
   * Courier options already include list price, discount and payable shipping from the last quote.
   * Switching between them only swaps those server figures into the summary — no extra API call.
   */
  private applyCourierOptionToPricing(option: CourierShippingOptionResult | null): void {
    const pricing = this.pricing;
    if (!pricing) {
      return;
    }

    const originalShipping = option?.cargoOriginalAmount ?? 0;
    const shippingDiscount = option?.shippingDiscountAmount ?? 0;
    const finalShipping = option?.finalShippingAmount ?? 0;
    const nonShippingDiscount = pricing.totalDiscount - pricing.shippingDiscountTotal;

    this.pricing = {
      ...pricing,
      originalShippingAmount: originalShipping,
      shippingDiscountTotal: shippingDiscount,
      finalShippingAmount: finalShipping,
      totalDiscount: nonShippingDiscount + shippingDiscount,
      finalTotal: pricing.netMerchandiseAmount + pricing.taxAmount + finalShipping,
      courierCompany: option?.courierCompany ?? null,
      courierServiceType: option?.courierServiceType ?? null,
      pickupLocationId: option?.pickupLocationId ?? pricing.pickupLocationId ?? null,
      appliedDiscounts: (pricing.appliedDiscounts ?? []).map((row) =>
        row.scope === 'shipping'
          ? {
              ...row,
              originalAmount: originalShipping,
              discountAmount: shippingDiscount,
              finalAmount: finalShipping,
            }
          : row
      ),
    };
  }

  get isCourierSelectionSkipped(): boolean {
    return this.courierSelectionSkipped && this.shippingCourierOptions.length > 0;
  }

  /**
   * Online payment needs a known payable total. Help Me Arrange Delivery leaves shipping
   * unconfirmed, so PayFast stays unavailable until a courier is chosen (including FREE).
   */
  get isOnlinePaymentAllowed(): boolean {
    if (this.shippingMethod !== OnlineShopShippingMethod.Shipping) {
      return true;
    }
    return !this.isCourierSelectionSkipped && !!this.selectedCourierOption;
  }

  /**
   * What the customer pays for delivery, straight from the server. Zero while no courier is chosen,
   * because the store confirms that charge separately after the order is placed.
   */
  get effectiveShippingAmount(): number {
    return this.pricing?.finalShippingAmount ?? 0;
  }

  toggleItemsExpanded(): void {
    this.itemsExpanded = !this.itemsExpanded;
  }

  get displayedProducts(): Product[] {
    if (this.itemsExpanded || this.products.length <= this.checkoutVisibleItemCount) {
      return this.products;
    }
    return this.products.slice(0, this.checkoutVisibleItemCount);
  }

  get hiddenItemCount(): number {
    return Math.max(0, this.products.length - this.checkoutVisibleItemCount);
  }

  get orderNoteLength(): number {
    return String(this.checkoutForm.get('description')?.value ?? '').length;
  }

  productImage(product: Product): string {
    return product?.pictureUrl || product?.images?.[0]?.src || 'assets/images/product/placeholder.svg';
  }

  /** Customer-facing variant only — hide internal defaults like 0 / empty. */
  productVariantLabel(product: Product): string {
    const parts: string[] = [];
    const color = String(product?.color ?? '').trim();
    if (color && color !== '0' && color.toLowerCase() !== 'n/a' && color !== '-') {
      parts.push(color);
    }
    const sizeRaw = product?.productSize;
    if (sizeRaw != null && String(sizeRaw).trim() !== '') {
      const size = String(sizeRaw).trim();
      if (size !== '0' && size.toLowerCase() !== 'n/a' && size !== '-') {
        parts.push(size);
      }
    }
    return parts.join(' / ');
  }

  get showVariantColumn(): boolean {
    return this.products.some((p) => !!this.productVariantLabel(p));
  }

  get placeOrderButtonLabel(): string {
    if (this.loading) {
      return 'Processing...';
    }
    if (this.codCollectsShippingOnline) {
      return 'Pay Shipping & Place Order';
    }
    if (this.paymentMethod === OnlineShopPaymentMethod.GoPayFast) {
      return 'Continue to PayFast';
    }
    return 'Place Order';
  }

  get primaryAddressSectionTitle(): string {
    return this.shipToDifferentAddress ? 'Billing Details' : 'Delivery Details';
  }

  get primaryAddressSectionSubtitle(): string {
    return this.shipToDifferentAddress
      ? 'Enter your billing information'
      : 'Where should we deliver your order?';
  }

  get primaryAddressCardLabel(): string {
    return this.shipToDifferentAddress ? 'Billing Address' : 'Delivery Address';
  }

  get primaryAddressFormTitle(): string {
    return this.shipToDifferentAddress ? 'Billing Details' : 'Delivery Details';
  }

  get localPickupLines(): string[] {
    const lines: string[] = [];
    const name = this.storefront?.storeName?.trim();
    const address = this.storefront?.storeAddress?.trim();
    const phone = this.storefront?.phoneNumber?.trim() || this.storefront?.whatsAppNumber?.trim();
    if (name) {
      lines.push(name);
    }
    if (address) {
      lines.push(address);
    }
    if (phone) {
      lines.push(phone);
    }
    return lines;
  }

  get deliveryEstimateHint(): string | null {
    if (this.shippingMethod !== OnlineShopShippingMethod.Shipping) {
      return null;
    }
    const selected = this.selectedCourierOption;
    if (selected?.courierServiceType) {
      return this.serviceTypeLabel(selected.courierServiceType);
    }
    const days = this.storefront?.estimatedDeliveryDays;
    if (days != null && Number(days) > 0) {
      const n = Number(days);
      return n === 1 ? 'Estimated delivery: within 1 day' : `Estimated delivery: within ${n} days`;
    }
    return null;
  }

  isCourierOptionSelected(option: CourierShippingOptionResult): boolean {
    return this.selectedCourierOptionKey === this.courierOptionKey(option);
  }

  serviceTypeLabel(serviceType: string): string {
    const key = (serviceType ?? '').trim().toLowerCase();
    const labels: Record<string, string> = {
      overnight: 'Next-day delivery',
      overland: 'Economy · 2–4 days',
      detain: 'Standard delivery'
    };
    return labels[key] ?? serviceType;
  }

  serviceTypeEta(serviceType: string): string {
    const key = (serviceType ?? '').trim().toLowerCase();
    const labels: Record<string, string> = {
      overnight: 'By tomorrow',
      overland: 'In 2–4 days',
      detain: 'In 2–3 days'
    };
    return labels[key] ?? this.serviceTypeLabel(serviceType);
  }

  courierMonogram(company: string): string {
    const parts = (company ?? '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return '?';
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 3).toUpperCase();
    }
    return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  courierDiscountPercent(option: CourierShippingOptionResult): number | null {
    if (!this.courierOptionHasDiscount(option) || !(option.cargoOriginalAmount > 0)) {
      return null;
    }
    const pct = Math.round((option.shippingDiscountAmount / option.cargoOriginalAmount) * 100);
    return pct > 0 ? pct : null;
  }

  courierAccentClass(company: string): string {
    const raw = (company ?? '').trim().toLowerCase();
    const known = ['leopard', 'tcs', 'trax', 'mnp', 'daewoo', 'daak', 'tranzo', 'dastaq', 'alfa', 'dex', 'dlx'];
    const match = known.find((name) => raw.includes(name));
    return `checkout-delivery-row--${match || 'default'}`;
  }

  /**
   * What the cart weighs, as the server computed it, shown alongside the rates so a customer can see
   * why a parcel is priced the way it is. Grams under a kilogram, because an accessory order is a
   * couple of hundred grams. Null when nothing in the cart carries a catalogue weight, since the
   * courier's minimum billable weight would then describe the courier's pricing, not this parcel.
   */
  get quotedWeight(): string | null {
    const pricing = this.pricing;
    if (!pricing || pricing.totalWeightKg <= 0) {
      return null;
    }

    const goods = describeWeight(pricing.totalWeightKg);

    // Light parcels are charged at the courier's minimum. Saying so is what makes the shipping price
    // make sense to someone who just read that their order weighs 180 g.
    if (pricing.billableWeightKg > pricing.totalWeightKg) {
      return `${goods} (billed ${describeWeight(pricing.billableWeightKg)})`;
    }

    return goods;
  }

  get shippingDestinationCity(): string {
    const address = this.resolveShippingAddressForRate();
    return address?.town?.trim() || 'your city';
  }

  get selectedCourierOption(): CourierShippingOptionResult | null {
    if (!this.selectedCourierOptionKey) {
      return null;
    }
    return (
      this.shippingCourierOptions.find(
        (o) => this.courierOptionKey(o) === this.selectedCourierOptionKey
      ) ?? null
    );
  }

  onShippingMethodChange(method: OnlineShopShippingMethod): void {
    this.shippingMethod = method;
    this.showAllCourierOptions = false;
    if (method === OnlineShopShippingMethod.LocalPickup) {
      this.resetCourierSelection();
    }
    this.pricingRequested$.next();
  }

  /** Merchandise at catalogue list price, before any discount. */
  get cartSubtotal(): number {
    return this.pricing?.originalProductSubtotal ?? 0;
  }

  /** Every code the shopper is holding, with the server's verdict on each. */
  get couponStatuses(): OnlineShopCouponStatus[] {
    return this.pricing?.coupons ?? [];
  }

  private get appliedCoupons(): OnlineShopCouponStatus[] {
    return this.couponStatuses.filter((x) => x.isValid);
  }

  get couponDiscount(): number {
    return this.appliedCoupons.reduce((sum, coupon) => sum + coupon.discountAmount, 0);
  }

  /** True when a coupon covers only some cart lines, which explains a smaller discount. */
  isCouponPartiallyEligible(coupon: OnlineShopCouponStatus): boolean {
    return coupon.isValid
      && coupon.discountAmount > 0
      && coupon.eligibleSubtotal > 0
      && coupon.eligibleSubtotal < (this.pricing?.subtotalAfterProductDiscounts ?? 0) - 0.005;
  }

  /**
   * Applies a code from this page, for the customer who came straight here from Buy Now and never
   * saw the cart. Holding the code re-quotes the order, and the server's verdict on it is reported
   * once that quote comes back.
   */
  applyCoupon(): void {
    if (this.couponApplying) {
      return;
    }

    const code = this.couponCodeInput.trim().toUpperCase();
    if (!code) {
      this.toastr.warning('Enter a coupon code.');
      return;
    }

    if (this.appliedCouponCodes.includes(code)) {
      this.toastr.info('That code is already applied.');
      this.couponCodeInput = '';
      return;
    }

    this.couponApplying = true;
    this.pendingCouponCode = code;
    this.couponCodeInput = '';
    this.productService.setAppliedCouponCodes([...this.appliedCouponCodes, code]);
  }

  removeCoupon(code: string | null | undefined): void {
    if (!code) {
      return;
    }
    this.productService.removeAppliedCouponCode(code);
  }

  /**
   * Reports what the server made of a freshly entered code, and takes a refused one back off the
   * order — left applied it would only block Place Order.
   */
  private settlePendingCoupon(result: OnlineShopPricingResult): void {
    const code = this.pendingCouponCode;
    if (!code) {
      return;
    }

    this.pendingCouponCode = null;
    this.couponApplying = false;

    const status = result.coupons.find((x) => x.couponCode === code);
    if (!status?.isAdmitted) {
      this.productService.removeAppliedCouponCode(code);
      this.toastr.error(status?.message || 'Invalid coupon.');
      return;
    }

    // Admitted but beaten to its scope: kept, since removing another code can let it win.
    if (status.isValid) {
      this.toastr.success(status.message || 'Coupon applied.');
    } else {
      this.toastr.info(status.message || 'A better offer is already applied to this order.');
    }
  }

  get orderTotal(): number {
    return this.pricing?.finalTotal ?? 0;
  }

  /**
   * Every merchandise discount the server granted, each with its own label, in the order the engine
   * ranked them. Shipping promotions are excluded: they belong to the delivery section below.
   */
  get merchandiseDiscountRows(): OnlineShopAppliedDiscount[] {
    return (this.pricing?.appliedDiscounts ?? [])
      .filter((d) => d.scope !== 'shipping' && d.discountAmount > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  get showShippingBreakdown(): boolean {
    return (
      this.shippingMethod === OnlineShopShippingMethod.Shipping &&
      !!this.pricing &&
      !this.shippingLoading
    );
  }

  /** True when shipping is waived (coupon/rule) and a courier is still chosen. */
  get isShippingFree(): boolean {
    if (this.isCourierSelectionSkipped || !this.showShippingBreakdown || !this.selectedCourierOption) {
      return false;
    }
    return this.effectiveShippingAmount === 0;
  }

  get isFreeShippingCouponApplied(): boolean {
    return this.appliedCoupons.some((coupon) => {
      const type = String(coupon.couponType ?? '').trim().toLowerCase();
      // The compact spelling is tolerated because older orders were stored without the underscore.
      return type === CouponType.FreeShipping || type === 'freeshipping';
    });
  }

  /** Show coupon confirmation under FREE shipping when a free-shipping coupon is in play. */
  get showFreeShippingCouponHint(): boolean {
    if (!this.isShippingFree || !this.appliedCouponCodes.length) {
      return false;
    }
    return this.isFreeShippingCouponApplied || this.couponDiscount === 0;
  }

  /** The code to name beside a waived delivery charge: the shipping one if there is one. */
  get freeShippingCouponCode(): string | null {
    const shippingCoupon = this.appliedCoupons.find(
      (coupon) => (coupon.scope ?? '') === DiscountScope.Shipping
    );
    return shippingCoupon?.couponCode ?? this.appliedCouponCodes[0] ?? null;
  }

  /** Courier rate for the selected option before any delivery promotion is applied. */
  get shippingListPrice(): number {
    return this.pricing?.originalShippingAmount ?? 0;
  }

  get deliveryDiscountAmount(): number {
    return this.pricing?.shippingDiscountTotal ?? 0;
  }

  /** Itemise the promotion only when shipping is still payable; free delivery shows FREE instead. */
  get showDeliveryDiscountRow(): boolean {
    return this.showShippingBreakdown && !this.isShippingFree && this.deliveryDiscountAmount > 0;
  }

  /** Shows the pre-promotion rate whenever the saving is itemised on its own line. */
  get shippingSummaryAmount(): number {
    return this.showDeliveryDiscountRow ? this.shippingListPrice : this.effectiveShippingAmount;
  }

  /** The server's own label for the delivery promotion, e.g. "Delivery Discount (20%)". */
  get deliveryDiscountLabel(): string {
    const shippingRow = (this.pricing?.appliedDiscounts ?? [])
      .find((d) => d.scope === 'shipping' && d.discountAmount > 0);
    return shippingRow?.description || 'Delivery Discount';
  }

  /** Saving to advertise when the promotion covers the whole delivery charge. */
  get freeDeliverySaving(): number {
    return this.isShippingFree ? this.shippingListPrice : 0;
  }

  courierOptionHasDiscount(option: CourierShippingOptionResult): boolean {
    return option.shippingDiscountAmount > 0;
  }

  /** COD with shipping collected online per store payment settings. */
  get codCollectsShippingOnline(): boolean {
    return !!(
      this.storefront?.collectShippingChargesOnCod &&
      this.storefront?.isCashOnDeliveryEnabled &&
      this.storefront?.isGoPayFastEnabled &&
      this.paymentMethod === OnlineShopPaymentMethod.CashOnDelivery &&
      this.shippingMethod === OnlineShopShippingMethod.Shipping &&
      this.effectiveShippingAmount > 0
    );
  }

  /**
   * What is still collected at the door once shipping has been prepaid online: the goods and their
   * tax, both taken from the engine. The courier booking recomputes this from the stored order, so
   * this figure is only ever the notice shown on this page.
   */
  get codRemainingOnDelivery(): number {
    if (!this.pricing) {
      return 0;
    }
    return this.pricing.netMerchandiseAmount + this.pricing.taxAmount;
  }

  get availablePaymentMethods(): OnlineShopPaymentMethod[] {
    const methods: OnlineShopPaymentMethod[] = [];
    if (this.storefront?.isCashOnDeliveryEnabled !== false) {
      methods.push(OnlineShopPaymentMethod.CashOnDelivery);
    }
    if (this.storefront?.isGoPayFastEnabled && this.isOnlinePaymentAllowed) {
      methods.push(OnlineShopPaymentMethod.GoPayFast);
    }
    if (!methods.length && this.isOnlinePaymentAllowed) {
      methods.push(OnlineShopPaymentMethod.GoPayFast);
    }
    return methods;
  }

  /** Do not use checkoutForm.valid — disabled nested groups break it; validate billing + shipping explicitly. */
  get canPlaceOrder(): boolean {
    if (this.loading || !this.products?.length) {
      return false;
    }
    if (this.billingGroup.invalid) {
      return false;
    }
    if (this.shipToDifferentAddress && this.shippingGroup.invalid) {
      return false;
    }
    if (this.shippingMethod === OnlineShopShippingMethod.Shipping) {
      if (this.shippingLoading) {
        return false;
      }
      const address = this.resolveShippingAddressForRate();
      if (!this.isShippingAddressComplete(address)) {
        return false;
      }
      // No quote means no authoritative delivery charge, so the order would be priced without one.
      // Arranging delivery manually is the deliberate way past this.
      if (this.pricing?.shippingQuoteUnavailable && !this.isCourierSelectionSkipped) {
        return false;
      }
    }
    if (!this.pricing) {
      return false;
    }
    if (!this.availablePaymentMethods.length) {
      return false;
    }
    if (
      this.paymentMethod === OnlineShopPaymentMethod.GoPayFast &&
      !this.isOnlinePaymentAllowed
    ) {
      return false;
    }
    return true;
  }

  get shippingCourierOptions(): CourierShippingOptionResult[] {
    const options = [...this.cachedCourierOptions];
    return options.sort((a, b) => {
      if (!!a.isRecommended !== !!b.isRecommended) {
        return a.isRecommended ? -1 : 1;
      }
      return (a.finalShippingAmount ?? 0) - (b.finalShippingAmount ?? 0);
    });
  }

  get visibleCourierOptions(): CourierShippingOptionResult[] {
    const options = this.shippingCourierOptions;
    if (this.showAllCourierOptions || options.length <= this.courierPreviewLimit) {
      return options;
    }

    const preview = options.slice(0, this.courierPreviewLimit);
    const selected = this.selectedCourierOption;
    if (
      selected &&
      !preview.some((o) => this.courierOptionKey(o) === this.courierOptionKey(selected))
    ) {
      preview[preview.length - 1] = selected;
    }
    return preview;
  }

  get hiddenCourierOptionsCount(): number {
    return Math.max(0, this.shippingCourierOptions.length - this.visibleCourierOptions.length);
  }

  toggleCourierOptionsExpanded(): void {
    this.showAllCourierOptions = !this.showAllCourierOptions;
  }

  courierOptionBadge(option: CourierShippingOptionResult): string | null {
    if (option.isRecommended) {
      return 'Best value';
    }

    const options = this.shippingCourierOptions;
    if (!options.length) {
      return null;
    }

    const service = (option.courierServiceType || '').trim().toLowerCase();
    const overnightOptions = options.filter(
      (o) => (o.courierServiceType || '').trim().toLowerCase() === 'overnight'
    );
    if (
      service === 'overnight' &&
      overnightOptions.length &&
      this.courierOptionKey(overnightOptions[0]) === this.courierOptionKey(option)
    ) {
      return 'Fastest';
    }

    const lowest = Math.min(...options.map((o) => Number(o.finalShippingAmount) || 0));
    if ((Number(option.finalShippingAmount) || 0) === lowest) {
      return 'Lowest price';
    }

    return null;
  }

  get billingGroup(): UntypedFormGroup {
    return this.checkoutForm.get('billing') as UntypedFormGroup;
  }

  get shippingGroup(): UntypedFormGroup {
    return this.checkoutForm.get('shipping') as UntypedFormGroup;
  }

  get shipToDifferentAddress(): boolean {
    return !!this.checkoutForm.get('shipToDifferentAddress')?.value;
  }

  get canShowBillingCard(): boolean {
    return this.isBillingAddressComplete(this.billingGroup.getRawValue() as CheckoutAddressFormValues);
  }

  get canShowShippingCard(): boolean {
    return this.isShippingFormComplete(this.shippingGroup.getRawValue() as CheckoutAddressFormValues);
  }

  get billingPreview(): CheckoutAddressFormValues {
    return this.billingGroup.getRawValue() as CheckoutAddressFormValues;
  }

  get shippingPreview(): CheckoutAddressFormValues {
    return this.shippingGroup.getRawValue() as CheckoutAddressFormValues;
  }

  get showAddressCardsRow(): boolean {
    return this.isBillingCardView || (this.shipToDifferentAddress && this.isShippingCardView);
  }

  get addressCardCount(): number {
    let count = 0;
    if (this.isBillingCardView) {
      count += 1;
    }
    if (this.shipToDifferentAddress && this.isShippingCardView) {
      count += 1;
    }
    return count;
  }

  toggleBillingEdit(): void {
    this.isBillingCardView = false;
    // The address is in flux again, so drop the courier quote until it is confirmed.
    this.resetCourierSelection();
    this.pricingRequested$.next();
  }

  continueBillingAddress(): void {
    if (this.billingGroup.invalid) {
      this.billingGroup.markAllAsTouched();
      this.toastr.warning('Please complete all required billing fields.');
      return;
    }

    this.isBillingCardView = true;
    this.persistCustomerProfileFromBilling(this.billingGroup.getRawValue() as CheckoutAddressFormValues);
    this.pricingRequested$.next();
  }

  toggleShippingEdit(): void {
    this.isShippingCardView = false;
    this.resetCourierSelection();
    this.pricingRequested$.next();
  }

  continueShippingAddress(): void {
    if (!this.shipToDifferentAddress) {
      return;
    }

    if (this.shippingGroup.invalid) {
      this.shippingGroup.markAllAsTouched();
      this.toastr.warning('Please complete all required shipping fields.');
      return;
    }

    this.saveShippingToLocalStorage();
    this.isShippingCardView = true;
    this.toastr.success('Shipping address saved.');
    this.pricingRequested$.next();
  }

  placeOrder(): void {
    if (!this.canPlaceOrder) {
      this.checkoutForm.markAllAsTouched();
      return;
    }
    if (!this.products?.length) {
      this.toastr.warning('Your cart is empty.');
      return;
    }

    if (!this.auth.isLoggedIn() || !this.auth.getCustomerEmail()) {
      this.toastr.warning('Please sign in to place an order.');
      this.auth.navigateToLogin('/shop/checkout');
      return;
    }

    if (
      this.paymentMethod === OnlineShopPaymentMethod.GoPayFast &&
      !this.isOnlinePaymentAllowed
    ) {
      this.toastr.warning('Select a delivery option to pay online.');
      return;
    }

    // Only a code the server refused outright blocks the order. One that was simply beaten to its
    // scope is priced at zero and stays out of the way.
    const refused = this.couponStatuses.find((coupon) => !coupon.isAdmitted);
    if (refused) {
      this.toastr.warning(
        refused.message || `Remove ${refused.couponCode} to continue — it cannot be used here.`
      );
      return;
    }

    this.placeOrderError = '';
    this.loading = true;
    const formValue = this.buildCheckoutPayload();
    const selectedCourier = this.selectedCourierOption;
    const skipCourier = this.isCourierSelectionSkipped;
    // Only the courier choice and the total on screen travel with the order; the server prices it
    // again and rejects the request if its own total disagrees with what we were showing.
    const selection: CheckoutOrderSelection = {
      selectedCourierCompany: skipCourier
        ? null
        : selectedCourier?.courierCompany ?? this.pricing?.courierCompany ?? null,
      selectedCourierServiceType: skipCourier
        ? null
        : selectedCourier?.courierServiceType ?? this.pricing?.courierServiceType ?? null,
      clientExpectedTotal: this.pricing?.finalTotal ?? null
    };
    const orderRequest = this.onlineShopOrder.buildCreateOrderRequest(
      formValue,
      this.products,
      this.paymentMethod,
      this.appliedCouponCodes,
      selection
    );

    this.onlineShopOrder.createOrder(orderRequest).subscribe({
      next: (created: CreateOnlineShopSaleOrderResponse) => {
        if (!created?.onlineShopSaleOrderId) {
          this.loading = false;
          this.showPlaceOrderError(created?.message || 'Order could not be created.');
          return;
        }

        this.onlineShopOrder.rememberPendingOrder(created);

        const codShippingPrepay =
          this.paymentMethod === OnlineShopPaymentMethod.CashOnDelivery &&
          this.codCollectsShippingOnline;

        const requiresOnlinePayment =
          this.paymentMethod === OnlineShopPaymentMethod.GoPayFast ||
          !!created.requiresOnlineShippingPayment ||
          (created.amountDueNow != null && created.amountDueNow > 0) ||
          codShippingPrepay;

        if (!requiresOnlinePayment) {
          this.loading = false;
          this.persistCustomerProfileFromBilling(formValue.billing);
          this.clearCartAfterOrder();
          this.router.navigate(['/shop/checkout/success', created.onlineShopSaleOrderId]);
          return;
        }

        const billing = formValue.billing;
        // No amount is sent: the payment gateway session is opened for whatever the order says is
        // due now, so a stale figure on this page can never become the charged amount.
        const payfastPayload: CreatePayFastCheckoutRequest = {
          orderId: created.onlineShopSaleOrderId,
          basketId: created.transactionReference || created.onlineShopSaleOrderId,
          customerName: billing.customerName,
          customerEmail: billing.customerEmail,
          customerMobileNo: billing.customerMobileNo,
          description: created.requiresOnlineShippingPayment
            ? (created.onlineOrderNumber
              ? `Shipping for order ${created.onlineOrderNumber}`
              : 'COD shipping payment')
            : (created.onlineOrderNumber
              ? `Order ${created.onlineOrderNumber}`
              : (formValue.description || 'Online shop order'))
        };

        this.payFast.createCheckout(payfastPayload).subscribe({
      next: (res) => {
        this.loading = false;
            this.persistCustomerProfileFromBilling(formValue.billing);
            this.clearCartAfterOrder();
        this.payFast.redirectToPayFast(res);
          },
          error: (err) => this.handleCheckoutError(err)
        });
      },
      error: (err) => this.handleCheckoutError(err)
    });
  }

  private createBillingAddressGroup(): UntypedFormGroup {
    return this.fb.group({
      customerName: ['', [trimRequired(), trimPersonName()]],
      customerMobileNo: ['', [trimRequired(), trimPhoneNumber()]],
      customerEmail: ['', [trimRequired(), this.trimEmailValidator]],
      address: ['', [trimRequired(), trimMaxLength(100)]],
      town: ['', [trimRequired(), this.suggestionMatchValidator('billing', 'town')]],
      state: ['', [trimRequired(), this.suggestionMatchValidator('billing', 'state')]],
      postalcode: ['', trimRequired()]
    });
  }

  private trimEmailValidator = (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').toString().trim();
    if (!value) {
      return null;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(value) ? null : { email: true };
  };

  /** Shipping block has no email field — do not require customerEmail here. */
  private createShippingAddressGroup(): UntypedFormGroup {
    return this.fb.group({
      customerName: [''],
      customerMobileNo: [''],
      address: [''],
      town: [''],
      state: [''],
      postalcode: ['']
    });
  }

  private setShippingValidators(required: boolean): void {
    const rules = required
      ? {
          customerName: [trimRequired(), trimPersonName()],
          customerMobileNo: [trimRequired(), trimPhoneNumber()],
          address: [trimRequired(), trimMaxLength(100)],
          town: [trimRequired(), this.suggestionMatchValidator('shipping', 'town')],
          state: [trimRequired(), this.suggestionMatchValidator('shipping', 'state')],
          postalcode: [trimRequired()]
        }
      : {
          customerName: [],
          customerMobileNo: [],
          address: [],
          town: [],
          state: [],
          postalcode: []
        };

    Object.entries(rules).forEach(([key, validators]) => {
      const ctrl = this.shippingGroup.get(key);
      if (ctrl) {
        ctrl.setValidators(validators);
        ctrl.updateValueAndValidity();
      }
    });
  }

  private buildCheckoutPayload(): CheckoutFormValues {
    const raw = this.checkoutForm.value;
    const billing = raw.billing;
    const shipping = raw.shipToDifferentAddress
      ? { ...raw.shipping, customerEmail: billing.customerEmail }
      : billing;

    return {
      billing,
      shipping,
      shipToDifferentAddress: raw.shipToDifferentAddress,
      description: raw.description,
      shippingMethod: this.shippingMethod,
      paymentMethod: this.paymentMethod,
      billingLatitude: this.billingCoordinates?.latitude ?? null,
      billingLongitude: this.billingCoordinates?.longitude ?? null
    };
  }

  private clearCartAfterOrder(): void {
    this.clearShippingLocalStorage();
    this.isShippingCardView = false;
    this.productService.clearCheckoutAfterOrder();
    this.products = [];
    this.appliedCouponCodes = [];
    this.pricing = null;
    this.resetCourierSelection();
  }

  private handleCheckoutError(err: any): void {
    this.loading = false;
    this.showPlaceOrderError(
      extractAbpErrorMessage(err, 'Could not complete checkout. Please try again.')
    );
  }

  private showPlaceOrderError(message: string): void {
    this.placeOrderError = message;

    const needsSignIn = /sign in/i.test(message);
    void Swal.fire({
      icon: 'error',
      title: 'Could not place order',
      text: message,
      confirmButtonText: needsSignIn ? 'Sign in' : 'OK',
      confirmButtonColor: '#f0b429'
    }).then((result) => {
      if (result.isConfirmed && needsSignIn) {
        this.auth.navigateToLogin('/shop/checkout');
      }
    });
  }

  control(path: string): AbstractControl | null {
    return this.checkoutForm.get(path);
  }

  isInvalid(path: string): boolean {
    const ctrl = this.control(path);
    return !!(ctrl && ctrl.invalid && (ctrl.touched || ctrl.dirty));
  }

  trimField(group: 'billing' | 'shipping', field: string): void {
    const ctrl = this.checkoutForm.get(`${group}.${field}`);
    if (ctrl && typeof ctrl.value === 'string') {
      ctrl.setValue(ctrl.value.trim());
      ctrl.markAsTouched();
      ctrl.updateValueAndValidity();
    }
  }

  private prefillCheckoutCustomerDetails(): void {
    if (!this.auth.isLoggedIn()) {
      this.applyStoredCustomerProfile();
      return;
    }

    this.auth.refreshCustomerProfileForCheckout().subscribe({
      next: () => this.applyStoredCustomerProfile(),
      error: () => this.applyStoredCustomerProfile()
    });
  }

  private applyStoredCustomerProfile(): void {
    const profile = this.auth.getCustomerProfile();
    const email = profile?.customerEmail || this.auth.getCustomerEmail();

    if (!profile && !email) {
      return;
    }

    const current = this.billingGroup.value as CheckoutAddressFormValues;
    const patch: Partial<CheckoutAddressFormValues> = {};

    if (!current.customerName?.trim() && profile?.customerName) {
      patch.customerName = profile.customerName;
    }
    if (!current.customerMobileNo?.trim() && profile?.customerMobileNo) {
      patch.customerMobileNo = profile.customerMobileNo;
    }
    if (!current.customerEmail?.trim() && email) {
      patch.customerEmail = email;
    }
    if (!current.address?.trim() && profile?.address) {
      patch.address = profile.address;
    }
    if (!current.town?.trim() && profile?.town) {
      patch.town = profile.town;
    }
    if (!current.state?.trim() && profile?.state) {
      patch.state = profile.state;
    }
    if (!current.postalcode?.trim() && profile?.postalcode) {
      patch.postalcode = profile.postalcode;
    }

    if (Object.keys(patch).length) {
      this.googleAddressService.isAddressSelect = true;
      if (patch.address?.trim()) {
        this.lastSelectedValues.billing.address = patch.address.trim();
      }
      if (patch.town?.trim()) {
        this.lastSelectedValues.billing.town = patch.town.trim();
      }
      if (patch.state?.trim()) {
        this.lastSelectedValues.billing.state = patch.state.trim();
      }
      this.googleAddressService.clearSuggestions();
      this.activeAutocompleteKey = null;
      this.highlightedIndex = -1;
      this.billingGroup.patchValue(patch, { emitEvent: false });
      this.billingGroup.get('town')?.updateValueAndValidity({ emitEvent: false });
      this.billingGroup.get('state')?.updateValueAndValidity({ emitEvent: false });
      this.googleAddressService.isAddressSelect = false;
    }

    // Prefill can finish after cart subscriptions already tried (and skipped) shipping.
    // Once a complete saved address is shown as the card, load cargo options immediately.
    if (this.canShowBillingCard) {
      this.isBillingCardView = true;
      this.pricingRequested$.next();
    }

    this.refreshLocalPickupAvailability();
  }

  private shouldQuoteShipping(): boolean {
    if (this.shippingMethod !== OnlineShopShippingMethod.Shipping || this.courierSelectionSkipped) {
      return false;
    }
    const address = this.resolveShippingAddressForRate();
    return this.isAddressConfirmedForShippingRate() && this.isShippingAddressComplete(address);
  }

  private isAddressConfirmedForShippingRate(): boolean {
    if (!this.isBillingCardView) {
      return false;
    }

    if (this.shipToDifferentAddress && !this.isShippingCardView) {
      return false;
    }

    return true;
  }

  /**
   * Asks the server to price the whole order. This is the only place checkout money comes from:
   * the request carries product ids, quantities, the coupon code, the address and the chosen
   * courier, and every displayed figure is read back out of the response.
   */
  private requestPricing(): void {
    const items = this.productService.buildPricingCartLines(this.products);
    if (!items.length) {
      this.pricing = null;
      this.pendingCouponCode = null;
      this.couponApplying = false;
      return;
    }

    const address = this.resolveShippingAddressForRate();

    // A courier quote needs a confirmed, complete address. Until then price the goods alone so the
    // customer still sees a subtotal rather than a spinner.
    const includeShipping = this.shouldQuoteShipping();

    const requestId = ++this.pricingRequestId;
    if (includeShipping) {
      this.shippingLoading = true;
    }

    this.onlineShopCheckout
      .calculatePricing({
        storeId: this.auth.storeId,
        items,
        couponCodes: this.appliedCouponCodes,
        shippingMethod: this.shippingMethod,
        includeShipping,
        countryCode: this.defaultCountryCode,
        address: address?.address?.trim() ?? null,
        city: address?.town?.trim() ?? null,
        state: address?.state?.trim() ?? null,
        postalCode: address?.postalcode?.trim() ?? null,
        selectedCourierCompany: this.selectedCourierOption?.courierCompany ?? null,
        selectedCourierServiceType: this.selectedCourierOption?.courierServiceType ?? null
      })
      .pipe(catchError(() => of(null)), takeUntil(this.destroy$))
      .subscribe((result) => {
        if (requestId !== this.pricingRequestId) {
          return;
        }
        this.shippingLoading = false;

        if (!result) {
          // The quote failed, so there is no verdict to report. The code stays applied and visible
          // rather than being dropped on a network hiccup.
          if (this.pendingCouponCode) {
            this.pendingCouponCode = null;
            this.couponApplying = false;
            this.toastr.warning('Could not check that coupon just now. Please try again.');
          }
          return;
        }

        this.pricing = result;
        this.settlePendingCoupon(result);

        if (includeShipping) {
          this.cachedCourierOptions = result.courierOptions;
          this.syncCourierSelectionAfterPricing();
        }

        this.applyPaymentMethodDefaults();
      });
  }

  /**
   * Adopts the courier the server priced. Re-quoting here would loop, so the selection simply
   * follows the engine's choice unless the customer has already picked an option that still exists.
   */
  private syncCourierSelectionAfterPricing(): void {
    const options = this.shippingCourierOptions;
    if (!options.length) {
      this.selectedCourierOptionKey = null;
      return;
    }

    const previousKey = this.selectedCourierOptionKey;
    if (previousKey && options.some((o) => this.courierOptionKey(o) === previousKey)) {
      return;
    }

    const priced = options.find(
      (o) => o.courierCompany === this.pricing?.courierCompany
        && o.courierServiceType === this.pricing?.courierServiceType
    );
    const fallback = options.find((o) => o.isRecommended) ?? options[0];
    this.selectedCourierOptionKey = this.courierOptionKey(priced ?? fallback);
  }

  private resetCourierSelection(): void {
    this.selectedCourierOptionKey = null;
    this.courierSelectionSkipped = false;
    this.cachedCourierOptions = [];
  }

  private resolveShippingAddressForRate(): CheckoutAddressFormValues {
    if (this.shipToDifferentAddress) {
      return this.shippingGroup.value as CheckoutAddressFormValues;
    }
    return this.billingGroup.value as CheckoutAddressFormValues;
  }

  private isShippingAddressComplete(address: CheckoutAddressFormValues): boolean {
    return !!(
      address?.address?.trim() &&
      address?.town?.trim() &&
      address?.state?.trim() &&
      address?.postalcode?.trim()
    );
  }

  private isShippingFormComplete(address: CheckoutAddressFormValues): boolean {
    return !!(
      address?.customerName?.trim() &&
      address?.customerMobileNo?.trim() &&
      address?.address?.trim() &&
      address?.town?.trim() &&
      address?.state?.trim() &&
      address?.postalcode?.trim()
    );
  }

  private isBillingAddressComplete(address: CheckoutAddressFormValues): boolean {
    return !!(
      address?.customerName?.trim() &&
      address?.customerMobileNo?.trim() &&
      address?.customerEmail?.trim() &&
      address?.address?.trim() &&
      address?.town?.trim() &&
      address?.state?.trim() &&
      address?.postalcode?.trim()
    );
  }

  private saveShippingToLocalStorage(): void {
    const shipping = this.shippingGroup.getRawValue() as CheckoutAddressFormValues;
    const payload: StoredCheckoutShippingAddress = {
      ...shipping,
      confirmedAddress: this.lastSelectedValues.shipping.address,
      confirmedTown: this.lastSelectedValues.shipping.town,
      confirmedState: this.lastSelectedValues.shipping.state,
    };

    try {
      localStorage.setItem(CHECKOUT_SHIPPING_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota / privacy mode errors.
    }
  }

  private loadShippingFromLocalStorage(): void {
    const stored = this.readShippingFromLocalStorage();
    if (!stored) {
      return;
    }

    this.googleAddressService.isAddressSelect = true;
    this.shippingGroup.patchValue({
      customerName: stored.customerName ?? '',
      customerMobileNo: stored.customerMobileNo ?? '',
      address: stored.address ?? '',
      town: stored.town ?? '',
      state: stored.state ?? '',
      postalcode: stored.postalcode ?? '',
    }, { emitEvent: false });

    this.lastSelectedValues.shipping.address = (stored.confirmedAddress ?? stored.address ?? '').trim();
    this.lastSelectedValues.shipping.town = (stored.confirmedTown ?? stored.town ?? '').trim();
    this.lastSelectedValues.shipping.state = (stored.confirmedState ?? stored.state ?? '').trim();

    this.shippingGroup.get('town')?.updateValueAndValidity({ emitEvent: false });
    this.shippingGroup.get('state')?.updateValueAndValidity({ emitEvent: false });
    this.googleAddressService.isAddressSelect = false;

    if (this.canShowShippingCard) {
      this.isShippingCardView = true;
    }
  }

  private readShippingFromLocalStorage(): StoredCheckoutShippingAddress | null {
    try {
      const raw = localStorage.getItem(CHECKOUT_SHIPPING_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      return JSON.parse(raw) as StoredCheckoutShippingAddress;
    } catch {
      return null;
    }
  }

  private clearShippingLocalStorage(): void {
    try {
      localStorage.removeItem(CHECKOUT_SHIPPING_STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }

  private resetShippingAutocompleteState(): void {
    this.lastSelectedValues.shipping = { address: '', town: '', state: '' };
  }

  private applyPaymentMethodDefaults(): void {
    const methods = this.availablePaymentMethods;
    if (!methods.length) {
      return;
    }
    if (!methods.includes(this.paymentMethod)) {
      // Prefer COD when online payment is blocked by unconfirmed shipping.
      if (
        !this.isOnlinePaymentAllowed &&
        methods.includes(OnlineShopPaymentMethod.CashOnDelivery)
      ) {
        this.paymentMethod = OnlineShopPaymentMethod.CashOnDelivery;
        return;
      }
      this.paymentMethod = methods[0];
    }
  }

  private persistCustomerProfileFromBilling(billing: CheckoutAddressFormValues): void {
    this.auth.saveCustomerProfile({
      customerName: billing.customerName,
      customerMobileNo: billing.customerMobileNo,
      customerEmail: billing.customerEmail,
      address: billing.address,
      town: billing.town,
      state: billing.state,
      postalcode: billing.postalcode
    });
  }

  private setupAddressAutocomplete(
    groupName: CheckoutAddressGroup,
    group: UntypedFormGroup
  ): void {
    (['address', 'town', 'state'] as GoogleAddressFieldMode[]).forEach((field) => {
      group.get(field)?.valueChanges
        .pipe(debounceTime(300), takeUntil(this.destroy$))
        .subscribe((value: string) => {
          if (!this.googleAddressService.isAddressSelect && value !== this.lastSelectedValues[groupName][field]) {
            this.activeAutocompleteKey = `${groupName}.${field}`;
            void this.googleAddressService.getPlacePredictions(value, field);
            if (field === 'town' || field === 'state') {
              group.get(field)?.updateValueAndValidity({ emitEvent: false });
            }
          }
          this.googleAddressService.isAddressSelect = false;
        });
    });
  }

  private suggestionMatchValidator(
    group: CheckoutAddressGroup,
    field: 'town' | 'state'
  ): ValidatorFn {
    return mustMatchSelectedValue(() => this.lastSelectedValues[group][field]);
  }
}
