import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { trimRequired, trimPersonName, trimDigitsOnly, trimMaxLength } from './checkout-validators';
import { Router } from '@angular/router';
import { merge, Observable, of, Subject } from 'rxjs';
import { catchError, debounceTime, startWith, takeUntil } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Product } from '../../shared/classes/product';
import { ProductService } from '../../shared/services/product.service';
import { OrderService } from '../../shared/services/order.service';
import { CreatePayFastCheckoutRequest, PayFastPaymentService } from './pay-fast-payment.service';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../shared/services/auth.service';
import {
  OnlineShopOrderService,
  OnlineShopPaymentMethod,
  OnlineShopShippingMethod,
  CheckoutOrderAmounts,
  ONLINE_SHOP_PAYMENT_METHOD_LABELS,
  ONLINE_SHOP_SHIPPING_METHOD_LABELS,
  CheckoutFormValues,
  CreateOnlineShopSaleOrderResponse,
  CheckoutAddressFormValues
} from '../../shared/services/online-shop-order.service';
import {
  AppliedShopCouponState,
  CourierShippingOptionResult,
  OnlineShopCheckoutService,
  OnlineShopShippingRateResult
} from '../../shared/services/online-shop-checkout.service';
import { OnlineShopSettingsService } from '../../shared/services/online-shop-settings.service';
import { OnlineShopStorefront } from '../../shared/models/online-shop-storefront.model';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements OnInit, OnDestroy {

  /** Default storefront country until a country selector is added. */
  private readonly defaultCountryCode = 'PK';

  private readonly destroy$ = new Subject<void>();
  private shippingRequestId = 0;

  public checkoutForm: UntypedFormGroup;
  public products: Product[] = [];
  public amount: any;
  public cartSubtotal = 0;
  public loading = false;
  public shippingLoading = false;
  public shippingRate: OnlineShopShippingRateResult | null = null;
  public selectedCourierOptionKey: string | null = null;
  public appliedCoupon: AppliedShopCouponState | null = null;
  public storefront: OnlineShopStorefront | null = null;

  public paymentMethod: OnlineShopPaymentMethod = OnlineShopPaymentMethod.GoPayFast;
  public shippingMethod: OnlineShopShippingMethod = OnlineShopShippingMethod.Shipping;

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
  readonly paymentMethodLabels = ONLINE_SHOP_PAYMENT_METHOD_LABELS;
  readonly shippingMethodLabels = ONLINE_SHOP_SHIPPING_METHOD_LABELS;

  constructor(
    private fb: UntypedFormBuilder,
    public productService: ProductService,
    private orderService: OrderService,
    private onlineShopOrder: OnlineShopOrderService,
    private auth: AuthService,
        private payFast: PayFastPaymentService,
    private router: Router,
  private toastr: ToastrService,
    private translate: TranslateService,
    private onlineShopCheckout: OnlineShopCheckoutService,
    private onlineShopSettings: OnlineShopSettingsService,
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

    this.productService.cartItems.subscribe(response => {
      this.products = response;
      this.refreshShippingRate();
    });
    this.productService.cartTotalAmount().subscribe(amount => {
      this.amount = amount;
      this.cartSubtotal = Number(amount) || 0;
      this.refreshShippingRate();
    });

    this.productService.appliedCoupon$
      .pipe(takeUntil(this.destroy$))
      .subscribe((coupon) => {
        this.appliedCoupon = coupon;
      });

    this.checkoutForm.get('shipToDifferentAddress')?.valueChanges.subscribe((checked: boolean) => {
      this.setShippingValidators(!!checked);
      if (!checked) {
        this.shippingGroup.reset();
      }
      this.refreshShippingRate();
    });

    merge(
      this.billingGroup.valueChanges.pipe(startWith(this.billingGroup.value)),
      this.shippingGroup.valueChanges.pipe(startWith(this.shippingGroup.value))
    )
      .pipe(debounceTime(500), takeUntil(this.destroy$))
      .subscribe(() => this.refreshShippingRate());

    this.prefillCheckoutCustomerDetails();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  courierOptionKey(option: CourierShippingOptionResult): string {
    return `${option.courierCompany}|${option.courierServiceType}`;
  }

  onCourierOptionSelected(key: string): void {
    this.selectedCourierOptionKey = key;
    this.applySelectedCourierToRate();
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

  courierAccentClass(company: string): string {
    const key = (company ?? '').trim().toLowerCase().replace(/\s+/g, '-');
    return `checkout-courier-card--${key || 'default'}`;
  }

  get shippingDestinationCity(): string {
    const address = this.resolveShippingAddressForRate();
    return address?.town?.trim() || 'your city';
  }

  get cartWeightKg(): number {
    return this.onlineShopOrder.calculateCartWeightKg(this.products);
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
    if (method === OnlineShopShippingMethod.LocalPickup) {
      this.clearShippingRate();
      return;
    }
    this.refreshShippingRate();
  }

  get couponDiscount(): number {
    return this.appliedCoupon?.result?.isValid ? this.appliedCoupon.result.discountAmount : 0;
  }

  get orderTotal(): number {
    const shipping =
      this.shippingMethod === OnlineShopShippingMethod.Shipping
        ? this.shippingRate?.finalShippingAmount ?? 0
        : 0;
    const afterCoupon = this.appliedCoupon?.result?.isValid
      ? this.appliedCoupon.result.payableAmountAfterDiscount
      : this.cartSubtotal;
    return Math.round((afterCoupon + shipping) * 100) / 100;
  }

  get showShippingBreakdown(): boolean {
    return (
      this.shippingMethod === OnlineShopShippingMethod.Shipping &&
      !!this.shippingRate &&
      !this.shippingLoading
    );
  }

  /** COD with shipping collected online per store payment settings. */
  get codCollectsShippingOnline(): boolean {
    return !!(
      this.storefront?.collectShippingChargesOnCod &&
      this.storefront?.isCashOnDeliveryEnabled &&
      this.storefront?.isGoPayFastEnabled &&
      this.paymentMethod === OnlineShopPaymentMethod.CashOnDelivery &&
      this.shippingMethod === OnlineShopShippingMethod.Shipping &&
      (this.shippingRate?.finalShippingAmount ?? 0) > 0
    );
  }

  get codRemainingOnDelivery(): number {
    const shipping =
      this.shippingMethod === OnlineShopShippingMethod.Shipping
        ? this.shippingRate?.finalShippingAmount ?? 0
        : 0;
    return Math.max(0, Math.round((this.orderTotal - shipping) * 100) / 100);
  }

  get availablePaymentMethods(): OnlineShopPaymentMethod[] {
    const methods: OnlineShopPaymentMethod[] = [];
    if (this.storefront?.isCashOnDeliveryEnabled !== false) {
      methods.push(OnlineShopPaymentMethod.CashOnDelivery);
    }
    if (this.storefront?.isGoPayFastEnabled) {
      methods.push(OnlineShopPaymentMethod.GoPayFast);
    }
    if (!methods.length) {
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
    }
    return true;
  }

  get shippingCourierOptions(): CourierShippingOptionResult[] {
    return this.shippingRate?.availableOptions ?? [];
  }

  public get getTotal(): Observable<number> {
    return this.productService.cartTotalAmount();
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
      this.appliedCoupon?.couponCode &&
      !this.appliedCoupon?.result?.isValid
    ) {
      this.toastr.warning('Please apply a valid coupon or remove it.');
      return;
    }

    this.loading = true;
    const formValue = this.buildCheckoutPayload();
    const selectedCourier = this.selectedCourierOption;
    const checkoutAmounts: CheckoutOrderAmounts = {
      couponDiscountAmount: this.couponDiscount,
      shippingCharges:
        this.shippingMethod === OnlineShopShippingMethod.Shipping
          ? this.shippingRate?.finalShippingAmount ?? 0
          : 0,
      selectedCourierCompany: selectedCourier?.courierCompany ?? this.shippingRate?.courierCompany ?? null,
      selectedCourierServiceType: selectedCourier?.courierServiceType ?? this.shippingRate?.courierServiceType ?? null
    };
    const orderRequest = this.onlineShopOrder.buildCreateOrderRequest(
      formValue,
      this.products,
      this.paymentMethod,
      this.appliedCoupon,
      checkoutAmounts
    );

    this.onlineShopOrder.createOrder(orderRequest).subscribe({
      next: (created: CreateOnlineShopSaleOrderResponse) => {
        if (!created?.onlineShopSaleOrderId) {
          this.loading = false;
          this.toastr.error(created?.message || 'Order could not be created.');
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
        const payAmount =
          created.amountDueNow != null && created.amountDueNow > 0
            ? created.amountDueNow
            : codShippingPrepay
              ? (this.shippingRate?.finalShippingAmount ?? 0)
              : created.totalAmount;
        const payfastPayload: CreatePayFastCheckoutRequest = {
          orderId: created.onlineShopSaleOrderId,
          basketId: created.transactionReference || created.onlineShopSaleOrderId,
          amount: payAmount,
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

  stripeCheckout() {
    const handler = (<any>window).StripeCheckout.configure({
      key: environment.stripe_token,
      locale: 'auto',
      token: (token: any) => {
        this.orderService.createOrder(this.products, this.checkoutForm.value, token.id, this.amount);
      }
    });
    handler.open({
      name: 'Multikart',
      description: 'Online Fashion Store',
      amount: this.amount * 100
    });
  }

  private createBillingAddressGroup(): UntypedFormGroup {
    return this.fb.group({
      customerName: ['', [trimRequired(), trimPersonName()]],
      customerMobileNo: ['', [trimRequired(), trimDigitsOnly()]],
      customerEmail: ['', [trimRequired(), this.trimEmailValidator]],
      address: ['', [trimRequired(), trimMaxLength(50)]],
      town: ['', trimRequired()],
      state: ['', trimRequired()],
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
          customerMobileNo: [trimRequired(), trimDigitsOnly()],
          address: [trimRequired(), trimMaxLength(50)],
          town: [trimRequired()],
          state: [trimRequired()],
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
      paymentMethod: this.paymentMethod
    };
  }

  private clearCartAfterOrder(): void {
    this.productService.clearCheckoutAfterOrder();
    this.products = [];
    this.appliedCoupon = null;
    this.shippingRate = null;
  }

  private handleCheckoutError(err: any): void {
    this.loading = false;
    const msg =
      err?.error?.error?.message ||
      err?.error?.message ||
      err?.message ||
      'Could not complete checkout. Please try again.';
    this.toastr.error(msg, this.translate.instant('toaster_Heading_Error'), { progressBar: true });
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
      this.billingGroup.patchValue(patch);
    }
  }

  private refreshShippingRate(): void {
    if (this.shippingMethod !== OnlineShopShippingMethod.Shipping) {
      return;
    }

    const address = this.resolveShippingAddressForRate();
    if (!this.isShippingAddressComplete(address)) {
      this.clearShippingRate();
      return;
    }

    const requestId = ++this.shippingRequestId;
    this.shippingLoading = true;

    this.onlineShopCheckout
      .getShippingRate({
        countryCode: this.defaultCountryCode,
        address: address.address.trim(),
        city: address.town.trim(),
        state: address.state.trim(),
        postalCode: address.postalcode.trim(),
        cartSubtotal: this.cartSubtotal,
        cartWeight: this.onlineShopOrder.calculateCartWeightKg(this.products),
        selectedCourierCompany: this.shippingRate?.courierCompany ?? null,
        selectedCourierServiceType: this.shippingRate?.courierServiceType ?? null
      })
      .pipe(
        catchError(() => of(null))
      )
      .subscribe((rate) => {
        if (requestId !== this.shippingRequestId) {
          return;
        }
        this.shippingLoading = false;

        if (!rate || rate.ratesUnavailable) {
          this.shippingRate = null;
          this.selectedCourierOptionKey = null;
          return;
        }

        this.shippingRate = rate;
        this.syncCourierSelectionAfterRateLoad();
      });
  }

  private syncCourierSelectionAfterRateLoad(): void {
    const options = this.shippingCourierOptions;
    if (!options.length) {
      this.selectedCourierOptionKey = null;
      return;
    }

    const previousKey = this.selectedCourierOptionKey;
    if (previousKey && options.some((o) => this.courierOptionKey(o) === previousKey)) {
      this.selectedCourierOptionKey = previousKey;
    } else {
      const recommended = options.find((o) => o.isRecommended) ?? options[0];
      this.selectedCourierOptionKey = this.courierOptionKey(recommended);
    }

    this.applySelectedCourierToRate();
  }

  private applySelectedCourierToRate(): void {
    if (!this.shippingRate || !this.selectedCourierOptionKey) {
      return;
    }

    const selected = this.shippingCourierOptions.find(
      (o) => this.courierOptionKey(o) === this.selectedCourierOptionKey
    );
    if (!selected) {
      return;
    }

    this.shippingRate = {
      ...this.shippingRate,
      cargoOriginalAmount: selected.cargoOriginalAmount,
      shippingDiscountAmount: selected.shippingDiscountAmount,
      finalShippingAmount: selected.finalShippingAmount,
      courierCompany: selected.courierCompany,
      courierServiceType: selected.courierServiceType,
      pickupLocationId: selected.pickupLocationId ?? this.shippingRate.pickupLocationId
    };
  }

  private clearShippingRate(): void {
    this.shippingRequestId++;
    this.shippingRate = null;
    this.shippingLoading = false;
    this.selectedCourierOptionKey = null;
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

  private applyPaymentMethodDefaults(): void {
    const methods = this.availablePaymentMethods;
    if (!methods.includes(this.paymentMethod)) {
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
}
